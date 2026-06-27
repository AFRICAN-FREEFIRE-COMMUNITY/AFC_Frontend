// ─────────────────────────────────────────────────────────────────────────────
// vendor-tour-steps.ts  —  step definitions for the guided Vendor Tour
// ----------------------------------------------------------------------------
// PURPOSE
//   Page-keyed catalogue of the "Take a tour" guided walkthrough for the VENDOR
//   portal (app/(vendor)/vendor/*). It mirrors the admin tour system
//   (app/(a)/a/_components/admin-tour-steps.ts) but lives entirely inside the
//   vendor area so the two portals stay independent.
//
//   The big difference from the admin catalogue: the admin steps hardcode their
//   English copy here, whereas the VENDOR portal is a normal user-facing surface
//   and therefore MUST be internationalised (AFC i18n hard rule). So a step here
//   carries an i18n key (`tKey`) instead of literal copy; the launcher resolves
//   the title + description at render time via
//     useTranslations("vendor") -> t(`${tKey}.title`) / t(`${tKey}.description`)
//   The English source for every key lives in messages/en/vendor.json under the
//   "tour" namespace; fr/pt are machine-generated from it (pnpm i18n:translate).
//
// HOW IT CONNECTS
//   - CONSUMED BY: ./VendorTourLauncher.tsx — reads VENDOR_TOUR_STEPS[pageKey],
//     translates each step, and feeds them into driver.js (the same tiny
//     walkthrough lib the admin tour uses). The launcher is mounted once in the
//     vendor header (app/(vendor)/vendor/layout.tsx) and decides the page key from
//     the current pathname via resolveVendorTourPageKey below.
//   - Each step targets a real control on the page through a stable
//     `data-tour="…"` selector we add directly on the vendor pages. The shared
//     first step targets the vendor sidebar nav (the shadcn SidebarMenu slot),
//     exactly like the admin tour, so every tour opens by orienting the vendor.
//
// COPY RULES (AFC hard rules)
//   - NO em or en dashes in any user-facing string (those live in vendor.json, not
//     here; box-drawing dashes in these comments never render to the user).
//
// ADDING A NEW VENDOR PAGE LATER
//   1. Add `data-tour="my-key"` anchors on the controls you want to highlight.
//   2. Add an entry to VENDOR_TOUR_STEPS keyed by a short pageKey, reusing
//      SIDEBAR_STEP as the first step.
//   3. Add the matching copy under messages/en/vendor.json -> tour.<...>.
//   4. Map the route to the pageKey in resolveVendorTourPageKey.
// ─────────────────────────────────────────────────────────────────────────────

// A single highlighted step. `element` is a CSS selector resolved at runtime; if
// it matches nothing, the launcher silently drops the step (so a tour never throws
// on a page whose layout changed). `tKey` is the message path under the "vendor"
// namespace, WITHOUT the trailing ".title"/".description" (the launcher appends
// those). `side`/`align` position the popover around the target (driver.js terms).
export type VendorTourStep = {
  element: string;
  tKey: string;
  side?: "top" | "right" | "bottom" | "left" | "over";
  align?: "start" | "center" | "end";
};

// Known vendor page keys. Kept short + stable — they are the localStorage suffix
// (afc_vendor_tour_<pageKey>_done), so renaming one re-shows that tour.
export type VendorTourPageKey =
  | "orders"
  | "order-detail"
  | "products"
  | "payouts";

// ── Shared first step: the vendor sidebar navigation ─────────────────────────
// Every vendor tour opens by pointing at the portal sidebar so the vendor learns
// where Orders / Products / Payouts live before we dive into the page. Targets the
// shadcn SidebarMenu slot (same selector the admin tour uses). On mobile the
// sidebar is offcanvas (rendered only when opened), so the menu is absent from the
// DOM and the step is dropped automatically; the tour then starts at the next step.
const SIDEBAR_STEP: VendorTourStep = {
  element: '[data-slot="sidebar-menu"]',
  tKey: "tour.sidebar",
  side: "right",
  align: "start",
};

// ── Per-page steps ───────────────────────────────────────────────────────────
// The selectors below correspond to the data-tour anchors added on each vendor
// page. Order matters: it is the order the vendor steps through.
export const VENDOR_TOUR_STEPS: Record<VendorTourPageKey, VendorTourStep[]> = {
  // Orders queue (app/(vendor)/vendor/orders/page.tsx).
  orders: [
    SIDEBAR_STEP,
    {
      element: '[data-tour="vendor-orders-header"]',
      tKey: "tour.orders.intro",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="vendor-orders-search"]',
      tKey: "tour.orders.search",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="vendor-orders-table"]',
      tKey: "tour.orders.table",
      side: "top",
      align: "center",
    },
  ],

  // Per-order fulfilment page (app/(vendor)/vendor/orders/[id]/page.tsx).
  "order-detail": [
    SIDEBAR_STEP,
    {
      element: '[data-tour="vendor-order-header"]',
      tKey: "tour.orderDetail.intro",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="vendor-order-details"]',
      tKey: "tour.orderDetail.details",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="vendor-order-fulfilment"]',
      tKey: "tour.orderDetail.fulfilment",
      side: "top",
      align: "center",
    },
  ],

  // Products catalogue (app/(vendor)/vendor/products/page.tsx).
  products: [
    SIDEBAR_STEP,
    {
      element: '[data-tour="vendor-products-create"]',
      tKey: "tour.products.create",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="vendor-products-review"]',
      tKey: "tour.products.review",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="vendor-products-table"]',
      tKey: "tour.products.table",
      side: "top",
      align: "center",
    },
  ],

  // Payouts / bank details (app/(vendor)/vendor/payouts/page.tsx).
  payouts: [
    SIDEBAR_STEP,
    {
      element: '[data-tour="vendor-payouts-header"]',
      tKey: "tour.payouts.intro",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="vendor-payouts-info"]',
      tKey: "tour.payouts.how",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="vendor-payouts-form"]',
      tKey: "tour.payouts.form",
      side: "top",
      align: "center",
    },
  ],
};

// ── Route → pageKey map ──────────────────────────────────────────────────────
// The header launcher (./VendorTourLauncher.tsx) calls this with the current
// pathname to decide which tour to offer. A route with no tour returns null and
// the launcher hides itself. Match the most specific routes FIRST: the dynamic
// per-order detail (/vendor/orders/<id>) is tested before the bare /vendor/orders
// queue so it never gets swallowed as the queue.
export function resolveVendorTourPageKey(
  pathname: string,
): VendorTourPageKey | null {
  // Normalise a trailing slash so "/vendor/orders/" and "/vendor/orders" match.
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  // Per-order detail (dynamic id) BEFORE the queue root.
  if (/^\/vendor\/orders\/[^/]+$/.test(path)) return "order-detail";
  if (path === "/vendor/orders") return "orders";
  if (path === "/vendor/products") return "products";
  if (path === "/vendor/payouts") return "payouts";
  // /vendor redirects to /vendor/orders (see vendor/page.tsx); treat it as orders.
  if (path === "/vendor") return "orders";
  // Any other /vendor/* route falls back to the orders queue tour.
  if (path.startsWith("/vendor")) return "orders";

  return null;
}
