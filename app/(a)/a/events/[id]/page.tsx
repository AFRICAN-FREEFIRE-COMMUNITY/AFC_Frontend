"use client";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_IMAGE } from "@/constants";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
// Assuming these utility functions exist and work as intended
import { formatDate, formatMoneyInput } from "@/lib/utils"; // Assuming calculateDaysDifference is available
import { TabsContent } from "@radix-ui/react-tabs";
import {
  IconCalendar,
  IconCurrencyDollar,
  IconExternalLink,
  IconPencil,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react";
import axios from "axios";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

// Extend formattedWord with tournament tier if necessary, or just use the raw value
const formattedWord: { [key: string]: string } = {
  tier_3: "Tier 3", // Example tier formatting
  // Add other tier mappings if needed
  "br - normal": "Battle Royale - Normal",
  // Add other format mappings if needed
};

// --- Type Definitions ---

type Params = {
  id: string;
};

// Interface updated based on the actual backend response structure
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
  prize_distribution: { [key: string]: number }; // Object mapping position to amount
  event_rules: string;
  event_status: string;
  registration_link: string | null;
  tournament_tier: string;
  event_banner_url: string | null;
  uploaded_rules_url: string | null;
  number_of_stages: number;
  created_at: string;
  is_registered: boolean;
  stream_channels: string[];
  registered_competitors: Array<{
    player_id: number;
    username: string;
    status: string; // e.g., 'registered'
    // Assuming team_name/region/etc. might be missing for solo/individual registrations
  }>;
  tournament_teams: any[];
  stages: Array<{
    id: number;
    stage_name: string;
    start_date: string;
    end_date: string;
    number_of_groups: number;
    stage_format: string;
    stage_discord_role_id: string;
    teams_qualifying_from_stage: number;
    groups: Array<{
      id: number;
      group_name: string;
      playing_date: string;
      playing_time: string;
      teams_qualifying: number;
      group_discord_role_id: string;
      matches: any[];
    }>;
  }>;
}

// --- Utility Functions (Mock/Assumed) ---

// Assuming this function exists in "@/lib/utils" and correctly handles formatting
// function formatMoneyInput(amount: string | number): string { /* ... */ }

// Assuming this function exists in "@/lib/utils" and correctly formats dates
// function formatDate(dateStr: string | Date): string { /* ... */ }

