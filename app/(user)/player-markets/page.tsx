"use client";

import { useState, useMemo, useEffect } from "react";
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
  IconTarget,
  IconShield,
  IconMapPin,
  IconClock,
  IconCalendar,
  IconPlus,
  IconChevronRight,
  IconInfoCircle,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { DEFAULT_PROFILE_PICTURE } from "@/constants";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLES: { value: string; label: string }[] = [
  { value: "IGL", label: "In-Game Leader" },
  { value: "RUSHER", label: "Rusher" },
  { value: "SUPPORT", label: "Support" },
  { value: "SNIPER", label: "Sniper" },
  { value: "GRENADE", label: "Grenade" },
];

const TIERS: { value: string; label: string }[] = [
  { value: "TIER_1", label: "Tier 1" },
  { value: "TIER_2", label: "Tier 2" },
  { value: "TIER_3", label: "Tier 3" },
];

const REGIONS: { value: string; label: string }[] = [
  { value: "WA", label: "West Africa" },
  { value: "EA", label: "East Africa" },
  { value: "NA", label: "North Africa" },
  { value: "SA", label: "South Africa" },
  { value: "CA", label: "Central Africa" },
];

const COMMITMENTS: { value: string; label: string }[] = [
  { value: "FULL_TIME", label: "Full Time" },
  { value: "PART_TIME", label: "Part Time" },
];

const AVAILABILITIES: { value: string; label: string }[] = [
  { value: "TRIAL", label: "Trial" },
  { value: "PERMANENT", label: "Permanent" },
  { value: "SCRIMS_ONLY", label: "Scrims Only" },
];

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface TeamRecruitmentPost {
  id: number;
  team: string | null;
  country: string | null;
  roles_needed: string[] | null;
  minimum_tier_required: string;
  commitment_type: string;
  expiry: string;
}

interface PlayerAvailablePost {
  id: number;
  player: string;
  country: string | null;
  primary_role: string;
  secondary_role: string;
  availability_type: string;
  additional_info: string;
  expiry: string;
}

// ─── Lookup helpers ──────────────────────────────────────────────────────────

