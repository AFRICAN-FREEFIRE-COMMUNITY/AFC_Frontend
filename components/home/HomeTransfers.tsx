// components/home/HomeTransfers.tsx
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// "Player transfers" card on /home (signed in), owner-approved preview 2026-09-30 (inbox #93 / #96):
// sits in the right column under Featured Shop Items, the space that was empty beside the taller news
// card; after it on a phone. Six latest moves, the transfer-window line (same dates as the join
// warning and the banner, via lib/useTransferLock.ts), and "See all transfers" into the full feed.
//
// CONNECTS TO: components/transfers/TransferMoves.tsx (data + rows), lib/useTransferLock.ts,
// app/(user)/home/page.tsx (placement), /news?category=transfers (the full feed).
// ─────────────────────────────────────────────────────────────────────────────────────────────────
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconArrowsExchange, IconLock } from "@tabler/icons-react";

import { NewBadge } from "@/components/NewBadge";
import { TransferMovesBody, useLatestTransfers } from "@/components/transfers/TransferMoves";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLocalDateOnly } from "@/lib/i18n/time";
import { useTransferLock } from "@/lib/useTransferLock";
import { cn } from "@/lib/utils";

// The day this surface went live, for the self-expiring NEW tag (owner rule: 5 days, date-driven).
export const HOME_TRANSFERS_LIVE_SINCE = "2026-09-30";

export function HomeTransfers() {
  const t = useTranslations("home");
  const tn = useTranslations("news");
  const data = useLatestTransfers(6);
  const lock = useTransferLock();

  const season = lock.season;
  const date = (iso?: string | null) => (iso ? formatLocalDateOnly(iso) || iso : null);
  let windowLine: React.ReactNode = null;
  if (season) {
    if (lock.locked) {
      const free = date(lock.freeFrom);
      windowLine = free ? t.rich("transfers.window.shutUntil", { date: free, b: (c) => <b>{c}</b> })
        : t.rich("transfers.window.shutNoDate", { b: (c) => <b>{c}</b> });
    } else {
      windowLine = t.rich("transfers.window.openUntil", {
        date: date(season.transfer_window_close) ?? "",
        b: (c) => <b>{c}</b>,
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {tn("transfers.heading")}
          <NewBadge since={HOME_TRANSFERS_LIVE_SINCE} />
        </CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">{tn("transfers.intro")}</p>
      </CardHeader>
      <CardContent>
        {windowLine && (
          <div
            className={cn(
              "mb-3 flex items-start gap-2.5 rounded-md p-3 text-sm",
              lock.locked ? "bg-destructive/10" : "bg-primary/10",
            )}
          >
            {lock.locked ? (
              <IconLock className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            ) : (
              <IconArrowsExchange className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            )}
            <span>{windowLine}</span>
          </div>
        )}
        <TransferMovesBody data={data} count={6} surface="card" />
        <Button asChild className="mt-4 w-full">
          <Link href="/news?category=transfers">{t("transfers.seeAll")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
