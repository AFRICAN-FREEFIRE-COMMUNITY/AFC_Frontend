"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  IconUsers,
  IconUser,
  IconSearch,
  IconEye,
  IconEyeOff,
  IconBan,
  IconClock,
  IconAlertTriangle,
  IconFileText,
  IconShield,
  IconCircleCheck,
  IconClipboardList,
} from "@tabler/icons-react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AdminPlayerMarketPage() {
  const [activeTab, setActiveTab] = useState("overview");

  // Team Listings state
  const [teamSearch, setTeamSearch] = useState("");
  const [teamStatusFilter, setTeamStatusFilter] = useState("all");
  const [viewTeamListing, setViewTeamListing] =
    useState<MockTeamListing | null>(null);

  // Player Listings state
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerStatusFilter, setPlayerStatusFilter] = useState("all");
  const [viewPlayerListing, setViewPlayerListing] =
    useState<MockPlayerListing | null>(null);

  // Suspend modal state
  const [suspendModal, setSuspendModal] = useState<{
    open: boolean;
    listingId: string | null;
    listingType: "team" | "player";
  }>({ open: false, listingId: null, listingType: "team" });
  const [suspendReason, setSuspendReason] = useState("");

  // Trials state
  const [viewTrial, setViewTrial] = useState<MockTrial | null>(null);

  // Reports state
  const [viewReport, setViewReport] = useState<MockReport | null>(null);
  const [reportAction, setReportAction] = useState("");

  // Filtered data
  const filteredTeamListings = useMemo(() => {
    return mockTeamListings.filter((t) => {
      const matchesSearch =
        t.teamName.toLowerCase().includes(teamSearch.toLowerCase()) ||
        t.id.toLowerCase().includes(teamSearch.toLowerCase());
      const matchesStatus =
        teamStatusFilter === "all" || t.status === teamStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [teamSearch, teamStatusFilter]);

  const filteredPlayerListings = useMemo(() => {
    return mockPlayerListings.filter((p) => {
      const matchesSearch =
        p.ign.toLowerCase().includes(playerSearch.toLowerCase()) ||
        p.id.toLowerCase().includes(playerSearch.toLowerCase());
      const matchesStatus =
        playerStatusFilter === "all" || p.status === playerStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [playerSearch, playerStatusFilter]);

  // Overview stats (derived from mock data)
  const activeTeamListings = mockTeamListings.filter(
    (t) => t.status === "Active",
  ).length;
  const activePlayerListings = mockPlayerListings.filter(
    (p) => p.status === "Active",
  ).length;
  const activeTrials = mockTrials.filter((t) => t.status === "Ongoing").length;
  const pendingReports = mockReports.filter(
    (r) => r.status === "Pending",
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Player Market Administration"
        description="Comprehensive management, control, and oversight of all player market activities"
        back
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea>
          <TabsList className="w-full">
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
          {/* Stat Cards */}
          <div className="grid gap-2 grid-cols-1 md:grid-cols-2 2xl:grid-cols-4">
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
                  {mockTrials.length} total
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
                  {mockReports.length} total reports
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
          <div className="flex flex-col md:flex-row gap-2 items-start md:items-center justify-between">
            <div className="relative flex-1 w-full md:max-w-sm">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by team name or ID..."
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
                <SelectItem value="Suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Team Name</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Roles Needed</TableHead>
                    <TableHead>Applications</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeamListings.map((listing) => (
                    <TableRow key={listing.id}>
                      <TableCell className="font-mono text-sm">
                        {listing.id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">
                            {listing.teamName}
                          </span>
                          {listing.verified ? (
                            <IconCircleCheck className="h-4 w-4 text-green-500" />
                          ) : (
                            <IconAlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {listing.tier}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {listing.rolesNeeded.map((role) => (
                            <Badge
                              key={role}
                              variant="outline"
                              className="text-xs"
                            >
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{listing.applications}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {listing.postedDate}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {listing.expiryDate}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(listing.status)}>
                          {listing.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Toggle visibility"
                            onClick={() =>
                              toast.info(
                                `Toggled visibility for ${listing.teamName}`,
                              )
                            }
                          >
                            {listing.status === "Active" ? (
                              <IconEyeOff className="h-4 w-4" />
                            ) : (
                              <IconEye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Suspend listing"
                            onClick={() => {
                              setSuspendModal({
                                open: true,
                                listingId: listing.id,
                                listingType: "team",
                              });
                              setSuspendReason("");
                            }}
                          >
                            <IconBan className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="View details"
                            onClick={() => setViewTeamListing(listing)}
                          >
                            <IconEye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTeamListings.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center text-muted-foreground py-8"
                      >
                        No team listings found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 3: Player Listings ─────────────────────────────── */}
        <TabsContent value="player-listings" className="mt-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-2 items-start md:items-center justify-between">
            <div className="relative flex-1 w-full md:max-w-sm">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by IGN or ID..."
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
                <SelectItem value="Hidden">Hidden</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>IGN</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Primary Role</TableHead>
                    <TableHead>Invitations</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlayerListings.map((listing) => (
                    <TableRow key={listing.id}>
                      <TableCell className="font-mono text-sm">
                        {listing.id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{listing.ign}</span>
                          {listing.verified ? (
                            <IconCircleCheck className="h-4 w-4 text-green-500" />
                          ) : listing.flagged ? (
                            <IconAlertTriangle className="h-4 w-4 text-yellow-500" />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {listing.tier}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {listing.primaryRole}
                        </Badge>
                      </TableCell>
                      <TableCell>{listing.invitations}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {listing.postedDate}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {listing.expiryDate}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(listing.status)}>
                          {listing.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Toggle visibility"
                            onClick={() =>
                              toast.info(
                                `Toggled visibility for ${listing.ign}`,
                              )
                            }
                          >
                            {listing.status === "Active" ? (
                              <IconEyeOff className="h-4 w-4" />
                            ) : (
                              <IconEye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Suspend listing"
                            onClick={() => {
                              setSuspendModal({
                                open: true,
                                listingId: listing.id,
                                listingType: "player",
                              });
                              setSuspendReason("");
                            }}
                          >
                            <IconBan className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="View details"
                            onClick={() => setViewPlayerListing(listing)}
                          >
                            <IconEye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredPlayerListings.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center text-muted-foreground py-8"
                      >
                        No player listings found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 4: Trials & Applications ───────────────────────── */}
        <TabsContent value="trials" className="mt-4 space-y-4">
          <h2 className="text-lg font-semibold">
            Active Trials & Applications
          </h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trial ID</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Days Remaining</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockTrials.map((trial) => (
                    <TableRow key={trial.id}>
                      <TableCell className="font-mono text-sm">
                        {trial.id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {trial.player}
                      </TableCell>
                      <TableCell>{trial.team}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(trial.status)}>
                          {trial.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {trial.status === "Accepted" ? (
                          <span className="flex items-center gap-1 text-sm text-green-500">
                            <CheckCircle2 className="h-4 w-4" />
                            Accepted
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <IconClock className="h-4 w-4" />
                            {trial.daysRemaining} days
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="View timeline"
                            onClick={() => setViewTrial(trial)}
                          >
                            <IconFileText className="h-4 w-4" />
                          </Button>
                          {trial.status === "Ongoing" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Cancel trial"
                              onClick={() =>
                                toast.info(
                                  `Trial ${trial.id} cancellation initiated`,
                                )
                              }
                            >
                              <IconClock className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 5: Reports & Flags ─────────────────────────────── */}
        <TabsContent value="reports" className="mt-4 space-y-4">
          <h2 className="text-lg font-semibold">Reports & Flagged Content</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report ID</TableHead>
                    <TableHead>Reported By</TableHead>
                    <TableHead>Reported Entity</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-mono text-sm">
                        {report.id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {report.reportedBy}
                      </TableCell>
                      <TableCell>{report.reportedEntity}</TableCell>
                      <TableCell>
                        <Badge variant={getSeverityVariant(report.severity)}>
                          {report.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(report.status)}>
                          {report.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Review report"
                            onClick={() => setViewReport(report)}
                          >
                            <IconEye className="h-4 w-4" />
                          </Button>
                          {report.status !== "Resolved" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Resolve"
                              onClick={() =>
                                toast.success(
                                  `Report ${report.id} marked as resolved`,
                                )
                              }
                            >
                              <IconCircleCheck className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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

      {/* ─── Team Listing Details Modal ─────────────────────────────── */}
      <Dialog
        open={!!viewTeamListing}
        onOpenChange={(open) => {
          if (!open) setViewTeamListing(null);
        }}
      >
        {viewTeamListing && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Team Listing Details</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* ID & Status */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">ID</p>
                  <p className="font-mono font-semibold">
                    {viewTeamListing.id}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={getStatusVariant(viewTeamListing.status)}>
                    {viewTeamListing.status}
                  </Badge>
                </div>
              </div>

              {/* Tier & Posted */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Tier</p>
                  <Badge variant="secondary" className="mt-0.5">
                    {viewTeamListing.tier}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Posted Date</p>
                  <p className="text-sm font-medium">
                    {viewTeamListing.postedDate}
                  </p>
                </div>
              </div>

              {/* Expiry & Verified */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Expiry Date</p>
                  <p className="text-sm font-medium">
                    {viewTeamListing.expiryDate}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Verified</p>
                  <p className="text-sm font-medium">
                    {viewTeamListing.verified ? "Yes" : "No"}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Team Name */}
              <div>
                <p className="text-xs text-muted-foreground">Team Name</p>
                <p className="font-semibold text-lg">
                  {viewTeamListing.teamName}
                </p>
              </div>

              {/* Roles Needed */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Roles Needed
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {viewTeamListing.rolesNeeded.map((role) => (
                    <Badge key={role} variant="default" className="text-xs">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="text-sm">{viewTeamListing.description}</p>
              </div>

              {/* Requirements */}
              <div>
                <p className="text-xs text-muted-foreground">Requirements</p>
                <p className="text-sm">{viewTeamListing.requirements}</p>
              </div>

              {/* Recent Performance */}
              <div>
                <p className="text-xs text-muted-foreground">
                  Recent Performance
                </p>
                <p className="text-sm">{viewTeamListing.recentPerformance}</p>
              </div>

              <Separator />

              {/* Applications */}
              <div>
                <p className="text-xs text-muted-foreground">Applications</p>
                <p className="text-sm font-medium">
                  {viewTeamListing.applications} applications received
                </p>
              </div>

              {/* Applications Received */}
              <div>
                <p className="text-sm font-semibold mb-2">
                  Applications Received
                </p>
                <div className="space-y-2">
                  {viewTeamListing.applicationsReceived.map((app, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-sm">
                          {app.playerName}{" "}
                          <Badge variant="secondary" className="text-xs ml-1">
                            {app.tier}
                          </Badge>{" "}
                          <Badge variant="outline" className="text-xs ml-1">
                            {app.role}
                          </Badge>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Applied: {app.appliedDate}
                        </p>
                      </div>
                      <Badge variant={getStatusVariant(app.status)}>
                        {app.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ─── Player Listing Details Modal ───────────────────────────── */}
      <Dialog
        open={!!viewPlayerListing}
        onOpenChange={(open) => {
          if (!open) setViewPlayerListing(null);
        }}
      >
        {viewPlayerListing && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Player Listing Details</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* ID & Status */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">ID</p>
                  <p className="font-mono font-semibold">
                    {viewPlayerListing.id}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={getStatusVariant(viewPlayerListing.status)}>
                    {viewPlayerListing.status}
                  </Badge>
                </div>
              </div>

              {/* Tier & Posted */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Tier</p>
                  <Badge variant="secondary" className="mt-0.5">
                    {viewPlayerListing.tier}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Posted Date</p>
                  <p className="text-sm font-medium">
                    {viewPlayerListing.postedDate}
                  </p>
                </div>
              </div>

              {/* Expiry & Verified */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Expiry Date</p>
                  <p className="text-sm font-medium">
                    {viewPlayerListing.expiryDate}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Verified</p>
                  <p className="text-sm font-medium">
                    {viewPlayerListing.verified ? "Yes" : "No"}
                  </p>
                </div>
              </div>

              <Separator />

              {/* IGN */}
              <div>
                <p className="text-xs text-muted-foreground">IGN</p>
                <p className="font-semibold text-lg">{viewPlayerListing.ign}</p>
              </div>

              {/* Roles */}
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Primary Role
                  </p>
                  <Badge variant="default" className="text-xs">
                    {viewPlayerListing.primaryRole}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Secondary Role
                  </p>
                  <Badge variant="secondary" className="text-xs">
                    {viewPlayerListing.secondaryRole}
                  </Badge>
                </div>
              </div>

              {/* Bio */}
              <div>
                <p className="text-xs text-muted-foreground">Bio</p>
                <p className="text-sm">{viewPlayerListing.bio}</p>
              </div>

              {/* Availability */}
              <div>
                <p className="text-xs text-muted-foreground">Availability</p>
                <p className="text-sm">{viewPlayerListing.availability}</p>
              </div>

              {/* Achievements */}
              <div>
                <p className="text-xs text-muted-foreground">Achievements</p>
                <p className="text-sm">{viewPlayerListing.achievements}</p>
              </div>

              <Separator />

              {/* Invitations */}
              <div>
                <p className="text-xs text-muted-foreground">Invitations</p>
                <p className="text-sm font-medium">
                  {viewPlayerListing.invitations} invitations received
                </p>
              </div>

              {/* Invitations Received */}
              <div>
                <p className="text-sm font-semibold mb-2">
                  Invitations Received
                </p>
                <div className="space-y-2">
                  {viewPlayerListing.invitationsReceived.map((inv, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-sm">
                          {inv.teamName}{" "}
                          <Badge variant="outline" className="text-xs ml-1">
                            {inv.role}
                          </Badge>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Invited: {inv.invitedDate}
                        </p>
                      </div>
                      <Badge variant={getStatusVariant(inv.status)}>
                        {inv.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        )}
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
    </div>
  );
}
