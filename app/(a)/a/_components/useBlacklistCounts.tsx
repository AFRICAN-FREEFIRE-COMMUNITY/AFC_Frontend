"use client";

// ─────────────────────────────────────────────────────────────────────────────
// useBlacklistCounts + BlacklistCountCell
// ----------------------------------------------------------------------------
// Shared plumbing for the "Blacklists" COLUMN on the admin Teams & Players tables
// (owner ask 2026-06-13: "add a blacklists tab and column under both teams &
// players page"). Both tables paginate client-side, so the hook fetches the
// counts for the VISIBLE page of rows in ONE bulk call (never per row) and the
// cell renders them as "N (M active)" - red when something blocks right now.
//
// Data: GET /organizers/admin/blacklist-counts/?team_ids=|user_ids= (comma-
// separated ids) via organizersApi.adminBlacklistCounts -> { counts: { "<id>":
// { total, active } } }. The endpoint (afc_organizers/views_blacklist_lookup.py
// :: admin_blacklist_counts) is platform-admin gated and mirrors the lookup's
// counting semantics, so the column always agrees with the Blacklists tab.
//
// CONSUMED BY: TeamsAdminContent.tsx (kind "team", team_id per row) and
// PlayersAdminContent.tsx (kind "user", user_id per row), both rendered as tabs
// of app/(a)/a/teams/page.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { organizersApi } from "@/lib/organizers";

// Per-id payload, mirroring admin_blacklist_counts' serializer:
// total = blacklist rows ever (team) / snapshot rows ever (player);
// active = the ones blocking RIGHT NOW (live expiry, individual lifts honoured).
export type BlacklistCounts = { total: number; active: number };

/**
 * Fetch blacklist counts for the ids currently visible in a table page.
 *
 * kind "team" sends ?team_ids=, kind "user" sends ?user_ids=. The effect keys on
 * the JOINED id string, so re-renders with the same page make no new request and
 * a page change makes exactly ONE. Results merge into a map keyed by stringified
 * id (the backend's response shape), so revisiting a page is served from state.
 * Errors are swallowed silently: the endpoint is platform-admin gated, and a
 * non-platform admin browsing the tables should just see dashes, not toasts.
 */
export function useBlacklistCounts(
  kind: "team" | "user",
  ids: Array<number | string>,
): Record<string, BlacklistCounts> {
  const [counts, setCounts] = useState<Record<string, BlacklistCounts>>({});

  // The visible page's ids as one stable string - the effect's real dependency
  // (the array identity changes every render; the joined string does not).
  const idsKey = ids.filter((id) => id !== null && id !== undefined).join(",");

  useEffect(() => {
    if (!idsKey) return; // empty page (no rows) - nothing to ask for
    let cancelled = false;
    organizersApi
      .adminBlacklistCounts(
        kind === "team" ? { team_ids: idsKey } : { user_ids: idsKey },
      )
      .then((res: any) => {
        if (cancelled) return;
        // Merge (not replace) so counts from previously visited pages survive.
        setCounts((prev) => ({ ...prev, ...(res?.counts ?? {}) }));
      })
      .catch(() => {
        // Silent by design: a 403 (non-platform admin) or transient failure just
        // leaves the column showing dashes - the table itself is unaffected.
      });
    return () => {
      cancelled = true;
    };
  }, [kind, idsKey]);

  return counts;
}

/**
 * One "Blacklists" table cell: "N (M active)", red when M > 0, a dash when the
 * row has no blacklist history (or the counts have not arrived / were denied).
 */
export function BlacklistCountCell({ counts }: { counts?: BlacklistCounts }) {
  if (!counts || counts.total === 0) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <span
      className={
        counts.active > 0 ? "font-medium text-red-500" : "text-muted-foreground"
      }
    >
      {counts.total} ({counts.active} active)
    </span>
  );
}
