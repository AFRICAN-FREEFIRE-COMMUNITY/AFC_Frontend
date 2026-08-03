import {
  IconArticle,
  IconBroadcast,
  IconBuilding,
  IconCalendar,
  IconChartBarPopular,
  IconFolder,
  IconHome,
  IconInfoCircle,
  IconMessage,
  IconMessage2,
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
  { slug: "/about", label: "About Us", navKey: "about", icon: IconInfoCircle },
  { slug: "/contact", label: "Contact", navKey: "contact", icon: IconMessage },
  // Glossary sits under Contact in the hamburger menu (owner request 2026-06-10).
  { slug: "/glossary", label: "Glossary", navKey: "glossary", icon: IconVocabulary },
];
// Define the shape of our admin links for type safety
interface AdminNavLink {
  label: string;
  // i18n key under adminNav.json, resolved at render by components/nav-main.tsx via
  // useTranslations("adminNav") -> t(navKey). `label` stays as the English fallback for
  // any item that ever lacks a navKey. Add the matching key to messages/{en,fr,pt}/adminNav.json
  // whenever a new admin nav entry is added here.
  navKey?: string;
  slug: string;
  icon: any;
  comingSoon?: boolean;
  allowedRoles?: string[]; // Optional: if omitted, all admins see it
}

