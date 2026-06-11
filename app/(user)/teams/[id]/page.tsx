"use client";

import React, { useState, useEffect, useTransition, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ITEMS_PER_PAGE } from "@/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { UserSearchSelect } from "@/components/ui/user-search-select";
import { Label } from "@/components/ui/label";
import {
  Facebook,
  Twitter,
  Instagram,
  UserPlus,
  LinkIcon,
  Edit,
  Users,
  Youtube,
  Twitch,
  AlertTriangle,
  Search,
} from "lucide-react";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import axios from "axios";
import { env } from "@/lib/env";
import { FullLoader, Loader } from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { formatDate, formatWord } from "@/lib/utils";
import { DEFAULT_PROFILE_PICTURE } from "@/constants";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCopy,
  IconLogout,
  IconSearch,
  IconExternalLink,
} from "@tabler/icons-react";
import { BanModal } from "@/app/(a)/a/_components/BanModal";
import { PageHeader } from "@/components/PageHeader";
import { NothingFound } from "@/components/NothingFound";
import { useAuthModal } from "@/components/AuthModal";
import {
  ReviewApplicationDialog,
  getStatusBadge,
  type ApplicationRecord,
} from "@/app/(user)/_components/ReviewApplicationDialog";
// The detailed Statistics tab body lives in its own component for readability.
// It is wired to the real get-team-details aggregates + tournament_performance +
// recent_matches + tier_history that the backend now returns.
import TeamStatisticsTab from "./_components/TeamStatisticsTab";
// The Achievements tab body: a display-only, tiered catalog mirroring the player
// profile's Achievements. It reads the SAME already-fetched team object (no second
// request) and lights up lifetime ladders from real derived team stats. The
// points->rankings/tiers boost is an explicit FUTURE feature and is NOT applied here.
import TeamAchievementsTab from "./_components/TeamAchievementsTab";
// Subtle clickable player name -> public player profile (roster / applications / requests).
import { PlayerLink } from "@/components/ui/entity-link";
// Team-side "Request blacklist lift" action: lets a manager (or a member, for themselves)
// ask an organizer to lift an active organizer blacklist on this team. It AUTO-DISCOVERS the
// blacklists affecting this team via GET /organizers/blacklists/mine/?team_id= (no manual id
// entry), then posts to /organizers/blacklists/<id>/request-lift/. See RequestBlacklistLift.tsx.
import { RequestBlacklistLift } from "./_components/RequestBlacklistLift";

const FormSchema = z.object({
  new_owner_ign: z.string().min(1, { message: "Please select a new owner." }),
});

type Params = Promise<{
  id: string;
}>;

