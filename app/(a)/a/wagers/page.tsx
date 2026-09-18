"use client";

// ── Admin · Wagers ───────────────────────────────────────────────────────────────────────────
// The market side of the wager CMS (inbox #33, 2026-09-18), one page, four tabs:
//
//   Markets    every market with its status, pool and count; filters; "New market" -> /a/wagers/new;
//              a row -> /a/wagers/[slug] (edit, publish, lock, reopen, void, suggest, settle).
//   Queue      LOCKED and PENDING_SETTLEMENT markets with the suggestion and its evidence, oldest
//              lock first, settle or void without leaving the page.
//   Templates  the market kinds (option source + settle rule), editable.
//   Settings   the one WagerSettings row: kill switch, rake, fees, minimums, thresholds. head_admin.
//
// Roles: wager_admin sees the first three (backend MARKET_ROLES); settings is head_admin only.
// Deep links: ?tab=markets|queue|templates|settings (the same idiom as /a/partners).
//
// CONNECTS TO: lib/api/wagersAdmin.ts -> afc_wager.views_admin. Money side lives at /a/winnings.

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconPlus } from "@tabler/icons-react";

import { FullLoader } from "@/components/Loader";
import { NewBadge } from "@/components/NewBadge";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ui/scrollable-tabs";

import { useWagerRoles } from "./_components/shared";
import { MarketsTab } from "./_components/MarketsTab";
import { QueueTab } from "./_components/QueueTab";
import { TemplatesTab } from "./_components/TemplatesTab";
import { SettingsTab } from "./_components/SettingsTab";

const TABS = ["markets", "queue", "templates", "settings"] as const;

function WagersAdminInner() {
  const t = useTranslations("wagersAdmin");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isHead } = useWagerRoles();

  const visible = TABS.filter((tab) => tab !== "settings" || isHead);
  const param = searchParams.get("tab");
  const [tab, setTab] = useState<string>(param && (visible as readonly string[]).includes(param) ? param : "markets");
  const onTabChange = (value: string) => {
    setTab(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {t("title")}
            <NewBadge since="2026-09-18" />
          </span>
        }
        description={t("subtitle")}
        action={
          <Button asChild className="w-full md:w-auto">
            <Link href="/a/wagers/new"><IconPlus />{t("markets.new")}</Link>
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={onTabChange}>
        <ScrollableTabsList className="w-full">
          {visible.map((v) => (
            <TabsTrigger key={v} value={v} className="md:flex-1">{t(`tabs.${v}`)}</TabsTrigger>
          ))}
        </ScrollableTabsList>
        <TabsContent value="markets" className="mt-4"><MarketsTab /></TabsContent>
        <TabsContent value="queue" className="mt-4"><QueueTab /></TabsContent>
        <TabsContent value="templates" className="mt-4"><TemplatesTab /></TabsContent>
        {isHead && <TabsContent value="settings" className="mt-4"><SettingsTab /></TabsContent>}
      </Tabs>
    </div>
  );
}

export default function WagersAdminPage() {
  return (
    <Suspense fallback={<FullLoader />}>
      <WagersAdminInner />
    </Suspense>
  );
}
