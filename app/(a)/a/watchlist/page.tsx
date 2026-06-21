"use client";

// Admin Watchlist page (/a/watchlist) — owner 2026-06-21.
// The shared advisory watchlist of suspicious players + teams (NOT a ban — a warning + name
// tags so admins/organizers watch out for them). Renders the shared <WatchlistManager> with
// ENGLISH labels: admin pages under (a)/ are operated in English and are i18n-EXEMPT (per
// WEBSITE/CLAUDE.md). The organizer mirror at /organizer/watchlist passes localized labels.
// Data: lib/watchlist.ts -> afc_auth/views_watchlist.py. Sidebar entry in constants/nav-links.ts.
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

export default function AdminWatchlistPage() {
  return (
    <div className="container py-6">
      <WatchlistManager labels={EN} />
    </div>
  );
}
