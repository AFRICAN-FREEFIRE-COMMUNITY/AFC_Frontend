import {
  IconArticle,
  IconCalendar,
  IconChartBarPopular,
  IconFolder,
  IconHome,
  IconInfoCircle,
  IconMessage,
  IconNews,
  IconSettings,
  IconShield,
  IconShoppingCart,
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

export const homeNavLinksMobile = [
  { slug: "/home", label: "Home", icon: IconHome, onlyMobile: false },
  { slug: "/teams", label: "Teams", icon: IconUsers },
  // {
  //   slug: "/leaderboards",
  //   label: "Leaderboards",
  //   icon: IconTrophy,
  // },
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
    comingSoon: true,
  },
  { slug: "/news", label: "News & Updates", icon: IconArticle },
  {
    slug: "/rules",
    label: "Rules",
    icon: IconArticle,
    newLink: true,
    addedAt: "2026-01-01",
  },
  {
    slug: "/shop",
    label: "Shop",
    icon: IconShoppingCart,
    // comingSoon: true,
    newLink: true,
    addedAt: "2026-02-04",
  },
  {
    slug: "/orders",
    label: "My Orders",
    icon: IconFolder,
    // comingSoon: true,
    newLink: true,
    addedAt: "2026-02-04",
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
    allowedRoles: ["head_admin", "admin"],
  },
  {
    label: "Admin Leaderboards",
    slug: "/a/leaderboards",
    icon: IconTrophy,
    allowedRoles: ["head_admin", "admin"],
  },
  {
    label: "Admin Players",
    slug: "/a/players",
    icon: IconUsers,
    comingSoon: true,
    allowedRoles: ["head_admin"],
  },
  {
    slug: "/a/player-markets",
    label: "Player Markets",
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
    label: "Admin News",
    slug: "/a/news",
    icon: IconNews,
    allowedRoles: ["head_admin", "news_admin"],
  },
  {
    label: "Admin Rankings",
    slug: "/a/rankings",
    icon: IconArticle,
    comingSoon: true,
    allowedRoles: ["head_admin"],
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
    label: "Back to user dashboard",
    slug: "/home",
    icon: IconHome,
    // No allowedRoles means everyone with admin access can see it
  },
];
