// ─────────────────────────────────────────────────────────────────────────────
// organizer-tour-steps.ts  —  step definitions for the guided Organizer Tour
// ----------------------------------------------------------------------------
// PURPOSE
//   Central, page-keyed catalogue of the interactive "Take a tour" walkthrough for
//   the ORGANIZER portal (app/(organizer)/organizer/**). It mirrors the admin tour
//   catalogue (app/(a)/a/_components/admin-tour-steps.ts) one-for-one, but with two
//   deliberate differences:
//     1. The user-facing copy (title + description) is NOT inlined here. Instead each
//        step carries a short `id`, and the launcher resolves the copy through
//        next-intl using the key  tour.<pageKey>.<id>.title / .description  in the
//        "organizer" namespace (messages/en/organizer.json). This keeps the portal
//        internationalized (en/fr/pt) per the AFC i18n rule, unlike the admin tour
//        which is English-only.
//     2. Routes are the /organizer/* routes (see resolveOrganizerTourPageKey below).
//
// HOW IT CONNECTS
//   - CONSUMED BY: app/(organizer)/organizer/_components/OrganizerTourLauncher.tsx.
//     The launcher reads the current pathname, maps it to a pageKey via
//     resolveOrganizerTourPageKey(), looks up ORGANIZER_TOUR_STEPS[pageKey], resolves
//     each step's i18n copy, and feeds the result straight into driver.js (the same
//     lightweight tour library the admin launcher uses).
//   - The launcher is mounted in the organizer portal header
//     (app/(organizer)/organizer/layout.tsx), so the "Take a tour" button shows on
//     every organizer page and self-hides where no tour is defined.
//   - Each step targets a real control through a CSS selector. The selectors are the
//     stable `[data-tour="org-…"]` hooks added directly on the organizer pages
//     (and on the sidebar nav in the layout). A selector that matches nothing is
//     silently dropped at runtime, so a tour never throws if a page changes.
//
// COPY RULES (AFC hard rules)
//   - NO em dashes or en dashes in any user-facing string. The strings live in
//     messages/en/organizer.json, not here, but the same rule applies there.
//   - Code comments may use box-drawing dashes — those never render to the user.
//
// ADDING A NEW PAGE LATER (documented pattern)
//   1. Add stable `data-tour="org-my-key"` attributes on the controls to highlight.
//   2. Add a new entry to ORGANIZER_TOUR_STEPS keyed by a short pageKey, listing the
//      steps in order. Reuse ORG_SIDEBAR_STEP as the first step so every tour opens
//      by pointing at the navigation.
//   3. Map the route to that pageKey in resolveOrganizerTourPageKey.
//   4. Add the matching  tour.<pageKey>.<id>.title / .description  keys to
//      messages/en/organizer.json (English only; the translate script fills fr/pt).
//   The launcher, auto-show, and localStorage persistence are generic and need no
//   further wiring.
// ─────────────────────────────────────────────────────────────────────────────

// A single highlighted step.
//   - `id` is the step's i18n key segment. The launcher resolves the popover copy
//     from  tour.<pageKey>.<id>.title / .description  (except the shared sidebar
//     step, whose copy lives at tour.sidebar.title / .description).
//   - `element` is a CSS selector resolved at runtime; if it matches nothing the
//     launcher drops the step (so a layout change never breaks the tour).
//   - `side`/`align` position the popover around the target (driver.js terms).
//   - `activateInactiveTab` / `activateTab` / `lazy` drive multi-tab coverage,
//     identical in meaning to the admin tour (kept here for parity even though the
//     organizer tours below stick to simple, single-view steps).
export type OrganizerTourStep = {
  id: string;
  element: string;
  side?: "top" | "right" | "bottom" | "left" | "over";
  align?: "start" | "center" | "end";
  activateInactiveTab?: string;
  activateTab?: string;
  lazy?: boolean;
};

