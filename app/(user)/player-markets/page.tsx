"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  IconSearch,
  IconUsers,
  IconUser,
  IconTrophy,
  IconTarget,
  IconShield,
  IconMapPin,
  IconClock,
  IconCalendar,
  IconPlus,
  IconChevronRight,
  IconStar,
  IconInfoCircle,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { DEFAULT_IMAGE } from "@/constants";

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLES = ["Entry Fragger", "Support", "IGL", "Sniper", "Flex", "Rusher"];

const TIERS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master"];

const REGIONS = [
  "West Africa",
  "East Africa",
  "Southern Africa",
  "North Africa",
];

const COMMITMENTS = ["Casual", "Semi-Pro", "Competitive"];

const AVAILABILITIES = ["Immediate", "Within a week", "Flexible"];

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface TeamRecruitmentPost {
  id: number;
  teamName: string;
  teamLogo: string;
  rolesNeeded: string[];
  minTier: string;
  commitment: string;
  region: string;
  criteria: string;
  postedBy: string;
  postedAt: string;
  expiresAt: string;
  membersCount: number;
  winsCount: number;
  tournamentsPlayed: number;
}

interface PlayerAvailablePost {
  id: number;
  playerName: string;
  playerAvatar: string;
  primaryRole: string;
  secondaryRole: string;
  tier: string;
  availability: string;
  region: string;
  additionalInfo: string;
  postedAt: string;
  expiresAt: string;
  tournamentsPlayed: number;
  winRate: number;
  tierHistory: { season: string; tier: string }[];
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const mockTeamPosts: TeamRecruitmentPost[] = [
  {
    id: 1,
    teamName: "Phoenix Esports",
    teamLogo: DEFAULT_IMAGE,
    rolesNeeded: ["Entry Fragger", "Support"],
    minTier: "Gold",
    commitment: "Competitive",
    region: "West Africa",
    criteria:
      "We are looking for dedicated players who can commit to daily practice sessions and weekend tournaments. Must have experience in competitive Free Fire.",
    postedBy: "Commander_X",
    postedAt: "2026-02-10",
    expiresAt: "2026-03-10",
    membersCount: 3,
    winsCount: 24,
    tournamentsPlayed: 15,
  },
  {
    id: 2,
    teamName: "Shadow Wolves",
    teamLogo: DEFAULT_IMAGE,
    rolesNeeded: ["IGL", "Sniper"],
    minTier: "Platinum",
    commitment: "Semi-Pro",
    region: "East Africa",
    criteria:
      "Looking for an experienced IGL who can lead the team in ranked and tournament matches. Sniper should have 70%+ headshot rate.",
    postedBy: "WolfLeader",
    postedAt: "2026-02-12",
    expiresAt: "2026-03-12",
    membersCount: 2,
    winsCount: 18,
    tournamentsPlayed: 10,
  },
  {
    id: 3,
    teamName: "Viper Squad",
    teamLogo: DEFAULT_IMAGE,
    rolesNeeded: ["Flex", "Rusher", "Support"],
    minTier: "Silver",
    commitment: "Casual",
    region: "Southern Africa",
    criteria:
      "Chill team looking for players who want to have fun and improve together. No toxicity tolerated. Active on weekends mainly.",
    postedBy: "ViperKing",
    postedAt: "2026-02-08",
    expiresAt: "2026-03-08",
    membersCount: 1,
    winsCount: 7,
    tournamentsPlayed: 5,
  },
  {
    id: 4,
    teamName: "Blaze Gaming",
    teamLogo: DEFAULT_IMAGE,
    rolesNeeded: ["Entry Fragger"],
    minTier: "Diamond",
    commitment: "Competitive",
    region: "West Africa",
    criteria:
      "Top-tier team recruiting an aggressive entry fragger. Must be available for scrims 5 days a week. Previous LAN experience preferred.",
    postedBy: "BlazeAdmin",
    postedAt: "2026-02-13",
    expiresAt: "2026-03-13",
    membersCount: 3,
    winsCount: 42,
    tournamentsPlayed: 22,
  },
  {
    id: 5,
    teamName: "Storm Riders",
    teamLogo: DEFAULT_IMAGE,
    rolesNeeded: ["Support", "IGL"],
    minTier: "Gold",
    commitment: "Semi-Pro",
    region: "North Africa",
    criteria:
      "Growing team with strong aim but needs better coordination. Looking for an IGL who can call strategies and a support player for utility usage.",
    postedBy: "StormCap",
    postedAt: "2026-02-11",
    expiresAt: "2026-03-11",
    membersCount: 2,
    winsCount: 12,
    tournamentsPlayed: 8,
  },
  {
    id: 6,
    teamName: "Apex Legends FC",
    teamLogo: DEFAULT_IMAGE,
    rolesNeeded: ["Sniper", "Flex"],
    minTier: "Platinum",
    commitment: "Competitive",
    region: "East Africa",
    criteria:
      "Professional outfit seeking skilled players. Must be able to adapt to multiple playstyles. Consistent tournament participation required.",
    postedBy: "ApexBoss",
    postedAt: "2026-02-09",
    expiresAt: "2026-03-09",
    membersCount: 2,
    winsCount: 31,
    tournamentsPlayed: 18,
  },
];

const mockPlayerPosts: PlayerAvailablePost[] = [
  {
    id: 1,
    playerName: "FireStrike_99",
    playerAvatar: DEFAULT_IMAGE,
    primaryRole: "Entry Fragger",
    secondaryRole: "Rusher",
    tier: "Diamond",
    availability: "Immediate",
    region: "West Africa",
    additionalInfo:
      "3 years of competitive experience. Previously played for Team Nova. Looking for a serious competitive team aiming for major tournaments.",
    postedAt: "2026-02-13",
    expiresAt: "2026-03-13",
    tournamentsPlayed: 28,
    winRate: 68,
    tierHistory: [
      { season: "Season 8", tier: "Diamond" },
      { season: "Season 7", tier: "Platinum" },
      { season: "Season 6", tier: "Platinum" },
      { season: "Season 5", tier: "Gold" },
    ],
  },
  {
    id: 2,
    playerName: "ShadowSnipe",
    playerAvatar: DEFAULT_IMAGE,
    primaryRole: "Sniper",
    secondaryRole: "Support",
    tier: "Platinum",
    availability: "Within a week",
    region: "East Africa",
    additionalInfo:
      "Sniper main with 75% headshot rate. Can also play support role. Available evenings and weekends.",
    postedAt: "2026-02-12",
    expiresAt: "2026-03-12",
    tournamentsPlayed: 15,
    winRate: 54,
    tierHistory: [
      { season: "Season 8", tier: "Platinum" },
      { season: "Season 7", tier: "Gold" },
      { season: "Season 6", tier: "Gold" },
    ],
  },
  {
    id: 3,
    playerName: "TacticalMind",
    playerAvatar: DEFAULT_IMAGE,
    primaryRole: "IGL",
    secondaryRole: "Flex",
    tier: "Master",
    availability: "Immediate",
    region: "West Africa",
    additionalInfo:
      "Experienced IGL with deep game knowledge. Led my previous team to multiple tournament finals. Looking for a dedicated roster.",
    postedAt: "2026-02-11",
    expiresAt: "2026-03-11",
    tournamentsPlayed: 42,
    winRate: 72,
    tierHistory: [
      { season: "Season 8", tier: "Master" },
      { season: "Season 7", tier: "Diamond" },
      { season: "Season 6", tier: "Diamond" },
      { season: "Season 5", tier: "Platinum" },
    ],
  },
  {
    id: 4,
    playerName: "QuickDraw_KE",
    playerAvatar: DEFAULT_IMAGE,
    primaryRole: "Rusher",
    secondaryRole: "Entry Fragger",
    tier: "Gold",
    availability: "Flexible",
    region: "East Africa",
    additionalInfo:
      "Aggressive playstyle, good at close-range combat. Learning to be more versatile. Open to any team that wants to grow together.",
    postedAt: "2026-02-10",
    expiresAt: "2026-03-10",
    tournamentsPlayed: 8,
    winRate: 45,
    tierHistory: [
      { season: "Season 8", tier: "Gold" },
      { season: "Season 7", tier: "Silver" },
    ],
  },
  {
    id: 5,
    playerName: "Guardian_SA",
    playerAvatar: DEFAULT_IMAGE,
    primaryRole: "Support",
    secondaryRole: "IGL",
    tier: "Platinum",
    availability: "Immediate",
    region: "Southern Africa",
    additionalInfo:
      "Support main who excels at utility and team coordination. Good communication skills. Looking for competitive team.",
    postedAt: "2026-02-09",
    expiresAt: "2026-03-09",
    tournamentsPlayed: 20,
    winRate: 60,
    tierHistory: [
      { season: "Season 8", tier: "Platinum" },
      { season: "Season 7", tier: "Platinum" },
      { season: "Season 6", tier: "Gold" },
    ],
  },
  {
    id: 6,
    playerName: "FlexKing_NG",
    playerAvatar: DEFAULT_IMAGE,
    primaryRole: "Flex",
    secondaryRole: "Sniper",
    tier: "Diamond",
    availability: "Within a week",
    region: "West Africa",
    additionalInfo:
      "Versatile player who can fill any role. Strong game sense and decision-making. Previous experience in regional qualifiers.",
    postedAt: "2026-02-08",
    expiresAt: "2026-03-08",
    tournamentsPlayed: 32,
    winRate: 63,
    tierHistory: [
      { season: "Season 8", tier: "Diamond" },
      { season: "Season 7", tier: "Diamond" },
      { season: "Season 6", tier: "Platinum" },
      { season: "Season 5", tier: "Gold" },
    ],
  },
];

// ─── Helper ──────────────────────────────────────────────────────────────────

function getTierColor(tier: string) {
  switch (tier) {
    case "Bronze":
      return "bg-orange-900/20 text-orange-400 border-orange-800";
    case "Silver":
      return "bg-gray-500/20 text-gray-300 border-gray-600";
    case "Gold":
      return "bg-yellow-900/20 text-yellow-400 border-yellow-800";
    case "Platinum":
      return "bg-cyan-900/20 text-cyan-400 border-cyan-800";
    case "Diamond":
      return "bg-blue-900/20 text-blue-400 border-blue-800";
    case "Master":
      return "bg-purple-900/20 text-purple-400 border-purple-800";
    default:
      return "";
  }
}

function formatPostDate(date: string) {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PlayerMarketPage() {
  const [activeTab, setActiveTab] = useState("teams");

  // Create Post dialog
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [createPostType, setCreatePostType] = useState<
    "team" | "player" | null
  >(null);

  // Create Post form state — Team
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamRoles, setNewTeamRoles] = useState<string[]>([]);
  const [newTeamMinTier, setNewTeamMinTier] = useState("");
  const [newTeamCommitment, setNewTeamCommitment] = useState("");
  const [newTeamRegion, setNewTeamRegion] = useState("");
  const [newTeamCriteria, setNewTeamCriteria] = useState("");
  const [newTeamExpiry, setNewTeamExpiry] = useState("");

  // Create Post form state — Player
  const [newPlayerPrimary, setNewPlayerPrimary] = useState("");
  const [newPlayerSecondary, setNewPlayerSecondary] = useState("");
  const [newPlayerAvailability, setNewPlayerAvailability] = useState("");
  const [newPlayerRegion, setNewPlayerRegion] = useState("");
  const [newPlayerInfo, setNewPlayerInfo] = useState("");
  const [newPlayerExpiry, setNewPlayerExpiry] = useState("");

  // View Details dialogs
  const [viewTeam, setViewTeam] = useState<TeamRecruitmentPost | null>(null);
  const [viewPlayer, setViewPlayer] = useState<PlayerAvailablePost | null>(
    null,
  );

  // Teams tab filters
  const [teamSearch, setTeamSearch] = useState("");
  const [teamRegionFilter, setTeamRegionFilter] = useState("all");
  const [teamCommitmentFilter, setTeamCommitmentFilter] = useState("all");
  const [teamTierFilter, setTeamTierFilter] = useState("all");

  // Players tab filters
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerRegionFilter, setPlayerRegionFilter] = useState("all");
  const [playerAvailabilityFilter, setPlayerAvailabilityFilter] =
    useState("all");
  const [playerRoleFilter, setPlayerRoleFilter] = useState("all");

