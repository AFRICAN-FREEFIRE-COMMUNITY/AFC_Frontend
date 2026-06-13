"use client";

// ─────────────────────────────────────────────────────────────────────────────
// DesignsAdminContent - the "Designs" tab body on the combined admin Events page.
// ----------------------------------------------------------------------------
// Owner request 2026-06-13: the AFC leaderboard DESIGN LIBRARY lives under the Events page (as a
// third tab next to Events + Leaderboards), NOT on the Leaderboards tab. This is where AFC admins
// create/edit the AFC-NATIVE leaderboard designs (branded backgrounds + colours + positioned logos)
// used by AFC's own standalone leaderboards. The export picker on a leaderboard's view page then
// lets the admin pick which design to download.
//
// Mirrors the organizer surface (the design library on /organizer/design), which scopes to that
// org; here organizationId is null = the AFC-native library the backend manages under role=="admin".
//
// RENDERED BY: app/(a)/a/events/page.tsx (the combined page, Designs tab).
// ─────────────────────────────────────────────────────────────────────────────

import { PageHeader } from "@/components/PageHeader";
import { LeaderboardDesignsManager } from "../leaderboards/standalone/_components/LeaderboardDesignsManager";

export const DesignsAdminContent = () => {
  return (
    <div className="space-y-4">
      <PageHeader
        back
        title="Leaderboard Designs"
        description="Branded designs AFC's own leaderboards can be exported onto. Upload backgrounds, set colours, and place logos."
      />
      {/* organizationId omitted (null) -> the AFC-native library (role=="admin" gated server-side).
          canManage is always true on the admin surface. */}
      <LeaderboardDesignsManager organizationId={null} canManage />
    </div>
  );
};
