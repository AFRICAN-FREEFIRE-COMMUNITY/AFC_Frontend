"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Standalone Leaderboard - View page.
// ----------------------------------------------------------------------------
// Thin organizer entry point. It REUSES the admin-owned view component
// (app/(a)/a/leaderboards/standalone/_components/StandaloneLeaderboardView) rather than
// duplicating the read view, resolving the route id and mounting it with the ORGANIZER
// basePath so the internal "Edit" deep-link points at
// /organizer/leaderboards/standalone/create?id=<id> (a route the organizer can reach,
// unlike the admin /a/... routes which are gated adminOnly).
//
// WHY this exists: the admin view page lives under the (a) route group, which
// app/(a)/a/layout.tsx wraps in <ProtectedRoute adminOnly>. So an organizer cannot reach
// it. This organizer route group (app/(organizer)/organizer/...) is gated only on org
// membership (OrganizerProvider), so an organizer CAN reach this page. The backend serves
// the detail to the owning organizer (can_manage is computed per caller), so the organizer
// sees their org's standalone leaderboard and, when they manage it, the "Edit" deep-link.
//
// ROUTE: /organizer/leaderboards/standalone/[id]. Reached from the standalone list rows on the
// organizer Leaderboards page (app/(organizer)/organizer/leaderboards/page.tsx, which passes
// viewHrefBase="/organizer/leaderboards/standalone" to StandaloneLeaderboardList), and from the
// organizer create wizard after publish.
//
// Design: inherited from the shared view component (AFC constants - green title, rounded-md cards,
// outline rounded-full badges).
// ─────────────────────────────────────────────────────────────────────────────

import { use } from "react";
import { StandaloneLeaderboardView } from "@/app/(a)/a/leaderboards/standalone/_components/StandaloneLeaderboardView";

type Params = { id: string };

export default function OrganizerStandaloneLeaderboardViewPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = use(params);
  // Organizer basePath -> "Edit" deep-link to /organizer/leaderboards/standalone/create?id=<id>.
  return (
    <StandaloneLeaderboardView
      id={id}
      basePath="/organizer/leaderboards/standalone"
    />
  );
}
