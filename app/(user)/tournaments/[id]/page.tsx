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
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Users,
  AlertTriangle,
  User,
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

// --- Types for API Response ---

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
  id: number;
  group_name: string;
  playing_date: string;
  playing_time: string;
  teams_qualifying: number;
}

interface Stage {
  id: number;
  stage_name: string;
  start_date: string;
  end_date: string;
  number_of_groups: number;
  stage_format: string;
  teams_qualifying_from_stage: number;
  groups: StageGroup[];
}

interface EventDetails {
  event_id: number;
  competition_type: string;
  participant_type: string;
  registered_competitors: any;
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

// --- Mock Data for Stage Results Table (to match image) ---
const MOCK_RESULTS_DATA = [
  {
    rank: 1,
    team: "Team 1",
    kill_points: 50,
    placement_points: 50,
    total_points: 100,
  },
  {
    rank: 2,
    team: "Team 2",
    kill_points: 45,
    placement_points: 45,
    total_points: 90,
  },
];

const StageResultsTable: React.FC<{ stage: Stage }> = ({ stage }) => {
  const [isDatesVisible, setIsDatesVisible] = useState(true);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {stage.stage_name} - {stage.stage_format.toUpperCase()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="flex items-center justify-between cursor-pointer text-base font-semibold hover:text-primary"
          onClick={() => setIsDatesVisible(!isDatesVisible)}
        >
          View Stage Dates
          {isDatesVisible ? (
            <ChevronUp className="w-4 h-4 ml-1" />
          ) : (
            <ChevronDown className="w-4 h-4 ml-1" />
          )}
        </div>

        {isDatesVisible && (
          <div className="space-y-4 text-sm text-muted-foreground mt-2">
            <p>Stage Start: {formatDate(stage.start_date)}</p>
            <p>Stage End: {formatDate(stage.end_date)}</p>
          </div>
        )}
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

  // Renders the appropriate dialog based on the current modalStep
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
                    Players without Discord OAUTH cannot be seeded or placed
                    into groups.
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
                // Team registration is disabled for this flow
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
                  There are no embedded text rules. Please click the button
                  below to download and review the official document.
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
                admins for clarification.
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
                <p>
                  Maintain professional conduct at all times. Harassment or
                  toxicity will result in disqualification.
                </p>
              </div>
              <div>
                <p className="font-medium text-primary">Device Policy:</p>
                <p>
                  The device you use must remain consistent throughout the
                  tournament.
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
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-300"
              >
                I agree to the tournament rules, conduct policies, device
                policies, and participation requirements.
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
                // Successfully connected, just need to proceed
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
                // Needs to connect
                <div className="space-y-4">
                  <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto" />
                  <p className="text-sm text-gray-300">
                    Your Discord account is not yet linked. Click below to open
                    the authentication window and link your account.
                  </p>
                  <Button onClick={handleDiscordConnect} className="w-full">
                    Connect Discord Account
                  </Button>
                  <p className="text-xs text-primary pt-2">
                    After connecting, this page will reload. If successful, you
                    will automatically advance.
                  </p>
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
                You must join the AFC Discord server to complete your
                registration and receive match details.
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
              <p className="text-xs text-gray-400 pt-2">
                After joining, click the button below to confirm your
                registration.
              </p>
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
                  <Loader text="Completing Registration..." />
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
                Welcome to the tournament! You'll receive match details in the
                AFC Discord server.
              </p>
              <p className="text-xs text-muted-foreground">
                Your registration is complete. Check your Discord for further
                instructions.
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

type Params = Promise<{
  id: string;
}>;

// --- Main Component ---
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
    const intendedStep = searchParams.get("step");

    // Only run if we detect a Discord status AND it came from our registration flow
    if (discordStatus) {
      // 1. Force the modal open to the starting point of the check
      setModalStep("DISCORD_LINK");

      // Use a small delay to ensure the modal container has rendered
      // before attempting the final step transition.
      setTimeout(() => {
        if (discordStatus === "connected") {
          // Success detected: Set connected state, show success, and advance
          setDiscordConnected(true);
          setModalStep("DISCORD_JOIN"); // <-- ADVANCE TO NEXT STEP
          toast.success(
            "Discord account linked successfully! Please join the server to complete registration."
          );
        } else {
          // Error detected: Show error toast and stay on DISCORD_LINK
          setDiscordConnected(false);
          const errorMsg =
            searchParams.get("message") ||
            "Discord connection failed. Please try again.";
          toast.error(errorMsg);
          // Modal stays on DISCORD_LINK for retry
        }

        // 2. Clean up the URL (This is crucial for preventing repeated execution on refresh)
        // We use replace to update the URL without adding a new history entry.
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.delete("discord");
        newSearchParams.delete("step");
        // router.replace is preferred for cleaning params
        router.replace(
          `${window.location.pathname}?${newSearchParams.toString()}`,
          { scroll: false }
        );
      }, 50); // Small delay for state consistency
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse = await response.json();
      const details = result.event_details;

      setEventDetails(details);

      if (details.stages.length > 0) {
        setActiveStageTab(details.stages[0].stage_name);
      }
    } catch (err) {
      toast.error("Failed to load event details");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchEventDetails();
    }
  }, [fetchEventDetails, id]);

