"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Standalone Leaderboard - Create wizard.
// ----------------------------------------------------------------------------
// Thin organizer entry point. It REUSES the admin-owned create wizard
// (app/(a)/a/leaderboards/standalone/create/_components/StandaloneCreateWizard) rather than
// duplicating the 4-step flow, mounting it with the ORGANIZER basePath so the wizard
// redirects to /organizer/leaderboards/standalone/<id> after publish (a route the
// organizer can reach, unlike the admin /a/... routes which are gated adminOnly).
//
// WHY this exists: the admin create wizard lives under the (a) route group, which
// app/(a)/a/layout.tsx wraps in <ProtectedRoute adminOnly>. So an organizer cannot
// reach it. This organizer route group (app/(organizer)/organizer/...) is gated only
// on org membership (OrganizerProvider), so an organizer with can_upload_results CAN
// reach this page.
//
// ORG OWNERSHIP: the backend REQUIRES an organizer's create to carry organization_id
// (afc_leaderboard.views._resolve_organization_for_create rejects an organizer create
// without one: 403 "must create under their organization"). So this page reads the
// selected org from OrganizerContext (the layout's org switcher owns the selection)
// and threads its organization_id through the wizard into BasicsStep's create payload.
// The backend then verifies the caller can upload results for THAT org. The backend
// also forces counts_toward_rankings off for organizers, and the wizard's BasicsStep
// hides that AFC-only toggle for non-admins. Organizers DO get the OCR "Upload
// screenshots" batch dialog (it is not admin-gated), which is the goal.
//
// ROUTE: /organizer/leaderboards/standalone/create. Reached from the "Create standalone" button
// on the organizer Leaderboards page (app/(organizer)/organizer/leaderboards/page.tsx, which passes
// createHref="/organizer/leaderboards/standalone/create" to StandaloneLeaderboardList).
//
// Design: inherited from the shared wizard (AFC constants - green title, pill step indicator,
// rounded-md cards). No em or en dashes in any copy.
// ─────────────────────────────────────────────────────────────────────────────

import { StandaloneCreateWizard } from "@/app/(a)/a/leaderboards/standalone/create/_components/StandaloneCreateWizard";
import { useOrganizer } from "@/app/(organizer)/organizer/_components/OrganizerContext";

export default function OrganizerCreateStandaloneLeaderboardPage() {
  // Selected org from the portal layout's switcher; its id is REQUIRED by the
  // backend create endpoint for organizers (see header comment).
  const { membership } = useOrganizer();

  // Organizer basePath -> post-publish redirect to /organizer/leaderboards/standalone/<id>.
  return (
    <StandaloneCreateWizard
      basePath="/organizer/leaderboards/standalone"
      organizationId={membership.organization.organization_id}
    />
  );
}
