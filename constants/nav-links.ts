import {
  IconArticle,
  IconBuilding,
  IconCalendar,
  IconChartBarPopular,
  IconFolder,
  IconHome,
  IconInfoCircle,
  IconMessage,
  IconNews,
  IconPhoto,
  IconPlugConnected,
  IconSettings,
  IconShield,
  IconShoppingCart,
  IconStar,
  IconTrophy,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";
import { Award } from "lucide-react";

export const homeNavLinks = [
  { slug: "/home", label: "Home", icon: IconHome },
  { slug: "/teams", label: "Teams", icon: IconUsers },
  { slug: "/news", label: "News", icon: IconArticle },
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
    comingSoon: boolean;
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
    comingSoon: true,
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
    // comingSoon: true,
    items: [
      {
        title: "Shop",
        slug: "/shop",
        icon: IconShoppingCart,
        comingSoon: true,
      },
      {
        title: "My Orders",
        slug: "/orders",
        icon: IconFolder,
        comingSoon: true,
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
  {
    label: "Admin Leaderboards",
    slug: "/a/leaderboards",
    icon: IconTrophy,
    allowedRoles: ["head_admin"],
  },
  {
    label: "Admin Players",
    slug: "/a/players",
    icon: IconUsers,
    allowedRoles: ["head_admin"],
  },
  {
    slug: "/a/player-markets",
    label: "Player Markets",
    allowedRoles: ["head_admin"],
    icon: IconUsers,
  },
  {
    label: "Admin Teams",
    slug: "/a/teams",
    icon: IconUsersGroup,
    allowedRoles: ["teams_admin", "head_admin"],
  },
  {
    label: "Admin Events",
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
    label: "Organizations",
    slug: "/a/organizations",
    icon: IconUsersGroup,
    allowedRoles: ["head_admin", "organizer_admin"],
  },
  {
    // AFC review queue for organizer leaderboard-design requests. Gated the same
    // way as Organizations (head_admin + organizer_admin) since it's the same team.
    label: "Design Requests",
    slug: "/a/organizations/design-requests",
    icon: IconPhoto,
    allowedRoles: ["head_admin", "organizer_admin"],
  },
  {
    // AFC review queue for user-submitted reports against organizations (rankings
    // manipulation, fake results, …). Same gating as Organizations / Design Requests
    // (head_admin + organizer_admin) since the same team triages org integrity.
    // Reuses IconShield (already imported) to read as an integrity/moderation tool.
    label: "Org Reports",
    slug: "/a/organizations/reports",
    icon: IconShield,
    allowedRoles: ["head_admin", "organizer_admin"],
  },
  {
    // Data-API partner management (afc_partner_api admin surface). Gated on
    // head_admin / partner_admin to match the backend's _is_partner_admin check
    // (role__role_name__in=["head_admin","partner_admin"]) - same team that runs
    // the partner program. IconPlugConnected reads as an external integration/API.
    label: "Partners",
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
