import {
  IconLayout,
  IconUserCheck,
  IconSchool,
  IconCalendar,
  IconBook,
  IconUsers,
  IconUserCog,
  IconShield,
  IconClipboardList,
  IconClock,
  IconCreditCard,
  IconChartHistogram,
  IconSettings,
  IconDownload,
  IconDeviceLaptop,
  IconDeviceImacUp,
  IconAlertCircle,
  IconFileDescription,
  IconMessage,
  IconServerBolt,
  IconUsersGroup,
  IconCurrencyDollar,
  IconChartInfographic,
  IconNotebook,
  IconTrendingUp,
  IconWallet,
  IconChalkboardTeacher,
  IconFileCertificate,
  IconFileText,
  IconHome,
  IconChartBarPopular,
  IconArticle,
  IconShoppingCart,
  IconInfoCircle,
  IconTrophy,
  IconNews,
} from "@tabler/icons-react";
import { Award, Shield } from "lucide-react";

export const countries = [
  "Algeria",
  "Angola",
  "Benin",
  "Botswana",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cameroon",
  "Central African Republic",
  "Chad",
  "Comoros",
  "Congo (Brazzaville)",
  "Congo (Kinshasa)",
  "Côte d’Ivoire",
  "Djibouti",
  "Egypt",
  "Equatorial Guinea",
  "Eritrea",
  "Eswatini",
  "Ethiopia",
  "Gabon",
  "Gambia",
  "Ghana",
  "Guinea",
  "Guinea-Bissau",
  "Kenya",
  "Lesotho",
  "Liberia",
  "Libya",
  "Madagascar",
  "Malawi",
  "Mali",
  "Mauritania",
  "Mauritius",
  "Morocco",
  "Mozambique",
  "Namibia",
  "Niger",
  "Nigeria",
  "Rwanda",
  "São Tomé and Príncipe",
  "Senegal",
  "Seychelles",
  "Sierra Leone",
  "Somalia",
  "South Africa",
  "South Sudan",
  "Sudan",
  "Tanzania",
  "Togo",
  "Tunisia",
  "Uganda",
  "Zambia",
  "Zimbabwe",
] as const;

export const DEFAULT_PROFILE_PICTURE =
  "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg";

export const newsCategories = [
  { value: "general", label: "General News" },
  { value: "tournament", label: "Tournament Updates" },
  { value: "bans", label: "Banned Player/Team Updates" },
  // { value: "maintenance", label: "Maintenance Updates" },
  // { value: "events", label: "Event Announcements" },
];

export const relatedEvents = [
  { value: "event1", label: "Summer Showdown 2024" },
  { value: "event2", label: "Fall Classic 2024" },
  { value: "event3", label: "Winter Cup 2024" },
  { value: "event4", label: "Spring Championship 2025" },
];

export const availableBanReasons = [
  {
    id: "conduct",
    label: "Conduct/Toxic Behavior",
    description:
      "Repeated instances of abusive language, harassment, or unsportsmanlike conduct",
  },
  {
    id: "cheating",
    label: "Cheating",
    description:
      "Use of unauthorized software, exploits, or other forms of cheating",
  },
  {
    id: "collusion",
    label: "Collusion",
    description:
      "Cooperating with other teams or players to gain an unfair advantage",
  },
  {
    id: "account_sharing",
    label: "Account Sharing",
    description:
      "Multiple players using the same account or a player using someone else's account",
  },
  {
    id: "confidentiality",
    label: "Breach of Confidentiality",
    description:
      "Sharing confidential information about tournaments, scrims, or other teams",
  },
];

export const homeNavLinks = [
  { slug: "/home", label: "Home", icon: IconHome },
  { slug: "/teams", label: "Teams", icon: IconUsers },
  { slug: "/news", label: "News", icon: IconArticle },
  { slug: "/awards", label: "Awards", icon: Award },
];

export const homeNavLinksMobile = [
  { slug: "/home", label: "Home", icon: IconHome, onlyMobile: false },
  { slug: "/teams", label: "Teams", icon: IconUsers },
  {
    slug: "/tournaments-and-scrims",
    label: "Tournaments & Scrims",
    icon: IconCalendar,
    comingSoon: true,
  },
  {
    slug: "/rankings",
    label: "Rankings & Tiers",
    icon: IconChartBarPopular,
    comingSoon: true,
  },
  { slug: "/news", label: "News & Updates", icon: IconArticle },
  {
    slug: "/shop",
    label: "Shop",
    icon: IconShoppingCart,
    comingSoon: true,
  },
  { slug: "/awards", label: "Awards", icon: Award },
  { slug: "/about", label: "About Us", icon: IconInfoCircle },
  { slug: "/contact", label: "Contact", icon: IconMessage },
];

export const adminNavLinks = [
  { label: "Admin Dashboard", slug: "/a/dashboard", icon: IconHome },
  {
    label: "Admin Leaderboards",
    slug: "/a/leaderboards",
    icon: IconTrophy,
    comingSoon: true,
  },
  {
    label: "Admin Players",
    slug: "/a/players",
    icon: IconUsers,
    comingSoon: true,
  },
  { label: "Admin Teams", slug: "/a/teams", icon: IconUsersGroup },
  {
    label: "Admin Events",
    slug: "/a/events",
    icon: IconCalendar,
    comingSoon: true,
  },
  { label: "Admin News", slug: "/a/news", icon: IconNews },
  {
    label: "Admin Rankings",
    slug: "/a/rankings",
    icon: IconArticle,
    comingSoon: true,
  },
  {
    label: "Admin Tiers",
    slug: "/a/tiers",
    icon: Shield,
    comingSoon: true,
  },
  {
    label: "Admin Shop",
    slug: "/a/shop",
    icon: IconShoppingCart,
    comingSoon: true,
  },
  { label: "Admin Votes", slug: "/a/votes", icon: Award },
  {
    label: "Admin History",
    slug: "/a/history",
    icon: IconChartBarPopular,
    comingSoon: true,
  },
  {
    label: "Settings",
    slug: "/a/settings",
    icon: IconSettings,
  },
  {
    label: "Admin Partner Verification",
    slug: "/a/partner/roster-verification",
    icon: IconShield,
    comingSoon: true,
  },
  {
    label: "Back to user dashboard",
    slug: "/home",
    icon: IconHome,
  },
];
