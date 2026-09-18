"use client";

/**
 * app/(user)/wagers/page.tsx - the market list.
 *
 * WHY (owner 2026-09-18, inbox #33): the May branch's list ran on a mock and failed every rule
 * written since (hairlines, i18n, ids in URLs, US dates). This one reads the real API
 * (lib/api/wagers.ts listMarkets), addresses markets by slug, formats money and times through the
 * shared helpers, and is public (R25): a visitor sees the markets and a sentence about signing
 * in; the "My wagers" tab needs a session and says so (R26, NeedsAccount).
 *
 * TALKS TO  GET wagers/markets/?status&event&q  and GET wagers/settings/ (the kill switch banner).
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconSearch } from "@tabler/icons-react";

import { PageHeader } from "@/components/PageHeader";
import { NeedsAccount } from "@/components/NeedsAccount";
import { NewBadge } from "@/components/NewBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useViewer } from "@/lib/gating";
import { getErrorMessage } from "@/lib/http";
import { getSettings, listMarkets, type MarketSummary, type WagerSettingsPublic } from "@/lib/api/wagers";

import { MarketCard } from "./_components/MarketCard";

type Tab = "open" | "locked" | "settled" | "mine";
const TABS: Tab[] = ["open", "locked", "settled", "mine"];

function WagersPageInner() {
  const t = useTranslations("wagers");
  const { loading: sessionLoading, signedIn } = useViewer();
  const params = useSearchParams();
  const initialTab = (params.get("tab") as Tab) || "open";

  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab) ? initialTab : "open");
  const [q, setQ] = useState("");
  const [event, setEvent] = useState<string>("all");
  const [events, setEvents] = useState<{ slug: string; name: string }[]>([]);
  const [rows, setRows] = useState<MarketSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<WagerSettingsPublic | null>(null);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => setSettings(null));
  }, []);

  const load = useCallback(async () => {
    if (tab === "mine" && !signedIn) {
      setRows([]);
      return;
    }
    setError(null);
    try {
      const data = await listMarkets({ status: tab, event: event === "all" ? undefined : event, q: q || undefined, limit: 48 });
      setRows(data.results);
      setEvents(data.events);
    } catch (err) {
      setRows([]);
      setError(getErrorMessage(err, t("errors.generic")));
    }
  }, [tab, event, q, signedIn, t]);

  useEffect(() => {
    if (sessionLoading) return;
    const handle = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(handle);
  }, [load, sessionLoading, q]);

  const emptyKey = useMemo(() => (q || event !== "all" ? "filtered" : tab), [q, event, tab]);

  return (
    <div className="container py-6">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            {t("title")}
            <NewBadge since="2026-09-18" />
          </span>
        }
        description={t("subtitle")}
      />

      {settings && !settings.wagering_enabled && (
        <div className="bg-muted mb-4 rounded-md px-4 py-3 text-sm">{settings.maintenance_message || t("paused")}</div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="w-full max-w-xl">
          {TABS.map((key) => (
            <TabsTrigger key={key} value={key}>
              {t(`tabs.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="pl-9" aria-label={t("search")} />
        </div>
        <Select value={event} onValueChange={setEvent}>
          <SelectTrigger className="sm:w-56" aria-label={t("allEvents")}>
            <SelectValue placeholder={t("allEvents")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allEvents")}</SelectItem>
            {events.map((e) => (
              <SelectItem key={e.slug} value={e.slug}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tab === "mine" && !sessionLoading && !signedIn ? (
        <div className="mt-8">
          <NeedsAccount action={t("tabs.mine").toLowerCase()} />
        </div>
      ) : rows === null || sessionLoading ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-md" />
          ))}
        </div>
      ) : error ? (
        <p className="text-muted-foreground mt-8 text-center text-sm">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground mt-8 text-center text-sm">{t(`empty.${emptyKey}`)}</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m) => (
            <MarketCard key={m.slug} market={m} />
          ))}
        </div>
      )}

      {!sessionLoading && !signedIn && tab !== "mine" && (
        <div className="mt-6">
          <NeedsAccount action={t("card.place").toLowerCase()} />
        </div>
      )}
    </div>
  );
}

// useSearchParams needs a Suspense boundary above it in the App Router, the same wrapper the
// player-markets page uses.
export default function WagersPage() {
  return (
    <Suspense>
      <WagersPageInner />
    </Suspense>
  );
}
