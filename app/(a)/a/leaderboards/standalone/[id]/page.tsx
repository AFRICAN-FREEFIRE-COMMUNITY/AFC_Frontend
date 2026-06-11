"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Standalone Leaderboard - View page (admin route).
// ----------------------------------------------------------------------------
// Thin admin entry point. The whole read view lives in the reusable
// StandaloneLeaderboardView (../_components/StandaloneLeaderboardView); this page just
// resolves the route id and mounts it with the DEFAULT (admin) basePath, so the
// "Edit" deep-link points at /a/leaderboards/standalone/create?id=<id>. The organizer
// surface mounts the SAME component with its own basePath, so the view logic is never duplicated.
//
// ROUTE: /a/leaderboards/standalone/[id]. Reached from the standalone list section on the admin
// Leaderboards surface, and from the wizard after publish.
//
// Design: AFC constants - green page title (PageHeader), rounded-md cards, outline rounded-full badges.
// ─────────────────────────────────────────────────────────────────────────────

import { use } from "react";
import { StandaloneLeaderboardView } from "../_components/StandaloneLeaderboardView";

type Params = { id: string };

export default function StandaloneLeaderboardViewPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = use(params);
  // Admin default basePath -> "Edit" deep-link to /a/leaderboards/standalone/create?id=<id>.
  return <StandaloneLeaderboardView id={id} />;
}
