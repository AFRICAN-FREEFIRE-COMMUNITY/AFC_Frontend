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
  | "player-markets";

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
};

// ── Route → pageKey map ──────────────────────────────────────────────────────
// The header launcher (components/site-header.tsx) calls resolveAdminTourPageKey()
// with the current pathname to decide which tour to offer. Keep this in sync with
// the keys above. A page with no tour returns null and the launcher hides itself.
export function resolveAdminTourPageKey(
  pathname: string,
): AdminTourPageKey | null {
  // Order matters: match the most specific prefixes first. We match on the page
  // root (e.g. /a/events) and any sub-route is treated as the same page so the
  // launcher still appears, but the deep sub-pages simply reuse the parent steps
  // (selectors that are not present are dropped, so it stays safe).
  if (pathname === "/a/dashboard") return "dashboard";
  if (pathname.startsWith("/a/events")) return "events";
  if (pathname.startsWith("/a/teams")) return "teams";
  if (pathname.startsWith("/a/rankings")) return "rankings";
  if (pathname.startsWith("/a/player-markets")) return "player-markets";
  return null;
}
