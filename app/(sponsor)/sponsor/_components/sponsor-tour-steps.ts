// ─────────────────────────────────────────────────────────────────────────────
// sponsor-tour-steps.ts  -  step definitions for the guided Sponsor Tour
// ----------------------------------------------------------------------------
// PURPOSE
//   Page-keyed catalogue of the "Take a tour" guided walkthrough for the SPONSOR
//   portal (app/(sponsor)/sponsor/*). The sponsor twin of the admin tour
//   (app/(a)/a/_components/admin-tour-steps.ts) and the vendor tour
//   (app/(vendor)/vendor/_components/vendor-tour-steps.ts).
//
//   Like the vendor tour (and unlike the admin tour, which hardcodes its copy),
//   the sponsor portal is a normal user-facing surface, so each step is i18n
//   (AFC hard rule). A step carries an i18n key (`tKey`); the launcher resolves
//   the title + description via useTranslations("sponsor") ->
//   t(`${tKey}.title`) / t(`${tKey}.description`). English source lives in
//   messages/en/sponsor.json under the "tour" namespace (fr/pt machine-generated).
//
// DIFFERENCE FROM THE OTHER PORTALS
//   The sponsor portal has NO sidebar (its layout is just a header + content), so
//   there is no shared "sidebar" first step. Instead the first step points at the
//   portal HEADER (the nav surface: brand + log out), which the launcher anchors
//   via a data-tour on the header in app/(sponsor)/sponsor/layout.tsx.
//
//   The sponsor dashboard also renders one of TWO components depending on the
//   caller (ScopedSponsorDashboard for entity-scoped sponsors, the legacy
//   dashboard otherwise). The SAME data-tour anchor names are added to the
//   equivalent controls in BOTH, and the step copy is written generically, so the
//   tour works whichever variant renders.
//
// HOW IT CONNECTS
//   - CONSUMED BY: ./SponsorTourLauncher.tsx - reads SPONSOR_TOUR_STEPS[pageKey],
//     translates each step, and drives driver.js. Mounted once in the sponsor
//     header (app/(sponsor)/sponsor/layout.tsx); the page key comes from
//     resolveSponsorTourPageKey(pathname).
//
// COPY RULES (AFC hard rules)
//   - NO em or en dashes in user-facing strings (those live in sponsor.json; the
//     box-drawing dashes in these comments never render to the user).
// ─────────────────────────────────────────────────────────────────────────────

// A single highlighted step (see vendor-tour-steps.ts for the field contract). `tKey`
// is the message path under the "sponsor" namespace, sans ".title"/".description".
export type SponsorTourStep = {
  element: string;
  tKey: string;
  side?: "top" | "right" | "bottom" | "left" | "over";
  align?: "start" | "center" | "end";
};

// Known sponsor page keys. The dashboard is currently the portal's only page; the key
// is the localStorage suffix (afc_sponsor_tour_<pageKey>_done).
export type SponsorTourPageKey = "dashboard";

// ── Per-page steps ───────────────────────────────────────────────────────────
export const SPONSOR_TOUR_STEPS: Record<SponsorTourPageKey, SponsorTourStep[]> = {
  // Sponsor dashboard (app/(sponsor)/sponsor/dashboard/page.tsx - either the scoped
  // or the legacy dashboard; both carry these anchors).
  dashboard: [
    {
      // The portal header (brand + log out) lives in the sponsor LAYOUT. It is the
      // sponsor portal's nav surface, so the tour opens by orienting the sponsor here.
      element: '[data-tour="sponsor-header"]',
      tKey: "tour.dashboard.intro",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="sponsor-dashboard-header"]',
      tKey: "tour.dashboard.welcome",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="sponsor-dashboard-filters"]',
      tKey: "tour.dashboard.filters",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="sponsor-dashboard-list"]',
      tKey: "tour.dashboard.list",
      side: "top",
      align: "center",
    },
  ],
};

// ── Route → pageKey map ──────────────────────────────────────────────────────
// The header launcher (./SponsorTourLauncher.tsx) calls this with the current pathname.
// A route with no tour returns null and the launcher hides itself.
export function resolveSponsorTourPageKey(
  pathname: string,
): SponsorTourPageKey | null {
  // Normalise a trailing slash so "/sponsor/dashboard/" and "/sponsor/dashboard" match.
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  if (path === "/sponsor/dashboard") return "dashboard";
  // /sponsor (and any other sponsor route) falls back to the dashboard tour.
  if (path === "/sponsor") return "dashboard";
  if (path.startsWith("/sponsor")) return "dashboard";

  return null;
}
