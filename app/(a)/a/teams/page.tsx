"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Combined Teams & Players admin page  (the admin "Teams & Players" sidebar home)
// ----------------------------------------------------------------------------
// Owner request 2026-06-09: the separate Teams + Players admin pages were merged
// into ONE page with pill tabs at /a/teams. /a/players redirects here ?tab=players.
// Owner request 2026-06-13: a "Blacklists" tab embeds the shared BlacklistsTable.
// Owner request 2026-06-20: a "Reports" tab embeds player/team reports triage.
// Owner request 2026-06-29: the two standalone sidebar entries "Blacklists" and
//   "Watchlist" were RETIRED as their own main tabs and folded UNDER this page as
//   tabs (Watchlist is new here; Blacklists already was a tab). The old routes
//   /a/blacklists and /a/watchlist now redirect to ?tab=blacklists / ?tab=watchlist
//   (next.config.ts), and their sidebar entries were removed (constants/nav-links.ts).
//
// PER-TAB ROLE GATING (added with the 2026-06-29 fold-in): the standalone Blacklists
// (head_admin/organizer_admin) and Watchlist (head_admin/event_admin/teams_admin/
// organizer_admin) entries reached audiences WIDER than this page's old gate
// (head_admin/teams_admin). To avoid regressing access, the "Teams & Players" sidebar
// entry is now gated to the UNION of those roles, and EACH tab is shown only to the
// roles that owned its source surface (mirrors the canAccess logic in nav-main.tsx).
// The active tab defaults to the first tab the viewer is allowed to see.
//
// Per-tab bodies (each carries its own PageHeader, so nothing about either surface
// changed): ./_components/TeamsAdminContent, ./_components/PlayersAdminContent,
// ../_components/ReportsAdminContent, ../blacklists/_components/BlacklistsTable,
// ../watchlist/_components/WatchlistAdminContent.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  IconBan,
  IconDownload,
  IconUsersGroup,
  IconUsers,
  IconShield,
  IconEye,
} from "@tabler/icons-react";
import { TeamsAdminContent } from "../_components/TeamsAdminContent";
import { PlayersAdminContent } from "../_components/PlayersAdminContent";
import { ReportsAdminContent } from "../_components/ReportsAdminContent";
import { BlacklistsTable } from "../blacklists/_components/BlacklistsTable";
import { WatchlistAdminContent } from "../watchlist/_components/WatchlistAdminContent";
import { DownloadEsportMediaDialog } from "@/components/esport-media";

// Each tab declares the roles that may see it (mirrors the old standalone nav-links
// allowedRoles for the folded-in surfaces; head_admin/super_admin always pass). null =
// open to anyone who can reach the page. The union of these is the page's nav gate.
const TAB_DEFS = [
  { value: "teams", roles: ["teams_admin"] },
  { value: "players", roles: ["teams_admin"] },
  // Blacklists: was a tab here (teams_admin) AND a standalone dashboard (organizer_admin).
  { value: "blacklists", roles: ["teams_admin", "organizer_admin"] },
  { value: "reports", roles: ["teams_admin"] },
  // Watchlist standalone allowed event_admin/teams_admin/organizer_admin (+ head_admin).
  { value: "watchlist", roles: ["event_admin", "teams_admin", "organizer_admin"] },
] as const;

export default function TeamsAndPlayersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  // Mirror nav-main.tsx canAccess: head_admin/super_admin see everything, otherwise the
  // viewer's roles (granular user.roles + the coarse user.role) must intersect the tab's roles.
  const normalizeRole = (role: string) => role.toLowerCase().replace(/\s+/g, "_");
  const userRoles = [
    ...(Array.isArray(user?.roles) ? user!.roles.map(normalizeRole) : []),
    normalizeRole(user?.role || ""),
  ].filter(Boolean);
  const isSuper = userRoles.includes("super_admin") || userRoles.includes("head_admin");
  const canSeeTab = (roles: readonly string[]) =>
    isSuper || userRoles.some((r) => roles.includes(r));

  // Only the tabs this viewer is allowed to open. (A teams_admin sees all but watchlist's
  // extra audience; an organizer_admin who is not teams_admin sees only Blacklists + Watchlist.)
  const visibleTabs: string[] = TAB_DEFS.filter((td) => canSeeTab(td.roles)).map((td) => td.value);

  // /a/players -> ?tab=players; ?tab=blacklists/watchlist/reports deep-link. Fall back to the
  // FIRST tab the viewer can see (not a hidden one) so nobody lands on an empty page.
  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam && visibleTabs.includes(tabParam) ? tabParam : visibleTabs[0] ?? "teams";
  const [tab, setTab] = useState<string>(initialTab);
  const [mediaOpen, setMediaOpen] = useState(false);

  // Keep the active tab in the URL so a RELOAD restores it (router.replace so back isn't spammed).
  const onTabChange = (v: string) => {
    setTab(v);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", v);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // "Download media" (logos + esport images ZIP) is a Teams/Players action, so only show it to
  // viewers who can see those tabs.
  const showMediaExport = visibleTabs.includes("teams") || visibleTabs.includes("players");

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={onTabChange} className="gap-4">
        {/* shadcn pill/segment tabs (matches the rest of the admin area).
            data-tour anchor: first content step of the teams tour. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList data-tour="teams-tabs">
            {visibleTabs.includes("teams") && (
              <TabsTrigger value="teams">
                <IconUsersGroup className="h-4 w-4" /> Teams
              </TabsTrigger>
            )}
            {visibleTabs.includes("players") && (
              <TabsTrigger value="players">
                <IconUsers className="h-4 w-4" /> Players
              </TabsTrigger>
            )}
            {visibleTabs.includes("blacklists") && (
              <TabsTrigger value="blacklists">
                <IconBan className="h-4 w-4" /> Blacklists
              </TabsTrigger>
            )}
            {visibleTabs.includes("reports") && (
              <TabsTrigger value="reports" data-tour="teams-reports-tab">
                <IconShield className="h-4 w-4" /> Reports
              </TabsTrigger>
            )}
            {/* Owner ask 2026-06-29: watchlist folded in from its old standalone sidebar entry. */}
            {visibleTabs.includes("watchlist") && (
              <TabsTrigger value="watchlist">
                <IconEye className="h-4 w-4" /> Watchlist
              </TabsTrigger>
            )}
          </TabsList>
          {showMediaExport && (
            <Button type="button" variant="outline" size="sm" onClick={() => setMediaOpen(true)}>
              <IconDownload className="mr-1 h-4 w-4" />
              Download media
            </Button>
          )}
        </div>
        <DownloadEsportMediaDialog open={mediaOpen} onOpenChange={setMediaOpen} />

        {/* Each tab keeps its own PageHeader + actions. Content is rendered only when visible. */}
        {visibleTabs.includes("teams") && (
          <TabsContent value="teams">
            <TeamsAdminContent />
          </TabsContent>
        )}
        {visibleTabs.includes("players") && (
          <TabsContent value="players">
            <PlayersAdminContent />
          </TabsContent>
        )}
        {visibleTabs.includes("blacklists") && (
          <TabsContent value="blacklists">
            <BlacklistsTable />
          </TabsContent>
        )}
        {visibleTabs.includes("reports") && (
          <TabsContent value="reports">
            <ReportsAdminContent />
          </TabsContent>
        )}
        {visibleTabs.includes("watchlist") && (
          <TabsContent value="watchlist">
            <WatchlistAdminContent />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