// Function to calculate difference in days (start - now or end - start)
function calculateDaysDifference(dateStr1: string, dateStr2?: string): number {
  const date1 = new Date(dateStr1);
  const date2 = dateStr2 ? new Date(dateStr2) : new Date();
  // Set time to noon to avoid daylight saving/timezone issues in calculation
  date1.setHours(12, 0, 0, 0);
  date2.setHours(12, 0, 0, 0);
  const diffTime = date1.getTime() - date2.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Function to calculate days between two dates (inclusive)
function calculateDuration(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  startDate.setHours(12, 0, 0, 0);
  endDate.setHours(12, 0, 0, 0);
  const diffTime = endDate.getTime() - startDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 for inclusive
  return Math.max(0, diffDays); // Ensure non-negative
}

// --- Component ---

const Page = ({ params }: { params: Promise<Params> }) => {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();

  const { token } = useAuth();

  const [pending, startTransition] = useTransition();
  const [eventDetails, setEventDetails] = useState<EventDetails>();

  const [stageNames, setStageNames] = useState<string[]>([]);

  console.log(stageNames, eventDetails);

  useEffect(() => {
    if (!id) return;

    startTransition(async () => {
      try {
        const decodedId = decodeURIComponent(id);
        const config = {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        };

        // 1. Fetch both datasets in parallel
        const [res, resAdmin] = await Promise.all([
          axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
            { event_id: decodedId },
            config
          ),
          axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details-for-admin/`,
            { event_id: decodedId },
            config
          ),
        ]);

        // 2. Extract data safely
        const baseDetails = res.data.event_details;
        // The admin endpoint usually returns the same structure, but we want its 'stages'
        const adminStages =
          resAdmin.data.event_details?.stages || resAdmin.data.stages || [];

        // 3. Merge: Use base details but override the stages with admin data
        const mergedDetails: EventDetails = {
          ...baseDetails,
          stages: adminStages,
        };

        // 4. Update states
        setEventDetails(mergedDetails);

        if (adminStages.length > 0) {
          setStageNames(adminStages.map((s: any) => s.stage_name));
        }
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.message ||
          error.response?.data?.detail ||
          "Failed to fetch event details.";
        toast.error(errorMessage);
        router.push("/login");
      }
    });
  }, [id, token, router]); // Added token and router to dependencies

  // useEffect(() => {
  //   if (!id) return;

  //   startTransition(async () => {
  //     try {
  //       const decodedId = decodeURIComponent(id);
  //       const res = await axios.post(
  //         `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
  //         { event_id: decodedId },
  //         {
  //           headers: {
  //             "Content-Type": "application/json",
  //             Authorization: `Bearer ${token}`,
  //           },
  //         }
  //       );
  //       // Ensure data path is correct based on your API response structure
  //       setEventDetails(res.data.event_details);
  //     } catch (error: any) {
  //       const errorMessage =
  //         error.response?.data?.message ||
  //         error.response?.data?.detail ||
  //         "Failed to fetch event details.";
  //       toast.error(errorMessage);
  //       router.push("/login");
  //     }
  //   });
  // }, [id]);

  if (pending || !eventDetails) return <FullLoader />;

  // --- Data Calculations ---
  const {
    event_name,
    event_type,
    start_date,
    end_date,
    registration_open_date,
    registration_end_date,
    prizepool,
    prize_distribution,
    tournament_tier,
    event_status,
    event_mode,
    event_rules,
    uploaded_rules_url,
    event_banner_url,
    registration_link,
    stream_channels,
    max_teams_or_players,
    registered_competitors,
    stages,
    number_of_stages,
  } = eventDetails;

  const totalRegistered = registered_competitors.length;
  const maxCapacity = max_teams_or_players;
  const registrationProgress =
    (totalRegistered / maxCapacity) * 100 > 100
      ? 100
      : (totalRegistered / maxCapacity) * 100;
  const daysUntilStart = calculateDaysDifference(start_date);
  const eventDurationDays = calculateDuration(start_date, end_date);
  const daysUntilRegClose = calculateDaysDifference(registration_end_date);
  const regDurationDays = calculateDuration(
    registration_open_date,
    registration_end_date
  );
  const avgRegPerDay =
    regDurationDays > 0 ? totalRegistered / regDurationDays : totalRegistered;
  const formattedPrizepool = formatMoneyInput(prizepool);

  // Example: Logic for Stage Progress (Placeholder/Mock logic)
  // Assuming the first stage is the only one in this mock data and it is 'Upcoming'
  const completedStages = 0;
  const ongoingStages = 0;
  const upcomingStages = number_of_stages; // Mocking all stages are upcoming
  const stageProgress = (completedStages / number_of_stages) * 100;

  return (
    <div>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <div className="w-full">
          <PageHeader back title={event_name} />
          <div className="flex gap-2 overflow-x-auto whitespace-nowrap p-1 custom-scroll">
            <Badge variant={"secondary"} className="capitalize">
              {event_mode}
            </Badge>
            <Badge variant={"secondary"} className="capitalize">
              {event_type}
            </Badge>
            <Badge variant={"secondary"} className="capitalize">
              {event_status}
            </Badge>
            <Badge variant={"secondary"} className="capitalize">
              {formattedWord[tournament_tier] || tournament_tier}
            </Badge>
          </div>
        </div>
        <Button className="w-full md:w-auto" asChild>
          <Link href={`/a/events/${id}/edit`}>
            <IconPencil />
            Manage Event
          </Link>
        </Button>
      </div>
      <div className="mt-4 overflow-hidden rounded-md">
        <Image
          src={event_banner_url || DEFAULT_IMAGE}
          alt={`${event_name}'s image`}
          width={1000}
          height={1000}
          className="w-full h-50 aspect-video object-cover"
        />
      </div>

      <Tabs defaultValue="overview" className="mt-4">
        <ScrollArea>
          <TabsList className="w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="registrations">Registrations</TabsTrigger>
            <TabsTrigger value="stages">Stages</TabsTrigger>
            <TabsTrigger value="prizes">Prizes</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* --- Overview Tab --- */}
        <TabsContent value="overview" className="mt-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 2xl:grid-cols-4">
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Registered
                </CardTitle>
                <IconUsers className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMoneyInput(totalRegistered)}/
                  {formatMoneyInput(maxCapacity)}
                </div>
                <Progress value={registrationProgress} className="mt-2.5" />
                {/* <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {registrationProgress.toFixed(1)}% capacity
                  </div>
                </div> */}
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Prize Pool
                </CardTitle>
                <IconCurrencyDollar className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formattedPrizepool}</div>
                {/* <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {formattedPrizepool} total
                  </div>
                </div> */}
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Days Until Start
                </CardTitle>
                <IconCalendar className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {daysUntilStart} {daysUntilStart === 1 ? "day" : "days"}
                </div>
                {/* <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Event duration: {eventDurationDays} days
                  </div>
                </div> */}
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Stages
                </CardTitle>
                <IconCalendar className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {eventDetails.stages.length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* <Card>
            <CardHeader>
              <CardTitle>Event Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium text-sm w-32 shrink-0">
                  Registration
                </p>
                <div className="flex flex-1 items-start justify-start flex-col">
                  <p className="text-muted-foreground text-xs ms:text-sm mb-1">
                    {formatDate(registration_open_date)} →{" "}
                    {formatDate(registration_end_date)}
                  </p>
                  <Progress value={70} />{" "}
                </div>
                <Badge variant={"outline"} className="shrink-0">
                  {daysUntilRegClose} days left
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium text-sm w-32 shrink-0">
                  Event Period
                </p>
                <div className="flex flex-1 items-start justify-start flex-col">
                  <p className="text-muted-foreground text-xs ms:text-sm mb-1">
                    {formatDate(start_date)} → {formatDate(end_date)}
                  </p>
                  <Progress value={70} />{" "}
                </div>
                <Badge variant={"outline"} className="shrink-0">
                  {daysUntilStart} days until start
                </Badge>
              </div>
            </CardContent>
          </Card> */}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Event Configuration</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-y-4 text-sm">
                <div className="text-muted-foreground">Type</div>
                <div className="font-medium text-right capitalize">
                  {eventDetails.event_type}
                </div>
                <div className="text-muted-foreground">Competition</div>
                <div className="font-medium text-right capitalize">
                  {eventDetails.competition_type}
                </div>
                <div className="text-muted-foreground">Participant Type</div>
                <div className="font-medium text-right capitalize">
                  {eventDetails.participant_type}
                </div>
                <div className="text-muted-foreground">Mode</div>
                <div className="font-medium text-right capitalize">
                  {eventDetails.event_mode}
                </div>
                <div className="text-muted-foreground">Max Teams</div>
                <div className="font-medium text-right">
                  {formatMoneyInput(eventDetails.max_teams_or_players)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Registration Restrictions</CardTitle>
                <Badge variant="secondary">Region</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Mode</span>
                  <Badge variant="outline" className="bg-white text-black">
                    Allow Only
                  </Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Regions:</p>
                  <div className="flex flex-wrap gap-2">
                    {eventDetails.restrictions?.regions.map((r) => (
                      <Badge
                        key={r}
                        variant="secondary"
                        className="rounded-full px-3"
                      >
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Countries:</p>
                  <div className="flex flex-wrap gap-2">
                    {eventDetails.restrictions?.countries.map((c) => (
                      <Badge
                        key={c}
                        variant="secondary"
                        className="rounded-full px-3"
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconExternalLink className="size-4" /> Streaming Channels
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {eventDetails.stream_channels.map((url, i) => (
                <div
                  key={i}
                  className="bg-primary/10 text-primary text-sm font-medium hover:underline rounded-md py-2 px-4 border-none cursor-pointer"
                >
                  <a href={url} target="_blank">
                    {url}
                  </a>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Card>
              <CardHeader>
                <CardTitle>Player Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>Registered Players</span>
                  <span className="text-base font-semibold text-green-500">
                    {formatMoneyInput(totalRegistered)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Max Capacity</span>
                  <span className="text-base font-semibold text-blue-500">
                    {formatMoneyInput(maxCapacity)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Disqualified</span>
                  <span className="text-base font-semibold text-red-500">
                    0
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Stage Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>Completed</span>
                  <span className="text-base font-semibold text-green-500">
                    {completedStages}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Ongoing</span>
                  <span className="text-base font-semibold text-blue-500">
                    {ongoingStages}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Upcoming</span>
                  <span className="text-base font-semibold text-yellow-500">
                    {upcomingStages}
                  </span>
                </div>
                <div className="space-y-1">
                  <Progress value={stageProgress} />
                  <p className="text-xs text-muted-foreground">
                    {completedStages} of {number_of_stages} stages completed
                  </p>
                </div>
              </CardContent>
            </Card>
          </div> */}
          <Card>
            <CardHeader>
              <CardTitle>Event Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {eventDetails.stages.map((stage, index) => (
                <div key={stage.id} className="relative flex items-start gap-4">
                  {/* Vertical Line Connector */}
                  {index !== eventDetails.stages.length - 1 && (
                    <div className="absolute left-[5px] top-6 w-[2px] h-full bg-muted-foreground/20" />
                  )}

                  {/* Status Dot */}
                  <div
                    className={`mt-1.5 size-3 rounded-full z-10 ${
                      stage.status === "completed"
                        ? "bg-green-500"
                        : "bg-slate-500"
                    }`}
                  />

                  <div className="flex-1 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{stage.stage_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(stage.start_date)} →{" "}
                        {formatDate(stage.end_date)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        stage.status === "completed" ? "outline" : "secondary"
                      }
                      className="h-6"
                    >
                      {stage.status || "Upcoming"}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="mt-4 space-y-4">
          <Card>
            <CardContent className="space-y-6">
              {/* Banner Image Display */}
              {/* <div className="space-y-2">
                <Image
                  src={event_banner_url || DEFAULT_IMAGE}
                  alt={event_name || "Event Banner"}
                  width={1000}
                  height={1000}
                  className="aspect-video size-full object-cover rounded-md"
                />
              </div> */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div>
                  <p className="font-medium text-sm md:text-base">Type</p>
                  <p className="text-muted-foreground text-xs md:text-sm capitalize">
                    {event_type}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm md:text-base">Location</p>
                  <p className="text-muted-foreground text-xs md:text-sm capitalize">
                    {event_mode}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm md:text-base">
                    Max Players
                  </p>
                  <p className="text-muted-foreground text-xs md:text-sm">
                    {formatMoneyInput(maxCapacity)}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm md:text-base">Tier</p>
                  <p className="text-muted-foreground text-xs md:text-sm capitalize">
                    {formattedWord[tournament_tier] || tournament_tier}
                  </p>
                </div>

                {/* Dates */}
                <div>
                  <p className="font-medium text-sm md:text-base">Start Date</p>
                  <p className="text-muted-foreground text-xs md:text-sm">
                    {formatDate(start_date)}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm md:text-base">End Date</p>
                  <p className="text-muted-foreground text-xs md:text-sm">
                    {formatDate(end_date)}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm md:text-base">
                    Registration Opens
                  </p>
                  <p className="text-muted-foreground text-xs md:text-sm">
                    {formatDate(registration_open_date)}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm md:text-base">
                    Registration Closes
                  </p>
                  <p className="text-muted-foreground text-xs md:text-sm">
                    {formatDate(registration_end_date)}
                  </p>
                </div>

                {/* Prize & Status */}
                <div>
                  <p className="font-medium text-sm md:text-base">Prize Pool</p>
                  <p className="text-muted-foreground text-xs md:text-sm">
                    ${formattedPrizepool}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm md:text-base">Status</p>
                  <p className="text-muted-foreground text-xs md:text-sm capitalize">
                    {event_status}
                  </p>
                </div>

                {/* Registration Link (Conditional) */}
                {registration_link && registration_link.trim().length > 0 && (
                  <div>
                    <p className="font-medium text-sm md:text-base">
                      Registration Link
                    </p>
                    <Link
                      href={registration_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline text-xs md:text-sm truncate"
                    >
                      {registration_link}
                    </Link>
                  </div>
                )}
              </div>

              {/* Prize Distribution List */}
              <div>
                <p className="font-medium text-sm md:text-base mb-2">
                  Prize Distribution
                </p>
                <ul className="list-disc list-inside text-muted-foreground text-xs md:text-sm space-y-1">
                  {Object.entries(prize_distribution)
                    .sort(([posA], [posB]) => {
                      // Custom sort: try to sort by numerical position (1st, 2nd, etc.)
                      const numA = parseInt(posA.replace(/\D/g, ""));
                      const numB = parseInt(posB.replace(/\D/g, ""));
                      return numA - numB;
                    })
                    .map(([position, amount]) => (
                      <li key={position} className="uppercase">
                        {position}: ${formatMoneyInput(String(amount))}
                      </li>
                    ))}
                </ul>
              </div>

              {/* Rules Section (Improved) */}
              <div>
                <p className="font-medium text-sm md:text-base">Event Rules</p>
                {uploaded_rules_url && uploaded_rules_url.trim().length > 0 ? (
                  <p className="text-muted-foreground text-xs md:text-sm">
                    Rules provided via document:{" "}
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto text-sm text-yellow-400 hover:text-yellow-300"
                      onClick={() => window.open(uploaded_rules_url, "_blank")}
                    >
                      Download Official Rules Document
                    </Button>
                  </p>
                ) : event_rules && event_rules.trim().length > 0 ? (
                  <p className="text-muted-foreground text-xs md:text-sm whitespace-pre-line">
                    {event_rules}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs md:text-sm italic">
                    No rules document or typed rules provided.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Registrations Tab --- */}
        <TabsContent value="registrations" className="mt-4 space-y-4">
          <div className="grid-cols-1 grid md:grid-cols-2 2xl:grid-cols-3 gap-2">
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Registration Rate
                </CardTitle>
                <IconUsers className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {registrationProgress.toFixed(1)}%
                </div>
                <Progress value={registrationProgress} className="mt-2.5" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    of max capacity ({maxCapacity} slots)
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Average Per Day
                </CardTitle>
                <IconUsers className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {avgRegPerDay.toFixed(1)}
                </div>
                {/* Mocking a progress bar for visual consistency */}
                <Progress value={70} className="mt-2.5" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    players/day over {regDurationDays} days
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Time Until Close
                </CardTitle>
                <IconCalendar className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {daysUntilRegClose} {daysUntilRegClose === 1 ? "day" : "days"}
                </div>
                {/* Mocking a progress bar for visual consistency */}
                <Progress value={70} className="mt-2.5" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Registration closes on {formatDate(registration_end_date)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                Recent Registrations ({totalRegistered} total)
              </CardTitle>
            </CardHeader>
            <CardContent className="mt-2 space-y-1 max-h-96 overflow-y-auto">
              {registered_competitors.map((player) => (
                <div
                  key={player.player_id}
                  className="bg-primary/10 rounded-md py-3.5 px-2.5 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-medium text-sm">{player.username}</p>
                    <p className="text-muted-foreground capitalize text-xs">
                      {event_type} • Player ID: {player.player_id}
                    </p>
                  </div>
                  <p className="text-muted-foreground text-xs ms:text-sm">
                    {formatDate(new Date())}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
          {/* Omitted "Registrations by Region" card as data is not available */}
        </TabsContent>

        {/* --- Stages Tab --- */}
        <TabsContent value="stages" className="mt-4 space-y-4">
          {stages.length > 0 ? (
            stages.map((stage) => (
              <Card key={stage.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <div>
                      <p>{stage.stage_name}</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        {formatDate(stage.start_date)} -{" "}
                        {formatDate(stage.end_date)}{" "}
                        {formattedWord[stage.stage_format] ||
                          stage.stage_format}
                      </p>
                    </div>
                    {/* Mock badge based on date relative to now */}
                    <Badge variant={"default"} className="capitalize">
                      {stage.start_date > new Date().toISOString().split("T")[0]
                        ? "Upcoming"
                        : "Ongoing"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-2">
                  {stage.groups.map((group, index) => (
                    <Card className="bg-primary/10 gap-0">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between gap-2">
                          <span>{group.group_name}</span>
                          <span className="text-muted-foreground text-xs">
                            {group.teams_qualifying} qualify
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-2 space-y-2 text-sm text-muted-foreground">
                        <p>
                          {formatDate(group.playing_date)} at{" "}
                          {group.playing_time}
                        </p>
                        <p>Discord: {group.group_discord_role_id}</p>
                        <p className="text-primary font-medium">
                          Maps: Bermuda, Kalahari, Purgatory
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
                {/* <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground text-xs">Groups</p>
                    <h3 className="font-semibold text-base">
                      {stage.number_of_groups}
                    </h3>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Format</p>
                    <h3 className="font-semibold text-lg capitalize">
                      {formattedWord[stage.stage_format] || stage.stage_format}
                    </h3>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Qualifying Players
                    </p>
                    <h3 className="font-semibold text-base">
                      {formatMoneyInput(stage.teams_qualifying_from_stage)}
                    </h3>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Start Time (Group 1)
                    </p>
                    <h3 className="font-semibold text-base">
                      {stage.groups[0]?.playing_time.substring(0, 5) || "N/A"}{" "}
                      WAT
                    </h3>
                  </div>
                </CardContent> */}
              </Card>
            ))
          ) : (
            <p className="text-muted-foreground italic">
              No stages defined for this event.
            </p>
          )}
        </TabsContent>

        <TabsContent value="prizes" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                Prize Distribution - ${formatMoneyInput(prizepool)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(prize_distribution)
                .sort(([posA], [posB]) => {
                  // Sorts 1st, 2nd, 3rd numerically
                  const numA = parseInt(posA.replace(/\D/g, "")) || 0;
                  const numB = parseInt(posB.replace(/\D/g, "")) || 0;
                  return numA - numB;
                })
                .map(([position, amount]) => (
                  <Card
                    className="bg-primary/10 hover:bg-primary/15"
                    key={position}
                  >
                    <CardContent className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-200 capitalize">
                        {position}
                      </span>
                      <span className="text-sm font-bold text-green-500">
                        ${formatMoneyInput(amount)}
                      </span>
                    </CardContent>
                  </Card>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Engagement Tab --- */}
        <TabsContent value="engagement" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 2xl:grid-cols-4">
            {/* Mocked/Placeholder data for engagement metrics */}
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Page Views (Mock)
                </CardTitle>
                <IconUsers className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">15,420</div>
                <Progress value={70} className="mt-2.5" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Total visits (Mock data)
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* ... other engagement cards remain mocked ... */}
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Unique Visitors (Mock)
                </CardTitle>
                <IconUsers className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">8,932</div>
                <Progress value={70} className="mt-2.5" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Unique users (Mock data)
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Conversion Rate (Mock)
                </CardTitle>
                <IconUsers className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">87.0%</div>
                <Progress value={70} className="mt-2.5" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Visitors to registrations (Mock data)
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Social Shares (Mock)
                </CardTitle>
                <IconUsers className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">243</div>
                <Progress value={70} className="mt-2.5" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Shares across platforms (Mock data)
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* <Card className="gap-0">
            <CardHeader>
              <CardTitle>Stream Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 mt-2">
              {stream_channels.length > 0 ? (
                stream_channels.map((url, index) => (
                  <div key={index} className="bg-primary/10 rounded-md p-3.5">
                    <p className="text-sm flex items-center justify-start gap-2">
                      <IconTrendingUp className="size-4" />
                      <a
                        target="_blank"
                        className="hover:underline hover:text-primary transition-all truncate"
                        href={url}
                        rel="noopener noreferrer"
                      >
                        {url}
                      </a>
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground italic">
                  No streaming channels provided.
                </p>
              )}
            </CardContent>
          </Card> */}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Page;
