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
import { IconUsers } from "@tabler/icons-react";
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
  | "SUCCESS";
type RegistrationType = "solo" | "team";

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

const StageResultsTable: React.FC<{ stage: Stage }> = ({ stage }) => {
  // Initialize with first group's ID
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    stage?.groups?.[0]?.group_id?.toString() || ""
  );
  const [selectedMatchId, setSelectedMatchId] = useState<string>("overall");

  // Find active group
  const activeGroup = useMemo(() => {
    if (!stage?.groups || !selectedGroupId) return null;
    return stage.groups.find(
      (g) => g?.group_id?.toString() === selectedGroupId
    );
  }, [stage.groups, selectedGroupId]);

  // Find active match
  const activeMatch = useMemo(() => {
    if (selectedMatchId === "overall" || !activeGroup?.matches) return null;
    return activeGroup.matches.find(
      (m: any) => m?.match_id?.toString() === selectedMatchId
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

interface ModalProps {
  eventDetails: EventDetails;
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
}) => {
  const isSoloDisabled = eventDetails.participant_type === "squad";
  const isTeamDisabled = eventDetails.participant_type === "solo";
  const closeAll = () => setModalStep("CLOSED");

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
            <div className="p-4 bg-primary/10 rounded-md text-sm space-y-2">
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
            </div>
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
                onClick={() => !isSoloDisabled && setModalStep("INFO")}
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
                className={`cursor-pointer transition ${
                  isTeamDisabled
                    ? "bg-white opacity-50"
                    : "bg-white hover:bg-white/90 opacity-50"
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
                    "noopener,noreferrer"
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

type Params = Promise<{ id: string }>;

const EventDetailPage = ({ params }: { params: Params }) => {
  const { id } = use(params);
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
            searchParams.get("message") || "Discord connection failed."
          );
        }

        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.delete("discord");
        newSearchParams.delete("step");
        router.replace(
          `${window.location.pathname}?${newSearchParams.toString()}`,
          { scroll: false }
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
          body: JSON.stringify({ event_id: id }),
        }
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
  }, [id, token]);

  useEffect(() => {
    if (id && token) {
      fetchEventDetails();
    }
  }, [fetchEventDetails, id, token]);

  if (isLoading) return <FullLoader />;
  if (error || !eventDetails) return notFound();

  const handleRegisterClick = () => setModalStep("TYPE");
  const handleSelectType = (type: RegistrationType) => {
    setRegType(type);
    setModalStep("RULES");
  };
  const handleRulesContinue = () => {
    if (rulesAccepted) {
      setModalStep(discordConnected ? "DISCORD_JOIN" : "DISCORD_LINK");
    }
  };
  const handleDiscordConnect = () => {
    const redirectUrl = encodeURIComponent(
      `${window.location.origin}${window.location.pathname}?id=${id}&discord=connected&step=discord`
    );
    const url = `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/connect-discord/?session_token=${token}&tournament_id=${id}&redirect_url=${redirectUrl}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };
  const handleJoinedServer = async () => {
    startJoinedTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/register-for-event/`,
          { event_id: id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success(res.data.message);
        setModalStep("SUCCESS");
      } catch (error: any) {
        toast.error(error.response?.data?.message || "An error occurred");
      }
    });
  };

  const formatText = `${eventDetails.event_mode.toUpperCase()} / ${eventDetails.competition_type.toUpperCase()}`;
  const participantText = `${formatMoneyInput(
    eventDetails.max_teams_or_players
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
            Prize Pool: ${parseFloat(eventDetails.prizepool).toLocaleString()}
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
        {!eventDetails?.is_registered ? (
          <Button disabled>You've registered already</Button>
        ) : eventDetails.event_type === "external" ? (
          <Button
            onClick={() =>
              window.open(eventDetails?.registration_link, "_blank")
            }
            disabled={
              eventDetails.event_status !== "upcoming" ||
              !eventDetails.is_registered
            }
          >
            {eventDetails.event_status === "upcoming"
              ? "Register (External Link)"
              : "Registration Closed"}
          </Button>
        ) : (
          <Button
            onClick={handleRegisterClick}
            disabled={
              eventDetails?.event_status !== "upcoming" ||
              !eventDetails?.is_registered ||
              new Date(eventDetails?.registration_end_date) < new Date()
            }
          >
            {new Date(eventDetails?.registration_end_date) < new Date()
              ? "Registration closed"
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
                      (eventDetails?.registered_competitors?.length || 0)
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
              )
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
                )
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <RegistrationModals
        eventDetails={eventDetails}
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
      />
    </div>
  );
};

export default EventDetailPage;
