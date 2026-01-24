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
import { formatDate, formatMoneyInput } from "@/lib/utils";
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
import { use, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { GroupResultModal } from "../_components/GroupResultModal";

const formattedWord: { [key: string]: string } = {
  tier_3: "Tier 3",
  "br - normal": "Battle Royale - Normal",
};

// --- Type Definitions ---

type Params = {
  slug: string;
};

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
    status: string;
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
  restrictions?: {
    regions: string[];
    countries: string[];
  } | null;
}

interface AdminEventDetails {
  overview: {
    event_id: number;
    event_name: string;
    total_registered: number;
    max_competitors: number;
    registration_percentage: number;
    days_until_start: number;
    event_duration_days: number;
    registration_close_date: string;
    days_until_registration_close: number;
    average_registrations_per_day: number;
    prizepool: number;
    prize_distribution: { [key: string]: number };
  };
  registration_timeline: {
    registration_start_date: string;
    registration_end_date: string;
    registration_window_days: number;
    days_left_for_registration: number;
    registration_timeseries: Array<{
      date: string;
      count: number;
    }>;
    peak_registration: number;
    recent_registrations: Array<{
      competitor_name: string;
      registration_date: string;
      status: string;
    }>;
    all_registrations: Array<{
      competitor_name: string;
      registration_date: string;
      status: string;
    }>;
  };
  team_status: {
    active: number;
    disqualified: number;
    withdrawn: number;
  };
  stage_progress: {
    total_stages: number;
    completed: number;
    ongoing: number;
    upcoming: number;
  };
  stages: Array<{
    stage_id: number;
    stage_name: string;
    start_date: string;
    end_date: string;
    number_of_groups: number;
    total_groups: number;
    total_teams_in_stage: number;
    stage_discord_role_id: string;
    groups: Array<{
      group_id: number;
      group_name: string;
      playing_date: string;
      playing_time: string;
      teams_qualifying: number;
      total_teams_in_group: number;
      group_discord_role_id: string;
    }>;
  }>;
  engagement: {
    pageviews: number;
    unique_visitors: number;
    conversion_rate: number;
    social_shares: number;
    stream_links: string[];
  };
}

// --- Component ---

