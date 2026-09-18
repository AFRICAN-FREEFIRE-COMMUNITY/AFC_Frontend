"use client";

/**
 * app/(user)/wagers/_components/PlaceWagerSheet.tsx - the place sheet.
 *
 * One naira field per option; the projected payout under each is computed the way the engine
 * pays (afc_wager/engine.py projected_payout_kobo): the pool AFTER this player's stakes, INCLUDING
 * their own stakes on the other options (the May sheet forgot those; walk row 3.3). The rake,
 * the cancel fee and the min / max come from the market, never from the sheet.
 *
 * Confirm posts the lines; the server answers a Paystack checkout URL and the browser goes
 * there. Paystack sends the player back to the market page with ?paid=<reference>, where the
 * page verifies (lib/api/wagers.ts verifyPayment) and the stake joins the pool.
 *
 * On a phone the sheet comes up from the bottom and scrolls inside itself, so Confirm is always
 * reachable however many options a market has (walk row 8.2).
 */
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getErrorMessage } from "@/lib/http";
import { naira, nairaToKobo, placeWager, refusalOf, type MarketDetail } from "@/lib/api/wagers";

function projected(poolAfter: number, rakeBps: number, optionPoolAfter: number, myStake: number): number {
  if (optionPoolAfter <= 0 || myStake <= 0) return 0;
  if (optionPoolAfter >= poolAfter) return myStake;
  const rake = Math.floor((poolAfter * rakeBps) / 10000);
  const net = poolAfter - rake;
  return Math.floor((net * myStake) / optionPoolAfter);
}

export function PlaceWagerSheet({
  market,
  open,
  onOpenChange,
}: {
  market: MarketDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("wagers");
  const [stakes, setStakes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  const lines = useMemo(
    () =>
      market.options
        .map((o) => ({ option: o, kobo: nairaToKobo(stakes[o.id] || "") }))
        .filter((l) => l.kobo > 0),
    [market.options, stakes],
  );
  const total = lines.reduce((s, l) => s + l.kobo, 0);
  const poolAfter = market.pool_kobo + total;
  const belowMin = total > 0 && total < market.min_stake_kobo;
  const aboveMax = market.max_stake_per_user_kobo > 0 && total > market.max_stake_per_user_kobo;
  const canConfirm = total > 0 && !belowMin && !aboveMax && !busy;

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      const out = await placeWager(
        market.slug,
        lines.map((l) => ({ option_id: l.option.id, stake_kobo: l.kobo })),
      );
      toast.success(t("sheet.redirecting"));
      window.location.assign(out.payment_url);
    } catch (err) {
      const refusal = refusalOf(err);
      const key = refusal?.code ? `errors.${refusal.code}` : "errors.generic";
      toast.error(t.has(key) ? t(key) : getErrorMessage(err, t("errors.generic")));
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-2xl border-0 px-4 pt-4 sm:max-w-none">
        <div className="mx-auto w-full max-w-xl">
          <SheetHeader className="px-0">
            <SheetTitle>{t("sheet.title")}</SheetTitle>
            <SheetDescription>{market.title}</SheetDescription>
          </SheetHeader>

          <div className="mt-2 flex flex-col gap-3">
            {market.options.map((o) => {
              const mine = nairaToKobo(stakes[o.id] || "");
              const proj = projected(poolAfter, market.rake_bps, o.pool_kobo + mine, mine);
              const solo = mine > 0 && o.pool_kobo + mine >= poolAfter;
              return (
                <div key={o.id} className="bg-muted/60 flex flex-col gap-2 rounded-md p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{o.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {t("sheet.optionPool", { amount: naira(o.pool_kobo) })}
                    </span>
                  </div>
                  <Input
                    inputMode="decimal"
                    placeholder={t("sheet.amountPlaceholder")}
                    aria-label={t("sheet.stakeOn", { option: o.label })}
                    value={stakes[o.id] || ""}
                    onChange={(e) => setStakes((s) => ({ ...s, [o.id]: e.target.value.replace(/[^\d.]/g, "") }))}
                    className="bg-background"
                  />
                  {mine > 0 && (
                    <p className="text-primary text-xs">
                      {solo ? t("sheet.projectedSolo", { option: o.label }) : t("sheet.projected", { option: o.label, amount: naira(proj) })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-muted/60 mt-4 flex flex-col gap-1 rounded-md p-3 text-xs">
            <div className="flex justify-between text-sm">
              <span>{t("sheet.total")}</span>
              <span className="font-semibold">{naira(total)}</span>
            </div>
            <span className="text-muted-foreground">{t("sheet.rake", { rake: market.rake_bps / 100 })}</span>
            <span className="text-muted-foreground">{t("sheet.cancelFee", { fee: market.cancel_fee_bps / 100 })}</span>
            <span className={belowMin ? "text-destructive" : "text-muted-foreground"}>{t("sheet.minimum", { amount: naira(market.min_stake_kobo) })}</span>
            {market.max_stake_per_user_kobo > 0 && (
              <span className={aboveMax ? "text-destructive" : "text-muted-foreground"}>
                {t("sheet.maximum", { amount: naira(market.max_stake_per_user_kobo) })}
              </span>
            )}
          </div>

          <p className="text-muted-foreground mt-3 text-xs">{t("sheet.howItWorks")}</p>

          {/* Sticky so the pay button stays reachable on a phone while the option list scrolls. */}
          <div className="bg-background sticky bottom-0 mt-4 flex gap-2 pt-3 pb-5">
            <Button variant="secondary" className="flex-1" onClick={() => onOpenChange(false)} disabled={busy}>
              {t("sheet.cancel")}
            </Button>
            <Button className="flex-1" onClick={() => void confirm()} disabled={!canConfirm}>
              {t("sheet.confirm", { amount: naira(total) })}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