// Known page keys. Short and stable — they are used as the localStorage suffix
// (afc_org_tour_<pageKey>_done) and as the i18n key segment, so renaming one
// re-shows that tour and orphans its strings.
export type OrganizerTourPageKey =
  // Live Overlays (owner 2026-07-02): the org-gated overlay studio.
  | "overlays"
  | "overlays-studio"
  | "overview"
  | "profile"
  | "events"
  | "event-create"
  | "drafts"
  | "event-detail"
  | "event-edit"
  | "event-groups"
  | "event-leaderboard"
  | "leaderboards"
  | "standalone-create"
  | "standalone-view"
  | "members"
  | "payouts"
  | "metrics"
  | "reviews"
  | "design"
  | "blacklists"
  | "watchlist";

// ── Shared first step: the organizer sidebar navigation ──────────────────────
// Every page's tour opens by pointing at the portal sidebar so a new organizer
// learns where the sections live before we dive into the page itself. The anchor
// `[data-tour="org-sidebar-nav"]` is added on the nav SidebarMenu in
// app/(organizer)/organizer/layout.tsx. On mobile the sidebar is offcanvas
// (hidden) — when the menu is not on screen the step is dropped automatically and
// the tour starts at the page header instead.
//
// NOTE: this step's copy is shared across every page, so it resolves from
// tour.sidebar.title / .description rather than a per-page key (the launcher
// special-cases id === "sidebar").
export const ORG_SIDEBAR_STEP: OrganizerTourStep = {
  id: "sidebar",
  element: '[data-tour="org-sidebar-nav"]',
  side: "right",
  align: "start",
};

// ── Per-page steps ───────────────────────────────────────────────────────────
// The selectors below correspond to the data-tour attributes added on each
// organizer page. Order matters: it is the order the user steps through.
export const ORGANIZER_TOUR_STEPS: Record<
  OrganizerTourPageKey,
  OrganizerTourStep[]
