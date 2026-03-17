import { EventDetailsWrapper } from "./_components/EventDetailsWrapper";
import { Metadata } from "next";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { generateDynamicMetadata, siteConfig } from "@/lib/seo";
import { ProtectedRoute } from "../../_components/ProtectedRoute";

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
  const data = await getEventData(slug);

  // Fallback if the API fails
  if (!data) {
    return generateDynamicMetadata({
      title: "Tournament Details",
      description: "View tournament details and registration information on AFC.",
      url: `/tournaments/${slug}`,
    });
  }

  const title = data.event_name || data.team_name || "Tournament";

  // Build a concise, info-rich description
  const parts: string[] = [];
  if (data.competition_type && data.participant_type)
    parts.push(`${data.competition_type} • ${data.participant_type}`);
  if (data.prizepool && parseFloat(data.prizepool) > 0)
    parts.push(`Prize Pool: $${parseFloat(data.prizepool).toLocaleString()}`);
  if (data.start_date) parts.push(`Starts: ${data.start_date}`);
  if (data.event_status) parts.push(`Status: ${data.event_status}`);
  const description =
    parts.length > 0
      ? `${title} — ${parts.join(" • ")}`
      : `${title} is a competitive tournament on African Freefire Community. Register now!`;

  // Safely resolve the banner URL — never let null/undefined produce a broken URL
  const rawImage = data.event_banner_url || data.team_logo;
  const absoluteImageUrl =
    rawImage && typeof rawImage === "string"
      ? rawImage.startsWith("http")
        ? rawImage
        : `${env.NEXT_PUBLIC_URL}/${rawImage}`
      : siteConfig.ogImage;

  const canonicalUrl = `${siteConfig.url}/tournaments/${slug}`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | AFC`,
      description,
      url: canonicalUrl,
      siteName: siteConfig.name,
      images: [
        {
          url: absoluteImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | AFC`,
      description,
      images: [absoluteImageUrl],
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

// 3. Page Component
const Page = async ({ params }: Props) => {
  const { slug } = await params;

  return (
    <ProtectedRoute>
      <EventDetailsWrapper slug={slug} />
    </ProtectedRoute>
  );
};

export default Page;
