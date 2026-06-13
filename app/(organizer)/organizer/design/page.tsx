// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Design — the org's self-serve leaderboard DESIGN LIBRARY.
//
// Owner 2026-06-13: the old "request a design" flow (organizer submits a brief, AFC builds it)
// was removed in favour of this self-serve library. Organizers now build their own branded
// designs here (backgrounds, colours, draggable logos) and pick one when EXPORTING a leaderboard
// (the "Export graphic" button on each leaderboard's view page).
//
// This is a thin wrapper around the shared LeaderboardDesignsManager (the same component the admin
// "Designs" tab on /a/events mounts), scoped to this org via organizationId. WRITE access gates on
// can_submit_designs (or owner) - the manager shows the list to any member but hides the
// add/edit/delete controls without that permission.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { PageHeader } from "@/components/PageHeader";
import { LeaderboardDesignsManager } from "@/app/(a)/a/leaderboards/standalone/_components/LeaderboardDesignsManager";
import { useOrganizer } from "../_components/OrganizerContext";

export default function OrganizerDesignPage() {
  const { membership, isOwner } = useOrganizer();
  // Same gate the rest of the portal uses for design work: the design permission, or owner.
  const canManage = membership.permissions.can_submit_designs || isOwner;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Design"
        description="Build branded leaderboard designs: upload backgrounds, set colours, and drag your logos. Pick a design when you export a leaderboard."
      />
      <LeaderboardDesignsManager
        organizationId={membership.organization.organization_id}
        canManage={canManage}
      />
    </div>
  );
}
