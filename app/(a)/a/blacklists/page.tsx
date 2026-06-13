"use client";

// ── Admin · Blacklists (the AFC oversight dashboard) ─────────────────────────
// BLACKLIST VISIBILITY (owner ask 2026-06-12): "afc admins can also see this on a
// dashboard, blacklists, how many times, by whom and why."
//
// The whole surface (page header + stat cards + filter toolbar + table +
// pagination) lives in ./_components/BlacklistsTable.tsx - extracted there
// 2026-06-13 so the EXACT same component also renders as the "Blacklists" tab on
// the combined Teams & Players page (app/(a)/a/teams/page.tsx, owner ask: "add a
// blacklists tab and column under both teams & players page"). This page is now
// just the standalone route; behaviour and markup here are unchanged.
//
// Data: GET /organizers/admin/blacklists/ (afc_organizers/views_blacklist_lookup.py
// :: admin_list_blacklists) via organizersApi.adminListBlacklists - see the shared
// component for the full wiring notes. Platform-admin gated server-side
// (head_admin / organizer_admin); the sidebar entry in constants/nav-links.ts is
// gated to the same roles.

import { BlacklistsTable } from "./_components/BlacklistsTable";

export default function AdminBlacklistsPage() {
  return <BlacklistsTable />;
}