function labelFor(list: { value: string; label: string }[], value: string) {
  return list.find((i) => i.value === value)?.label ?? value;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function getTierColor(tier: string) {
  switch (tier) {
    case "TIER_1":
      return "bg-yellow-900/20 text-yellow-400 border-yellow-800";
    case "TIER_2":
      return "bg-cyan-900/20 text-cyan-400 border-cyan-800";
    case "TIER_3":
      return "bg-purple-900/20 text-purple-400 border-purple-800";
    default:
      return "";
  }
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PlayerMarketPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("teams");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Create Post dialog
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [createPostType, setCreatePostType] = useState<
    "team" | "player" | null
  >(null);

  // Create Post form state — Team
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

  // API data
  const [teamPosts, setTeamPosts] = useState<TeamRecruitmentPost[]>([]);
  const [playerPosts, setPlayerPosts] = useState<PlayerAvailablePost[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  // View Details dialogs
  const [viewTeam, setViewTeam] = useState<TeamRecruitmentPost | null>(null);
  const [viewPlayer, setViewPlayer] = useState<PlayerAvailablePost | null>(
    null,
  );

  useEffect(() => {
    axios
      .get<TeamRecruitmentPost[]>(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-team-recruitment-posts/`,
      )
      .then((res) => setTeamPosts(res.data))
      .catch(() => toast.error("Failed to load team posts."))
      .finally(() => setLoadingTeams(false));

    axios
      .get<PlayerAvailablePost[]>(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-player-availability-posts/`,
      )
      .then((res) => setPlayerPosts(res.data))
      .catch(() => toast.error("Failed to load player posts."))
      .finally(() => setLoadingPlayers(false));
  }, []);

  // Teams tab filters
  const [teamSearch, setTeamSearch] = useState("");
  const [teamCommitmentFilter, setTeamCommitmentFilter] = useState("all");
  const [teamTierFilter, setTeamTierFilter] = useState("all");

  // Players tab filters
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerAvailabilityFilter, setPlayerAvailabilityFilter] =
    useState("all");
  const [playerRoleFilter, setPlayerRoleFilter] = useState("all");

  // Filtered data
  const filteredTeams = useMemo(() => {
    return teamPosts.filter((team) => {
      const matchesSearch = (team.team ?? "")
        .toLowerCase()
        .includes(teamSearch.toLowerCase());
      const matchesCommitment =
        teamCommitmentFilter === "all" ||
        team.commitment_type === teamCommitmentFilter;
      const matchesTier =
        teamTierFilter === "all" ||
        team.minimum_tier_required === teamTierFilter;
      return matchesSearch && matchesCommitment && matchesTier;
    });
  }, [teamPosts, teamSearch, teamCommitmentFilter, teamTierFilter]);

  const filteredPlayers = useMemo(() => {
    return playerPosts.filter((player) => {
      const matchesSearch = player.player
        .toLowerCase()
        .includes(playerSearch.toLowerCase());
      const matchesAvailability =
        playerAvailabilityFilter === "all" ||
        player.availability_type === playerAvailabilityFilter;
      const matchesRole =
        playerRoleFilter === "all" ||
        player.primary_role === playerRoleFilter ||
        player.secondary_role === playerRoleFilter;
      return matchesSearch && matchesAvailability && matchesRole;
    });
  }, [playerPosts, playerSearch, playerAvailabilityFilter, playerRoleFilter]);

  // Handlers
  const resetCreateForm = () => {
    setCreatePostType(null);
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

  const handleCreateTeamPost = async () => {
    if (
      !newTeamRoles.length ||
      !newTeamMinTier ||
      !newTeamCommitment ||
      !newTeamRegion ||
      !newTeamExpiry
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setIsSubmitting(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/create-recruitment-post/`,
        {
          post_type: "TEAM_RECRUITMENT",
          region: newTeamRegion,
          post_expiry_date: newTeamExpiry,
          roles_needed: newTeamRoles,
          minimum_tier_required: newTeamMinTier,
          commitment_type: newTeamCommitment,
          recruitment_criteria: newTeamCriteria,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Team recruitment post created successfully!");
      setCreatePostOpen(false);
      resetCreateForm();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to create post.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePlayerPost = async () => {
    if (
      !newPlayerPrimary ||
      !newPlayerAvailability ||
      !newPlayerRegion ||
      !newPlayerExpiry
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setIsSubmitting(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/create-recruitment-post/`,
        {
          post_type: "PLAYER_AVAILABLE",
          region: newPlayerRegion,
          post_expiry_date: newPlayerExpiry,
          primary_role: newPlayerPrimary,
          secondary_role: newPlayerSecondary,
          availability_type: newPlayerAvailability,
          additional_info: newPlayerInfo,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Player availability post created successfully!");
      setCreatePostOpen(false);
      resetCreateForm();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to create post.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyToTeam = async (postId: number, teamName: string | null) => {
    setIsApplying(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/apply-to-team/`,
        { post_id: String(postId) },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(`Application sent to ${teamName ?? "team"}!`);
      setViewTeam(null);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to send application.",
      );
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start md:items-center md:flex-row w-full justify-between gap-4">
        <PageHeader
          back
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
              value={teamCommitmentFilter}
              onValueChange={setTeamCommitmentFilter}
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Commitment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {COMMITMENTS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
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
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Team Cards Grid */}
          {loadingTeams ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">Loading...</p>
            </div>
          ) : filteredTeams.length === 0 ? (
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
                        <AvatarImage
                          src={DEFAULT_PROFILE_PICTURE}
                          alt={team.team ?? "Team"}
                        />
                        <AvatarFallback>
                          {(team.team ?? "T").charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {team.team ?? "Unknown Team"}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Expires {formatDate(team.expiry)}
                        </p>
                      </div>
                    </div>

                    {/* Roles needed */}
                    {team.roles_needed && team.roles_needed.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {team.roles_needed.map((role, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="text-xs"
                          >
                            {labelFor(ROLES, role)}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Info row */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {team.minimum_tier_required && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getTierColor(team.minimum_tier_required)}`}
                        >
                          <IconShield className="h-3 w-3" />
                          {labelFor(TIERS, team.minimum_tier_required)}+
                        </span>
                      )}
                      {team.commitment_type && (
                        <span className="flex items-center gap-1">
                          <IconTarget className="h-3 w-3" />
                          {labelFor(COMMITMENTS, team.commitment_type)}
                        </span>
                      )}
                      {team.country && (
                        <span className="flex items-center gap-1">
                          <IconMapPin className="h-3 w-3" />
                          {team.country}
                        </span>
                      )}
                    </div>

                    <Separator />

                    {/* Action */}
                    <div className="flex items-center justify-end">
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
              value={playerAvailabilityFilter}
              onValueChange={setPlayerAvailabilityFilter}
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {AVAILABILITIES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
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
                {ROLES.map((r, index) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Player Cards Grid */}
          {loadingPlayers ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">Loading...</p>
            </div>
          ) : filteredPlayers.length === 0 ? (
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
                          src={DEFAULT_PROFILE_PICTURE}
                          alt={player.player}
                        />
                        <AvatarFallback>
                          {player.player.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {player.player}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Expires {formatDate(player.expiry)}
                        </p>
                      </div>
                    </div>

                    {/* Roles */}
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="default" className="text-xs">
                        {labelFor(ROLES, player.primary_role)}
                      </Badge>
                      {player.secondary_role && (
                        <Badge variant="secondary" className="text-xs">
                          {labelFor(ROLES, player.secondary_role)}
                        </Badge>
                      )}
                    </div>

                    {/* Info row */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <IconClock className="h-3 w-3" />
                        {labelFor(AVAILABILITIES, player.availability_type)}
                      </span>
                      {player.country && (
                        <span className="flex items-center gap-1">
                          <IconMapPin className="h-3 w-3" />
                          {player.country}
                        </span>
                      )}
                    </div>

                    <Separator />

                    {/* Action */}
                    <div className="flex items-center justify-end">
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
                      key={role.value}
                      value={role.value}
                      className="text-xs"
                    >
                      {role.label}
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
                      {TIERS.map((t, index) => (
                        <SelectItem key={index} value={t.value}>
                          {t.label}
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
                      {COMMITMENTS.map((c, index) => (
                        <SelectItem key={index} value={c.value}>
                          {c.label}
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
                      {REGIONS.map((r, index) => (
                        <SelectItem key={index} value={r.value}>
                          {r.label}
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
                <Button onClick={handleCreateTeamPost} disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Post"}
                </Button>
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
                      {ROLES.map((r, index) => (
                        <SelectItem key={index} value={r.value}>
                          {r.label}
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
                      {ROLES.map((r, index) => (
                        <SelectItem key={index} value={r.value}>
                          {r.label}
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
                      {AVAILABILITIES.map((a, index) => (
                        <SelectItem key={index} value={a.value}>
                          {a.label}
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
                      {REGIONS.map((r, index) => (
                        <SelectItem key={index} value={r.value}>
                          {r.label}
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
                <Button
                  onClick={handleCreatePlayerPost}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Create Post"}
                </Button>
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
                    src={DEFAULT_PROFILE_PICTURE}
                    alt={viewTeam.team ?? "Team"}
                  />
                  <AvatarFallback>
                    {(viewTeam.team ?? "T").charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-xl">
                    {viewTeam.team ?? "Unknown Team"}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Expires {new Date(viewTeam.expiry).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {/* Roles & Requirements */}
              {viewTeam.roles_needed && viewTeam.roles_needed.length > 0 && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      Roles Needed
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {viewTeam.roles_needed.map((role) => (
                        <Badge key={role} variant="secondary">
                          {labelFor(ROLES, role)}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {viewTeam.minimum_tier_required && (
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Min Tier
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border mt-1 ${getTierColor(viewTeam.minimum_tier_required)}`}
                        >
                          <IconShield className="h-3 w-3" />
                          {labelFor(TIERS, viewTeam.minimum_tier_required)}+
                        </span>
                      </div>
                    )}
                    {viewTeam.commitment_type && (
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Commitment
                        </p>
                        <p className="text-sm font-medium mt-1">
                          {labelFor(COMMITMENTS, viewTeam.commitment_type)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Eligibility */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Details</h4>
                <div className="flex flex-wrap gap-2">
                  {viewTeam.country && (
                    <Badge variant="outline" className="text-xs">
                      <IconMapPin className="h-3 w-3 mr-1" />
                      {viewTeam.country}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    <IconCalendar className="h-3 w-3 mr-1" />
                    Expires {new Date(viewTeam.expiry).toLocaleDateString()}
                  </Badge>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
              <Button
                onClick={() => handleApplyToTeam(viewTeam.id, viewTeam.team)}
                disabled={isApplying}
              >
                {isApplying ? "Applying..." : "Apply to Join"}
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
                    src={DEFAULT_PROFILE_PICTURE}
                    alt={viewPlayer.player}
                  />
                  <AvatarFallback>
                    {viewPlayer.player.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-xl">
                    {viewPlayer.player}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="default" className="text-xs">
                      {labelFor(ROLES, viewPlayer.primary_role)}
                    </Badge>
                    {viewPlayer.secondary_role && (
                      <Badge variant="secondary" className="text-xs">
                        {labelFor(ROLES, viewPlayer.secondary_role)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {/* About */}
              {viewPlayer.additional_info && (
                <div>
                  <h4 className="text-sm font-semibold mb-1.5">About</h4>
                  <p className="text-sm text-muted-foreground">
                    {viewPlayer.additional_info}
                  </p>
                </div>
              )}

              <Separator />

              {/* Details */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Details</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">
                    <IconClock className="h-3 w-3 mr-1" />
                    {labelFor(AVAILABILITIES, viewPlayer.availability_type)}
                  </Badge>
                  {viewPlayer.country && (
                    <Badge variant="outline" className="text-xs">
                      <IconMapPin className="h-3 w-3 mr-1" />
                      {viewPlayer.country}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    <IconCalendar className="h-3 w-3 mr-1" />
                    Expires {new Date(viewPlayer.expiry).toLocaleDateString()}
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
                  toast.success(`Invitation sent to ${viewPlayer.player}!`);
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
