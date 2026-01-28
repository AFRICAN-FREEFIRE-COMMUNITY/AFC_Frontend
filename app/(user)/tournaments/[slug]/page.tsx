import { EventDetailsWrapper } from "./_components/EventDetailsWrapper";
import { Metadata } from "next";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { generateDynamicMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
};

// 1. Centralized Fetch Function
async function getEventData(slug: string) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    const response = await fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details-not-logged-in/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slug: decodeURIComponent(slug) }),
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
  const { slug } = await params;
  const decodedId = decodeURIComponent(slug);
  const data = await getEventData(slug);

  // Fallback if the API fails or the bot can't authenticate
  if (!data) {
    return generateDynamicMetadata({
      title: "Tournament Details",
      description: `View tournament details and registration information on AFC.`,
      url: `/events/${slug}`,
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
    : `${env.NEXT_PUBLIC_URL}/${rawImage}`;

  const baseMetadata = generateDynamicMetadata({
    title: title,
    description: description,
    image: absoluteImageUrl,
    url: `/events/${slug}`,
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
  const { slug } = await params;

  return (
    <main>
      <EventDetailsWrapper slug={slug} />
    </main>
  );
};

export default Page;
