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
//     from the current pathname (see PATHNAME_TO_PAGE_KEY below) and renders
//     <AdminTour pageKey=… />.
//   - Each step targets a real control via a CSS selector. Most selectors are
//     stable `[data-tour="…"]` hooks that we add directly on the admin pages
//     (dashboard / events / teams / player-markets). The sidebar nav is targeted
//     by a structural selector shared across every page.
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
//   3. Map the route to that pageKey in PATHNAME_TO_PAGE_KEY.
//   That is all — the launcher, auto-show, and localStorage persistence are generic
//   and need no further wiring.
// ─────────────────────────────────────────────────────────────────────────────

// A single highlighted step. `element` is a CSS selector resolved at runtime; if
// it matches nothing, AdminTour silently drops the step (so a tour never throws on
// a page whose layout changed). `side`/`align` position the popover around the
// target (driver.js terms): side = which edge of the element the popover sits on.
export type AdminTourStep = {
  element: string;
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left" | "over";
  align?: "start" | "center" | "end";
};

// Known page keys. Keep these short and stable — they are used as the localStorage
// suffix (afc_admin_tour_<pageKey>_done), so renaming one re-shows that tour.
export type AdminTourPageKey =
  | "dashboard"
  | "events"
  | "teams"
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
    "This sidebar is how you move around the admin area: dashboard, events, teams, news, shop and more. The section you are on is highlighted in green.",
  side: "right",
  align: "start",
};

// ── Per-page steps ───────────────────────────────────────────────────────────
// The element selectors below correspond to data-tour attributes we add on each
// admin page. Order matters: it is the order the user steps through.
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
        "Each card shows a key number plus a shortcut to manage that area. For example, Total Teams links straight to Teams and Players.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="dashboard-quick-actions"]',
      title: "Quick actions",
      description:
        "Jump straight into the most common tasks (create news, create an event) without hunting through the menu.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="dashboard-recent-activity"]',
      title: "Recent admin activity",
      description:
        "A running log of what other admins have done lately, so the team stays in sync. Use View All Activities for the full history.",
      side: "top",
      align: "center",
    },
  ],

  // Events and Leaderboards (app/(a)/a/events/page.tsx → EventsAdminContent.tsx)
  events: [
    SIDEBAR_STEP,
    {
      element: '[data-tour="events-tabs"]',
      title: "Events and Leaderboards",
      description:
        "This page has two tabs. Events is where you run tournaments and scrims; Leaderboards is where you manage standings. Switch between them here.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="events-create"]',
      title: "Create a new event",
      description:
        "Start a tournament or scrim here. The wizard walks you through details, stages, prizes and rules, then publishes it.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="events-payments"]',
      title: "Event payments",
      description:
        "For paid events, this opens the escrow dashboard where you release or refund registration fees held by Stripe.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="events-search"]',
      title: "Find an event fast",
      description:
        "Filter the list below by name, type or status. Handy once you have a lot of events on record.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="events-list"]',
      title: "Your events and scrims",
      description:
        "Every event lives here. Use the row buttons to View, Edit, or Delete an event. Private events show a small lock icon.",
      side: "top",
      align: "center",
    },
  ],

  // Teams and Players (app/(a)/a/teams/page.tsx → TeamsAdminContent.tsx, Teams tab)
  teams: [
    SIDEBAR_STEP,
    {
      element: '[data-tour="teams-tabs"]',
      title: "Teams and Players",
      description:
        "This page combines two tabs. Teams manages registered squads and their tiers; Players manages individual accounts. Switch between them here.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="teams-rank"]',
      title: "Rank teams into tiers",
      description:
        "Run the tiering pass that sorts teams into Tier 1, 2 and 3 based on their performance. Use this after results are in.",
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
        "Every registered team, with its tier, member count, wins and earnings. The row actions let you view a team or ban and unban it.",
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
        "Overview shows the headline numbers. The other tabs drill into Team Listings, Player Listings, Trials and Applications, and Reports and Flags.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="market-overview"]',
      title: "Market at a glance",
      description:
        "These cards summarise active listings, ongoing trials and pending reports, so you can spot anything that needs attention.",
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
  if (pathname.startsWith("/a/player-markets")) return "player-markets";
  return null;
}
