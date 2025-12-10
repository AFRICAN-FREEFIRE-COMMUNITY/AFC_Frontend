"use client";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_IMAGE } from "@/constants";
import { env } from "@/lib/env";
// Assuming these utility functions exist and work as intended
import { formatDate, formatMoneyInput } from "@/lib/utils";
import { IconPencil } from "@tabler/icons-react";
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
};

// --- Type Definitions ---

type Params = {
  id: string;
};

interface EventDetails {
  event_id: number;
  event_name: string;
  competition_type: string;
  participant_type: string;
  event_type: string;
  max_teams_or_players: number;
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
  number_of_stages: number;
  uploaded_rules_url: string | null;
  created_at: string;
  stream_channels: string[];
  stages: any[];
}

// --- Component ---

// Note: Ensure the caller passes a promise to this component, or use a simpler structure
// if using Next.js 13+ app directory which handles async fetching.
// Assuming the provided structure is necessary based on the original code.

const Page = ({ params }: { params: Promise<Params> }) => {
  // Use `use` hook to resolve the promise for `params`
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [eventDetails, setEventDetails] = useState<EventDetails>();

  useEffect(() => {
    if (!id) return;

    startTransition(async () => {
      try {
        const decodedId = decodeURIComponent(id);
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
          { event_id: decodedId }
        );
        // Ensure data path is correct based on your API response structure
        setEventDetails(res.data.event_details);
      } catch (error: any) {
        // Handle error response structure
        const errorMessage =
          error.response?.data?.message ||
          error.response?.data?.detail ||
          "Failed to fetch event details.";
        toast.error(errorMessage);
      }
    });
  }, [id]);

  if (pending || !eventDetails) return <FullLoader />;

  // Destructure for cleaner JSX
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
  } = eventDetails;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <PageHeader back title={event_name} />
        <Button asChild variant={"secondary"}>
          <Link href={`/a/events/${id}/edit`}>
            <IconPencil className="w-4 h-4 mr-2" />
            Edit
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Banner Image Display */}
          <div className="space-y-2">
            {/* <p className="font-medium text-sm md:text-base">Banner Image</p> */}
            <Image
              src={event_banner_url || DEFAULT_IMAGE}
              alt={event_name || "Event Banner"}
              width={1000}
              height={1000}
              className="aspect-video size-full object-cover rounded-md"
            />
          </div>

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
                {formatMoneyInput(prizepool)}
              </p>
            </div>
            <div>
              <p className="font-medium text-sm md:text-base">Tier</p>
              <p className="text-muted-foreground text-xs md:text-sm capitalize">
                {formattedWord[tournament_tier] || tournament_tier}
              </p>
            </div>
            <div>
              <p className="font-medium text-sm md:text-base">Status</p>
              <p className="text-muted-foreground text-xs md:text-sm capitalize">
                {event_status}
              </p>
            </div>

            {/* Registration Link (Conditional) */}
            {registration_link && (
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

          {/* Prize Distribution List (FIXED) */}
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
            {uploaded_rules_url ? (
              <p className="text-muted-foreground text-xs md:text-sm">
                Rules provided via document:{" "}
                <Link
                  href={uploaded_rules_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  View Document
                </Link>
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

          {/* Stream Channels List */}
          {stream_channels &&
            stream_channels.length > 0 &&
            stream_channels[0].trim().length > 0 && (
              <div>
                <p className="font-medium text-sm md:text-base mb-2">
                  Streaming Channels
                </p>
                <ul className="list-disc list-inside text-muted-foreground text-xs md:text-sm space-y-1">
                  {stream_channels
                    .filter((url) => url.trim())
                    .map((url, index) => (
                      <li key={index}>
                        <Link
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline truncate"
                        >
                          {url}
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            )}
        </CardContent>
      </Card>

      {/* You can add another Card for Stages here */}
      {eventDetails.stages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Tournament Stages ({eventDetails.number_of_stages})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eventDetails.stages.map((stage: any, index: number) => (
              <div key={index} className="border-b last:border-b-0 py-3">
                <p className="font-semibold text-base">{stage.stage_name}</p>
                <p className="text-sm text-muted-foreground">
                  Format: {formattedWord[stage.stage_format]} | Groups:{" "}
                  {stage.groups.length} | Qualify:{" "}
                  {stage.teams_qualifying_from_stage || "N/A"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Page;
