"use client";

// ── Admin · Winnings ─────────────────────────────────────────────────────────────────────────
// The money side of the wager CMS (inbox #33), one page, six tabs:
//
//   Overview      what the house has earned, what it owes, what is held, the queues.
//   Players       every Winnings account: balance, held, frozen, KYC; -> /a/winnings/players/[u].
//   Withdrawals   the payout queue: approve (two keys above the threshold), reject with a reason,
//                 mark paid by hand when the transfer webhook never came.
//   Adjustments   credits and debits admins made, and the ones waiting for a second key.
//   KYC           who is verified, and force-verify / un-verify with a reason.
//   Ledger        every line, house lines included, filterable.
//
// Roles: finance_admin (backend FINANCE_ROLES); head_admin for co-signs and mark-paid.
// Deep links: ?tab=overview|players|withdrawals|adjustments|kyc|ledger.
//
// CONNECTS TO: lib/api/wagersAdmin.ts -> afc_wager.views_admin. Markets live at /a/wagers.

import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { FullLoader } from "@/components/Loader";
import { NewBadge } from "@/components/NewBadge";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ui/scrollable-tabs";

import { OverviewTab } from "./_components/OverviewTab";
import { PlayersTab } from "./_components/PlayersTab";
import { WithdrawalsTab } from "./_components/WithdrawalsTab";
import { AdjustmentsTab } from "./_components/AdjustmentsTab";
import { KycTab } from "./_components/KycTab";
import { LedgerTab } from "./_components/LedgerTab";

const TABS = ["overview", "players", "withdrawals", "adjustments", "kyc", "ledger"] as const;

function WinningsAdminInner() {
  const t = useTranslations("wagersAdmin");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const param = searchParams.get("tab");
  const [tab, setTab] = useState<string>(param && (TABS as readonly string[]).includes(param) ? param : "overview");
  const onTabChange = (value: string) => {
    setTab(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={<span className="inline-flex flex-wrap items-center gap-2">{t("money.title")}<NewBadge since="2026-09-18" /></span>}
        description={t("money.subtitle")}
      />
      <Tabs value={tab} onValueChange={onTabChange}>
        <ScrollableTabsList className="w-full">
          {TABS.map((v) => <TabsTrigger key={v} value={v} className="md:flex-1">{t(`moneyTabs.${v}`)}</TabsTrigger>)}
        </ScrollableTabsList>
        <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
        <TabsContent value="players" className="mt-4"><PlayersTab /></TabsContent>
        <TabsContent value="withdrawals" className="mt-4"><WithdrawalsTab /></TabsContent>
        <TabsContent value="adjustments" className="mt-4"><AdjustmentsTab /></TabsContent>
        <TabsContent value="kyc" className="mt-4"><KycTab /></TabsContent>
        <TabsContent value="ledger" className="mt-4"><LedgerTab /></TabsContent>
      </Tabs>
    </div>
  );
}

export default function WinningsAdminPage() {
  return (
    <Suspense fallback={<FullLoader />}>
      <WinningsAdminInner />
    </Suspense>
  );
}
