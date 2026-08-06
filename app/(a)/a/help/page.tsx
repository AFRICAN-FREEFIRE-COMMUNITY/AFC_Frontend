"use client";

// ── Admin · Help Center (/a/help) ────────────────────────────────────────────
// The admin half of the shared reference page: what every admin control does, plus
// the step by step guides for the processes an admin runs (create an event, run it
// on the day, upload and fix results, publish a leaderboard, handle a dispute, send
// a broadcast, run the shop, manage rankings, set up an organizer, go live).
//
// This route is a thin wrapper on purpose. Everything lives in the shared component
// so the admin and organizer pages can never drift apart:
//   - components/help-center/HelpCenter.tsx  (the page itself)
//   - lib/help-center-data.ts                (which controls and guides exist)
//   - messages/{en,fr,pt}/helpCenter.json    (every word on the page)
// The organizer twin is app/(organizer)/organizer/help/page.tsx with portal="organizer".
//
// Access: app/(a)/a/layout.tsx already wraps every admin route in
// <ProtectedRoute adminOnly>, and the page is pure documentation with no writes and
// no data fetching, so it needs no gate of its own. The sidebar entry
// (constants/nav-links.ts) is deliberately un-gated by role for the same reason:
// every admin, whatever their area, should be able to look something up.
// ─────────────────────────────────────────────────────────────────────────────

import { HelpCenter } from "@/components/help-center/HelpCenter";

export default function AdminHelpCenterPage() {
  return <HelpCenter portal="admin" />;
}
