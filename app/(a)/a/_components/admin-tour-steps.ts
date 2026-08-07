// ─────────────────────────────────────────────────────────────────────────────
// admin-tour-steps.ts  -  step definitions for the guided Admin Tour
// ----------------------------------------------------------------------------
// PURPOSE
//   Central, page-keyed catalogue of the interactive walkthrough steps used by
//   the Admin Tour (the "Take a tour" guide the owner asked for). This is the
//   separate GUIDED TOUR, distinct from the per-element ⓘ InfoTip tooltips that
//   already live on each admin page (components/ui/info-tip.tsx + lib/help-content.ts).
//
//   It is the exact SIBLING of the organizer catalogue
//   (app/(organizer)/organizer/_components/organizer-tour-steps.ts): the
//   user-facing copy is NOT inlined here. Each step carries a short `id` and the
//   tour resolves the popover copy through next-intl at
//   tour.<pageKey>.<id>.title / .description in the "adminTour" namespace
//   (messages/en/adminTour.json, fr/pt alongside it). Admin surfaces are in scope
//   for translation (owner override 2026-08-03).
//
// HOW IT CONNECTS
//   - CONSUMED BY: app/(a)/a/_components/AdminTour.tsx - the <AdminTour pageKey=…/>
//     component / useAdminTour() hook reads ADMIN_TOUR_STEPS[pageKey], resolves each
//     step's i18n copy, and feeds the result straight into driver.js (the lightweight
//     tour library, see AdminTour.tsx).
//   - The "Take a tour" launcher lives in the persistent admin header
//     (components/site-header.tsx → AdminTourLauncher), which decides the pageKey
//     from the current pathname (see resolveAdminTourPageKey below) and renders
//     <AdminTour pageKey=… />.
//   - Each step targets a real control via a CSS selector. Most selectors are
//     stable `[data-tour="…"]` hooks that we add directly on the admin pages /
//     tab content components (dashboard / events / teams / rankings / player-markets).
//     The sidebar nav is targeted by a structural selector shared across every page.
//
// BOTH-TAB COVERAGE (owner feedback 2026-06-09)
//   The combined pages each host TWO tabs but the first tour only covered one:
//     /a/teams   → Teams tab (Players tab never toured)
//     /a/events  → Events tab (Leaderboards tab never toured)
//   The tours below now walk BOTH tabs. The trick: a step that sits on the tab list
//   can carry `activateInactiveTab`, naming the tab-list anchor. When the user clicks
//   Next on that step, AdminTour clicks that tab list's INACTIVE Radix trigger so the
//   other tab's content mounts, waits a tick, then advances. The follow-on steps that
//   live in the freshly-mounted tab are marked `lazy: true` so they are NOT dropped at
//   build time (their target is not in the DOM until the tab is switched); driver.js
//   resolves their selector at highlight time instead. See AdminTour.tsx buildSteps().
//
// COPY RULES (AFC hard rules)
//   - The strings live in messages/en/adminTour.json, not here, but the rules still
//     apply there: NO em dashes or en dashes in any user-facing string. Use commas,
//     periods, parentheses, or a spaced hyphen. (Code comments may use box-drawing
//     dashes - those never render to the user.)
//   - Tone mirrors lib/help-content.ts: one or two short, plain sentences that say
//     what the control does and why an admin would use it.
//
// ADDING A NEW PAGE LATER (documented pattern - see AdminTour.tsx header too)
//   1. Add stable `data-tour="my-key"` attributes on the controls you want to
//      highlight on that page (primary action button, main table, tabs, etc.).
//   2. Add a new entry to ADMIN_TOUR_STEPS keyed by a short pageKey, listing the
//      steps in order. Reuse SIDEBAR_STEP as the first step so every tour starts
//      by pointing at the navigation.
//   3. Map the route to that pageKey in resolveAdminTourPageKey.
//   4. Add the matching  tour.<pageKey>.<id>.title / .description  keys to
//      messages/en/adminTour.json, then the fr/pt files beside it.
//   That is all - the launcher, auto-show, and localStorage persistence are generic
//   and need no further wiring.
// ─────────────────────────────────────────────────────────────────────────────

// A single highlighted step.
//   - `id` is the step's i18n key segment. AdminTour resolves the popover copy from
//     tour.<pageKey>.<id>.title / .description in the "adminTour" namespace (except
//     the shared sidebar step, whose copy lives at tour.sidebar.title / .description).
//     Keep it short and stable: renaming one orphans its strings.
//   - `element` is a CSS selector resolved at runtime; if it matches nothing,
//     AdminTour silently drops the step (so a tour never throws on a page whose
//     layout changed).
//   - `side`/`align` position the popover around the target (driver.js terms):
//     side = which edge of the element the popover sits on.
//
// Two optional fields drive the both-tab coverage (see header):
//   - activateInactiveTab: a tab-list selector (e.g. '[data-tour="teams-tabs"]').
//     When the user advances PAST this step, AdminTour clicks the inactive Radix
//     tab trigger inside that list so the other tab's content mounts.
//   - lazy: when true, the step is NOT dropped at build time even if its target is
//     not yet in the DOM (it lives in a tab that has not been activated yet). The
//     selector is resolved lazily by driver.js at highlight time.
export type AdminTourStep = {
  id: string;
  element: string;
  side?: "top" | "right" | "bottom" | "left" | "over";
  align?: "start" | "center" | "end";
  activateInactiveTab?: string;
  // Click a SPECIFIC tab trigger (a [data-tour] selector) on Next, then advance. Unlike
  // activateInactiveTab (which clicks the first inactive trigger, fine for a 2-tab page),
  // this targets one exact tab - needed to reach the 3rd/4th tab of a multi-tab page
  // (e.g. the Reports tab on Teams & Players). owner 2026-06-21.
  activateTab?: string;
  lazy?: boolean;
};

