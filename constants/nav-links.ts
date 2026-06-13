import {
  IconArticle,
  IconBan,
  IconBuilding,
  IconCalendar,
  IconChartBarPopular,
  IconFolder,
  IconHome,
  IconInfoCircle,
  IconMessage,
  IconNews,
  IconPlugConnected,
  IconScan,
  IconSettings,
  IconShield,
  IconShoppingCart,
  IconStar,
  IconUsers,
  IconUsersGroup,
  IconVocabulary,
} from "@tabler/icons-react";
import { Award } from "lucide-react";

export const homeNavLinks = [
  { slug: "/home", label: "Home", icon: IconHome },
  { slug: "/teams", label: "Teams", icon: IconUsers },
  { slug: "/news", label: "News", icon: IconArticle },
  { slug: "/glossary", label: "Glossary", icon: IconVocabulary },
  { slug: "/awards", label: "Awards", icon: Award },
];

interface NavLinks {
  slug: string;
  label: string;
  icon: any;
  onlyMobile?: boolean;
  comingSoon?: boolean;
  newLink?: boolean;
  title?: string;
  addedAt?: string;
  submenu?: boolean;
  items?: {
    title: string;
    label?: string;
    slug: string;
    icon: any;
    // Optional like on the top-level links: the Shop submenu items carry
    // newLink/addedAt for the auto-clearing NEW badge, so the type allows them
    // (they were always passed; the type just never declared them).
    comingSoon?: boolean;
    newLink?: boolean;
    addedAt?: string;
  }[];
}

export const homeNavLinksMobile: NavLinks[] = [
  { slug: "/home", label: "Home", icon: IconHome, onlyMobile: false },
  { slug: "/teams", label: "Teams", icon: IconUsers },
  {
    slug: "/tournaments",
    label: "Tournaments & Scrims",
    icon: IconCalendar,
  },
  {
    slug: "/rankings",
    label: "Rankings & Tiers",
    icon: IconChartBarPopular,
    // Just unlocked (was "coming soon"): flag NEW for 7 days from this date, then the
    // badge auto-clears (see isNewLink). Update addedAt if the unlock date changes.
    newLink: true,
    addedAt: "2026-06-07",
  },
  {
    slug: "/player-markets",
    label: "Player Markets",
    icon: IconUsers,
  },
  { slug: "/news", label: "News & Updates", icon: IconArticle },
  {
    slug: "/rules",
    label: "Rules",
    icon: IconArticle,
    newLink: true,
    addedAt: "2026-03-16",
  },
  {
    label: "Shop",
    slug: "/shop",
    icon: IconShoppingCart,
    submenu: true,
    // Just unlocked: NEW badge for 7 days from this date, auto-clears afterwards.
    newLink: true,
    addedAt: "2026-06-07",
    items: [
      {
        title: "Shop",
        slug: "/shop",
        icon: IconShoppingCart,
        newLink: true,
        addedAt: "2026-06-07",
      },
      {
        title: "My Orders",
        slug: "/orders",
        icon: IconFolder,
        newLink: true,
        addedAt: "2026-06-07",
      },
    ],
  },
  {
    slug: "/awards",
    label: "Awards",
    icon: Award,
    newLink: true,
    addedAt: "2026-01-10",
  },
  { slug: "/about", label: "About Us", icon: IconInfoCircle },
  { slug: "/contact", label: "Contact", icon: IconMessage },
  // Glossary sits under Contact in the hamburger menu (owner request 2026-06-10).
  { slug: "/glossary", label: "Glossary", icon: IconVocabulary },
];
// Define the shape of our admin links for type safety
interface AdminNavLink {
  label: string;
  slug: string;
  icon: any;
  comingSoon?: boolean;
  allowedRoles?: string[]; // Optional: if omitted, all admins see it
}