const Page = ({ params }: { params: Params }) => {
  const { id } = use(params);
  const router = useRouter();
  const { openAuthModal } = useAuthModal();
  const [inviteLink, setInviteLink] = useState("");
  const [isTeamCreator, setIsTeamCreator] = useState(false);
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newMemberSearch, setNewMemberSearch] = useState("");
  const [successRequest, setSuccessRequest] = useState(false);

  const [pending, startTransition] = useTransition();
  const [pendingRequest, startRequestTransition] = useTransition();
  const [pendingApproveRequest, startApproveRequestTransition] =
    useTransition();
  const [pendingDenyRequest, startDenyRequestTransition] = useTransition();
  const [pendingInvite, startInviteTransition] = useTransition();
  const [pendingDisbanded, startDisbandTransition] = useTransition();
  const [pendingTransfer, startTransferTransition] = useTransition();
  const [pendingExit, startExitTransition] = useTransition();
  const [teamDetails, setTeamDetails] = useState<any>();
  const [joinRequests, setJoinRequests] = useState<any>();
  const [joinRequestsPage, setJoinRequestsPage] = useState(1);
  const [membersPage, setMembersPage] = useState(1);
  const [playerMarketApplications, setPlayerMarketApplications] = useState<any[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [reviewApp, setReviewApp] = useState<ApplicationRecord | null>(null);

  const { user, token } = useAuth();
  const isAdmin = user?.role === "admin";

  const requireAuth = (action: () => void) => {
    if (!token) {
      openAuthModal({ defaultTab: "login", onSuccess: action });
      return;
    }
    action();
  };

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  });

  useEffect(() => {
    if (!id) return; // Don't run if id is not available yet

    startTransition(async () => {
      try {
        const decodedId = decodeURIComponent(id);
        // Send the viewer's token: get-team-details now gates the detailed stats
        // (tournament_performance / recent_matches / scalars) to team MEMBERS + admins.
        // Without it the backend treats the caller as anonymous and zeroes those, which
        // would leave a member's own Statistics + Achievements tabs showing 0s.
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
          { team_name: decodedId },
          token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
        );
        const requestResponse = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/view-join-requests-for-a-team/`,
          { team_id: res.data.team.team_id },
        );
        setTeamDetails(res.data.team);
        setIsTeamCreator(res.data.team.team_creator === user?.in_game_name);

        // Determine who has full access to team controls
        const teamOwner = res.data.team.team_owner;
        const teamCreator = res.data.team.team_creator;

        // If there's a team_owner, only the team_owner has full access
        // If there's no team_owner (null), the team_creator has full access
        if (teamOwner) {
          setHasFullAccess(teamOwner === user?.in_game_name);
        } else {
          setHasFullAccess(teamCreator === user?.in_game_name);
        }

        setJoinRequests(requestResponse.data.join_requests);
      } catch (error: any) {
        toast.error(error.response.data.message);
      }
    });
  }, [id, user?.in_game_name, token]);

  // inside your component after you fetch teamDetails
  const isMember = teamDetails?.members?.some(
    (member: any) => member.username === user?.in_game_name,
  );

  // Roster management is open to the team owner (hasFullAccess) AND to a coach on this
  // team - mirrors the backend _can_manage_roster gate. Edit Team stays owner-only.
  const isCoachOnTeam = teamDetails?.members?.some(
    (member: any) =>
      member.username === user?.in_game_name &&
      member.management_role === "coach",
  );
  const canManageRoster = hasFullAccess || isCoachOnTeam;

  // canManageTeam = may act for the WHOLE team on the blacklist-lift surface. Mirrors the
  // backend _is_team_manager gate (afc_organizers/views_blacklist.py): the team owner, or a
  // member whose management_role is team_captain / coach / manager. A plain member can still
  // request a lift for THEMSELVES (player scope), just not for the whole team.
  const isManagerMember = teamDetails?.members?.some(
    (member: any) =>
      member.username === user?.in_game_name &&
      ["team_captain", "coach", "manager"].includes(member.management_role),
  );
  const canManageTeam = hasFullAccess || isManagerMember;

  const handleJoinTeam = () => {
    startRequestTransition(async () => {
      try {
        if (teamDetails.join_settings === "open") {
          const res = await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/join-team/`,
            { team_id: teamDetails.team_id },
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          toast.success(res.data.message);
          await refreshTeamDetails();
        } else {
          const res = await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/send-join-request/`,
            { team_id: teamDetails.team_id, message: "" },
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          toast.success(res.data.message);
        }
        setSuccessRequest(true);
      } catch (error: any) {
        toast.error(error.response.data.message);
        setSuccessRequest(true);
      }
    });
  };

  const [pendingGenerateLink, startGenerateLinkTransition] = useTransition();
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<string>("");

  const handleGenerateInviteLink = (role: string) => {
    setRolePickerOpen(false);
    startGenerateLinkTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/generate-invite-link/`,
          { team_id: teamDetails.team_id, role },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setInviteLink(response.data.invite_link);
        toast.success("Invite link generated successfully!");
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to generate invite link",
        );
      }
    });
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success("Invite link copied to your clipboard. ");
  };

  const handleApproveJoinRequest = (requestId: string) => {
    startApproveRequestTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/review-join-request/`,
          { request_id: requestId, decision: "approved" },
          { headers: { Authorization: `Bearer ${token}` } },
        );

        toast.success(res.data.message);

        // Update the local state to show "Approved" for this specific row
        setJoinRequests((prev: any) =>
          prev.map((req: any) =>
            req.request_id === requestId
              ? { ...req, isProcessed: "approved" }
              : req,
          ),
        );

        // Silently update team members in the background so the "Members" tab is current
        refreshTeamDetails();
      } catch (error: any) {
        toast.error(
          error.response?.data?.message || "Failed to approve request",
        );
      }
    });
  };

  const handleDenyJoinRequest = (requestId: string) => {
    startDenyRequestTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/review-join-request/`,
          { request_id: requestId, decision: "denied" },
          { headers: { Authorization: `Bearer ${token}` } },
        );

        toast.success(res.data.message);

        // OPTIMISTIC UI UPDATE: Just remove the request from the list
        setJoinRequests((prev: any) =>
          prev.filter((req: any) => req.request_id !== requestId),
        );
      } catch (error: any) {
        toast.error(error.response?.data?.message || "Failed to deny request");
      }
    });
  };
  const handleAddNewMember = () => {
    if (!newMemberSearch)
      return toast.error("Please enter UID or in-game-name or email");
    if (teamDetails.members.length >= 6) {
      toast.error("Team is full");
    }

    startInviteTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/invite-member/`,
          {
            team_id: teamDetails.team_id,
            invitee_email_or_ign: newMemberSearch,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        toast.success(res.data.message);
        setNewMemberSearch("");
      } catch (error: any) {
        toast.error(error.response.data.message);
      }
    });
  };

  const handleDisbandTeam = async () => {
    startDisbandTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/disband-team/`,
          { team_id: teamDetails.team_id },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (response.statusText === "OK") {
          toast.success(response.data.message);
          router.push("/teams");
        } else {
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        toast.error(error?.response?.data?.message);
      }
    });
  };

  const handleExitTeam = async () => {
    startExitTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/exit-team/`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        toast.success(
          response.data.message || "You have left the team successfully",
        );
        router.push("/teams");
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Failed to exit team");
      }
    });
  };

  function onSubmit(data: z.infer<typeof FormSchema>) {
    startTransferTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/transfer-ownership/`,
          { new_owner_ign: data.new_owner_ign },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.statusText === "OK") {
          toast.success(
            response.data.message || "Ownership transferred successfully!",
          );
          router.push("/teams");
        } else {
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to transfer ownership",
        );
      }
    });
  }

  const refreshTeamDetails = async () => {
    if (!id) return; // Don't run if id is not available yet

    startTransition(async () => {
      try {
        const decodedId = decodeURIComponent(id);
        // Send the viewer's token: get-team-details now gates the detailed stats
        // (tournament_performance / recent_matches / scalars) to team MEMBERS + admins.
        // Without it the backend treats the caller as anonymous and zeroes those, which
        // would leave a member's own Statistics + Achievements tabs showing 0s.
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
          { team_name: decodedId },
          token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
        );
        const requestResponse = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/view-join-requests-for-a-team/`,
          { team_id: res.data.team.team_id },
        );
        setTeamDetails(res.data.team);
        setIsTeamCreator(res.data.team.team_creator === user?.in_game_name);

        // Determine who has full access to team controls
        const teamOwner = res.data.team.team_owner;
        const teamCreator = res.data.team.team_creator;

        // If there's a team_owner, only the team_owner has full access
        // If there's no team_owner (null), the team_creator has full access
        if (teamOwner) {
          setHasFullAccess(teamOwner === user?.in_game_name);
        } else {
          setHasFullAccess(teamCreator === user?.in_game_name);
        }

        setJoinRequests(requestResponse.data.join_requests);
      } catch (error: any) {
        toast.error(error.response.data.message);
      }
    });
  };

  useEffect(() => {
    if (!hasFullAccess || !token) return;
    setLoadingApplications(true);
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-applications/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setPlayerMarketApplications(res.data))
      .catch(() => toast.error("Failed to load player market applications."))
      .finally(() => setLoadingApplications(false));
  }, [hasFullAccess, token]);

  const appStats = useMemo(() => ({
    total: playerMarketApplications.length,
    pending: playerMarketApplications.filter((a) => a.status === "PENDING").length,
    shortlisted: playerMarketApplications.filter((a) => a.status === "SHORTLISTED").length,
    invited: playerMarketApplications.filter(
      (a) => a.status === "INVITED" || a.status === "TRIAL_EXTENDED",
    ).length,
  }), [playerMarketApplications]);

  if (pending) return <FullLoader />;

  if (teamDetails)
    return (
      <div>
        <PageHeader back title={teamDetails?.team_name} />
        <Card className={teamDetails.is_banned ? "border-red-500" : ""}>
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start gap-4 md:gap-0 md:items-center justify-between">
              <div className="flex items-center space-x-4">
                <Avatar className="w-20 h-20">
                  <AvatarImage
                    src={teamDetails?.team_logo}
                    alt={teamDetails?.team_name}
                    className="object-cover"
                  />
                  <AvatarFallback>{teamDetails?.team_name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl md:text-3xl">
                      {teamDetails?.team_name}
                    </CardTitle>
                    {/* Short team handle (Team.team_tag) shown next to the name when set. */}
                    {teamDetails?.team_tag && (
                      <Badge
                        variant="outline"
                        className="rounded-full text-xs"
                      >
                        {teamDetails.team_tag}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Country: {teamDetails?.country}
                  </p>
                  {teamDetails?.is_banned && (
                    <Badge variant="destructive" className="mt-2">
                      BANNED
                    </Badge>
                  )}
                </div>
              </div>
              <div className="space-x-2 w-full md:w-auto">
                {!hasFullAccess &&
                  !teamDetails?.is_banned &&
                  !isMember &&
                  teamDetails.join_settings === "by_request" && (
                    <Button
                      className="w-full md:w-auto"
                      disabled={
                        pendingRequest ||
                        successRequest ||
                        teamDetails.members.length >= 6
                      }
                      onClick={() => requireAuth(handleJoinTeam)}
                    >
                      {pendingRequest ? (
                        <Loader text="Sending..." />
                      ) : (
                        <>
                          <UserPlus />
                          Request to Join
                        </>
                      )}
                    </Button>
                  )}
                {!hasFullAccess &&
                  !teamDetails?.is_banned &&
                  !isMember &&
                  teamDetails.join_settings === "open" && (
                    <Button
                      className="w-full md:w-auto"
                      disabled={pendingRequest || successRequest}
                      onClick={() => requireAuth(handleJoinTeam)}
                    >
                      {pendingRequest ? (
                        <Loader text="Sending..." />
                      ) : (
                        <>
                          <UserPlus />
                          Join now
                        </>
                      )}
                    </Button>
                  )}
                {/* Edit Team: owner-only */}
                {hasFullAccess && !teamDetails?.is_banned && (
                  <Button variant={"secondary"} asChild>
                    <Link href={`/teams/${teamDetails?.team_name}/edit`}>
                      <Edit />
                      Edit Team
                    </Link>
                  </Button>
                )}
                {/* Manage Roster: owner or coach */}
                {canManageRoster && !teamDetails?.is_banned && (
                  <Button asChild>
                    <Link href={`/teams/${teamDetails?.team_name}/roster`}>
                      <Users />
                      Manage Roster
                    </Link>
                  </Button>
                )}
                {!hasFullAccess && isMember && !teamDetails?.is_banned && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="w-full md:w-auto"
                      >
                        <IconLogout />
                        Exit Team
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Exit Team</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to leave{" "}
                          {teamDetails?.team_name}? This action cannot be
                          undone.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button
                          variant="destructive"
                          onClick={() => requireAuth(handleExitTeam)}
                          disabled={pendingExit}
                        >
                          {pendingExit ? (
                            <Loader text="Leaving..." />
                          ) : (
                            "Yes, Exit Team"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {teamDetails?.is_banned && (
              <Alert variant="destructive" className="mb-6">
                <IconAlertTriangle className="h-4 w-4" />
                <AlertTitle>This team is currently banned</AlertTitle>
                <AlertDescription>
                  Reason: {teamDetails?.ban_reason}
                  <br />
                  Team members are restricted from certain activities, including
                  leaving the team, registering for tournaments, or changing
                  in-game names.
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="overview">
              <ScrollArea>
                <TabsList className="w-full">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="members">Members</TabsTrigger>
                  {/* Statistics tab is hidden entirely from outsiders: it only renders
                      when the backend says this viewer may see the detailed stats
                      (team member, owner, or AFC admin). stats_visible comes from
                      get-team-details, which the page fetches WITH the viewer's token. */}
                  {teamDetails?.stats_visible && (
                    <TabsTrigger value="statistics">Statistics</TabsTrigger>
                  )}
                  <TabsTrigger value="achievements">Achievements</TabsTrigger>
                  <TabsTrigger value="social">Social Media</TabsTrigger>
                  {hasFullAccess && (
                    <TabsTrigger value="requests">Requests & Applications</TabsTrigger>
                  )}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              <TabsContent value="overview">
                <Card>
                  <CardHeader>
                    <CardTitle>Team Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Country</p>
                        <p className="text-lg md:text-xl font-semibold">
                          {teamDetails?.country}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Total Kills
                        </p>
                        <p className="text-lg md:text-xl font-semibold">
                          {teamDetails?.stats?.total_kills
                            ? teamDetails?.stats?.total_kills
                            : 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Total Wins
                        </p>
                        <p className="text-lg md:text-xl font-semibold">
                          {teamDetails?.stats?.scrim_wins &&
                          teamDetails?.stats?.tournament_wins
                            ? teamDetails?.stats?.scrim_wins +
                              teamDetails?.stats?.tournament_wins
                            : 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Tier</p>
                        <p className="text-lg md:text-xl font-semibold">
                          {teamDetails?.team_tier}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Tournaments Played
                        </p>
                        <p className="text-lg md:text-xl font-semibold">
                          {teamDetails?.stats?.tournaments_played
                            ? teamDetails?.stats?.tournaments_played
                            : 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Scrims Played
                        </p>
                        <p className="text-lg md:text-xl font-semibold">
                          {teamDetails?.stats?.scrims_played
                            ? teamDetails?.stats?.scrims_played
                            : 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Creation Date
                        </p>
                        <p className="text-lg md:text-xl font-semibold">
                          {formatDate(teamDetails?.creation_date)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Organizer blacklist - request lift. Visible to team MEMBERS only
                    (a non-member has no standing to ask). The component auto-discovers the
                    blacklists affecting this team (GET /organizers/blacklists/mine/) and the
                    backend flags on each one decide whether a whole-team or for-myself lift is
                    offered. canManageTeam is just a hint for the empty-state line. */}
                {isMember && (
                  <div className="mt-4">
                    <RequestBlacklistLift
                      teamId={teamDetails?.team_id}
                      currentUserId={user?.user_id}
                      canManageTeam={!!canManageTeam}
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="members">
                <Card>
                  <CardHeader>
                    <CardTitle>Team Members</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="truncate">Name</TableHead>
                          <TableHead className="truncate">
                            In Game Role
                          </TableHead>
                          <TableHead className="truncate">
                            Management Role
                          </TableHead>
                          <TableHead className="truncate">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamDetails?.members
                          ?.slice(
                            (membersPage - 1) * ITEMS_PER_PAGE,
                            membersPage * ITEMS_PER_PAGE,
                          )
                          .map((member: any, index: string) => (
                            <TableRow key={index}>
                              <TableCell>
                                {/* Member name links to the public player profile. */}
                                <PlayerLink name={member.username} />
                              </TableCell>
                              <TableCell>
                                {formatWord(member.in_game_role) || (
                                  <span className="italic">Not selected</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {formatWord(member.management_role)}
                              </TableCell>
                              <TableCell>
                                <Button size="sm" variant="outline" asChild>
                                  <Link href={`/players/${member.username}`}>
                                    View
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                      {teamDetails?.members === undefined && (
                        <p className="italic text-sm text-center py-4 w-full">
                          There are no members yet
                        </p>
                      )}
                    </Table>
                    {Math.ceil(
                      (teamDetails?.members?.length ?? 0) / ITEMS_PER_PAGE,
                    ) > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <p className="hidden md:block text-sm text-muted-foreground">
                          Showing {(membersPage - 1) * ITEMS_PER_PAGE + 1}-
                          {Math.min(
                            membersPage * ITEMS_PER_PAGE,
                            teamDetails?.members?.length ?? 0,
                          )}{" "}
                          of {teamDetails?.members?.length ?? 0}
                        </p>
                        <Pagination className="w-full md:w-auto mx-0">
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() =>
                                  setMembersPage((p) => Math.max(1, p - 1))
                                }
                                className={
                                  membersPage === 1
                                    ? "pointer-events-none opacity-50"
                                    : "cursor-pointer"
                                }
                              />
                            </PaginationItem>
                            {Array.from(
                              {
                                length: Math.ceil(
                                  (teamDetails?.members?.length ?? 0) /
                                    ITEMS_PER_PAGE,
                                ),
                              },
                              (_, i) => i + 1,
                            )
                              .filter(
                                (page) =>
                                  page === 1 ||
                                  page ===
                                    Math.ceil(
                                      (teamDetails?.members?.length ?? 0) /
                                        ITEMS_PER_PAGE,
                                    ) ||
                                  Math.abs(page - membersPage) <= 1,
                              )
                              .map((page, idx, arr) => (
                                <React.Fragment key={page}>
                                  {idx > 0 && arr[idx - 1] !== page - 1 && (
                                    <PaginationItem>
                                      <PaginationEllipsis />
                                    </PaginationItem>
                                  )}
                                  <PaginationItem>
                                    <PaginationLink
                                      isActive={membersPage === page}
                                      onClick={() => setMembersPage(page)}
                                      className="cursor-pointer"
                                    >
                                      {page}
                                    </PaginationLink>
                                  </PaginationItem>
                                </React.Fragment>
                              ))}
                            <PaginationItem>
                              <PaginationNext
                                onClick={() =>
                                  setMembersPage((p) =>
                                    Math.min(
                                      Math.ceil(
                                        (teamDetails?.members?.length ?? 0) /
                                          ITEMS_PER_PAGE,
                                      ),
                                      p + 1,
                                    ),
                                  )
                                }
                                className={
                                  membersPage ===
                                  Math.ceil(
                                    (teamDetails?.members?.length ?? 0) /
                                      ITEMS_PER_PAGE,
                                  )
                                    ? "pointer-events-none opacity-50"
                                    : "cursor-pointer"
                                }
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                    {/*
                      Roster rule: a team fields at most 6 PLAYERS but can hold up to
                      8 MEMBERS total — the extra slots are for staff (coach / manager
                      / analyst), who never take a player slot. The invite form used to
                      vanish silently at 6 members, which both hid the staff path and
                      gave no explanation. Now it stays open until 8 with the rule spelt
                      out, and shows a clear "team full" note once 8 is reached.
                    */}
                    {hasFullAccess &&
                      (teamDetails?.members?.length ?? 0) < 8 && (
                        <div className="mt-4">
                          <h4 className="text-lg font-semibold mb-2">
                            Add New Member
                          </h4>
                          <p className="text-xs text-muted-foreground mb-2">
                            A roster can field at most{" "}
                            <span className="font-medium text-foreground">
                              6 players
                            </span>
                            . You can have up to 8 members in total. Anyone beyond
                            the 6 players must be set as staff (coach, manager or
                            analyst) on the Manage Roster page. Staff don&apos;t take
                            a player slot.
                          </p>
                          <div className="flex items-start space-x-2">
                            {/* Search-as-you-type user picker (replaces the raw email input).
                                Yields the selected player's username into newMemberSearch, which
                                handleAddNewMember posts as invitee_email_or_ign. */}
                            <div className="flex-1">
                              <UserSearchSelect
                                value={newMemberSearch || null}
                                onChange={(u) => setNewMemberSearch(u ?? "")}
                                placeholder="Search a player to invite..."
                              />
                            </div>
                            <Button
                              onClick={() => requireAuth(handleAddNewMember)}
                            >
                              {pendingInvite ? (
                                <Loader text=" " />
                              ) : (
                                <>
                                  <IconSearch />
                                  Invite
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    {hasFullAccess &&
                      (teamDetails?.members?.length ?? 0) >= 8 && (
                        <div className="mt-4 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                          Your team is full (8 members maximum). A roster fields at
                          most 6 players; the rest are staff (coach, manager,
                          analyst). Remove a member before adding someone new.
                        </div>
                      )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Statistics tab content only mounts for viewers allowed to see the
                  detailed stats (members / owner / admin); outsiders never get the tab. */}
              {teamDetails?.stats_visible && (
                <TabsContent value="statistics">
                  {/*
                    Detailed Team Statistics. Wired to the real get-team-details
                    payload (aggregate scalars + tournament_performance with the new
                    event_date/prize_earned fields + recent_matches + tier_history).
                    The component handles its own range filter, metric switcher,
                    expandable rows, and degraded-data empty states.
                  */}
                  <TeamStatisticsTab team={teamDetails} />
                </TabsContent>
              )}

              {/*
                Achievements tab. Display-only, tiered catalog mirroring the player
                profile's Achievements. It reuses the already-fetched `teamDetails`
                object (no second request): lifetime ladders are computed from real
                derived team stats (total_wins, summed tournament kills, tournaments
                played, 1st-place finishes) plus roster facts (member count), while
                scrims / monthly / daily render as honest "not tracked yet" goals.
                The points->rankings/tiers boost is a FUTURE feature, shown as a
                "coming soon" note and NOT applied. Visible to anyone who can see the
                team page; no extra gating is added here. The panel is a normal
                layout (no <tbody>), so there is no hydration error.
              */}
              <TabsContent value="achievements">
                <TeamAchievementsTab team={teamDetails} />
              </TabsContent>

              <TabsContent value="social">
                <Card>
                  <CardHeader>
                    <CardTitle>Social Media</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {teamDetails?.social_media_links.length === 0 && (
                        <div className="text-center py-14 text-sm text-muted-foreground italic border-2 border-dashed border-zinc-800 rounded-lg">
                          No link found
                        </div>
                      )}
                      {teamDetails?.social_media_links?.map(
                        (link: any, index: any) => (
                          <Link
                            key={index}
                            href={link.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-2 text-muted-foreground hover:text-primary"
                          >
                            {link.platform === "facebook" && (
                              <Facebook className="h-5 w-5" />
                            )}
                            {link.platform === "twitter" && (
                              <Twitter className="h-5 w-5" />
                            )}
                            {link.platform === "instagram" && (
                              <Instagram className="h-5 w-5" />
                            )}
                            {link.platform === "youtube" && (
                              <Youtube className="h-5 w-5" />
                            )}
                            {link.platform === "twitch" && (
                              <Twitch className="h-5 w-5" />
                            )}
                            <span>
                              {link.platform.charAt(0).toUpperCase() +
                                link.platform.slice(1)}
                            </span>
                          </Link>
                        ),
                      )}
                      {teamDetails?.social_media_links === undefined && (
                        <p className="text-sm text-center italic">
                          No social media links
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {hasFullAccess && (
                <TabsContent value="requests">
                  <div className="space-y-6">
                    {/* ── Player Market Applications ─────────────────── */}
                    <Card>
                      <CardHeader>
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-base">
                              Player Market Applications
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              Applications from players via your recruitment post
                            </p>
                          </div>
                          <Button variant="outline" size="sm" className="shrink-0" asChild>
                            <Link href={`/teams/${teamDetails?.team_name}/applications`}>
                              <IconExternalLink className="h-4 w-4 mr-1.5" />
                              View All Applications
                            </Link>
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {loadingApplications ? (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            Loading...
                          </div>
                        ) : playerMarketApplications.length === 0 ? (
                          <NothingFound text="No applications received yet." />
                        ) : (
                          <>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Player</TableHead>
                                  <TableHead>Applied</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Contact</TableHead>
                                  <TableHead>Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {playerMarketApplications.map((app: any) => (
                                  <TableRow key={app.id}>
                                    <TableCell className="font-medium">
                                      {/* Applicant name links to the public player profile. */}
                                      <PlayerLink name={app.player} />
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                      {formatDate(app.applied_at)}
                                    </TableCell>
                                    <TableCell>
                                      {getStatusBadge(app.status)}
                                    </TableCell>
                                    <TableCell>
                                      {app.contact_unlocked ? (
                                        <Badge variant="outline" className="text-green-400 border-green-800 text-xs">
                                          Unlocked
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-muted-foreground text-xs">
                                          Locked
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setReviewApp(app)}
                                      >
                                        Review
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>

                            {/* Summary stats */}
                            <div className="flex items-center gap-6 pt-4 mt-2 border-t">
                              <div>
                                <p className="text-xl font-bold">{appStats.total}</p>
                                <p className="text-xs text-muted-foreground">Total</p>
                              </div>
                              <div>
                                <p className="text-xl font-bold text-yellow-400">{appStats.pending}</p>
                                <p className="text-xs text-muted-foreground">Pending</p>
                              </div>
                              <div>
                                <p className="text-xl font-bold text-cyan-400">{appStats.shortlisted}</p>
                                <p className="text-xs text-muted-foreground">Shortlisted</p>
                              </div>
                              <div>
                                <p className="text-xl font-bold text-green-400">{appStats.invited}</p>
                                <p className="text-xs text-muted-foreground">Invited</p>
                              </div>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    <Separator />

                    {/* ── Direct Join Requests ──────────────────────── */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Direct Join Requests</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Players who requested to join directly from your team page
                        </p>
                      </CardHeader>
                      <CardContent>
                      {joinRequests?.length === 0 ? (
                        <NothingFound text="No pending join requests." />
                      ) : (
                        <>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="truncate">Name</TableHead>
                                <TableHead className="truncate">UID</TableHead>
                                <TableHead className="truncate">
                                  Actions
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {joinRequests
                                ?.slice(
                                  (joinRequestsPage - 1) * ITEMS_PER_PAGE,
                                  joinRequestsPage * ITEMS_PER_PAGE,
                                )
                                .map((request: any) => (
                                  <TableRow key={request.request_id}>
                                    <TableCell>
                                      {/* Requester name links to the public player profile. */}
                                      <PlayerLink name={request.requester} />
                                    </TableCell>
                                    <TableCell>{request.uid}</TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          variant="default"
                                          disabled={
                                            pendingApproveRequest ||
                                            pendingDenyRequest
                                          }
                                          // onClick={() =>
                                          //   handleApproveJoinRequest(
                                          //     request.request_id,
                                          //   )
                                          // }
                                          onClick={() =>
                                            requireAuth(() =>
                                              handleApproveJoinRequest(
                                                request.request_id,
                                              ),
                                            )
                                          }
                                        >
                                          {pendingApproveRequest ? (
                                            <Loader text="" />
                                          ) : (
                                            "Approve"
                                          )}
                                        </Button>

                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                          disabled={
                                            pendingApproveRequest ||
                                            pendingDenyRequest
                                          }
                                          onClick={() =>
                                            requireAuth(() => {
                                              handleDenyJoinRequest(
                                                request.request_id,
                                              );
                                            })
                                          }
                                        >
                                          {pendingDenyRequest ? (
                                            <Loader text="" />
                                          ) : (
                                            "Deny"
                                          )}
                                        </Button>

                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          asChild
                                        >
                                          <Link
                                            href={`/players/${request.requester}`}
                                          >
                                            View Profile
                                          </Link>
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                          {Math.ceil(
                            (joinRequests?.length ?? 0) / ITEMS_PER_PAGE,
                          ) > 1 && (
                            <div className="flex items-center justify-between mt-4">
                              <p className="hidden md:block text-sm text-muted-foreground">
                                Showing{" "}
                                {(joinRequestsPage - 1) * ITEMS_PER_PAGE + 1}-
                                {Math.min(
                                  joinRequestsPage * ITEMS_PER_PAGE,
                                  joinRequests?.length ?? 0,
                                )}{" "}
                                of {joinRequests?.length ?? 0}
                              </p>
                              <Pagination className="w-full md:w-auto mx-0">
                                <PaginationContent>
                                  <PaginationItem>
                                    <PaginationPrevious
                                      onClick={() =>
                                        setJoinRequestsPage((p) =>
                                          Math.max(1, p - 1),
                                        )
                                      }
                                      className={
                                        joinRequestsPage === 1
                                          ? "pointer-events-none opacity-50"
                                          : "cursor-pointer"
                                      }
                                    />
                                  </PaginationItem>
                                  {Array.from(
                                    {
                                      length: Math.ceil(
                                        (joinRequests?.length ?? 0) /
                                          ITEMS_PER_PAGE,
                                      ),
                                    },
                                    (_, i) => i + 1,
                                  )
                                    .filter(
                                      (page) =>
                                        page === 1 ||
                                        page ===
                                          Math.ceil(
                                            (joinRequests?.length ?? 0) /
                                              ITEMS_PER_PAGE,
                                          ) ||
                                        Math.abs(page - joinRequestsPage) <= 1,
                                    )
                                    .map((page, idx, arr) => (
                                      <React.Fragment key={page}>
                                        {idx > 0 &&
                                          arr[idx - 1] !== page - 1 && (
                                            <PaginationItem>
                                              <PaginationEllipsis />
                                            </PaginationItem>
                                          )}
                                        <PaginationItem>
                                          <PaginationLink
                                            isActive={joinRequestsPage === page}
                                            onClick={() =>
                                              setJoinRequestsPage(page)
                                            }
                                            className="cursor-pointer"
                                          >
                                            {page}
                                          </PaginationLink>
                                        </PaginationItem>
                                      </React.Fragment>
                                    ))}
                                  <PaginationItem>
                                    <PaginationNext
                                      onClick={() =>
                                        setJoinRequestsPage((p) =>
                                          Math.min(
                                            Math.ceil(
                                              (joinRequests?.length ?? 0) /
                                                ITEMS_PER_PAGE,
                                            ),
                                            p + 1,
                                          ),
                                        )
                                      }
                                      className={
                                        joinRequestsPage ===
                                        Math.ceil(
                                          (joinRequests?.length ?? 0) /
                                            ITEMS_PER_PAGE,
                                        )
                                          ? "pointer-events-none opacity-50"
                                          : "cursor-pointer"
                                      }
                                    />
                                  </PaginationItem>
                                </PaginationContent>
                              </Pagination>
                            </div>
                          )}
                        </>
                      )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              )}
            </Tabs>

            {hasFullAccess && !teamDetails?.is_banned && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Team Owner Controls</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button
                      onClick={() => requireAuth(() => { setInviteRole(""); setRolePickerOpen(true); })}
                      className="w-full"
                      disabled={pendingGenerateLink}
                    >
                      {pendingGenerateLink ? (
                        <Loader text="Generating..." />
                      ) : (
                        "Generate Invite Link"
                      )}
                    </Button>
                    {inviteLink && (
                      <div className="flex items-center space-x-2">
                        <Input value={inviteLink} readOnly />
                        <Button size="icon-lg" onClick={handleCopyInviteLink}>
                          <IconCopy />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="destructive" className="flex-1">
                            Disband Team
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Disband Team</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to disband this team? This
                              action cannot be undone.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => {}}>
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => requireAuth(handleDisbandTeam)}
                              disabled={pendingDisbanded}
                            >
                              {pendingDisbanded ? (
                                <Loader text="Disbanding..." />
                              ) : (
                                "Disband"
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button className="flex-1" variant={"secondary"}>
                            Transfer Ownership
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Transfer Team Ownership</DialogTitle>
                            <DialogDescription>
                              Select a team member to transfer ownership to.
                            </DialogDescription>
                          </DialogHeader>
                          <Form {...form}>
                            <form
                              onSubmit={() =>
                                requireAuth(form.handleSubmit(onSubmit))
                              }
                              className="space-y-6"
                            >
                              <FormField
                                control={form.control}
                                name="new_owner_ign"
                                render={({ field }) => (
                                  <FormItem>
                                    <Select
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select new owner" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {teamDetails?.members
                                          ?.filter(
                                            (member: any) =>
                                              member.username !==
                                              user?.in_game_name,
                                          )
                                          ?.map((member: any) => (
                                            <SelectItem
                                              key={member.id}
                                              value={member.username}
                                            >
                                              {member.username}
                                            </SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <DialogFooter className="flex gap-4">
                                <DialogClose asChild>
                                  <Button variant="outline" type="button">
                                    Cancel
                                  </Button>
                                </DialogClose>
                                <Button
                                  type="submit"
                                  disabled={pendingTransfer}
                                >
                                  {pendingTransfer ? (
                                    <Loader text="Transferring..." />
                                  ) : (
                                    "Transfer"
                                  )}
                                </Button>
                              </DialogFooter>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {isAdmin && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Admin Controls</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <BanModal
                      is_banned={teamDetails?.is_banned ?? false}
                      teamName={teamDetails?.team_name ?? "Team"}
                      team_id={teamDetails?.team_id ?? ""}
                      onSuccess={() => {
                        refreshTeamDetails();
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      {/* ─── Review Application Modal ──────────────────────────────── */}
      <ReviewApplicationDialog
        app={reviewApp}
        token={token}
        onClose={() => setReviewApp(null)}
        onStatusUpdated={(updated) =>
          setPlayerMarketApplications((prev) =>
            prev.map((a) => (a.id === updated.id ? updated : a)),
          )
        }
      />

      {/* Role picker modal for Generate Invite Link */}
      <Dialog open={rolePickerOpen} onOpenChange={setRolePickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate Invite Link</DialogTitle>
            <DialogDescription>
              Select the role this invite link is for.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-2">
            {(["member", "coach", "analyst", "manager"] as const).map((role) => (
              <Button
                key={role}
                variant={inviteRole === role ? "default" : "outline"}
                className="capitalize"
                onClick={() => setInviteRole(role)}
              >
                {role}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRolePickerOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!inviteRole}
              onClick={() => handleGenerateInviteLink(inviteRole)}
            >
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    );
};

export default Page;