// Known page keys. Keep these short and stable - they are used as the localStorage
// suffix (afc_admin_tour_<pageKey>_done), so renaming one re-shows that tour.
export type AdminTourPageKey =
  | "dashboard"
  // ── Live Overlays (owner 2026-07-02): the broadcast overlay hub + per-event studio ──
  | "live-overlays-list"
  | "live-overlays-studio"
  | "events"
  | "teams"
  | "rankings"
  | "player-markets"
  // ── Rankings sub-pages (under /a/rankings/*) ──────────────────────────────
  | "rankings-overview"
  | "rankings-scoring-config"
  | "rankings-tournament-tiers"
  | "rankings-result-markers"
  | "rankings-seasons"
  | "rankings-ghost-teams"
  | "rankings-social"
  | "rankings-prize"
  | "rankings-overrides"
  | "rankings-audit"
  // ── Shop sub-pages (under /a/shop/*) ──────────────────────────────────────
  | "shop-dashboard"
  | "shop-coupons"
  | "shop-inventory"
  | "shop-orders"
  | "shop-vendors"
  | "shop-approvals"
  // ── Events & Leaderboards sub-pages (under /a/events/* and /a/leaderboards/*) ─
  | "events-lb-main"
  | "events-lb-create"
  | "events-lb-payments"
  | "events-lb-detail"
  | "events-lb-edit"
  | "events-lb-ocr"
  | "events-lb-sponsors"
  | "events-lb-leaderboards-create"
  | "events-lb-leaderboards-view"
  | "events-lb-leaderboards-edit"
  // ── Organizations / sponsors / partners / news (orgs-misc area) ───────────
  | "orgs-misc-organizations-list"
  | "orgs-misc-org-reports"
  | "orgs-misc-org-detail"
  | "orgs-misc-sponsors-list"
  | "orgs-misc-sponsors-create"
  | "orgs-misc-sponsors-edit"
  | "orgs-misc-partners-list"
  | "orgs-misc-partners-detail"
  | "orgs-misc-news-list"
  // ── Settings / OCR model / drafts / votes (settings-misc area) ────────────
  | "settings-misc-admins"
  | "settings-misc-ocr-model"
  | "settings-misc-drafts"
  | "settings-misc-votes"
  // ── Help Center (backlog items 5 + 7): the searchable reference this tour
  //    system now sits in front of. See app/(a)/a/help/page.tsx.
  | "help-center";

// ── Shared first step: the sidebar navigation ────────────────────────────────
// Every page's tour opens by pointing at the admin sidebar so a new admin learns
// where the sections live before we dive into the page itself. The selector targets
// the sidebar's nav menu (rendered by components/nav-main.tsx inside the Sidebar);
// `[data-slot="sidebar-menu"]` is the stable shadcn slot the SidebarMenu emits.
// On mobile the sidebar is offcanvas (hidden) - if the menu is not on screen the
// step is dropped automatically, and the tour starts at the page header instead.
//
// NOTE: this step's copy is shared across every page, so it resolves from
// tour.sidebar.title / .description rather than a per-page key (AdminTour
// special-cases id === "sidebar").
const SIDEBAR_STEP: AdminTourStep = {
  id: "sidebar",
  element: '[data-slot="sidebar-menu"]',
  side: "right",
  align: "start",
};