> = {
  // Live Overlays list (app/(organizer)/organizer/overlays/page.tsx)
  overlays: [
    ORG_SIDEBAR_STEP,
    {
      id: "list",
      element: '[data-tour="org-overlays-list"]',
      side: "top",
      align: "center",
    },
  ],
  // Per-event overlay studio (app/(organizer)/organizer/overlays/[eventId]/page.tsx —
  // the SHARED EventOverlayStudio, so the anchors match the admin studio's).
  "overlays-studio": [
    {
      id: "new",
      element: '[data-tour="studio-new-overlay"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "cards",
      element: '[data-tour="studio-cards"]',
      side: "top",
      align: "center",
    },
    {
      id: "broadcast",
      element: '[data-tour="studio-broadcast"]',
      side: "top",
      align: "center",
    },
  ],
  // Overview (app/(organizer)/organizer/overview/page.tsx)
  overview: [
    ORG_SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="org-overview-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "stats",
      element: '[data-tour="org-overview-stats"]',
      side: "bottom",
      align: "center",
    },
  ],

  // Profile (app/(organizer)/organizer/profile/page.tsx)
  profile: [
    ORG_SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="org-profile-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "images",
      element: '[data-tour="org-profile-images"]',
      side: "bottom",
      align: "center",
    },
    {
      id: "save",
      element: '[data-tour="org-profile-save"]',
      side: "top",
      align: "end",
    },
  ],

  // Events list (app/(organizer)/organizer/events/page.tsx)
  events: [
    ORG_SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="org-events-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "create",
      element: '[data-tour="org-events-create"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "table",
      element: '[data-tour="org-events-table"]',
      side: "top",
      align: "center",
    },
  ],

  // Event creation wizard (app/(organizer)/organizer/events/create/page.tsx)
  "event-create": [
    ORG_SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="org-event-create-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "form",
      element: '[data-tour="org-event-create-form"]',
      side: "top",
      align: "center",
    },
    {
      id: "submit",
      element: '[data-tour="org-event-create-submit"]',
      side: "top",
      align: "end",
    },
  ],

  // Draft events (app/(organizer)/organizer/events/drafts/page.tsx)
  drafts: [
    ORG_SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="org-drafts-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "create",
      element: '[data-tour="org-drafts-create"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "table",
      element: '[data-tour="org-drafts-table"]',
      side: "top",
      align: "center",
    },
  ],

  // Event detail hub (app/(organizer)/organizer/events/[slug]/page.tsx)
  "event-detail": [
    ORG_SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="org-event-detail-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "edit",
      element: '[data-tour="org-event-detail-edit"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "links",
      element: '[data-tour="org-event-detail-links"]',
      side: "top",
      align: "center",
    },
  ],

  // Event edit wizard (app/(organizer)/organizer/events/[slug]/edit/page.tsx)
  "event-edit": [
    ORG_SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="org-event-edit-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "tabs",
      element: '[data-tour="org-event-edit-tabs"]',
      side: "bottom",
      align: "start",
    },
  ],

  // Groups & Rosters (app/(organizer)/organizer/events/[slug]/groups/page.tsx)
  "event-groups": [
    ORG_SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="org-event-groups-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "search",
      element: '[data-tour="org-event-groups-search"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "stages",
      element: '[data-tour="org-event-groups-stages"]',
      side: "top",
      align: "center",
    },
  ],

  // Event leaderboard (app/(organizer)/organizer/events/[slug]/leaderboard/page.tsx)
  "event-leaderboard": [
    ORG_SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="org-event-lb-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "stageTabs",
      element: '[data-tour="org-event-lb-stage-tabs"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "table",
      element: '[data-tour="org-event-lb-table"]',
      side: "top",
      align: "center",
    },
  ],

  // Leaderboards list (app/(organizer)/organizer/leaderboards/page.tsx)
  leaderboards: [
    ORG_SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="org-leaderboards-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "search",
      element: '[data-tour="org-leaderboards-search"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "table",
      element: '[data-tour="org-leaderboards-table"]',
      side: "top",
      align: "center",
    },
  ],

  // Standalone leaderboard create wizard
  // (app/(organizer)/organizer/leaderboards/standalone/create/page.tsx)
  "standalone-create": [
    ORG_SIDEBAR_STEP,
    {
      id: "wizard",
      element: '[data-tour="org-standalone-create"]',
      side: "top",
      align: "center",
    },
  ],

  // Standalone leaderboard view
  // (app/(organizer)/organizer/leaderboards/standalone/[id]/page.tsx)
  "standalone-view": [
    ORG_SIDEBAR_STEP,
    {
      id: "view",
      element: '[data-tour="org-standalone-view"]',
      side: "top",
      align: "center",
    },
  ],

  // Members (app/(organizer)/organizer/members/page.tsx)
  members: [
    ORG_SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="org-members-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "add",
      element: '[data-tour="org-members-add"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "table",
      element: '[data-tour="org-members-table"]',
      side: "top",
      align: "center",
    },
  ],

  // Payouts (app/(organizer)/organizer/payouts/page.tsx)
  payouts: [
    ORG_SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="org-payouts-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "stats",
      element: '[data-tour="org-payouts-stats"]',
      side: "bottom",
      align: "center",
    },
    {
      id: "table",
      element: '[data-tour="org-payouts-table"]',
      side: "top",
      align: "center",
    },
  ],

  // Metrics (app/(organizer)/organizer/metrics/page.tsx)
  metrics: [
    ORG_SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="org-metrics-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "stats",
      element: '[data-tour="org-metrics-stats"]',
      side: "bottom",
      align: "center",
    },
    {
      id: "tabs",
      element: '[data-tour="org-metrics-tabs"]',
      side: "bottom",
      align: "start",
    },
  ],

  // Reviews (app/(organizer)/organizer/reviews/page.tsx)
  reviews: [
    ORG_SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="org-reviews-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "events",
      element: '[data-tour="org-reviews-events"]',
      side: "top",
      align: "center",
    },
  ],

  // Design (app/(organizer)/organizer/design/page.tsx)
  design: [
    ORG_SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="org-design-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "manager",
      element: '[data-tour="org-design-manager"]',
      side: "top",
      align: "center",
    },
  ],

  // Blacklists (app/(organizer)/organizer/blacklists/page.tsx)
  blacklists: [
    ORG_SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="org-blacklists-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "add",
      element: '[data-tour="org-blacklists-add"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "table",
      element: '[data-tour="org-blacklists-table"]',
      side: "top",
      align: "center",
    },
  ],

  // Watchlist (app/(organizer)/organizer/watchlist/page.tsx)
  // The page body is the shared <WatchlistManager>; we anchor the page wrapper.
  watchlist: [
    ORG_SIDEBAR_STEP,
    {
      id: "manager",
      element: '[data-tour="org-watchlist-manager"]',
      side: "top",
      align: "center",
    },
  ],
};

