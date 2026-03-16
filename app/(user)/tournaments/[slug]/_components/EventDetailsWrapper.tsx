"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  use,
  useRef,
  useTransition,
} from "react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle,
  Users,
  AlertTriangle,
  User,
  Trophy,
  XCircle,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/PageHeader";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate, formatMoneyInput } from "@/lib/utils";
import { toast } from "sonner";
import { FullLoader, Loader } from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/components/AuthModal";
import { AFC_DISCORD_SERVER, DEFAULT_IMAGE } from "@/constants";
import axios from "axios";
import Image from "next/image";
import { IconRefresh, IconUsers, IconUsersGroup } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ModalStep =
  | "CLOSED"
  | "INFO"
  | "TYPE"
  | "RULES"
  | "SPONSOR"
  | "DISCORD_LINK"
  | "DISCORD_JOIN"
  | "DISCORD_STATUS"
  | "SUCCESS";
type RegistrationType = "solo" | "team";
type TeamModalStep = "CLOSED" | "SELECT_MEMBERS" | "TEAM_INFO";

interface StageGroup {
  group_id: number;
  group_name: string;
  playing_date: string;
  playing_time: string;
  teams_qualifying: number;
  overall_leaderboard?: any[];
  matches?: any[];
}

interface Stage {
  stage_id: number;
  stage_name: string;
  start_date: string;
  end_date: string;
  stage_format: string;
  teams_qualifying_from_stage: number;
  groups: StageGroup[];
}

interface EventDetails {
  event_id: number;
  competition_type: string;
  participant_type: string;
  registered_competitors: any[];
  event_type: string;
  max_teams_or_players: number;
  event_name: string;
  event_mode: string;
  start_date: string;
  end_date: string;
  registration_open_date: string;
  registration_end_date: string;
  prizepool: string;
  prize_distribution: { [key: string]: number };
  event_rules: string;
  tournament_teams: {
    team_name: string;
    team_id: number;
    status: string;
  }[];
  event_status: string;
  registration_link: string;
  tournament_tier: string;
  stream_channels: string[];
  stages: Stage[];
  event_banner_url: string | null;
  uploaded_rules_url: string | null;
  is_registered: boolean;
  is_public: boolean;
  is_sponsored?: boolean;
  sponsor_name?: string;
  sponsor_field_label?: string;
  sponsor_requirement_description?: string | null;
}

interface ApiResponse {
  event_details: EventDetails;
}

interface TeamMember {
  id: string;
  username: string;
  is_verified: boolean;
  discord_connected: boolean;
  discord_id: string | null; // ✅ FIX: Change from boolean to string | null
  discord_username?: string;
}

interface UserTeam {
  team_id: string;
  team_name: string;
  members: TeamMember[];
  min_players?: number;
  max_players?: number;
  team_owner: string;
  is_banned?: boolean;
}

interface DiscordValidationResult {
  user_id: number;
  username: string;
  is_active: boolean;
  discord_connected: boolean;
  discord_id: string | null;
  in_discord_server: boolean;
  membership_error: string | null;
  ok: boolean;
  reasons: string[];
}

interface DiscordValidationResponse {
  event_id: number;
  team_id: number;
  participant_type: string;
  roster_size: number;
  all_ok: boolean;
  results: DiscordValidationResult[];
}

interface RosterMember {
  user_id: number;
  username: string;
  full_name: string;
  user_id_from_sponsor: string;
  status: string;
}

interface LeaveEventModalProps {
  eventId: number;
  eventName: string;
  onSuccess: () => void;
}

