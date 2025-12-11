"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  use,
  useTransition,
} from "react";
import { notFound, useRouter } from "next/navigation"; // Assuming you are using Next.js 13+ router
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
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Users,
  AlertTriangle,
  User,
} from "lucide-react";
import { Separator } from "@/components/ui/separator"; // Assuming you have a Separator component
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
import { ComingSoon } from "@/components/ComingSoon";
import Image from "next/image";

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
  // NOTE: Results data is typically fetched separately,
  // but we'll use mock data for the table rendering based on the image.
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
  // Assuming 'location' and 'format' from the image can be inferred or added.
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
  // Add more rows as needed
];

// --- Sub-Components ---

/**
 * Renders the results table for a stage (matching the image design).
 * In a real app, this would fetch results data based on stage/group IDs.
 */
const StageResultsTable: React.FC<{ stage: Stage }> = ({ stage }) => {
  const [isDatesVisible, setIsDatesVisible] = useState(true);

  // In a real application, you'd likely map over groups here to show results per group.
  // For the sake of matching the image's single table view, we simplify.

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {stage.stage_name} - {stage.stage_format.toUpperCase()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* View Stage Dates Toggle */}
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

        {/* Results Table - Matches the image layout */}
        <div className="overflow-x-auto mt-4">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="">
              <tr>
                {[
                  "Rank",
                  "Team",
                  "Kill Points",
                  "Placement Points",
                  "Total Points",
                ].map((header) => (
                  <th
                    key={header}
                    className="px-6 py-3 text-left truncate text-xs font-medium tracking-wider"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-background divide-y divide-gray-700 relative">
              <ComingSoon />
              {MOCK_RESULTS_DATA.map((result) => (
                <tr key={result.rank} className="hover:">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    {result.rank}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {result.team}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {result.kill_points}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {result.placement_points}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-primary">
                    {result.total_points}
                  </td>
                </tr>
              ))}
              {MOCK_RESULTS_DATA.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-gray-500">
                    No results available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
              <Button
                variant="secondary"
                //   onClick={closeAll}
                onClick={() => setModalStep("TYPE")}
              >
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
                // onClick={() => !isSoloDisabled && handleSelectType("solo")}
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
                // onClick={() => !isTeamDisabled && handleSelectType("team")}
                // onClick={() => !isTeamDisabled && setModalStep("TYPE")}
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

      // ... inside RegistrationModals component, within renderDialog()

      case "RULES":
        // Assuming uploaded_rules_url is available on eventDetails
        const textRules = eventDetails.event_rules;
        const documentUrl = (eventDetails as any).uploaded_rules_url; // Cast to access the new field
        const hasDocument = documentUrl && documentUrl.startsWith("http");
        const hasTextRules = !!textRules;

        const renderRulesContent = () => {
          if (hasTextRules) {
            // 🥇 PRIORITY 1: Display TEXT rules
            return (
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-primary">General Rules:</p>
                  {/* Render HTML content if your text rules are formatted, otherwise use a <p> tag */}
                  <p className="whitespace-pre-wrap">{textRules}</p>
                </div>
                {/* You can optionally add a link to the document here as a secondary option */}
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
            // 🥈 PRIORITY 2: Display DOCUMENT link
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

          // ❌ FALLBACK: No rules found
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

              {/* Separator and hardcoded policies (kept separate for critical info) */}
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
            <div className="text-center p-4 bg-primary/10 rounded-lg space-y-8">
              <p className="text-sm text-gray-300">
                Your registration is incomplete until your Discord account is
                linked.
              </p>
              <div className="grid gap-2">
                <Button onClick={handleDiscordConnect} className="w-full">
                  Connect Discord Account
                </Button>
                <DialogFooter className="flex sm:justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => setModalStep("RULES")}
                  >
                    Back
                  </Button>
                </DialogFooter>
              </div>
            </div>
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
                After joining, click the button below to continue to your
                registration confirmation.
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
                  <Loader text="Joining..." />
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
  const router = useRouter(); // Use the router to handle navigation
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStageTab, setActiveStageTab] = useState<string>("");

  const [modalStep, setModalStep] = useState<ModalStep>("CLOSED");
  const [regType, setRegType] = useState<RegistrationType | null>(null);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [discordConnected, setDiscordConnected] = useState(false); // Mock state for Discord connection

  const [pendingJoined, startJoinedTransition] = useTransition();
  // Function to fetch data from the POST endpoint
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
          },
          body: JSON.stringify({ event_id: id }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse = await response.json();
      const details = result.event_details;

      console.log(details);

      setEventDetails(details);

      // Set the first stage as the default active tab
      if (details.stages.length > 0) {
        setActiveStageTab(details.stages[0].stage_name);
      }
    } catch (err) {
      toast.error("Failed to load event details");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      fetchEventDetails();
    }
  }, [fetchEventDetails, id]);

  // Handle Loading and Error states
  if (isLoading) return <FullLoader />;

  if (error || !eventDetails) {
    return notFound();
  }

  // --- Rendering Logic ---

  // Determine participant count based on max teams/players
  const participantText = `${eventDetails.max_teams_or_players} ${
    eventDetails.participant_type.charAt(0).toUpperCase() +
    eventDetails.participant_type.slice(1)
  }s`;

  const handleRegisterClick = () => {
    setModalStep("TYPE");
  };

  const handleSelectType = (type: RegistrationType) => {
    setRegType(type);
    setModalStep("RULES"); // Move to rules after selecting type
  };

  const handleRulesContinue = () => {
    if (rulesAccepted) {
      // Assuming Discord connection is the next required step
      setModalStep("DISCORD_LINK"); // Move to Discord Link modal
    }
  };

  const handleDiscordConnect = () => {
    // Mocking a successful Discord connection
    const url = `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/connect-discord/?session_token=${token}`;

    // Open Discord auth URL in a new tab
    window.open(url, "_blank", "noopener,noreferrer");

    setDiscordConnected(true);
    setModalStep("DISCORD_JOIN"); // Move to Join Discord Server modal
  };

  console.log(eventDetails);

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

  // Custom format for "Format" to match the image (assuming event_mode/competition_type maps to it)
  const formatText = `${eventDetails.event_mode.toUpperCase()} / ${eventDetails.competition_type.toUpperCase()}`;

  return (
    <div>
      {/* Main Content Card (Dark Background from Image) */}
      <Card>
        <CardHeader className="space-y-2">
          <PageHeader title={eventDetails.event_name} back />
          <div className="space-y-2">
            {/* <p className="font-medium text-sm md:text-base">Banner Image</p> */}
            <Image
              src={eventDetails.event_banner_url || DEFAULT_IMAGE}
              alt={eventDetails.event_name || "Event Banner"}
              width={1000}
              height={1000}
              className="aspect-video size-full object-cover rounded-md"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <p>Date: {eventDetails.start_date}</p>
            <p>
              Prize Pool: ${parseFloat(eventDetails.prizepool).toLocaleString()}
            </p>
            <p>Location: Online</p>{" "}
            {/* Hardcoded as 'Online' based on image, adjust if API provides location */}
            <p>Format: {formatText}</p>
          </div>
          <p className="text-sm">Participants: {participantText}</p>
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
              {/* Tab Content for each Stage */}
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
      {/* Floating Register Button */}
      {/* {eventDetails.event_type === "external" && (
        <div className="text-center mt-6">
          <Button
            variant={"secondary"}
            onClick={() =>
              window.open(eventDetails.registration_link, "_blank")
            }
          >
            Register for Tournament
          </Button>
        </div>
      )} */}
      {/* Floating Register Button - Conditional Logic */}
      <div className="text-center mt-6">
        {eventDetails.event_type === "external" ? (
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
            disabled={eventDetails.event_status !== "upcoming"}
          >
            Register for Tournament
          </Button>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-2">
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-xl mb-3">Rules</CardTitle>
          </CardHeader>
          <CardContent>
            {/* START OF NEW LOGIC */}
            {/* Assuming uploaded_rules_url is available on eventDetails */}
            {(() => {
              const textRules = eventDetails.event_rules;
              // Cast to access the assumed new field uploaded_rules_url
              const documentUrl = (eventDetails as any).uploaded_rules_url;
              const hasDocument = documentUrl && documentUrl.startsWith("http");
              const hasTextRules = !!textRules;

              if (hasTextRules) {
                // Case 1: Display text rules (Priority)
                return (
                  <p className="text-sm whitespace-pre-wrap">{textRules}</p>
                );
              } else if (hasDocument) {
                // Case 2: Display download button for document URL
                return (
                  <div className="flex flex-col items-start space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Official rules are provided as a downloadable document.
                    </p>
                    <Button
                      type="button"
                      variant="default" // Using default button style for prominence
                      onClick={() => window.open(documentUrl, "_blank")}
                      className="w-full justify-center bg-primary/90 hover:bg-primary text-black font-semibold"
                    >
                      Download Rules Document
                    </Button>
                  </div>
                );
              } else {
                // Case 3: Fallback message
                return (
                  <p className="text-sm text-gray-500">
                    Rules document pending. Please check back later.
                  </p>
                );
              }
            })()}
          </CardContent>
        </Card>

        {/* Prize Distribution Card (Unchanged) */}
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
      />
    </div>
  );
};

export default EventDetailPage;