// ── Route → pageKey map ──────────────────────────────────────────────────────
// OrganizerTourLauncher calls resolveOrganizerTourPageKey() with the current
// pathname to decide which tour to offer. Keep this in sync with the keys above.
// A route with no tour returns null and the launcher hides itself.
export function resolveOrganizerTourPageKey(
  pathname: string,
): OrganizerTourPageKey | null {
  // Normalise a trailing slash so "/organizer/events/" and "/organizer/events"
  // resolve the same.
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  // ── ORDERING CONTRACT ──────────────────────────────────────────────────────
  // Match the most specific routes FIRST. Deep sub-pages (longer paths,
  // dynamic-segment children) come BEFORE their parent root so e.g.
  // /organizer/events/create never falls through to the /organizer/events list.

  // Simple exact pages.
  if (/^\/organizer\/overlays\/[^/]+$/.test(path)) return "overlays-studio";
  if (path === "/organizer/overlays") return "overlays";
  if (path === "/organizer/overview") return "overview";
  if (path === "/organizer/profile") return "profile";
  if (path === "/organizer/members") return "members";
  if (path === "/organizer/payouts") return "payouts";
  if (path === "/organizer/metrics") return "metrics";
  if (path === "/organizer/reviews") return "reviews";
  if (path === "/organizer/design") return "design";
  if (path === "/organizer/blacklists") return "blacklists";
  if (path === "/organizer/watchlist") return "watchlist";

  // ── Events: static helpers (create, drafts) and dynamic-segment children
  //    (edit, groups, leaderboard) BEFORE the bare [slug] detail and the list.
  if (path === "/organizer/events/create") return "event-create";
  if (path === "/organizer/events/drafts") return "drafts";
  if (/^\/organizer\/events\/[^/]+\/edit$/.test(path)) return "event-edit";
  if (/^\/organizer\/events\/[^/]+\/groups$/.test(path)) return "event-groups";
  if (/^\/organizer\/events\/[^/]+\/leaderboard$/.test(path))
    return "event-leaderboard";
  if (/^\/organizer\/events\/[^/]+$/.test(path)) return "event-detail";
  if (path === "/organizer/events") return "events";
  // Unknown /organizer/events/* route → the events list tour.
  if (path.startsWith("/organizer/events")) return "events";

  // ── Leaderboards: standalone create + [id] view BEFORE the bare list root.
  if (path === "/organizer/leaderboards/standalone/create")
    return "standalone-create";
  if (/^\/organizer\/leaderboards\/standalone\/[^/]+$/.test(path))
    return "standalone-view";
  if (path === "/organizer/leaderboards") return "leaderboards";
  // Unknown /organizer/leaderboards/* route → the leaderboards list tour.
  if (path.startsWith("/organizer/leaderboards")) return "leaderboards";

  return null;
}
