import { EventDetailsWrapper } from "./_components/EventDetailsWrapper";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/lib/env";
// Existence-aware detail fetch (lib/detailFetch.ts): distinguishes a CONFIRMED
// backend 404 ("missing" → notFound() → a real 404, no soft-404) from a TRANSIENT
// error ("error" → keep the 200 fallback so a live event is never deindexed).
import { fetchDetail } from "@/lib/detailFetch";
// SEO helpers (lib/seo.ts):
//   generateDynamicMetadata → OG/Twitter fallback metadata
//   generateEventSchema     → JSON-LD SportsEvent for this tournament
//   generateBreadcrumbSchema→ Home > Tournaments > <event> trail
//   resolveOgImage          → proxy the backend banner so crawlers can fetch it
//   jsonLd                  → render a schema object as a <script ld+json>
import {
  generateDynamicMetadata,
  siteConfig,
  generateEventSchema,
  generateBreadcrumbSchema,
  resolveOgImage,
  jsonLd,
} from "@/lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
};

// 1. Centralized Fetch Function
// Returns a DetailResult: "ok" with the event, "missing" on a backend 404
// (unknown slug, or the event's org is suspended/deleted), or "error" on any
// transient failure. Public endpoint — no auth needed.
async function getEventData(slug: string) {
  return fetchDetail(
    `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details-not-logged-in/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: decodeURIComponent(slug) }),
      next: { revalidate: 60 },
    },
    // The endpoint returns the event under event_details (or team for the
    // legacy team shape); either present means the event loaded.
    (j) => j?.event_details ?? j?.team,
  );
}

// 2. Metadata Generation
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getEventData(slug);

  // Confirmed-gone event (backend 404) → real 404, not a soft-404 with metadata.
  if (result.status === "missing") notFound();
  // Transient failure → fall back to generic metadata at 200 (never deindex).
  const data = result.status === "ok" ? result.data : null;
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
      ? `${title} - ${parts.join(" • ")}`
      : `${title} is a competitive tournament on African Freefire Community. Register now!`;

  // Safely resolve the banner URL - proxy through our domain so crawlers can reach it
  const rawImage = data.event_banner_url || data.team_logo;
  const resolvedImage =
    rawImage && typeof rawImage === "string"
      ? rawImage.startsWith("http")
        ? rawImage
        : `${env.NEXT_PUBLIC_URL}/${rawImage.replace(/^\//, "")}`
      : null;
  const absoluteImageUrl = resolvedImage
    ? `${siteConfig.url}/api/og-image?url=${encodeURIComponent(resolvedImage)}`
    : siteConfig.ogImage;

  // Canonicalize to the event's TRUE slug from the backend (not the URL param),
  // so case/encoding variants of the same event collapse to one canonical URL
  // (fixes GSC "Duplicate without user-selected canonical"). Falls back to the
  // requested slug when the payload omits one.
  const canonicalUrl = `${siteConfig.url}/tournaments/${data.slug || slug}`;

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
//
// We re-use getEventData (already memoized-ish via Next fetch cache from
// generateMetadata's identical request) to embed JSON-LD in the INITIAL HTML.
// This is what search + AI crawlers read — the interactive UI still renders
// entirely inside the client EventDetailsWrapper below, unaffected.
const Page = async ({ params }: Props) => {
  const { slug } = await params;
  const result = await getEventData(slug);

  // Confirmed-gone event (backend 404) → real 404. Transient errors fall through
  // to data=null and render the wrapper at 200 (the client retries gracefully).
  if (result.status === "missing") notFound();
  const data = result.status === "ok" ? result.data : null;

  // Build the structured data only when the event actually loaded (graceful
  // fallback: no <script> rather than a schema full of nulls).
  let eventSchema: object | null = null;
  let breadcrumbSchema: object | null = null;
  if (data) {
    const eventName = data.event_name || "Tournament";
    const canonicalUrl = `${siteConfig.url}/tournaments/${data.slug || slug}`;
    eventSchema = generateEventSchema({
      name: eventName,
      url: canonicalUrl,
      startDate: data.start_date,
      endDate: data.end_date,
      // Proxy the backend banner through /api/og-image so crawlers can fetch it.
      image: data.event_banner_url ? resolveOgImage(data.event_banner_url) : null,
      // The not-logged-in detail endpoint omits org name/slug; the list endpoint
      // carries them. Pass through if present, otherwise omit (no fabrication).
      organizerName: data.organization_name || null,
      organizerSlug: data.organization_slug || null,
      // prizepool is free text ("1750.0 WORTH OF PRIZES") → surfaced as an offer note.
      prizeText: data.prizepool || null,
    });
    breadcrumbSchema = generateBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Tournaments", path: "/tournaments" },
      { name: eventName, path: `/tournaments/${slug}` },
    ]);
  }

  return (
    <>
      {eventSchema && <script {...jsonLd(eventSchema)} />}
      {breadcrumbSchema && <script {...jsonLd(breadcrumbSchema)} />}
      <EventDetailsWrapper slug={slug} />
    </>
  );
};

export default Page;