export const adminNavLinks: AdminNavLink[] = [
  {
    label: "Admin Dashboard",
    slug: "/a/dashboard",
    icon: IconHome,
    allowedRoles: ["head_admin"],
  },
  // Teams + Players are now ONE combined page (owner request 2026-06-09): the two
  // standalone admin pages were merged into a single two-tab page at /a/teams
  // (Teams | Players). /a/players redirects there with ?tab=players. This single
  // sidebar entry replaces the old separate "Admin Players" + "Admin Teams" links.
  // allowedRoles is the union of the old two (head_admin saw players; teams_admin +
  // head_admin saw teams) so neither audience loses access to the merged page.
  {
    label: "Teams & Players",
    slug: "/a/teams",
    icon: IconUsersGroup,
    allowedRoles: ["head_admin", "teams_admin"],
  },
  {
    slug: "/a/player-markets",
    label: "Player Markets",
    allowedRoles: ["head_admin"],
    icon: IconUsers,
  },
  {
    // Events + Leaderboards are now ONE combined page (owner request 2026-06-09): the two
    // standalone admin pages were merged into a single two-tab page at /a/events
    // (Events | Leaderboards). /a/leaderboards redirects there with ?tab=leaderboards.
    // This single entry replaces the old separate "Admin Events" + "Admin Leaderboards"
    // links; allowedRoles is the union (event_admin saw events; leaderboards was head_admin).
    // Event Payments (the paid-event escrow dashboard) is still NOT a sidebar entry: it
    // lives inside the Events tab, reached via the "Event Payments" header button. Route
    // unchanged: /a/events/payments.
    label: "Events & Leaderboards",
    slug: "/a/events",
    icon: IconCalendar,
    allowedRoles: ["head_admin", "event_admin"],
  },
  {
    label: "Sponsors",
    slug: "/a/sponsors",
    icon: IconStar,
    allowedRoles: ["head_admin", "event_admin"],
  },
  {
    // Org Reports used to be a separate sidebar entry here. It now lives UNDER this page
    // as a segmented sub-nav (OrgSubNav) on the organizations index routes, so the sidebar
    // stays lean. Route unchanged: /a/organizations/reports. (The "Design Requests" tab was
    // removed 2026-06-13 with the request-a-design feature.)
    label: "Organizations",
    slug: "/a/organizations",
    icon: IconUsersGroup,
    allowedRoles: ["head_admin", "organizer_admin"],
  },
  {
    // Blacklist visibility dashboard (owner ask 2026-06-12): every organizer
    // blacklist across all orgs - how many times, by whom, and why - with stat
    // cards + filters (app/(a)/a/blacklists/page.tsx). Sits next to Organizations
    // because it oversees the same organizer ecosystem, gated to the SAME roles the
    // backend endpoint checks (is_platform_org_admin: head_admin / organizer_admin).
    label: "Blacklists",
    slug: "/a/blacklists",
    icon: IconBan,
    allowedRoles: ["head_admin", "organizer_admin"],
  },
  {
    // Data-API partner management (afc_partner_api admin surface). Gated on
    // head_admin / partner_admin to match the backend's _is_partner_admin check
    // (role__role_name__in=["head_admin","partner_admin"]) - same team that runs
    // the partner program. IconPlugConnected reads as an external integration/API.
    // Sidebar label is "API Keys" (owner request 2026-06-09); the route stays /a/partners
    // (the afc_partner_api admin surface for issuing/managing partner API keys).
    label: "API Keys",
    slug: "/a/partners",
    icon: IconPlugConnected,
    allowedRoles: ["head_admin", "partner_admin"],
  },
  {
    label: "Admin News",
    slug: "/a/news",
    icon: IconNews,
    allowedRoles: ["head_admin", "news_admin"],
  },
  // Admin Rankings is also gated app-wide in AuthContext.isAdmin /
  // isAdminByRoleOrRoles; keep metrics_admin in sync there or a metrics_admin-only
  // user sees this link but is not treated as admin elsewhere.
  {
    label: "Admin Rankings",
    slug: "/a/rankings",
    icon: IconArticle,
    allowedRoles: ["head_admin", "metrics_admin"],
  },
  // OCR Model ops dashboard (app/(a)/a/ocr-model/page.tsx). Shows the self-hosted OCR
  // model's weekly local share / zero-touch flywheel and exposes the dataset + model
  // controls (download dataset, promote, rollback). Gated to head_admin to match the
  // backend admin gate on the /events/ocr/ endpoints it consumes. IconScan reads as the
  // "read a screenshot" OCR action.
  {
    label: "OCR Model",
    slug: "/a/ocr-model",
    icon: IconScan,
    allowedRoles: ["head_admin"],
  },
  // Admin Shop is the single shop entry point. The vendor payouts ledger
  // (app/(a)/a/shop/payouts/page.tsx) used to have its own "Shop Payouts" entry
  // here; it now lives INSIDE the shop dashboard as the "Vendor Payouts" card in
  // the Marketplace section (owner request 2026-06-13: "Shop payouts should be
  // under the shop page"). Route unchanged: /a/shop/payouts.
  {
    label: "Admin Shop",
    slug: "/a/shop",
    icon: IconShoppingCart,
    allowedRoles: ["head_admin", "shop_admin"],
  },
  {
    label: "Votes",
    slug: "/a/votes",
    icon: Award,
    allowedRoles: ["head_admin"],
  },
  {
    label: "Drafts",
    slug: "/a/drafts",
    icon: IconFolder,
    allowedRoles: ["head_admin"],
  },
  {
    label: "Settings",
    slug: "/a/settings",
    icon: IconSettings,
    allowedRoles: ["head_admin"],
  },
  {
    label: "Admin Partner Verification",
    slug: "/a/partner/roster-verification",
    icon: IconShield,
    comingSoon: true,
    allowedRoles: ["head_admin", "partner_admin"],
  },
  {
    label: "Sponsor Dashboard",
    slug: "/a/sponsor-dashboard",
    icon: IconStar,
    allowedRoles: ["sponsor_admin"],
  },
  // The organizer's own portal (their org dashboard, scoped to orgs they belong to).
  // Gated to the `organizer` role so it shows in the sidebar exactly like Sponsor
  // Dashboard does for sponsors. Pure-organizer (non-admin) users reach /organizer
  // directly; this entry surfaces it for admin-and-organizer users in the sidebar.
  {
    label: "Organizer Dashboard",
    slug: "/organizer/overview",
    icon: IconBuilding,
    allowedRoles: ["organizer"],
  },
  {
    label: "Back to user dashboard",
    slug: "/home",
    icon: IconHome,
    allowedRoles: [
      "head_admin",
      "admin",
      "event_admin",
      "news_admin",
      "teams_admin",
      "shop_admin",
      "partner_admin",
    ],
  },
];
