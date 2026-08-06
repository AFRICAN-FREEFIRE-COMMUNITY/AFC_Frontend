"use client";

// ── Organizer · Help Center (/organizer/help) ────────────────────────────────
// The organizer half of the shared reference page. Same component as the admin
// route, told portal="organizer", so it shows only the areas, controls and guides
// that exist inside the organizer portal (no Shop, no platform Settings, and the
// Organizer portal area that admins never see), and every guide links to the
// organizer route rather than the admin one.
//
//   - components/help-center/HelpCenter.tsx  (the page itself)
//   - lib/help-center-data.ts                (which controls and guides exist)
//   - messages/{en,fr,pt}/helpCenter.json    (every word on the page)
// Admin twin: app/(a)/a/help/page.tsx.
//
// Access: app/(organizer)/organizer/layout.tsx already wraps the portal in
// OrganizerGuard, and this page only reads static copy, so it needs no permission
// check of its own. It is intentionally the one portal page with no permission
// gate: someone who cannot yet do a thing should still be able to read how it works.
// Nav entry: NAV_ITEMS in that same layout.
// ─────────────────────────────────────────────────────────────────────────────

import { HelpCenter } from "@/components/help-center/HelpCenter";

export default function OrganizerHelpCenterPage() {
  return <HelpCenter portal="organizer" />;
}
