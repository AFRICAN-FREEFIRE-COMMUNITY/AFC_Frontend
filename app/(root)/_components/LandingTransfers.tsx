// app/(root)/_components/LandingTransfers.tsx
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// "Who's moving in AFC", the public landing page's transfers section, owner-approved preview
// 2026-09-30 (inbox #93 / #96, placement "both"). Sits under the stats row, before "Why choose the
// AFC Hub?", so a visitor sees the scene moving before the feature pitch. Eight latest moves in two
// columns from md up, the total on record, and "See all transfers" into the full feed.
//
// Public data only (GET team/transfers/, no auth), so it renders the same for a stranger as for a
// signed-in player. CONNECTS TO: components/transfers/TransferMoves.tsx, app/(root)/page.tsx.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { NewBadge } from "@/components/NewBadge";
import { HOME_TRANSFERS_LIVE_SINCE } from "@/components/home/HomeTransfers";
import { TransferMovesBody, useLatestTransfers } from "@/components/transfers/TransferMoves";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/i18n/number";

export function LandingTransfers() {
  const t = useTranslations("home");
  const data = useLatestTransfers(8);

  return (
    <section className="py-16" aria-labelledby="landing-transfers-heading">
      <div className="container mx-auto px-4">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2 id="landing-transfers-heading" className="flex flex-wrap items-center gap-3 text-3xl font-bold md:text-4xl">
              <span>
                <span className="text-primary">{t("landing.transfers.headingHighlight")}</span>{" "}
                {t("landing.transfers.headingRest")}
              </span>
              <NewBadge since={HOME_TRANSFERS_LIVE_SINCE} />
            </h2>
            <p className="mt-2 text-base text-muted-foreground md:text-lg">
              {t("landing.transfers.intro")}
              {data.total > 0 && <> {t("landing.transfers.total", { count: data.total, formatted: formatNumber(data.total) })}</>}
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/news?category=transfers">{t("transfers.seeAll")}</Link>
          </Button>
        </div>
        <TransferMovesBody data={data} count={8} surface="page" />
      </div>
    </section>
  );
}
