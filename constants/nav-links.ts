import {
  IconHeadset,
  IconUserShare,
  IconArticle,
  IconBroadcast,
  IconBuilding,
  IconCalendar,
  IconChartBarPopular,
  IconTrophy,
  IconFolder,
  IconHelpCircle,
  IconHome,
  IconInfoCircle,
  IconMessage,
  IconRobot,
  IconNews,
  IconPlugConnected,
  IconScan,
  IconSettings,
  IconShoppingCart,
  IconStar,
  IconUsers,
  IconUsersGroup,
  IconVocabulary,
} from "@tabler/icons-react";
import { Award } from "lucide-react";

// `label` is the English fallback; `navKey` points at the shared i18n key under
// common.json -> "nav.<navKey>", which Header/MobileNavbar resolve at render time via
// useTranslations("common"). This keeps the labels translatable (fr/pt) without moving
// the icon/slug/badge metadata out of this constant. Add the matching key to
// messages/{en,fr,pt}/common.json "nav" whenever a new nav entry is added here.
export const homeNavLinks = [
  { slug: "/home", label: "Home", navKey: "home", icon: IconHome },
  { slug: "/teams", label: "Teams", navKey: "teams", icon: IconUsers },
  { slug: "/news", label: "News", navKey: "news", icon: IconArticle },
  { slug: "/glossary", label: "Glossary", navKey: "glossary", icon: IconVocabulary },
  { slug: "/awards", label: "Awards", navKey: "awards", icon: Award },
];