  // --- NEW LOGIC: Check URL for Discord Connection Status ---
  useEffect(() => {
    const discordStatus = searchParams.get("discord");
    const intendedStep = searchParams.get("step");

    // Only proceed if we have a connection status AND it came from the registration flow
    if (discordStatus && intendedStep === "discord") {
      // We must make sure the modal is open before proceeding.
      // Set the base step (DISCORD_LINK) so the modal context can render,
      // then immediately check the status and advance/error.
      setModalStep("DISCORD_LINK");

      // Timeout is used to ensure the modal state has rendered before the final move/toast
      // This is often needed when changing multiple states involving complex UI transitions.
      setTimeout(() => {
        if (discordStatus === "connected") {
          // 1. Success detected: Set the connected state, show success, and advance
          setDiscordConnected(true);
          setModalStep("DISCORD_JOIN"); // <-- ADVANCE TO NEXT STEP
          toast.success(
            "Discord account linked successfully! Please join the server to complete registration."
          );
        } else {
          // 2. Error detected: Show error toast and stay on DISCORD_LINK
          setDiscordConnected(false);
          const errorMsg =
            searchParams.get("message") ||
            "Discord connection failed. Please try again.";
          toast.error(errorMsg);
          setModalStep("DISCORD_LINK"); // <-- STAY ON CURRENT STEP
        }

        // 3. Clean up the URL (important to use `replace` to avoid breaking the Back button)
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.delete("discord");
        newSearchParams.delete("step");
        // Important: Replace history without reloading the page
        router.replace(
          `${window.location.pathname}?${newSearchParams.toString()}`,
          { scroll: false }
        );
      }, 50); // Small delay for state consistency
    }
  }, [searchParams, router]);
  // --- END NEW LOGIC ---

  // Handle Loading and Error states
  if (isLoading) return <FullLoader />;

  if (error || !eventDetails) {
    return notFound();
  }

  // --- Event Handlers ---

  const handleRegisterClick = () => {
    setModalStep("TYPE");
  };

  const handleSelectType = (type: RegistrationType) => {
    setRegType(type);
    setModalStep("RULES");
  };

  const handleRulesContinue = () => {
    if (rulesAccepted) {
      // If Discord is already connected, skip DISCORD_LINK step
      if (discordConnected) {
        setModalStep("DISCORD_JOIN");
      } else {
        setModalStep("DISCORD_LINK");
      }
    }
  };

  const handleDiscordConnect = () => {
    // The redirect URL needs to include the parameters the server will echo back
    const redirectUrl = encodeURIComponent(
      `${window.location.origin}${window.location.pathname}?id=${id}&discord=connected&step=discord`
    );

    // Construct the URL for the server to initiate OAuth
    const url = `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/connect-discord/?session_token=${token}&tournament_id=${id}&redirect_url=${redirectUrl}`;

    // Open Discord auth URL in a new tab/window
    window.open(url, "_blank", "noopener,noreferrer");

    // CRITICAL CHANGE: We do NOT set state or move the modal here.
    // The modal transition is handled by the useEffect above once the URL changes (due to server redirect).
  };

  const handleJoinedServer = async () => {
    startJoinedTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/register-for-event/`,
          {
            event_id: id,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        toast.success(res.data.message);
        setModalStep("SUCCESS");
      } catch (error: any) {
        toast.error(error.response.data.message || "Oops! An error occurred");
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
      <Card>
        <CardHeader className="space-y-2">
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
          <p className="text-xs md:text-sm">Participants: {participantText}</p>
        </CardHeader>
        <CardContent>
          {eventDetails.stages.length > 0 ? (
            <Tabs
              value={activeStageTab}
              onValueChange={setActiveStageTab}
              className="w-full"
            >
              <ScrollArea>
                <TabsList className="w-full">
                  {eventDetails.stages.map((stage) => (
                    <TabsTrigger
                      key={stage.id}
                      value={stage.stage_name}
                      className="data-[state=active]:bg-gray-700 data-[state=active]:text-white data-[state=inactive]:"
                    >
                      {stage.stage_name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
              {eventDetails.stages.map((stage) => (
                <TabsContent key={stage.id} value={stage.stage_name}>
                  <StageResultsTable stage={stage} />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <p className="text-center text-gray-500">
              No stages or results defined for this event yet.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="text-center mt-6">
        {!eventDetails.is_registered ? (
          <Button disabled>You've registered already</Button>
        ) : eventDetails.event_type === "external" ? (
          <Button
            onClick={() =>
              window.open(eventDetails.registration_link, "_blank")
            }
            disabled={
              eventDetails.event_status !== "upcoming" ||
              eventDetails.is_registered
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
              eventDetails.event_status !== "upcoming" ||
              !eventDetails.is_registered ||
              new Date(eventDetails.registration_end_date) < new Date()
            }
          >
            {new Date(eventDetails.registration_end_date) < new Date()
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
                  {eventDetails.registered_competitors.length}
                </p>
                <p className="text-xs md:text-sm">Players</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2">
                <p className="font-semibold text-lg md:text-2xl">
                  {formatMoneyInput(
                    eventDetails.max_teams_or_players -
                      eventDetails.registered_competitors.length
                  )}
                </p>
                <p className="text-xs md:text-sm">Slot left</p>
              </CardContent>
            </Card>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-auto custom-scroll">
            {eventDetails.registered_competitors.map((reg: any, index: any) => (
              <Card key={index}>
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
            ))}
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
                    Rules document pending. Please check back later.
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
              {Object.entries(eventDetails.prize_distribution).map(
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

      {/* --- Registration Modals --- */}
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
