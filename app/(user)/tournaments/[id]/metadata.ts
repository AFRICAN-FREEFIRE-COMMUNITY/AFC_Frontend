// app/(user)/tournaments/[id]/metadata.ts

import type { Metadata } from "next";
import { env } from "@/lib/env";

// Define the necessary types for server-side fetching
interface EventDetailsSEO {
  event_name: string;
  tournament_tier: string;
  prizepool: string;
  event_mode: string;
  event_banner_url: string | null;
}

// Function to fetch event details for Metadata generation
async function getEventDetails(id: string): Promise<EventDetailsSEO | null> {
  try {
    const response = await fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: id }),
        // Set revalidate time for dynamic content caching
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) return null;

    const result = await response.json();
    return result.event_details as EventDetailsSEO;
  } catch (error) {
    console.error("Failed to fetch metadata event details:", error);
    return null;
  }
}

// Generate Dynamic Metadata (Runs on Server)
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const eventDetails = await getEventDetails(params.id);

  if (!eventDetails) {
    return {
      title: "Tournament Not Found",
      description: "This event could not be loaded or does not exist.",
    };
  }

  const prizepoolFormatted = parseFloat(
    eventDetails.prizepool
  ).toLocaleString();
  const title = `${
    eventDetails.event_name
  } | Prize $${prizepoolFormatted} | ${eventDetails.tournament_tier.toUpperCase()}`;
  const description = `Join the ${eventDetails.event_name} tournament! The prize pool is $${prizepoolFormatted}. Game format: ${eventDetails.event_mode}. Register now!`;
  const imageUrl =
    eventDetails.event_banner_url || "/default-tournament-banner.jpg";
  const canonicalUrl = `${env.NEXT_PUBLIC_URL}/tournaments/${params.id}`;

  return {
    metadataBase: new URL(env.NEXT_PUBLIC_URL),
    title: title,
    description: description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: title,
      description: description,
      url: canonicalUrl,
      siteName: "Your Platform Name", // Replace with your actual platform name
      images: [{ url: imageUrl }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: title,
      description: description,
      images: [imageUrl],
    },
  };
}
