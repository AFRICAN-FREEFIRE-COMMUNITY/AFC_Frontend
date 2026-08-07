"use client";

import React, { useState, useEffect, useTransition, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Shared, self-expiring NEW tag (owner rule: any new surface wears one for 5 days).
import { NewBadge } from "@/components/NewBadge";
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
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
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
  Flag,
} from "lucide-react";
// Generic report dialog (owner 2026-06-20): used here with subjectType="team" so a
// logged-in viewer can report a whole team. Posts to /auth/report-team/.
import { ReportDialog } from "@/components/player/ReportDialog";
// Public fan/hater reactions for the team (owner 2026-06-20).
import { FanHater } from "@/components/profile/FanHater";
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
import { useTranslations } from "next-intl";
// LocalTime renders a stored UTC timestamp in the viewer's own timezone + language.
import { LocalTime } from "@/components/LocalTime";
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
import { formatWord } from "@/lib/utils";
import { DEFAULT_PROFILE_PICTURE } from "@/constants";
import { ScrollableTabsList } from "@/components/ui/scrollable-tabs";
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
// Event invitations the team has been sent (owner backlog item 34): accept (which registers the
// team through the ordinary registration path) or decline with a reason. Owns its own fetch of
// /events/team-invitations/mine/ and renders nothing when there are no invitations.
import { EventInvitationsCard } from "./_components/EventInvitationsCard";
// Subtle clickable player name -> public player profile (roster / applications / requests).
import { PlayerLink } from "@/components/ui/entity-link";
import { CountryFlag } from "@/lib/countryFlag";
// Team-side "Request blacklist lift" action: lets a manager (or a member, for themselves)
// ask an organizer to lift an active organizer blacklist on this team. It AUTO-DISCOVERS the
// blacklists affecting this team via GET /organizers/blacklists/mine/?team_id= (no manual id
// entry), then posts to /organizers/blacklists/<id>/request-lift/. See RequestBlacklistLift.tsx.
import { RequestBlacklistLift } from "./_components/RequestBlacklistLift";
// Live refresh (owner 2026-07-02): site-wide heartbeat; re-runs the read-only team-details +
// join-requests + market-applications fetches so the page updates without a manual refresh.
import { useLiveTick } from "@/hooks/useLiveTick";

const FormSchema = z.object({
  new_owner_ign: z.string().min(1, { message: "Please select a new owner." }),
});

// ── Roster capacity (owner 2026-08-04, backlog item 33) ─────────────────────────
// Mirrors afc_team/views.py MAX_MEMBERS / MAX_PLAYERS / PLAYER_ROLES. A team holds at most
// MAX_TEAM_MEMBERS people, of whom at most MAX_TEAM_PLAYERS may be PLAYERS; the remaining seats
// are staff, capped at one coach, one manager and one analyst (which is exactly why the total is
// 9). These numbers only shape the UI - the backend enforces the same caps on every join path, so
// a stale page can never seat somebody it shouldn't.
const MAX_TEAM_MEMBERS = 9;
const MAX_TEAM_PLAYERS = 6;
// The PLAYING roles, i.e. the ones that consume one of the 6 player slots. 'member' is the stored
// value that now DISPLAYS as "Player" (see the common.teamRoles catalog); the value itself is
// unchanged because a live data rename cannot ship from this repo.
const PLAYER_ROLES = ["team_captain", "vice_captain", "member"];
// Roles somebody can be invited INTO. Captain / vice captain are promotions handed out on the
// Manage Roster page, never by an invite, so they are absent here. Matches the backend's
// _INVITABLE_ROLES whitelist used by invite-member and generate-invite-link.
const INVITABLE_ROLES = ["member", "coach", "analyst", "manager"] as const;

type Params = Promise<{
  id: string;
}>;