const Page = ({ params }: { params: Promise<Params> }) => {
  const resolvedParams = use(params);
  const { slug } = resolvedParams;
  const router = useRouter();

  // Get both token and loading state from auth context
  const { token, loading: authLoading } = useAuth();

  const [pending, startTransition] = useTransition();
  const [eventDetails, setEventDetails] = useState<EventDetails>();
  const [adminDetails, setAdminDetails] = useState<AdminEventDetails>();

  useEffect(() => {
    // Wait for auth context to load before making API calls
    if (!slug || authLoading || !token) return;

    startTransition(async () => {
      try {
        const config = {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        };

        // Fetch both datasets in parallel
        const [res, resAdmin] = await Promise.all([
          axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
            { slug: slug },
            config,
          ),
          axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details-for-admin/`,
            { slug: slug },
            config,
          ),
        ]);

        setEventDetails(res.data.event_details);
        setAdminDetails(resAdmin.data);
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.message ||
          error.response?.data?.detail ||
          "Failed to fetch event details.";

        toast.error(errorMessage);

        // Only redirect to login if it's an auth error (401 or 403)
        if (error.response?.status === 401 || error.response?.status === 403) {
          router.push("/login");
        }
      }
    });
  }, [slug, token, authLoading, router]);

  // Memoized calculations
  const calculatedData = useMemo(() => {
    if (!eventDetails || !adminDetails) return null;

    const totalRegistered = adminDetails.overview.total_registered;
    const maxCapacity = adminDetails.overview.max_competitors;
    const registrationProgress = Math.min(
      (totalRegistered / maxCapacity) * 100,
      100,
    );

    return {
      totalRegistered,
      maxCapacity,
      registrationProgress,
      daysUntilStart: adminDetails.overview.days_until_start,
      daysUntilRegClose: adminDetails.overview.days_until_registration_close,
      avgRegPerDay: adminDetails.overview.average_registrations_per_day,
      eventDurationDays: adminDetails.overview.event_duration_days,
      regDurationDays:
        adminDetails.registration_timeline.registration_window_days,
    };
  }, [eventDetails, adminDetails]);

  // Show loader while auth is loading or data is being fetched
  if (
    authLoading ||
    pending ||
    !eventDetails ||
    !adminDetails ||
    !calculatedData
  ) {
    return <FullLoader />;
  }

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
    stages,
    competition_type,
    participant_type,
    max_teams_or_players,
    restrictions,
  } = eventDetails;

  const {
    totalRegistered,
    maxCapacity,
    registrationProgress,
    daysUntilStart,
    daysUntilRegClose,
    avgRegPerDay,
    regDurationDays,
  } = calculatedData;

  const formattedPrizepool = /^\d+(\.\d+)?$/.test(eventDetails.prizepool)
    ? `$${parseFloat(eventDetails.prizepool).toLocaleString()}`
    : eventDetails.prizepool;

  // Get stage status
  const stageStatus = adminDetails.stage_progress;

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
          <Link href={`/a/events/${slug}/edit`}>
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
                  {stageStatus.total_stages}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Event Configuration</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-y-4 text-sm">
                <div className="text-muted-foreground">Type</div>
                <div className="font-medium text-right capitalize">
                  {event_type}
                </div>
                <div className="text-muted-foreground">Competition</div>
                <div className="font-medium text-right capitalize">
                  {competition_type}
                </div>
                <div className="text-muted-foreground">Participant Type</div>
                <div className="font-medium text-right capitalize">
                  {participant_type}
                </div>
                <div className="text-muted-foreground">Mode</div>
                <div className="font-medium text-right capitalize">
                  {event_mode}
                </div>
                <div className="text-muted-foreground">Max Teams</div>
                <div className="font-medium text-right">
                  {formatMoneyInput(max_teams_or_players)}
                </div>
              </CardContent>
            </Card>

            {restrictions &&
              (restrictions.regions?.length > 0 ||
                restrictions.countries?.length > 0) && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Registration Restrictions</CardTitle>
                    <Badge variant="secondary">Region</Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Mode
                      </span>
                      <Badge variant="outline" className="bg-white text-black">
                        Allow Only
                      </Badge>
                    </div>
                    {restrictions.regions &&
                      restrictions.regions.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Regions:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {restrictions.regions.map((r) => (
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
                      )}
                    {restrictions.countries &&
                      restrictions.countries.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Countries:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {restrictions.countries.map((c) => (
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
                      )}
                  </CardContent>
                </Card>
              )}
          </div>

          {stream_channels && stream_channels.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconExternalLink className="size-4" /> Streaming Channels
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                {stream_channels.map((url, i) => (
                  <div
                    key={i}
                    className="bg-primary/10 text-primary text-sm font-medium hover:underline rounded-md py-2 px-4 border-none cursor-pointer"
                  >
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {url}
                    </a>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Event Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {adminDetails.stages.map((stage, index) => {
                const now = new Date().toISOString().split("T")[0];
                let status = "upcoming";
                if (stage.end_date < now) status = "completed";
                else if (stage.start_date <= now && stage.end_date >= now)
                  status = "ongoing";

                return (
                  <div
                    key={stage.stage_id}
                    className="relative flex items-start gap-4"
                  >
                    {index !== adminDetails.stages.length - 1 && (
                      <div className="absolute left-[5px] top-6 w-[2px] h-full bg-muted-foreground/20" />
                    )}

                    <div
                      className={`mt-1.5 size-3 rounded-full z-10 ${
                        status === "completed"
                          ? "bg-green-500"
                          : status === "ongoing"
                            ? "bg-blue-500"
                            : "bg-slate-500"
                      }`}
                    />

                    <div className="flex-1 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm">
                          {stage.stage_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(stage.start_date)} →{" "}
                          {formatDate(stage.end_date)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          status === "completed" ? "outline" : "secondary"
                        }
                        className="h-6 capitalize"
                      >
                        {status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="mt-4 space-y-4">
          <Card>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                {eventDetails.event_type === "external" &&
                  registration_link &&
                  registration_link.trim().length > 0 && (
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

              <div>
                <p className="font-medium text-sm md:text-base mb-2">
                  Prize Distribution
                </p>
                <ul className="list-disc list-inside text-muted-foreground text-xs md:text-sm space-y-1">
                  {Object.entries(prize_distribution)
                    .sort(([posA], [posB]) => {
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
                  {adminDetails.overview.registration_percentage.toFixed(1)}%
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
              {adminDetails.registration_timeline.recent_registrations.map(
                (competitor, index) => (
                  <div
                    key={index}
                    className="bg-primary/10 rounded-md py-3.5 px-2.5 flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {competitor.competitor_name}
                      </p>
                      <p className="text-muted-foreground capitalize text-xs">
                        {event_type} • Status: {competitor.status}
                      </p>
                    </div>
                    <p className="text-muted-foreground text-xs ms:text-sm">
                      {formatDate(competitor.registration_date)}
                    </p>
                  </div>
                ),
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Stages Tab --- */}
        <TabsContent value="stages" className="mt-4 space-y-4">
          {adminDetails.stages.length > 0 ? (
            adminDetails.stages.map((stage) => {
              const now = new Date().toISOString().split("T")[0];
              let status = "upcoming";
              if (stage.end_date < now) status = "completed";
              else if (stage.start_date <= now && stage.end_date >= now)
                status = "ongoing";

              return (
                <Card key={stage.stage_id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <div>
                        <p>{stage.stage_name}</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          {formatDate(stage.start_date)} -{" "}
                          {formatDate(stage.end_date)}
                        </p>
                      </div>
                      <Badge variant={"default"} className="capitalize">
                        {status}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-96 overflow-auto grid md:grid-cols-2 gap-2">
                    {stage.groups.map((group) => (
                      <Card
                        key={group.group_id}
                        className="bg-primary/10 gap-0"
                      >
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
                          <GroupResultModal
                            className="w-full bg-primary hover:bg-primary/90 mt-2.5"
                            activeGroup={group}
                            stageName={stage.stage_name}
                            eventId={eventDetails.event_id}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <p className="text-muted-foreground italic">
              No stages defined for this event.
            </p>
          )}
        </TabsContent>

        <TabsContent value="prizes" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Prize Distribution - ${formattedPrizepool}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(prize_distribution)
                .sort(([posA], [posB]) => {
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
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Page Views
                </CardTitle>
                <IconUsers className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMoneyInput(adminDetails.engagement.pageviews)}
                </div>
                <Progress value={70} className="mt-2.5" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Total visits
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Unique Visitors
                </CardTitle>
                <IconUsers className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMoneyInput(adminDetails.engagement.unique_visitors)}
                </div>
                <Progress value={70} className="mt-2.5" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Unique users
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Conversion Rate
                </CardTitle>
                <IconUsers className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {adminDetails.engagement.conversion_rate.toFixed(1)}%
                </div>
                <Progress
                  value={adminDetails.engagement.conversion_rate}
                  className="mt-2.5"
                />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Visitors to registrations
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Social Shares
                </CardTitle>
                <IconUsers className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMoneyInput(adminDetails.engagement.social_shares)}
                </div>
                <Progress value={70} className="mt-2.5" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Shares across platforms
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Page;
