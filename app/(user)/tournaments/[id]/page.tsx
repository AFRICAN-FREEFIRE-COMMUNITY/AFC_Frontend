// import { EventDetailsWrapper } from "./_components/EventDetailsWrapper";
// import { Metadata, ResolvingMetadata } from "next";
// import { cookies } from "next/headers";
// import { env } from "@/lib/env";
// import { generateDynamicMetadata } from "@/lib/seo";

// type Props = {
//   params: Promise<{ id: string }>;
// };

// async function getTeamData(teamName: string) {
//   try {
//     const response = await fetch(
//       `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ event_id: decodeURIComponent(teamName) }),
//         next: { revalidate: 60 },
//       },
//     );

//     if (!response.ok) {
//       console.log("sss");
//       return null;
//     }

//     const data = await response.json();
//     console.log(data);
//     // return data.team;
//   } catch (error) {
//     return null;
//   }
// }

// export async function generateMetadata({ params }: Props): Promise<Metadata> {
//   const { id } = await params;
//   const teamName = decodeURIComponent(id);
//   const team = await getTeamData(id);

//   if (!team) {
//     return generateDynamicMetadata({
//       title: teamName,
//       description: `View ${teamName} team profile on the African Freefire Community. See roster, stats, and achievements.`,
//       url: `/teams/${id}`,
//     });
//   }

//   const description = `${team.team_name} is a ${
//     team.team_tier || "competitive"
//   } Free Fire esports team from ${
//     team.country || "Africa"
//   } on AFC. View roster, stats, tournament history, and achievements.`;

//   return {
//     ...generateDynamicMetadata({
//       title: team.team_name,
//       description,
//       image: team.team_logo || undefined,
//       url: `/teams/${encodeURIComponent(team.team_name)}`,
//       tags: [
//         team.team_name,
//         "Free Fire team",
//         team.country,
//         team.team_tier,
//         "esports team",
//       ].filter(Boolean) as string[],
//     }),
//     other: {
//       "script:ld+json": JSON.stringify(
//         generateTeamSchema({
//           name: team.team_name,
//           description,
//           image: team.team_logo,
//           url: `/teams/${encodeURIComponent(team.team_name)}`,
//           memberCount: team.member_count,
//           country: team.country,
//         }),
//       ),
//     },
//   };
// }
// const Page = async ({ params }: Props) => {
//   const { id } = await params;

//   return (
//     <div>
//       <EventDetailsWrapper id={id} />
//     </div>
//   );
// };

// export default Page;

import { EventDetailsWrapper } from "./_components/EventDetailsWrapper";
import { Metadata } from "next";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { generateDynamicMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ id: string }>;
};

// 1. Centralized Fetch Function
async function getEventData(id: string) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    const response = await fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Pass the token if it exists (for users),
          // but the API should ideally allow public access for crawlers
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ event_id: decodeURIComponent(id) }),
        next: { revalidate: 60 },
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    // Adjusted to match your previous result structure
    return data.event_details || data.team || null;
  } catch (error) {
    console.error("Metadata Fetch Error:", error);
    return null;
  }
}

// 2. Metadata Generation
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const data = await getEventData(id);

  // Fallback if the API fails or the bot can't authenticate
  if (!data) {
    return generateDynamicMetadata({
      title: "Tournament Details",
      description: `View tournament details and registration information on AFC.`,
      url: `/events/${id}`,
    });
  }

  const title = data.event_name || data.team_name;
  const description =
    data.event_rules ||
    `${title} is a competitive tournament on African Freefire Community. Join now!`;

  // CRITICAL: Ensure image URL is absolute for OG tags
  const rawImage = data.event_banner_url || data.team_logo;
  const absoluteImageUrl = rawImage?.startsWith("http")
    ? rawImage
    : `${env.NEXT_PUBLIC_APP_URL}${rawImage}`;

  const baseMetadata = generateDynamicMetadata({
    title: title,
    description: description,
    image: absoluteImageUrl,
    url: `/events/${id}`,
    tags: [title, "AFC", "Free Fire", "Gaming"].filter(Boolean),
  });

  return {
    ...baseMetadata,
    // Ensure OpenGraph is explicitly defined if your helper doesn't do it perfectly
    openGraph: {
      ...baseMetadata.openGraph,
      images: [{ url: absoluteImageUrl }],
      type: "website",
    },
    // Optional: Add Structured Data for Google
    other: {
      "script:ld+json": JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Event",
        name: title,
        description: description,
        image: absoluteImageUrl,
      }),
    },
  };
}

// 3. Page Component
const Page = async ({ params }: Props) => {
  const { id } = await params;

  return (
    <main>
      <EventDetailsWrapper id={id} />
    </main>
  );
};

export default Page;