const Page = ({ params }: { params: Params }) => {
  const { id } = use(params);
  // i18n: team detail page copy (messages/en/teamsplayers.json -> "teamDetail").
  const t = useTranslations("teamsplayers");
  // Report-dialog copy (separate namespace, messages/en/playerReports.json).
  const tReport = useTranslations("playerReports");
  // Team-feature copy (messages/en/team.json -> "letterAvatars"): the read-only letter-avatar chips
  // shown in the Overview tab. Same namespace the team-edit manager panel uses.
  const tTeam = useTranslations("team");
  // Shared management-role labels (messages/en/common.json -> "teamRoles"), keyed by the STORED
  // role value. One catalog so the roster table, the invite form and the invite-link picker all
  // name a role the same way - notably 'member', which stores as "member" but reads as "Player"
  // (owner 2026-08-04, backlog item 33).
  const tc = useTranslations("common");
  // Label for a stored management_role. Falls back to the raw value for anything unrecognised, so
  // an unexpected role from the API still renders instead of blanking the cell.
  const roleLabel = (role?: string | null) =>
    role ? (tc.has(`teamRoles.${role}`) ? tc(`teamRoles.${role}`) : formatWord(role)) : "";
  const router = useRouter();
  const { openAuthModal } = useAuthModal();
  const [inviteLink, setInviteLink] = useState("");
  // Shared invite links (owner 2026-08-05): how many people the NEXT generated link may seat, and
  // how many the CURRENT one was minted for. 1 = the original single-use link.
  //
  // Declared HERE, beside the other invite state, and NOT next to rolePickerOpen further down:
  // `freeSeats` and its useEffect read inviteMaxUses, and they sit above that point in the
  // component. Declaring it later put the read inside the temporal dead zone and the whole team
  // page died with "Cannot access 'inviteMaxUses' before initialization" - which the production
  // build did NOT catch, only opening the page did.
  const [inviteMaxUses, setInviteMaxUses] = useState(1);
  const [inviteLinkUses, setInviteLinkUses] = useState(1);
  const [isTeamCreator, setIsTeamCreator] = useState(false);
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newMemberSearch, setNewMemberSearch] = useState("");
  // Seat the invitee will take when they accept (owner 2026-08-04, item 33). Defaults to the
  // PLAYING role, which is what the form always sent implicitly before; the picker lets a captain
  // choose a staff seat instead so the team can reach 9 without demoting anyone.
  const [newMemberRole, setNewMemberRole] =
    useState<(typeof INVITABLE_ROLES)[number]>("member");
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
  // Team report dialog (owner 2026-06-20): logged-in viewers can report this team.
  const [reportOpen, setReportOpen] = useState(false);

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

  // Live refresh (owner 2026-07-02): heartbeat tick for the read-only fetch effects below.
  const tick = useLiveTick();

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
        // Live refresh (owner 2026-07-02): no error toast on a background refresh (a
        // transient hiccup would nag every 30s); the first load still reports failures.
        if (tick === 0) toast.error(error.response.data.message);
      }
    });
  }, [id, user?.in_game_name, token, tick]);

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

  // How many of the 6 PLAYER slots are taken, counting only PLAYING roles (staff never occupy
  // one). Same basis as the backend's _playing_member_count. Drives the invite form's role picker:
  // at the cap the PLAYING option is disabled and the captain is pointed at a staff seat instead.
  const playerSlotsFull =
    (teamDetails?.members ?? []).filter((m: any) =>
      PLAYER_ROLES.includes(m?.management_role ?? "member"),
    ).length >= MAX_TEAM_PLAYERS;

  // Seats still open on this team. Caps how many uses a shared invite link may be minted for:
  // offering "6 uses" to a team with two places left would produce a link that stops working
  // part way down whatever group chat it was pasted into, and read as a bug.
  const freeSeats = Math.max(
    0,
    MAX_TEAM_MEMBERS - (teamDetails?.members?.length ?? 0),
  );

  // Never leave the uses picker on a number the team can no longer seat (a member can join
  // between opening this page and opening the dialog).
  useEffect(() => {
    if (inviteMaxUses > freeSeats) setInviteMaxUses(Math.max(1, freeSeats));
  }, [freeSeats, inviteMaxUses]);

  // Keep the invite form off an option it cannot use: once every player slot is taken, move the
  // selection to the first staff role so the picker never sits on a disabled value.
  useEffect(() => {
    if (playerSlotsFull && PLAYER_ROLES.includes(newMemberRole)) {
      setNewMemberRole("coach");
    }
  }, [playerSlotsFull, newMemberRole]);

  const [pendingGenerateLink, startGenerateLinkTransition] = useTransition();
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<string>("");

  const handleGenerateInviteLink = (role: string) => {
    setRolePickerOpen(false);
    startGenerateLinkTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/generate-invite-link/`,
          // max_uses only travels when the captain asked for a SHARED link. Sending 1 is the same
          // as sending nothing (the backend treats both as single-use), but omitting it keeps the
          // request identical to what this page has always sent.
          {
            team_id: teamDetails.team_id,
            role,
            ...(inviteMaxUses > 1 ? { max_uses: inviteMaxUses } : {}),
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setInviteLink(response.data.invite_link);
        // Remember what was minted so the copy row can say how many people may use it.
        setInviteLinkUses(response.data.max_uses ?? 1);
        toast.success(t("teamDetail.inviteLinkGenerated"));
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || t("teamDetail.inviteLinkGenerateFailed"),
        );
      }
    });
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success(t("teamDetail.inviteLinkCopied"));
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
          error.response?.data?.message || t("teamDetail.approveFailed"),
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
        toast.error(error.response?.data?.message || t("teamDetail.denyFailed"));
      }
    });
  };
  const handleAddNewMember = () => {
    if (!newMemberSearch)
      return toast.error(t("teamDetail.enterUidIgnEmail"));
    // Guard the TOTAL headcount (owner 2026-08-04, item 33). Two bugs here: the number was 6,
    // the PLAYER cap rather than the team size, so the form refused seats a team legitimately
    // has; and the toast was not returned, so the invite was sent anyway and the warning was
    // pure noise. Player-slot pressure is handled by the role picker below, not by blocking.
    if (teamDetails.members.length >= MAX_TEAM_MEMBERS) {
      return toast.error(t("teamDetail.teamFullToast"));
    }

    startInviteTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/invite-member/`,
          {
            team_id: teamDetails.team_id,
            invitee_email_or_ign: newMemberSearch,
            // The seat the invitee takes on acceptance. Sending it is what lets a captain fill
            // places 7 to 9 with staff while all 6 player slots are occupied, instead of having
            // to demote somebody already on the roster first (the "caps at 7" bug).
            role: newMemberRole,
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
          toast.error(t("errors.generic"));
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
          response.data.message || t("teamDetail.leftTeamSuccess"),
        );
        router.push("/teams");
      } catch (error: any) {
        toast.error(error?.response?.data?.message || t("teamDetail.exitTeamFailed"));
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

        // axios rejects any non-2xx, so reaching here means success. Do NOT gate on
        // response.statusText === "OK": statusText is EMPTY over HTTP/2 (prod is behind a
        // proxy that speaks h2), so that check silently failed the success path even though
        // the backend had already transferred ownership - the user saw "nothing happens".
        // (Same bug class fixed in AuthContext.fetchUser this session.)
        toast.success(response.data.message || t("teamDetail.transferSuccess"));
        router.push("/teams");
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || t("teamDetail.transferFailed"),
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
    // Live refresh (owner 2026-07-02): tick re-runs this read-only fetch; background
    // refreshes (tick > 0) skip the Requests-tab loading state + error toast.
    if (tick === 0) setLoadingApplications(true);
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-applications/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setPlayerMarketApplications(res.data))
      .catch(() => {
        if (tick === 0) toast.error(t("teamDetail.loadApplicationsFailed"));
      })
      .finally(() => setLoadingApplications(false));
  }, [hasFullAccess, token, tick]);

  const appStats = useMemo(() => ({
    total: playerMarketApplications.length,
    pending: playerMarketApplications.filter((a) => a.status === "PENDING").length,
    shortlisted: playerMarketApplications.filter((a) => a.status === "SHORTLISTED").length,
    invited: playerMarketApplications.filter(
      (a) => a.status === "INVITED" || a.status === "TRIAL_EXTENDED",
    ).length,
  }), [playerMarketApplications]);

  // Live refresh (owner 2026-07-02): only show the full-page loader while there is no data
  // yet. A background transition (live tick / silent refreshTeamDetails) keeps the page
  // mounted, so the active tab, pagination, and scroll position all survive the refetch.
  if (pending && !teamDetails) return <FullLoader />;

  // Letter avatars (read-only) for the Overview tab. The backend LIVE-DERIVES the team's available
  // letters (member union ∪ manual extras) in get-team-details. We split member-derived letters
  // (primary chips) from manager-added manual extras (gold chips) using member_letters. Managers
  // edit these on the team-edit page (app/(user)/teams/[id]/edit).
  const teamMemberLetters: string[] = teamDetails?.member_letters ?? [];
  const teamMemberLetterSet = new Set(teamMemberLetters);
  const teamAvailableLetters: string[] = teamDetails?.available_letters ?? [];

  if (teamDetails)
    return (
      <div>
        <PageHeader back title={teamDetails?.team_name} />

        {/* Team report dialog (controlled). Opened by the Report button in the header. */}
        <ReportDialog
          subjectType="team"
          subjectName={teamDetails?.team_name ?? ""}
          subjectId={teamDetails?.team_id}
          open={reportOpen}
          onOpenChange={setReportOpen}
        />
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
                  <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                    <CountryFlag country={teamDetails?.country} />
                    {t("teamDetail.country", { country: teamDetails?.country })}
                  </p>
                  {teamDetails?.is_banned && (
                    <Badge variant="destructive" className="mt-2">
                      {t("teamDetail.banned")}
                    </Badge>
                  )}
                  {/* Public fan/hater reactions for this team (owner 2026-06-20). */}
                  <FanHater
                    subjectType="team"
                    targetId={teamDetails?.team_id}
                    className="mt-3"
                  />
                </div>
              </div>
              <div className="space-x-2 w-full md:w-auto">
                {/* Report this team (owner 2026-06-20): shown to LOGGED-IN viewers who do
                    not run the team (no full access). Opens the generic ReportDialog with
                    subjectType="team" -> POST /auth/report-team/. */}
                {!!token && !hasFullAccess && (
                  <Button
                    variant="outline"
                    className="w-full md:w-auto text-red-500 border-red-500/40 hover:bg-red-500/10 hover:text-red-500"
                    onClick={() => setReportOpen(true)}
                  >
                    <Flag className="h-4 w-4" />
                    {tReport("report.triggerTeam")}
                  </Button>
                )}
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
                        <Loader text={t("teamDetail.sending")} />
                      ) : (
                        <>
                          <UserPlus />
                          {t("teamDetail.requestToJoin")}
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
                        <Loader text={t("teamDetail.sending")} />
                      ) : (
                        <>
                          <UserPlus />
                          {t("teamDetail.joinNow")}
                        </>
                      )}
                    </Button>
                  )}
                {/* Edit Team: owner-only */}
                {hasFullAccess && !teamDetails?.is_banned && (
                  <Button variant={"secondary"} asChild>
                    <Link href={`/teams/${teamDetails?.team_name}/edit`}>
                      <Edit />
                      {t("teamDetail.editTeam")}
                    </Link>
                  </Button>
                )}
                {/* Manage Roster: owner or coach */}
                {canManageRoster && !teamDetails?.is_banned && (
                  <Button asChild>
                    <Link href={`/teams/${teamDetails?.team_name}/roster`}>
                      <Users />
                      {t("teamDetail.manageRoster")}
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
                        {t("teamDetail.exitTeam")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("teamDetail.exitTeam")}</DialogTitle>
                        <DialogDescription>
                          {t("teamDetail.exitTeamConfirm", { team: teamDetails?.team_name })}
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">{t("teamDetail.cancel")}</Button>
                        </DialogClose>
                        <Button
                          variant="destructive"
                          onClick={() => requireAuth(handleExitTeam)}
                          disabled={pendingExit}
                        >
                          {pendingExit ? (
                            <Loader text={t("teamDetail.leaving")} />
                          ) : (
                            t("teamDetail.yesExitTeam")
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
                <AlertTitle>{t("teamDetail.bannedTitle")}</AlertTitle>
                <AlertDescription>
                  {t("teamDetail.bannedReason", { reason: teamDetails?.ban_reason })}
                  <br />
                  {t("teamDetail.bannedRestrictions")}
                </AlertDescription>
              </Alert>
            )}

            {/* ── Event invitations (owner backlog item 34) ─────────────────────────────
                An organizer can now ASK a team into an event instead of force-adding it, and
                somebody has to answer. It sits ABOVE the tabs on purpose: an unanswered
                invitation is time-sensitive, so it must not be buried in a tab nobody opens.
                The component renders NOTHING when the team has no invitations, so an uninvited
                team's page is unchanged. It is also where the invitation notification's "Take me
                there" lands (the backend sets target_type "team" -> /teams/<id>).
                Members are passed down from the already-fetched teamDetails so the accept
                dialog's roster picker costs no extra request. */}
            <EventInvitationsCard
              teamId={teamDetails?.team_id}
              members={teamDetails?.members}
              teamName={teamDetails?.team_name}
            />

            <Tabs defaultValue="overview">
              <ScrollableTabsList className="w-full">
                  <TabsTrigger value="overview">{t("teamDetail.tabOverview")}</TabsTrigger>
                  <TabsTrigger value="members">{t("teamDetail.tabMembers")}</TabsTrigger>
                  {/* Statistics tab is hidden entirely from outsiders: it only renders
                      when the backend says this viewer may see the detailed stats
                      (team member, owner, or AFC admin). stats_visible comes from
                      get-team-details, which the page fetches WITH the viewer's token. */}
                  {teamDetails?.stats_visible && (
                    <TabsTrigger value="statistics">{t("teamDetail.tabStatistics")}</TabsTrigger>
                  )}
                  <TabsTrigger value="achievements">{t("teamDetail.tabAchievements")}</TabsTrigger>
                  <TabsTrigger value="social">{t("teamDetail.tabSocial")}</TabsTrigger>
                  {hasFullAccess && (
                    <TabsTrigger value="requests">{t("teamDetail.tabRequests")}</TabsTrigger>
                  )}
              </ScrollableTabsList>

              <TabsContent value="overview">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("teamDetail.teamOverview")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">{t("teamDetail.countryLabel")}</p>
                        <p className="text-lg md:text-xl font-semibold flex items-center gap-2">
                          <CountryFlag country={teamDetails?.country} />
                          {teamDetails?.country}
                        </p>
                        {/* F2 (owner 2026-06-20): explain the auto-country rule on the user-facing side. */}
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("teamDetail.countryAutoExplain")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t("teamDetail.totalKills")}
                        </p>
                        <p className="text-lg md:text-xl font-semibold">
                          {teamDetails?.stats?.total_kills
                            ? teamDetails?.stats?.total_kills
                            : 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t("teamDetail.totalWins")}
                        </p>
                        {/* Total Wins = tournament wins + scrim wins. Previously used `&&` which
                            rendered 0 unless BOTH were non-zero (a team with only tournament wins showed
                            0). Sum with `|| 0` so each side contributes independently (owner 2026-07-14
                            fix, alongside the backend now returning the `stats` object at all). */}
                        <p className="text-lg md:text-xl font-semibold">
                          {(teamDetails?.stats?.tournament_wins || 0) +
                            (teamDetails?.stats?.scrim_wins || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("teamDetail.tierLabel")}</p>
                        <p className="text-lg md:text-xl font-semibold">
                          {teamDetails?.team_tier}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t("teamDetail.tournamentsPlayed")}
                        </p>
                        <p className="text-lg md:text-xl font-semibold">
                          {teamDetails?.stats?.tournaments_played
                            ? teamDetails?.stats?.tournaments_played
                            : 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t("teamDetail.scrimsPlayed")}
                        </p>
                        <p className="text-lg md:text-xl font-semibold">
                          {teamDetails?.stats?.scrims_played
                            ? teamDetails?.stats?.scrims_played
                            : 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t("teamDetail.creationDate")}
                        </p>
                        <p className="text-lg md:text-xl font-semibold">
                          {/* Team creation date in the viewer's timezone + language. */}
                          <LocalTime value={teamDetails?.creation_date} mode="date" />
                        </p>
                      </div>
                    </div>

                    {/* Letter avatars (read-only). The team's available Free Fire letter avatars,
                        LIVE-DERIVED by the backend (member union ∪ manual extras) and returned by
                        get-team-details. Member-covered letters render as primary chips; manager-added
                        extras render as gold chips. Managers edit these on the team-edit page. */}
                    <div className="mt-6 border-t pt-4">
                      <p className="text-sm text-muted-foreground">
                        {tTeam("letterAvatars.availableTitle")}
                      </p>
                      {teamAvailableLetters.length === 0 ? (
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          {tTeam("letterAvatars.none")}
                        </p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {teamAvailableLetters.map((letter: string) => (
                            <Badge
                              key={letter}
                              variant="outline"
                              className={
                                teamMemberLetterSet.has(letter)
                                  ? "rounded-full text-xs border-primary text-primary"
                                  : "rounded-full text-xs border-gold text-gold"
                              }
                            >
                              {letter}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* ── Registered Events (PUBLIC) ──────────────────────────────────
                    The upcoming/ongoing events this team is CURRENTLY registered for.
                    Data: teamDetails.registered_events from get-team-details
                    (afc_team.views.get_team_details), returned for EVERY viewer (it is
                    NOT behind the stats_visible gate, since a registration schedule is
                    public). Each row links to the public tournament page
                    (/tournaments/<event_slug>, the slug-based route used across the site)
                    and renders its date in the viewer's timezone via LocalTime. Empty ->
                    a muted line. Mirrors the player profile's "Registered Events" section. */}
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>{t("teamDetail.registeredEventsTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(teamDetails?.registered_events?.length ?? 0) === 0 ? (
                      <p className="text-sm italic text-muted-foreground">
                        {t("teamDetail.noRegisteredEvents")}
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("teamDetail.event")}</TableHead>
                            <TableHead>{t("teamDetail.date")}</TableHead>
                            <TableHead>{t("teamDetail.status")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamDetails.registered_events.map((ev: any) => (
                            <TableRow key={ev.event_id}>
                              <TableCell className="font-medium">
                                {/* Slug-based deep link to the public event page; plain text when
                                    an event has no slug yet (so the row never links to a 404). */}
                                {ev.event_slug ? (
                                  <Link
                                    href={`/tournaments/${ev.event_slug}`}
                                    className="text-primary hover:underline"
                                  >
                                    {ev.event_name}
                                  </Link>
                                ) : (
                                  ev.event_name
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {ev.event_date ? (
                                  <LocalTime value={ev.event_date} mode="date" />
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="rounded-full text-xs">
                                  {ev.event_status === "ongoing"
                                    ? t("teamDetail.eventStatusOngoing")
                                    : t("teamDetail.eventStatusUpcoming")}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
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
                    <CardTitle>{t("teamDetail.teamMembers")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="truncate">{t("teamDetail.name")}</TableHead>
                          <TableHead className="truncate">
                            {t("teamDetail.inGameRole")}
                          </TableHead>
                          <TableHead className="truncate">
                            {t("teamDetail.managementRole")}
                          </TableHead>
                          <TableHead className="truncate">{t("teamDetail.action")}</TableHead>
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
                                {/* Member name links to the public player profile; the flag is the
                                    member's own country (these locations derive the team country). */}
                                <span className="inline-flex items-center gap-1.5">
                                  {/* Esport image thumbnail (owner 2026-07-02): the backend returns
                                      member.esport_image ONLY to this team's members and AFC
                                      admins (get_team_details gate) - other viewers get null, so
                                      nothing renders for them. Click-to-open full size. */}
                                  {member.esport_image ? (
                                    <a
                                      href={member.esport_image}
                                      target="_blank"
                                      rel="noreferrer"
                                      title={t("teamDetail.esportImage")}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={member.esport_image}
                                        alt=""
                                        className="size-7 rounded-md border object-cover"
                                      />
                                    </a>
                                  ) : null}
                                  <CountryFlag country={member.country} />
                                  <PlayerLink name={member.username} />
                                </span>
                              </TableCell>
                              <TableCell>
                                {formatWord(member.in_game_role) || (
                                  <span className="italic">{t("teamDetail.notSelected")}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {/* Translated role label, not formatWord: the stored value
                                    'member' must read as "Player" (owner 2026-08-04, item 33). */}
                                {roleLabel(member.management_role)}
                              </TableCell>
                              <TableCell>
                                <Button size="sm" variant="outline" asChild>
                                  <Link href={`/players/${member.username}`}>
                                    {t("teamDetail.view")}
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                      {teamDetails?.members === undefined && (
                        <p className="italic text-sm text-center py-4 w-full">
                          {t("teamDetail.noMembersYet")}
                        </p>
                      )}
                    </Table>
                    {Math.ceil(
                      (teamDetails?.members?.length ?? 0) / ITEMS_PER_PAGE,
                    ) > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <p className="hidden md:block text-sm text-muted-foreground">
                          {t("teamDetail.showing", {
                            start: (membersPage - 1) * ITEMS_PER_PAGE + 1,
                            end: Math.min(membersPage * ITEMS_PER_PAGE, teamDetails?.members?.length ?? 0),
                            total: teamDetails?.members?.length ?? 0,
                          })}
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
                      MAX_TEAM_MEMBERS (9) people in total - the extra seats are for staff
                      (one coach / one manager / one analyst), who never take a player slot.
                      The invite form used to vanish silently at 6 members, which both hid the
                      staff path and gave no explanation. It now stays open until the team is
                      genuinely full, spells the rule out, and shows a "team full" note after.

                      The ROLE PICKER beside the search box is what makes seats 7 to 9 reachable
                      (owner 2026-08-04, item 33). Previously this form sent no role at all, so
                      every invitee arrived as a PLAYER and was bounced by the 6-player cap once
                      the team was at strength; the captain's only way forward was to demote
                      somebody already on the roster. Picking "Coach" / "Manager" / "Analyst"
                      here seats them without touching anyone else's role.
                    */}
                    {hasFullAccess &&
                      (teamDetails?.members?.length ?? 0) < MAX_TEAM_MEMBERS && (
                        <div className="mt-4">
                          <h4 className="text-lg font-semibold mb-2">
                            {t("teamDetail.addNewMember")}
                          </h4>
                          <p className="text-xs text-muted-foreground mb-2">
                            {/* t.rich keeps "6 players" emphasized inside the roster rule note. */}
                            {t.rich("teamDetail.rosterRuleNote", {
                              players: () => (
                                <span className="font-medium text-foreground">
                                  {t("teamDetail.rosterRulePlayers")}
                                </span>
                              ),
                            })}
                          </p>
                          {/* Stacks on mobile so the picker and the search box each keep a usable
                              tap target; side by side from sm up. */}
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                            {/* Search-as-you-type user picker (replaces the raw email input).
                                Yields the selected player's username into newMemberSearch, which
                                handleAddNewMember posts as invitee_email_or_ign. */}
                            <div className="flex-1">
                              <UserSearchSelect
                                value={newMemberSearch || null}
                                onChange={(u) => setNewMemberSearch(u ?? "")}
                                placeholder={t("teamDetail.searchPlayerInvite")}
                              />
                            </div>
                            {/* Seat picker -> posted as `role` to /team/invite-member/. */}
                            <Select
                              value={newMemberRole}
                              onValueChange={(v) =>
                                setNewMemberRole(v as (typeof INVITABLE_ROLES)[number])
                              }
                            >
                              <SelectTrigger
                                className="sm:w-44"
                                aria-label={t("teamDetail.inviteAs")}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {INVITABLE_ROLES.map((role) => (
                                  <SelectItem
                                    key={role}
                                    value={role}
                                    // The PLAYING option is unselectable once all 6 player slots
                                    // are taken, mirroring the backend cap, so the captain is
                                    // steered to a staff seat instead of hitting a 400.
                                    disabled={playerSlotsFull && PLAYER_ROLES.includes(role)}
                                  >
                                    {roleLabel(role)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              onClick={() => requireAuth(handleAddNewMember)}
                            >
                              {pendingInvite ? (
                                <Loader text=" " />
                              ) : (
                                <>
                                  <IconSearch />
                                  {t("teamDetail.invite")}
                                </>
                              )}
                            </Button>
                          </div>
                          {/* Explains WHY the player option went grey, rather than leaving a
                              silently disabled item. */}
                          {playerSlotsFull && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {t("teamDetail.playersFullHint")}
                            </p>
                          )}
                        </div>
                      )}
                    {hasFullAccess &&
                      (teamDetails?.members?.length ?? 0) >= MAX_TEAM_MEMBERS && (
                        <div className="mt-4 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                          {t("teamDetail.teamFull")}
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
                    <CardTitle>{t("teamDetail.socialMedia")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Social links as a responsive card grid (owner 2026-07-14 UI pass): each link is
                        a bordered card with the platform's icon in a colored chip, its name, and the
                        handle/URL, opening in a new tab. Replaces the old bare text row. Falls back to
                        a friendly empty state when the team has no links. */}
                    {!teamDetails?.social_media_links ||
                    teamDetails.social_media_links.length === 0 ? (
                      <div className="rounded-md border-2 border-dashed border-border py-14 text-center text-sm italic text-muted-foreground">
                        {t("teamDetail.noLinkFound")}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {teamDetails.social_media_links.map(
                          (link: any, index: number) => {
                            const p = String(link.platform || "").toLowerCase();
                            // Icon per platform; LinkIcon is the fallback for any other platform.
                            const Icon =
                              p === "facebook"
                                ? Facebook
                                : p === "twitter" || p === "x"
                                  ? Twitter
                                  : p === "instagram"
                                    ? Instagram
                                    : p === "youtube"
                                      ? Youtube
                                      : p === "twitch"
                                        ? Twitch
                                        : LinkIcon;
                            // Brand-tinted chip; generic primary tint for unknown platforms.
                            const accent =
                              p === "facebook"
                                ? "bg-[#1877F2]/15 text-[#1877F2]"
                                : p === "twitter" || p === "x"
                                  ? "bg-sky-500/15 text-sky-400"
                                  : p === "instagram"
                                    ? "bg-pink-500/15 text-pink-400"
                                    : p === "youtube"
                                      ? "bg-red-500/15 text-red-400"
                                      : p === "twitch"
                                        ? "bg-purple-500/15 text-purple-400"
                                        : "bg-primary/15 text-primary";
                            // Show a clean handle: strip scheme + trailing slash from the URL.
                            const handle = String(link.link || "")
                              .replace(/^https?:\/\/(www\.)?/i, "")
                              .replace(/\/+$/, "");
                            return (
                              <Link
                                key={index}
                                href={link.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center gap-3 rounded-md border bg-card p-3 shadow-sm transition-colors hover:border-primary/50 hover:bg-muted/40"
                              >
                                <span
                                  className={`flex size-10 shrink-0 items-center justify-center rounded-full ${accent}`}
                                >
                                  <Icon className="size-5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-semibold capitalize">
                                    {p === "x" ? "X" : link.platform}
                                  </span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {handle}
                                  </span>
                                </span>
                                <IconExternalLink className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                              </Link>
                            );
                          },
                        )}
                      </div>
                    )}
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
                              {t("teamDetail.playerMarketApplications")}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              {t("teamDetail.applicationsFromPosts")}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" className="shrink-0" asChild>
                            <Link href={`/teams/${teamDetails?.team_name}/applications`}>
                              <IconExternalLink className="h-4 w-4 mr-1.5" />
                              {t("teamDetail.viewAllApplications")}
                            </Link>
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {loadingApplications ? (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            {t("teamDetail.loading")}
                          </div>
                        ) : playerMarketApplications.length === 0 ? (
                          <NothingFound text={t("teamDetail.noApplicationsReceived")} />
                        ) : (
                          <>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>{t("teamDetail.player")}</TableHead>
                                  <TableHead>{t("teamDetail.applied")}</TableHead>
                                  <TableHead>{t("teamDetail.status")}</TableHead>
                                  <TableHead>{t("teamDetail.contact")}</TableHead>
                                  <TableHead>{t("teamDetail.action")}</TableHead>
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
                                      {/* Application date in the viewer's timezone + language. */}
                                      <LocalTime value={app.applied_at} mode="date" />
                                    </TableCell>
                                    <TableCell>
                                      {getStatusBadge(app.status)}
                                    </TableCell>
                                    <TableCell>
                                      {app.contact_unlocked ? (
                                        <Badge variant="outline" className="text-green-400 border-green-800 text-xs">
                                          {t("teamDetail.unlocked")}
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-muted-foreground text-xs">
                                          {t("teamDetail.locked")}
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setReviewApp(app)}
                                      >
                                        {t("teamDetail.review")}
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
                                <p className="text-xs text-muted-foreground">{t("teamDetail.total")}</p>
                              </div>
                              <div>
                                <p className="text-xl font-bold text-yellow-400">{appStats.pending}</p>
                                <p className="text-xs text-muted-foreground">{t("teamDetail.pending")}</p>
                              </div>
                              <div>
                                <p className="text-xl font-bold text-cyan-400">{appStats.shortlisted}</p>
                                <p className="text-xs text-muted-foreground">{t("teamDetail.shortlisted")}</p>
                              </div>
                              <div>
                                <p className="text-xl font-bold text-green-400">{appStats.invited}</p>
                                <p className="text-xs text-muted-foreground">{t("teamDetail.invited")}</p>
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
                        <CardTitle className="text-base">{t("teamDetail.directJoinRequests")}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {t("teamDetail.directJoinRequestsDescription")}
                        </p>
                      </CardHeader>
                      <CardContent>
                      {joinRequests?.length === 0 ? (
                        <NothingFound text={t("teamDetail.noPendingJoinRequests")} />
                      ) : (
                        <>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="truncate">{t("teamDetail.name")}</TableHead>
                                <TableHead className="truncate">{t("teamDetail.uid")}</TableHead>
                                <TableHead className="truncate">
                                  {t("teamDetail.actions")}
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
                                            t("teamDetail.approve")
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
                                            t("teamDetail.deny")
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
                                            {t("teamDetail.viewProfile")}
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
                                {t("teamDetail.showing", {
                                  start: (joinRequestsPage - 1) * ITEMS_PER_PAGE + 1,
                                  end: Math.min(joinRequestsPage * ITEMS_PER_PAGE, joinRequests?.length ?? 0),
                                  total: joinRequests?.length ?? 0,
                                })}
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
                  <CardTitle>{t("teamDetail.teamOwnerControls")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button
                      onClick={() => requireAuth(() => { setInviteRole(""); setRolePickerOpen(true); })}
                      className="w-full"
                      disabled={pendingGenerateLink}
                    >
                      {pendingGenerateLink ? (
                        <Loader text={t("teamDetail.generating")} />
                      ) : (
                        t("teamDetail.generateInviteLink")
                      )}
                    </Button>
                    {inviteLink && (
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Input value={inviteLink} readOnly />
                          <Button size="icon-lg" onClick={handleCopyInviteLink}>
                            <IconCopy />
                          </Button>
                        </div>
                        {/* Say what was minted. A captain who picked "4 people" needs to know
                            this is the ONE link to share, not the first of four. */}
                        <p className="text-xs text-muted-foreground">
                          {inviteLinkUses > 1
                            ? t("teamDetail.inviteLinkSharedNote", { count: inviteLinkUses })
                            : t("teamDetail.inviteLinkSingleNote")}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="destructive" className="flex-1">
                            {t("teamDetail.disbandTeam")}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t("teamDetail.disbandTeam")}</DialogTitle>
                            <DialogDescription>
                              {t("teamDetail.disbandConfirm")}
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => {}}>
                              {t("teamDetail.cancel")}
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => requireAuth(handleDisbandTeam)}
                              disabled={pendingDisbanded}
                            >
                              {pendingDisbanded ? (
                                <Loader text={t("teamDetail.disbanding")} />
                              ) : (
                                t("teamDetail.disband")
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button className="flex-1" variant={"secondary"}>
                            {t("teamDetail.transferOwnership")}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t("teamDetail.transferOwnershipTitle")}</DialogTitle>
                            <DialogDescription>
                              {t("teamDetail.transferOwnershipDescription")}
                            </DialogDescription>
                          </DialogHeader>
                          <Form {...form}>
                            <form
                              // form.handleSubmit(...) MUST be the onSubmit handler itself:
                              // it calls e.preventDefault() + runs validation, then invokes
                              // the callback with the validated data. The previous wiring
                              // `() => requireAuth(form.handleSubmit(onSubmit))` swallowed the
                              // submit event (no preventDefault) so the browser did a NATIVE
                              // form submit = full page reload, and the transfer never ran -
                              // exactly the "it just loads and nothing happens" report. We
                              // still gate on auth, just INSIDE the validated callback.
                              onSubmit={form.handleSubmit((data) =>
                                requireAuth(() => onSubmit(data)),
                              )}
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
                                          <SelectValue placeholder={t("teamDetail.selectNewOwner")} />
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
                                    {t("teamDetail.cancel")}
                                  </Button>
                                </DialogClose>
                                <Button
                                  type="submit"
                                  disabled={pendingTransfer}
                                >
                                  {pendingTransfer ? (
                                    <Loader text={t("teamDetail.transferring")} />
                                  ) : (
                                    t("teamDetail.transfer")
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
                  <CardTitle>{t("teamDetail.adminControls")}</CardTitle>
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
            <DialogTitle>{t("teamDetail.generateInviteLink")}</DialogTitle>
            <DialogDescription>
              {t("teamDetail.generateInviteLinkDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-2">
            {INVITABLE_ROLES.map((role) => (
              <Button
                key={role}
                variant={inviteRole === role ? "default" : "outline"}
                onClick={() => setInviteRole(role)}
                // Same rule as the invite form: a link into a PLAYING seat is pointless once
                // all 6 are taken, so it is offered only while a slot is free.
                disabled={playerSlotsFull && PLAYER_ROLES.includes(role)}
              >
                {/* Was the raw stored value with a `capitalize` class, which rendered "Member".
                    The shared catalog gives the real label ("Player"). */}
                {roleLabel(role)}
              </Button>
            ))}
          </div>

          {/* ── How many people this one link may seat (owner 2026-08-05) ──────────────────
              "a way for teams to generate links that multiple team members can use to join the
              team and not just separate links option." Defaults to 1, which sends no max_uses
              and mints exactly the single-use link this dialog produced before, so a captain who
              ignores this control sees no change at all.
              The ceiling is how many free seats the team actually has: offering "6 uses" to a
              team with two seats left would mint a link that stops working part way through and
              look like a bug to whoever it was shared with. */}
          <div className="space-y-2 border-t pt-3">
            {/* NEW tag beside the control's own label, not the dialog title: the dialog is
                old, this seats picker is the 2026-08-05 addition, and a captain who has used
                this dialog before would otherwise not notice it appear. Expires by itself
                5 days on (components/NewBadge.tsx). */}
            <Label htmlFor="invite-uses" className="flex flex-wrap items-center gap-2">
              {t("teamDetail.inviteUsesLabel")}
              <NewBadge since="2026-08-05" />
            </Label>
            <Select
              value={String(inviteMaxUses)}
              onValueChange={(v) => setInviteMaxUses(Number(v))}
            >
              <SelectTrigger id="invite-uses">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: Math.max(1, freeSeats) }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n === 1
                      ? t("teamDetail.inviteUsesOne")
                      : t("teamDetail.inviteUsesMany", { count: n })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {inviteMaxUses > 1
                ? t("teamDetail.inviteUsesHintShared", { count: inviteMaxUses })
                : t("teamDetail.inviteUsesHintSingle")}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRolePickerOpen(false)}>
              {t("teamDetail.cancel")}
            </Button>
            <Button
              disabled={!inviteRole}
              onClick={() => handleGenerateInviteLink(inviteRole)}
            >
              {t("teamDetail.generate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    );
};

export default Page;