export const adminNavLinks: AdminNavLink[] = [
  {
    label: "Admin Dashboard",
    navKey: "dashboard",
    slug: "/a/dashboard",
    icon: IconHome,
    allowedRoles: ["head_admin"],
  },
  // Teams + Players are now ONE combined page (owner request 2026-06-09), and the
  // Blacklists + Watchlist dashboards were folded in as tabs (owner 2026-06-29), so this
  // ONE entry is the home for Teams | Players | Blacklists | Reports | Watchlist. /a/players,
  // /a/blacklists and /a/watchlist all redirect here with the matching ?tab= (next.config.ts).
  // allowedRoles is the UNION of every folded-in surface's old gate (teams_admin:
  // teams/players/reports; organizer_admin: blacklists; event_admin: watchlist) so no audience
  // loses access; the page itself shows each viewer only the tabs their roles allow (per-tab
  // gating in app/(a)/a/teams/page.tsx).
  {
    label: "Teams & Players",
    navKey: "teamsPlayers",
    slug: "/a/teams",
    icon: IconUsersGroup,
    allowedRoles: ["head_admin", "teams_admin", "event_admin", "organizer_admin"],
  },
  {
    slug: "/a/player-markets",
    label: "Player Markets",
    navKey: "playerMarkets",
    allowedRoles: ["head_admin"],
    icon: IconUsers,
  },
  // Player + team reports triage now lives UNDER "Teams & Players" as a Reports tab
  // (owner 2026-06-20), so there is no standalone sidebar entry. /a/player-reports
  // redirects to /a/teams?tab=reports for old links.
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
    navKey: "eventsLeaderboards",
    slug: "/a/events",
    icon: IconCalendar,
    allowedRoles: ["head_admin", "event_admin"],
  },
  {
    label: "Sponsors",
    navKey: "sponsors",
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
    navKey: "organizations",
    slug: "/a/organizations",
    icon: IconUsersGroup,
    allowedRoles: ["head_admin", "organizer_admin"],
  },
  // Blacklists (owner ask 2026-06-12) and Watchlist (owner 2026-06-21) were standalone sidebar
  // entries here; owner 2026-06-29 folded them UNDER the "Teams & Players" page as tabs
  // (?tab=blacklists / ?tab=watchlist), so their main-nav entries were removed. Access is
  // preserved via the broadened "Teams & Players" gate + per-tab role gating (see page.tsx);
  // old links redirect (next.config.ts). BlacklistsTable + WatchlistAdminContent live on under
  // app/(a)/a/blacklists/_components and app/(a)/a/watchlist/_components.
  {
    // Data-API partner management (afc_partner_api admin surface). Gated on
    // head_admin / partner_admin to match the backend's _is_partner_admin check
    // (role__role_name__in=["head_admin","partner_admin"]) - same team that runs
    // the partner program. IconPlugConnected reads as an external integration/API.
    // Sidebar label is "API Keys" (owner request 2026-06-09); the route stays /a/partners
    // (the afc_partner_api admin surface for issuing/managing partner API keys).
    label: "API Keys",
    navKey: "apiKeys",
    slug: "/a/partners",
    icon: IconPlugConnected,
    allowedRoles: ["head_admin", "partner_admin"],
  },
  {
    // Broadcasts audit (owner 2026-06-27): the cross-event admin view of EVERY broadcast organizers +
    // admins send to players (full content, time, sender, scope, recipient count). Page
    // app/(a)/a/broadcasts/page.tsx → GET /auth/all-broadcasts/. Gated to the SAME granular roles the
    // backend treats as broadcast admins (is_broadcast_admin: head_admin / event_admin /
    // organizer_admin / metrics_admin; head_admin always passes in canAccess), so the sidebar entry
    // matches who the endpoint actually lets in. IconMessage reads as the messaging/broadcast surface.
    label: "Broadcasts",
    navKey: "broadcasts",
    slug: "/a/broadcasts",
    icon: IconMessage,
    allowedRoles: ["head_admin", "event_admin", "organizer_admin", "metrics_admin"],
  },
  {
    // Site Feedback (owner backlog item 29, 2026-08-03): the INBOUND counterpart to Broadcasts
    // above, hence its position. Page app/(a)/a/feedback/page.tsx -> GET /feedback/admin/submissions/
    // (afc_feedback). It reads what visitors sent through the always-on form in the site footer.
    //
    // A standalone entry rather than a tab on an existing page (the repo's usual habit for triage
    // queues) because site feedback is not SCOPED to any one subject: a submission can be about the
    // shop, an event, the rankings or signing up, so no existing page owns it.
    //
    // allowedRoles mirrors afc_feedback.views.is_feedback_admin exactly: the granular head_admin
    // (super_admin and head_admin always pass in canAccess anyway) plus the COARSE admin / moderator
    // / support roles, which the backend also lets in and which canAccess matches from user.role.
    // Area admins (shop_admin, news_admin, ...) are deliberately excluded: platform-wide feedback is
    // not an area admin's queue.
    label: "Site Feedback",
    navKey: "siteFeedback",
    slug: "/a/feedback",
    icon: IconMessage2,
    allowedRoles: ["head_admin", "admin", "moderator", "support"],
  },
  {
    // OBS Overlays (owner 2026-07-01): the cross-event manager for the live-leaderboard browser
    // sources. Page app/(a)/a/overlays/page.tsx lists every event -> Copy OBS link (reused
    // CopyOverlayLinkDialog) + a jump to its leaderboard (results + BroadcastControl). Gated to the
    // event/leaderboard admins (same set that manages leaderboards).
    label: "Live Overlays",
    navKey: "liveOverlays",
    slug: "/a/overlays",
    icon: IconBroadcast,
    allowedRoles: ["head_admin", "event_admin"],
  },
  {
    label: "Admin News",
    navKey: "news",
    slug: "/a/news",
    icon: IconNews,
    allowedRoles: ["head_admin", "news_admin"],
  },
  // Admin Rankings is also gated app-wide in AuthContext.isAdmin /
  // isAdminByRoleOrRoles; keep metrics_admin in sync there or a metrics_admin-only
  // user sees this link but is not treated as admin elsewhere.
  {
    label: "Admin Rankings",
    navKey: "rankings",
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
    navKey: "ocrModel",
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
    navKey: "shop",
    slug: "/a/shop",
    icon: IconShoppingCart,
    allowedRoles: ["head_admin", "shop_admin"],
  },
  {
    label: "Votes",
    navKey: "votes",
    slug: "/a/votes",
    icon: Award,
    allowedRoles: ["head_admin"],
  },
  {
    label: "Drafts",
    navKey: "drafts",
    slug: "/a/drafts",
    icon: IconFolder,
    allowedRoles: ["head_admin"],
  },
  {
    label: "Settings",
    navKey: "settings",
    slug: "/a/settings",
    icon: IconSettings,
    allowedRoles: ["head_admin"],
  },
  {
    label: "Admin Partner Verification",
    navKey: "partnerVerification",
    slug: "/a/partner/roster-verification",
    icon: IconShield,
    comingSoon: true,
    allowedRoles: ["head_admin", "partner_admin"],
  },
  {
    label: "Sponsor Dashboard",
    navKey: "sponsorDashboard",
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
    navKey: "organizerDashboard",
    slug: "/organizer/overview",
    icon: IconBuilding,
    allowedRoles: ["organizer"],
  },
  {
    label: "Back to user dashboard",
    navKey: "backToUserDashboard",
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
