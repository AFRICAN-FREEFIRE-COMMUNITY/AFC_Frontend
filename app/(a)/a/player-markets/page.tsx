"use client";

import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
// The System Health card reports the LIVE transfer window rather than asserting one, so it reads
// the same public season endpoint as /rankings. Calendar dates go through formatLocalDateOnly.
import { rankingsApi, Season } from "@/lib/rankings";
// i18n: every user-facing string on this page comes from the adminPlayerMarket namespace
// (messages/{en,fr,pt}/adminPlayerMarket.json) via useTranslations("adminPlayerMarket").
// Dates render in the VIEWER's timezone + language, and WHICH helper depends on the field:
//  - bare Django DateFields (post expiry is afc_player_market.post_expiry_date) -> the string
//    helper formatLocalDateOnly, because a date-only value is a floating calendar date and the
//    datetime path would read it as midnight UTC and print the previous day west of London;
//  - real UTC instants (applied_at / updated_at / invite_expires_at / created_at / sent_at) ->
//    the <LocalTime/> COMPONENT, which is the canonical form for visible page text: it is
//    hydration-safe (mount-gated placeholder) and emits a semantic <time dateTime>.
import { formatLocalDateOnly } from "@/lib/i18n/time";
import { LocalTime } from "@/components/LocalTime";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { InfoTip } from "@/components/ui/info-tip";
import {
  IconUsers,
  IconUser,
  IconSearch,
  IconEye,
  IconClock,
  IconAlertTriangle,
  IconFileText,
  IconShield,
  IconCircleCheck,
  IconClipboardList,
  IconMessage,
  IconLoader2,
} from "@tabler/icons-react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { env } from "@/lib/env";
// Shared site-wide search matcher (punctuation/font/accent-insensitive). Replaces
// the old .toLowerCase().includes() filters on this page's listing tables.
import { matchesSearch } from "@/lib/search";
// Player-market moderation API + Ban dialog (feature "J-market-reporting").
import {
  playerMarketApi,
  type MarketReportRow,
} from "@/lib/playerMarket";
import { MarketBanDialog } from "./_components/MarketBanDialog";
import { IconBan, IconFlag } from "@tabler/icons-react";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface ApplicationReceived {
  playerName: string;
  tier: string;
  role: string;
  appliedDate: string;
  status: "Pending" | "Under Review" | "Accepted" | "Rejected";
}

interface MockTeamListing {
  id: string;
  teamName: string;
  verified: boolean;
  tier: string;
  rolesNeeded: string[];
  description: string;
  requirements: string;
  recentPerformance: string;
  applications: number;
  postedDate: string;
  expiryDate: string;
  status: "Active" | "Suspended";
  applicationsReceived: ApplicationReceived[];
}

interface InvitationReceived {
  teamName: string;
  role: string;
  invitedDate: string;
  status: "Pending" | "Declined" | "Accepted";
}

interface MockPlayerListing {
  id: string;
  ign: string;
  verified: boolean;
  flagged: boolean;
  tier: string;
  primaryRole: string;
  secondaryRole: string;
  bio: string;
  availability: string;
  achievements: string;
  invitations: number;
  postedDate: string;
  expiryDate: string;
  status: "Active" | "Hidden";
  invitationsReceived: InvitationReceived[];
}

interface TrialEvent {
  title: string;
  description: string;
  date: string;
  color: string;
}

interface MockTrial {
  id: string;
  player: string;
  team: string;
  status: "Ongoing" | "Accepted" | "Cancelled";
  daysRemaining: number;
  startDate: string;
  events: TrialEvent[];
}

interface MockReport {
  id: string;
  reportedBy: string;
  reportedEntity: string;
  entityType: string;
  date: string;
  severity: "High" | "Medium" | "Low";
  status: "Pending" | "Under Review" | "Resolved";
  reason: string;
  description: string;
  evidenceCount: number;
  previousReportsCount: number;
}

// ─── Trials & Applications API Types ─────────────────────────────────────────

interface TrialPlayer {
  id: number;
  username: string;
  uid: string;
  discord: string | null;
  is_banned: boolean;
}

interface TrialTeam {
  id: number;
  name: string;
  tag: string | null;
  tier: string;
}

interface TrialPost {
  id: number;
  post_type: "TEAM_RECRUITMENT" | "PLAYER_AVAILABLE";
  roles_needed: string[] | null;
  commitment_type: string;
}

interface TrialApplication {
  id: number;
  status: string;
  applied_at: string;
  updated_at: string;
  reason: string | null;
  invite_expires_at: string | null;
  contact_unlocked: boolean;
  chat_id: number | null;
  player: TrialPlayer;
  team: TrialTeam;
  post: TrialPost;
}

interface TrialsAndApplicationsResponse {
  summary: { status: string; count: number }[];
  total: number;
  applications: TrialApplication[];
}

// ─── Admin Trial-Chat Read Types (feature "K-admin-chat-read") ───────────────
// Shapes returned by GET /player-market/trial-chat/messages/?chat_id=<id>. AFC staff
// (admin/moderator) may READ any trial chat for oversight; the backend keeps posting
// participant-only, so this admin surface is strictly read-only (no send box). The
// same endpoint powers the user-side TrialChatSidebar, so these mirror its types.
interface TrialChatMessage {
  id: number;
  sender: string; // sender's full username (never truncated in the UI)
  sender_id: number;
  message: string;
  sent_at: string;
}

