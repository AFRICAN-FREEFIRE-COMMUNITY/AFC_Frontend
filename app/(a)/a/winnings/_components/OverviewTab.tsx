"use client";

// ── Admin · Winnings · Overview tab ──────────────────────────────────────────────────────────
// The house's position at a glance: revenue (rake, cancel fees, dust), liabilities (every
// player's Winnings, of which held), the open pool, the last day and week of stakes, and the
// queues that need a human. Reads GET /wagers/admin/overview/.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { naira } from "@/lib/api/wagers";
import { getOverview, type Overview } from "@/lib/api/wagersAdmin";

import { Panel, Stat, useAdminRefusal } from "../../wagers/_components/shared";

export function OverviewTab() {
  const t = useTranslations("wagersAdmin");
  const refuse = useAdminRefusal();
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    getOverview().then(setData).catch(refuse);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  const w = data.withdrawals;
  const openWithdrawals = (w.REQUESTED ?? 0) + (w.PENDING_COSIGN ?? 0) + (w.APPROVED ?? 0) + (w.FAILED ?? 0);

  return (
    <div className="flex flex-col gap-4">
      {!data.settings.wagering_enabled && (
        <p className="bg-destructive/15 text-destructive rounded-md px-4 py-3 text-sm font-medium">{t("overview.paused")}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("overview.houseTotal")} value={naira(data.house.total_kobo)} tone="text-primary" />
        <Stat label={t("overview.rake")} value={naira(data.house.HOUSE_RAKE)} />
        <Stat label={t("overview.cancelFees")} value={naira(data.house.HOUSE_CANCEL_FEE)} />
        <Stat label={t("overview.dust")} value={naira(data.house.HOUSE_DUST)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("overview.liabilities")} value={naira(data.liabilities_kobo)} />
        <Stat label={t("overview.held")} value={naira(data.held_kobo)} />
        <Stat label={t("overview.openPool")} value={naira(data.open_pool_kobo)} />
        <Stat label={t("overview.playersWithBalance")} value={data.players_with_balance} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("overview.stakes24h")} value={naira(data.stakes_24h_kobo)} />
        <Stat label={t("overview.stakes7d")} value={naira(data.stakes_7d_kobo)} />
        <Stat label={t("overview.paidOut7d")} value={naira(data.paid_out_7d_kobo)} />
      </div>
      <Panel title={t("overview.queues")}>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li className="flex justify-between gap-2"><Link href="/a/wagers?tab=queue" className="hover:underline">{t("overview.toSettle")}</Link><span className="font-semibold">{data.queue.pending_settlement}</span></li>
          <li className="flex justify-between gap-2"><Link href="/a/wagers?tab=queue" className="hover:underline">{t("overview.lockedWaiting")}</Link><span className="font-semibold">{data.queue.locked}</span></li>
          <li className="flex justify-between gap-2"><Link href="/a/winnings?tab=withdrawals" className="hover:underline">{t("overview.openWithdrawals")}</Link><span className="font-semibold">{openWithdrawals}</span></li>
          <li className="flex justify-between gap-2"><Link href="/a/winnings?tab=adjustments" className="hover:underline">{t("overview.adjustmentsPending")}</Link><span className="font-semibold">{data.adjustments_pending}</span></li>
          <li className="flex justify-between gap-2"><Link href="/a/winnings?tab=players" className="hover:underline">{t("overview.frozen")}</Link><span className="font-semibold">{data.frozen_accounts}</span></li>
          <li className="flex justify-between gap-2"><Link href="/a/wagers" className="hover:underline">{t("overview.openMarkets")}</Link><span className="font-semibold">{data.markets.OPEN ?? 0}</span></li>
        </ul>
      </Panel>
    </div>
  );
}
