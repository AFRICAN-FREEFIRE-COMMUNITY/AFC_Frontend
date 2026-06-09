"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Combined Teams & Players admin page
// ----------------------------------------------------------------------------
// Owner request 2026-06-09: the two separate admin pages (Teams + Players) were
// merged into ONE page with two pill tabs. This route (/a/teams) is the single
// home, reached from the lone "Teams & Players" sidebar entry. The old /a/players
// route now redirects here with ?tab=players (so existing links/bookmarks keep
// working); this page reads that param to open on the right tab.
//
// The per-tab bodies are the old pages extracted verbatim into:
//   ./_components/TeamsAdminContent.tsx    (the "Teams" tab)
//   ./_components/PlayersAdminContent.tsx  (the "Players" tab)
// so nothing about either surface's behaviour changed. The detail routes
// /a/teams/[name] and /a/players/[id] are separate pages and are unaffected.
//
// useSearchParams in a client page mirrors the existing repo convention
// (app/(a)/a/events/create/page.tsx) — no Suspense wrapper needed here.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IconUsersGroup, IconUsers } from "@tabler/icons-react";
import { TeamsAdminContent } from "../_components/TeamsAdminContent";
import { PlayersAdminContent } from "../_components/PlayersAdminContent";

export default function TeamsAndPlayersPage() {
  const searchParams = useSearchParams();
  // /a/players redirects here as ?tab=players; everything else opens on Teams.
  const initialTab = searchParams.get("tab") === "players" ? "players" : "teams";
  const [tab, setTab] = useState<string>(initialTab);

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        {/* shadcn pill/segment tabs (matches the rest of the admin area). */}
        <TabsList>
          <TabsTrigger value="teams">
            <IconUsersGroup className="h-4 w-4" /> Teams
          </TabsTrigger>
          <TabsTrigger value="players">
            <IconUsers className="h-4 w-4" /> Players
          </TabsTrigger>
        </TabsList>

        {/* Each tab keeps its own PageHeader + actions (Rank Teams / Create ghost player). */}
        <TabsContent value="teams">
          <TeamsAdminContent />
        </TabsContent>
        <TabsContent value="players">
          <PlayersAdminContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
