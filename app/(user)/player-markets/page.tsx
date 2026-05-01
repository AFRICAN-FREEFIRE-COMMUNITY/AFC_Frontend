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
import { useSearchParams, useRouter } from "next/navigation";
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  IconClipboardList,
  IconTrophy,
  IconCrosshair,
  IconAward,
  IconCheck,
  IconX,
  IconMessage,
  IconShare,
  IconCopy,
  IconTrash,
  IconBrandX,
  IconBrandWhatsapp,
  IconBrandFacebook,
  IconBrandTelegram,
  IconBrandReddit,
  IconBrandLinkedin,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { DEFAULT_PROFILE_PICTURE, countries } from "@/constants";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/utils";
import {
  ReviewApplicationDialog,
  getStatusBadge,
  type ApplicationRecord,
} from "@/app/(user)/_components/ReviewApplicationDialog";
import { TrialChatSidebar } from "@/app/(user)/_components/TrialChatSidebar";
import Link from "next/link";

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

// ─── Share Button ────────────────────────────────────────────────────────────

function ShareButton({ url, text }: { url: string; text: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  };

  const openShare = (platform: string) => {
    const enc = encodeURIComponent(url);
    const encText = encodeURIComponent(text);
    const map: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?url=${enc}&text=${encText}`,
      whatsapp: `https://wa.me/?text=${encText}%20${enc}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc}`,
      telegram: `https://t.me/share/url?url=${enc}&text=${encText}`,
      reddit: `https://reddit.com/submit?url=${enc}&title=${encText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc}`,
    };
    window.open(map[platform], "_blank", "noopener,noreferrer");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs">
          <IconShare className="h-3.5 w-3.5 mr-1" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCopy}>
          <IconCopy className="h-4 w-4 mr-2" />
          Copy Link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openShare("twitter")}>
          <IconBrandX className="h-4 w-4 mr-2" />
          Twitter / X
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openShare("whatsapp")}>
          <IconBrandWhatsapp className="h-4 w-4 mr-2" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openShare("facebook")}>
          <IconBrandFacebook className="h-4 w-4 mr-2" />
          Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openShare("telegram")}>
          <IconBrandTelegram className="h-4 w-4 mr-2" />
          Telegram
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openShare("reddit")}>
          <IconBrandReddit className="h-4 w-4 mr-2" />
          Reddit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openShare("linkedin")}>
          <IconBrandLinkedin className="h-4 w-4 mr-2" />
          LinkedIn
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Country Multi-Select ────────────────────────────────────────────────────

