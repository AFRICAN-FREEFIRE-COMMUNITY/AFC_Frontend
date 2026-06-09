// ─────────────────────────────────────────────────────────────────────────────
// admin-tour-steps.ts  —  step definitions for the guided Admin Tour
// ----------------------------------------------------------------------------
// PURPOSE
//   Central, page-keyed catalogue of the interactive walkthrough steps used by
//   the Admin Tour (the "Take a tour" guide the owner asked for). This is the
//   separate GUIDED TOUR, distinct from the per-element ⓘ InfoTip tooltips that
//   already live on each admin page (components/ui/info-tip.tsx + lib/help-content.ts).
//
// HOW IT CONNECTS
//   - CONSUMED BY: app/(a)/a/_components/AdminTour.tsx — the <AdminTour pageKey=…/>
//     component / useAdminTour() hook reads ADMIN_TOUR_STEPS[pageKey] and feeds the
//     steps straight into driver.js (the lightweight tour library, see AdminTour.tsx).
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
//   - NO em dashes or en dashes in any user-facing string below. Use commas,
//     periods, parentheses, or a spaced hyphen. (Code comments may use box-drawing
//     dashes — those never render to the user.)
//   - Tone mirrors lib/help-content.ts: one or two short, plain sentences that say
//     what the control does and why an admin would use it.
//
// ADDING A NEW PAGE LATER (documented pattern — see AdminTour.tsx header too)
//   1. Add stable `data-tour="my-key"` attributes on the controls you want to
//      highlight on that page (primary action button, main table, tabs, etc.).
//   2. Add a new entry to ADMIN_TOUR_STEPS keyed by a short pageKey, listing the
//      steps in order. Reuse SIDEBAR_STEP as the first step so every tour starts
//      by pointing at the navigation.
//   3. Map the route to that pageKey in resolveAdminTourPageKey.
//   That is all — the launcher, auto-show, and localStorage persistence are generic
//   and need no further wiring.
// ─────────────────────────────────────────────────────────────────────────────

// A single highlighted step. `element` is a CSS selector resolved at runtime; if
// it matches nothing, AdminTour silently drops the step (so a tour never throws on
// a page whose layout changed). `side`/`align` position the popover around the
// target (driver.js terms): side = which edge of the element the popover sits on.
//
// Two optional fields drive the both-tab coverage (see header):
//   - activateInactiveTab: a tab-list selector (e.g. '[data-tour="teams-tabs"]').
//     When the user advances PAST this step, AdminTour clicks the inactive Radix
//     tab trigger inside that list so the other tab's content mounts.
//   - lazy: when true, the step is NOT dropped at build time even if its target is
//     not yet in the DOM (it lives in a tab that has not been activated yet). The
//     selector is resolved lazily by driver.js at highlight time.
export type AdminTourStep = {
  element: string;
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left" | "over";
  align?: "start" | "center" | "end";
  activateInactiveTab?: string;
  lazy?: boolean;
};

// Known page keys. Keep these short and stable — they are used as the localStorage
// suffix (afc_admin_tour_<pageKey>_done), so renaming one re-shows that tour.
export type AdminTourPageKey =
  | "dashboard"
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
  | "orgs-misc-design-requests"
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
  | "settings-misc-votes";