  // Filtered data
  const filteredTeams = useMemo(() => {
    return mockTeamPosts.filter((team) => {
      const matchesSearch = team.teamName
        .toLowerCase()
        .includes(teamSearch.toLowerCase());
      const matchesRegion =
        teamRegionFilter === "all" || team.region === teamRegionFilter;
      const matchesCommitment =
        teamCommitmentFilter === "all" ||
        team.commitment === teamCommitmentFilter;
      const matchesTier =
        teamTierFilter === "all" || team.minTier === teamTierFilter;
      return matchesSearch && matchesRegion && matchesCommitment && matchesTier;
    });
  }, [teamSearch, teamRegionFilter, teamCommitmentFilter, teamTierFilter]);

  const filteredPlayers = useMemo(() => {
    return mockPlayerPosts.filter((player) => {
      const matchesSearch = player.playerName
        .toLowerCase()
        .includes(playerSearch.toLowerCase());
      const matchesRegion =
        playerRegionFilter === "all" || player.region === playerRegionFilter;
      const matchesAvailability =
        playerAvailabilityFilter === "all" ||
        player.availability === playerAvailabilityFilter;
      const matchesRole =
        playerRoleFilter === "all" ||
        player.primaryRole === playerRoleFilter ||
        player.secondaryRole === playerRoleFilter;
      return (
        matchesSearch && matchesRegion && matchesAvailability && matchesRole
      );
    });
  }, [
    playerSearch,
    playerRegionFilter,
    playerAvailabilityFilter,
    playerRoleFilter,
  ]);

