"use client";

// WatchlistAdminContent
// ─────────────────────
// The admin watchlist surface (shared <WatchlistManager> with ENGLISH labels), extracted here
// 2026-06-29 so the SAME component renders both:
//   - the "Watchlist" tab on the combined Teams & Players page (app/(a)/a/teams/page.tsx), and
//   - (previously) the standalone /a/watchlist route, now retired to a redirect -> /a/teams?tab=watchlist
//     (next.config.ts), per owner request "blacklists + watchlist should sit UNDER /a/teams, not as
//     their own main sidebar tabs".
//
// Admin pages under (a)/ are operated in English and are i18n-EXEMPT (per WEBSITE/CLAUDE.md), so the
// labels are inline English; the organizer mirror at /organizer/watchlist passes localized labels.
// Data: lib/watchlist.ts -> afc_auth/views_watchlist.py.

import { WatchlistManager, type WatchlistLabels } from "@/components/watchlist/WatchlistManager";

const EN: WatchlistLabels = {
  title: "Watchlist",
  subtitle:
    "Suspicious players and teams flagged for admins and organizers to watch out for. This is a warning only, it never blocks registration or play.",
  tabPlayers: "Players",
  tabTeams: "Teams",
  searchPlaceholder: "Search name or UID...",
  addButton: "Add to watchlist",
  addPlayerTitle: "Watch a player",
  addTeamTitle: "Watch a team",
  addPlayerDesc: "Enter the player's username and why they're being watched.",
  addTeamDesc: "Enter the team name and why it's being watched.",
  nameLabelPlayer: "Player username",
  nameLabelTeam: "Team name",
  reasonLabel: "Reason",
  reasonPlaceholder: "Why are they suspicious? (e.g. off-roster players, suspected cheating)",
  cancel: "Cancel",
  confirmAdd: "Add to watchlist",
  colSubject: "Name",
  colReason: "Reason",
  colAddedBy: "Added by",
  colWhen: "Added",
  colActions: "",
  remove: "Remove",
  sourceUpload: "from upload",
  sourceManual: "manual",
  emptyPlayers: "No players on the watchlist.",
  emptyTeams: "No teams on the watchlist.",
  loadError: "Could not load the watchlist.",
  addError: "Could not add to the watchlist.",
  removeError: "Could not remove from the watchlist.",
  added: "added to the watchlist.",
  removed: "removed from the watchlist.",
};

// Carries its own PageHeader (inside WatchlistManager), exactly like the Blacklists tab's
// BlacklistsTable does, so it drops straight into a TabsContent with no extra chrome.
export function WatchlistAdminContent() {
  return <WatchlistManager labels={EN} />;
}