interface TrialChatConversation {
  chat_id: number;
  application_id: number;
  status: string;
  team: string;
  team_logo: string | null;
  player: string;
  messages: TrialChatMessage[];
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const mockTeamListings: MockTeamListing[] = [
  {
    id: "TL001",
    teamName: "Team Alpha",
    verified: true,
    tier: "Tier 1",
    rolesNeeded: ["IGL", "Rusher"],
    description:
      "Looking for experienced players to join our competitive roster",
    requirements: "Must have 2+ years experience, Discord required",
    recentPerformance: "2nd Place in AFC Championship 2024",
    applications: 12,
    postedDate: "2024-07-15",
    expiryDate: "2024-10-15",
    status: "Active",
    applicationsReceived: [
      {
        playerName: "ProSniper99",
        tier: "Tier 2",
        role: "IGL",
        appliedDate: "2024-07-16",
        status: "Pending",
      },
      {
        playerName: "RushKing",
        tier: "Tier 1",
        role: "Rusher",
        appliedDate: "2024-07-17",
        status: "Under Review",
      },
      {
        playerName: "ShadowX",
        tier: "Tier 2",
        role: "IGL",
        appliedDate: "2024-07-18",
        status: "Accepted",
      },
    ],
  },
  {
    id: "TL002",
    teamName: "Phoenix Squad",
    verified: true,
    tier: "Tier 2",
    rolesNeeded: ["Support", "Sniper"],
    description:
      "Growing team looking for dedicated support and sniper players",
    requirements: "Active daily, willing to practice weekends",
    recentPerformance: "Quarter-finals in Regional Cup 2024",
    applications: 8,
    postedDate: "2024-07-20",
    expiryDate: "2024-10-20",
    status: "Active",
    applicationsReceived: [
      {
        playerName: "AimBot_NG",
        tier: "Tier 2",
        role: "Sniper",
        appliedDate: "2024-07-21",
        status: "Pending",
      },
      {
        playerName: "HealerPro",
        tier: "Tier 3",
        role: "Support",
        appliedDate: "2024-07-22",
        status: "Accepted",
      },
    ],
  },
  {
    id: "TL003",
    teamName: "Elite Warriors",
    verified: false,
    tier: "Tier 1",
    rolesNeeded: ["Fragger"],
    description: "Elite competitive team seeking top fragger talent",
    requirements: "Tournament experience mandatory, must be Tier 1+",
    recentPerformance: "Winners of Spring Invitational 2024",
    applications: 15,
    postedDate: "2024-06-10",
    expiryDate: "2024-09-10",
    status: "Suspended",
    applicationsReceived: [
      {
        playerName: "FragMaster",
        tier: "Tier 1",
        role: "Fragger",
        appliedDate: "2024-06-15",
        status: "Rejected",
      },
    ],
  },
];

interface TeamRecruitmentPost {
  id: number;
  team: string | null;
  countries: string[];
  roles_needed: string[] | null;
  minimum_tier_required: string;
  commitment_type: string;
  expiry: string;
}

interface PlayerAvailabilityPost {
  id: number;
  player: string;
  country: string | null;
  primary_role: string;
  secondary_role: string;
  availability_type: string;
  additional_info: string;
  expiry: string;
}

const mockPlayerListings: MockPlayerListing[] = [
  {
    id: "PL001",
    ign: "ShadowKing",
    verified: true,
    flagged: false,
    tier: "Tier 1",
    primaryRole: "IGL",
    secondaryRole: "Support",
    bio: "Experienced IGL with 3+ years competitive experience",
    availability: "Weekends and evenings",
    achievements: "AFC Championship 2023 Winner, 5x Tournament MVP",
    invitations: 5,
    postedDate: "2024-07-18",
    expiryDate: "2024-10-18",
    status: "Active",
    invitationsReceived: [
      {
        teamName: "Team Alpha",
        role: "IGL",
        invitedDate: "2024-07-19",
        status: "Pending",
      },
      {
        teamName: "Phoenix Squad",
        role: "IGL",
        invitedDate: "2024-07-20",
        status: "Declined",
      },
      {
        teamName: "Elite Warriors",
        role: "Support",
        invitedDate: "2024-07-21",
        status: "Accepted",
      },
    ],
  },
  {
    id: "PL002",
    ign: "BlazeMaster",
    verified: true,
    flagged: false,
    tier: "Tier 2",
    primaryRole: "Rusher",
    secondaryRole: "Fragger",
    bio: "Aggressive player with high kill rate and clutch potential",
    availability: "Full-time, any day",
    achievements: "Regional Cup 2024 Semi-finalist, Top 10 ranked",
    invitations: 3,
    postedDate: "2024-07-22",
    expiryDate: "2024-10-22",
    status: "Active",
    invitationsReceived: [
      {
        teamName: "Storm Riders",
        role: "Rusher",
        invitedDate: "2024-07-23",
        status: "Pending",
      },
    ],
  },
  {
    id: "PL003",
    ign: "IceCold",
    verified: false,
    flagged: true,
    tier: "Tier 2",
    primaryRole: "Sniper",
    secondaryRole: "Flex",
    bio: "Long-range specialist looking for competitive team",
    availability: "Weekdays only",
    achievements: "Community tournament winner 2023",
    invitations: 7,
    postedDate: "2024-07-05",
    expiryDate: "2024-10-05",
    status: "Hidden",
    invitationsReceived: [
      {
        teamName: "Viper Squad",
        role: "Sniper",
        invitedDate: "2024-07-10",
        status: "Accepted",
      },
      {
        teamName: "Night Owls",
        role: "Flex",
        invitedDate: "2024-07-12",
        status: "Declined",
      },
    ],
  },
];

const mockTrials: MockTrial[] = [
  {
    id: "TR001",
    player: "ShadowKing",
    team: "Team Alpha",
    status: "Ongoing",
    daysRemaining: 5,
    startDate: "2024-07-25",
    events: [
      {
        title: "Trial initiated",
        description: "Player accepted trial invitation",
        date: "2024-07-25",
        color: "bg-blue-500",
      },
      {
        title: "First scrim completed",
        description: "Performance: 12 kills, 2nd place",
        date: "2024-07-26",
        color: "bg-green-500",
      },
      {
        title: "Team meeting held",
        description: "Discussion about team chemistry",
        date: "2024-07-28",
        color: "bg-purple-500",
      },
    ],
  },
  {
    id: "TR002",
    player: "BlazeMaster",
    team: "Phoenix Squad",
    status: "Ongoing",
    daysRemaining: 10,
    startDate: "2024-07-22",
    events: [
      {
        title: "Trial initiated",
        description: "Player accepted trial invitation",
        date: "2024-07-22",
        color: "bg-blue-500",
      },
      {
        title: "Practice session completed",
        description: "Team drills and strategy review",
        date: "2024-07-23",
        color: "bg-green-500",
      },
    ],
  },
  {
    id: "TR003",
    player: "QuickShot",
    team: "Elite Warriors",
    status: "Accepted",
    daysRemaining: 0,
    startDate: "2024-07-10",
    events: [
      {
        title: "Trial initiated",
        description: "Player accepted trial invitation",
        date: "2024-07-10",
        color: "bg-blue-500",
      },
      {
        title: "Trial completed",
        description: "All objectives met",
        date: "2024-07-20",
        color: "bg-green-500",
      },
      {
        title: "Player accepted to roster",
        description: "Officially joined the team",
        date: "2024-07-21",
        color: "bg-emerald-500",
      },
    ],
  },
];

const mockReports: MockReport[] = [
  {
    id: "R001",
    reportedBy: "Team Beta",
    reportedEntity: "ShadowKing (Player)",
    entityType: "Player",
    date: "2024-07-23",
    severity: "High",
    status: "Pending",
    reason: "Harassment during trial",
    description:
      "Player used inappropriate language in team chat during trial period",
    evidenceCount: 3,
    previousReportsCount: 2,
  },
  {
    id: "R002",
    reportedBy: "Player123",
    reportedEntity: "Elite Warriors (Team)",
    entityType: "Team",
    date: "2024-07-20",
    severity: "Medium",
    status: "Under Review",
    reason: "Fake listing / misleading requirements",
    description:
      "Team posted listing with false tournament results and misleading skill requirements",
    evidenceCount: 1,
    previousReportsCount: 0,
  },
  {
    id: "R003",
    reportedBy: "Admin System",
    reportedEntity: "IceCold (Player)",
    entityType: "Player",
    date: "2024-07-15",
    severity: "Low",
    status: "Resolved",
    reason: "Expired listing still showing",
    description:
      "System flagged a listing that remained visible past its expiry date",
    evidenceCount: 0,
    previousReportsCount: 1,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Active":
      return "default";
    case "Suspended":
      return "destructive";
    case "Hidden":
      return "destructive";
    case "Pending":
      return "outline";
    case "Under Review":
      return "secondary";
    case "Resolved":
      return "outline";
    case "Ongoing":
      return "secondary";
    case "Accepted":
      return "outline";
    case "Rejected":
      return "destructive";
    case "Declined":
      return "destructive";
    default:
      return "secondary";
  }
}

function getSeverityVariant(
  severity: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (severity) {
    case "High":
      return "destructive";
    case "Medium":
      return "secondary";
    case "Low":
      return "outline";
    default:
      return "secondary";
  }
}

/** Derive a display status from expiry date */
function getListingStatus(expiry: string): "Active" | "Expired" {
  return new Date(expiry) >= new Date() ? "Active" : "Expired";
}

/** Color classes for trial/application statuses */
function getTrialStatusColor(status: string): string {
  switch (status) {
    case "PENDING":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    case "SHORTLISTED":
      return "bg-cyan-500/10 text-cyan-500 border-cyan-500/20";
    case "INVITED":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "TRIAL_ONGOING":
      return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
    case "ACCEPTED":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "TRIAL_EXTENDED":
      return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    case "REJECTED":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/** Format enum-style strings to title case: "TIER_1" → "Tier 1" */
function formatEnum(value: string): string {
  if (!value) return "-";
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Market-report label sets + badges (feature "J-market-reporting") ─────────
// The MarketReport categories/statuses, the trial-application statuses and the post types
// are CLOSED sets mirroring the backend choices, so their human labels are translated from
// the adminPlayerMarket namespace (reportCategory.* / reportStatus.* / trialStatus.* /
// postType.*). Membership is checked against these lists first so any value the backend
// adds later degrades to the raw string instead of a missing-translation error.
const REPORT_CATEGORIES = ["bad_tryout", "scam", "abusive", "fake_post", "other"];
const REPORT_STATUSES = ["open", "reviewing", "resolved", "dismissed", "banned"];
const TRIAL_STATUSES = [
  "PENDING",
  "SHORTLISTED",
  "INVITED",
  "TRIAL_ONGOING",
  "ACCEPTED",
  "TRIAL_EXTENDED",
  "REJECTED",
];
const POST_TYPES = ["TEAM_RECRUITMENT", "PLAYER_AVAILABLE"];

// Outline status badge, colour-coded per the mockup: open=yellow (unhandled),
// reviewing=cyan, resolved=green, dismissed=muted, banned=red.
function ReportStatusBadge({ status }: { status: string }) {
  const t = useTranslations("adminPlayerMarket");
  const colour: Record<string, string> = {
    open: "border-yellow-500/50 text-yellow-500",
    reviewing: "border-cyan-500/50 text-cyan-400",
    resolved: "border-green-600/60 text-green-400",
    dismissed: "text-muted-foreground",
    banned: "border-red-500/60 text-red-400",
  };
  return (
    <Badge variant="outline" className={`rounded-full ${colour[status] ?? ""}`}>
      {REPORT_STATUSES.includes(status) ? t(`reportStatus.${status}`) : status}
    </Badge>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AdminPlayerMarketPage() {
  const { token } = useAuth();
  // i18n: single namespace for this whole admin surface (see messages/en/adminPlayerMarket.json).
  const t = useTranslations("adminPlayerMarket");
  // Closed-set label helpers (see the REPORT_CATEGORIES / TRIAL_STATUSES lists above): translate a
  // known backend enum value, otherwise fall back to the raw / title-cased value.
  const categoryLabel = (c: string) =>
    REPORT_CATEGORIES.includes(c) ? t(`reportCategory.${c}`) : c;
  const trialStatusLabel = (s: string) =>
    TRIAL_STATUSES.includes(s) ? t(`trialStatus.${s}`) : formatEnum(s);
  const postTypeLabel = (p: string) =>
    POST_TYPES.includes(p) ? t(`postType.${p}`) : formatEnum(p);
  const [activeTab, setActiveTab] = useState("overview");

  // Team Listings state
  const [teamSearch, setTeamSearch] = useState("");
  const [teamStatusFilter, setTeamStatusFilter] = useState("all");

  // Player Listings state
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerStatusFilter, setPlayerStatusFilter] = useState("all");

  // Suspend modal state
  const [suspendModal, setSuspendModal] = useState<{
    open: boolean;
    listingId: string | null;
    listingType: "team" | "player";
  }>({ open: false, listingId: null, listingType: "team" });
  const [suspendReason, setSuspendReason] = useState("");

  // Trials state (mock - kept for any legacy usage)
  const [viewTrial, setViewTrial] = useState<MockTrial | null>(null);

  // Trials & Applications (real API)
  const [trialsData, setTrialsData] =
    useState<TrialsAndApplicationsResponse | null>(null);
  const [trialsLoading, setTrialsLoading] = useState(true);
  const [trialsSearch, setTrialsSearch] = useState("");
  const [trialsStatusFilter, setTrialsStatusFilter] = useState("all");
  const [selectedApplication, setSelectedApplication] =
    useState<TrialApplication | null>(null);

  // ── Admin trial-chat reader (feature "K-admin-chat-read") ────────────────────
  // READ-ONLY view of any trial conversation. Triggered by the "Read Chat" button on
  // a Trials & Applications row that has a chat_id. `chatContext` holds the row's
  // team/player labels so the dialog header reads correctly even before the messages
  // land; `chatConversation` holds the fetched conversation. There is deliberately no
  // message-input state here: staff observe, they do not post (the backend send
  // endpoint stays participant-only).
  const [chatContext, setChatContext] = useState<{
    chatId: number;
    team: string;
    player: string;
  } | null>(null);
  const [chatConversation, setChatConversation] =
    useState<TrialChatConversation | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  // Open the read-only chat dialog for a given application row and fetch its messages
  // from GET /player-market/trial-chat/messages/?chat_id=<id> with the admin's Bearer
  // token (same auth the rest of this page uses via useAuth()).
  const openChat = (app: TrialApplication) => {
    if (!app.chat_id) return; // guarded; the button is hidden when chat_id is null
    setChatContext({
      chatId: app.chat_id,
      team: app.team.name,
      player: app.player.username,
    });
    setChatConversation(null);
    setChatLoading(true);
    axios
      .get<TrialChatConversation>(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/trial-chat/messages/?chat_id=${app.chat_id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .then((res) => setChatConversation(res.data))
      .catch((err) =>
        toast.error(
          err?.response?.data?.message || t("chatDialog.loadFailed"),
        ),
      )
      .finally(() => setChatLoading(false));
  };

  // Close + reset the chat reader.
  const closeChat = () => {
    setChatContext(null);
    setChatConversation(null);
    setChatLoading(false);
  };

  // Reports state (legacy mock - kept only for any stray references; the real queue
  // below replaces the Reports & Flags tab).
  const [viewReport, setViewReport] = useState<MockReport | null>(null);
  const [reportAction, setReportAction] = useState("");

  // ── Real market-report queue (feature "J-market-reporting") ──────────────────
  const [reports, setReports] = useState<MarketReportRow[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportSearch, setReportSearch] = useState("");
  const [reportStatusFilter, setReportStatusFilter] = useState("all");
  const [reportCatFilter, setReportCatFilter] = useState("all");
  // Resolve dialog: the report whose status/notes the moderator is editing.
  const [resolveTarget, setResolveTarget] = useState<MarketReportRow | null>(
    null,
  );
  const [resolveStatus, setResolveStatus] = useState("open");
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolveSaving, setResolveSaving] = useState(false);
  // Ban dialog: the report a ban is being actioned from (bans the REPORTED subject).
  const [banTarget, setBanTarget] = useState<MarketReportRow | null>(null);

  // ── Ban-the-REPORTER flow (feature "J-market-rules", J5) ─────────────────────
  // When a report is judged false / abusive, the moderator can ban the REPORTER (not
  // the reported subject) from the market. Reuses the same admin_market_ban endpoint
  // with scope="player" + target_id = report.reporter_id (exposed by _serialize_report).
  // A small confirm dialog collects the reason; the ban is permanent by default here
  // (duration_days omitted -> permanent), matching how the main Ban dialog treats a
  // serious violation, but the reason is editable so the moderator owns the wording.
  const [banReporterTarget, setBanReporterTarget] =
    useState<MarketReportRow | null>(null);
  const [banReporterReason, setBanReporterReason] = useState("");
  const [banReporterSaving, setBanReporterSaving] = useState(false);

  // Open the confirm dialog seeded with a sensible default reason.
  const openBanReporter = (row: MarketReportRow) => {
    setBanReporterTarget(row);
    setBanReporterReason(t("banReporterDialog.defaultReason"));
  };

  // Ban the reporter via admin_market_ban (scope player, target = reporter id). On
  // success we also stamp the originating report "dismissed" so the queue reflects that
  // the report was rejected and the reporter actioned.
  const confirmBanReporter = async () => {
    if (!banReporterTarget || banReporterSaving) return;
    const reporterId = banReporterTarget.reporter_id;
    if (!reporterId) {
      toast.error(t("banReporterDialog.noReporter"));
      return;
    }
    if (!banReporterReason.trim()) {
      toast.error(t("banReporterDialog.reasonRequired"));
      return;
    }
    setBanReporterSaving(true);
    try {
      // Permanent ban (duration_days omitted). report_id is NOT passed so the report is
      // not flagged "banned" (that status means the SUBJECT was banned); we mark the
      // report "dismissed" separately below to show it was rejected.
      await playerMarketApi.adminBan({
        scope: "player",
        target_id: reporterId,
        reason: banReporterReason.trim(),
      });
      await playerMarketApi.adminUpdateReport(banReporterTarget.id, {
        status: "dismissed",
        resolution_notes: `Reporter (${banReporterTarget.reporter_username ?? "unknown"}) banned for a false/abusive report. ${banReporterReason.trim()}`,
      });
      toast.success(
        t("banReporterDialog.banned", {
          reporter: banReporterTarget.reporter_username ?? "",
        }),
      );
      setBanReporterTarget(null);
      fetchReports();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || t("banReporterDialog.banFailed"),
      );
    } finally {
      setBanReporterSaving(false);
    }
  };

  // Fetch the report queue. Server-side filters (status/category/search). The endpoint
  // returns { results, total_count, has_more }; this tab shows the first page (the
  // mockup is a single dense table) and filters server-side on change.
  const fetchReports = async () => {
    if (!token) return;
    setReportsLoading(true);
    try {
      const res = await playerMarketApi.adminListReports({
        status: reportStatusFilter !== "all" ? reportStatusFilter : undefined,
        category: reportCatFilter !== "all" ? reportCatFilter : undefined,
        search: reportSearch.trim() || undefined,
        limit: 100,
      });
      setReports(res?.results ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("reports.loadFailed"));
    } finally {
      setReportsLoading(false);
    }
  };

  // Refetch when the moderator changes a filter / search (and on first auth).
  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, reportStatusFilter, reportCatFilter, reportSearch]);

  // ── the live transfer window, for the System Health card ──
  // That card used to print a hardcoded "Open" badge with nothing behind it, so it read as Open
  // on a day the window had been shut for weeks. This is the same public endpoint the /rankings
  // banner and the admin rankings card read (unauthenticated on purpose, it is public data), so
  // all three now agree. Null while loading, and if the request fails the card says so rather
  // than inventing a state.
  const [transferSeason, setTransferSeason] = useState<Season | null>(null);
  const [transferSeasonFailed, setTransferSeasonFailed] = useState(false);
  useEffect(() => {
    rankingsApi
      .currentSeason()
      .then((s) => setTransferSeason(s))
      .catch(() => setTransferSeasonFailed(true));
  }, []);

  // Open the Resolve dialog seeded with the row's current status + notes.
  const openResolve = (row: MarketReportRow) => {
    setResolveTarget(row);
    setResolveStatus(row.status);
    setResolveNotes(row.resolution_notes ?? "");
  };

  // Save status + resolution_notes for the targeted report (PATCH).
  const saveResolve = async () => {
    if (!resolveTarget || resolveSaving) return;
    setResolveSaving(true);
    try {
      await playerMarketApi.adminUpdateReport(resolveTarget.id, {
        status: resolveStatus,
        resolution_notes: resolveNotes.trim(),
      });
      toast.success(t("resolveDialog.updated"));
      setResolveTarget(null);
      fetchReports();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || t("resolveDialog.updateFailed"),
      );
    } finally {
      setResolveSaving(false);
    }
  };

  // Count of open reports for the overview stat + tab feel.
  const openReportsCount = reports.filter((r) => r.status === "open").length;

  const [teamListings, setTeamListings] = useState<TeamRecruitmentPost[]>([]);
  const [playerListings, setPlayerListings] = useState<
    PlayerAvailabilityPost[]
  >([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [playerLoading, setPlayerLoading] = useState(true);

  useEffect(() => {
    fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-team-recruitment-posts/`,
    )
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: TeamRecruitmentPost[]) => setTeamListings(data))
      .catch(() => toast.error(t("teamListings.loadFailed")))
      .finally(() => setTeamLoading(false));

    fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-player-availability-posts/`,
    )
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: PlayerAvailabilityPost[]) => setPlayerListings(data))
      .catch(() => toast.error(t("playerListings.loadFailed")))
      .finally(() => setPlayerLoading(false));

    if (token) {
      axios
        .get<TrialsAndApplicationsResponse>(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/admin/all-trials-and-applications/`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        .then((res) => setTrialsData(res.data))
        .catch(() => toast.error(t("trials.loadFailed")))
        .finally(() => setTrialsLoading(false));
    }
  }, [token]);

  // Overview stats - team/player from real data, trials from real API
  const activeTeamListings = teamListings.filter(
    (t) => getListingStatus(t.expiry) === "Active",
  ).length;
  const activePlayerListings = playerListings.filter(
    (p) => getListingStatus(p.expiry) === "Active",
  ).length;
  const activeTrials =
    trialsData?.summary.find((s) => s.status === "TRIAL_ONGOING")?.count ?? 0;
  // Pending = open reports from the real market-report queue (feature "J-market-reporting").
  const pendingReports = openReportsCount;

  // Filtered applications for the Trials & Applications tab
  const filteredApplications = useMemo(() => {
    const apps = trialsData?.applications ?? [];
    return apps.filter((app) => {
      const matchesStatus =
        trialsStatusFilter === "all" || app.status === trialsStatusFilter;
      // Text search via the shared matcher (punctuation/font/accent-insensitive,
      // word-order-independent) across player, team, and the numeric application id.
      const matchesText = matchesSearch(
        [app.player.username, app.team.name, String(app.id)],
        trialsSearch,
      );
      return matchesStatus && matchesText;
    });
  }, [trialsData, trialsStatusFilter, trialsSearch]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        // Title is a ReactNode so the page-level ⓘ can sit right after it.
        title={
          // data-tour anchor: player-markets tour title step.
          <span data-tour="market-title" className="inline-flex flex-wrap items-center">
            {t("title")}
            <InfoTip id="player_market._page" className="ml-1.5" />
          </span>
        }
        description={t("description")}
        back
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea>
          {/* data-tour anchor: player-markets tour "move between sections" step. */}
          <TabsList data-tour="market-tabs" className="w-full">
            <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
            <TabsTrigger value="team-listings">{t("tabs.teamListings")}</TabsTrigger>
            <TabsTrigger value="player-listings">{t("tabs.playerListings")}</TabsTrigger>
            <TabsTrigger value="trials">{t("tabs.trials")}</TabsTrigger>
            <TabsTrigger value="reports">{t("tabs.reports")}</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* ─── Tab 1: Overview ────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {/* Section ⓘ heads the overview stat cards (sibling of the muted label). */}
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            {t("overview.sectionLabel")}
            <InfoTip id="player_market.overview._section" />
          </div>
          {/* Stat Cards (data-tour anchor: player-markets "market at a glance" step). */}
          <div
            data-tour="market-overview"
            className="grid gap-2 grid-cols-1 md:grid-cols-2 2xl:grid-cols-4"
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("overview.activeTeamListings")}
                </CardTitle>
                <IconUsers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeTeamListings}</div>
                <p className="text-xs text-muted-foreground">
                  {t("overview.flagged", { count: 1 })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("overview.activePlayerListings")}
                </CardTitle>
                <IconUser className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activePlayerListings}</div>
                <p className="text-xs text-muted-foreground">
                  {t("overview.flagged", { count: 1 })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("overview.activeTrials")}
                </CardTitle>
                <IconEye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeTrials}</div>
                <p className="text-xs text-muted-foreground">
                  {t("overview.totalTrials", { count: trialsData?.total ?? 0 })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("overview.pendingReports")}
                </CardTitle>
                <IconAlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingReports}</div>
                <p className="text-xs text-muted-foreground">
                  {t("overview.totalReports", { count: reports.length })}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* System Health & Compliance */}
          <Card>
            <CardHeader>
              <CardTitle>{t("overview.health.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">{t("overview.health.transferWindow")}</span>
                {transferSeasonFailed ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    {t("overview.health.unknown")}
                  </Badge>
                ) : !transferSeason ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    {t("overview.health.checking")}
                  </Badge>
                ) : transferSeason.transfer_window_is_open ? (
                  <Badge variant="outline" className="border-green-500/50 text-green-500">
                    {transferSeason.transfer_window_close
                      ? t("overview.health.openUntil", {
                          date: formatLocalDateOnly(transferSeason.transfer_window_close),
                        })
                      : t("overview.health.open")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-orange-500/50 text-orange-500">
                    {transferSeason.transfer_window_close
                      ? t("overview.health.lockedSince", {
                          date: formatLocalDateOnly(transferSeason.transfer_window_close),
                        })
                      : t("overview.health.locked")}
                  </Badge>
                )}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm">{t("overview.health.autoEnforcement")}</span>
                <Badge variant="default">{t("overview.health.active")}</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t("overview.health.bannedAutoHidden")}
                </span>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t("overview.health.auditLog")}
                </span>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 2: Team Listings ───────────────────────────────── */}
        <TabsContent value="team-listings" className="mt-4 space-y-4">
          {/* Section ⓘ heads the team-listings tab. */}
          <h2 className="text-lg font-semibold flex items-center">
            {t("teamListings.heading")}
            <InfoTip id="player_market.team_listings._section" className="ml-1.5" />
          </h2>
          <div className="flex flex-col md:flex-row gap-2 items-start md:items-center justify-between">
            <div className="relative flex-1 w-full md:max-w-sm">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("teamListings.searchPlaceholder")}
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={teamStatusFilter}
              onValueChange={setTeamStatusFilter}
            >
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder={t("listingStatus.all")} />
              </SelectTrigger>
              {/* SelectItem values stay the raw English status keys - they are compared against
                  getListingStatus()'s return value, only the visible label is translated. */}
              <SelectContent>
                <SelectItem value="all">{t("listingStatus.all")}</SelectItem>
                <SelectItem value="Active">{t("listingStatus.active")}</SelectItem>
                <SelectItem value="Expired">{t("listingStatus.expired")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {teamLoading ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  {t("common.loading")}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("teamListings.table.id")}</TableHead>
                      <TableHead>{t("teamListings.table.team")}</TableHead>
                      <TableHead>{t("teamListings.table.minTier")}</TableHead>
                      <TableHead>{t("teamListings.table.commitment")}</TableHead>
                      <TableHead>{t("teamListings.table.rolesNeeded")}</TableHead>
                      <TableHead>{t("teamListings.table.countries")}</TableHead>
                      <TableHead>{t("teamListings.table.expires")}</TableHead>
                      <TableHead>{t("teamListings.table.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamListings
                      .filter((t) => {
                        // Shared matcher: a team literally named "V-E" now matches "ve"
                        // (punctuation/font/accent-insensitive, word-order-independent).
                        // Array form because t.team is string | null (array entries
                        // accept null; a bare-string arg would not).
                        const matchSearch = matchesSearch([t.team], teamSearch);
                        const status = getListingStatus(t.expiry);
                        const matchStatus =
                          teamStatusFilter === "all" ||
                          status === teamStatusFilter;
                        return matchSearch && matchStatus;
                      })
                      .map((listing) => {
                        const status = getListingStatus(listing.expiry);
                        return (
                          <TableRow key={listing.id}>
                            <TableCell className=" text-sm">
                              #{listing.id}
                            </TableCell>
                            <TableCell className="font-medium">
                              {listing.team ?? (
                                <span className="italic text-muted-foreground">
                                  {t("common.unknown")}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {listing.minimum_tier_required ? (
                                <Badge variant="secondary" className="text-xs">
                                  {formatEnum(listing.minimum_tier_required)}
                                </Badge>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              {formatEnum(listing.commitment_type) || "-"}
                            </TableCell>
                            <TableCell>
                              {listing.roles_needed?.length ? (
                                <div className="flex flex-wrap uppercase gap-1">
                                  {listing.roles_needed.map((role) => (
                                    <Badge
                                      key={role}
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {formatEnum(role)}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              {listing.countries?.length ? (
                                listing.countries.join(", ")
                              ) : (
                                <span className="text-muted-foreground">
                                  {t("teamListings.anyCountry")}
                                </span>
                              )}
                            </TableCell>
                            {/* post_expiry_date is a Django DateField (a bare calendar date), so it
                                MUST go through formatLocalDateOnly - the date-and-time formatter
                                reads it as midnight UTC and shows the previous day west of London. */}
                            <TableCell className="text-muted-foreground">
                              {formatLocalDateOnly(listing.expiry)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  status === "Active" ? "default" : "secondary"
                                }
                                className={
                                  status === "Active"
                                    ? "bg-green-900/20 text-green-400 border-green-800"
                                    : "text-muted-foreground"
                                }
                              >
                                {status === "Active"
                                  ? t("listingStatus.active")
                                  : t("listingStatus.expired")}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {teamListings.length === 0 && !teamLoading && (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center text-muted-foreground py-8"
                        >
                          {t("teamListings.empty")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 3: Player Listings ─────────────────────────────── */}
        <TabsContent value="player-listings" className="mt-4 space-y-4">
          {/* Section ⓘ heads the player-listings tab. */}
          <h2 className="text-lg font-semibold flex items-center">
            {t("playerListings.heading")}
            <InfoTip id="player_market.player_listings._section" className="ml-1.5" />
          </h2>
          <div className="flex flex-col md:flex-row gap-2 items-start md:items-center justify-between">
            <div className="relative flex-1 w-full md:max-w-sm">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("playerListings.searchPlaceholder")}
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={playerStatusFilter}
              onValueChange={setPlayerStatusFilter}
            >
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder={t("listingStatus.all")} />
              </SelectTrigger>
              {/* Values stay the raw status keys (compared against getListingStatus()). */}
              <SelectContent>
                <SelectItem value="all">{t("listingStatus.all")}</SelectItem>
                <SelectItem value="Active">{t("listingStatus.active")}</SelectItem>
                <SelectItem value="Expired">{t("listingStatus.expired")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {playerLoading ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  {t("common.loading")}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("playerListings.table.id")}</TableHead>
                      <TableHead>{t("playerListings.table.player")}</TableHead>
                      <TableHead>{t("playerListings.table.country")}</TableHead>
                      <TableHead>{t("playerListings.table.primaryRole")}</TableHead>
                      <TableHead>{t("playerListings.table.secondaryRole")}</TableHead>
                      <TableHead>{t("playerListings.table.availability")}</TableHead>
                      <TableHead>{t("playerListings.table.expires")}</TableHead>
                      <TableHead>{t("playerListings.table.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {playerListings
                      .filter((p) => {
                        // Shared matcher: finds stylized in-game names a raw
                        // .toLowerCase().includes() would miss (punctuation/font/accent
                        // insensitive, word-order-independent).
                        const matchSearch = matchesSearch(p.player, playerSearch);
                        const status = getListingStatus(p.expiry);
                        const matchStatus =
                          playerStatusFilter === "all" ||
                          status === playerStatusFilter;
                        return matchSearch && matchStatus;
                      })
                      .map((listing) => {
                        const status = getListingStatus(listing.expiry);
                        return (
                          <TableRow key={listing.id}>
                            <TableCell className=" text-sm">
                              #{listing.id}
                            </TableCell>
                            <TableCell className="font-medium">
                              {listing.player}
                            </TableCell>
                            <TableCell className="text-sm">
                              {listing.country ?? (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {listing.primary_role ? (
                                <Badge
                                  variant="outline"
                                  className="text-xs uppercase"
                                >
                                  {formatEnum(listing.primary_role)}
                                </Badge>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              {listing.secondary_role ? (
                                <Badge
                                  variant="outline"
                                  className="text-xs text-muted-foreground uppercase"
                                >
                                  {formatEnum(listing.secondary_role)}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  -
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {listing.availability_type ? (
                                <Badge variant="secondary" className="text-xs">
                                  {formatEnum(listing.availability_type)}
                                </Badge>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            {/* Bare DateField, see the team-listings note above. */}
                            <TableCell className="text-sm text-muted-foreground">
                              {formatLocalDateOnly(listing.expiry)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  status === "Active" ? "default" : "secondary"
                                }
                                className={
                                  status === "Active"
                                    ? "bg-green-900/20 text-green-400 border-green-800"
                                    : "text-muted-foreground"
                                }
                              >
                                {status === "Active"
                                  ? t("listingStatus.active")
                                  : t("listingStatus.expired")}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {playerListings.length === 0 && !playerLoading && (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center text-muted-foreground py-8"
                        >
                          {t("playerListings.empty")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 4: Trials & Applications ───────────────────────── */}
        <TabsContent value="trials" className="mt-4 space-y-4">
          {/* Section ⓘ inline with the tab's heading. */}
          <h2 className="text-lg font-semibold flex items-center">
            {t("trials.heading")}
            <InfoTip id="player_market.trials._section" className="ml-1.5" />
          </h2>

          {/* Summary badges */}
          {trialsData && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs px-3 py-1">
                {t("trials.total", { count: trialsData.total })}
              </Badge>
              {trialsData.summary.map((s) => (
                <Badge
                  key={s.status}
                  variant="outline"
                  className={`text-xs px-3 py-1 ${getTrialStatusColor(s.status)}`}
                >
                  {trialStatusLabel(s.status)}: {s.count}
                </Badge>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("trials.searchPlaceholder")}
                value={trialsSearch}
                onChange={(e) => setTrialsSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={trialsStatusFilter}
              onValueChange={setTrialsStatusFilter}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder={t("trials.allStatuses")} />
              </SelectTrigger>
              {/* Values are the raw backend status codes; only the labels are translated. */}
              <SelectContent>
                <SelectItem value="all">{t("trials.allStatuses")}</SelectItem>
                <SelectItem value="PENDING">{t("trialStatus.PENDING")}</SelectItem>
                <SelectItem value="SHORTLISTED">{t("trialStatus.SHORTLISTED")}</SelectItem>
                <SelectItem value="INVITED">{t("trialStatus.INVITED")}</SelectItem>
                <SelectItem value="TRIAL_ONGOING">{t("trialStatus.TRIAL_ONGOING")}</SelectItem>
                <SelectItem value="ACCEPTED">{t("trialStatus.ACCEPTED")}</SelectItem>
                <SelectItem value="REJECTED">{t("trialStatus.REJECTED")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">{t("trials.table.number")}</TableHead>
                    <TableHead>{t("trials.table.player")}</TableHead>
                    <TableHead>{t("trials.table.team")}</TableHead>
                    <TableHead>{t("trials.table.postType")}</TableHead>
                    <TableHead>{t("trials.table.status")}</TableHead>
                    <TableHead>{t("trials.table.applied")}</TableHead>
                    <TableHead>{t("trials.table.contact")}</TableHead>
                    <TableHead>{t("trials.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trialsLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        {t("common.loading")}
                      </TableCell>
                    </TableRow>
                  ) : filteredApplications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        {t("trials.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredApplications.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {app.id}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{app.player.username}</div>
                          <div className="text-xs text-muted-foreground">
                            {t("trials.uid", { uid: app.player.uid })}
                          </div>
                          {app.player.discord && (
                            <div className="text-xs text-muted-foreground">
                              {t("trials.discord", { handle: app.player.discord })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>{app.team.name}</div>
                          {app.team.tag && (
                            <div className="text-xs text-muted-foreground">
                              [{app.team.tag}]
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {t("trials.tier", { tier: app.team.tier })}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {postTypeLabel(app.post.post_type)}
                          {app.post.roles_needed && app.post.roles_needed.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {app.post.roles_needed.map((r) => (
                                <Badge key={r} variant="secondary" className="text-xs py-0">
                                  {formatEnum(r)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${getTrialStatusColor(app.status)}`}>
                            {trialStatusLabel(app.status)}
                          </Badge>
                        </TableCell>
                        {/* applied_at is a real instant (DateTimeField) - viewer-local date. */}
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          <LocalTime value={app.applied_at} mode="date" />
                        </TableCell>
                        <TableCell>
                          {app.contact_unlocked ? (
                            <span className="flex items-center gap-1 text-xs text-green-500">
                              <IconCircleCheck className="h-4 w-4" />
                              {t("trials.contactUnlocked")}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t("trials.contactLocked")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title={t("trials.viewDetails")}
                              onClick={() => setSelectedApplication(app)}
                            >
                              <IconEye className="h-4 w-4" />
                            </Button>
                            {/* Read Chat: opens the read-only trial-chat reader
                                (feature "K-admin-chat-read"). Only rendered when the
                                application has a chat (chat_id != null). Rows with no
                                trial chat yet show a muted "No chat" hint instead, so
                                the admin understands why there is nothing to open. */}
                            {app.chat_id ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
                                title={t("trials.readChatTitle")}
                                onClick={() => openChat(app)}
                              >
                                <IconMessage className="h-3.5 w-3.5 mr-1" />
                                {t("trials.readChat")}
                              </Button>
                            ) : (
                              <span
                                className="text-xs text-muted-foreground"
                                title={t("trials.noChatTitle")}
                              >
                                {t("trials.noChat")}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Application Detail Dialog ────────────────────────── */}
        <Dialog
          open={!!selectedApplication}
          onOpenChange={(open) => !open && setSelectedApplication(null)}
        >
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {t("applicationDialog.title", { id: selectedApplication?.id ?? "" })}
              </DialogTitle>
              <DialogDescription>
                {t("applicationDialog.description")}
              </DialogDescription>
            </DialogHeader>
            {selectedApplication && (
              <div className="space-y-4 text-sm overflow-y-auto flex-1 pr-1">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("applicationDialog.status")}</span>
                  <Badge className={getTrialStatusColor(selectedApplication.status)}>
                    {trialStatusLabel(selectedApplication.status)}
                  </Badge>
                </div>

                <Separator />

                {/* Player */}
                <div className="space-y-1">
                  <p className="font-medium">{t("applicationDialog.player")}</p>
                  <p>{selectedApplication.player.username}</p>
                  <p className="text-muted-foreground">
                    {t("trials.uid", { uid: selectedApplication.player.uid })}
                  </p>
                  {selectedApplication.player.discord && (
                    <p className="text-muted-foreground">
                      {t("trials.discord", { handle: selectedApplication.player.discord })}
                    </p>
                  )}
                  {selectedApplication.player.is_banned && (
                    <Badge variant="destructive" className="text-xs">
                      {t("applicationDialog.banned")}
                    </Badge>
                  )}
                </div>

                <Separator />

                {/* Team */}
                <div className="space-y-1">
                  <p className="font-medium">{t("applicationDialog.team")}</p>
                  <p>{selectedApplication.team.name}</p>
                  {selectedApplication.team.tag && (
                    <p className="text-muted-foreground">
                      {t("applicationDialog.tag", { tag: selectedApplication.team.tag })}
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    {t("trials.tier", { tier: selectedApplication.team.tier })}
                  </p>
                </div>

                <Separator />

                {/* Post */}
                <div className="space-y-1">
                  <p className="font-medium">{t("applicationDialog.post")}</p>
                  <p>#{selectedApplication.post.id} - {postTypeLabel(selectedApplication.post.post_type)}</p>
                  {selectedApplication.post.commitment_type && (
                    <p className="text-muted-foreground">{formatEnum(selectedApplication.post.commitment_type)}</p>
                  )}
                  {selectedApplication.post.roles_needed && selectedApplication.post.roles_needed.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedApplication.post.roles_needed.map((r) => (
                        <Badge key={r} variant="secondary" className="text-xs">{formatEnum(r)}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Dates */}
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {/* All three are DateTimeFields (real instants), shown in the viewer's zone. */}
                  <div>
                    <p className="font-medium text-foreground">{t("applicationDialog.applied")}</p>
                    <p><LocalTime value={selectedApplication.applied_at} mode="date" /></p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{t("applicationDialog.updated")}</p>
                    <p><LocalTime value={selectedApplication.updated_at} mode="date" /></p>
                  </div>
                  {selectedApplication.invite_expires_at && (
                    <div>
                      <p className="font-medium text-foreground">
                        {t("applicationDialog.inviteExpires")}
                      </p>
                      <p><LocalTime value={selectedApplication.invite_expires_at} mode="date" /></p>
                    </div>
                  )}
                  {selectedApplication.chat_id && (
                    <div>
                      <p className="font-medium text-foreground">{t("applicationDialog.chatId")}</p>
                      <p>#{selectedApplication.chat_id}</p>
                    </div>
                  )}
                </div>

                {selectedApplication.reason && (
                  <>
                    <Separator />
                    <div>
                      <p className="font-medium mb-1">{t("applicationDialog.reason")}</p>
                      <p className="text-muted-foreground">{selectedApplication.reason}</p>
                    </div>
                  </>
                )}
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{t("common.close")}</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Read-Only Trial Chat Dialog (feature "K-admin-chat-read") ──────────
            Opened by the "Read Chat" button on a Trials & Applications row. Fetches
            the conversation from GET /player-market/trial-chat/messages/?chat_id=<id>
            (admin Bearer token) and renders every message with the SENDER'S full
            username, the message text, and the timestamp. This is intentionally
            READ-ONLY for staff: there is no message input / send box, mirroring the
            backend gate (send_trial_chat_message stays participant-only). The message
            bubble idiom mirrors the user-side TrialChatSidebar so both read the same. */}
        <Dialog
          open={!!chatContext}
          onOpenChange={(open) => !open && closeChat()}
        >
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IconMessage className="h-5 w-5 text-primary" />
                {t("chatDialog.title")}
                {chatContext && (
                  <Badge variant="outline" className="rounded-full text-xs">
                    #{chatContext.chatId}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {/* t.rich keeps the team + player names bold inside one translatable sentence,
                    so translators control the word order around them. */}
                {chatContext
                  ? t.rich("chatDialog.descriptionWith", {
                      team: chatContext.team,
                      player: chatContext.player,
                      strong: (chunks) => (
                        <span className="text-foreground font-medium">{chunks}</span>
                      ),
                    })
                  : t("chatDialog.descriptionFallback")}
              </DialogDescription>
            </DialogHeader>

            {/* Message list: loading, empty, then the conversation. */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-2 min-h-[8rem]">
              {chatLoading ? (
                <div className="flex items-center justify-center h-36 gap-2 text-sm text-muted-foreground">
                  <IconLoader2 className="h-4 w-4 animate-spin" />
                  {t("chatDialog.loading")}
                </div>
              ) : !chatConversation ||
                chatConversation.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-36 gap-2 text-muted-foreground">
                  <IconMessage className="h-10 w-10 opacity-30" />
                  <p className="text-sm font-medium">{t("chatDialog.emptyTitle")}</p>
                  <p className="text-xs">{t("chatDialog.emptyBody")}</p>
                </div>
              ) : (
                // Admin reads BOTH sides, so every message is left-aligned with the
                // sender's FULL username shown above the bubble (never truncated).
                chatConversation.messages.map((msg) => (
                  <div key={msg.id} className="flex gap-2">
                    <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                      <AvatarFallback className="text-xs">
                        {msg.sender.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start space-y-0.5 min-w-0">
                      {/* Full sender username + timestamp. break-words so a long
                          username wraps rather than being clipped. */}
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-xs font-medium break-words">
                          {msg.sender}
                        </span>
                        {/* sent_at is a UTC instant: full date + time in the viewer's zone. */}
                        <LocalTime
                          value={msg.sent_at}
                          mode="datetime"
                          className="text-[10px] text-muted-foreground"
                        />
                      </div>
                      <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm leading-relaxed break-words">
                        {msg.message}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{t("common.close")}</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Tab 5: Reports & Flags (real queue, feature "J-market-reporting") ── */}
        <TabsContent value="reports" className="mt-4 space-y-4">
          {/* Section ⓘ inline with the tab's heading. */}
          <h2 className="text-lg font-semibold flex items-center">
            {t("reports.heading")}
            <InfoTip id="player_market.reports._section" className="ml-1.5" />
          </h2>

          {/* Filters: search + status + reason. All refetch server-side on change. */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("reports.searchPlaceholder")}
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={reportStatusFilter}
              onValueChange={setReportStatusFilter}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder={t("reports.allStatuses")} />
              </SelectTrigger>
              {/* Values are the backend status codes sent as the ?status= filter. */}
              <SelectContent>
                <SelectItem value="all">{t("reports.allStatuses")}</SelectItem>
                <SelectItem value="open">{t("reportStatus.open")}</SelectItem>
                <SelectItem value="reviewing">{t("reportStatus.reviewing")}</SelectItem>
                <SelectItem value="resolved">{t("reportStatus.resolved")}</SelectItem>
                <SelectItem value="dismissed">{t("reportStatus.dismissed")}</SelectItem>
                <SelectItem value="banned">{t("reportStatus.banned")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={reportCatFilter} onValueChange={setReportCatFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder={t("reports.allReasons")} />
              </SelectTrigger>
              {/* Values are the backend category codes sent as the ?category= filter. */}
              <SelectContent>
                <SelectItem value="all">{t("reports.allReasons")}</SelectItem>
                <SelectItem value="bad_tryout">
                  {t("reportCategory.bad_tryout_long")}
                </SelectItem>
                <SelectItem value="scam">{t("reportCategory.scam")}</SelectItem>
                <SelectItem value="abusive">{t("reportCategory.abusive")}</SelectItem>
                <SelectItem value="fake_post">{t("reportCategory.fake_post")}</SelectItem>
                <SelectItem value="other">{t("reportCategory.other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("reports.table.subject")}</TableHead>
                    <TableHead>{t("reports.table.reason")}</TableHead>
                    <TableHead>{t("reports.table.reporter")}</TableHead>
                    <TableHead>{t("reports.table.submitted")}</TableHead>
                    <TableHead>{t("reports.table.status")}</TableHead>
                    <TableHead className="text-right">{t("reports.table.action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportsLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground"
                      >
                        {t("common.loading")}
                      </TableCell>
                    </TableRow>
                  ) : reports.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground"
                      >
                        {t("reports.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    reports.map((report) => (
                      <TableRow key={report.id}>
                        {/* Subject + type (team / player) inline. */}
                        <TableCell>
                          <div className="font-medium">
                            {report.subject_name ?? t("common.unknown")}
                          </div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {report.subject_type}
                          </div>
                        </TableCell>
                        {/* Reason chip + the reporter's details inline (muted) so the
                            gist reads at a glance without opening the dialog. */}
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <Badge
                              variant="outline"
                              className={`w-fit rounded-full text-xs ${
                                report.category === "scam" ||
                                report.category === "abusive"
                                  ? "border-red-500/50 text-red-400"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {categoryLabel(report.category)}
                            </Badge>
                            {report.details && (
                              <span className="text-xs text-muted-foreground line-clamp-2 max-w-xs">
                                {report.details}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {report.reporter_username || "-"}
                        </TableCell>
                        {/* created_at is a UTC instant - viewer-local date. */}
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {report.created_at ? (
                            <LocalTime value={report.created_at} mode="date" />
                          ) : (
                            t("common.dash")
                          )}
                        </TableCell>
                        <TableCell>
                          <ReportStatusBadge status={report.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openResolve(report)}
                            >
                              {t("reports.resolve")}
                            </Button>
                            {report.status !== "banned" && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setBanTarget(report)}
                                title={t("reports.banTitle")}
                              >
                                <IconBan className="h-3.5 w-3.5 mr-1" />
                                {t("reports.ban")}
                              </Button>
                            )}
                            {/* J5: ban the REPORTER when the report is false / abusive.
                                Only shown when the reporter id is on record. */}
                            {report.reporter_id && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-red-500/50 text-red-500 hover:text-red-500"
                                onClick={() => openBanReporter(report)}
                                title={t("reports.banReporterTitle")}
                              >
                                <IconFlag className="h-3.5 w-3.5 mr-1" />
                                {t("reports.banReporter")}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            {t("reports.footer", {
              shown: reports.length,
              open: openReportsCount,
            })}
          </p>
        </TabsContent>
      </Tabs>

      {/* ─── Suspend Listing Modal ──────────────────────────────────── */}
      <Dialog
        open={suspendModal.open}
        onOpenChange={(open) => setSuspendModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("suspendDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("suspendDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("suspendDialog.reason")}</label>
              <Textarea
                placeholder={t("suspendDialog.reasonPlaceholder")}
                rows={4}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">{t("common.cancel")}</Button>
            </DialogClose>
            <Button
              onClick={() => {
                toast.success(
                  t("suspendDialog.suspended", {
                    id: suspendModal.listingId ?? "",
                  }),
                );
                setSuspendModal({
                  open: false,
                  listingId: null,
                  listingType: "team",
                });
                setSuspendReason("");
              }}
              disabled={!suspendReason.trim()}
            >
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Trial Timeline Modal ───────────────────────────────────── */}
      <Dialog
        open={!!viewTrial}
        onOpenChange={(open) => {
          if (!open) setViewTrial(null);
        }}
      >
        {viewTrial && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("trialTimeline.title")}</DialogTitle>
              <DialogDescription>
                {t("trialTimeline.description", { id: viewTrial.id })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Player & Team */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t("trialTimeline.player")}</p>
                  <p className="font-semibold">{viewTrial.player}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t("trialTimeline.team")}</p>
                  <p className="font-semibold">{viewTrial.team}</p>
                </div>
              </div>

              {/* Start Date & Status */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t("trialTimeline.startDate")}</p>
                  <p className="text-sm font-medium">
                    {formatLocalDateOnly(viewTrial.startDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t("trialTimeline.status")}</p>
                  <Badge variant={getStatusVariant(viewTrial.status)}>
                    {viewTrial.status}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Timeline Events */}
              <div>
                <h4 className="text-sm font-semibold mb-3">{t("trialTimeline.events")}</h4>
                <div className="space-y-3">
                  {viewTrial.events.map((event, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div
                        className={`w-1 shrink-0 rounded-full ${event.color}`}
                      />
                      <div className="flex-1 flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold">{event.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {event.description}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground shrink-0 ml-4">
                          {formatLocalDateOnly(event.date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="outline">{t("common.close")}</Button>
              </DialogClose>
              {viewTrial.status === "Ongoing" && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    toast.success(t("trialTimeline.cancelled", { id: viewTrial.id }));
                    setViewTrial(null);
                  }}
                >
                  {t("trialTimeline.cancelTrial")}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ─── Review Report Modal ────────────────────────────────────── */}
      <Dialog
        open={!!viewReport}
        onOpenChange={(open) => {
          if (!open) {
            setViewReport(null);
            setReportAction("");
          }
        }}
      >
        {viewReport && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("reviewReport.title")}</DialogTitle>
              <DialogDescription>
                {t("reviewReport.reportId", { id: viewReport.id })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Reported By & Entity */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("reviewReport.reportedBy")}
                  </p>
                  <p className="font-semibold">{viewReport.reportedBy}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {t("reviewReport.reportedEntity")}
                  </p>
                  <p className="font-semibold">{viewReport.reportedEntity}</p>
                </div>
              </div>

              {/* Date & Severity */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t("reviewReport.date")}</p>
                  <p className="text-sm font-medium">
                    {formatLocalDateOnly(viewReport.date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t("reviewReport.severity")}</p>
                  <Badge variant={getSeverityVariant(viewReport.severity)}>
                    {viewReport.severity}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Reason */}
              <div>
                <p className="text-xs text-muted-foreground">{t("reviewReport.reason")}</p>
                <p className="text-sm font-medium">{viewReport.reason}</p>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("reviewReport.descriptionLabel")}
                </p>
                <p className="text-sm">{viewReport.description}</p>
              </div>

              {/* Evidence */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {t("reviewReport.evidence")}
                </p>
                <Button variant="outline" size="sm" className="text-xs">
                  <IconEye className="h-3.5 w-3.5 mr-1" />
                  {t("reviewReport.viewEvidence", { count: viewReport.evidenceCount })}
                </Button>
              </div>

              {/* Previous Reports */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {t("reviewReport.previousReports")}
                </p>
                <Button variant="outline" size="sm" className="text-xs">
                  <IconClipboardList className="h-3.5 w-3.5 mr-1" />
                  {t("reviewReport.viewPreviousReports", {
                    count: viewReport.previousReportsCount,
                  })}
                </Button>
              </div>

              <Separator />

              {/* Take Action */}
              {viewReport.status !== "Resolved" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("reviewReport.takeAction")}</label>
                  <Select value={reportAction} onValueChange={setReportAction}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("reviewReport.selectAction")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warn">{t("reviewReport.actions.warn")}</SelectItem>
                      <SelectItem value="suspend">{t("reviewReport.actions.suspend")}</SelectItem>
                      <SelectItem value="ban">{t("reviewReport.actions.ban")}</SelectItem>
                      <SelectItem value="dismiss">{t("reviewReport.actions.dismiss")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="outline">{t("common.close")}</Button>
              </DialogClose>
              {viewReport.status !== "Resolved" && (
                <Button
                  onClick={() => {
                    toast.success(
                      t("reviewReport.actionTaken", {
                        action: reportAction,
                        id: viewReport.id,
                      }),
                    );
                    setViewReport(null);
                    setReportAction("");
                  }}
                  disabled={!reportAction}
                >
                  {t("reviewReport.confirmAction")}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ─── Resolve Report dialog (real, feature "J-market-reporting") ────────── */}
      {/* Move a report through its lifecycle (open → reviewing → resolved/dismissed)
          and attach resolution notes. Banning is a SEPARATE action (the Ban dialog). */}
      <Dialog
        open={!!resolveTarget}
        onOpenChange={(open) => !open && setResolveTarget(null)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("resolveDialog.title")}</DialogTitle>
            <DialogDescription>
              {resolveTarget
                ? `${resolveTarget.subject_name ?? t("common.unknown")} - ${categoryLabel(
                    resolveTarget.category,
                  )}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {resolveTarget && (
            <div className="space-y-4">
              {/* Reporter + subject context (read-only). */}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="text-muted-foreground">
                  {t("resolveDialog.reporter")}{" "}
                  <span className="text-foreground">
                    {resolveTarget.reporter_username || t("common.dash")}
                  </span>
                </span>
                <span className="text-muted-foreground capitalize">
                  {t("resolveDialog.subject")}{" "}
                  <span className="text-foreground">
                    {resolveTarget.subject_name} ({resolveTarget.subject_type})
                  </span>
                </span>
              </div>

              {/* The reporter's written details (read-only context). */}
              {resolveTarget.details && (
                <div className="space-y-1">
                  <Label>{t("resolveDialog.reporterSaid")}</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md border border-l-2 border-l-primary bg-muted/30 p-3">
                    {resolveTarget.details}
                  </p>
                </div>
              )}

              {/* Evidence (read-only) - the reporter may attach MULTIPLE images AND videos
                  (owner 2026-06-30). Moderators view every image and PLAY every video here.
                  evidence_files (absolute URLs from the API) is preferred; for pre-feature rows
                  that only have the single legacy `evidence` image we fall back to it. */}
              {(resolveTarget.evidence_files?.length ?? 0) > 0 ? (
                <div className="space-y-2">
                  <Label>
                    {t("resolveDialog.evidenceCount", {
                      count: resolveTarget.evidence_files.length,
                    })}
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {resolveTarget.evidence_files.map((ev, i) =>
                      ev.media_type === "video" ? (
                        <video
                          key={i}
                          src={ev.url}
                          controls
                          className="aspect-video w-full rounded-md border bg-muted object-contain"
                        />
                      ) : (
                        <a
                          key={i}
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative block aspect-video w-full overflow-hidden rounded-md border bg-muted"
                        >
                          {/* Reporter-supplied evidence comes from an upload host - plain <img>. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ev.url}
                            alt={t("resolveDialog.evidenceAlt", { index: i + 1 })}
                            className="size-full object-contain"
                          />
                        </a>
                      ),
                    )}
                  </div>
                </div>
              ) : (
                resolveTarget.evidence && (
                  <div className="space-y-2">
                    <Label>{t("resolveDialog.evidence")}</Label>
                    <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveTarget.evidence}
                        alt={t("resolveDialog.evidenceAltSingle")}
                        className="size-full object-contain"
                      />
                    </div>
                  </div>
                )
              )}

              {/* Status. */}
              <div className="space-y-2">
                <Label htmlFor="resolve-status">{t("resolveDialog.status")}</Label>
                <Select
                  value={resolveStatus}
                  onValueChange={setResolveStatus}
                >
                  <SelectTrigger id="resolve-status" className="w-full">
                    <SelectValue placeholder={t("resolveDialog.status")} />
                  </SelectTrigger>
                  {/* Values are the backend status codes PATCHed back on save. */}
                  <SelectContent>
                    <SelectItem value="open">{t("reportStatus.open")}</SelectItem>
                    <SelectItem value="reviewing">{t("reportStatus.reviewing")}</SelectItem>
                    <SelectItem value="resolved">{t("reportStatus.resolved")}</SelectItem>
                    <SelectItem value="dismissed">{t("reportStatus.dismissed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Resolution notes. */}
              <div className="space-y-2">
                <Label htmlFor="resolve-notes">
                  {t("resolveDialog.notes")}{" "}
                  <span className="text-muted-foreground">
                    {t("resolveDialog.notesOptional")}
                  </span>
                </Label>
                <Textarea
                  id="resolve-notes"
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder={t("resolveDialog.notesPlaceholder")}
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setResolveTarget(null)}
              disabled={resolveSaving}
            >
              {t("common.cancel")}
            </Button>
            <Button disabled={resolveSaving} onClick={saveResolve}>
              {resolveSaving ? t("resolveDialog.saving") : t("resolveDialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Ban dialog (real, feature "J-market-reporting") ──────────────────── */}
      {/* Ban a player or whole team from the market. onBanned refetches the queue so
          the actioned report flips to the "banned" badge. */}
      <MarketBanDialog
        target={banTarget}
        onClose={() => setBanTarget(null)}
        onBanned={fetchReports}
      />

      {/* ─── Ban-the-REPORTER confirm dialog (feature "J-market-rules", J5) ─────────
          Bans the user who FILED a false / abusive report (not the reported subject),
          via admin_market_ban scope=player target_id=reporter_id. Permanent by default;
          the reason is editable. Closing the report as "dismissed" happens in the
          handler so the queue reflects that the report itself was rejected. */}
      <Dialog
        open={!!banReporterTarget}
        onOpenChange={(open) => !open && setBanReporterTarget(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconFlag className="h-5 w-5 text-red-500" />
              {t("banReporterDialog.title")}
            </DialogTitle>
            <DialogDescription>
              {/* t.rich keeps the reporter's name bold inside one translatable sentence. */}
              {t.rich("banReporterDialog.description", {
                reporter:
                  banReporterTarget?.reporter_username ??
                  t("banReporterDialog.thisReporter"),
                strong: (chunks) => (
                  <span className="font-medium text-foreground">{chunks}</span>
                ),
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="space-y-2">
              <Label htmlFor="ban-reporter-reason">
                {t("banReporterDialog.reason")} <span className="text-red-500">*</span>{" "}
                <span className="text-muted-foreground">
                  {t("banReporterDialog.reasonHint")}
                </span>
              </Label>
              <Textarea
                id="ban-reporter-reason"
                value={banReporterReason}
                onChange={(e) => setBanReporterReason(e.target.value)}
                rows={3}
                placeholder={t("banReporterDialog.reasonPlaceholder")}
              />
            </div>
            <p className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-muted-foreground">
              {t("banReporterDialog.warning")}
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setBanReporterTarget(null)}
              disabled={banReporterSaving}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBanReporter}
              disabled={banReporterSaving || !banReporterReason.trim()}
            >
              <IconFlag className="h-4 w-4 mr-1" />
              {banReporterSaving
                ? t("banReporterDialog.banning")
                : t("banReporterDialog.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