  // Handlers
  const resetCreateForm = () => {
    setCreatePostType(null);
    setNewTeamName("");
    setNewTeamRoles([]);
    setNewTeamMinTier("");
    setNewTeamCommitment("");
    setNewTeamRegion("");
    setNewTeamCriteria("");
    setNewTeamExpiry("");
    setNewPlayerPrimary("");
    setNewPlayerSecondary("");
    setNewPlayerAvailability("");
    setNewPlayerRegion("");
    setNewPlayerInfo("");
    setNewPlayerExpiry("");
  };

  const handleCreateTeamPost = () => {
    toast.success("Team recruitment post created successfully!");
    setCreatePostOpen(false);
    resetCreateForm();
  };

  const handleCreatePlayerPost = () => {
    toast.success("Player availability post created successfully!");
    setCreatePostOpen(false);
    resetCreateForm();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center md:flex-row w-full justify-between gap-4">
        <PageHeader
          title="Player Market"
          description="Find teammates or advertise your availability"
        />
        <Button
          className="w-full md:w-auto"
          onClick={() => {
            resetCreateForm();
            setCreatePostOpen(true);
          }}
        >
          <IconPlus className="h-4 w-4 mr-1" />
          Create Post
        </Button>
      </div>

      {/* Info Banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="flex items-start gap-3">
          <IconInfoCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p>
              All recruitment and trials are governed by AFC rules.
              Communication unlocks after trial invitation. Teams & players
              should make sure to screen record and screenshot incidents they
              might have faced during their trial, that they might want to
              report.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea>
          <TabsList className="w-full">
            <TabsTrigger value="teams" className="flex-1">
              <IconUsers className="h-4 w-4 mr-1.5" />
              Teams Recruiting
            </TabsTrigger>
            <TabsTrigger value="players" className="flex-1">
              <IconUser className="h-4 w-4 mr-1.5" />
              Players Open to Join
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* ─── Teams Recruiting Tab ─────────────────────────────────── */}
        <TabsContent value="teams" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={teamRegionFilter}
              onValueChange={setTeamRegionFilter}
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={teamCommitmentFilter}
              onValueChange={setTeamCommitmentFilter}
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Commitment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {COMMITMENTS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={teamTierFilter} onValueChange={setTeamTierFilter}>
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Min Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                {TIERS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Team Cards Grid */}
          {filteredTeams.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <IconUsers className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No teams found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredTeams.map((team) => (
                <Card
                  key={team.id}
                  className="hover:border-primary/50 transition-colors"
                >
                  <CardContent className="space-y-3">
                    {/* Team header */}
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={team.teamLogo} alt={team.teamName} />
                        <AvatarFallback>
                          {team.teamName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {team.teamName}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Posted by {team.postedBy} &middot;{" "}
                          {formatPostDate(team.postedAt)}
                        </p>
                      </div>
                    </div>

                    {/* Roles needed */}
                    <div className="flex flex-wrap gap-1.5">
                      {team.rolesNeeded.map((role) => (
                        <Badge
                          key={role}
                          variant="secondary"
                          className="text-xs"
                        >
                          {role}
                        </Badge>
                      ))}
                    </div>

                    {/* Info row */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getTierColor(team.minTier)}`}
                      >
                        <IconShield className="h-3 w-3" />
                        {team.minTier}+
                      </span>
                      <span className="flex items-center gap-1">
                        <IconTarget className="h-3 w-3" />
                        {team.commitment}
                      </span>
                      <span className="flex items-center gap-1">
                        <IconMapPin className="h-3 w-3" />
                        {team.region}
                      </span>
                    </div>

                    <Separator />

                    {/* Stats + Action */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <IconUsers className="h-3.5 w-3.5" />
                          {team.membersCount}/4
                        </span>
                        <span className="flex items-center gap-1">
                          <IconTrophy className="h-3.5 w-3.5" />
                          {team.winsCount} wins
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => setViewTeam(team)}
                      >
                        View Details
                        <IconChevronRight className="h-3.5 w-3.5 ml-0.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Players Open to Join Tab ─────────────────────────────── */}
        <TabsContent value="players" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={playerRegionFilter}
              onValueChange={setPlayerRegionFilter}
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={playerAvailabilityFilter}
              onValueChange={setPlayerAvailabilityFilter}
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {AVAILABILITIES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={playerRoleFilter}
              onValueChange={setPlayerRoleFilter}
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Player Cards Grid */}
          {filteredPlayers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <IconUser className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No players found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredPlayers.map((player) => (
                <Card
                  key={player.id}
                  className="hover:border-primary/50 transition-colors"
                >
                  <CardContent className="space-y-3">
                    {/* Player header */}
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage
                          src={player.playerAvatar}
                          alt={player.playerName}
                        />
                        <AvatarFallback>
                          {player.playerName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {player.playerName}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {formatPostDate(player.postedAt)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getTierColor(player.tier)}`}
                      >
                        <IconShield className="h-3 w-3" />
                        {player.tier}
                      </span>
                    </div>

                    {/* Roles */}
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="default" className="text-xs">
                        {player.primaryRole}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {player.secondaryRole}
                      </Badge>
                    </div>

                    {/* Info row */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <IconClock className="h-3 w-3" />
                        {player.availability}
                      </span>
                      <span className="flex items-center gap-1">
                        <IconMapPin className="h-3 w-3" />
                        {player.region}
                      </span>
                    </div>

                    <Separator />

                    {/* Stats + Action */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <IconTrophy className="h-3.5 w-3.5" />
                          {player.tournamentsPlayed} tourneys
                        </span>
                        <span className="flex items-center gap-1">
                          <IconStar className="h-3.5 w-3.5" />
                          {player.winRate}% WR
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => setViewPlayer(player)}
                      >
                        View Details
                        <IconChevronRight className="h-3.5 w-3.5 ml-0.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Create Post Dialog ───────────────────────────────────────── */}
      <Dialog
        open={createPostOpen}
        onOpenChange={(open) => {
          setCreatePostOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {!createPostType
                ? "Create a Post"
                : createPostType === "team"
                  ? "Team Recruitment Post"
                  : "Player Available Post"}
            </DialogTitle>
            <DialogDescription>
              {!createPostType
                ? "Choose the type of post you want to create."
                : createPostType === "team"
                  ? "Fill in the details to recruit players for your team."
                  : "Let teams know you're available to join."}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Choose type */}
          {!createPostType && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
              <button
                onClick={() => setCreatePostType("team")}
                className="flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-muted hover:border-primary/50 transition-all text-center"
              >
                <IconUsers className="h-8 w-8 text-primary" />
                <span className="font-semibold">Team Recruiting</span>
                <span className="text-xs text-muted-foreground">
                  Find players for your team
                </span>
              </button>
              <button
                onClick={() => setCreatePostType("player")}
                className="flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-muted hover:border-primary/50 transition-all text-center"
              >
                <IconUser className="h-8 w-8 text-primary" />
                <span className="font-semibold">Player Available</span>
                <span className="text-xs text-muted-foreground">
                  Advertise your availability
                </span>
              </button>
            </div>
          )}

          {/* Team Recruiting Form */}
          {createPostType === "team" && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Team Name *</Label>
                <Input
                  placeholder="Enter your team name"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Roles Needed *</Label>
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  value={newTeamRoles}
                  onValueChange={setNewTeamRoles}
                  className="flex flex-wrap justify-start"
                >
                  {ROLES.map((role) => (
                    <ToggleGroupItem
                      key={role}
                      value={role}
                      className="text-xs"
                    >
                      {role}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Minimum Tier *</Label>
                  <Select
                    value={newTeamMinTier}
                    onValueChange={setNewTeamMinTier}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tier" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIERS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Commitment Level *</Label>
                  <Select
                    value={newTeamCommitment}
                    onValueChange={setNewTeamCommitment}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMITMENTS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Region *</Label>
                  <Select
                    value={newTeamRegion}
                    onValueChange={setNewTeamRegion}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {REGIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Expiry Date *</Label>
                  <Input
                    type="date"
                    value={newTeamExpiry}
                    onChange={(e) => setNewTeamExpiry(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Recruitment Criteria</Label>
                <Textarea
                  placeholder="Describe what you're looking for in a teammate..."
                  rows={4}
                  value={newTeamCriteria}
                  onChange={(e) => setNewTeamCriteria(e.target.value)}
                />
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCreatePostType(null)}
                >
                  Back
                </Button>
                <Button onClick={handleCreateTeamPost}>Create Post</Button>
              </DialogFooter>
            </div>
          )}

          {/* Player Available Form */}
          {createPostType === "player" && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Primary Role *</Label>
                  <Select
                    value={newPlayerPrimary}
                    onValueChange={setNewPlayerPrimary}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Secondary Role</Label>
                  <Select
                    value={newPlayerSecondary}
                    onValueChange={setNewPlayerSecondary}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Availability *</Label>
                  <Select
                    value={newPlayerAvailability}
                    onValueChange={setNewPlayerAvailability}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select availability" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABILITIES.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Region *</Label>
                  <Select
                    value={newPlayerRegion}
                    onValueChange={setNewPlayerRegion}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {REGIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Expiry Date *</Label>
                <Input
                  type="date"
                  value={newPlayerExpiry}
                  onChange={(e) => setNewPlayerExpiry(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Additional Info</Label>
                <Textarea
                  placeholder="Tell teams about yourself, your experience, and what you're looking for..."
                  rows={4}
                  value={newPlayerInfo}
                  onChange={(e) => setNewPlayerInfo(e.target.value)}
                />
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCreatePostType(null)}
                >
                  Back
                </Button>
                <Button onClick={handleCreatePlayerPost}>Create Post</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── View Team Details Dialog ─────────────────────────────────── */}
      <Dialog
        open={!!viewTeam}
        onOpenChange={(open) => {
          if (!open) setViewTeam(null);
        }}
      >
        {viewTeam && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  <AvatarImage
                    src={viewTeam.teamLogo}
                    alt={viewTeam.teamName}
                  />
                  <AvatarFallback>{viewTeam.teamName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-xl">
                    {viewTeam.teamName}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Posted by {viewTeam.postedBy} &middot;{" "}
                    {formatPostDate(viewTeam.postedAt)}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {/* Recruitment Criteria */}
              <div>
                <h4 className="text-sm font-semibold mb-1.5">
                  Recruitment Criteria
                </h4>
                <p className="text-sm text-muted-foreground">
                  {viewTeam.criteria}
                </p>
              </div>

              <Separator />

              {/* Roles & Requirements */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Roles Needed
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {viewTeam.rolesNeeded.map((role) => (
                      <Badge key={role} variant="secondary">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Min Tier</p>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border mt-1 ${getTierColor(viewTeam.minTier)}`}
                    >
                      <IconShield className="h-3 w-3" />
                      {viewTeam.minTier}+
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Commitment</p>
                    <p className="text-sm font-medium mt-1">
                      {viewTeam.commitment}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Region</p>
                    <p className="text-sm font-medium mt-1">
                      {viewTeam.region}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Team Performance */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Team Performance</h4>
                <div className="grid grid-cols-3 gap-3">
                  <Card className="bg-muted/50">
                    <CardContent className="py-3 text-center">
                      <p className="text-2xl font-bold">
                        {viewTeam.membersCount}/4
                      </p>
                      <p className="text-xs text-muted-foreground">Members</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="py-3 text-center">
                      <p className="text-2xl font-bold">{viewTeam.winsCount}</p>
                      <p className="text-xs text-muted-foreground">Wins</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="py-3 text-center">
                      <p className="text-2xl font-bold">
                        {viewTeam.tournamentsPlayed}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tournaments
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />

              {/* Eligibility */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Eligibility</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">
                    <IconMapPin className="h-3 w-3 mr-1" />
                    {viewTeam.region}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <IconCalendar className="h-3 w-3 mr-1" />
                    Expires {new Date(viewTeam.expiresAt).toLocaleDateString()}
                  </Badge>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
              <Button
                onClick={() => {
                  toast.success(`Application sent to ${viewTeam.teamName}!`);
                  setViewTeam(null);
                }}
              >
                Apply to Join
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ─── View Player Details Dialog ───────────────────────────────── */}
      <Dialog
        open={!!viewPlayer}
        onOpenChange={(open) => {
          if (!open) setViewPlayer(null);
        }}
      >
        {viewPlayer && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  <AvatarImage
                    src={viewPlayer.playerAvatar}
                    alt={viewPlayer.playerName}
                  />
                  <AvatarFallback>
                    {viewPlayer.playerName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-xl">
                    {viewPlayer.playerName}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="default" className="text-xs">
                      {viewPlayer.primaryRole}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {viewPlayer.secondaryRole}
                    </Badge>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getTierColor(viewPlayer.tier)}`}
                    >
                      {viewPlayer.tier}
                    </span>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {/* About */}
              <div>
                <h4 className="text-sm font-semibold mb-1.5">About</h4>
                <p className="text-sm text-muted-foreground">
                  {viewPlayer.additionalInfo}
                </p>
              </div>

              <Separator />

              {/* Tier History */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Tier History</h4>
                <div className="space-y-2">
                  {viewPlayer.tierHistory.map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                    >
                      <span className="text-sm text-muted-foreground">
                        {entry.season}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getTierColor(entry.tier)}`}
                      >
                        <IconShield className="h-3 w-3" />
                        {entry.tier}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Tournament Summary */}
              <div>
                <h4 className="text-sm font-semibold mb-2">
                  Tournament Summary
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <Card className="bg-muted/50">
                    <CardContent className="py-3 text-center">
                      <p className="text-2xl font-bold">
                        {viewPlayer.tournamentsPlayed}
                      </p>
                      <p className="text-xs text-muted-foreground">Played</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="py-3 text-center">
                      <p className="text-2xl font-bold">
                        {Math.round(
                          (viewPlayer.tournamentsPlayed * viewPlayer.winRate) /
                            100,
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">Wins</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="py-3 text-center">
                      <p className="text-2xl font-bold">
                        {viewPlayer.winRate}%
                      </p>
                      <p className="text-xs text-muted-foreground">Win Rate</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />

              {/* Eligibility */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Eligibility</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">
                    <IconClock className="h-3 w-3 mr-1" />
                    {viewPlayer.availability}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <IconMapPin className="h-3 w-3 mr-1" />
                    {viewPlayer.region}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <IconCalendar className="h-3 w-3 mr-1" />
                    Expires{" "}
                    {new Date(viewPlayer.expiresAt).toLocaleDateString()}
                  </Badge>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
              <Button
                onClick={() => {
                  toast.success(`Invitation sent to ${viewPlayer.playerName}!`);
                  setViewPlayer(null);
                }}
              >
                Invite to Team
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
