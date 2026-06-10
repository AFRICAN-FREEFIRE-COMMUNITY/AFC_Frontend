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
import { formatDate } from "@/lib/utils";
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

// ── Market-report label maps + badges (feature "J-market-reporting") ──────────
// Human labels for the MarketReport categories + statuses (match the backend
// CATEGORY_CHOICES / STATUS_CHOICES). Falls back to the raw value for anything the
// backend adds later.
const REPORT_CATEGORY_LABELS: Record<string, string> = {
  bad_tryout: "Negative tryout",
  scam: "Scam / fraud",
  abusive: "Abusive conduct",
  fake_post: "Fake / misleading post",
  other: "Other",
};

const REPORT_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  reviewing: "Reviewing",
  resolved: "Resolved",
  dismissed: "Dismissed",
  banned: "Banned",
};

// Outline status badge, colour-coded per the mockup: open=yellow (unhandled),
// reviewing=cyan, resolved=green, dismissed=muted, banned=red.
function ReportStatusBadge({ status }: { status: string }) {
  const colour: Record<string, string> = {
    open: "border-yellow-500/50 text-yellow-500",
    reviewing: "border-cyan-500/50 text-cyan-400",
    resolved: "border-green-600/60 text-green-400",
    dismissed: "text-muted-foreground",
    banned: "border-red-500/60 text-red-400",
  };
  return (
    <Badge variant="outline" className={`rounded-full ${colour[status] ?? ""}`}>
      {REPORT_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AdminPlayerMarketPage() {
  const { token } = useAuth();
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
          err?.response?.data?.message || "Failed to load trial chat.",
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
    setBanReporterReason(
      "Filing a false or abusive report on the Player Market. Reports must be honest and backed by evidence.",
    );
  };

  // Ban the reporter via admin_market_ban (scope player, target = reporter id). On
  // success we also stamp the originating report "dismissed" so the queue reflects that
  // the report was rejected and the reporter actioned.
  const confirmBanReporter = async () => {
    if (!banReporterTarget || banReporterSaving) return;
    const reporterId = banReporterTarget.reporter_id;
    if (!reporterId) {
      toast.error("This report has no reporter on record to ban.");
      return;
    }
    if (!banReporterReason.trim()) {
      toast.error("A ban reason is required.");
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
        `Reporter ${banReporterTarget.reporter_username ?? ""} banned from the market.`.trim(),
      );
      setBanReporterTarget(null);
      fetchReports();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to ban reporter.");
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
      toast.error(err?.response?.data?.message || "Failed to load reports.");
    } finally {
      setReportsLoading(false);
    }
  };

  // Refetch when the moderator changes a filter / search (and on first auth).
  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, reportStatusFilter, reportCatFilter, reportSearch]);

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
      toast.success("Report updated.");
      setResolveTarget(null);
      fetchReports();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update report.");
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
      .catch(() => toast.error("Failed to load team listings"))
      .finally(() => setTeamLoading(false));

    fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-player-availability-posts/`,
    )
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: PlayerAvailabilityPost[]) => setPlayerListings(data))
      .catch(() => toast.error("Failed to load player listings"))
      .finally(() => setPlayerLoading(false));

    if (token) {
      axios
        .get<TrialsAndApplicationsResponse>(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/admin/all-trials-and-applications/`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        .then((res) => setTrialsData(res.data))
        .catch(() => toast.error("Failed to load trials & applications"))
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
          <span data-tour="market-title" className="inline-flex items-center">
            Player Market Administration
            <InfoTip id="player_market._page" className="ml-1.5" />
          </span>
        }
        description="Comprehensive management, control, and oversight of all player market activities"
        back
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea>
          {/* data-tour anchor: player-markets tour "move between sections" step. */}
          <TabsList data-tour="market-tabs" className="w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="team-listings">Team Listings</TabsTrigger>
            <TabsTrigger value="player-listings">Player Listings</TabsTrigger>
            <TabsTrigger value="trials">Trials & Applications</TabsTrigger>
            <TabsTrigger value="reports">Reports & Flags</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* ─── Tab 1: Overview ────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {/* Section ⓘ heads the overview stat cards (sibling of the muted label). */}
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            Market overview
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
                  Active Team Listings
                </CardTitle>
                <IconUsers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeTeamListings}</div>
                <p className="text-xs text-muted-foreground">1 flagged</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Player Listings
                </CardTitle>
                <IconUser className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activePlayerListings}</div>
                <p className="text-xs text-muted-foreground">1 flagged</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Trials
                </CardTitle>
                <IconEye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeTrials}</div>
                <p className="text-xs text-muted-foreground">
                  {trialsData?.total ?? 0} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pending Reports
                </CardTitle>
                <IconAlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingReports}</div>
                <p className="text-xs text-muted-foreground">
                  {reports.length} total reports
                </p>
              </CardContent>
            </Card>
          </div>

          {/* System Health & Compliance */}
          <Card>
            <CardHeader>
              <CardTitle>System Health & Compliance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Transfer Window Status</span>
                <Badge variant="outline">Open</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm">Auto-Enforcement Rules</span>
                <Badge variant="default">Active</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Banned Entities Auto-Hidden
                </span>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Audit Log Status
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
            Team Listings
            <InfoTip id="player_market.team_listings._section" className="ml-1.5" />
          </h2>
          <div className="flex flex-col md:flex-row gap-2 items-start md:items-center justify-between">
            <div className="relative flex-1 w-full md:max-w-sm">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by team name..."
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
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {teamLoading ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Min Tier</TableHead>
                      <TableHead>Commitment</TableHead>
                      <TableHead>Roles Needed</TableHead>
                      <TableHead>Countries</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
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
                                  Unknown
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
                                  Any
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(listing.expiry)}
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
                                {status}
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
                          No team listings found
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
            Player Listings
            <InfoTip id="player_market.player_listings._section" className="ml-1.5" />
          </h2>
          <div className="flex flex-col md:flex-row gap-2 items-start md:items-center justify-between">
            <div className="relative flex-1 w-full md:max-w-sm">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by player name..."
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
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {playerLoading ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Primary Role</TableHead>
                      <TableHead>Secondary Role</TableHead>
                      <TableHead>Availability</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
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
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(listing.expiry)}
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
                                {status}
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
                          No player listings found
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
            Trials & Applications
            <InfoTip id="player_market.trials._section" className="ml-1.5" />
          </h2>

          {/* Summary badges */}
          {trialsData && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs px-3 py-1">
                Total: {trialsData.total}
              </Badge>
              {trialsData.summary.map((s) => (
                <Badge
                  key={s.status}
                  variant="outline"
                  className={`text-xs px-3 py-1 ${getTrialStatusColor(s.status)}`}
                >
                  {formatEnum(s.status)}: {s.count}
                </Badge>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search player, team, or ID..."
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
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="SHORTLISTED">Shortlisted</SelectItem>
                <SelectItem value="INVITED">Invited</SelectItem>
                <SelectItem value="TRIAL_ONGOING">Trial Ongoing</SelectItem>
                <SelectItem value="ACCEPTED">Accepted</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Post Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trialsLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredApplications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        No applications found.
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
                            UID: {app.player.uid}
                          </div>
                          {app.player.discord && (
                            <div className="text-xs text-muted-foreground">
                              Discord: {app.player.discord}
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
                            Tier {app.team.tier}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatEnum(app.post.post_type)}
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
                            {formatEnum(app.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(app.applied_at)}
                        </TableCell>
                        <TableCell>
                          {app.contact_unlocked ? (
                            <span className="flex items-center gap-1 text-xs text-green-500">
                              <IconCircleCheck className="h-4 w-4" />
                              Unlocked
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Locked</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="View details"
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
                                title="Read this trial chat (read-only)"
                                onClick={() => openChat(app)}
                              >
                                <IconMessage className="h-3.5 w-3.5 mr-1" />
                                Read Chat
                              </Button>
                            ) : (
                              <span
                                className="text-xs text-muted-foreground"
                                title="No trial chat has been started for this application yet"
                              >
                                No chat
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
              <DialogTitle>Application #{selectedApplication?.id}</DialogTitle>
              <DialogDescription>
                Full details for this trial / application.
              </DialogDescription>
            </DialogHeader>
            {selectedApplication && (
              <div className="space-y-4 text-sm overflow-y-auto flex-1 pr-1">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={getTrialStatusColor(selectedApplication.status)}>
                    {formatEnum(selectedApplication.status)}
                  </Badge>
                </div>

                <Separator />

                {/* Player */}
                <div className="space-y-1">
                  <p className="font-medium">Player</p>
                  <p>{selectedApplication.player.username}</p>
                  <p className="text-muted-foreground">UID: {selectedApplication.player.uid}</p>
                  {selectedApplication.player.discord && (
                    <p className="text-muted-foreground">Discord: {selectedApplication.player.discord}</p>
                  )}
                  {selectedApplication.player.is_banned && (
                    <Badge variant="destructive" className="text-xs">Banned</Badge>
                  )}
                </div>

                <Separator />

                {/* Team */}
                <div className="space-y-1">
                  <p className="font-medium">Team</p>
                  <p>{selectedApplication.team.name}</p>
                  {selectedApplication.team.tag && (
                    <p className="text-muted-foreground">Tag: {selectedApplication.team.tag}</p>
                  )}
                  <p className="text-muted-foreground">Tier {selectedApplication.team.tier}</p>
                </div>

                <Separator />

                {/* Post */}
                <div className="space-y-1">
                  <p className="font-medium">Post</p>
                  <p>#{selectedApplication.post.id} - {formatEnum(selectedApplication.post.post_type)}</p>
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
                  <div>
                    <p className="font-medium text-foreground">Applied</p>
                    <p>{formatDate(selectedApplication.applied_at)}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Updated</p>
                    <p>{formatDate(selectedApplication.updated_at)}</p>
                  </div>
                  {selectedApplication.invite_expires_at && (
                    <div>
                      <p className="font-medium text-foreground">Invite Expires</p>
                      <p>{formatDate(selectedApplication.invite_expires_at)}</p>
                    </div>
                  )}
                  {selectedApplication.chat_id && (
                    <div>
                      <p className="font-medium text-foreground">Chat ID</p>
                      <p>#{selectedApplication.chat_id}</p>
                    </div>
                  )}
                </div>

                {selectedApplication.reason && (
                  <>
                    <Separator />
                    <div>
                      <p className="font-medium mb-1">Reason</p>
                      <p className="text-muted-foreground">{selectedApplication.reason}</p>
                    </div>
                  </>
                )}
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
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
                Trial Chat
                {chatContext && (
                  <Badge variant="outline" className="rounded-full text-xs">
                    #{chatContext.chatId}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {chatContext ? (
                  <>
                    Read-only view of the conversation between{" "}
                    <span className="text-foreground font-medium">
                      {chatContext.team}
                    </span>{" "}
                    and{" "}
                    <span className="text-foreground font-medium">
                      {chatContext.player}
                    </span>
                    . Staff may read trial chats but cannot post.
                  </>
                ) : (
                  "Read-only view of a trial conversation."
                )}
              </DialogDescription>
            </DialogHeader>

            {/* Message list: loading, empty, then the conversation. */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-2 min-h-[8rem]">
              {chatLoading ? (
                <div className="flex items-center justify-center h-36 gap-2 text-sm text-muted-foreground">
                  <IconLoader2 className="h-4 w-4 animate-spin" />
                  Loading messages...
                </div>
              ) : !chatConversation ||
                chatConversation.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-36 gap-2 text-muted-foreground">
                  <IconMessage className="h-10 w-10 opacity-30" />
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs">
                    This trial chat has no messages to show.
                  </p>
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
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(msg.sent_at, true)}
                        </span>
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
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Tab 5: Reports & Flags (real queue, feature "J-market-reporting") ── */}
        <TabsContent value="reports" className="mt-4 space-y-4">
          {/* Section ⓘ inline with the tab's heading. */}
          <h2 className="text-lg font-semibold flex items-center">
            Reports & Flagged Content
            <InfoTip id="player_market.reports._section" className="ml-1.5" />
          </h2>

          {/* Filters: search + status + reason. All refetch server-side on change. */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search reports by team or player..."
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
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="reviewing">Reviewing</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
            <Select value={reportCatFilter} onValueChange={setReportCatFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="All reasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reasons</SelectItem>
                <SelectItem value="bad_tryout">
                  Negative tryout experience
                </SelectItem>
                <SelectItem value="scam">Scam / fraud</SelectItem>
                <SelectItem value="abusive">Abusive conduct</SelectItem>
                <SelectItem value="fake_post">Fake / misleading post</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reported subject</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportsLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground"
                      >
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : reports.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No reports match.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reports.map((report) => (
                      <TableRow key={report.id}>
                        {/* Subject + type (team / player) inline. */}
                        <TableCell>
                          <div className="font-medium">
                            {report.subject_name ?? "Unknown"}
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
                              {REPORT_CATEGORY_LABELS[report.category] ??
                                report.category}
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
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {report.created_at
                            ? formatDate(report.created_at)
                            : "-"}
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
                              Resolve
                            </Button>
                            {report.status !== "banned" && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setBanTarget(report)}
                                title="Ban the reported team or player"
                              >
                                <IconBan className="h-3.5 w-3.5 mr-1" />
                                Ban
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
                                title="Ban the reporter for a false or abusive report"
                              >
                                <IconFlag className="h-3.5 w-3.5 mr-1" />
                                Ban reporter
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
            {reports.length} report{reports.length === 1 ? "" : "s"} shown.{" "}
            {openReportsCount} open and awaiting review. Newest first.
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
            <DialogTitle>Suspend Listing</DialogTitle>
            <DialogDescription>
              Please provide a reason for this action. This will be logged in
              the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason *</label>
              <Textarea
                placeholder="Enter reason for this action..."
                rows={4}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                toast.success(
                  `Listing ${suspendModal.listingId} suspended successfully`,
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
              Confirm
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
              <DialogTitle>Trial Timeline</DialogTitle>
              <DialogDescription>
                Detailed timeline for trial {viewTrial.id}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Player & Team */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Player</p>
                  <p className="font-semibold">{viewTrial.player}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Team</p>
                  <p className="font-semibold">{viewTrial.team}</p>
                </div>
              </div>

              {/* Start Date & Status */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <p className="text-sm font-medium">{viewTrial.startDate}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={getStatusVariant(viewTrial.status)}>
                    {viewTrial.status}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Timeline Events */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Timeline Events</h4>
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
                          {event.date}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
              {viewTrial.status === "Ongoing" && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    toast.success(`Trial ${viewTrial.id} cancelled`);
                    setViewTrial(null);
                  }}
                >
                  Cancel Trial
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
              <DialogTitle>Review Report</DialogTitle>
              <DialogDescription>Report ID: {viewReport.id}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Reported By & Entity */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Reported By</p>
                  <p className="font-semibold">{viewReport.reportedBy}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    Reported Entity
                  </p>
                  <p className="font-semibold">{viewReport.reportedEntity}</p>
                </div>
              </div>

              {/* Date & Severity */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm font-medium">{viewReport.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Severity</p>
                  <Badge variant={getSeverityVariant(viewReport.severity)}>
                    {viewReport.severity}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Reason */}
              <div>
                <p className="text-xs text-muted-foreground">Reason</p>
                <p className="text-sm font-medium">{viewReport.reason}</p>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="text-sm">{viewReport.description}</p>
              </div>

              {/* Evidence */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Evidence</p>
                <Button variant="outline" size="sm" className="text-xs">
                  <IconEye className="h-3.5 w-3.5 mr-1" />
                  View Evidence ({viewReport.evidenceCount} files)
                </Button>
              </div>

              {/* Previous Reports */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Previous Reports
                </p>
                <Button variant="outline" size="sm" className="text-xs">
                  <IconClipboardList className="h-3.5 w-3.5 mr-1" />
                  View Previous Reports ({viewReport.previousReportsCount})
                </Button>
              </div>

              <Separator />

              {/* Take Action */}
              {viewReport.status !== "Resolved" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Take Action *</label>
                  <Select value={reportAction} onValueChange={setReportAction}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select action..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warn">Warn</SelectItem>
                      <SelectItem value="suspend">Suspend Listing</SelectItem>
                      <SelectItem value="ban">Ban User</SelectItem>
                      <SelectItem value="dismiss">Dismiss</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
              {viewReport.status !== "Resolved" && (
                <Button
                  onClick={() => {
                    toast.success(
                      `Action "${reportAction}" taken on report ${viewReport.id}`,
                    );
                    setViewReport(null);
                    setReportAction("");
                  }}
                  disabled={!reportAction}
                >
                  Confirm Action
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
            <DialogTitle>Resolve report</DialogTitle>
            <DialogDescription>
              {resolveTarget
                ? `${resolveTarget.subject_name ?? "Unknown"} - ${
                    REPORT_CATEGORY_LABELS[resolveTarget.category] ??
                    resolveTarget.category
                  }`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {resolveTarget && (
            <div className="space-y-4">
              {/* Reporter + subject context (read-only). */}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="text-muted-foreground">
                  Reporter:{" "}
                  <span className="text-foreground">
                    {resolveTarget.reporter_username || "-"}
                  </span>
                </span>
                <span className="text-muted-foreground capitalize">
                  Subject:{" "}
                  <span className="text-foreground">
                    {resolveTarget.subject_name} ({resolveTarget.subject_type})
                  </span>
                </span>
              </div>

              {/* The reporter's written details (read-only context). */}
              {resolveTarget.details && (
                <div className="space-y-1">
                  <Label>What the reporter said</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md border border-l-2 border-l-primary bg-muted/30 p-3">
                    {resolveTarget.details}
                  </p>
                </div>
              )}

              {/* Evidence image (read-only) - shown when the reporter attached one. */}
              {resolveTarget.evidence && (
                <div className="space-y-2">
                  <Label>Evidence</Label>
                  <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
                    {/* Reporter-supplied evidence comes from an upload host - plain <img>. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveTarget.evidence}
                      alt="Report evidence"
                      className="size-full object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Status. */}
              <div className="space-y-2">
                <Label htmlFor="resolve-status">Status</Label>
                <Select
                  value={resolveStatus}
                  onValueChange={setResolveStatus}
                >
                  <SelectTrigger id="resolve-status" className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="reviewing">Reviewing</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Resolution notes. */}
              <div className="space-y-2">
                <Label htmlFor="resolve-notes">
                  Resolution notes{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="resolve-notes"
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="What was found, and what action was taken..."
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
              Cancel
            </Button>
            <Button disabled={resolveSaving} onClick={saveResolve}>
              {resolveSaving ? "Saving..." : "Save changes"}
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
              Ban reporter (false report)
            </DialogTitle>
            <DialogDescription>
              Bans{" "}
              <span className="font-medium text-foreground">
                {banReporterTarget?.reporter_username ?? "this reporter"}
              </span>{" "}
              from the Player Market for filing a false or abusive report. They
              will no longer be able to create posts, apply, or invite. This
              report is closed as dismissed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="space-y-2">
              <Label htmlFor="ban-reporter-reason">
                Reason <span className="text-red-500">*</span>{" "}
                <span className="text-muted-foreground">
                  (shown to the banned reporter)
                </span>
              </Label>
              <Textarea
                id="ban-reporter-reason"
                value={banReporterReason}
                onChange={(e) => setBanReporterReason(e.target.value)}
                rows={3}
                placeholder="Explain why this reporter is being banned. Reference that the report was false or abusive."
              />
            </div>
            <p className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-muted-foreground">
              This is a permanent market ban on the reporter. Use it only when a
              report is clearly false, fabricated, or abusive.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setBanReporterTarget(null)}
              disabled={banReporterSaving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBanReporter}
              disabled={banReporterSaving || !banReporterReason.trim()}
            >
              <IconFlag className="h-4 w-4 mr-1" />
              {banReporterSaving ? "Banning..." : "Ban reporter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
