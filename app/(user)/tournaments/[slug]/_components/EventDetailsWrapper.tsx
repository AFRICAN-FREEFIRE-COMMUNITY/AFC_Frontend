"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  use,
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
import { CheckCircle, Users, AlertTriangle, User, Trophy } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate, formatMoneyInput } from "@/lib/utils";
import { toast } from "sonner";
import { FullLoader, Loader } from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { AFC_DISCORD_SERVER, DEFAULT_IMAGE } from "@/constants";
import axios from "axios";
import Image from "next/image";
import { IconRefresh, IconUsers } from "@tabler/icons-react";
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

type ModalStep =
  | "CLOSED"
  | "INFO"
  | "TYPE"
  | "RULES"
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
  event_status: string;
  registration_link: string;
  tournament_tier: string;
  stream_channels: string[];
  stages: Stage[];
  event_banner_url: string | null;
  uploaded_rules_url: string | null;
  is_registered: boolean;
}

interface ApiResponse {
  event_details: EventDetails;
}

interface TeamMember {
  id: string;
  username: string;
  is_verified: boolean;
  discord_connected: boolean;
  discord_username?: string;
}

interface UserTeam {
  team_id: string;
  team_name: string;
  members: TeamMember[];
  min_players?: number;
  max_players?: number;
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
  const minPlayers = userTeam?.min_players || 1;
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
      <DialogContent>
        {teamModalStep === "SELECT_MEMBERS" && (
          <>
            <DialogHeader>
              <DialogTitle>Select Team Members</DialogTitle>
              <DialogDescription>
                Select {minPlayers}-{maxPlayers} players from your team roster
              </DialogDescription>
            </DialogHeader>

            <DialogContent className="max-h-[80vh] p-4 bg-primary/10 rounded-md">
              <h3 className="font-semibold mb-3">Available Players:</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
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
                    <Badge
                      variant={member.is_verified ? "default" : "secondary"}
                    >
                      {member.is_verified ? "Verified" : "Not Verified"}
                    </Badge>
                  </div>
                ))}
              </div>
            </DialogContent>

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

            <div className="p-4 bg-primary/10 rounded-md space-y-3">
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
  isCheckingDiscord?: boolean;
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
}) => {
  const isSoloDisabled = eventDetails.participant_type === "squad";
  const isTeamDisabled = eventDetails.participant_type === "solo";
  const closeAll = () => setModalStep("CLOSED");

  // Poll Discord status for team members
  useEffect(() => {
    if (modalStep === "DISCORD_STATUS" && onCheckDiscordStatus) {
      // Initial check
      onCheckDiscordStatus();

      // Poll every 5 seconds
      const interval = setInterval(() => {
        onCheckDiscordStatus();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [modalStep, onCheckDiscordStatus]);

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
            <DialogContent className="p-4 bg-primary/10 rounded-md text-sm space-y-2">
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
              <Separator className="bg-gray-700 my-3" />
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
            </DialogContent>
            <DialogFooter className="mt-4 flex sm:justify-between">
              <Button variant="secondary" onClick={() => setModalStep("TYPE")}>
                Back
              </Button>
              <Button onClick={() => setModalStep("RULES")}>Continue</Button>
            </DialogFooter>
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
                  <p className="whitespace-pre-wrap">{textRules}</p>
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
                <p>Maintain professional conduct at all times.</p>
              </div>
              <div>
                <p className="font-medium text-primary">Device Policy:</p>
                <p>Device must remain consistent throughout the tournament.</p>
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
                className="text-sm font-medium text-gray-300"
              >
                I agree to all tournament rules and policies.
              </label>
            </div>
            <DialogFooter className="mt-2 flex sm:justify-between">
              <Button variant="secondary" onClick={() => setModalStep("INFO")}>
                Back
              </Button>
              <Button onClick={handleRulesContinue} disabled={!rulesAccepted}>
                Continue to Discord
              </Button>
            </DialogFooter>
          </>
        );

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
              {isDiscordConnected ? (
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
                disabled={!isDiscordConnected}
              >
                Continue to Final Step
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
              <p className="text-sm text-gray-300">
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

      case "DISCORD_STATUS":
        const validationResults = eventDetails.validationResults || [];
        const allMembersOk =
          validationResults.length > 0 &&
          validationResults.every((r: any) => r.ok);

        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                Connect Discord - All Members
              </DialogTitle>
              <DialogDescription>
                All team members must have Discord linked
              </DialogDescription>
            </DialogHeader>

            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col rounded-md">
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">
                    Team Members Status:
                  </h3>
                  <div className="space-y-2">
                    {validationResults.map((result: any) => {
                      const hasIssues = !result.ok;
                      const reasons = result.reasons || [];

                      return (
                        <div
                          key={result.user_id}
                          className={`p-3 rounded-md border transition-all ${
                            result.ok
                              ? "border-green-500/50 bg-green-500/10"
                              : "border-red-500/50 bg-red-500/10"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1">
                              {result.ok ? (
                                <CheckCircle className="size-4 text-green-400 flex-shrink-0 mt-0.5" />
                              ) : (
                                <AlertTriangle className="size-4 text-red-400 flex-shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1">
                                <span
                                  className={`font-medium ${
                                    result.ok
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
                                {result.discord_connected &&
                                  result.discord_id && (
                                    <p className="text-xs text-gray-400 mt-1">
                                      Discord ID: {result.discord_id}
                                    </p>
                                  )}
                              </div>
                            </div>
                            {result.ok && (
                              <CheckCircle className="size-5 text-green-400 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {isCheckingDiscord && (
                  <div className="p-3 bg-blue-900/30 border border-blue-600/50 rounded-md">
                    <p className="text-sm text-blue-400 text-center">
                      Checking Discord status...
                    </p>
                  </div>
                )}

                {!allMembersOk &&
                  !isCheckingDiscord &&
                  validationResults.length > 0 && (
                    <div className="p-3 bg-yellow-900/30 border border-yellow-600/50 rounded-md">
                      <p className="text-sm text-yellow-400 text-center">
                        Waiting for all team members to link their Discord
                        accounts and join the server...
                      </p>
                    </div>
                  )}

                {allMembersOk && (
                  <div className="p-3 bg-green-900/30 border border-green-600/50 rounded-md">
                    <p className="text-sm text-green-400 text-center font-medium">
                      All team members are ready! You can proceed.
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
                {allMembersOk && (
                  <Button onClick={() => setModalStep("DISCORD_JOIN")}>
                    Continue to Join Server
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
      <DialogContent>{renderDialog()}</DialogContent>
    </Dialog>
  );
};

export const EventDetailsWrapper = ({ slug }: { slug: string }) => {
  const { token } = useAuth();
  const router = useRouter();
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

  const checkTeamDiscordStatus = useCallback(async () => {
    if (!eventDetails || !userTeam || selectedMembers.length === 0) return;

    setIsCheckingDiscord(true);
    try {
      const memberIds = selectedMembers.map((id) => parseInt(id));

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

      if (response.data.all_ok) {
        toast.success("All team members are verified!");
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

  // Define checkTeamDiscordStatus early, before any conditional logic
  // const checkTeamDiscordStatus = useCallback(async () => {
  //   if (!userTeam || selectedMembers.length === 0) return;

  //   try {
  //     // Fetch updated team data to check Discord status
  //     const resCurrent = await axios.post(
  //       `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-user-current-team/`,
  //       {},
  //       {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //         },
  //       },
  //     );

  //     if (resCurrent.data && resCurrent.data.team) {
  //       const updatedTeam = resCurrent.data.team;

  //       // Update selected members data with latest Discord status
  //       const updatedMembersData = updatedTeam.members.filter((m: TeamMember) =>
  //         selectedMembers.includes(m.id),
  //       );

  //       setSelectedTeamMembersData(updatedMembersData);

  //       // Check if all selected members have Discord connected
  //       const allConnected = updatedMembersData.every(
  //         (m: TeamMember) => m.discord_connected,
  //       );

  //       if (allConnected) {
  //         toast.success("All team members have connected Discord!");
  //         setModalStep("DISCORD_JOIN");
  //       }
  //     }
  //   } catch (err) {
  //     console.error("Error checking Discord status:", err);
  //   }
  // }, [userTeam, selectedMembers, token]);

  useEffect(() => {
    const discordStatus = searchParams.get("discord");

    if (discordStatus) {
      setModalStep("DISCORD_LINK");
      setTimeout(() => {
        if (discordStatus === "connected") {
          setDiscordConnected(true);
          setModalStep("DISCORD_JOIN");
          toast.success("Discord account linked successfully!");
        } else {
          setDiscordConnected(false);
          toast.error(
            searchParams.get("message") || "Discord connection failed.",
          );
        }

        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.delete("discord");
        newSearchParams.delete("step");
        router.replace(
          `${window.location.pathname}?${newSearchParams.toString()}`,
          { scroll: false },
        );
      }, 50);
    }
  }, [searchParams, router]);

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

  useEffect(() => {
    if (slug && token) {
      fetchEventDetails();
    }
  }, [fetchEventDetails, slug, token]);

  // Handler functions (defined after all hooks and before early returns would cause issues)
  // But we need to define these AFTER hooks but BEFORE the early return
  const handleRegisterClick = useCallback(() => setModalStep("TYPE"), []);

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
    if (rulesAccepted) {
      // For team registration, check Discord status of all members
      if (regType === "team" && selectedTeamMembersData.length > 0) {
        setModalStep("DISCORD_STATUS");
      } else {
        // For solo registration
        setModalStep(discordConnected ? "DISCORD_JOIN" : "DISCORD_LINK");
      }
    }
  }, [rulesAccepted, regType, selectedTeamMembersData, discordConnected]);

  const handleDiscordConnect = useCallback(() => {
    const redirectUrl = encodeURIComponent(
      `${window.location.origin}${window.location.pathname}?id=${slug}&discord=connected&step=discord`,
    );
    const url = `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/connect-discord/?session_token=${token}&tournament_id=${slug}&redirect_url=${redirectUrl}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [slug, token]);

  const handleJoinedServer = useCallback(async () => {
    startJoinedTransition(async () => {
      try {
        const payload: any = { slug: slug };

        // If team registration, include team and member info
        if (regType === "team" && userTeam) {
          payload.team_id = userTeam.team_id;
          payload.member_ids = selectedMembers;
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

  return (
    <div>
      <CardHeader className="space-y-1">
        <PageHeader title={eventDetails.event_name} back />
        <div className="space-y-2">
          <Image
            src={eventDetails.event_banner_url || DEFAULT_IMAGE}
            alt={eventDetails.event_name || "Event Banner"}
            width={1000}
            height={1000}
            className="aspect-video size-full object-cover rounded-md"
          />
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
        <p>Participants: {participantText}</p>
      </CardHeader>

      <CardContent className="pt-4">
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

      <div className="text-center mt-6">
        {eventDetails.is_registered ? (
          <Button disabled>You've registered already</Button>
        ) : eventDetails.event_type === "external" ? (
          <Button
            onClick={() =>
              window.open(eventDetails.registration_link, "_blank")
            }
            disabled={eventDetails.event_status !== "upcoming"}
          >
            {eventDetails.event_status === "upcoming"
              ? "Register (External Link)"
              : "Registration Closed"}
          </Button>
        ) : (
          <Button
            onClick={handleRegisterClick}
            disabled={
              eventDetails.event_status !== "upcoming" ||
              new Date() > new Date(eventDetails.registration_end_date)
            }
          >
            {new Date() > new Date(eventDetails.registration_end_date)
              ? "Registration Closed"
              : "Register for Tournament"}
          </Button>
        )}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-start gap-2">
            <IconUsers />
            Registered Participants
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center grid grid-cols-3 gap-2">
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2">
                <p className="font-semibold text-lg md:text-2xl">0</p>
                <p className="text-xs md:text-sm">Total Teams</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2">
                <p className="font-semibold text-lg md:text-2xl">
                  {eventDetails?.registered_competitors?.length || 0}
                </p>
                <p className="text-xs md:text-sm">Players</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2">
                <p className="font-semibold text-lg md:text-2xl">
                  {formatMoneyInput(
                    eventDetails?.max_teams_or_players -
                      (eventDetails?.registered_competitors?.length || 0),
                  )}
                </p>
                <p className="text-xs md:text-sm">Slot left</p>
              </CardContent>
            </Card>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-auto custom-scroll">
            {eventDetails?.registered_competitors?.map(
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
                        <p className="font-white text-xs capitalize">
                          {reg.status}
                        </p>
                      </div>
                    </div>
                    <Badge>Confirmed</Badge>
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
                    {place.toUpperCase()}: ${prize.toLocaleString()}
                  </li>
                ),
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

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
      />
    </div>
  );
};
