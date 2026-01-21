import React from "react";
import { EventDetailsWrapper } from "./_components/EventDetailsWrapper";
import { Metadata, ResolvingMetadata } from "next";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

type Params = Promise<{
  id: string;
}>;

// export async function generateMetadata(
//   { params }: { params: Params },
//   parent: ResolvingMetadata,
// ): Promise<Metadata> {
//   const { id } = await params;

//   // Read token from cookies
//   const cookieStore = await cookies();
//   const token = cookieStore.get("auth_token")?.value;

//   try {
//     // Fetch data from your API with authentication
//     const response = await fetch(
//       `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           ...(token && { Authorization: `Bearer ${token}` }),
//         },
//         body: JSON.stringify({ event_id: id }),
//         // Add cache options for better performance
//         cache: "no-store", // or 'force-cache' depending on your needs
//       },
//     );

//     if (!response.ok) {
//       console.error(
//         "Failed to fetch event details for metadata:",
//         response.status,
//       );
//       return {
//         title: "Event Not Found | AFC",
//         description: "The requested tournament could not be found.",
//       };
//     }

//     const result = await response.json();
//     const event = result.event_details;

//     if (!event) {
//       return {
//         title: "Event Not Found | AFC",
//         description: "The requested tournament could not be found.",
//       };
//     }

//     // Create description from available fields
//     const description =
//       event.event_rules ||
//       `Join us for ${event.event_name}. ${event.competition_type} tournament with $${event.prizepool} prize pool.` ||
//       "Join us for this amazing tournament!";

//     return {
//       title: `${event.event_name} | AFC Tournaments`,
//       description: description,
//       openGraph: {
//         title: event.event_name,
//         description: description,
//         images: [
//           {
//             url: event.event_banner_url || "/default-event-image.jpg",
//             width: 1200,
//             height: 630,
//             alt: event.event_name,
//           },
//         ],
//         type: "website",
//         siteName: "AFC Tournaments",
//       },
//       twitter: {
//         card: "summary_large_image",
//         title: event.event_name,
//         description: description,
//         images: [event.event_banner_url || "/default-event-image.jpg"],
//       },
//       // Additional metadata for better SEO
//       keywords: [
//         event.event_name,
//         event.event_mode,
//         event.competition_type,
//         "gaming tournament",
//         "esports",
//       ].filter(Boolean),
//     };
//   } catch (error) {
//     console.error("Error generating metadata:", error);
//     return {
//       title: "Tournament Details | AFC",
//       description:
//         "View tournament details, standings, and registration information.",
//     };
//   }
// }

export async function generateMetadata(
  { params }: { params: Params },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  try {
    const response = await fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
      {
        method: "POST", // Consider changing to GET if backend allows
        headers: {
          "Content-Type": "application/json",
          // If token is missing (crawler), the API must still return public data
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ event_id: id }),
        next: { revalidate: 60 }, // Better than no-store for SEO performance
      },
    );

    if (!response.ok) {
      // Fallback metadata if API fails or is restricted
      return { title: "Tournament Details | AFC" };
    }

    const result = await response.json();
    const event = result.event_details;

    // Ensure image is absolute
    const ogImage =
      event.event_banner_url ||
      env.NEXT_PUBLIC_URL ||
      "https://africanfreefirecommunity.com";

    return {
      title: `${event.event_name} | AFC`,
      description: event.event_rules || "Join this tournament!",
      openGraph: {
        title: event.event_name,
        description: event.event_rules,
        images: [ogImage], // Ensure this is a full URL
      },
      // ... rest of your config
    };
  } catch (e) {
    return { title: "Tournament Details | AFC" };
  }
}

const Page = async ({ params }: { params: Params }) => {
  const { id } = await params;

  return (
    <div>
      <EventDetailsWrapper id={id} />
    </div>
  );
};

export default Page;
