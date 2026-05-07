"use client";

import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { placeWager } from "@/lib/mock-wager/handlers/wagers";
import { CANCEL_FEE_BPS, KOBO_PER_COIN, MIN_WAGER_KOBO, RAKE_BPS, formatMoney } from "@/lib/utils";
import type { Balance, FxSnapshot, Market, MarketOption } from "@/lib/mock-wager/types";

interface PlaceWagerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  market: Market;
  fx: FxSnapshot;
  userId: string;
  balance: Balance | null;
  /** Called after a successful placement. */
  onPlaced?: () => void;
}

interface LineDraft {
  option_id: string;
  // Stake in coins (as a string for the Input). Converted to kobo on submit.
  stake_coins: string;
}

function coinsToKobo(s: string): number {
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * KOBO_PER_COIN);
}

function projectedPayout(
  stake_kobo: number,
  option: MarketOption,
  total_pool_kobo: number,
): number {
  if (stake_kobo <= 0) return 0;
  const new_total = total_pool_kobo + stake_kobo;
  const new_opt_pool = option.cached_pool_kobo + stake_kobo;
  const net_pool = Math.floor((new_total * (10000 - RAKE_BPS)) / 10000);
  if (new_opt_pool <= 0) return 0;
  // Approximate: this user's share of net_pool by their stake fraction within the option.
  return Math.floor((net_pool * stake_kobo) / new_opt_pool);
}

export function PlaceWagerSheet({
  open,
  onOpenChange,
  market,
  fx,
  userId,
  balance,
  onPlaced,
}: PlaceWagerSheetProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const lines: LineDraft[] = useMemo(
    () =>
      market.options
        .filter((o) => coinsToKobo(drafts[o.id] ?? "") > 0)
        .map((o) => ({
          option_id: o.id,
          stake_coins: drafts[o.id] ?? "",
        })),
    [drafts, market.options],
  );

  const totalKobo = lines.reduce(
    (a, l) => a + coinsToKobo(l.stake_coins),
    0,
  );
  const totalMoney = formatMoney(totalKobo, fx);
  const cancelFee = Math.floor((totalKobo * CANCEL_FEE_BPS) / 10000);
  const cancelFeeMoney = formatMoney(cancelFee, fx);

  const minOk = totalKobo >= MIN_WAGER_KOBO;
  const balanceOk = balance ? balance.total_kobo >= totalKobo : false;
  const isLocked = market.status !== "OPEN";
  const canSubmit = !loading && minOk && balanceOk && !isLocked && lines.length > 0;

  const setStake = (option_id: string, value: string) => {
    setDrafts((d) => ({ ...d, [option_id]: value }));
  };

  const reset = () => {
    setDrafts({});
  };

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await placeWager({
        market_id: market.id,
        user_id: userId,
        lines: lines.map((l) => ({
          option_id: l.option_id,
          stake_kobo: coinsToKobo(l.stake_coins),
        })),
      });
      toast.success(`Wager placed: ${totalMoney.coins} coins`);
      reset();
      onOpenChange(false);
      onPlaced?.();
    } catch (e) {
      toast.error((e as Error).message ?? "Couldn't place wager");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto"
        data-testid="place-wager-sheet"
      >
        <SheetHeader>
          <SheetTitle>Place wager</SheetTitle>
          <SheetDescription className="text-xs">
            {market.title}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4 pb-4">
          {isLocked && (
            <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-2 text-xs text-rose-400">
              <AlertTriangle className="size-3.5" />
              Market is {market.status.toLowerCase()} — wagers can't be placed.
            </div>
          )}

          {market.options.map((opt, idx) => {
            const stakeStr = drafts[opt.id] ?? "";
            const stake_kobo = coinsToKobo(stakeStr);
            const proj = projectedPayout(stake_kobo, opt, market.total_pool_kobo);
            const projMoney = formatMoney(proj, fx);
            return (
              <div
                key={opt.id}
                className="flex flex-col gap-2 rounded-md border p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Pool {formatMoney(opt.cached_pool_kobo, fx).coins} coins
                  </p>
                </div>
                <Input
                  type="number"
                  inputMode="decimal"
                  step={0.1}
                  min={0}
                  placeholder="0.0"
                  value={stakeStr}
                  onChange={(e) => setStake(opt.id, e.target.value)}
                  disabled={isLocked || loading}
                  data-testid={`stake-input-${idx}`}
                />
                {stake_kobo > 0 && (
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    if {opt.label} wins → ≈ {projMoney.coins} coins ({projMoney.naira})
                  </p>
                )}
              </div>
            );
          })}

          <div className="flex flex-col gap-1 rounded-md bg-muted/40 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total stake</span>
              <span
                className="font-semibold tabular-nums"
                data-testid="total-stake"
              >
                {totalMoney.coins} coins · {totalMoney.naira}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Cancel fee (1%)</span>
              <span className="tabular-nums">{cancelFeeMoney.coins} coins</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>House rake (5%)</span>
              <span className="tabular-nums">applied at settle time</span>
            </div>
            {balance && (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Wallet balance</span>
                <span className="tabular-nums">
                  {formatMoney(balance.total_kobo, fx).coins} coins
                </span>
              </div>
            )}
          </div>

          {totalKobo > 0 && !minOk && (
            <p className="text-xs text-rose-400">
              Min stake is {MIN_WAGER_KOBO / KOBO_PER_COIN} coins (₦
              {MIN_WAGER_KOBO / 100}).
            </p>
          )}
          {totalKobo > 0 && !balanceOk && (
            <p className="text-xs text-rose-400">
              Insufficient balance. Top up via the Deposit tab.
            </p>
          )}

          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={!canSubmit}
              className="flex-1"
              data-testid="place-wager-submit"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirm wager
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
