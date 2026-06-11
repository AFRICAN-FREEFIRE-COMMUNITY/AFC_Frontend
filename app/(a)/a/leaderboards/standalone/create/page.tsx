"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Standalone Leaderboard - Create wizard (admin route).
// ----------------------------------------------------------------------------
// Thin admin entry point. The whole 4-step flow lives in the reusable
// StandaloneCreateWizard (./_components/StandaloneCreateWizard); this page just
// mounts it with the DEFAULT (admin) basePath, so the wizard redirects to
// /a/leaderboards/standalone/<id> after publish. The organizer surface mounts the
// SAME component with its own basePath, so the wizard logic is never duplicated.
//
// ROUTE: /a/leaderboards/standalone/create. Reached from the "Create standalone" button on the admin
// Leaderboards surface (LeaderboardsAdminContent). NOTE: the /a/leaderboards exact-path redirect
// (next.config) does NOT touch this nested route.
//
// Design: AFC constants - DM Sans, green page title, pill/segment step indicator, rounded-md cards.
// No em or en dashes in any copy.
// ─────────────────────────────────────────────────────────────────────────────

import { StandaloneCreateWizard } from "./_components/StandaloneCreateWizard";

export default function CreateStandaloneLeaderboardPage() {
  // Admin default basePath -> post-publish redirect to /a/leaderboards/standalone/<id>.
  return <StandaloneCreateWizard />;
}
