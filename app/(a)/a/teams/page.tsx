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
// Owner request 2026-06-13 ("add a blacklists tab and column under both teams &
// players page"): a third "Blacklists" pill tab embeds the SAME oversight surface
// the standalone /a/blacklists dashboard shows (the shared BlacklistsTable
// component); the Teams + Players tables also gained a per-row "Blacklists"
// count column (see TeamsAdminContent / PlayersAdminContent).
//
// The per-tab bodies are the old pages extracted verbatim into:
//   ./_components/TeamsAdminContent.tsx        (the "Teams" tab)
//   ./_components/PlayersAdminContent.tsx      (the "Players" tab)
//   ../blacklists/_components/BlacklistsTable.tsx (the "Blacklists" tab; also
//   rendered by the /a/blacklists dashboard page itself)
// so nothing about either surface's behaviour changed. The detail routes
// /a/teams/[name] and /a/players/[id] are separate pages and are unaffected.
//
// useSearchParams in a client page mirrors the existing repo convention
// (app/(a)/a/events/create/page.tsx) — no Suspense wrapper needed here.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IconBan, IconDownload, IconUsersGroup, IconUsers } from "@tabler/icons-react";
import { TeamsAdminContent } from "../_components/TeamsAdminContent";
import { PlayersAdminContent } from "../_components/PlayersAdminContent";
// The same blacklist oversight surface the /a/blacklists dashboard renders
// (stat cards + filters + table) - shared so the two stay identical.
import { BlacklistsTable } from "../blacklists/_components/BlacklistsTable";
// ZIP export of team logos + player esport images for any picked set (owner 2026-06-12).
import { DownloadEsportMediaDialog } from "@/components/esport-media";

export default function TeamsAndPlayersPage() {
  const searchParams = useSearchParams();
  // /a/players redirects here as ?tab=players; ?tab=blacklists deep-links the
  // new Blacklists tab; everything else opens on Teams.
  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam === "players" || tabParam === "blacklists" ? tabParam : "teams";
  const [tab, setTab] = useState<string>(initialTab);
  // The "Download media" dialog (pick teams/players -> one ZIP of logos + esport images).
  const [mediaOpen, setMediaOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        {/* shadcn pill/segment tabs (matches the rest of the admin area).
            data-tour anchor: first content step of the teams tour. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList data-tour="teams-tabs">
            <TabsTrigger value="teams">
              <IconUsersGroup className="h-4 w-4" /> Teams
            </TabsTrigger>
            <TabsTrigger value="players">
              <IconUsers className="h-4 w-4" /> Players
            </TabsTrigger>
            {/* Owner ask 2026-06-13: the blacklist oversight dashboard as a tab. */}
            <TabsTrigger value="blacklists">
              <IconBan className="h-4 w-4" /> Blacklists
            </TabsTrigger>
          </TabsList>
          {/* Bulk media export: any set of teams (logos) + players (esport images). */}
          <Button type="button" variant="outline" size="sm" onClick={() => setMediaOpen(true)}>
            <IconDownload className="mr-1 h-4 w-4" />
            Download media
          </Button>
        </div>
        <DownloadEsportMediaDialog open={mediaOpen} onOpenChange={setMediaOpen} />

        {/* Each tab keeps its own PageHeader + actions (Rank Teams / Create ghost player). */}
        <TabsContent value="teams">
          <TeamsAdminContent />
        </TabsContent>
        <TabsContent value="players">
          <PlayersAdminContent />
        </TabsContent>
        {/* The SAME surface as /a/blacklists (the shared BlacklistsTable carries
            its own PageHeader, like the other two tabs carry theirs). The endpoint
            behind it is platform-admin gated server-side. */}
        <TabsContent value="blacklists">
          <BlacklistsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
