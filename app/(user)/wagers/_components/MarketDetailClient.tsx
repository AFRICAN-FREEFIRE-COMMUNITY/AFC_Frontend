"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { LockCountdown } from "./LockCountdown";
import { PoolBar } from "./PoolBar";
import { PoolBreakdownChart } from "./PoolBreakdownChart";
import { PlaceWagerSheet } from "./PlaceWagerSheet";
import {
  getMarket,
  subscribeToPool,
} from "@/lib/mock-wager/handlers/markets";
import {
  cancelWager,
  listMyWagers,
} from "@/lib/mock-wager/handlers/wagers";
import { runSeed } from "@/lib/mock-wager/seed";
import { getCurrentUser } from "@/lib/mock-wager/handlers/auth";
import { getBalance } from "@/lib/mock-wager/handlers/wallet";
import { WalletProvider, useWallet } from "@/contexts/WalletContext";
import { CANCEL_FEE_BPS, formatMoney } from "@/lib/utils";
import type {
  Balance,
  FxSnapshot,
  Market,
  User,
  Wager,
} from "@/lib/mock-wager/types";

interface MarketDetailClientProps {
  marketId: string;
}

export default function MarketDetailClient({ marketId }: MarketDetailClientProps) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [fx, setFx] = useState<FxSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await runSeed();
      const cur =
        (await getCurrentUser()) ??
        ({
          id: "player_1",
          username: "stormbreaker",
          display_name: "StormBreaker",
          role: "user",
          created_at: "",
        } as User);
      if (cancelled) return;
      setUser(cur);
      try {
        const b = await getBalance(cur.id);
        if (!cancelled) setFx(b.fx);
      } catch {
        if (!cancelled)
          setFx({
            id: "fx_default",
            captured_at: new Date().toISOString(),
            ngn_per_usd: 1500,
            source: "fallback",
          });
      }
      setBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!bootstrapped || !fx || !user) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <WalletProvider userId={user.id}>
      <Inner marketId={marketId} user={user} fx={fx} />
    </WalletProvider>
  );
}

function Inner({
  marketId,
  user,
  fx,
}: {
  marketId: string;
  user: User;
  fx: FxSnapshot;
}) {
  const { balance, refresh: refreshBalance } = useWallet();
  const [market, setMarket] = useState<Market | null>(null);
  const [myWager, setMyWager] = useState<Wager | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const refresh = async () => {
    try {
      const m = await getMarket(marketId);
      setMarket(m);
      const wagers = await listMyWagers({
        user_id: user.id,
        market_id: marketId,
      });
      setMyWager(wagers[0] ?? null);
    } catch (e) {
      toast.error((e as Error).message ?? "Couldn't load market");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId]);

  // Live updates
  useEffect(() => {
    const off = subscribeToPool(marketId, () => refresh());
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId]);

  if (loading || !market) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalMoney = formatMoney(market.total_pool_kobo, fx);
  const isOpen = market.status === "OPEN";
  const winningOption = market.options.find(
    (o) => o.id === market.winning_option_id,
  );

  const onCancelWager = async () => {
    if (!myWager) return;
    setCancelling(true);
    try {
      await cancelWager(myWager.id);
      toast.success("Wager cancelled (1% fee applied)");
      refresh();
      refreshBalance();
    } catch (e) {
      toast.error((e as Error).message ?? "Couldn't cancel wager");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/wagers">
          <ArrowLeft className="size-3.5" />
          Back to Wagers
        </Link>
      </Button>

      <PageHeader
        title={market.title}
        description={market.description}
        action={
          isOpen ? (
            <Button onClick={() => setSheetOpen(true)} data-testid="open-sheet">
              Place Wager
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge
          variant="outline"
          className={
            isOpen
              ? "border-emerald-500/40 text-emerald-400"
              : market.status === "SETTLED"
                ? "border-amber-500/40 text-amber-400"
                : "border-orange-500/40 text-orange-400"
          }
        >
          {market.status.toLowerCase().replace("_", " ")}
        </Badge>
        {(isOpen || market.status === "LOCKED") && (
          <LockCountdown lockAt={market.lock_at} onLocked={refresh} compact />
        )}
        {winningOption && (
          <Badge
            variant="outline"
            className="border-primary/50 text-primary"
            data-testid="winning-option"
          >
            Winner: {winningOption.label}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Options</CardTitle>
              <p className="text-xs text-muted-foreground tabular-nums">
                Total pool {totalMoney.coins} coins · {totalMoney.naira}
              </p>
            </div>
            {market.options.length === 0 ? (
              <p className="text-xs text-muted-foreground">No options.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {market.options.map((opt, idx) => {
                  const isWinner =
                    market.winning_option_id === opt.id &&
                    market.status === "SETTLED";
                  const optMoney = formatMoney(opt.cached_pool_kobo, fx);
                  return (
                    <div
                      key={opt.id}
                      className={`flex flex-col gap-2 rounded-md border p-3 ${isWinner ? "border-primary/40 bg-primary/5" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="size-2.5 rounded-full"
                            style={{
                              backgroundColor: [
                                "#22c55e",
                                "#f59e0b",
                                "#3b82f6",
                                "#f43f5e",
                                "#a855f7",
                                "#10b981",
                              ][idx % 6],
                            }}
                          />
                          <p className="text-sm font-medium">{opt.label}</p>
                          {isWinner && (
                            <Badge
                              variant="outline"
                              className="border-primary/50 text-primary"
                            >
                              Won
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {optMoney.coins} coins · {opt.cached_wager_count} wagers
                        </p>
                      </div>
                      <PoolBar
                        pool_kobo={opt.cached_pool_kobo}
                        total_pool_kobo={market.total_pool_kobo}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <PoolBreakdownChart
            options={market.options}
            total_pool_kobo={market.total_pool_kobo}
            fx={fx}
          />
          {myWager ? (
            <Card data-testid="my-wager-card">
              <CardContent className="flex flex-col gap-2">
                <CardTitle className="text-sm">Your wager</CardTitle>
                <CardDescription className="text-xs">
                  Placed{" "}
                  {new Date(myWager.placed_at).toLocaleString()}
                </CardDescription>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total stake</span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(myWager.total_stake_kobo, fx).coins} coins
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant="outline"
                    className={
                      myWager.status === "ACTIVE"
                        ? "border-primary/50 text-primary"
                        : myWager.status === "SETTLED"
                          ? "border-emerald-500/40 text-emerald-400"
                          : "border-muted text-muted-foreground"
                    }
                  >
                    {myWager.status.toLowerCase()}
                  </Badge>
                </div>
                {myWager.status === "ACTIVE" && isOpen && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCancelWager}
                    disabled={cancelling}
                    data-testid="cancel-wager"
                  >
                    {cancelling ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    Cancel ({CANCEL_FEE_BPS / 100}% fee)
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <PlaceWagerSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        market={market}
        fx={fx}
        userId={user.id}
        balance={balance as Balance | null}
        onPlaced={() => {
          refresh();
          refreshBalance();
        }}
      />
    </div>
  );
}