// ── Per-page steps ───────────────────────────────────────────────────────────
// The element selectors below correspond to data-tour attributes we add on each
// admin page / tab content component. Order matters: it is the order the user
// steps through.
export const ADMIN_TOUR_STEPS: Record<AdminTourPageKey, AdminTourStep[]> = {
  // Admin Dashboard (app/(a)/a/dashboard/page.tsx)
  dashboard: [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="dashboard-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "metrics",
      element: '[data-tour="dashboard-metrics"]',
      side: "bottom",
      align: "center",
    },
    {
      id: "quickActions",
      element: '[data-tour="dashboard-quick-actions"]',
      side: "top",
      align: "center",
    },
    {
      id: "recentActivity",
      element: '[data-tour="dashboard-recent-activity"]',
      side: "top",
      align: "center",
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Events and Leaderboards (app/(a)/a/events/page.tsx)
  //   Tab 1 "Events"        → EventsAdminContent.tsx
  //   Tab 2 "Leaderboards"  → LeaderboardsAdminContent.tsx
  // The tour walks the Events tab, then switches to the Leaderboards tab and
  // walks that too (owner feedback: the first tour stopped after Events).
  // ─────────────────────────────────────────────────────────────────────────
  events: [
    SIDEBAR_STEP,
    {
      id: "tabs",
      element: '[data-tour="events-tabs"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "create",
      element: '[data-tour="events-create"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "payments",
      element: '[data-tour="events-payments"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "search",
      element: '[data-tour="events-search"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "list",
      element: '[data-tour="events-list"]',
      side: "top",
      align: "center",
    },
    {
      // Switching step: still highlights the (visible) tab list. On Next, AdminTour
      // clicks the inactive "Leaderboards" trigger so its content mounts, then advances.
      id: "switchToLeaderboards",
      element: '[data-tour="events-tabs"]',
      side: "bottom",
      align: "start",
      activateInactiveTab: '[data-tour="events-tabs"]',
    },
    {
      id: "lbStats",
      element: '[data-tour="leaderboards-stats"]',
      side: "bottom",
      align: "center",
      lazy: true,
    },
    {
      id: "lbSearch",
      element: '[data-tour="leaderboards-search"]',
      side: "bottom",
      align: "start",
      lazy: true,
    },
    {
      id: "lbTable",
      element: '[data-tour="leaderboards-table"]',
      side: "top",
      align: "center",
      lazy: true,
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Teams and Players (app/(a)/a/teams/page.tsx)
  //   Tab 1 "Teams"    → TeamsAdminContent.tsx
  //   Tab 2 "Players"  → PlayersAdminContent.tsx
  // The tour walks the Teams tab, then switches to the Players tab and walks
  // that too (owner feedback: the first tour stopped after Teams).
  // ─────────────────────────────────────────────────────────────────────────
  teams: [
    SIDEBAR_STEP,
    {
      id: "tabs",
      element: '[data-tour="teams-tabs"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "rank",
      element: '[data-tour="teams-rank"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "search",
      element: '[data-tour="teams-search"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "list",
      element: '[data-tour="teams-list"]',
      side: "top",
      align: "center",
    },
    {
      // Switching step: highlights the (visible) tab list. On Next, AdminTour clicks
      // the inactive "Players" trigger so its content mounts, then advances.
      id: "switchToPlayers",
      element: '[data-tour="teams-tabs"]',
      side: "bottom",
      align: "start",
      activateInactiveTab: '[data-tour="teams-tabs"]',
    },
    {
      id: "playersCreate",
      element: '[data-tour="players-create"]',
      side: "bottom",
      align: "end",
      lazy: true,
    },
    {
      id: "playersStats",
      element: '[data-tour="players-stats"]',
      side: "bottom",
      align: "center",
      lazy: true,
    },
    {
      id: "playersSearch",
      element: '[data-tour="players-search"]',
      side: "bottom",
      align: "start",
      lazy: true,
    },
    {
      id: "playersList",
      element: '[data-tour="players-list"]',
      side: "top",
      align: "center",
      lazy: true,
    },
    {
      // Switch to the Reports tab (owner 2026-06-21). activateTab clicks the exact
      // Reports trigger - activateInactiveTab (first-inactive) cannot reach the 4th tab.
      id: "switchToReports",
      element: '[data-tour="teams-reports-tab"]',
      side: "bottom",
      align: "start",
      activateTab: '[data-tour="teams-reports-tab"]',
    },
    {
      id: "reportsStats",
      element: '[data-tour="reports-stats"]',
      side: "bottom",
      align: "center",
      lazy: true,
    },
    {
      id: "reportsFilters",
      element: '[data-tour="reports-filters"]',
      side: "bottom",
      align: "start",
      lazy: true,
    },
    {
      id: "reportsTable",
      element: '[data-tour="reports-table"]',
      side: "top",
      align: "center",
      lazy: true,
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Rankings & Tiering (app/(a)/a/rankings/page.tsx)
  //   The control room for the public rankings: season scope, quarterly
  //   evaluation, tier distribution, publishing, and the team score table.
  //   The sub-pages (Scoring Config, Result Markers, Seasons, Ghost Teams,
  //   Audit, etc.) live under /a/rankings/* and are reached from the sub-nav
  //   and the quick-link cards on this page; the tour points the user at them.
  // ─────────────────────────────────────────────────────────────────────────
  rankings: [
    SIDEBAR_STEP,
    {
      id: "header",
      element: '[data-tour="rankings-header"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "season",
      element: '[data-tour="rankings-season"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "status",
      element: '[data-tour="rankings-status"]',
      side: "bottom",
      align: "center",
    },
    {
      id: "evaluation",
      element: '[data-tour="rankings-evaluation"]',
      side: "right",
      align: "start",
    },
    {
      id: "distribution",
      element: '[data-tour="rankings-distribution"]',
      side: "left",
      align: "start",
    },
    {
      id: "publish",
      element: '[data-tour="rankings-publish"]',
      side: "top",
      align: "center",
    },
    {
      id: "quicklinks",
      element: '[data-tour="rankings-quicklinks"]',
      side: "top",
      align: "center",
    },
    {
      id: "teams",
      element: '[data-tour="rankings-teams"]',
      side: "top",
      align: "center",
    },
  ],

  // Player Markets (app/(a)/a/player-markets/page.tsx)
  "player-markets": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="market-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "tabs",
      element: '[data-tour="market-tabs"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "overview",
      element: '[data-tour="market-overview"]',
      side: "bottom",
      align: "center",
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // RANKINGS SUB-PAGES (under /a/rankings/*)
  //   Each of these is a deep tool reached from the Rankings sub-nav. The parent
  //   "rankings" tour above walks the Overview; these tours walk each detail page
  //   on its own. Anchors are the data-tour hooks added on each sub-page (the
  //   sub-page .tsx files are owned by other agents).
  // ═══════════════════════════════════════════════════════════════════════════

  // Rankings Overview (app/(a)/a/rankings/page.tsx) - the same control room as the
  // parent "rankings" tour, but keyed to the exact /a/rankings route. Uses the
  // fixed data-tour anchors from the area map.
  "rankings-overview": [
    SIDEBAR_STEP,
    {
      id: "header",
      element: '[data-tour="rankings-header"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "season",
      element: '[data-tour="rankings-season"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "status",
      element: '[data-tour="rankings-status"]',
      side: "bottom",
      align: "center",
    },
    {
      id: "evaluation",
      element: '[data-tour="rankings-evaluation"]',
      side: "right",
      align: "start",
    },
    {
      id: "distribution",
      element: '[data-tour="rankings-distribution"]',
      side: "left",
      align: "start",
    },
    {
      id: "publish",
      element: '[data-tour="rankings-publish"]',
      side: "top",
      align: "center",
    },
  ],

  // Scoring Configuration (app/(a)/a/rankings/scoring-config/page.tsx)
  "rankings-scoring-config": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="scoring-config-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "version",
      element: '[data-tour="scoring-config-version"]',
      side: "bottom",
      align: "center",
    },
    {
      id: "unsaved",
      element: '[data-tour="scoring-config-unsaved"]',
      side: "bottom",
      align: "center",
    },
    {
      id: "scales",
      element: '[data-tour="scoring-config-scales"]',
      side: "top",
      align: "center",
    },
    {
      id: "reset",
      element: '[data-tour="scoring-config-reset"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "save",
      element: '[data-tour="scoring-config-save"]',
      side: "bottom",
      align: "end",
    },
  ],

  // Tournament Tiers (app/(a)/a/rankings/tournament-tiers/page.tsx)
  "rankings-tournament-tiers": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="tournament-tiers-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "stats",
      element: '[data-tour="tournament-tiers-stats"]',
      side: "bottom",
      align: "center",
    },
    {
      id: "rules",
      element: '[data-tour="tournament-tiers-rules"]',
      side: "top",
      align: "center",
    },
    {
      id: "add",
      element: '[data-tour="tournament-tiers-add"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "test",
      element: '[data-tour="tournament-tiers-test"]',
      side: "top",
      align: "center",
    },
    {
      id: "save",
      element: '[data-tour="tournament-tiers-save"]',
      side: "bottom",
      align: "end",
    },
  ],

  // Result Markers (app/(a)/a/rankings/results/page.tsx)
  "rankings-result-markers": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="result-markers-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "status",
      element: '[data-tour="result-markers-status"]',
      side: "bottom",
      align: "center",
    },
    {
      id: "search",
      element: '[data-tour="result-markers-search"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "list",
      element: '[data-tour="result-markers-list"]',
      side: "top",
      align: "center",
    },
    {
      id: "flags",
      element: '[data-tour="result-markers-flags"]',
      side: "top",
      align: "center",
    },
    {
      id: "exclusions",
      element: '[data-tour="result-markers-exclusions"]',
      side: "top",
      align: "center",
    },
  ],

  // Seasons (app/(a)/a/rankings/seasons/page.tsx)
  "rankings-seasons": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="seasons-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "create",
      element: '[data-tour="seasons-create"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "list",
      element: '[data-tour="seasons-list"]',
      side: "top",
      align: "center",
    },
    {
      id: "transfer",
      element: '[data-tour="seasons-transfer"]',
      side: "top",
      align: "center",
    },
    {
      id: "evaluation",
      element: '[data-tour="seasons-evaluation"]',
      side: "top",
      align: "center",
    },
    {
      id: "log",
      element: '[data-tour="seasons-log"]',
      side: "top",
      align: "center",
    },
  ],

  // Ghost Teams (app/(a)/a/rankings/ghost-teams/page.tsx)
  "rankings-ghost-teams": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="ghost-teams-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "stats",
      element: '[data-tour="ghost-teams-stats"]',
      side: "bottom",
      align: "center",
    },
    {
      id: "create",
      element: '[data-tour="ghost-teams-create"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "tabs",
      element: '[data-tour="ghost-teams-tabs"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "list",
      element: '[data-tour="ghost-teams-list"]',
      side: "top",
      align: "center",
    },
    {
      id: "claim",
      element: '[data-tour="ghost-teams-claim"]',
      side: "top",
      align: "center",
    },
  ],

  // Social Media verification (app/(a)/a/rankings/social/page.tsx)
  "rankings-social": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="social-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "search",
      element: '[data-tour="social-search"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "list",
      element: '[data-tour="social-list"]',
      side: "top",
      align: "center",
    },
    {
      id: "verify",
      element: '[data-tour="social-verify"]',
      side: "top",
      align: "center",
    },
    {
      id: "correction",
      element: '[data-tour="social-correction"]',
      side: "top",
      align: "center",
    },
    {
      id: "brackets",
      element: '[data-tour="social-brackets"]',
      side: "top",
      align: "center",
    },
  ],

  // Prize money (app/(a)/a/rankings/prize/page.tsx)
  "rankings-prize": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="prize-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "total",
      element: '[data-tour="prize-total"]',
      side: "bottom",
      align: "center",
    },
    {
      id: "add",
      element: '[data-tour="prize-add"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "search",
      element: '[data-tour="prize-search"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "list",
      element: '[data-tour="prize-list"]',
      side: "top",
      align: "center",
    },
    {
      id: "scale",
      element: '[data-tour="prize-scale"]',
      side: "top",
      align: "center",
    },
  ],

  // Overrides (app/(a)/a/rankings/overrides/page.tsx)
  "rankings-overrides": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="overrides-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "search",
      element: '[data-tour="overrides-search"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "list",
      element: '[data-tour="overrides-list"]',
      side: "top",
      align: "center",
    },
    {
      id: "tier",
      element: '[data-tour="overrides-tier"]',
      side: "top",
      align: "center",
    },
    {
      id: "deduct",
      element: '[data-tour="overrides-deduct"]',
      side: "top",
      align: "center",
    },
    {
      id: "ban",
      element: '[data-tour="overrides-ban"]',
      side: "top",
      align: "center",
    },
  ],

  // Audit log (app/(a)/a/rankings/audit/page.tsx)
  "rankings-audit": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="audit-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "filters",
      element: '[data-tour="audit-filters"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "search",
      element: '[data-tour="audit-search"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "list",
      element: '[data-tour="audit-list"]',
      side: "top",
      align: "center",
    },
    {
      id: "details",
      element: '[data-tour="audit-details"]',
      side: "top",
      align: "center",
    },
    {
      id: "raw",
      element: '[data-tour="audit-raw"]',
      side: "top",
      align: "center",
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // SHOP SUB-PAGES (under /a/shop/*)
  //   The shop area dashboard plus its management sub-pages (coupons, inventory,
  //   orders, vendors, approvals). Anchors are the data-tour hooks added on each
  //   shop sub-page by other agents.
  // ═══════════════════════════════════════════════════════════════════════════

  // Shop dashboard (app/(a)/a/shop/page.tsx)
  "shop-dashboard": [
    SIDEBAR_STEP,
    {
      id: "ordersCard",
      element: '[data-tour="shop-dashboard-orders-card"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "vendorsCard",
      element: '[data-tour="shop-dashboard-vendors-card"]',
      side: "bottom",
      align: "center",
    },
    {
      id: "approvalsCard",
      element: '[data-tour="shop-dashboard-approvals-card"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "ordersFilter",
      element: '[data-tour="shop-dashboard-orders-filter"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "ordersTable",
      element: '[data-tour="shop-dashboard-orders-table"]',
      side: "top",
      align: "center",
    },
    {
      id: "stockStatus",
      element: '[data-tour="shop-dashboard-stock-status"]',
      side: "top",
      align: "center",
    },
  ],

  // Shop coupons metrics (app/(a)/a/shop/coupons/page.tsx)
  "shop-coupons": [
    SIDEBAR_STEP,
    {
      id: "statsCards",
      element: '[data-tour="shop-coupons-stats-cards"]',
      side: "bottom",
      align: "center",
    },
    {
      id: "tabs",
      element: '[data-tour="shop-coupons-tabs"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "performanceTable",
      element: '[data-tour="shop-coupons-performance-table"]',
      side: "top",
      align: "center",
    },
    {
      id: "pagination",
      element: '[data-tour="shop-coupons-pagination"]',
      side: "top",
      align: "center",
    },
    {
      id: "couponLink",
      element: '[data-tour="shop-coupons-coupon-link"]',
      side: "top",
      align: "center",
    },
  ],

  // Shop inventory (app/(a)/a/shop/inventory/page.tsx)
  "shop-inventory": [
    SIDEBAR_STEP,
    {
      id: "addProduct",
      element: '[data-tour="shop-inventory-add-product"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "manageCategories",
      element: '[data-tour="shop-inventory-manage-categories"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "couponLink",
      element: '[data-tour="shop-inventory-coupon-link"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "statusFilter",
      element: '[data-tour="shop-inventory-status-filter"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "productsTable",
      element: '[data-tour="shop-inventory-products-table"]',
      side: "top",
      align: "center",
    },
    {
      id: "couponsSection",
      element: '[data-tour="shop-inventory-coupons-section"]',
      side: "top",
      align: "center",
    },
  ],

  // Shop orders (app/(a)/a/shop/orders/page.tsx)
  "shop-orders": [
    SIDEBAR_STEP,
    {
      id: "search",
      element: '[data-tour="shop-orders-search"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "statusTabs",
      element: '[data-tour="shop-orders-status-tabs"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "table",
      element: '[data-tour="shop-orders-table"]',
      side: "top",
      align: "center",
    },
    {
      id: "pagination",
      element: '[data-tour="shop-orders-pagination"]',
      side: "top",
      align: "center",
    },
    {
      id: "viewDetails",
      element: '[data-tour="shop-orders-view-details"]',
      side: "top",
      align: "center",
    },
  ],

  // Shop vendors (app/(a)/a/shop/vendors/page.tsx)
  "shop-vendors": [
    SIDEBAR_STEP,
    {
      id: "add",
      element: '[data-tour="shop-vendors-add"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "assignProduct",
      element: '[data-tour="shop-vendors-assign-product"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "table",
      element: '[data-tour="shop-vendors-table"]',
      side: "top",
      align: "center",
    },
    {
      id: "statusToggle",
      element: '[data-tour="shop-vendors-status-toggle"]',
      side: "top",
      align: "center",
    },
    {
      id: "contactInfo",
      element: '[data-tour="shop-vendors-contact-info"]',
      side: "top",
      align: "center",
    },
  ],

  // Shop product approvals (app/(a)/a/shop/approvals/page.tsx)
  "shop-approvals": [
    SIDEBAR_STEP,
    {
      id: "queueTable",
      element: '[data-tour="shop-approvals-queue-table"]',
      side: "top",
      align: "center",
    },
    {
      id: "approveButton",
      element: '[data-tour="shop-approvals-approve-button"]',
      side: "top",
      align: "center",
    },
    {
      id: "rejectButton",
      element: '[data-tour="shop-approvals-reject-button"]',
      side: "top",
      align: "center",
    },
    {
      id: "rejectReason",
      element: '[data-tour="shop-approvals-reject-reason"]',
      side: "top",
      align: "center",
    },
    {
      id: "emptyState",
      element: '[data-tour="shop-approvals-empty-state"]',
      side: "top",
      align: "center",
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENTS & LEADERBOARDS SUB-PAGES (under /a/events/* and /a/leaderboards/*)
  //   The parent "events" tour walks the combined main page (both tabs). These
  //   tours cover the deeper event-detail, wizard, payments, OCR, sponsor and
  //   leaderboard create/view/edit pages. Anchors are the data-tour hooks added
  //   on each page by other agents.
  // ═══════════════════════════════════════════════════════════════════════════

  // Events & Leaderboards main page (app/(a)/a/events/page.tsx) - keyed to the
  // exact /a/events route, using the area-map anchors.
  "events-lb-main": [
    SIDEBAR_STEP,
    {
      id: "tabs",
      element: '[data-tour="events-tabs"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "create",
      element: '[data-tour="events-create"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "payments",
      element: '[data-tour="events-payments"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "search",
      element: '[data-tour="events-search"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "list",
      element: '[data-tour="events-list"]',
      side: "top",
      align: "center",
    },
    {
      id: "lbStats",
      element: '[data-tour="leaderboards-stats"]',
      side: "bottom",
      align: "center",
    },
  ],

  // Event creation wizard (app/(a)/a/events/create/page.tsx)
  "events-lb-create": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="event-create-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "nextButton",
      element: '[data-tour="event-create-next-button"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "save",
      element: '[data-tour="event-create-save"]',
      side: "bottom",
      align: "end",
    },
  ],

  // Event payments escrow (app/(a)/a/events/payments/page.tsx)
  "events-lb-payments": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="payments-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "filter",
      element: '[data-tour="payments-filter"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "summary",
      element: '[data-tour="payments-summary"]',
      side: "bottom",
      align: "center",
    },
    {
      id: "table",
      element: '[data-tour="payments-table"]',
      side: "top",
      align: "center",
    },
  ],

  // Event detail hub (app/(a)/a/events/[slug]/page.tsx)
  "events-lb-detail": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="event-detail-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "overview",
      element: '[data-tour="event-detail-overview"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "details",
      element: '[data-tour="event-detail-details"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "registrations",
      element: '[data-tour="event-detail-registrations"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "stages",
      element: '[data-tour="event-detail-stages"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "groupRosters",
      element: '[data-tour="event-detail-group-rosters"]',
      side: "bottom",
      align: "start",
    },
  ],

  // Event edit wizard (app/(a)/a/events/[slug]/edit/page.tsx)
  "events-lb-edit": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="event-edit-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "basic",
      element: '[data-tour="event-edit-basic"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "stages",
      element: '[data-tour="event-edit-stages"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "prizes",
      element: '[data-tour="event-edit-prizes"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "actions",
      element: '[data-tour="event-edit-actions"]',
      side: "bottom",
      align: "start",
    },
  ],

  // OCR screenshot extraction (app/(a)/a/events/[slug]/ocr/page.tsx)
  "events-lb-ocr": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="ocr-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "upload",
      element: '[data-tour="ocr-upload"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "review",
      element: '[data-tour="ocr-review"]',
      side: "top",
      align: "center",
    },
    {
      id: "commit",
      element: '[data-tour="ocr-commit"]',
      side: "top",
      align: "center",
    },
  ],

  // Event sponsor management (app/(a)/a/events/[slug]/sponsors/page.tsx)
  "events-lb-sponsors": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="sponsors-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "filter",
      element: '[data-tour="sponsors-filter"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "table",
      element: '[data-tour="sponsors-table"]',
      side: "top",
      align: "center",
    },
    {
      id: "verify",
      element: '[data-tour="sponsors-verify"]',
      side: "top",
      align: "center",
    },
  ],

  // Leaderboard creation wizard (app/(a)/a/leaderboards/create/page.tsx)
  "events-lb-leaderboards-create": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="leaderboard-create-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "basic",
      element: '[data-tour="leaderboard-create-basic"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "scoring",
      element: '[data-tour="leaderboard-create-scoring"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "matches",
      element: '[data-tour="leaderboard-create-matches"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "review",
      element: '[data-tour="leaderboard-create-review"]',
      side: "top",
      align: "center",
    },
  ],

  // Leaderboard standings view (app/(a)/a/leaderboards/[id]/page.tsx)
  "events-lb-leaderboards-view": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="leaderboard-view-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "stageGroup",
      element: '[data-tour="leaderboard-view-stage-group"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "table",
      element: '[data-tour="leaderboard-view-table"]',
      side: "top",
      align: "center",
    },
    {
      id: "matchPicker",
      element: '[data-tour="leaderboard-view-match-picker"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "download",
      element: '[data-tour="leaderboard-view-download"]',
      side: "bottom",
      align: "end",
    },
  ],

  // Leaderboard edit (app/(a)/a/leaderboards/[id]/edit/page.tsx)
  "events-lb-leaderboards-edit": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="leaderboard-edit-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "stageGroup",
      element: '[data-tour="leaderboard-edit-stage-group"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "matchList",
      element: '[data-tour="leaderboard-edit-match-list"]',
      side: "top",
      align: "center",
    },
    {
      id: "match",
      element: '[data-tour="leaderboard-edit-match"]',
      side: "top",
      align: "center",
    },
    {
      id: "save",
      element: '[data-tour="leaderboard-edit-save"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "mvpTab",
      element: '[data-tour="leaderboard-mvp-tab"]',
      side: "top",
      align: "center",
    },
    {
      id: "tieBreakers",
      element: '[data-tour="leaderboard-tie-breakers"]',
      side: "top",
      align: "center",
    },
    {
      id: "debuggerBackfill",
      element: '[data-tour="leaderboard-debugger-backfill"]',
      side: "top",
      align: "center",
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // LIVE OVERLAYS (owner 2026-07-02): the broadcast overlay hub. The list page picks
  // an event; the per-event STUDIO manages its saved overlays (stable links), the
  // timer scene, the broadcast control and the capture key.
  // ═══════════════════════════════════════════════════════════════════════════
  "live-overlays-list": [
    SIDEBAR_STEP,
    {
      id: "capture",
      element: '[data-tour="overlays-capture"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "events",
      element: '[data-tour="overlays-events"]',
      side: "top",
      align: "center",
    },
  ],
  "live-overlays-studio": [
    {
      id: "newOverlay",
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

  // ═══════════════════════════════════════════════════════════════════════════
  // ORGANIZATIONS / SPONSORS / PARTNERS / NEWS (orgs-misc area)
  //   The remaining admin management surfaces: organizations and their design
  //   requests + integrity reports, sponsor accounts, data-API partners, and the
  //   news editor. Anchors are the data-tour hooks added on each page by others.
  // ═══════════════════════════════════════════════════════════════════════════

  // Organizations list (app/(a)/a/organizations/page.tsx)
  "orgs-misc-organizations-list": [
    SIDEBAR_STEP,
    {
      id: "create",
      element: '[data-tour="orgs-misc-create-org-button"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "search",
      element: '[data-tour="orgs-misc-org-search"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "subnav",
      element: '[data-tour="org-subnav"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "table",
      element: '[data-tour="orgs-misc-org-table"]',
      side: "top",
      align: "center",
    },
    {
      id: "pagination",
      element: '[data-tour="orgs-misc-org-pagination"]',
      side: "top",
      align: "center",
    },
  ],

  // (The "Design Requests" queue tour was removed 2026-06-13 with the request-a-design feature.)

  // Organization integrity reports (app/(a)/a/organizations/reports/page.tsx)
  "orgs-misc-org-reports": [
    SIDEBAR_STEP,
    {
      id: "title",
      element: '[data-tour="orgs-misc-org-reports-title"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "subnav",
      element: '[data-tour="org-subnav"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "statusFilter",
      element: '[data-tour="orgs-misc-org-reports-status-filter"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "table",
      element: '[data-tour="orgs-misc-org-reports-table"]',
      side: "top",
      align: "center",
    },
    {
      id: "resolve",
      element: '[data-tour="orgs-misc-org-reports-resolve"]',
      side: "top",
      align: "center",
    },
  ],

  // Organization detail (app/(a)/a/organizations/[slug]/page.tsx)
  "orgs-misc-org-detail": [
    SIDEBAR_STEP,
    {
      id: "profileTab",
      element: '[data-tour="orgs-misc-org-detail-profile-tab"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "membersTab",
      element: '[data-tour="orgs-misc-org-detail-members-tab"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "eventsTab",
      element: '[data-tour="orgs-misc-org-detail-events-tab"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "saveProfile",
      element: '[data-tour="orgs-misc-org-detail-save-profile"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "suspend",
      element: '[data-tour="orgs-misc-org-detail-suspend"]',
      side: "bottom",
      align: "end",
    },
  ],

  // Sponsor accounts list (app/(a)/a/sponsors/page.tsx)
  "orgs-misc-sponsors-list": [
    SIDEBAR_STEP,
    {
      id: "create",
      element: '[data-tour="orgs-misc-sponsors-create"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "search",
      element: '[data-tour="orgs-misc-sponsors-search"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "table",
      element: '[data-tour="orgs-misc-sponsors-table"]',
      side: "top",
      align: "center",
    },
    {
      id: "pagination",
      element: '[data-tour="orgs-misc-sponsors-pagination"]',
      side: "top",
      align: "center",
    },
  ],

  // Sponsor creation wizard (app/(a)/a/sponsors/create/page.tsx)
  "orgs-misc-sponsors-create": [
    SIDEBAR_STEP,
    {
      id: "stepIndicator",
      element: '[data-tour="orgs-misc-sponsors-create-step-indicator"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "accountForm",
      element: '[data-tour="orgs-misc-sponsors-create-account-form"]',
      side: "top",
      align: "center",
    },
    {
      id: "passwordStrength",
      element: '[data-tour="orgs-misc-sponsors-create-password-strength"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "events",
      element: '[data-tour="orgs-misc-sponsors-create-events"]',
      side: "top",
      align: "center",
    },
    {
      id: "success",
      element: '[data-tour="orgs-misc-sponsors-create-success"]',
      side: "over",
      align: "center",
    },
  ],

  // Sponsor edit (app/(a)/a/sponsors/[id]/edit/page.tsx)
  "orgs-misc-sponsors-edit": [
    SIDEBAR_STEP,
    {
      id: "details",
      element: '[data-tour="orgs-misc-sponsors-edit-details"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "password",
      element: '[data-tour="orgs-misc-sponsors-edit-password"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "events",
      element: '[data-tour="orgs-misc-sponsors-edit-events"]',
      side: "top",
      align: "center",
    },
    {
      id: "save",
      element: '[data-tour="orgs-misc-sponsors-edit-save"]',
      side: "bottom",
      align: "end",
    },
  ],

  // API key partners list (app/(a)/a/partners/page.tsx)
  "orgs-misc-partners-list": [
    SIDEBAR_STEP,
    {
      id: "create",
      element: '[data-tour="orgs-misc-partners-create"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "search",
      element: '[data-tour="orgs-misc-partners-search"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "table",
      element: '[data-tour="orgs-misc-partners-table"]',
      side: "top",
      align: "center",
    },
    {
      id: "activeKeys",
      element: '[data-tour="orgs-misc-partners-active-keys"]',
      side: "top",
      align: "center",
    },
    {
      id: "pagination",
      element: '[data-tour="orgs-misc-partners-pagination"]',
      side: "top",
      align: "center",
    },
  ],

  // API key partner detail (app/(a)/a/partners/[slug]/page.tsx)
  "orgs-misc-partners-detail": [
    SIDEBAR_STEP,
    {
      id: "profileTab",
      element: '[data-tour="orgs-misc-partners-profile-tab"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "scopeTab",
      element: '[data-tour="orgs-misc-partners-scope-tab"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "keysTab",
      element: '[data-tour="orgs-misc-partners-keys-tab"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "nativeAfc",
      element: '[data-tour="orgs-misc-partners-native-afc"]',
      side: "top",
      align: "center",
    },
    {
      id: "allowedEvents",
      element: '[data-tour="orgs-misc-partners-allowed-events"]',
      side: "top",
      align: "center",
    },
    {
      id: "issueKey",
      element: '[data-tour="orgs-misc-partners-issue-key"]',
      side: "top",
      align: "center",
    },
  ],

  // News list / editor (app/(a)/a/news/page.tsx)
  "orgs-misc-news-list": [
    SIDEBAR_STEP,
    {
      id: "create",
      element: '[data-tour="orgs-misc-news-create"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "search",
      element: '[data-tour="orgs-misc-news-search"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "dateFilter",
      element: '[data-tour="orgs-misc-news-date-filter"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "categoryFilter",
      element: '[data-tour="orgs-misc-news-category-filter"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "statusFilter",
      element: '[data-tour="orgs-misc-news-status-filter"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "clearFilters",
      element: '[data-tour="orgs-misc-news-clear-filters"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "cards",
      element: '[data-tour="orgs-misc-news-cards"]',
      side: "top",
      align: "center",
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS / OCR MODEL / DRAFTS / VOTES (settings-misc area)
  //   The remaining standalone admin pages: settings (admin users and roles), the
  //   self-hosted OCR model dashboard, the drafted-events list, and voting
  //   analytics. Anchors are the data-tour hooks added on each page by others.
  //   These pages share the structural sidebar anchor as the first step too.
  // ═══════════════════════════════════════════════════════════════════════════

  // Admin settings (app/(a)/a/settings/page.tsx)
  "settings-misc-admins": [
    SIDEBAR_STEP,
    {
      id: "tabsHeader",
      element: '[data-tour="settings-misc-tabs-header"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "exportExcel",
      element: '[data-tour="settings-misc-export-excel"]',
      side: "bottom",
      align: "end",
    },
    {
      id: "adminSearch",
      element: '[data-tour="settings-misc-admin-search"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "adminEdit",
      element: '[data-tour="settings-misc-admin-edit"]',
      side: "top",
      align: "center",
    },
    {
      id: "adminSuspend",
      element: '[data-tour="settings-misc-admin-suspend"]',
      side: "top",
      align: "center",
    },
  ],

  // OCR model dashboard (app/(a)/a/ocr-model/page.tsx)
  "settings-misc-ocr-model": [
    SIDEBAR_STEP,
    {
      id: "headline",
      element: '[data-tour="settings-misc-ocr-headline"]',
      side: "bottom",
      align: "center",
    },
    {
      id: "tabs",
      element: '[data-tour="settings-misc-ocr-tabs"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "download",
      element: '[data-tour="settings-misc-ocr-download"]',
      side: "top",
      align: "center",
    },
    {
      id: "promote",
      element: '[data-tour="settings-misc-ocr-promote"]',
      side: "top",
      align: "center",
    },
    {
      id: "rollback",
      element: '[data-tour="settings-misc-ocr-rollback"]',
      side: "top",
      align: "center",
    },
  ],

  // Drafted events (app/(a)/a/drafts/page.tsx)
  "settings-misc-drafts": [
    SIDEBAR_STEP,
    {
      id: "metrics",
      element: '[data-tour="settings-misc-drafts-metrics"]',
      side: "bottom",
      align: "center",
    },
    {
      id: "search",
      element: '[data-tour="settings-misc-drafts-search"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "tabs",
      element: '[data-tour="settings-misc-drafts-tabs"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "continue",
      element: '[data-tour="settings-misc-drafts-continue"]',
      side: "top",
      align: "center",
    },
    {
      id: "delete",
      element: '[data-tour="settings-misc-drafts-delete"]',
      side: "top",
      align: "center",
    },
  ],

  // Voting analytics (app/(a)/a/votes/page.tsx)
  "settings-misc-votes": [
    SIDEBAR_STEP,
    {
      id: "metrics",
      element: '[data-tour="settings-misc-votes-metrics"]',
      side: "bottom",
      align: "center",
    },
    {
      id: "tabs",
      element: '[data-tour="settings-misc-votes-tabs"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "sections",
      element: '[data-tour="settings-misc-votes-sections"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "categories",
      element: '[data-tour="settings-misc-votes-categories"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "winners",
      element: '[data-tour="settings-misc-votes-winners"]',
      side: "bottom",
      align: "start",
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // HELP CENTER (app/(a)/a/help/page.tsx -> components/help-center/HelpCenter.tsx)
  //   The deeper reference behind every other tour in this file. This tour is
  //   short on purpose: the page explains itself, so all it has to teach is how
  //   the two views differ and that search covers both.
  // ═══════════════════════════════════════════════════════════════════════════
  "help-center": [
    SIDEBAR_STEP,
    {
      id: "header",
      element: '[data-tour="help-center-header"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "search",
      element: '[data-tour="help-center-search"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "areas",
      element: '[data-tour="help-center-areas"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "views",
      element: '[data-tour="help-center-views"]',
      side: "bottom",
      align: "start",
    },
    {
      id: "guides",
      element: '[data-tour="help-center-guides"]',
      side: "top",
      align: "center",
    },
  ],
};

// ── Route → pageKey map ──────────────────────────────────────────────────────
// The header launcher (components/site-header.tsx) calls resolveAdminTourPageKey()
// with the current pathname to decide which tour to offer. Keep this in sync with
// the keys above. A page with no tour returns null and the launcher hides itself.
export function resolveAdminTourPageKey(
  pathname: string,
): AdminTourPageKey | null {
  // Normalise a trailing slash so "/a/rankings/" and "/a/rankings" resolve the same.
  // We keep the original for the rare exact "/a" guard, but every match below uses
  // the trimmed form so a stray slash never changes the result.
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  // ── ORDERING CONTRACT ──────────────────────────────────────────────────────
  // Match the most specific routes FIRST. For every area we list the deep
  // sub-pages (longer paths, dynamic-segment children) BEFORE their parent root,
  // so e.g. /a/rankings/scoring-config resolves to its own tour and never falls
  // through to the /a/rankings overview. Exact pages use ===; section roots that
  // own deeper children use startsWith only AFTER those children are handled.

  // Dashboard (single page, exact).
  if (path === "/a/dashboard") return "dashboard";

  // ── Rankings: every sub-page is an exact route; the bare root is the overview.
  //    These exact checks sit before the catch-all /a/rankings prefix below.
  if (path === "/a/rankings/scoring-config") return "rankings-scoring-config";
  if (path === "/a/rankings/tournament-tiers")
    return "rankings-tournament-tiers";
  if (path === "/a/rankings/results") return "rankings-result-markers";
  if (path === "/a/rankings/seasons") return "rankings-seasons";
  if (path === "/a/rankings/ghost-teams") return "rankings-ghost-teams";
  if (path === "/a/rankings/social") return "rankings-social";
  if (path === "/a/rankings/prize") return "rankings-prize";
  if (path === "/a/rankings/overrides") return "rankings-overrides";
  if (path === "/a/rankings/audit") return "rankings-audit";
  if (path === "/a/rankings") return "rankings-overview";
  // Any other (unknown) /a/rankings/* route still gets the parent overview tour.
  if (path.startsWith("/a/rankings")) return "rankings";

  // ── Shop: dashboard root plus exact management sub-pages.
  if (path === "/a/shop/coupons") return "shop-coupons";
  if (path === "/a/shop/inventory") return "shop-inventory";
  if (path === "/a/shop/orders") return "shop-orders";
  if (path === "/a/shop/vendors") return "shop-vendors";
  if (path === "/a/shop/approvals") return "shop-approvals";
  if (path === "/a/shop") return "shop-dashboard";
  // Unknown /a/shop/* sub-routes fall back to the shop dashboard tour.
  if (path.startsWith("/a/shop")) return "shop-dashboard";

  // ── Events: deepest dynamic-segment children first, then the static helpers,
  //    then the dynamic detail, then the bare root. /a/events/create and
  //    /a/events/payments are static and must be tested BEFORE the [slug] detail
  //    (which would otherwise swallow them as a slug).
  if (/^\/a\/events\/[^/]+\/edit$/.test(path)) return "events-lb-edit";
  if (/^\/a\/events\/[^/]+\/ocr$/.test(path)) return "events-lb-ocr";
  if (/^\/a\/events\/[^/]+\/sponsors$/.test(path)) return "events-lb-sponsors";
  if (path === "/a/events/create") return "events-lb-create";
  if (path === "/a/events/payments") return "events-lb-payments";
  if (/^\/a\/events\/[^/]+$/.test(path)) return "events-lb-detail";
  if (path === "/a/events") return "events-lb-main";
  // Unknown /a/events/* route → the combined events+leaderboards parent tour.
  if (path.startsWith("/a/events")) return "events";

  // ── Leaderboards (sibling of events, same area): edit child before the [id]
  //    detail, create before [id], then the dynamic view.
  if (/^\/a\/leaderboards\/[^/]+\/edit$/.test(path))
    return "events-lb-leaderboards-edit";
  if (path === "/a/leaderboards/create")
    return "events-lb-leaderboards-create";
  if (/^\/a\/leaderboards\/[^/]+$/.test(path))
    return "events-lb-leaderboards-view";

  // ── Live Overlays: the per-event studio before the bare hub root.
  if (/^\/a\/overlays\/[^/]+$/.test(path)) return "live-overlays-studio";
  if (path === "/a/overlays") return "live-overlays-list";

  // ── Teams (combined teams+players page; sub-routes reuse the parent tour).
  if (path.startsWith("/a/teams")) return "teams";

  // ── Organizations: reports before the [slug] detail and the bare list root
  //    (the detail prefix /a/organizations/<slug> must come last).
  if (path === "/a/organizations/reports") return "orgs-misc-org-reports";
  if (path === "/a/organizations") return "orgs-misc-organizations-list";
  if (path.startsWith("/a/organizations/")) return "orgs-misc-org-detail";
  if (path.startsWith("/a/organizations"))
    return "orgs-misc-organizations-list";

  // ── Sponsors: create + [id]/edit before the bare list root.
  if (path === "/a/sponsors/create") return "orgs-misc-sponsors-create";
  if (/^\/a\/sponsors\/[^/]+\/edit$/.test(path))
    return "orgs-misc-sponsors-edit";
  if (path === "/a/sponsors") return "orgs-misc-sponsors-list";
  if (path.startsWith("/a/sponsors")) return "orgs-misc-sponsors-list";

  // ── Partners: [slug] detail before the bare list root.
  if (path === "/a/partners") return "orgs-misc-partners-list";
  if (path.startsWith("/a/partners/")) return "orgs-misc-partners-detail";
  if (path.startsWith("/a/partners")) return "orgs-misc-partners-list";

  // ── News (single list/editor page; deeper article routes reuse it).
  if (path.startsWith("/a/news")) return "orgs-misc-news-list";

  // ── Settings / OCR model / drafts / votes: each an exact standalone page.
  if (path === "/a/settings") return "settings-misc-admins";
  if (path === "/a/ocr-model") return "settings-misc-ocr-model";
  if (path === "/a/drafts") return "settings-misc-drafts";
  if (path === "/a/votes") return "settings-misc-votes";

  // ── Player Markets (combined market page; sub-routes reuse the parent tour).
  if (path.startsWith("/a/player-markets")) return "player-markets";

  // ── Help Center (the written reference behind all of the above).
  if (path.startsWith("/a/help")) return "help-center";

  return null;
}