// ── Shared first step: the sidebar navigation ────────────────────────────────
// Every page's tour opens by pointing at the admin sidebar so a new admin learns
// where the sections live before we dive into the page itself. The selector targets
// the sidebar's nav menu (rendered by components/nav-main.tsx inside the Sidebar);
// `[data-slot="sidebar-menu"]` is the stable shadcn slot the SidebarMenu emits.
// On mobile the sidebar is offcanvas (hidden) — if the menu is not on screen the
// step is dropped automatically, and the tour starts at the page header instead.
const SIDEBAR_STEP: AdminTourStep = {
  element: '[data-slot="sidebar-menu"]',
  title: "Your admin navigation",
  description:
    "This sidebar is how you move around the admin area: dashboard, events, teams, rankings, news, shop and more. The section you are on is highlighted in green.",
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
      element: '[data-tour="dashboard-title"]',
      title: "Welcome to the admin dashboard",
      description:
        "This is your control center. The cards below give you a live read on members, teams, tournaments, scrims, news and revenue at a glance.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="dashboard-metrics"]',
      title: "Live community metrics",
      description:
        "Each card shows a key number plus a shortcut to manage that area. Total Members tracks signups, Total Teams links straight to Teams and Players, and the revenue card reflects shop and event income.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="dashboard-quick-actions"]',
      title: "Quick actions",
      description:
        "Jump straight into the most common tasks (create news, create an event) without hunting through the menu. These mirror the primary buttons on each section page.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="dashboard-recent-activity"]',
      title: "Recent admin activity",
      description:
        "A running log of what other admins have done lately, so the team stays in sync and you can spot who changed what. Use View All Activities for the full history.",
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
      element: '[data-tour="events-tabs"]',
      title: "Events and Leaderboards",
      description:
        "This one page holds two tabs. Events is where you run tournaments and scrims; Leaderboards is where you publish standings. We will walk the Events tab first, then switch you to Leaderboards. The cards below the header read out your whole calendar: total events split into tournaments and scrims, how many are upcoming, ongoing or completed, the average participants per event, and your most popular format.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="events-create"]',
      title: "Create a new event",
      description:
        "Start a tournament or scrim here. The wizard walks you through details, stages, prizes and rules, then publishes it. After creating it, you manage it from the list below.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="events-payments"]',
      title: "Event payments",
      description:
        "For paid events, this opens the escrow dashboard where you release or refund registration fees that Stripe is holding. Only paid events appear there.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="events-search"]',
      title: "Find an event fast",
      description:
        "Filter the list below by event name, type (tournament or scrim) or status. Handy once you have a lot of events on record.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="events-list"]',
      title: "Your events and scrims",
      description:
        "Every event lives here. Per row: View opens the full event detail (which has its own tabs including Overview, Registrations, Stages and Group Rosters), Edit reopens the wizard, and the trash icon deletes it. A small lock icon marks a private event.",
      side: "top",
      align: "center",
    },
    {
      // Switching step: still highlights the (visible) tab list. On Next, AdminTour
      // clicks the inactive "Leaderboards" trigger so its content mounts, then advances.
      element: '[data-tour="events-tabs"]',
      title: "Now the Leaderboards tab",
      description:
        "That covers Events. Click Next and we will switch you to the Leaderboards tab, where you turn raw match results into published standings.",
      side: "bottom",
      align: "start",
      activateInactiveTab: '[data-tour="events-tabs"]',
    },
    {
      element: '[data-tour="leaderboards-stats"]',
      title: "Leaderboard totals",
      description:
        "These cards count your leaderboards overall and split them into tournament versus scrim leaderboards, so you can see what has been scored and what is still outstanding.",
      side: "bottom",
      align: "center",
      lazy: true,
    },
    {
      element: '[data-tour="leaderboards-search"]',
      title: "Pick an event to score",
      description:
        "Search your events here, then use the table below it. Each row is an event you can attach or update a leaderboard for.",
      side: "bottom",
      align: "start",
      lazy: true,
    },
    {
      element: '[data-tour="leaderboards-table"]',
      title: "View or edit a leaderboard",
      description:
        "For each event, View opens its current standings and Edit lets you enter or correct placements and kill points. This is where the public ranking for that event comes from.",
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
      element: '[data-tour="teams-tabs"]',
      title: "Teams and Players",
      description:
        "This one page combines two tabs. Teams manages registered squads and their tiers; Players manages individual accounts. We will walk Teams first, then switch you to Players.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="teams-rank"]',
      title: "Rank teams into tiers",
      description:
        "Run the tiering pass that sorts teams into Tier 1, 2 and 3 from their performance. Use it after results are in. For the full quarterly tier lock and scoring, use the Rankings section in the sidebar.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="teams-search"]',
      title: "Search and filter teams",
      description:
        "Look up a team by name, or narrow the list to a single tier. The table below updates as you type.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="teams-list"]',
      title: "The team roster",
      description:
        "Every registered team, with its tier, member count, total wins and earnings. The row actions let you View a team or ban and unban it. Below this table you will also find Ghost Teams, the provisional placeholder squads that hold tournament results until a real team claims them.",
      side: "top",
      align: "center",
    },
    {
      // Switching step: highlights the (visible) tab list. On Next, AdminTour clicks
      // the inactive "Players" trigger so its content mounts, then advances.
      element: '[data-tour="teams-tabs"]',
      title: "Now the Players tab",
      description:
        "That covers Teams. Click Next and we will switch you to the Players tab, where you manage individual player accounts.",
      side: "bottom",
      align: "start",
      activateInactiveTab: '[data-tour="teams-tabs"]',
    },
    {
      element: '[data-tour="players-create"]',
      title: "Create a ghost player",
      description:
        "Spin up a provisional player (a parked in-game name) that can be attached to a ghost team and claimed later. Useful for seeding results before a real account exists.",
      side: "bottom",
      align: "end",
      lazy: true,
    },
    {
      element: '[data-tour="players-stats"]',
      title: "Player stats at a glance",
      description:
        "These cards show total, active and banned players, average kills, and your top MVP and top wins players. A quick read on the health of the player base.",
      side: "bottom",
      align: "center",
      lazy: true,
    },
    {
      element: '[data-tour="players-search"]',
      title: "Search and filter players",
      description:
        "Find a player by name, or filter by their team (including No Team) and by status (active or banned). The table below updates as you change these.",
      side: "bottom",
      align: "start",
      lazy: true,
    },
    {
      element: '[data-tour="players-list"]',
      title: "The players table",
      description:
        "Every player with their team, kills, wins, MVPs and status. View opens that player's profile; the Ban or Unban button controls their platform access.",
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
      element: '[data-tour="rankings-header"]',
      title: "The Rankings workspace",
      description:
        "Rankings has its own row of sub-pages along the top: Overview (here), Scoring Config, Tournament Tiers, Result Markers, Seasons, Ghost Teams, Social, Prize, Overrides and Audit. This Overview is the control room; the others are where you set the rules and the raw data.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="rankings-season"]',
      title: "Pick the season",
      description:
        "Everything on this page is scoped to one season. Switch seasons here; the team scores, tier distribution and publish state below all follow the season you pick.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="rankings-status"]',
      title: "Season status at a glance",
      description:
        "These cards show the current season, whether the transfer window is open or locked, whether a recalculation is running, and when the last quarterly evaluation was run and by whom.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="rankings-evaluation"]',
      title: "Run the quarterly evaluation",
      description:
        "This locks every team and player tier for the next quarter from the current scores. Preview it first (a dry run that writes nothing), then commit. You can also queue a recalculation for a single team or player here. Head Admin or Metrics Admin only.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour="rankings-distribution"]',
      title: "Tier distribution",
      description:
        "A live breakdown of how many teams sit in each tier for this season. The badge flags any teams below the activity floor, which can affect their eligibility.",
      side: "left",
      align: "start",
    },
    {
      element: '[data-tour="rankings-publish"]',
      title: "Publish to the public",
      description:
        "The public rankings and tier badges stay hidden until you publish them, and the two surfaces are controlled separately. Publish one without the other, each with a logged reason.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="rankings-quicklinks"]',
      title: "Jump to the detail pages",
      description:
        "These cards open the deeper Rankings tools: Result Markers (winners, finals and MVP flags), Seasons (dates and the transfer window), Ghost Teams (create placeholder squads and handle claims), and the Audit Log (every edit to the raw data). Scoring Config and Tournament Tiers sit in the sub-nav above.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="rankings-teams"]',
      title: "The team score table",
      description:
        "Every team's rank, tier, tournaments played, kills and total score for the season. Search it on the right, and use Edit markers on a row to jump to Result Markers for that team. This is the draft view, so you see the computed scores even before they are published.",
      side: "top",
      align: "center",
    },
  ],

  // Player Markets (app/(a)/a/player-markets/page.tsx)
  "player-markets": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="market-title"]',
      title: "Player Market administration",
      description:
        "Oversight for the transfer market: team listings, player listings, trials and reports all live on this one page.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="market-tabs"]',
      title: "Move between market sections",
      description:
        "Overview shows the headline numbers. The other tabs drill into Team Listings, Player Listings, Trials and Applications, and Reports and Flags. Open a tab to act on the items inside it.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="market-overview"]',
      title: "Market at a glance",
      description:
        "These cards summarise active listings, ongoing trials and pending reports, so you can spot anything that needs attention before opening the detail tabs.",
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

  // Rankings Overview (app/(a)/a/rankings/page.tsx) — the same control room as the
  // parent "rankings" tour, but keyed to the exact /a/rankings route. Uses the
  // fixed data-tour anchors from the area map.
  "rankings-overview": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="rankings-header"]',
      title: "The Rankings workspace",
      description:
        "Rankings has its own row of sub-pages along the top: Overview here, Scoring Config, Tournament Tiers, Result Markers, Seasons, Ghost Teams, Social, Prize, Overrides and Audit. This Overview is the control room where you set the rules and manage the raw data.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="rankings-season"]',
      title: "Pick the season",
      description:
        "Everything on this page is scoped to one season. Switch seasons here. The team scores, tier distribution and publish state below all follow the season you pick.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="rankings-status"]',
      title: "Season status at a glance",
      description:
        "These cards show the current season, whether the transfer window is open or locked, whether a recalculation is running, and when the last quarterly evaluation was run and by whom.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="rankings-evaluation"]',
      title: "Run the quarterly evaluation",
      description:
        "This locks every team and player tier for the next quarter from the current scores. Preview it first as a dry run that writes nothing, then commit. You can also queue a recalculation for a single team or player here. Head Admin or Metrics Admin only.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour="rankings-distribution"]',
      title: "Tier distribution",
      description:
        "A live breakdown of how many teams sit in each tier for this season. The badge flags any teams below the activity floor, which can affect their eligibility.",
      side: "left",
      align: "start",
    },
    {
      element: '[data-tour="rankings-publish"]',
      title: "Publish to the public",
      description:
        "The public rankings and tier badges stay hidden until you publish them. The two surfaces are controlled separately. Publish one without the other, each with a logged reason.",
      side: "top",
      align: "center",
    },
  ],

  // Scoring Configuration (app/(a)/a/rankings/scoring-config/page.tsx)
  "rankings-scoring-config": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="scoring-config-title"]',
      title: "Scoring Configuration page",
      description:
        "The weights, brackets and thresholds that drive every ranking and tier calculation. Changes are versioned and automatically recalculate scores across the season.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="scoring-config-version"]',
      title: "Active config version",
      description:
        "Shows whether the current configuration is the spec defaults or a versioned snapshot. When you save, a new version is drafted.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="scoring-config-unsaved"]',
      title: "Unsaved changes",
      description:
        "Count of fields that differ from the saved version. Orange highlights mark changed fields as you edit them.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="scoring-config-scales"]',
      title: "Scoring brackets",
      description:
        "Edit the compression scales for kills, placement, prize money and social media. Open-ended brackets (the last row in each table) have no upper bound.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="scoring-config-reset"]',
      title: "Reset to spec defaults",
      description:
        "Load the specification defaults from the codebase. Stages them locally in the editor without persisting. Save to draft them as a new version.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="scoring-config-save"]',
      title: "Save changes",
      description:
        "Draft a new immutable config version and queue a full recalculation for every ranked team and player. Unsaved field count shown on the button.",
      side: "bottom",
      align: "end",
    },
  ],

  // Tournament Tiers (app/(a)/a/rankings/tournament-tiers/page.tsx)
  "rankings-tournament-tiers": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="tournament-tiers-title"]',
      title: "Tournament Tiers classification",
      description:
        "Build a prioritised list of rules that classify tournaments into tiers. A tournament is evaluated top-down, the first rule it matches sets its tier.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="tournament-tiers-stats"]',
      title: "Rule count",
      description:
        "Shows how many rules are currently enabled. Disabled rules are kept but do not participate in classification.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="tournament-tiers-rules"]',
      title: "Tier rules",
      description:
        "Drag to reorder rules by priority. The first rule a tournament matches sets its tier (1 = 2.0x multiplier, 2 = 1.5x, 3 = 1.0x).",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="tournament-tiers-add"]',
      title: "Add a new rule",
      description:
        "Create a new classification rule. Set its conditions, tier, and whether it must match all or any of the conditions.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="tournament-tiers-test"]',
      title: "Test a tournament",
      description:
        "Enter a tournament's prize, team count and player count to see which rule it matches and what tier it would be classified into.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="tournament-tiers-save"]',
      title: "Save all changes",
      description:
        "Persist all rule changes. The audit trail logs which rules were created, updated, deleted or reordered.",
      side: "bottom",
      align: "end",
    },
  ],

  // Result Markers (app/(a)/a/rankings/results/page.tsx)
  "rankings-result-markers": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="result-markers-title"]',
      title: "Result Markers control",
      description:
        "Enable or disable whether tournament results count toward rankings. Toggle counting for whole events or exclude specific teams and players.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="result-markers-status"]',
      title: "Results status",
      description:
        "Cards show the total tournaments, how many are fully counting, partially gated or disabled. Quick snapshot of which events feed the rankings.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="result-markers-search"]',
      title: "Find an event",
      description:
        "Filter tournaments by name, tier or status. Helps you quickly locate events that need adjustment.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="result-markers-list"]',
      title: "Tournament list",
      description:
        "Every tournament's counting status. Click to drill into exclusions for specific teams and players in that event.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="result-markers-flags"]',
      title: "Counting flags",
      description:
        "Toggle whether winners, placement points and kills count for an entire tournament. Turn off to stop seeding results before the event is official.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="result-markers-exclusions"]',
      title: "Team and player exclusions",
      description:
        "Exclude a specific team or player from counting in an event (for example due to rule violations). Exclusions are reason-gated and logged.",
      side: "top",
      align: "center",
    },
  ],

  // Seasons (app/(a)/a/rankings/seasons/page.tsx)
  "rankings-seasons": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="seasons-title"]',
      title: "Seasons management",
      description:
        "Define competition seasons, set quarter and year, open and close the transfer window, and run the quarterly tier evaluation.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="seasons-create"]',
      title: "Create a new season",
      description:
        "Start a new quarter. Set the season name, quarter, year, start and end dates. This becomes the active season once created.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="seasons-list"]',
      title: "All seasons table",
      description:
        "Every season, its quarter and year, date range, transfer window status and evaluation history. Click Edit to change dates or reopen the transfer window.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="seasons-transfer"]',
      title: "Transfer window",
      description:
        "Open or close the transfer window (when teams can swap players). The window is independent from the season dates.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="seasons-evaluation"]',
      title: "Tier evaluation",
      description:
        "Each season shows when its quarterly evaluation ran and who ran it. Evaluation locks team and player tiers for the next quarter.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="seasons-log"]',
      title: "Transfer window log",
      description:
        "Audit trail of every time the transfer window was opened, closed or extended. Shows who made the change and their reason.",
      side: "top",
      align: "center",
    },
  ],

  // Ghost Teams (app/(a)/a/rankings/ghost-teams/page.tsx)
  "rankings-ghost-teams": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="ghost-teams-title"]',
      title: "Ghost Teams creation",
      description:
        "Create placeholder squads to hold tournament results before a real team claims them. Seed the provisional roster with in-game names.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="ghost-teams-stats"]',
      title: "Ghost team counts",
      description:
        "Cards show total unclaimed ghosts, those with pending claims, and claimed ghosts. Quick summary of the seeding pipeline.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="ghost-teams-create"]',
      title: "Create a new ghost",
      description:
        "Define a placeholder team with a roster of in-game names. The ghost holds results until a real team claims it.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="ghost-teams-tabs"]',
      title: "Filter by status",
      description:
        "Switch tabs to see all ghosts or just those with pending claims. Helps you spot work that needs approving.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="ghost-teams-list"]',
      title: "Ghost teams table",
      description:
        "All ghosts sorted by claim status. Unclaimed are available to seed results, pending shows claims in flight, claimed are retired.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="ghost-teams-claim"]',
      title: "Approve or revoke claims",
      description:
        "When a team tries to claim a ghost, approve to lock the claim or revoke if it was fraudulent. Both actions are reason-logged.",
      side: "top",
      align: "center",
    },
  ],

  // Social Media verification (app/(a)/a/rankings/social/page.tsx)
  "rankings-social": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="social-title"]',
      title: "Social media verification",
      description:
        "Teams connect their Instagram and TikTok handles from their dashboard. You verify the combined follower count, which awards points per the bracket scale.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="social-search"]',
      title: "Find a team",
      description:
        "Filter the list by team name. Shows connected and unconnected teams, making it easy to spot who still needs to link their handles.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="social-list"]',
      title: "Connected teams",
      description:
        "Every team that has connected handles, their follower counts on each platform, combined total, and verification status.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="social-verify"]',
      title: "Verify follower counts",
      description:
        "Confirm a team's combined followers and lock them in. The bracket scale maps followers to points (capped at 10). Unverify to edit counts again.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="social-correction"]',
      title: "Correct follower counts",
      description:
        "Edit Instagram and TikTok follower numbers if they are out of date. Once saved, verify to lock them in and award points.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="social-brackets"]',
      title: "Points scale preview",
      description:
        "Shows how combined followers map to points per tier. Points are computed live as you edit, then persisted when you verify.",
      side: "top",
      align: "center",
    },
  ],

  // Prize money (app/(a)/a/rankings/prize/page.tsx)
  "rankings-prize": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="prize-title"]',
      title: "Prize money tracking",
      description:
        "Record prize payouts to teams for each tournament. The quarterly total maps to points on a bracket scale that builds tier scores.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="prize-total"]',
      title: "Season total",
      description:
        "Card shows the sum of all prize money recorded for the active season. Helps you verify you have captured all payouts.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="prize-add"]',
      title: "Record a payout",
      description:
        "Create a new prize entry. Pick the tournament, the team, and the NGN amount. A mandatory reason is logged for audit.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="prize-search"]',
      title: "Find a payout",
      description:
        "Filter by event or team name. Helps you locate a specific prize to edit or correct.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="prize-list"]',
      title: "Prize payouts table",
      description:
        "All recorded prizes scoped to the season. Shows event name, team, amount in NGN and when awarded. Edit or delete with reasons.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="prize-scale"]',
      title: "Prize bracket scale",
      description:
        "Shows how quarterly prize money totals map to points. The scale is tied to the scoring configuration's prize brackets.",
      side: "top",
      align: "center",
    },
  ],

  // Overrides (app/(a)/a/rankings/overrides/page.tsx)
  "rankings-overrides": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="overrides-title"]',
      title: "Manual tier and score overrides",
      description:
        "Override a team or player's calculated tier, deduct points as a penalty, or ban-zero them for the season. All actions are reason-logged.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="overrides-search"]',
      title: "Find team or player",
      description:
        "Search by name to locate the entity you want to override. The table updates as you type.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="overrides-list"]',
      title: "Teams and players table",
      description:
        "All ranked entities with their computed score and tier, plus flags for overrides and penalties. Click a row to override tier or deduct points.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="overrides-tier"]',
      title: "Override tier",
      description:
        "Manually set a team's tier. The override persists until you change it. Useful when the computed tier does not match rule enforcement.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="overrides-deduct"]',
      title: "Deduct points",
      description:
        "Subtract a specific number of points as a partial penalty. The team stays ranked but with reduced score. Unlike a ban-zero, the team is not hidden.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="overrides-ban"]',
      title: "Ban or zero out",
      description:
        "Remove a team or player from the rankings entirely for the season. A ban-zero sets their score to 0 and is visible in the audit log.",
      side: "top",
      align: "center",
    },
  ],

  // Audit log (app/(a)/a/rankings/audit/page.tsx)
  "rankings-audit": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="audit-title"]',
      title: "Audit log",
      description:
        "Complete record of every edit to the rankings system. Filters by action type, date range and reason. Includes raw data breakdowns per team and player.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="audit-filters"]',
      title: "Filter by type and date",
      description:
        "Narrow the log by action type (tournament result, prize, override, etc.) and date range. The reason search happens on the visible results.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="audit-search"]',
      title: "Search by reason",
      description:
        "Free-text search through the reason field on the fetched audit entries. Helps you find the change you are looking for.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="audit-list"]',
      title: "Audit entries",
      description:
        "Chronological log of every action. Shows type, reason, who made the change and when. Click to see before and after snapshots.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="audit-details"]',
      title: "Before and after",
      description:
        "When you click an audit entry, see the JSON before and after snapshots. Helps you understand what changed and verify it was intentional.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="audit-raw"]',
      title: "Raw data breakdown",
      description:
        "Pull the raw score breakdown for any team or player. Shows how their final score is composed from tournament, scrim, prize and social components.",
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
      element: '[data-tour="shop-dashboard-orders-card"]',
      title: "Your Orders Card",
      description:
        "Quick access to the order tracker. Links directly to the Orders page to see all shop orders and their statuses.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="shop-dashboard-vendors-card"]',
      title: "Manage Vendors",
      description:
        "Access vendor management. Grant selling access to users, suspend or reactivate vendors, and assign products to them.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="shop-dashboard-approvals-card"]',
      title: "Product Approvals",
      description:
        "Review vendor-submitted products in the approval queue. Approve to publish or reject with feedback for improvement.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="shop-dashboard-orders-filter"]',
      title: "Orders Time Filter",
      description:
        "Toggle between day, week, or month views of recent orders. The table below updates with orders from the selected period.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="shop-dashboard-orders-table"]',
      title: "Recent Orders Table",
      description:
        "Live orders from your store filtered by the selected time range. Shows order ID, customer, status, date and total amount.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="shop-dashboard-stock-status"]',
      title: "Current Stock Status",
      description:
        "Snapshot of virtual diamond inventory across variants. Color-coded badges show stock levels and a link opens full inventory management.",
      side: "top",
      align: "center",
    },
  ],

  // Shop coupons metrics (app/(a)/a/shop/coupons/page.tsx)
  "shop-coupons": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="shop-coupons-stats-cards"]',
      title: "Coupon Metrics Cards",
      description:
        "Summarize coupon performance with total count, active count, total redemptions, total savings and conversion rates across all coupons.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="shop-coupons-tabs"]',
      title: "Metrics Tabs",
      description:
        "Switch between Performance (ranked coupons by usage), Trends (monthly redemption trends), and Recent Activity (latest coupon usage).",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="shop-coupons-performance-table"]',
      title: "Coupons Table",
      description:
        "All coupons ranked by usage count. Shows code, discount type and value, status, usage count and a progress bar showing max usage capacity.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="shop-coupons-pagination"]',
      title: "Pagination Controls",
      description:
        "Navigate through pages of coupons when the list is long. Includes next, previous and direct page selection.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="shop-coupons-coupon-link"]',
      title: "View Coupon Details",
      description:
        "Click any coupon code to view its full details, history, redemption stats and edit settings like discount value or date range.",
      side: "top",
      align: "center",
    },
  ],

  // Shop inventory (app/(a)/a/shop/inventory/page.tsx)
  "shop-inventory": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="shop-inventory-add-product"]',
      title: "Add Product Button",
      description:
        "Create a new product listing. Opens a modal to enter product name, category, variants with prices and stock quantities.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="shop-inventory-manage-categories"]',
      title: "Manage Categories",
      description:
        "Create, edit or delete product categories that organize your shop catalog and appear as tabs for customers browsing.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="shop-inventory-coupon-link"]',
      title: "Coupon Metrics Link",
      description:
        "Jump to the Coupon Metrics page to monitor coupon redemptions, savings and performance trends.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="shop-inventory-status-filter"]',
      title: "Product Status Filter",
      description:
        "Filter products by status: All, Active, or Inactive. The products table updates instantly as you select a filter.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="shop-inventory-products-table"]',
      title: "Products Table",
      description:
        "Lists all products with name, type, category, stock level, price range, status and last update date. Includes row actions to edit or delete.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="shop-inventory-coupons-section"]',
      title: "Coupons Management",
      description:
        "Create new coupons or manage existing ones. Shows active and archived coupons with usage tracking and status controls.",
      side: "top",
      align: "center",
    },
  ],

  // Shop orders (app/(a)/a/shop/orders/page.tsx)
  "shop-orders": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="shop-orders-search"]',
      title: "Order Search",
      description:
        "Find orders quickly by order ID, customer name, product name or user ID. Results update as you type.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="shop-orders-status-tabs"]',
      title: "Status Filter Tabs",
      description:
        "Filter orders by status: All, Pending, or Paid. Tabs show counts for each status so you can spot pending orders that need attention.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="shop-orders-table"]',
      title: "Orders List",
      description:
        "All orders with ID, customer, items purchased, status badge, date and total. Each row has a menu to view full details.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="shop-orders-pagination"]',
      title: "Pagination",
      description:
        "Navigate through pages of orders when the full list is large. Page numbers appear when needed.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="shop-orders-view-details"]',
      title: "View Order Details",
      description:
        "Click View Details on any order to see the full breakdown: items, quantities, prices, discounts and customer shipping information.",
      side: "top",
      align: "center",
    },
  ],

  // Shop vendors (app/(a)/a/shop/vendors/page.tsx)
  "shop-vendors": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="shop-vendors-add"]',
      title: "Add Vendor",
      description:
        "Grant marketplace selling access to an existing user. Enter their email or user ID and set up their vendor profile with display name and contact details.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="shop-vendors-assign-product"]',
      title: "Assign Product to Vendor",
      description:
        "Reassign a product to a different vendor or clear it back to first-party AFC stock. Pick the product and target vendor from dropdowns.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="shop-vendors-table"]',
      title: "Vendors List",
      description:
        "All vendors with display name, contact email, WhatsApp number, status, product count and registration date. Status toggles let you suspend or reactivate instantly.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="shop-vendors-status-toggle"]',
      title: "Vendor Status Toggle",
      description:
        "Suspend an active vendor to revoke their selling access or reactivate a suspended vendor to let them sell again.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="shop-vendors-contact-info"]',
      title: "Vendor Contact Details",
      description:
        "Each vendor row shows their contact email and WhatsApp number for support coordination and fulfillment communication.",
      side: "top",
      align: "center",
    },
  ],

  // Shop product approvals (app/(a)/a/shop/approvals/page.tsx)
  "shop-approvals": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="shop-approvals-queue-table"]',
      title: "Approval Queue",
      description:
        "All vendor-submitted products waiting for review. Shows product name, vendor, price range, variant count and submission date for quick assessment.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="shop-approvals-approve-button"]',
      title: "Approve Product",
      description:
        "Publish a vendor product to the storefront. Once approved, the product status changes and it can be offered for sale.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="shop-approvals-reject-button"]',
      title: "Reject Product",
      description:
        "Send a product back to the vendor with feedback. Opens a dialog to enter a rejection reason the vendor can see and act on.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="shop-approvals-reject-reason"]',
      title: "Rejection Reason Input",
      description:
        "Write clear feedback for the vendor explaining why their product was rejected, for example pricing issues or missing details.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="shop-approvals-empty-state"]',
      title: "Queue Empty State",
      description:
        "When there are no submitted products, the queue shows an empty state. Products appear here when vendors submit new listings.",
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

  // Events & Leaderboards main page (app/(a)/a/events/page.tsx) — keyed to the
  // exact /a/events route, using the area-map anchors.
  "events-lb-main": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="events-tabs"]',
      title: "Events and Leaderboards tabs",
      description:
        "Switch between the Events tab (manage tournaments and scrims) and Leaderboards tab (publish standings). The tour walks both tabs.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="events-create"]',
      title: "Create a new event",
      description:
        "Start a tournament or scrim. The wizard walks you through details, stages, prizes and rules, then publishes it.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="events-payments"]',
      title: "Event payments dashboard",
      description:
        "For paid events, manage the escrow where you release or refund registration fees that Stripe is holding.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="events-search"]',
      title: "Find an event fast",
      description:
        "Filter the list below by event name, type (tournament or scrim) or status. Handy once you have many events on record.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="events-list"]',
      title: "Your events and scrims",
      description:
        "Every event lives here. Per row: View opens the full event detail, Edit reopens the wizard, and the trash icon deletes it.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="leaderboards-stats"]',
      title: "Leaderboard totals",
      description:
        "Cards count your leaderboards overall and split them into tournament versus scrim leaderboards, so you can see what has been scored.",
      side: "bottom",
      align: "center",
    },
  ],

  // Event creation wizard (app/(a)/a/events/create/page.tsx)
  "events-lb-create": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="event-create-title"]',
      title: "Create new event",
      description:
        "Multi-step wizard to build a tournament or scrim from scratch. Follow the steps through details, stages, prizes and rules.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="event-create-next-button"]',
      title: "Step navigation",
      description:
        "Click Next or Previous to move through the event creation wizard.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="event-create-save"]',
      title: "Create event button",
      description:
        "When you reach the final step, click Create Event to save and publish your tournament or scrim.",
      side: "bottom",
      align: "end",
    },
  ],

  // Event payments escrow (app/(a)/a/events/payments/page.tsx)
  "events-lb-payments": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="payments-title"]',
      title: "Event payments escrow",
      description:
        "Registration fees for paid events are held in escrow. Release funds to the organizer or refund the player here.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="payments-filter"]',
      title: "Filter by event",
      description:
        "Select a specific paid event to see its held payments, or view all payments across all paid events.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="payments-summary"]',
      title: "Payment summary cards",
      description:
        "See the count of total payments, how many are held in escrow awaiting action, and how many are displayed with your current filter.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="payments-table"]',
      title: "Payments table",
      description:
        "Per payment row: view the event, payer, team, amount, status and escrow state. Held payments show Release and Refund action buttons.",
      side: "top",
      align: "center",
    },
  ],

  // Event detail hub (app/(a)/a/events/[slug]/page.tsx)
  "events-lb-detail": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="event-detail-title"]',
      title: "Event detail page",
      description:
        "Single event management hub. View or edit all aspects: overview, registrations, stages, teams and prizes.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="event-detail-overview"]',
      title: "Overview tab",
      description:
        "Live snapshot of the event: total registered, countdown to start, prizepool and distribution.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="event-detail-details"]',
      title: "Details tab",
      description:
        "Event meta: name, type, mode, dates, rules, restrictions, sponsors and waitlist config.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="event-detail-registrations"]',
      title: "Registrations tab",
      description:
        "Who has signed up. View the timeline of registrations, filter by status, download the roster and manage invites for private events.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="event-detail-stages"]',
      title: "Stages tab",
      description:
        "Tournament bracket structure. See each stage, its groups, teams, and match count. Seed live events or edit stage and group config here.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="event-detail-group-rosters"]',
      title: "Group Rosters tab",
      description:
        "Live-event seeding check: who is where in which group. Search by player or team name for fast lookup during the event.",
      side: "bottom",
      align: "start",
    },
  ],

  // Event edit wizard (app/(a)/a/events/[slug]/edit/page.tsx)
  "events-lb-edit": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="event-edit-title"]',
      title: "Edit event",
      description:
        "Reopen the event wizard to change any detail, stage, or rule after creation.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="event-edit-basic"]',
      title: "Basic info tab",
      description:
        "Event name, type, mode, dates, registration dates and links, public or private status.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="event-edit-stages"]',
      title: "Stages and groups tab",
      description:
        "Modify stage count, dates, formats, group counts, qualifying teams and prize pools.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="event-edit-prizes"]',
      title: "Prize and rules tab",
      description:
        "Manage prizepool amounts, distribution by placement, and event rules text or upload.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="event-edit-actions"]',
      title: "Actions tab",
      description:
        "Publish to tournaments or news, or save as draft. Control who can register and manage sponsor and waitlist settings.",
      side: "bottom",
      align: "start",
    },
  ],

  // OCR screenshot extraction (app/(a)/a/events/[slug]/ocr/page.tsx)
  "events-lb-ocr": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="ocr-title"]',
      title: "OCR screenshot extraction",
      description:
        "Upload a match result screenshot and auto-extract player names, kills and placements. Review and correct before saving.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="ocr-upload"]',
      title: "Upload screenshot",
      description:
        "Drop or select a match result screenshot image. The OCR engine scans it for player stats.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="ocr-review"]',
      title: "Review extracted data",
      description:
        "OCR output appears as a table. Check each row for accuracy and manually fix any misreads before committing.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="ocr-commit"]',
      title: "Commit OCR data",
      description:
        "Save the reviewed OCR rows to this event. They become part of the match result.",
      side: "top",
      align: "center",
    },
  ],

  // Event sponsor management (app/(a)/a/events/[slug]/sponsors/page.tsx)
  "events-lb-sponsors": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="sponsors-title"]',
      title: "Event sponsor management",
      description:
        "List competitors by whether they met sponsor requirements. Search, filter by status and verify or reject submissions.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="sponsors-filter"]',
      title: "Filter by status",
      description:
        "Show all competitors, only those who passed sponsor verification, or only those who failed.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="sponsors-table"]',
      title: "Competitors table",
      description:
        "Per row: competitor name, their UUID or identifier, submission date and status. Use the actions to verify or reject each one.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="sponsors-verify"]',
      title: "Verify or reject submission",
      description:
        "Per row: click Verify to accept a sponsor requirement, or Reject if it did not meet the criteria.",
      side: "top",
      align: "center",
    },
  ],

  // Leaderboard creation wizard (app/(a)/a/leaderboards/create/page.tsx)
  "events-lb-leaderboards-create": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="leaderboard-create-title"]',
      title: "Create leaderboard",
      description:
        "Multi-step wizard to generate standings for a tournament or scrim. Pick the event, stage and group, then enter or upload results.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="leaderboard-create-basic"]',
      title: "Basic information step",
      description:
        "Select the event, stage and group to score. The form shows the available stages and groups from that event.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="leaderboard-create-scoring"]',
      title: "Point system step",
      description:
        "Set kill points, assist points and damage points. Choose whether the same point values apply to all maps or vary per match.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="leaderboard-create-matches"]',
      title: "Match results step",
      description:
        "Enter match results by hand, upload a screenshot for OCR extraction, or upload a 3D room file. One option per match.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="leaderboard-create-review"]',
      title: "Review and publish step",
      description:
        "See the final leaderboard standings, then publish them to make this group's results live for the public.",
      side: "top",
      align: "center",
    },
  ],

  // Leaderboard standings view (app/(a)/a/leaderboards/[id]/page.tsx)
  "events-lb-leaderboards-view": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="leaderboard-view-title"]',
      title: "Leaderboard standings",
      description:
        "View final standings for a group. See placements, kill counts and total points for every competitor.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="leaderboard-view-stage-group"]',
      title: "Stage and group picker",
      description:
        "Dropdown selectors to view standings for different stages and groups in this event.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="leaderboard-view-table"]',
      title: "Standings table",
      description:
        "Per competitor row: placement, name, kill count, assists, damage and total points.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="leaderboard-view-match-picker"]',
      title: "Match selector",
      description:
        "Choose Overall leaderboard or drill into a single match to see placement and points for that match only.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="leaderboard-view-download"]',
      title: "Download leaderboard",
      description:
        "Export the standings as a CSV or Excel file for sharing with organizers or the public.",
      side: "bottom",
      align: "end",
    },
  ],

  // Leaderboard edit (app/(a)/a/leaderboards/[id]/edit/page.tsx)
  "events-lb-leaderboards-edit": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="leaderboard-edit-title"]',
      title: "Edit leaderboard",
      description:
        "Correct or re-enter match results for a published leaderboard. Update points, placements and kill counts per match.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="leaderboard-edit-stage-group"]',
      title: "Stage and group picker",
      description:
        "Choose which stage and group's matches you want to re-edit.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="leaderboard-edit-match-list"]',
      title: "Match list",
      description:
        "See all matches in the selected group. Click a match to open the edit view for that match's results.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="leaderboard-edit-match"]',
      title: "Edit individual match",
      description:
        "Re-enter or upload match results. Choose manual entry, screenshot OCR, or 3D room file upload.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="leaderboard-edit-save"]',
      title: "Save changes",
      description:
        "When done editing match results, click Save to update the published leaderboard.",
      side: "bottom",
      align: "end",
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
      element: '[data-tour="orgs-misc-create-org-button"]',
      title: "Create a new organization",
      description:
        "Spin up a new organization with owner assignment. The form requires a name and owner username to get started.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="orgs-misc-org-search"]',
      title: "Search organizations",
      description:
        "Filter the organization list by name or slug. Results update as you type.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="org-subnav"]',
      title: "Organization sections",
      description:
        "Switch between Organizations list, Design Requests, and Org Reports using the sub-navigation tabs.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-org-table"]',
      title: "Organizations table",
      description:
        "Every registered organization with status, member count, events, and creation date. Click a name to view or edit its details.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="orgs-misc-org-pagination"]',
      title: "Navigate organization pages",
      description:
        "Move through the organization list using page numbers. The table is paginated server-side for performance.",
      side: "top",
      align: "center",
    },
  ],

  // Design Requests queue (app/(a)/a/organizations/design-requests/page.tsx)
  "orgs-misc-design-requests": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="orgs-misc-design-requests-title"]',
      title: "Design Requests review queue",
      description:
        "A centralized queue for organizer leaderboard design requests across all organizations. Status-filterable and paginated.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="org-subnav"]',
      title: "Switch between organization views",
      description:
        "Navigate to Organizations list, Design Requests, and Org Reports from this sub-nav.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-design-status-filter"]',
      title: "Filter by request status",
      description:
        "Show requests by status: all, open, in-progress, applied, or rejected. The table updates as you filter.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-design-requests-table"]',
      title: "Design request rows",
      description:
        "Each row shows organization, request title, submitter, status, and date. Use Manage to move it through its lifecycle.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="orgs-misc-design-manage-button"]',
      title: "Manage a design request",
      description:
        "Open a dialog to update the status, add resolution notes, and attach reference images or organizer context.",
      side: "top",
      align: "center",
    },
  ],

  // Organization integrity reports (app/(a)/a/organizations/reports/page.tsx)
  "orgs-misc-org-reports": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="orgs-misc-org-reports-title"]',
      title: "Organization integrity reports",
      description:
        "A queue for user-submitted reports against organizations regarding rankings manipulation, fake results, or unfair conduct.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="org-subnav"]',
      title: "Switch between organization sections",
      description:
        "Navigate Organizations list, Design Requests, and Org Reports via this sub-nav.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-org-reports-status-filter"]',
      title: "Filter reports by status",
      description:
        "Show reports by status: all, open, reviewing, resolved, or dismissed. Open reports are high priority.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-org-reports-table"]',
      title: "Report rows",
      description:
        "Each row shows organization, category, reporter, related event, status, and date. Use Resolve to handle each report.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="orgs-misc-org-reports-resolve"]',
      title: "Resolve an integrity report",
      description:
        "Open a dialog to update status, add resolution notes, view evidence, and optionally exclude the event from rankings.",
      side: "top",
      align: "center",
    },
  ],

  // Organization detail (app/(a)/a/organizations/[slug]/page.tsx)
  "orgs-misc-org-detail": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="orgs-misc-org-detail-profile-tab"]',
      title: "Edit organization profile",
      description:
        "Update the organization name, email, description, social links, and status. Save or suspend from this tab.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-org-detail-members-tab"]',
      title: "Manage organization members",
      description:
        "Add members, view their permissions, set ownership, and remove users from this tab.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-org-detail-events-tab"]',
      title: "Review organization events",
      description:
        "View all events belonging to this organization. Verify or unverify each event's rankings from this table.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-org-detail-save-profile"]',
      title: "Save profile changes",
      description:
        "Commit edits to name, email, description, and socials after making changes on the Profile tab.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="orgs-misc-org-detail-suspend"]',
      title: "Suspend the organization",
      description:
        "Temporarily block the organization's access without deleting it. Use Unsuspend to restore access later.",
      side: "bottom",
      align: "end",
    },
  ],

  // Sponsor accounts list (app/(a)/a/sponsors/page.tsx)
  "orgs-misc-sponsors-list": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="orgs-misc-sponsors-create"]',
      title: "Create a new sponsor account",
      description:
        "Set up a new sponsor account with login credentials and event assignments in a guided wizard.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="orgs-misc-sponsors-search"]',
      title: "Search sponsor accounts",
      description:
        "Filter by full name, username, or email. Results update as you type.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-sponsors-table"]',
      title: "Sponsor accounts table",
      description:
        "Every sponsor with full name, username, email, and actions. Click Edit to update details and event assignments.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="orgs-misc-sponsors-pagination"]',
      title: "Navigate sponsor pages",
      description:
        "Move through the sponsor list using page numbers. The table is paginated client-side.",
      side: "top",
      align: "center",
    },
  ],

  // Sponsor creation wizard (app/(a)/a/sponsors/create/page.tsx)
  "orgs-misc-sponsors-create": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="orgs-misc-sponsors-create-step-indicator"]',
      title: "Two-step sponsor creation",
      description:
        "Step 1: Account Details with credentials. Step 2: Assign events to the sponsor account.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-sponsors-create-account-form"]',
      title: "Create account credentials",
      description:
        "Enter full name, UID, username, email, and password. Password must meet complexity requirements.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="orgs-misc-sponsors-create-password-strength"]',
      title: "Password strength indicator",
      description:
        "Shows requirements met and strength level: weak, medium, or strong.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-sponsors-create-events"]',
      title: "Assign events to sponsor",
      description:
        "Select events to grant the sponsor access. This step is optional. Skip to finish without assignment.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="orgs-misc-sponsors-create-success"]',
      title: "Account created successfully",
      description:
        "The plaintext credentials display only once. Copy or download them immediately before closing.",
      side: "over",
      align: "center",
    },
  ],

  // Sponsor edit (app/(a)/a/sponsors/[id]/edit/page.tsx)
  "orgs-misc-sponsors-edit": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="orgs-misc-sponsors-edit-details"]',
      title: "Update sponsor details",
      description:
        "Edit full name, email, and username. Optionally reset password with complexity requirements.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-sponsors-edit-password"]',
      title: "Reset sponsor password",
      description:
        "Leave blank to keep current password. If changed, must meet strength requirements.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-sponsors-edit-events"]',
      title: "Update event assignments",
      description:
        "Search and select which events the sponsor can access. Changes take effect immediately on save.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="orgs-misc-sponsors-edit-save"]',
      title: "Save sponsor updates",
      description:
        "Commit all changes to details and event assignments.",
      side: "bottom",
      align: "end",
    },
  ],

  // API key partners list (app/(a)/a/partners/page.tsx)
  "orgs-misc-partners-list": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="orgs-misc-partners-create"]',
      title: "Create a new API key partner",
      description:
        "Provision a new data-API partner. It starts with every toggle off and no scope until configured.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="orgs-misc-partners-search"]',
      title: "Search API key partners",
      description:
        "Filter by name or slug. Results update as you type.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-partners-table"]',
      title: "API key partners table",
      description:
        "Each partner shows name, slug, status, active key count, and creation date. Click name to configure.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="orgs-misc-partners-active-keys"]',
      title: "Active API keys count",
      description:
        "Shows how many active (non-revoked) keys are issued for each partner.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="orgs-misc-partners-pagination"]',
      title: "Navigate partner pages",
      description:
        "Move through the partners list using page numbers. Server-side paginated.",
      side: "top",
      align: "center",
    },
  ],

  // API key partner detail (app/(a)/a/partners/[slug]/page.tsx)
  "orgs-misc-partners-detail": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="orgs-misc-partners-profile-tab"]',
      title: "Partner profile and suspension",
      description:
        "View name and contact email (read-only). Use Suspend to block all keys at once without revoking.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-partners-scope-tab"]',
      title: "Configure scope and toggles",
      description:
        "Grant access to native AFC events, specific events, organizations, and configure 6 resource and 8 field toggles.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-partners-keys-tab"]',
      title: "Manage API keys",
      description:
        "Issue new keys with optional labels and per-key rate limits. Revoke active keys with immediate effect.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-partners-native-afc"]',
      title: "Grant all native AFC events",
      description:
        "One switch grants every AFC-run event (no organizer) at once for convenience.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="orgs-misc-partners-allowed-events"]',
      title: "Select allowed events",
      description:
        "Searchable list of events to grant the partner read access to.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="orgs-misc-partners-issue-key"]',
      title: "Issue a new API key",
      description:
        "Create a new key with optional label and rate limit. Plaintext is shown only once.",
      side: "top",
      align: "center",
    },
  ],

  // News list / editor (app/(a)/a/news/page.tsx)
  "orgs-misc-news-list": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="orgs-misc-news-create"]',
      title: "Create a new news article",
      description:
        "Write and publish news with rich text, images, category, and status. Uses a stepped form.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="orgs-misc-news-search"]',
      title: "Search news by title, content, or author",
      description:
        "Filter articles in real-time as you type your search query.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-news-date-filter"]',
      title: "Filter by publication date",
      description:
        "Show only articles published on a specific date.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-news-category-filter"]',
      title: "Filter by category",
      description:
        "Categories: General News, Tournament Updates, Banned Player or Team Updates. Select one or view all.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-news-status-filter"]',
      title: "Filter by publication status",
      description:
        "Show Published, Draft, or Archived articles separately.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="orgs-misc-news-clear-filters"]',
      title: "Reset all filters",
      description:
        "Remove all active search and filter criteria to see the full news list again.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="orgs-misc-news-cards"]',
      title: "News article cards",
      description:
        "Grid of article cards with image, title, author, date, and likes and dislikes. Click View to read full article.",
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
      element: '[data-tour="settings-misc-tabs-header"]',
      title: "Switch between settings tabs",
      description:
        "This settings page has multiple tabs: Admin Users, All Users, Roles, Notifications, Login History and Admin Activities. Each tab controls a different aspect of user and role management.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="settings-misc-export-excel"]',
      title: "Export administrators to Excel",
      description:
        "Download a complete list of all administrators and their roles as an Excel file for records or reporting.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="settings-misc-admin-search"]',
      title: "Find an administrator",
      description:
        "Search for admin users by username, email or role. The table below updates as you type.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="settings-misc-admin-edit"]',
      title: "Edit administrator roles",
      description:
        "Click the pencil icon next to any admin to change their assigned roles and permissions. You can combine multiple roles.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="settings-misc-admin-suspend"]',
      title: "Suspend or activate an admin",
      description:
        "Temporarily disable an administrator account by clicking Suspend, or re-enable a suspended account by clicking Activate.",
      side: "top",
      align: "center",
    },
  ],

  // OCR model dashboard (app/(a)/a/ocr-model/page.tsx)
  "settings-misc-ocr-model": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="settings-misc-ocr-headline"]',
      title: "OCR model headline metrics",
      description:
        "Watch the key numbers: active model version, local share (percentage of reads answered by the local model), zero-touch rate (reads with no admin edits needed) and Gemini calls (cost proxy).",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="settings-misc-ocr-tabs"]',
      title: "Explore OCR model details",
      description:
        "Performance charts show how the flywheel is climbing (local model taking more reads, fewer admin edits). Dataset, Retrain History and Controls tabs hold the operator tools.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="settings-misc-ocr-download"]',
      title: "Download the training dataset",
      description:
        "Export the current gold-label training data as a ZIP file. The offline trainer uses this to train the next model version.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="settings-misc-ocr-promote"]',
      title: "Promote a model to active",
      description:
        "Type the version of a trained model (for example local_student_v4) and click Promote to make it the active read engine for new screenshots.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="settings-misc-ocr-rollback"]',
      title: "Rollback to the previous model",
      description:
        "If the active model has issues, click Rollback to revert to the previously promoted version until you can diagnose and promote a fix.",
      side: "top",
      align: "center",
    },
  ],

  // Drafted events (app/(a)/a/drafts/page.tsx)
  "settings-misc-drafts": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="settings-misc-drafts-metrics"]',
      title: "Drafted events snapshot",
      description:
        "Two cards show the total number of drafted events across all admins and the number you personally created. Use these to track work in progress.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="settings-misc-drafts-search"]',
      title: "Find a draft by event name",
      description:
        "Type an event name to filter the list below. The search works across all drafts or only your drafts, depending on the tab you have open.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="settings-misc-drafts-tabs"]',
      title: "Switch between All Drafts and My Drafts",
      description:
        "The All Drafts tab shows every admin's in-progress events. My Drafts shows only the ones you created. Badges show counts.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="settings-misc-drafts-continue"]',
      title: "Continue editing a draft",
      description:
        "Click the Continue editing button to reopen a draft event in the wizard and pick up where you left off.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="settings-misc-drafts-delete"]',
      title: "Delete a draft event",
      description:
        "Click the trash icon to remove a draft. Confirmation is required. Deleting a draft does not affect published events.",
      side: "top",
      align: "center",
    },
  ],

  // Voting analytics (app/(a)/a/votes/page.tsx)
  "settings-misc-votes": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="settings-misc-votes-metrics"]',
      title: "Voting dashboard headline metrics",
      description:
        "Key cards show total votes cast, unique voters, completion rate and average voting time. Watch these to track voting campaign health.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="settings-misc-votes-tabs"]',
      title: "Explore voting data by tab",
      description:
        "Tabs let you dive into Overview, Sections, Categories, Nominees, Winners, Timeline, Top Performers and Management. Each offers a different view of voting data.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="settings-misc-votes-sections"]',
      title: "View award sections",
      description:
        "The Sections tab shows all award groupings (for example Content Creator Awards, Esports Awards) with vote totals and category counts for each.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="settings-misc-votes-categories"]',
      title: "Analyze voting by category",
      description:
        "The Categories tab breaks down votes per award category with charts and bars. Use the section filter to focus on one award area.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="settings-misc-votes-winners"]',
      title: "Review category winners",
      description:
        "The Winners tab displays the top vote-getter in each category with vote counts and percentages so you can see who is leading in real time.",
      side: "bottom",
      align: "start",
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

  // ── Teams (combined teams+players page; sub-routes reuse the parent tour).
  if (path.startsWith("/a/teams")) return "teams";

  // ── Organizations: design-requests / reports before the [slug] detail and the
  //    bare list root (the detail prefix /a/organizations/<slug> must come last).
  if (path === "/a/organizations/design-requests")
    return "orgs-misc-design-requests";
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

  return null;
}
