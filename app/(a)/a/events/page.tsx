"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Combined Events & Leaderboards admin page
// ----------------------------------------------------------------------------
// Owner request 2026-06-09: the two separate admin pages (Events + Leaderboards)
// were merged into ONE page with two pill tabs. This route (/a/events) is the
// single home, reached from the lone "Events & Leaderboards" sidebar entry. The
// old /a/leaderboards route redirects here with ?tab=leaderboards (next.config
// redirects()), and this page reads that param to open on the right tab.
//
// The per-tab bodies are the old pages extracted verbatim into:
//   ../_components/EventsAdminContent.tsx        (the "Events" tab)
//   ../_components/LeaderboardsAdminContent.tsx  (the "Leaderboards" tab)
// so nothing about either surface's behaviour changed. All deeper event routes
// (/a/events/create, /a/events/payments, /a/events/[slug], /a/events/[slug]/edit)
// and leaderboard routes (/a/leaderboards/[id], /a/leaderboards/[id]/edit,
// /a/leaderboards/create) are separate pages and are unaffected.
//
// useSearchParams in a client page mirrors the existing repo convention
// (app/(a)/a/events/create/page.tsx) — no Suspense wrapper needed here.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IconCalendar, IconTrophy } from "@tabler/icons-react";
import { EventsAdminContent } from "../_components/EventsAdminContent";
import { LeaderboardsAdminContent } from "../_components/LeaderboardsAdminContent";

export default function EventsAndLeaderboardsPage() {
  const searchParams = useSearchParams();
  // /a/leaderboards redirects here as ?tab=leaderboards; everything else opens on Events.
  const initialTab =
    searchParams.get("tab") === "leaderboards" ? "leaderboards" : "events";
  const [tab, setTab] = useState<string>(initialTab);

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        {/* shadcn pill/segment tabs (matches the rest of the admin area).
            data-tour anchor: first content step of the events tour. */}
        <TabsList data-tour="events-tabs">
          <TabsTrigger value="events">
            <IconCalendar className="h-4 w-4" /> Events
          </TabsTrigger>
          <TabsTrigger value="leaderboards">
            <IconTrophy className="h-4 w-4" /> Leaderboards
          </TabsTrigger>
        </TabsList>

        {/* Each tab keeps its own PageHeader + actions (Event Payments / Create event). */}
        <TabsContent value="events">
          <EventsAdminContent />
        </TabsContent>
        <TabsContent value="leaderboards">
          <LeaderboardsAdminContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