interface NavLinks {
  slug: string;
  label: string;
  // Shared i18n key under common.json "nav.<navKey>" (see homeNavLinks note above).
  navKey?: string;
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
    // Same shared "nav.<navKey>" lookup for submenu rows (e.g. Shop / My Orders).
    navKey?: string;
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
  { slug: "/home", label: "Home", navKey: "home", icon: IconHome, onlyMobile: false },
  { slug: "/teams", label: "Teams", navKey: "teams", icon: IconUsers },
  {
    slug: "/tournaments",
    label: "Tournaments & Scrims",
    navKey: "tournamentsScrims",
    icon: IconCalendar,
  },
  {
    slug: "/rankings",
    label: "Rankings & Tiers",
    navKey: "rankingsTiers",
    icon: IconChartBarPopular,
    // Just unlocked (was "coming soon"): flag NEW for 7 days from this date, then the
    // badge auto-clears (see isNewLink). Update addedAt if the unlock date changes.
    newLink: true,
    addedAt: "2026-06-07",
  },
  {
    slug: "/player-markets",
    label: "Player Markets",
    navKey: "playerMarkets",
    icon: IconUsers,
  },
  { slug: "/news", label: "News & Updates", navKey: "newsUpdates", icon: IconArticle },
  {
    slug: "/rules",
    label: "Rules",
    navKey: "rules",
    icon: IconArticle,
    newLink: true,
    addedAt: "2026-03-16",
  },
  {
    label: "Shop",
    navKey: "shop",
    slug: "/shop",
    icon: IconShoppingCart,
    submenu: true,
    // Just unlocked: NEW badge for 7 days from this date, auto-clears afterwards.
    newLink: true,
    addedAt: "2026-06-07",
    items: [
      {
        title: "Shop",
        navKey: "shop",
        slug: "/shop",
        icon: IconShoppingCart,
        newLink: true,
        addedAt: "2026-06-07",
      },
      {
        title: "My Orders",
        navKey: "myOrders",
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
    navKey: "awards",
    icon: Award,
    newLink: true,
    addedAt: "2026-01-10",
  },
  // Polls sits directly under Awards because an award ballot IS a poll in the new engine
  // (backend/afc_polls), and the two pages link to each other. Without an entry here the whole
  // section was reachable only by typing the URL: nothing on the site pointed at it.
  {
    slug: "/polls",
    label: "Polls",
    navKey: "polls",
    icon: IconChartBarPopular,
    newLink: true,
    addedAt: "2026-08-16",
  },
  // Fantasy sits beside Polls because both are "play along with an event" rather than "read about
  // one". The page says COMING SOON and asks whether people want it; without a menu entry the only
  // people who would answer are those already sent the URL, which is the least useful sample.
  {
    slug: "/fantasy",
    label: "Fantasy",
    navKey: "fantasy",
    icon: IconTrophy,
    newLink: true,
    addedAt: "2026-08-16",
  },
  { slug: "/about", label: "About Us", navKey: "about", icon: IconInfoCircle },
  { slug: "/contact", label: "Contact", navKey: "contact", icon: IconMessage },
  // Glossary sits under Contact in the hamburger menu (owner request 2026-06-10).
  { slug: "/glossary", label: "Glossary", navKey: "glossary", icon: IconVocabulary },
];
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ADMIN MENU (inbox #52 / #54, owner 2026-09-26: "a lot on the hamburger menu now, A LOT", then the
// grouped structure and its mockup approved, mockups/admin-menu/admin-menu-mockup.html).
//
// The admin sidebar is SECTIONS -> PAGES -> SUB-PAGES, all declared here once:
//   adminNavSections  what components/nav-main.tsx draws (collapsible sections; a page's sub-pages
//                     open underneath while you are on it) and what components/site-header.tsx
//                     reads for the "Section > Page > Sub-page" breadcrumb
//   adminSwitchLinks  "Switch to" (player site, organizer and sponsor dashboards), drawn in the
//                     sidebar footer rather than mixed in with admin pages
//   adminNavLinks     the same pages FLATTENED, with every sub-page that has a narrower gate, for
//                     app/(user)/_components/ProtectedRoute.tsx, which gates each /a/* route by the
//                     LONGEST matching slug here (it used to take the first match, so /a/ocr-model/keys
//                     was judged by /a/ocr-model's head-admin-only rule and organizer admins were
//                     turned away from a page the menu offered them)
//
// Labels: sections under adminNav.section.*, pages under adminNav.<navKey>, sub-pages under
// adminNav.sub.* (messages/{en,fr,pt}/adminNav.json, fr/pt by hand). Roles follow the gate each page
// or tab already enforces (head_admin and super_admin always pass, see canAccess in nav-main.tsx).
// ═════════════════════════════════════════════════════════════════════════════════════════════

export interface AdminNavSub {
  // key under adminNav.sub.*
  subKey: string;
  href: string;
  // narrower than the page's own gate; omitted = the page's roles
  allowedRoles?: string[];
}

export interface AdminNavLink {
  label: string;
  // i18n key under adminNav.json (t(navKey)); `label` is the English fallback
  navKey?: string;
  slug: string;
  icon: any;
  comingSoon?: boolean;
  allowedRoles?: string[]; // Optional: if omitted, all admins see it
  // Go-live day ("YYYY-MM-DD") for the shared self-expiring NEW tag (components/NewBadge.tsx)
  newSince?: string;
  subs?: AdminNavSub[];
}

export interface AdminNavSection {
  // key under adminNav.section.*
  sectionKey: string;
  items: AdminNavLink[];
}

const EVENTS_ROLES = ["head_admin", "event_admin"];

export const adminNavSections: AdminNavSection[] = [
  {
    sectionKey: "overview",
    items: [
      { label: "Dashboard", navKey: "dashboard", slug: "/a/dashboard", icon: IconHome, allowedRoles: ["head_admin"] },
    ],
  },
  {
    sectionKey: "competition",
    items: [
      // Events + Leaderboards are ONE page (owner 2026-06-09), tabs Events | Leaderboards | Designs.
      // Drafts (drafted events only) and Event Payments sit under it here (owner 2026-09-26) instead
      // of being a top-level entry and a header button.
      {
        label: "Events & Leaderboards",
        navKey: "eventsLeaderboards",
        slug: "/a/events",
        icon: IconCalendar,
        allowedRoles: EVENTS_ROLES,
        subs: [
          { subKey: "events", href: "/a/events?tab=events" },
          { subKey: "drafts", href: "/a/drafts", allowedRoles: ["head_admin"] },
          { subKey: "payments", href: "/a/events/payments" },
          { subKey: "leaderboards", href: "/a/events?tab=leaderboards" },
          { subKey: "designs", href: "/a/events?tab=designs" },
          { subKey: "createEvent", href: "/a/events/create" },
        ],
      },
      // Teams + Players ONE page (owner 2026-06-09) with Blacklists, Reports, Watchlist and Deleted
      // folded in as tabs; roles are the union and each tab keeps its own gate (TAB_DEFS in
      // app/(a)/a/teams/page.tsx), mirrored per sub-page below.
      {
        label: "Teams & Players",
        navKey: "teamsPlayers",
        slug: "/a/teams",
        icon: IconUsersGroup,
        allowedRoles: ["head_admin", "teams_admin", "event_admin", "organizer_admin"],
        subs: [
          { subKey: "teams", href: "/a/teams?tab=teams", allowedRoles: ["teams_admin"] },
          { subKey: "players", href: "/a/teams?tab=players", allowedRoles: ["teams_admin"] },
          { subKey: "reports", href: "/a/teams?tab=reports", allowedRoles: ["teams_admin"] },
          { subKey: "blacklists", href: "/a/teams?tab=blacklists", allowedRoles: ["teams_admin", "organizer_admin"] },
          { subKey: "watchlist", href: "/a/teams?tab=watchlist", allowedRoles: ["event_admin", "teams_admin", "organizer_admin"] },
          { subKey: "deleted", href: "/a/teams?tab=deleted", allowedRoles: ["head_admin"] },
        ],
      },
      { label: "Player Markets", navKey: "playerMarkets", slug: "/a/player-markets", icon: IconUsers, allowedRoles: ["head_admin"] },
      // Rankings: keep metrics_admin in sync with AuthContext.isAdmin / isAdminByRoleOrRoles. Its
      // sub-pages are the ones components/rankings/RankingsSubNav.tsx lists on the page itself.
      {
        label: "Rankings",
        navKey: "rankings",
        slug: "/a/rankings",
        icon: IconArticle,
        allowedRoles: ["head_admin", "metrics_admin"],
        subs: [
          { subKey: "rankingsOverview", href: "/a/rankings" },
          { subKey: "ladders", href: "/a/rankings/ladders" },
          { subKey: "scoringConfig", href: "/a/rankings/scoring-config" },
          { subKey: "tournamentTiers", href: "/a/rankings/tournament-tiers" },
          { subKey: "resultMarkers", href: "/a/rankings/results" },
          { subKey: "seasons", href: "/a/rankings/seasons" },
          { subKey: "ghostTeams", href: "/a/rankings/ghost-teams" },
          { subKey: "social", href: "/a/rankings/social" },
          { subKey: "prize", href: "/a/rankings/prize" },
          { subKey: "overrides", href: "/a/rankings/overrides" },
          { subKey: "rankingsAudit", href: "/a/rankings/audit" },
        ],
      },
      // OBS overlays (owner 2026-07-01), the event/leaderboard admins.
      { label: "Live Overlays", navKey: "liveOverlays", slug: "/a/overlays", icon: IconBroadcast, allowedRoles: EVENTS_ROLES },
    ],
  },
  {
    sectionKey: "community",
    items: [
      {
        label: "News",
        navKey: "news",
        slug: "/a/news",
        icon: IconNews,
        allowedRoles: ["head_admin", "news_admin"],
        subs: [
          { subKey: "allPosts", href: "/a/news" },
          { subKey: "writePost", href: "/a/news/create" },
        ],
      },
      // Polls replaced Votes (/a/votes redirects here); award ballots are a preset of a poll.
      { label: "Polls", navKey: "polls", slug: "/a/polls", icon: Award, allowedRoles: ["head_admin"] },
      // Every broadcast organizers and admins send (is_broadcast_admin on the backend).
      {
        label: "Broadcasts",
        navKey: "broadcasts",
        slug: "/a/broadcasts",
        icon: IconMessage,
        allowedRoles: ["head_admin", "event_admin", "organizer_admin", "metrics_admin"],
      },
      {
        label: "Referrals",
        navKey: "referrals",
        slug: "/a/referrals",
        icon: IconUserShare,
        allowedRoles: ["head_admin"],
        newSince: "2026-09-26",
        subs: [
          { subKey: "programs", href: "/a/referrals" },
          { subKey: "newProgram", href: "/a/referrals/new" },
        ],
      },
      // The support desk (owner 2026-09-14); its audit is head admins only.
      {
        label: "Support",
        navKey: "support",
        slug: "/a/support",
        icon: IconHeadset,
        allowedRoles: ["head_admin", "support_admin", "support"],
        subs: [
          { subKey: "tickets", href: "/a/support" },
          { subKey: "supportAudit", href: "/a/support/audit", allowedRoles: ["head_admin"] },
        ],
      },
    ],
  },
  {
    sectionKey: "commerce",
    items: [
      {
        label: "Shop",
        navKey: "shop",
        slug: "/a/shop",
        icon: IconShoppingCart,
        allowedRoles: ["head_admin", "shop_admin"],
        subs: [
          { subKey: "shopOverview", href: "/a/shop" },
          { subKey: "orders", href: "/a/shop/orders" },
          { subKey: "coupons", href: "/a/shop/coupons" },
          { subKey: "inventory", href: "/a/shop/inventory" },
          { subKey: "customers", href: "/a/shop/customers" },
          { subKey: "vendors", href: "/a/shop/vendors" },
          { subKey: "approvals", href: "/a/shop/approvals" },
          { subKey: "payouts", href: "/a/shop/payouts" },
        ],
      },
      {
        label: "Sponsors",
        navKey: "sponsors",
        slug: "/a/sponsors",
        icon: IconStar,
        allowedRoles: EVENTS_ROLES,
        subs: [
          { subKey: "allSponsors", href: "/a/sponsors" },
          { subKey: "addSponsor", href: "/a/sponsors/create" },
        ],
      },
    ],
  },
  {
    sectionKey: "partners",
    items: [
      {
        label: "Organizations",
        navKey: "organizations",
        slug: "/a/organizations",
        icon: IconUsersGroup,
        allowedRoles: ["head_admin", "organizer_admin"],
        subs: [
          { subKey: "allOrganizations", href: "/a/organizations" },
          { subKey: "orgPayouts", href: "/a/organizations/payouts" },
          { subKey: "orgReports", href: "/a/organizations/reports" },
        ],
      },
      // Partner API keys, Sign in with AFC, partner applications and Site Feedback (tabs, gated
      // per tab in app/(a)/a/partners/page.tsx). Roles are the union of those audiences.
      {
        label: "Partners & API Keys",
        navKey: "apiKeys",
        slug: "/a/partners",
        icon: IconPlugConnected,
        allowedRoles: ["head_admin", "partner_admin", "admin", "moderator", "support"],
      },
      // OCR Model (head admins) and OCR Keys (head admins + organizer admins) as one entry.
      {
        label: "OCR",
        navKey: "ocr",
        slug: "/a/ocr-model",
        icon: IconScan,
        allowedRoles: ["head_admin", "organizer_admin"],
        subs: [
          { subKey: "ocrModel", href: "/a/ocr-model", allowedRoles: ["head_admin"] },
          { subKey: "ocrKeys", href: "/a/ocr-model/keys", allowedRoles: ["head_admin", "organizer_admin"] },
        ],
      },
    ],
  },
  {
    sectionKey: "system",
    items: [
      // The Discord bot: head admins only (afc_bot.permissions.can_manage_bot).
      { label: "Bot", navKey: "bot", slug: "/a/bot", icon: IconRobot, allowedRoles: ["head_admin"], newSince: "2026-08-18" },
      // Settings; its Activities tab is the sitewide audit log (the old /a/history page redirects there).
      {
        label: "Settings",
        navKey: "settings",
        slug: "/a/settings",
        icon: IconSettings,
        allowedRoles: ["head_admin"],
        subs: [
          { subKey: "admins", href: "/a/settings?tab=admins" },
          { subKey: "allUsers", href: "/a/settings?tab=all-users" },
          { subKey: "roles", href: "/a/settings?tab=roles" },
          { subKey: "loginHistory", href: "/a/settings?tab=login-history" },
          { subKey: "history", href: "/a/settings?tab=activities" },
        ],
      },
      // Documentation only, no roles: an admin of any area may look something up.
      { label: "Help Center", navKey: "helpCenter", slug: "/a/help", icon: IconHelpCircle, newSince: "2026-08-06" },
    ],
  },
];

// "Switch to": ways out of the admin panel, in the sidebar footer (owner 2026-09-26).
export const adminSwitchLinks: AdminNavLink[] = [
  {
    label: "Player site",
    navKey: "playerSite",
    slug: "/home",
    icon: IconHome,
    allowedRoles: ["head_admin", "admin", "event_admin", "news_admin", "teams_admin", "shop_admin", "partner_admin"],
  },
  // The organizer's own portal, for admin-and-organizer users.
  { label: "Organizer Dashboard", navKey: "organizerDashboard", slug: "/organizer/overview", icon: IconBuilding, allowedRoles: ["organizer"] },
  { label: "Sponsor Dashboard", navKey: "sponsorDashboard", slug: "/a/sponsor-dashboard", icon: IconStar, allowedRoles: ["sponsor_admin"] },
];

// Route gates with a narrower rule than the page they sit under (ProtectedRoute, longest match).
const ROUTE_ONLY_RULES: AdminNavLink[] = adminNavSections.flatMap((section) =>
  section.items.flatMap((item) =>
    (item.subs ?? [])
      .filter((sub) => sub.allowedRoles && !sub.href.includes("?") && sub.href !== item.slug)
      .map((sub) => ({ label: sub.subKey, slug: sub.href, icon: item.icon, allowedRoles: sub.allowedRoles })),
  ),
);
// /a/ocr-model itself (the model page) is head-admin only even though the OCR entry is wider.
const OCR_MODEL_RULE: AdminNavLink = { label: "OCR Model", slug: "/a/ocr-model", icon: IconScan, allowedRoles: ["head_admin"] };

// Flat list for ProtectedRoute and the other readers of the old shape. Order does not matter any
// more: ProtectedRoute takes the longest matching slug.
export const adminNavLinks: AdminNavLink[] = [
  ...adminNavSections.flatMap((section) => section.items.filter((item) => item.slug !== "/a/ocr-model")),
  OCR_MODEL_RULE,
  ...ROUTE_ONLY_RULES,
  ...adminSwitchLinks,
];