const LeaveEventModal: React.FC<LeaveEventModalProps> = ({
  eventId,
  eventName,
  onSuccess,
}) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { token } = useAuth();

  const handleLeave = () => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/leave-event/`,
          { event_id: eventId },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        toast.success(res.data.message || "Successfully left the tournament");
        setOpen(false);
        onSuccess();
      } catch (e: any) {
        toast.error(e.response?.data?.message || "Failed to leave tournament");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="w-full md:w-auto">
          Leave Tournament
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] max-h-[85vh] overflow-y-auto">
        <div className="text-center">
          <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <DialogTitle className="text-xl">Leave Tournament?</DialogTitle>
          <DialogDescription className="mt-2 text-base">
            Are you sure you want to leave <b>"{eventName}"</b>?
          </DialogDescription>
          <p className="text-sm text-muted-foreground mt-4">
            You can re-register later if registration is still open and you
            change your mind.
          </p>
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleLeave}
              disabled={pending}
            >
              {pending ? <Loader text="Leaving..." /> : "Leave Tournament"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface EditRosterModalProps {
  eventDetails: EventDetails;
  userTeam: UserTeam | null;
  token: string | null;
  onSuccess: () => void;
}

const EditRosterModal: React.FC<EditRosterModalProps> = ({
  eventDetails,
  userTeam,
  token,
  onSuccess,
}) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"SELECT_MEMBERS" | "SPONSOR_IDS">(
    "SELECT_MEMBERS",
  );
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [sponsorIds, setSponsorIds] = useState<Record<string, string>>({});
  const [currentRoster, setCurrentRoster] = useState<RosterMember[]>([]);
  const [teamId, setTeamId] = useState<number | null>(null);

  const minPlayers = userTeam?.min_players || 4;
  const maxPlayers = userTeam?.max_players || 6;

  const handleOpen = async () => {
    setIsLoadingRoster(true);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-roster-details/`,
        { event_id: eventDetails.event_id },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const data = res.data;
      setCurrentRoster(data.roster || []);
      setTeamId(data.team_id);

      // Build a lookup from username → roster member
      const rosterByUsername = new Map<string, RosterMember>();
      (data.roster || []).forEach((r: RosterMember) => {
        rosterByUsername.set(r.username, r);
      });

      // Pre-select team members whose username appears in the current roster.
      // We use team member's id (not user_id) because that's what the checkboxes compare against.
      const currentIds = (userTeam?.members || [])
        .filter((m) => rosterByUsername.has(m.username))
        .map((m) => m.id);
      setSelectedMemberIds(currentIds);

      // Pre-populate sponsor IDs keyed by team member id (matches what SPONSOR_IDS step uses)
      const sponsorMap: Record<string, string> = {};
      (userTeam?.members || []).forEach((m) => {
        const rosterMember = rosterByUsername.get(m.username);
        if (rosterMember?.user_id_from_sponsor) {
          sponsorMap[m.id] = rosterMember.user_id_from_sponsor;
        }
      });
      setSponsorIds(sponsorMap);

      setStep("SELECT_MEMBERS");
      setOpen(true);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to load roster details",
      );
    } finally {
      setIsLoadingRoster(false);
    }
  };

  const handleMemberToggle = (memberId: string) => {
    // @ts-ignore
    setSelectedMemberIds((prev) => {
      if (prev.includes(memberId)) {
        return prev.filter((id: string) => id !== memberId);
      } else {
        if (prev.length >= maxPlayers) {
          toast.error(`You can only select up to ${maxPlayers} members`);
          return prev;
        }
        return [...prev, memberId];
      }
    });
  };

  const handleContinue = () => {
    if (selectedMemberIds.length < minPlayers) {
      toast.error(`Please select at least ${minPlayers} team members`);
      return;
    }
    if (eventDetails.is_sponsored) {
      setStep("SPONSOR_IDS");
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const rosterMemberIds = selectedMemberIds.map((id) => parseInt(id));

      const payload: any = {
        event_id: eventDetails.event_id,
        team_id: teamId,
        roster_member_ids: rosterMemberIds,
      };

      if (eventDetails.is_sponsored) {
        const filteredSponsorIds: Record<string, string> = {};
        rosterMemberIds.forEach((uid) => {
          filteredSponsorIds[uid.toString()] = sponsorIds[uid.toString()] || "";
        });
        payload.sponsor_ids = filteredSponsorIds;
      }

      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-roster/`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      toast.success(res.data.message || "Registration updated successfully!");
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to update registration",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMembersData = useMemo(() => {
    return (
      userTeam?.members.filter((m) => selectedMemberIds.includes(m.id)) || []
    );
  }, [userTeam, selectedMemberIds]);

  const editSeenValues = new Set<string>();
  const editDuplicateMemberIds = new Set<string>();
  selectedMembersData.forEach((m) => {
    const val = (sponsorIds[m.id] || "").trim();
    if (val !== "") {
      if (editSeenValues.has(val)) {
        selectedMembersData.forEach((other) => {
          if ((sponsorIds[other.id] || "").trim() === val) {
            editDuplicateMemberIds.add(other.id);
          }
        });
      } else {
        editSeenValues.add(val);
      }
    }
  });
  const editHasDuplicates = editDuplicateMemberIds.size > 0;

  const canSubmitSponsor =
    selectedMembersData.every((m) => (sponsorIds[m.id] || "").trim() !== "") &&
    !editHasDuplicates;

  return (
    <>
      <Button
        variant="outline"
        className="w-full md:w-auto"
        onClick={handleOpen}
        disabled={isLoadingRoster}
      >
        {isLoadingRoster ? <Loader text="Loading..." /> : "Edit Registration"}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="flex flex-col max-h-[85vh]">
          {step === "SELECT_MEMBERS" && (
            <>
              <DialogHeader>
                <DialogTitle>Edit Team Roster</DialogTitle>
                <DialogDescription>
                  Update your players for {eventDetails.event_name}
                </DialogDescription>
              </DialogHeader>

              {(() => {
                const rejectedOnRoster = currentRoster.filter(
                  (r) => r.status === "rejected",
                );
                if (rejectedOnRoster.length === 0) return null;
                const allRejected =
                  rejectedOnRoster.length === currentRoster.length;
                return (
                  <Alert className="border-destructive/50 bg-destructive/10 text-destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      {allRejected ? (
                        <p>
                          <strong>All players</strong> on the current roster
                          have been rejected. Please select a new lineup.
                        </p>
                      ) : (
                        <p>
                          <strong>
                            {rejectedOnRoster.length}{" "}
                            {rejectedOnRoster.length === 1
                              ? "player"
                              : "players"}
                          </strong>{" "}
                          on the current roster{" "}
                          {rejectedOnRoster.length === 1 ? "has" : "have"} been
                          rejected. Review and update your lineup.
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                );
              })()}

              <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-primary/10 rounded-md">
                <h3 className="font-semibold mb-3">
                  Select Players ({minPlayers}–{maxPlayers}):
                </h3>
                <div className="space-y-2">
                  {userTeam?.members.map((member) => {
                    const rosterEntry = currentRoster.find(
                      (r) => r.user_id.toString() === member.id,
                    );
                    const isRejected = rosterEntry?.status === "rejected";
                    const isCurrent = !!rosterEntry;
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-background rounded-md border hover:border-primary transition"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`edit-member-${member.id}`}
                            checked={selectedMemberIds.includes(member.id)}
                            onCheckedChange={() =>
                              handleMemberToggle(member.id)
                            }
                          />
                          <label
                            htmlFor={`edit-member-${member.id}`}
                            className="font-medium cursor-pointer"
                          >
                            {member.username}
                          </label>
                        </div>
                        <div className="flex items-center gap-1">
                          {isCurrent && !isRejected && (
                            <Badge variant="outline" className="text-xs">
                              Current
                            </Badge>
                          )}
                          {isRejected && (
                            <Badge variant="destructive" className="text-xs">
                              Rejected
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                Selected: {selectedMemberIds.length} / {maxPlayers} players
              </div>

              <DialogFooter className="flex sm:justify-between">
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleContinue}
                  disabled={
                    selectedMemberIds.length < minPlayers ||
                    selectedMemberIds.length > maxPlayers ||
                    isSubmitting
                  }
                >
                  {isSubmitting ? (
                    <Loader text="Saving..." />
                  ) : eventDetails.is_sponsored ? (
                    "Continue"
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {step === "SPONSOR_IDS" && (
            <>
              <DialogHeader>
                <DialogTitle>{eventDetails.sponsor_name} Details</DialogTitle>
                <DialogDescription>
                  Update {eventDetails.sponsor_field_label} for your roster
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
                {eventDetails.sponsor_requirement_description && (
                  <div className="p-3 rounded-md bg-primary/10 text-sm text-muted-foreground">
                    {eventDetails.sponsor_requirement_description}
                  </div>
                )}

                <div className="space-y-3 px-2">
                  {editHasDuplicates && (
                    <p className="text-sm text-destructive">
                      Each member must have a unique{" "}
                      {eventDetails.sponsor_field_label}. Duplicates are not
                      allowed.
                    </p>
                  )}
                  {selectedMembersData.map((member) => {
                    const isDuplicate = editDuplicateMemberIds.has(member.id);
                    return (
                      <div key={member.id} className="space-y-1">
                        <Label>{member.username}</Label>
                        <Input
                          className={`${isDuplicate ? "border-destructive focus-visible:ring-destructive" : "border-input"}`}
                          placeholder={`Enter ${eventDetails.sponsor_field_label}`}
                          value={sponsorIds[member.id] || ""}
                          onChange={(e) =>
                            setSponsorIds({
                              ...sponsorIds,
                              [member.id]: e.target.value,
                            })
                          }
                        />
                        {isDuplicate && (
                          <p className="text-xs text-destructive">
                            This value is already used by another member.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <DialogFooter className="flex sm:justify-between">
                <Button
                  variant="secondary"
                  onClick={() => setStep("SELECT_MEMBERS")}
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmitSponsor || isSubmitting}
                >
                  {isSubmitting ? <Loader text="Saving..." /> : "Save Changes"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const StageResultsTable: React.FC<{ stage: Stage }> = ({ stage }) => {
  // Initialize with first group's ID
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    stage?.groups?.[0]?.group_id?.toString() || "",
  );
  const [selectedMatchId, setSelectedMatchId] = useState<string>("overall");

  // Find active group
  const activeGroup = useMemo(() => {
    if (!stage?.groups || !selectedGroupId) return null;
    return stage.groups.find(
      (g) => g?.group_id?.toString() === selectedGroupId,
    );
  }, [stage.groups, selectedGroupId]);

  // Find active match
  const activeMatch = useMemo(() => {
    if (selectedMatchId === "overall" || !activeGroup?.matches) return null;
    return activeGroup.matches.find(
      (m: any) => m?.match_id?.toString() === selectedMatchId,
    );
  }, [activeGroup, selectedMatchId]);

  // Get table data
  const tableRows = useMemo(() => {
    if (selectedMatchId === "overall") {
      const rawData = activeGroup?.overall_leaderboard;
      return Array.isArray(rawData) ? rawData : [];
    } else {
      // API returns 'stats' not 'solo_stats'
      const rawData = activeMatch?.stats || activeMatch?.solo_stats;
      return Array.isArray(rawData) ? rawData : [];
    }
  }, [selectedMatchId, activeGroup, activeMatch]);

  if (!stage?.groups || stage.groups.length === 0) {
    return (
      <Card className="">
        <CardContent className="p-10 text-center">
          <p className="text-zinc-500">No groups defined for this stage yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className=" overflow-hidden">
      <CardHeader className="space-y-4">
        <div className="flex flex-col md:flex-row gap-2">
          {/* Group Selector */}
          <div className="flex-1 space-y-2">
            <Label>Select Group</Label>
            <Select
              value={selectedGroupId}
              onValueChange={(val) => {
                setSelectedGroupId(val);
                setSelectedMatchId("overall");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a group" />
              </SelectTrigger>
              <SelectContent>
                {stage.groups.map((g) => (
                  <SelectItem key={g.group_id} value={g.group_id?.toString()}>
                    {g.group_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Result View Selector */}
          <div className="flex-1 space-y-2">
            <Label>View Type</Label>
            <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overall">
                  Consolidated Leaderboard
                </SelectItem>
                {activeGroup?.matches?.map((m: any) => (
                  <SelectItem key={m.match_id} value={m.match_id?.toString()}>
                    Match {m.match_number} ({m.match_map})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="size-4 text-yellow-500" />
          <h3 className="text-sm font-semibold uppercase">
            {selectedMatchId === "overall"
              ? `${activeGroup?.group_name || "Group"} Standings`
              : `Match ${activeMatch?.match_number}: ${activeMatch?.match_map}`}
          </h3>
        </div>

        <div className="rounded-md border overflow-hidden shadow-inner">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center ">Rank</TableHead>
                <TableHead className="">Competitor</TableHead>
                <TableHead className="text-center ">Kills</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-semibold pr-6">
                  Total Points
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.length > 0 ? (
                tableRows.map((row: any, idx: number) => {
                  const username =
                    row.username ||
                    row.competitor__user__username ||
                    `Player ${row.competitor_id || idx + 1}`;
                  const kills = row.total_kills ?? row.kills ?? 0;
                  const points = row.total_points ?? row.total_pts ?? 0;
                  const placement = row.placement ?? idx + 1;

                  return (
                    <TableRow
                      key={`${
                        row.competitor_id || row.id
                      }-${selectedMatchId}-${idx}`}
                      className="group"
                    >
                      <TableCell className="text-center font-semibold">
                        #{placement}
                      </TableCell>
                      <TableCell className="font-bold">{username}</TableCell>
                      <TableCell className="text-center group-hover:text-white font-medium">
                        {kills}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary pr-6">
                        {parseFloat(points).toFixed(1)}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-40 text-center text-muted-foreground italic"
                  >
                    No results available for this selection.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

// Team Registration Modals Component
interface TeamRegistrationModalsProps {
  teamModalStep: TeamModalStep;
  setTeamModalStep: (step: TeamModalStep) => void;
  userTeam: UserTeam | null;
  selectedMembers: string[];
  setSelectedMembers: (members: string[]) => void;
  eventDetails: EventDetails;
  onContinueToRules: () => void;
}

const TeamRegistrationModals: React.FC<TeamRegistrationModalsProps> = ({
  teamModalStep,
  setTeamModalStep,
  userTeam,
  selectedMembers,
  setSelectedMembers,
  eventDetails,
  onContinueToRules,
}) => {
  const minPlayers = userTeam?.min_players || 4;
  const maxPlayers = userTeam?.max_players || 6;

  const handleMemberToggle = (memberId: string) => {
    // @ts-ignore
    setSelectedMembers((prev) => {
      if (prev.includes(memberId)) {
        return prev.filter((id: any) => id !== memberId);
      } else {
        if (prev.length >= maxPlayers) {
          toast.error(`You can only select up to ${maxPlayers} members`);
          return prev;
        }
        return [...prev, memberId];
      }
    });
  };

  const handleContinue = () => {
    if (selectedMembers.length < minPlayers) {
      toast.error(`Please select at least ${minPlayers} team members`);
      return;
    }
    if (selectedMembers.length > maxPlayers) {
      toast.error(`Please select at most ${maxPlayers} team members`);
      return;
    }
    setTeamModalStep("TEAM_INFO");
  };

  const selectedMembersData = useMemo(() => {
    return (
      userTeam?.members.filter((m) => selectedMembers.includes(m.id)) || []
    );
  }, [userTeam, selectedMembers]);

  const closeAll = () => {
    setTeamModalStep("CLOSED");
    setSelectedMembers([]);
  };

  if (teamModalStep === "CLOSED") return null;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && closeAll()}>
      <DialogContent className="flex flex-col max-h-[85vh]">
        {teamModalStep === "SELECT_MEMBERS" && (
          <>
            <DialogHeader>
              <DialogTitle>Select Team Members</DialogTitle>
              <DialogDescription>
                Select {minPlayers}-{maxPlayers} players from your team roster
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-primary/10 rounded-md">
              <h3 className="font-semibold mb-3">Available Players:</h3>
              <div className="space-y-2">
                {userTeam?.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-background rounded-md border hover:border-primary transition"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`member-${member.id}`}
                        checked={selectedMembers.includes(member.id)}
                        onCheckedChange={() => handleMemberToggle(member.id)}
                      />
                      <label
                        htmlFor={`member-${member.id}`}
                        className="font-medium cursor-pointer"
                      >
                        {member.username}
                      </label>
                    </div>
                    {/* <Badge
                      variant={member.is_verified ? "default" : "secondary"}
                    >
                      {member.is_verified ? "Verified" : "Not Verified"}
                    </Badge> */}
                  </div>
                ))}
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Selected: {selectedMembers.length} / {maxPlayers} players
            </div>

            <DialogFooter className="flex sm:justify-between">
              <Button variant="secondary" onClick={closeAll}>
                Cancel
              </Button>
              <Button
                onClick={handleContinue}
                disabled={
                  selectedMembers.length < minPlayers ||
                  selectedMembers.length > maxPlayers
                }
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {teamModalStep === "TEAM_INFO" && (
          <>
            <DialogHeader>
              <DialogTitle>Team Information</DialogTitle>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-primary/10 rounded-md space-y-3">
              <div>
                <span className="font-semibold text-primary">Team Name:</span>{" "}
                {userTeam?.team_name}
              </div>
              <div>
                <span className="font-semibold text-primary">
                  Members Selected:
                </span>{" "}
                {selectedMembers.length}
              </div>
              <div>
                <span className="font-semibold text-primary">Tournament:</span>{" "}
                {eventDetails.event_name}
              </div>
              <div>
                <span className="font-semibold text-primary">Format:</span>{" "}
                {eventDetails.competition_type}
              </div>

              <Separator className="my-3" />

              <div>
                <p className="font-semibold text-primary mb-2">Team Members:</p>
                <ul className="space-y-1">
                  {selectedMembersData.map((member, idx) => (
                    <li key={member.id} className="text-sm">
                      {idx + 1}. {member.username}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <DialogFooter className="flex sm:justify-between">
              <Button
                variant="secondary"
                onClick={() => setTeamModalStep("SELECT_MEMBERS")}
              >
                Back
              </Button>
              <Button onClick={onContinueToRules}>Continue to Rules</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface ModalProps {
  eventDetails: EventDetails & {
    selectedTeamMembers?: TeamMember[];
    validationResults?: DiscordValidationResult[];
  };
  modalStep: ModalStep;
  setModalStep: (step: ModalStep) => void;
  handleSelectType: (type: RegistrationType) => void;
  rulesAccepted: boolean;
  setRulesAccepted: (checked: boolean) => void;
  handleRulesContinue: () => void;
  handleDiscordConnect: () => void;
  handleJoinedServer: () => void;
  pendingJoined: boolean;
  isDiscordConnected: boolean;
  regType: RegistrationType | null;
  onCheckDiscordStatus?: () => void;
  checkUserDiscordStatus?: () => void;
  isCheckingDiscord?: boolean;
  isCheckingUserDiscord?: boolean;
  isInAfcServer?: boolean;
  teamAfcServerStatus?: Record<string, boolean>;
  copyAfcServerLink: () => void;
  soloSponsorUuid: string;
  setSoloSponsorUuid: (v: string) => void;
  teamSponsorUuids: Record<string, string>;
  setTeamSponsorUuids: (v: Record<string, string>) => void;
}

const RegistrationModals: React.FC<ModalProps> = ({
  eventDetails,
  modalStep,
  setModalStep,
  handleSelectType,
  rulesAccepted,
  setRulesAccepted,
  handleRulesContinue,
  handleDiscordConnect,
  handleJoinedServer,
  pendingJoined,
  isDiscordConnected,
  regType,
  onCheckDiscordStatus,
  isCheckingDiscord = false,
  isCheckingUserDiscord = false,
  isInAfcServer = false,
  checkUserDiscordStatus,
  copyAfcServerLink,
  teamAfcServerStatus,
  soloSponsorUuid,
  setSoloSponsorUuid,
  teamSponsorUuids,
  setTeamSponsorUuids,
}) => {
  const isSoloDisabled = eventDetails.participant_type === "squad";
  const isTeamDisabled = eventDetails.participant_type === "solo";
  const closeAll = () => setModalStep("CLOSED");

  // Keep refs fresh so the interval can read latest values without causing re-runs
  const onCheckDiscordStatusRef = useRef(onCheckDiscordStatus);
  const teamAfcServerStatusRef = useRef(teamAfcServerStatus);
  const validationResultsRef = useRef(eventDetails.validationResults);
  const selectedTeamMembersRef = useRef(eventDetails.selectedTeamMembers);

  useEffect(() => {
    onCheckDiscordStatusRef.current = onCheckDiscordStatus;
  }, [onCheckDiscordStatus]);
  useEffect(() => {
    teamAfcServerStatusRef.current = teamAfcServerStatus;
  }, [teamAfcServerStatus]);
  useEffect(() => {
    validationResultsRef.current = eventDetails.validationResults;
    selectedTeamMembersRef.current = eventDetails.selectedTeamMembers;
  }, [eventDetails.validationResults, eventDetails.selectedTeamMembers]);

  // Poll Discord status for team members — only restarts when modal step changes
  useEffect(() => {
    if (modalStep !== "DISCORD_STATUS" || !onCheckDiscordStatusRef.current)
      return;

    // Initial check when entering the step
    onCheckDiscordStatusRef.current();

    // Poll every 30 seconds; reads fresh values from refs so status updates
    // don't restart this effect and cause rapid successive calls
    const interval = setInterval(() => {
      const vr = validationResultsRef.current || [];
      const allMembersOk = vr.length > 0 && vr.every((r: any) => r.ok);
      const smData = selectedTeamMembersRef.current || [];
      const allInAfcServer = smData.every(
        (member) =>
          member.discord_id &&
          teamAfcServerStatusRef.current?.[member.discord_id] === true,
      );

      if (allMembersOk && allInAfcServer) {
        clearInterval(interval);
        return;
      }

      onCheckDiscordStatusRef.current?.();
    }, 30000);

    return () => clearInterval(interval);
  }, [modalStep]);

  const renderDialog = () => {
    switch (modalStep) {
      case "INFO":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Tournament Information</DialogTitle>
              <DialogDescription>
                Review tournament details before proceeding.
              </DialogDescription>
            </DialogHeader>
            <DialogContent className="p-4 rounded-md text-sm space-y-2">
              <p className="capitalize">
                Format: {eventDetails.event_mode} /{" "}
                {eventDetails.competition_type}
              </p>
              <p>Date: {formatDate(eventDetails.start_date)}</p>
              <p>Prize Pool: ${formatMoneyInput(eventDetails.prizepool)}</p>
              <p>
                Location:{" "}
                <span className="capitalize">{eventDetails.event_mode}</span>
              </p>
              <Separator />
              <div className="flex items-start space-x-2 text-sm">
                <AlertTriangle className="size-4 flex-shrink-0 mt-1 text-yellow-400" />
                <div>
                  <p className="font-semibold text-yellow-400">
                    Discord Requirement
                  </p>
                  <p className="text-xs">
                    A connected Discord account is required to participate.
                  </p>
                </div>
              </div>
              <DialogFooter className="flex sm:justify-between">
                <Button
                  variant="secondary"
                  onClick={() => setModalStep("TYPE")}
                >
                  Back
                </Button>
                <Button onClick={() => setModalStep("RULES")}>Continue</Button>
              </DialogFooter>
            </DialogContent>
          </>
        );

      case "TYPE":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                Tournament Registration
              </DialogTitle>
              <DialogDescription>Select registration type</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Card
                onClick={() => !isSoloDisabled && handleSelectType("solo")}
                className={`cursor-pointer transition ${
                  isSoloDisabled
                    ? "bg-white text-primary border-white opacity-50"
                    : "bg-white hover:bg-white/90"
                }`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center text-primary">
                    <User className="size-4 mr-1" />
                    Solo Registration
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Register as an individual player
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card
                onClick={() => !isTeamDisabled && handleSelectType("team")}
                className={`cursor-pointer transition ${
                  isTeamDisabled
                    ? "bg-white text-primary border-white opacity-50"
                    : "bg-white hover:bg-white/90"
                }`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center text-primary">
                    <Users className="size-4 mr-1" />
                    Team Registration
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Register as a team
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </>
        );

      case "RULES":
        const textRules = eventDetails.event_rules;
        const documentUrl = (eventDetails as any).uploaded_rules_url;
        const hasDocument = documentUrl && documentUrl.startsWith("http");
        const hasTextRules = !!textRules;

        const renderRulesContent = () => {
          if (hasTextRules) {
            return (
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-primary">General Rules:</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {textRules}
                  </p>
                </div>
                {hasDocument && (
                  <div className="pt-2">
                    <p className="font-medium text-primary">
                      Full Rules Document:
                    </p>
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto text-sm text-yellow-400 hover:text-yellow-300"
                      onClick={() => window.open(documentUrl, "_blank")}
                    >
                      Download Official Rules Document
                    </Button>
                  </div>
                )}
              </div>
            );
          }

          if (hasDocument) {
            return (
              <div className="text-center space-y-4 pt-4">
                <AlertTriangle className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="font-semibold text-primary">
                  Official Rules Document Available
                </p>
                <p className="text-xs text-muted-foreground">
                  Please click the button below to download and review the
                  official document.
                </p>
                <Button
                  type="button"
                  onClick={() => window.open(documentUrl, "_blank")}
                  className="w-full"
                >
                  Download Rules Document
                </Button>
              </div>
            );
          }

          return (
            <div className="text-center p-4">
              <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <p className="font-semibold text-yellow-400">
                Rules Document Missing
              </p>
              <p className="text-xs">
                Tournament rules are currently unavailable. Contact tournament
                admins.
              </p>
            </div>
          );
        };

        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                Tournament Rules & Policies
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-80 p-4 bg-primary/10 rounded-md overflow-y-auto pr-4 space-y-4 text-sm text-gray-300">
              {renderRulesContent()}
              <Separator className="my-4 bg-gray-700" />
              <div>
                <p className="font-medium text-primary">Conduct Policy:</p>
                <p className="text-muted-foreground">
                  Maintain professional conduct at all times.
                </p>
              </div>
              <div>
                <p className="font-medium text-primary">Device Policy:</p>
                <p className="text-muted-foreground">
                  Device must remain consistent throughout the tournament.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <Checkbox
                id="rules"
                checked={rulesAccepted}
                onCheckedChange={(checked) => setRulesAccepted(!!checked)}
                className="w-4 h-4 rounded border-gray-500 data-[state=checked]:bg-primary data-[state=checked]:text-black"
              />
              <label
                htmlFor="rules"
                className="text-sm font-medium text-muted-foreground"
              >
                I agree to all tournament rules and policies.
              </label>
            </div>
            <DialogFooter className="mt-2 flex sm:justify-between">
              <Button variant="secondary" onClick={() => setModalStep("INFO")}>
                Back
              </Button>
              <Button onClick={handleRulesContinue} disabled={!rulesAccepted}>
                {eventDetails.is_sponsored ? "Continue" : "Continue to Discord"}
              </Button>
            </DialogFooter>
          </>
        );

      case "SPONSOR": {
        const teamMembers = eventDetails.selectedTeamMembers || [];
        const isTeamSponsor = regType === "team" && teamMembers.length > 0;
        const nextStep = regType === "team" ? "DISCORD_STATUS" : "DISCORD_LINK";

        // Detect duplicate sponsor values across team members
        const seenValues = new Set<string>();
        const duplicateMemberIds = new Set<string>();
        teamMembers.forEach((m) => {
          const val = (teamSponsorUuids[m.id] || "").trim();
          if (val !== "") {
            if (seenValues.has(val)) {
              // Mark all members with this value as duplicates
              teamMembers.forEach((other) => {
                if ((teamSponsorUuids[other.id] || "").trim() === val) {
                  duplicateMemberIds.add(other.id);
                }
              });
            } else {
              seenValues.add(val);
            }
          }
        });
        const hasDuplicates = duplicateMemberIds.size > 0;

        const canContinueSponsor = isTeamSponsor
          ? teamMembers.every(
              (m) => (teamSponsorUuids[m.id] || "").trim() !== "",
            ) && !hasDuplicates
          : soloSponsorUuid.trim() !== "";

        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                {eventDetails.sponsor_name} Requirement
              </DialogTitle>
              <DialogDescription>
                Complete this step to finish registration
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-3 rounded-md bg-primary/10 text-sm text-muted-foreground">
                {eventDetails.sponsor_requirement_description}
              </div>

              {isTeamSponsor ? (
                <div className="space-y-3">
                  {hasDuplicates && (
                    <p className="text-sm text-destructive">
                      Each member must have a unique{" "}
                      {eventDetails.sponsor_field_label}. Duplicates are not
                      allowed.
                    </p>
                  )}
                  {teamMembers.map((member) => {
                    const isDuplicate = duplicateMemberIds.has(member.id);
                    return (
                      <div key={member?.id} className="space-y-1">
                        <label className="text-sm font-medium">
                          {member?.username}
                        </label>
                        <Input
                          className={`${isDuplicate ? "border-destructive focus-visible:ring-destructive" : "border-input"}`}
                          placeholder={`Enter ${eventDetails.sponsor_field_label}`}
                          value={teamSponsorUuids[member.id] || ""}
                          onChange={(e) =>
                            setTeamSponsorUuids({
                              ...teamSponsorUuids,
                              [member.id]: e.target.value,
                            })
                          }
                        />
                        {isDuplicate && (
                          <p className="text-xs text-destructive">
                            This value is already used by another member.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    {eventDetails.sponsor_field_label}
                  </label>
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder={`Enter your ${eventDetails.sponsor_field_label}`}
                    value={soloSponsorUuid}
                    onChange={(e) => setSoloSponsorUuid(e.target.value)}
                  />
                </div>
              )}
            </div>

            <DialogFooter className="flex sm:justify-between">
              <Button variant="secondary" onClick={() => setModalStep("RULES")}>
                Back
              </Button>
              <Button
                onClick={() => setModalStep(nextStep)}
                disabled={!canContinueSponsor}
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        );
      }

      case "DISCORD_LINK":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                Connect Discord Account
              </DialogTitle>
              <DialogDescription>
                Required for tournament participation
              </DialogDescription>
            </DialogHeader>
            <div className="text-center p-4 bg-primary/10 rounded-lg space-y-4">
              {isCheckingUserDiscord ? (
                <div className="space-y-4">
                  <Loader text="Checking Discord status..." />
                </div>
              ) : isDiscordConnected ? (
                <div className="space-y-4">
                  <CheckCircle className="w-8 h-8 text-primary mx-auto" />
                  <p className="font-semibold text-primary">
                    Discord Account Connected!
                  </p>
                  <p className="text-sm text-gray-300">
                    You can now proceed to the final step.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto" />
                  <p className="text-sm text-gray-300">
                    Click below to link your Discord account.
                  </p>
                  <Button onClick={handleDiscordConnect} className="w-full">
                    Connect Discord Account
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter className="flex sm:justify-between">
              <Button variant="secondary" onClick={() => setModalStep("RULES")}>
                Back
              </Button>
              <Button
                onClick={() => setModalStep("DISCORD_JOIN")}
                disabled={!isDiscordConnected || isCheckingUserDiscord}
              >
                Continue to Final Step
              </Button>
            </DialogFooter>
          </>
        );

        // case "DISCORD_JOIN":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                Join AFC Discord Server
              </DialogTitle>
              <DialogDescription>Final step for registration</DialogDescription>
            </DialogHeader>
            <div className="text-center p-4 bg-primary/10 rounded-lg space-y-4">
              <p className="text-sm text-muted-foreground">
                Join the AFC Discord server to complete registration.
              </p>
              <Button
                onClick={() =>
                  window.open(
                    AFC_DISCORD_SERVER,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
                disabled={pendingJoined}
                className="w-full bg-indigo-600 hover:bg-indigo-500"
              >
                Join AFC Discord Server
              </Button>
            </div>
            <DialogFooter className="mt-4 flex sm:justify-between">
              <Button
                variant="secondary"
                onClick={() => setModalStep("DISCORD_LINK")}
              >
                Back
              </Button>
              <Button
                onClick={handleJoinedServer}
                disabled={pendingJoined}
                className="bg-green-600 hover:bg-green-500"
              >
                {pendingJoined ? (
                  <Loader text="Completing..." />
                ) : (
                  "I've Joined the Server"
                )}
              </Button>
            </DialogFooter>
          </>
        );

      case "DISCORD_JOIN":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                Join AFC Discord Server
              </DialogTitle>
              <DialogDescription>Final step for registration</DialogDescription>
            </DialogHeader>
            <div className="text-center p-4 bg-primary/10 rounded-lg space-y-4">
              {isCheckingUserDiscord ? (
                <div className="space-y-4">
                  <Loader text="Checking server membership..." />
                </div>
              ) : isInAfcServer ? (
                <div className="space-y-4">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto" />
                  <p className="font-semibold text-green-500">
                    You're already in the AFC Discord server!
                  </p>
                  <p className="text-sm text-gray-300">
                    You can proceed with registration.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Join the AFC Discord server to complete registration.
                  </p>
                  <Button
                    onClick={() =>
                      window.open(
                        AFC_DISCORD_SERVER,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                    disabled={pendingJoined}
                    className="w-full bg-indigo-600 hover:bg-indigo-500"
                  >
                    Join AFC Discord Server
                  </Button>
                </>
              )}
            </div>
            <DialogFooter className="mt-4 flex sm:justify-between">
              <Button
                variant="secondary"
                onClick={() => setModalStep("DISCORD_LINK")}
              >
                Back
              </Button>
              {isInAfcServer ? (
                <Button
                  onClick={handleJoinedServer}
                  disabled={pendingJoined}
                  className="bg-green-600 hover:bg-green-500"
                >
                  {pendingJoined ? (
                    <Loader text="Completing..." />
                  ) : (
                    "Complete Registration"
                  )}
                </Button>
              ) : (
                <Button
                  onClick={checkUserDiscordStatus}
                  disabled={isCheckingUserDiscord}
                  className="bg-green-600 hover:bg-green-500"
                >
                  {isCheckingUserDiscord ? (
                    <Loader text="Checking..." />
                  ) : (
                    "I've Joined the Server"
                  )}
                </Button>
              )}
            </DialogFooter>
          </>
        );

      case "DISCORD_STATUS":
        const validationResults = eventDetails.validationResults || [];
        const allMembersOk =
          validationResults.length > 0 &&
          validationResults.every((r: any) => r.ok);

        // Check if all members are in AFC server
        const selectedMembersData = eventDetails.selectedTeamMembers || [];
        const allInAfcServer = selectedMembersData.every(
          (member) =>
            member.discord_id &&
            teamAfcServerStatus?.[member.discord_id] === true, // ✅ FIX: Check explicitly
        );

        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                Connect Discord - All Members
              </DialogTitle>
              <DialogDescription>
                All team members must have Discord linked and join AFC server
              </DialogDescription>
            </DialogHeader>

            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col rounded-md">
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">
                    Team Members Status:
                  </h3>
                  <div className="space-y-2">
                    {validationResults.map((result: any) => {
                      const hasIssues = !result.ok;
                      const reasons = result.reasons || [];
                      const inAfcServer =
                        result.discord_id &&
                        teamAfcServerStatus?.[result.discord_id] === true;

                      return (
                        <div
                          key={result.user_id}
                          className={`p-3 rounded-md border transition-all ${
                            result.ok && inAfcServer
                              ? "border-green-500/50 bg-green-500/10"
                              : "border-red-500/50 bg-red-500/10"
                          }`}
                        >
                          <div className="flex items-start text-sm justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1">
                              {result.ok && inAfcServer ? (
                                <CheckCircle className="size-4 text-green-400 flex-shrink-0 mt-0.5" />
                              ) : (
                                <AlertTriangle className="size-4 text-red-400 flex-shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1">
                                <span
                                  className={`font-medium ${
                                    result.ok && inAfcServer
                                      ? "text-green-400"
                                      : "text-red-400"
                                  }`}
                                >
                                  {result.username}
                                </span>
                                {hasIssues && reasons.length > 0 && (
                                  <div className="mt-1 space-y-0.5">
                                    {reasons.map((reason, idx) => (
                                      <p
                                        key={idx}
                                        className="text-xs text-red-300"
                                      >
                                        • {reason.replace(/_/g, " ")}
                                      </p>
                                    ))}
                                  </div>
                                )}
                                {result.ok && !inAfcServer && (
                                  <p className="text-xs text-red-300 mt-1">
                                    • Not in AFC Discord server
                                  </p>
                                )}
                                {result.discord_connected &&
                                  result.discord_id && (
                                    <>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Discord ID: {result.discord_id}
                                      </p>
                                      {inAfcServer && (
                                        <p className="text-xs text-green-400 mt-1">
                                          ✓ In AFC Server
                                        </p>
                                      )}
                                    </>
                                  )}
                              </div>
                            </div>
                            {result.ok && inAfcServer ? (
                              <CheckCircle className="size-5 text-green-400 flex-shrink-0" />
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={copyAfcServerLink}
                              >
                                Copy Link
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {isCheckingDiscord && (
                  <div className="p-3 bg-blue-600 border border-blue-600/50 rounded-md">
                    <p className="text-sm text-blue-100 text-center">
                      Checking Discord and server status...
                    </p>
                  </div>
                )}

                {!allMembersOk &&
                  !isCheckingDiscord &&
                  validationResults.length > 0 && (
                    <div className="p-3 bg-yellow-600 border border-yellow-600/50 rounded-md">
                      <p className="text-sm text-yellow-100 text-center">
                        Waiting for all team members to link their Discord
                        accounts and join the AFC server...
                      </p>
                    </div>
                  )}

                {allMembersOk && !allInAfcServer && (
                  <div className="p-3 bg-orange-600 border border-orange-600/50 rounded-md">
                    <p className="text-sm text-orange-100 text-center">
                      Some members haven't joined the AFC Discord server yet.
                      Share the server link with them!
                    </p>
                  </div>
                )}

                {allMembersOk && allInAfcServer && (
                  <div className="p-3 bg-green-600 border border-green-600/50 rounded-md">
                    <p className="text-sm text-green-100 text-center font-medium">
                      All team members are ready! You can proceed with
                      registration.
                    </p>
                  </div>
                )}

                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCheckDiscordStatus}
                    disabled={isCheckingDiscord}
                    className="text-xs"
                  >
                    {isCheckingDiscord ? (
                      <IconRefresh className="mr-1 size-3 animate-spin" />
                    ) : (
                      <IconRefresh className="mr-1 size-3" />
                    )}
                    {isCheckingDiscord ? "Checking..." : "Refresh Status"}
                  </Button>
                </div>
              </div>
              <DialogFooter className="flex sm:justify-between">
                <Button
                  variant="secondary"
                  onClick={() => setModalStep("RULES")}
                >
                  Back
                </Button>
                {allMembersOk && allInAfcServer && (
                  <Button onClick={handleJoinedServer} disabled={pendingJoined}>
                    {pendingJoined ? (
                      <Loader text="Completing..." />
                    ) : (
                      "Complete Registration"
                    )}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </>
        );

      case "SUCCESS":
        return (
          <>
            <div className="text-center px-4 py-8 bg-primary/10 rounded-lg space-y-2">
              <DialogHeader className="text-center">
                <CheckCircle className="w-12 h-12 text-primary mx-auto mb-2" />
              </DialogHeader>
              <p className="text-sm font-semibold">
                Welcome to the tournament! Check Discord for match details.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={closeAll} className="w-full">
                Close
              </Button>
            </DialogFooter>
          </>
        );

      default:
        return null;
    }
  };

  if (modalStep === "CLOSED") return null;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && closeAll()}>
      <DialogContent className="flex flex-col max-h-[85vh] overflow-y-auto">
        {renderDialog()}
      </DialogContent>
    </Dialog>
  );
};

export const EventDetailsWrapper = ({ slug }: { slug: string }) => {
  const { token, user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const router = useRouter();

  const requireAuth = (action: () => void) => {
    if (!token) {
      openAuthModal({ defaultTab: "login", onSuccess: action });
      return;
    }
    action();
  };
  const searchParams = useSearchParams();

  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStageTab, setActiveStageTab] = useState<string>("");
  const [modalStep, setModalStep] = useState<ModalStep>("CLOSED");
  const [regType, setRegType] = useState<RegistrationType | null>(null);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [discordConnected, setDiscordConnected] = useState(false);
  const [pendingJoined, startJoinedTransition] = useTransition();
  const [isInAfcServer, setIsInAfcServer] = useState(false);

  // Team registration states
  const [userTeam, setUserTeam] = useState<UserTeam | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [teamModalStep, setTeamModalStep] = useState<TeamModalStep>("CLOSED");
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [selectedTeamMembersData, setSelectedTeamMembersData] = useState<
    TeamMember[]
  >([]);

  const [isCheckingDiscord, setIsCheckingDiscord] = useState(false);
  const [validationResults, setValidationResults] = useState<
    DiscordValidationResult[]
  >([]);

  // Sponsor UUID state
  const [soloSponsorUuid, setSoloSponsorUuid] = useState("");
  const [teamSponsorUuids, setTeamSponsorUuids] = useState<
    Record<string, string>
  >({});

  // Invite token state
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [hasValidInvite, setHasValidInvite] = useState<boolean>(false);

  const [isCheckingInvite, setIsCheckingInvite] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{
    is_used: boolean;
    used_by: string | null;
    used_at: string | null;
  } | null>(null);

  // Ban state
  const [isUserBanned, setIsUserBanned] = useState(false);
  const [showBannedModal, setShowBannedModal] = useState(false);

  // User Discord state
  const [userDiscordId, setUserDiscordId] = useState<string | null>(null);
  const [isCheckingUserDiscord, setIsCheckingUserDiscord] = useState(false);

  // Roster rejection state
  const [pageRoster, setPageRoster] = useState<RosterMember[]>([]);

  const [teamAfcServerStatus, setTeamAfcServerStatus] = useState<
    Record<string, boolean>
  >({});

  const checkUserDiscordStatus = useCallback(async () => {
    if (!token) {
      return false;
    }

    setIsCheckingUserDiscord(true);
    try {
      const response = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/is-discord-account-connected/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      // Check if user has Discord connected
      const isConnected = response.data?.connected || false;
      setDiscordConnected(isConnected);

      // If connected, also check if they're in AFC server
      if (isConnected && userDiscordId) {
        const serverCheckResponse = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/check-discord-membership-v2/`,
          {
            discord_id: userDiscordId,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const inServer = serverCheckResponse.data?.is_member || false;
        setIsInAfcServer(inServer);
      }

      return isConnected;
    } catch (err: any) {
      console.error("Error checking Discord status:", err);
      setDiscordConnected(false);
      setIsInAfcServer(false);
      return false;
    } finally {
      setIsCheckingUserDiscord(false);
    }
  }, [userDiscordId, token]);

  // Check invite token status
  const checkInviteTokenStatus = useCallback(
    async (token: string) => {
      setIsCheckingInvite(true);
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/check-invite-token-status/`,
          {
            invite_token: token,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        setInviteStatus({
          is_used: response.data.is_used,
          used_by: response.data.used_by,
          used_at: response.data.used_at,
        });

        if (response.data.is_used) {
          toast.error("This invite link has already been used.");
          setHasValidInvite(false);
          return false;
        }

        return true;
      } catch (err: any) {
        console.error("Error checking invite token:", err);
        toast.error("Invalid or expired invite link.");
        setHasValidInvite(false);
        return false;
      } finally {
        setIsCheckingInvite(false);
      }
    },
    [token],
  );

  // Fetch user profile to get Discord ID
  const fetchUserProfile = useCallback(async () => {
    if (!token || !user?.user_id) return;

    try {
      const response = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-user-profile/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data?.discord_id) {
        setUserDiscordId(response.data.discord_id);
      }
      setIsUserBanned(response.data?.is_banned === true);
    } catch (err: any) {
      console.error("Error fetching user profile:", err);
    }
  }, [token, user]);

  // Fetch user profile on mount
  useEffect(() => {
    if (token && user) {
      fetchUserProfile();
    }
  }, [fetchUserProfile, token, user]);

  // Check Discord status when entering DISCORD_LINK modal
  useEffect(() => {
    if (modalStep === "DISCORD_LINK" && userDiscordId) {
      checkUserDiscordStatus();
    }
  }, [modalStep, userDiscordId, checkUserDiscordStatus]);

  useEffect(() => {
    const invitation =
      searchParams.get("invitation") || searchParams.get("invite_token");

    if (invitation && !inviteToken) {
      setInviteToken(invitation);
      // Validate the invite token
      checkInviteTokenStatus(invitation);
    }
  }, [searchParams, inviteToken, checkInviteTokenStatus]);

  const checkTeamDiscordStatus = useCallback(async () => {
    if (!eventDetails || !userTeam || selectedMembers.length === 0) return;

    setIsCheckingDiscord(true);
    try {
      const memberIds = selectedMembers.map((id) => parseInt(id));

      // Check Discord connection for all members
      const response = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/validate-team-roster-discord/`,
        {
          event_id: eventDetails.event_id,
          team_id: parseInt(userTeam.team_id),
          roster_member_ids: memberIds,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setValidationResults(response.data.results);

      // Get discord IDs of selected members
      const selectedMembersData = userTeam.members.filter((m) =>
        selectedMembers.includes(m.id),
      );

      // ✅ FIX: Filter out null/undefined AND ensure discord_id is a string
      const discordIds = selectedMembersData
        .map((m) => m.discord_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);

      if (discordIds.length > 0) {
        // Check AFC server membership
        const serverResponse = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/check-team-members-discord-membership/`,
          {
            discord_ids: discordIds,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        setTeamAfcServerStatus(serverResponse.data.membership || {});
      }

      if (response.data.all_ok) {
        toast.success("All team members have Discord connected!");
      }
    } catch (err: any) {
      console.error("Error validating team Discord status:", err);
      toast.error(
        err.response?.data?.message || "Failed to validate Discord status",
      );
    } finally {
      setIsCheckingDiscord(false);
    }
  }, [eventDetails, userTeam, selectedMembers, token]);

  const copyAfcServerLink = useCallback(() => {
    navigator.clipboard.writeText(AFC_DISCORD_SERVER);
    toast.success("AFC Discord server link copied!");
  }, []);

  useEffect(() => {
    // Fix malformed URLs where backend uses ? instead of & (e.g. ?invite_token=...?discord=connected)
    const fullQuery = window.location.search;
    const fixedQuery = fullQuery.replace(/\?/g, (_match, offset) =>
      offset === 0 ? "?" : "&",
    );
    const fixedParams = new URLSearchParams(fixedQuery);

    const discordStatus =
      searchParams.get("discord") || fixedParams.get("discord");

    const inviteFromUrl =
      searchParams.get("invitation") ||
      searchParams.get("invite_token") ||
      fixedParams.get("invitation") ||
      fixedParams.get("invite_token");

    // Clean up the invite_token value in case it has a malformed ? appended
    const cleanInvite = inviteFromUrl?.split("?")[0] || null;

    if (cleanInvite && !inviteToken) {
      setInviteToken(cleanInvite);
      setHasValidInvite(true);
    }

    if (discordStatus) {
      setModalStep("DISCORD_LINK");
      setTimeout(() => {
        if (discordStatus === "connected") {
          setDiscordConnected(true);
          setModalStep("DISCORD_JOIN");
          toast.success("Discord account linked successfully!");
        } else if (discordStatus === "already_linked") {
          setDiscordConnected(true);
          setModalStep("DISCORD_JOIN");
          toast.info("This Discord account is already linked to your profile.");
        } else {
          setDiscordConnected(false);
          toast.error(
            searchParams.get("message") ||
              fixedParams.get("message") ||
              "Discord connection failed.",
          );
        }

        const newSearchParams = new URLSearchParams();
        if (cleanInvite) {
          newSearchParams.set("invitation", cleanInvite);
        }

        const newUrl = newSearchParams.toString()
          ? `${window.location.pathname}?${newSearchParams.toString()}`
          : window.location.pathname;

        router.replace(newUrl, { scroll: false });
      }, 50);
    }
  }, [searchParams, router, inviteToken]);

  const fetchEventDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ slug: slug }),
        },
      );

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const result: ApiResponse = await response.json();
      const details = result.event_details;

      setEventDetails(details);

      if (details?.stages?.length > 0) {
        setActiveStageTab(details.stages[0].stage_name);
      }
    } catch (err) {
      toast.error("Failed to load event details");
      setError("Failed to load event details");
    } finally {
      setIsLoading(false);
    }
  }, [slug, token]);

  const fetchUserTeam = useCallback(async () => {
    setLoadingTeam(true);
    try {
      const resCurrent = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-user-current-team/`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (resCurrent.data && resCurrent.data.team) {
        const resDetails = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
          { team_name: resCurrent.data.team.team_name },
        );
        setUserTeam(resDetails.data.team);
      } else {
        toast.error("You don't have a team. Please create one first.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to load team data");
    } finally {
      setLoadingTeam(false);
    }
  }, [token]);

  const fetchPageRoster = useCallback(async () => {
    if (!token || !eventDetails?.event_id) return;
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-roster-details/`,
        { event_id: eventDetails.event_id },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setPageRoster(res.data.roster || []);
    } catch {
      // silently fail — this is supplementary UI
    }
  }, [token, eventDetails?.event_id]);

  useEffect(() => {
    if (
      eventDetails?.is_registered &&
      eventDetails?.participant_type === "squad" &&
      token
    ) {
      fetchPageRoster();
    }
  }, [
    eventDetails?.is_registered,
    eventDetails?.participant_type,
    eventDetails?.event_id,
    token,
    fetchPageRoster,
  ]);

  useEffect(() => {
    if (slug && token) {
      fetchEventDetails();

      const fetchUser = async () => {
        const resCurrent = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-user-current-team/`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (resCurrent.data && resCurrent.data.team) {
          const resDetails = await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
            { team_name: resCurrent.data.team.team_name },
          );
          setUserTeam(resDetails.data.team);
        } else {
          toast.error("You don't have a team. Please create one first.");
        }
      };

      fetchUser();
    }
  }, [fetchEventDetails, slug, token]);

  const handleRegisterClick = useCallback(async () => {
    // Check ban status before anything else
    if (eventDetails?.participant_type === "squad" && userTeam?.is_banned) {
      setShowBannedModal(true);
      return;
    }
    if (eventDetails?.participant_type !== "squad" && isUserBanned) {
      setShowBannedModal(true);
      return;
    }

    // Check if event is private and if user has a valid invite
    if (eventDetails && !eventDetails.is_public && !hasValidInvite) {
      toast.error(
        "This is a private event. You need an invite link to register.",
      );
      return;
    }

    // If private event, check invite status again before proceeding
    if (eventDetails && !eventDetails.is_public && inviteToken) {
      const isValid = await checkInviteTokenStatus(inviteToken);
      if (!isValid) {
        return; // Don't proceed if invite is invalid/used
      }
    }

    setModalStep("TYPE");
  }, [
    eventDetails,
    hasValidInvite,
    inviteToken,
    checkInviteTokenStatus,
    userTeam,
    isUserBanned,
  ]);

  const handleSelectType = useCallback(
    async (type: RegistrationType) => {
      setRegType(type);

      if (type === "team") {
        // Fetch user's team before proceeding
        await fetchUserTeam();
        setTeamModalStep("SELECT_MEMBERS");
        setModalStep("CLOSED"); // Close the type selection modal
      } else {
        // Solo registration - proceed to INFO
        setModalStep("INFO");
      }
    },
    [fetchUserTeam],
  );

  const handleTeamContinueToRules = useCallback(() => {
    // Store selected team members data
    const membersData =
      userTeam?.members.filter((m) => selectedMembers.includes(m.id)) || [];
    setSelectedTeamMembersData(membersData);

    setTeamModalStep("CLOSED");
    setModalStep("RULES");
  }, [userTeam, selectedMembers]);

  const handleRulesContinue = useCallback(() => {
    if (!rulesAccepted) return;
    if (eventDetails?.is_sponsored) {
      setModalStep("SPONSOR");
      return;
    }
    if (regType === "team" && selectedTeamMembersData.length > 0) {
      setModalStep("DISCORD_STATUS");
    } else {
      setModalStep("DISCORD_LINK");
    }
  }, [rulesAccepted, regType, selectedTeamMembersData, eventDetails]);

  const handleDiscordConnect = useCallback(() => {
    let redirectPath = `${window.location.origin}${window.location.pathname}?id=${slug}&discord=connected&step=discord`;
    if (inviteToken) {
      redirectPath += `&invitation=${encodeURIComponent(inviteToken)}`;
    }
    const redirectUrl = encodeURIComponent(redirectPath);

    const url = `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/connect-discord/?session_token=${token}&tournament_id=${slug}&invite_token=${inviteToken}&redirect_url=${redirectUrl}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [slug, token, inviteToken]);

  const handleJoinedServer = useCallback(async () => {
    startJoinedTransition(async () => {
      try {
        const payload: any = { slug: slug, event_id: eventDetails?.event_id };

        // If team registration, include team and member info
        if (regType === "team" && userTeam) {
          payload.team_id = userTeam.team_id;
          payload.roster_member_ids = selectedMembers;
          payload.event_id = eventDetails?.event_id;
        }

        // Add invite token if present
        if (inviteToken) {
          payload.invite_token = inviteToken;
        }

        // Add sponsor IDs if required
        if (eventDetails?.is_sponsored) {
          if (regType === "team") {
            payload.sponsor_ids = teamSponsorUuids;
          } else {
            payload.sponsor_id = soloSponsorUuid;
          }
        }

        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/register-for-event/`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success(res.data.message);
        setModalStep("SUCCESS");

        // Refresh event details to update registration status
        await fetchEventDetails();
      } catch (error: any) {
        toast.error(error.response?.data?.message || "An error occurred");
      }
    });
  }, [
    slug,
    regType,
    userTeam,
    selectedMembers,
    token,
    fetchEventDetails,
    startJoinedTransition,
    inviteToken,
    teamSponsorUuids,
    soloSponsorUuid,
    eventDetails,
  ]);

  if (isLoading) return <FullLoader />;
  if (error || !eventDetails) return notFound();

  const formatText = `${eventDetails.event_mode.toUpperCase()} / ${eventDetails.competition_type.toUpperCase()}`;
  const participantText = `${formatMoneyInput(
    eventDetails.max_teams_or_players,
  )} ${
    eventDetails.participant_type.charAt(0).toUpperCase() +
    eventDetails.participant_type.slice(1)
  }s`;

  // Determine if user can register
  const canRegister = eventDetails.is_public || hasValidInvite;
  const registrationDisabledReason = !canRegister
    ? "Private event - invite required"
    : eventDetails.event_status !== "upcoming"
      ? "Registration Closed"
      : new Date() > new Date(eventDetails.registration_end_date)
        ? "Registration Closed"
        : null;

  const statusVariant: Record<
    string,
    "default" | "secondary" | "destructive" | "outline" | "pending"
  > = {
    approved: "default",
    registered: "secondary",
    disqualified: "destructive",
    withdrawn: "outline",
    left: "outline",
    pending: "pending",
    rejected: "destructive",
  };

  return (
    <div>
      <Card className="p-0 bg-transparent border-0">
        <PageHeader title={eventDetails.event_name} back />
        <div className="p-0 space-y-2">
          <Image
            src={eventDetails.event_banner_url || DEFAULT_IMAGE}
            alt={eventDetails.event_name || "Event Banner"}
            width={1000}
            height={1000}
            className="aspect-video size-full object-cover rounded-md"
          />
          {!eventDetails.is_public && (
            <div
              className={`flex items-center gap-2 p-3 rounded-md border ${
                inviteStatus?.is_used
                  ? "bg-red-500/10 border-red-500/30"
                  : "bg-yellow-500/10 border-yellow-500/30"
              }`}
            >
              <AlertTriangle
                className={`size-4 flex-shrink-0 ${
                  inviteStatus?.is_used ? "text-red-400" : "text-yellow-400"
                }`}
              />
              <div className="flex-1">
                <p
                  className={`text-sm font-semibold ${
                    inviteStatus?.is_used ? "text-red-400" : "text-yellow-400"
                  }`}
                >
                  Private Event
                </p>
                {isCheckingInvite && (
                  <p className="text-xs text-gray-300">
                    Validating invite link...
                  </p>
                )}
                {!isCheckingInvite && inviteStatus?.is_used && (
                  <div className="text-xs text-red-300 space-y-1">
                    <p>❌ This invite link has already been used.</p>
                    {inviteStatus.used_by && (
                      <p>Used by: {inviteStatus.used_by}</p>
                    )}
                    {inviteStatus.used_at && (
                      <p>
                        Used at:{" "}
                        {new Date(inviteStatus.used_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
                {!isCheckingInvite && !inviteToken && (
                  <p className="text-xs text-yellow-300">
                    You need an invite link to register for this event.
                  </p>
                )}
                {!isCheckingInvite &&
                  hasValidInvite &&
                  !inviteStatus?.is_used && (
                    <p className="text-xs text-green-300">
                      ✓ Valid invite detected - you can register!
                    </p>
                  )}
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <p>Date: {formatDate(eventDetails.start_date)}</p>
          <p>
            Prize Pool:{" "}
            {/^\d+(\.\d+)?$/.test(eventDetails.prizepool)
              ? `$${parseFloat(eventDetails.prizepool).toLocaleString()}`
              : eventDetails.prizepool}
          </p>
          <p>Location: Online</p>
          <p>Format: {formatText}</p>
        </div>
        <p className="text-sm">Participants: {participantText}</p>

        <CardContent style={{ padding: 0 }}>
          {eventDetails.stages?.length > 0 ? (
            <Tabs
              value={activeStageTab}
              onValueChange={setActiveStageTab}
              className="w-full"
            >
              <ScrollArea>
                <TabsList className="w-full">
                  {eventDetails.stages.map((stage) => (
                    <TabsTrigger
                      key={stage.stage_id}
                      value={stage.stage_name}
                      className="flex-1"
                    >
                      {stage.stage_name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              {eventDetails.stages.map((stage) => (
                <TabsContent
                  key={stage.stage_id}
                  value={stage.stage_name}
                  className="mt-4 animate-in fade-in slide-in-from-bottom-2"
                >
                  <StageResultsTable stage={stage} />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="p-10 text-center border-2 border-dashed border-zinc-900 rounded-2xl text-zinc-500">
              Tournament hasn't started yet. Results will appear here.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Personal rejection notice — visible to any registered team member */}
      {(() => {
        if (
          !eventDetails.is_registered ||
          eventDetails.participant_type !== "squad" ||
          pageRoster.length === 0 ||
          !user?.in_game_name
        )
          return null;
        const myEntry = pageRoster.find(
          (r) => r.username === user.in_game_name,
        );
        if (myEntry?.status !== "rejected") return null;
        return (
          <Alert className="mt-4 border-destructive/50 bg-destructive/10 text-destructive">
            <XCircle className="h-4 w-4" />
            <p className="text-red-100">
              Your registration has been{" "}
              <span className="font-semibold inline-block">rejected</span> for
              this tournament. Please contact your team creator to update your
              registration.
            </p>
          </Alert>
        );
      })()}

      {(eventDetails.participant_type === "squad"
        ? userTeam?.team_owner === user?.in_game_name
        : true) && (
        <div className="text-center mt-6 space-y-2">
          {/* Captain-level roster rejection notice */}
          {(() => {
            if (
              !eventDetails.is_registered ||
              eventDetails.participant_type !== "squad" ||
              pageRoster.length === 0
            )
              return null;
            const rejected = pageRoster.filter((r) => r.status === "rejected");
            if (rejected.length === 0) return null;
            const allRejected = rejected.length === pageRoster.length;
            return (
              <Alert className="border-destructive/50 bg-destructive/10 text-destructive text-left">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  {allRejected ? (
                    <>
                      <strong>All players</strong> on your registered roster
                      have been rejected. Update your roster to continue.
                    </>
                  ) : (
                    <p>
                      <strong>
                        {rejected.length}{" "}
                        {rejected.length === 1 ? "player" : "players"}
                      </strong>{" "}
                      <span>on your roster </span>
                      <span>
                        {rejected.length === 1 ? "has" : "have"} been rejected
                      </span>
                      <span>
                        ({rejected.map((r) => r.username).join(", ")}
                        ). Open <em>Edit Registration</em> to update your
                        roster.
                      </span>
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            );
          })()}

          {eventDetails.is_registered ? (
            <div className="flex flex-col md:flex-row items-start justify-center md:items-center gap-2">
              <Button disabled className="w-full md:w-auto">
                You've registered already
              </Button>

              {/* Show Edit and Leave buttons only if event hasn't started */}
              {new Date(eventDetails.start_date) > new Date() && (
                <>
                  {eventDetails.participant_type === "squad" && (
                    <EditRosterModal
                      eventDetails={eventDetails}
                      userTeam={userTeam}
                      token={token}
                      onSuccess={fetchEventDetails}
                    />
                  )}
                  <LeaveEventModal
                    eventId={eventDetails.event_id}
                    eventName={eventDetails.event_name}
                    onSuccess={() => {
                      fetchEventDetails();
                      toast.info("You have left the tournament");
                    }}
                  />
                </>
              )}
            </div>
          ) : eventDetails.event_type === "external" ? (
            <Button
              onClick={() =>
                requireAuth(() =>
                  window.open(eventDetails.registration_link, "_blank"),
                )
              }
              disabled={eventDetails.event_status !== "upcoming"}
              className="w-full"
            >
              {eventDetails.event_status === "upcoming"
                ? "Register (External Link)"
                : "Registration Closed"}
            </Button>
          ) : (
            <Button
              onClick={() => requireAuth(handleRegisterClick)}
              disabled={
                !!registrationDisabledReason ||
                isCheckingInvite ||
                (inviteStatus?.is_used && !eventDetails.is_public)
              }
              className="w-full"
            >
              {isCheckingInvite
                ? "Validating invite..."
                : inviteStatus?.is_used && !eventDetails.is_public
                  ? "Invite Already Used"
                  : registrationDisabledReason || "Register for Tournament"}
            </Button>
          )}
        </div>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-start gap-2">
            {eventDetails.participant_type === "squad" ? (
              <>
                <IconUsersGroup />
                Registered Teams
              </>
            ) : (
              <>
                <IconUsers />
                Registered Participants
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center grid grid-cols-2 gap-2">
            {eventDetails.participant_type === "squad" && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center gap-2">
                  <p className="font-semibold text-lg md:text-2xl">
                    {eventDetails.tournament_teams.length || 0}
                  </p>
                  <p className="text-xs md:text-sm">Total Teams</p>
                </CardContent>
              </Card>
            )}
            {eventDetails.participant_type === "solo" && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center gap-2">
                  <p className="font-semibold text-lg md:text-2xl">
                    {eventDetails?.registered_competitors?.length || 0}
                  </p>
                  <p className="text-xs md:text-sm">Players</p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2">
                <p className="font-semibold text-lg md:text-2xl">
                  {formatMoneyInput(
                    eventDetails?.max_teams_or_players -
                      (eventDetails?.registered_competitors?.length ||
                        eventDetails?.tournament_teams?.length ||
                        0),
                  )}
                </p>
                <p className="text-xs md:text-sm">Slot left</p>
              </CardContent>
            </Card>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-auto custom-scroll">
            {eventDetails.participant_type === "solo" &&
              eventDetails?.registered_competitors?.map(
                (reg: any, index: number) => (
                  <Card key={`competitor-${reg.id || index}`}>
                    <CardContent className="flex items-center justify-between gap-2">
                      <div className="flex items-center justify-start gap-2">
                        <div className="px-4 py-2 rounded-full bg-primary text-white font-semibold text-base">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-white font-semibold text-base">
                            {reg.username}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className="capitalize"
                        variant={statusVariant[reg.status]}
                      >
                        {reg.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ),
              )}
            {eventDetails.participant_type === "squad" &&
              eventDetails?.tournament_teams?.map(
                (team: any, index: number) => (
                  <Card key={`competitor-${team.id || index}`}>
                    <CardContent className="flex items-center justify-between gap-2">
                      <div className="flex items-center justify-start gap-2">
                        <div className="px-4 py-2 rounded-full bg-primary text-white font-semibold text-base">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-white font-semibold text-base">
                            {team.team_name}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className="capitalize"
                        variant={statusVariant[team.status]}
                      >
                        {team.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ),
              )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-2">
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-xl mb-3">Rules</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const textRules = eventDetails.event_rules;
              const documentUrl = (eventDetails as any).uploaded_rules_url;
              const hasDocument = documentUrl && documentUrl.startsWith("http");
              const hasTextRules = !!textRules;

              if (hasTextRules) {
                return (
                  <p className="text-sm whitespace-pre-wrap">{textRules}</p>
                );
              } else if (hasDocument) {
                return (
                  <div className="flex flex-col items-start space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Official rules are provided as a downloadable document.
                    </p>
                    <Button
                      type="button"
                      variant="default"
                      onClick={() => window.open(documentUrl, "_blank")}
                      className="w-full"
                    >
                      Download Rules Document
                    </Button>
                  </div>
                );
              } else {
                return (
                  <p className="text-sm text-gray-500">
                    Rules document pending.
                  </p>
                );
              }
            })()}
          </CardContent>
        </Card>

        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-xl mb-3">Prize Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {Object.entries(eventDetails.prize_distribution)?.map(
                ([place, prize]) => (
                  <li key={place}>
                    {place.toUpperCase()}: {prize.toLocaleString()}
                  </li>
                ),
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Banned Modal */}
      <Dialog open={showBannedModal} onOpenChange={setShowBannedModal}>
        <DialogContent className="sm:max-w-[400px] max-h-[85vh] overflow-y-auto">
          <div className="text-center">
            <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-red-600" />
            </div>
            <DialogTitle className="text-xl">Registration Blocked</DialogTitle>
            <DialogDescription className="mt-2 text-base">
              {eventDetails.participant_type === "squad"
                ? "Your team is banned and cannot participate in this event."
                : "Your account is banned and you cannot participate in this event."}
            </DialogDescription>
            <Button
              className="mt-6 w-full"
              onClick={() => setShowBannedModal(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Team Registration Modals */}
      {loadingTeam ? (
        <Dialog open={true}>
          <DialogContent>
            <div className="flex items-center justify-center p-8">
              <Loader text="Loading team data..." />
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <TeamRegistrationModals
          teamModalStep={teamModalStep}
          setTeamModalStep={setTeamModalStep}
          userTeam={userTeam}
          selectedMembers={selectedMembers}
          setSelectedMembers={setSelectedMembers}
          eventDetails={eventDetails}
          onContinueToRules={handleTeamContinueToRules}
        />
      )}

      {/* Solo Registration Modals */}
      <RegistrationModals
        eventDetails={{
          ...eventDetails,
          selectedTeamMembers: selectedTeamMembersData,
          validationResults: validationResults,
        }}
        modalStep={modalStep}
        setModalStep={setModalStep}
        handleSelectType={handleSelectType}
        rulesAccepted={rulesAccepted}
        setRulesAccepted={setRulesAccepted}
        handleRulesContinue={handleRulesContinue}
        handleDiscordConnect={handleDiscordConnect}
        handleJoinedServer={handleJoinedServer}
        pendingJoined={pendingJoined}
        isDiscordConnected={discordConnected}
        regType={regType}
        onCheckDiscordStatus={checkTeamDiscordStatus}
        isCheckingDiscord={isCheckingDiscord}
        isCheckingUserDiscord={isCheckingUserDiscord}
        isInAfcServer={isInAfcServer}
        checkUserDiscordStatus={checkUserDiscordStatus}
        copyAfcServerLink={copyAfcServerLink}
        teamAfcServerStatus={teamAfcServerStatus}
        soloSponsorUuid={soloSponsorUuid}
        setSoloSponsorUuid={setSoloSponsorUuid}
        teamSponsorUuids={teamSponsorUuids}
        setTeamSponsorUuids={setTeamSponsorUuids}
      />
    </div>
  );
};
