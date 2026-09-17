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
import { FullLoader } from "@/components/Loader";
import { useStandaloneRef } from "@/lib/addressRef";
import { StandaloneLeaderboardView } from "../_components/StandaloneLeaderboardView";

type Params = { id: string };

export default function StandaloneLeaderboardViewPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id: ref } = use(params);
  // The address is the leaderboard's slug (owner rule R22); the view needs the numeric id.
  const { id } = useStandaloneRef(ref, (slug) => `/a/leaderboards/standalone/${slug}`);
  // Admin default basePath -> "Edit" deep-link to /a/leaderboards/standalone/create?ref=<slug>.
  if (!id) return <FullLoader />;
  return <StandaloneLeaderboardView id={id} />;
}
