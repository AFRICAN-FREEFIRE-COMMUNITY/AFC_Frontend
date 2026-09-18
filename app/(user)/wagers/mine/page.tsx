"use client";

/**
 * app/(user)/wagers/mine/page.tsx - every wager the viewer placed, one row each: the market, the
 * lines, the status, what came back, when. Plus lifetime totals (staked, won, lost, refunded).
 * The May "My Wagers" reused market cards and called a cancelled stake "Awaiting Result" (walk
 * row 4.10); this reads the wagers themselves.
 *
 * Account only (R25 gating the page is right here: the data IS the account's).
 * TALKS TO GET wagers/mine/ (lib/api/wagers.ts getMyWagers).
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/PageHeader";
import { NeedsAccount } from "@/components/NeedsAccount";
import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useViewer } from "@/lib/gating";
import { getErrorMessage } from "@/lib/http";
import { getMyWagers, naira, type Wager } from "@/lib/api/wagers";

type Totals = { staked: number; won: number; refunded: number; lost: number };

export default function MyWagersPage() {
  const t = useTranslations("wagers");
  const { loading: sessionLoading, signedIn } = useViewer();
  const [rows, setRows] = useState<Wager[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (offset = 0) => {
    try {
      const data = await getMyWagers({ limit: 20, offset });
      setRows((prev) => (offset && prev ? [...prev, ...data.results] : data.results));
      setTotals(data.totals);
      setNextOffset(data.next_offset);
    } catch (err) {
      setError(getErrorMessage(err, t("errors.generic")));
      setRows([]);
    }
  }, [t]);

  useEffect(() => {
    if (!sessionLoading && signedIn) void load();
  }, [load, sessionLoading, signedIn]);

  return (
    <div className="container py-6">
      <PageHeader title={t("mine.title")} description={t("mine.subtitle")} back />
      {!sessionLoading && !signedIn ? (
        <NeedsAccount action={t("tabs.mine").toLowerCase()} />
      ) : rows === null ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}</div>
      ) : (
        <>
          {totals && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["staked", "won", "lost", "refunded"] as const).map((k) => (
                <div key={k} className="bg-card rounded-md p-4 shadow-sm">
                  <p className="text-muted-foreground text-xs">{t(`mine.${k}`)}</p>
                  <p className={`mt-1 text-xl font-bold ${k === "won" ? "text-primary" : ""}`}>{naira(totals[k])}</p>
                </div>
              ))}
            </div>
          )}
          {error && <p className="text-muted-foreground mt-6 text-sm">{error}</p>}
          {rows.length === 0 && !error ? (
            <div className="mt-8 text-center">
              <p className="text-muted-foreground text-sm">{t("mine.empty")}</p>
              <Button asChild className="mt-3"><Link href="/wagers">{t("mine.browse")}</Link></Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {rows.map((w) => (
                <Link key={w.token} href={`/wagers/${w.market?.slug}`} className="bg-card flex flex-col gap-2 rounded-md p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="line-clamp-1 font-semibold">{w.market?.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {t.rich("mine.placed", { time: () => <LocalTime value={w.created_at} mode="datetime" /> })}
                      </p>
                    </div>
                    <Badge variant={w.status === "WON" ? "default" : w.status === "ACTIVE" ? "secondary" : w.status === "LOST" || w.status === "EXPIRED" ? "destructive" : "pending"}>
                      {t(`wagerStatus.${w.status}`)}
                    </Badge>
                  </div>
                  <ul className="text-muted-foreground text-xs">
                    {w.lines.map((l) => (
                      <li key={l.option_id}>{t("detail.line", { amount: naira(l.stake_kobo), option: l.option })}</li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span>{t("mine.staked")}: <span className="font-semibold">{naira(w.total_stake_kobo)}</span></span>
                    {w.status === "WON" && <span className="text-primary font-medium">{t("mine.payout", { amount: naira(w.payout_kobo) })}</span>}
                    {(w.status === "REFUNDED" || w.status === "CANCELLED") && <span>{t("mine.refund", { amount: naira(w.refund_kobo) })}</span>}
                    {w.cancel_fee_kobo > 0 && <span className="text-muted-foreground">{t("mine.fee", { amount: naira(w.cancel_fee_kobo) })}</span>}
                    {w.market?.settled_option && <span className="text-muted-foreground">{t("card.settledAs", { option: w.market.settled_option })}</span>}
                  </div>
                </Link>
              ))}
              {nextOffset !== null && (
                <Button variant="secondary" className="self-center" onClick={() => void load(nextOffset)}>
                  {t("mine.loadMore")}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