function CountryMultiSelect({
  value,
  onChange,
  placeholder = "Select countries...",
}: {
  value: string[];
  onChange: (val: string[]) => void;
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = countries.filter((c) =>
    c.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (country: string) => {
    onChange(
      value.includes(country)
        ? value.filter((c) => c !== country)
        : [...value, country],
    );
  };

  return (
    <div className="relative">
      {/* Trigger */}
      <div
        className="min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer flex flex-wrap gap-1.5"
        onClick={() => setOpen((o) => !o)}
      >
        {value.length === 0 ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          value.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-xs"
            >
              {c}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(c);
                }}
              >
                <IconX className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="p-2">
            <Input
              placeholder="Search countries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <ScrollArea className="h-52">
            <div className="p-1">
              {filtered.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-4">
                  No countries found
                </p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggle(c)}
                    className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent text-left"
                  >
                    <div
                      className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                        value.includes(c)
                          ? "bg-primary border-primary"
                          : "border-input"
                      }`}
                    >
                      {value.includes(c) && (
                        <IconCheck className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    {c}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
          {value.length > 0 && (
            <div className="border-t p-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all ({value.length} selected)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PlayerMarketPage() {
  const { token, user } = useAuth();

  const [activeTab, setActiveTab] = useState("teams");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [loadingMyApps, setLoadingMyApps] = useState(false);
  const [teamApplications, setTeamApplications] = useState<any[]>([]);
  const [loadingTeamApps, setLoadingTeamApps] = useState(false);
  const [currentTeam, setCurrentTeam] = useState<any>(null);
  const [isTeamLeader, setIsTeamLeader] = useState(false);

  // Trial invites (player side)
  const [myTrialInvites, setMyTrialInvites] = useState<any[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [isRespondingToInvite, setIsRespondingToInvite] = useState<
    number | null
  >(null);

  // Invite player to trial (team side)
  const [inviteMessage, setInviteMessage] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  // Trial chat sidebar
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);

  // Create Post dialog
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [createPostType, setCreatePostType] = useState<
    "team" | "player" | null
  >(null);

  // Create Post form state — Team
  const [newTeamRoles, setNewTeamRoles] = useState<string[]>([]);
  const [newTeamMinTier, setNewTeamMinTier] = useState("");
  const [newTeamCommitment, setNewTeamCommitment] = useState("");
  const [newTeamCountries, setNewTeamCountries] = useState<string[]>([]);
  const [newTeamCriteria, setNewTeamCriteria] = useState("");
  const [newTeamExpiry, setNewTeamExpiry] = useState("");

  // Create Post form state — Player
  const [newPlayerPrimary, setNewPlayerPrimary] = useState("");
  const [newPlayerSecondary, setNewPlayerSecondary] = useState("");
  const [newPlayerAvailability, setNewPlayerAvailability] = useState("");
  const [newPlayerCountries, setNewPlayerCountries] = useState<string[]>([]);
  const [newPlayerInfo, setNewPlayerInfo] = useState("");
  const [newPlayerExpiry, setNewPlayerExpiry] = useState("");

  // API data
  const [teamPosts, setTeamPosts] = useState<TeamRecruitmentPost[]>([]);
  const [playerPosts, setPlayerPosts] = useState<PlayerAvailablePost[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  // My Posts
  const [isDeletingPost, setIsDeletingPost] = useState<number | null>(null);

  // inside your component, near the top with other hooks:
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const post = searchParams.get("post");
    if (!post) return;

    const [type, idStr] = post.split("-");
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return;

    if (type === "team") {
      // Wait for teamPosts to be loaded
      if (loadingTeams) return;
      const found = teamPosts.find((p) => p.id === id);
      if (found) {
        setViewTeam(found);
        // Clean up URL without navigating away
        router.replace("/player-markets", { scroll: false });
      }
    } else if (type === "player") {
      if (loadingPlayers) return;
      const found = playerPosts.find((p) => p.id === id);
      if (found) {
        setViewPlayer(found);
        router.replace("/player-markets", { scroll: false });
      }
    }
  }, [searchParams, teamPosts, playerPosts, loadingTeams, loadingPlayers]);

  const myTeamPosts = teamPosts.filter(
    (p) => p.team === currentTeam?.team_name,
  );
  const myPlayerPosts = playerPosts.filter(
    (p) => p.player === user?.in_game_name,
  );

  const handleDeletePost = async (postId: number) => {
    setIsDeletingPost(postId);
    try {
      await axios.delete(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/delete-post/${postId}/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setTeamPosts((prev) => prev.filter((p) => p.id !== postId));
      setPlayerPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Post deleted.");
    } catch {
      toast.error("Failed to delete post.");
    } finally {
      setIsDeletingPost(null);
    }
  };

  // View Details dialogs
  const [viewTeam, setViewTeam] = useState<TeamRecruitmentPost | null>(null);
  const [viewPlayer, setViewPlayer] = useState<PlayerAvailablePost | null>(
    null,
  );

  useEffect(() => {
    if (!token || !user) return;

    // First fetch the user's current team to determine their role
    axios
      .post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-user-current-team/`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      .then((res) => {
        const team = res.data.team;
        setCurrentTeam(team);
        const MANAGEMENT_ROLES = [
          "team_captain",
          "vice_captain",
          "coach",
          "manager",
          "analyst",
        ];
        const leader =
          team?.team_owner === user.in_game_name ||
          MANAGEMENT_ROLES.includes(team?.user_role_in_team);
        setIsTeamLeader(leader);

        if (leader) {
          // Fetch applications to their team
          setLoadingTeamApps(true);
          axios
            .get(
              `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-applications/`,
              { headers: { Authorization: `Bearer ${token}` } },
            )
            .then((r) => setTeamApplications(r.data))
            .catch(() => toast.error("Failed to load team applications."))
            .finally(() => setLoadingTeamApps(false));
        } else {
          // Fetch their own applications
          setLoadingMyApps(true);
          axios
            .get(
              `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-my-applications/`,
              { headers: { Authorization: `Bearer ${token}` } },
            )
            .then((r) => setMyApplications(r.data))
            .catch(() => toast.error("Failed to load your applications."))
            .finally(() => setLoadingMyApps(false));

          // Fetch trial invites
          setLoadingInvites(true);
          axios
            .get(
              `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/my-trial-invites/`,
              { headers: { Authorization: `Bearer ${token}` } },
            )
            .then((r) => setMyTrialInvites(r.data))
            .catch(() => toast.error("Failed to load trial invites."))
            .finally(() => setLoadingInvites(false));
        }
      })
      .catch(() => {
        // No team or failed — still fetch my applications and invites
        setLoadingMyApps(true);
        axios
          .get(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-my-applications/`,
            { headers: { Authorization: `Bearer ${token}` } },
          )
          .then((r) => setMyApplications(r.data))
          .catch(() => toast.error("Failed to load your applications."))
          .finally(() => setLoadingMyApps(false));

        setLoadingInvites(true);
        axios
          .get(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/my-trial-invites/`,
            { headers: { Authorization: `Bearer ${token}` } },
          )
          .then((r) => setMyTrialInvites(r.data))
          .catch(() => toast.error("Failed to load trial invites."))
          .finally(() => setLoadingInvites(false));
      });
  }, [token, user]);

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
  const [reviewApp, setReviewApp] = useState<ApplicationRecord | null>(null);

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
    setNewTeamCountries([]);
    setNewTeamCriteria("");
    setNewTeamExpiry("");
    setNewPlayerPrimary("");
    setNewPlayerSecondary("");
    setNewPlayerAvailability("");
    setNewPlayerCountries([]);
    setNewPlayerInfo("");
    setNewPlayerExpiry("");
  };

  const handleCreateTeamPost = async () => {
    if (
      !newTeamRoles.length ||
      !newTeamMinTier ||
      !newTeamCommitment ||
      !newTeamCountries.length ||
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
          country_codes: newTeamCountries,
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
      !newPlayerCountries.length ||
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
          country_codes: newPlayerCountries,
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

  const handleStatusUpdated = (updated: ApplicationRecord) => {
    setTeamApplications((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a)),
    );
  };

  const handleInvitePlayer = async () => {
    if (!viewPlayer) return;
    setIsInviting(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/invite-player-to-trial/`,
        { post_id: String(viewPlayer.id), message: inviteMessage },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(`Trial invite sent to ${viewPlayer.player}!`);
      setViewPlayer(null);
      setInviteMessage("");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to send invite.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRespondToInvite = async (
    inviteId: number,
    action: "ACCEPT" | "DECLINE",
  ) => {
    setIsRespondingToInvite(inviteId);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/respond-to-trial-invite/`,
        { invite_id: String(inviteId), action },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(
        action === "ACCEPT" ? "Trial invite accepted!" : "Invite declined.",
      );
      setMyTrialInvites((prev) =>
        prev.map((inv) =>
          inv.invite_id === inviteId
            ? { ...inv, status: action === "ACCEPT" ? "ACCEPTED" : "DECLINED" }
            : inv,
        ),
      );
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to respond.");
    } finally {
      setIsRespondingToInvite(null);
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
        <div className="flex gap-2 w-full md:w-auto">
          {token && (
            <Button
              variant="outline"
              className="flex-1 md:flex-none"
              onClick={() => setChatSidebarOpen(true)}
            >
              <IconMessage className="h-4 w-4 mr-1.5" />
              Chats
            </Button>
          )}
          <Button
            className="flex-1 md:flex-none"
            onClick={() => {
              resetCreateForm();
              setCreatePostOpen(true);
            }}
          >
            <IconPlus className="h-4 w-4 mr-1" />
            Create Post
          </Button>
        </div>
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

      {/* Temporary Tier Disclaimer */}
      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardContent className="flex items-start gap-1">
          <IconInfoCircle className="size-3 text-yellow-500 shrink-0" />
          <div className="text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-yellow-600 dark:text-yellow-400">
                Temporary Notice:
              </span>{" "}
              All teams and players are currently assigned Tier 3 status. Tier
              standings will be automatically updated over time based on
              activity and performance.
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
            {token && !isTeamLeader && (
              <TabsTrigger value="my-applications" className="flex-1">
                <IconClipboardList className="h-4 w-4 mr-1.5" />
                My Applications
              </TabsTrigger>
            )}
            {token && !isTeamLeader && (
              <TabsTrigger value="my-invites" className="flex-1">
                <IconCalendar className="h-4 w-4 mr-1.5" />
                Trial Invites
                {myTrialInvites.filter((i) => i.status === "PENDING").length >
                  0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                    {
                      myTrialInvites.filter((i) => i.status === "PENDING")
                        .length
                    }
                  </span>
                )}
              </TabsTrigger>
            )}
            {token && isTeamLeader && (
              <TabsTrigger value="team-applications" className="flex-1">
                <IconUsers className="h-4 w-4 mr-1.5" />
                Team Applications
              </TabsTrigger>
            )}
            {token && currentTeam && (
              <TabsTrigger value="my-team" className="flex-1">
                <IconShield className="h-4 w-4 mr-1.5" />
                My Team
              </TabsTrigger>
            )}
            {token && (
              <TabsTrigger value="my-posts" className="flex-1">
                <IconClipboardList className="h-4 w-4 mr-1.5" />
                My Posts
              </TabsTrigger>
            )}
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
                    <div className="flex items-center justify-between">
                      <ShareButton
                        url={`${typeof window !== "undefined" ? window.location.origin : ""}/player-markets?post=team-${team.id}`}
                        text={`${team.team ?? "A team"} is recruiting on AFC Player Market!`}
                      />
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
                    <div className="flex items-center justify-between">
                      <ShareButton
                        url={`${typeof window !== "undefined" ? window.location.origin : ""}/player-markets?post=player-${player.id}`}
                        text={`${player.player} is open to joining a team on AFC Player Market!`}
                      />
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

        {/* ─── My Trial Invites Tab ────────────────────────────────── */}
        {token && !isTeamLeader && (
          <TabsContent value="my-invites" className="mt-4 space-y-3">
            {loadingInvites ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Loading...
              </div>
            ) : myTrialInvites.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
                <IconCalendar className="h-12 w-12 opacity-40" />
                <p className="font-medium">No trial invites</p>
                <p className="text-sm">
                  Teams that invite you to trial will appear here
                </p>
              </div>
            ) : (
              myTrialInvites.map((invite) => {
                const isPending = invite.status === "PENDING";
                const isExpired =
                  invite.expires_at && new Date(invite.expires_at) < new Date();
                const statusColors: Record<string, string> = {
                  PENDING: "bg-yellow-900/20 text-yellow-400 border-yellow-800",
                  ACCEPTED: "bg-green-900/20 text-green-400 border-green-800",
                  DECLINED: "bg-red-900/20 text-red-400 border-red-800",
                  EXPIRED: "bg-muted text-muted-foreground border-border",
                };
                const displayStatus =
                  isExpired && isPending ? "EXPIRED" : invite.status;
                return (
                  <Card
                    key={invite.invite_id}
                    className="hover:border-primary/50 transition-colors"
                  >
                    <CardContent className="space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <h3 className="font-semibold">{invite.team}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Sent {formatDate(invite.created_at)}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ${statusColors[displayStatus] ?? ""}`}
                        >
                          {displayStatus.replace("_", " ")}
                        </Badge>
                      </div>

                      {invite.message && (
                        <>
                          <Separator />
                          <p className="text-sm text-muted-foreground italic">
                            &ldquo;{invite.message}&rdquo;
                          </p>
                        </>
                      )}

                      <div className="flex items-center justify-between flex-wrap gap-2">
                        {invite.expires_at && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <IconClock className="h-3 w-3" />
                            {isExpired
                              ? "Expired"
                              : `Expires ${formatDate(invite.expires_at)}`}
                          </p>
                        )}
                        {isPending && !isExpired && (
                          <div className="flex items-center gap-2 ml-auto">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-400 border-red-800 hover:bg-red-900/20"
                              disabled={
                                isRespondingToInvite === invite.invite_id
                              }
                              onClick={() =>
                                handleRespondToInvite(
                                  invite.invite_id,
                                  "DECLINE",
                                )
                              }
                            >
                              Decline
                            </Button>
                            <Button
                              size="sm"
                              disabled={
                                isRespondingToInvite === invite.invite_id
                              }
                              onClick={() =>
                                handleRespondToInvite(
                                  invite.invite_id,
                                  "ACCEPT",
                                )
                              }
                            >
                              {isRespondingToInvite === invite.invite_id
                                ? "..."
                                : "Accept"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        )}

        {/* ─── Team Applications Tab ────────────────────────────────── */}
        {token && isTeamLeader && (
          <TabsContent value="team-applications" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold">
                  {currentTeam?.team_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Players who applied via your recruitment post
                </p>
              </div>
            </div>
            {loadingTeamApps ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Loading...
              </div>
            ) : teamApplications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
                <IconUsers className="h-12 w-12 opacity-40" />
                <p className="font-medium">No applications yet</p>
                <p className="text-sm">
                  Applications from your recruitment post will appear here
                </p>
              </div>
            ) : (
              teamApplications.map((app) => {
                const statusColors: Record<string, string> = {
                  PENDING: "bg-yellow-900/20 text-yellow-400 border-yellow-800",
                  SHORTLISTED: "bg-cyan-900/20 text-cyan-400 border-cyan-800",
                  INVITED: "bg-blue-900/20 text-blue-400 border-blue-800",
                  ACCEPTED: "bg-green-900/20 text-green-400 border-green-800",
                  TRIAL_EXTENDED:
                    "bg-purple-900/20 text-purple-400 border-purple-800",
                  REJECTED: "bg-red-900/20 text-red-400 border-red-800",
                };
                return (
                  <Card
                    key={app.id}
                    className="hover:border-primary/50 transition-colors"
                  >
                    <CardContent className="space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-semibold">{app.player}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Applied {formatDate(app.applied_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-xs ${statusColors[app.status] ?? ""}`}
                          >
                            {app.status.replace("_", " ")}
                          </Badge>
                          {app.contact_unlocked && (
                            <Badge
                              variant="outline"
                              className="text-xs text-green-400 border-green-800"
                            >
                              Contact Unlocked
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReviewApp(app)}
                          >
                            Review
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <Link
                              href={`/player-markets/applications/${app.id}`}
                            >
                              <IconChevronRight className="h-3.5 w-3.5 mr-1" />
                              View
                            </Link>
                          </Button>
                        </div>
                      </div>
                      <Separator />
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <IconTrophy className="h-3.5 w-3.5 text-yellow-400" />
                          {app.tournament_wins} wins
                        </span>
                        <span className="flex items-center gap-1.5">
                          <IconCrosshair className="h-3.5 w-3.5 text-red-400" />
                          {app.total_tournament_kills} kills
                        </span>
                        <span className="flex items-center gap-1.5">
                          <IconAward className="h-3.5 w-3.5 text-blue-400" />
                          {app.tournament_finals_appearances} finals
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        )}

        {/* ─── My Applications Tab ──────────────────────────────────── */}
        {token && !isTeamLeader && (
          <TabsContent value="my-applications" className="mt-4 space-y-3">
            {loadingMyApps ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Loading...
              </div>
            ) : myApplications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
                <IconClipboardList className="h-12 w-12 opacity-40" />
                <p className="font-medium">No applications yet</p>
                <p className="text-sm">
                  Browse teams recruiting and apply to join
                </p>
              </div>
            ) : (
              myApplications.map((app) => {
                const statusColors: Record<string, string> = {
                  PENDING: "bg-yellow-900/20 text-yellow-400 border-yellow-800",
                  SHORTLISTED: "bg-cyan-900/20 text-cyan-400 border-cyan-800",
                  INVITED: "bg-blue-900/20 text-blue-400 border-blue-800",
                  ACCEPTED: "bg-green-900/20 text-green-400 border-green-800",
                  TRIAL_EXTENDED:
                    "bg-purple-900/20 text-purple-400 border-purple-800",
                  REJECTED: "bg-red-900/20 text-red-400 border-red-800",
                };
                return (
                  <Card
                    key={app.id}
                    className="hover:border-primary/50 transition-colors"
                  >
                    <CardContent className="space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <h3 className="font-semibold">{app.team}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Applied {formatDate(app.applied_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-xs ${statusColors[app.status] ?? ""}`}
                          >
                            {app.status.replace("_", " ")}
                          </Badge>
                          {app.contact_unlocked && (
                            <Badge
                              variant="outline"
                              className="text-xs text-green-400 border-green-800"
                            >
                              Contact Unlocked
                            </Badge>
                          )}
                        </div>
                      </div>

                      <Separator />

                      {/* Performance mini-stats */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <IconTrophy className="h-3.5 w-3.5 text-yellow-400" />
                          <span>{app.tournament_wins} wins</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <IconCrosshair className="h-3.5 w-3.5 text-red-400" />
                          <span>{app.total_tournament_kills} kills</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <IconAward className="h-3.5 w-3.5 text-blue-400" />
                          <span>
                            {app.tournament_finals_appearances} finals
                          </span>
                        </span>
                      </div>

                      {app.invite_expires_at && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <IconCalendar className="h-3 w-3" />
                          Invite expires {formatDate(app.invite_expires_at)}
                        </p>
                      )}

                      <div className="flex justify-end pt-1">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/player-markets/applications/${app.id}`}>
                            <IconChevronRight className="h-3.5 w-3.5 mr-1" />
                            View
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        )}

        {/* ─── My Team Tab ──────────────────────────────────────────── */}
        {token && currentTeam && (
          <TabsContent value="my-team" className="mt-4">
            <Card>
              <CardContent className="space-y-5">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 rounded-lg border">
                    <AvatarImage src={currentTeam.team_logo ?? undefined} />
                    <AvatarFallback className="rounded-lg text-lg font-bold">
                      {currentTeam.team_name?.charAt(0) ?? "T"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold leading-tight truncate">
                        {currentTeam.team_name}
                      </h2>
                      {currentTeam.team_tag && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          [{currentTeam.team_tag}]
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 ${getTierColor(`TIER_${currentTeam.team_tier}`)}`}
                      >
                        Tier {currentTeam.team_tier}
                      </Badge>
                      {currentTeam.is_banned && (
                        <Badge
                          variant="destructive"
                          className="text-xs shrink-0"
                        >
                          Banned
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {currentTeam.country && (
                        <span className="flex items-center gap-1">
                          <IconMapPin className="h-3 w-3" />
                          {currentTeam.country}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <IconUsers className="h-3 w-3" />
                        {currentTeam.member_count} member
                        {currentTeam.member_count !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <IconCalendar className="h-3 w-3" />
                        Founded {formatDate(currentTeam.creation_date)}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Description */}
                {currentTeam.team_description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentTeam.team_description}
                  </p>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      Your Role
                    </p>
                    <p className="text-sm font-medium mt-0.5 capitalize">
                      {currentTeam.user_role_in_team?.replace(/_/g, " ") ??
                        "Member"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      Owner
                    </p>
                    <p className="text-sm font-medium mt-0.5 truncate">
                      {currentTeam.team_owner}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      Joined
                    </p>
                    <p className="text-sm font-medium mt-0.5">
                      {formatDate(currentTeam.join_date)}
                    </p>
                  </div>
                  {currentTeam.in_game_role && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                        In-Game Role
                      </p>
                      <p className="text-sm font-medium mt-0.5">
                        {labelFor(ROLES, currentTeam.in_game_role)}
                      </p>
                    </div>
                  )}
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      Joining
                    </p>
                    <p className="text-sm font-medium mt-0.5 capitalize">
                      {currentTeam.join_settings?.replace(/_/g, " ") ?? "—"}
                    </p>
                  </div>
                </div>

                {/* CTA */}
                <div className="flex justify-end pt-1">
                  <Link href={`/team/${currentTeam.team_id}`}>
                    <Button size="sm">
                      View Full Team
                      <IconChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ─── My Posts Tab ─────────────────────────────────────────── */}
        {token && (
          <TabsContent value="my-posts" className="mt-4 space-y-4">
            {isTeamLeader ? (
              <>
                <div>
                  <p className="text-base font-semibold">
                    My Recruitment Posts
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Team recruitment posts you&apos;ve created
                  </p>
                </div>
                {myTeamPosts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <IconClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No posts yet</p>
                    <p className="text-sm">
                      Create a recruitment post to start finding players
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {myTeamPosts.map((post) => (
                      <Card
                        key={post.id}
                        className="hover:border-primary/50 transition-colors"
                      >
                        <CardContent className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={DEFAULT_PROFILE_PICTURE} />
                              <AvatarFallback>
                                {(post.team ?? "T").charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold truncate">
                                {post.team ?? "Unknown Team"}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                Expires {formatDate(post.expiry)}
                              </p>
                            </div>
                          </div>

                          {post.roles_needed &&
                            post.roles_needed.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {post.roles_needed.map((role, i) => (
                                  <Badge
                                    key={i}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {labelFor(ROLES, role)}
                                  </Badge>
                                ))}
                              </div>
                            )}

                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {post.minimum_tier_required && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getTierColor(post.minimum_tier_required)}`}
                              >
                                <IconShield className="h-3 w-3" />
                                {labelFor(TIERS, post.minimum_tier_required)}+
                              </span>
                            )}
                            {post.commitment_type && (
                              <span className="flex items-center gap-1">
                                <IconTarget className="h-3 w-3" />
                                {labelFor(COMMITMENTS, post.commitment_type)}
                              </span>
                            )}
                            {post.country && (
                              <span className="flex items-center gap-1">
                                <IconMapPin className="h-3 w-3" />
                                {post.country}
                              </span>
                            )}
                          </div>

                          <Separator />

                          <div className="flex items-center justify-between">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-destructive hover:text-destructive"
                              disabled={isDeletingPost === post.id}
                              onClick={() => handleDeletePost(post.id)}
                            >
                              <IconTrash className="h-3.5 w-3.5 mr-1" />
                              {isDeletingPost === post.id
                                ? "Deleting..."
                                : "Delete"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => setViewTeam(post)}
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
              </>
            ) : (
              <>
                <div>
                  <p className="text-base font-semibold">
                    My Availability Posts
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Posts you&apos;ve created to find a team
                  </p>
                </div>
                {myPlayerPosts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <IconClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No posts yet</p>
                    <p className="text-sm">
                      Create a post to let teams know you&apos;re available
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {myPlayerPosts.map((post) => (
                      <Card
                        key={post.id}
                        className="hover:border-primary/50 transition-colors"
                      >
                        <CardContent className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={DEFAULT_PROFILE_PICTURE} />
                              <AvatarFallback>
                                {post.player.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold truncate">
                                {post.player}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                Expires {formatDate(post.expiry)}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="secondary" className="text-xs">
                              <IconCrosshair className="h-3 w-3 mr-1" />
                              {labelFor(ROLES, post.primary_role)}
                            </Badge>
                            {post.secondary_role && (
                              <Badge variant="outline" className="text-xs">
                                {labelFor(ROLES, post.secondary_role)}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {labelFor(AVAILABILITIES, post.availability_type)}
                            </Badge>
                          </div>

                          {post.additional_info && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {post.additional_info}
                            </p>
                          )}

                          <Separator />

                          <div className="flex items-center justify-between">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-destructive hover:text-destructive"
                              disabled={isDeletingPost === post.id}
                              onClick={() => handleDeletePost(post.id)}
                            >
                              <IconTrash className="h-3.5 w-3.5 mr-1" />
                              {isDeletingPost === post.id
                                ? "Deleting..."
                                : "Delete"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => setViewPlayer(post)}
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
              </>
            )}
          </TabsContent>
        )}
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

              <div className="space-y-2">
                <Label>
                  Countries *
                  <span className="ml-1 text-xs text-muted-foreground font-normal">
                    (select countries you want applicants from)
                  </span>
                </Label>
                <CountryMultiSelect
                  value={newTeamCountries}
                  onChange={setNewTeamCountries}
                  placeholder="Select countries..."
                />
              </div>

              <div className="space-y-2">
                <Label>Expiry Date *</Label>
                <Input
                  type="date"
                  value={newTeamExpiry}
                  onChange={(e) => setNewTeamExpiry(e.target.value)}
                />
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
                <Label>
                  Countries *
                  <span className="ml-1 text-xs text-muted-foreground font-normal">
                    (select countries you're open to join from)
                  </span>
                </Label>
                <CountryMultiSelect
                  value={newPlayerCountries}
                  onChange={setNewPlayerCountries}
                  placeholder="Select countries..."
                />
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
              <ShareButton
                url={`${typeof window !== "undefined" ? window.location.origin : ""}/player-markets?post=team-${viewTeam.id}`}
                text={`${viewTeam.team ?? "A team"} is recruiting on AFC Player Market!`}
              />
              <DialogClose asChild>
                <Button size={"sm"} variant="outline">
                  Close
                </Button>
              </DialogClose>
              {!isTeamLeader && (
                <Button
                  onClick={() => handleApplyToTeam(viewTeam.id, viewTeam.team)}
                  disabled={isApplying}
                >
                  {isApplying ? "Applying..." : "Apply to Join"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ─── View Player Details Dialog ───────────────────────────────── */}
      <Dialog
        open={!!viewPlayer}
        onOpenChange={(open) => {
          if (!open) {
            setViewPlayer(null);
            setInviteMessage("");
          }
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

              {/* Invite message — only for team leaders */}
              {isTeamLeader && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Message to Player</Label>
                    <Textarea
                      placeholder="Introduce your team and why you'd like them to trial..."
                      rows={3}
                      value={inviteMessage}
                      onChange={(e) => setInviteMessage(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="gap-2">
              <ShareButton
                url={`${typeof window !== "undefined" ? window.location.origin : ""}/player-markets?post=player-${viewPlayer.id}`}
                text={`${viewPlayer.player} is open to joining a team on AFC Player Market!`}
              />
              <DialogClose asChild>
                <Button size={"sm"} variant="outline">
                  Close
                </Button>
              </DialogClose>
              {isTeamLeader && (
                <Button onClick={handleInvitePlayer} disabled={isInviting}>
                  {isInviting ? "Sending..." : "Invite to Trial"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
      <ReviewApplicationDialog
        app={reviewApp}
        token={token}
        onClose={() => setReviewApp(null)}
        onStatusUpdated={handleStatusUpdated}
      />

      <TrialChatSidebar
        open={chatSidebarOpen}
        onClose={() => setChatSidebarOpen(false)}
      />
    </div>
  );
}
