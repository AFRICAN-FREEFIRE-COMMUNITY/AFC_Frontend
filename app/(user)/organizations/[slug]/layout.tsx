import { Metadata } from "next";
// Shared link-embed builder (lib/seo.ts) — LARGE Twitter card + absolute URLs;
// resolveOgImage (used inside it) proxies a backend /media/ banner through
// /api/og-image so social crawlers can fetch it.
//   generatePublicOrgSchema  → JSON-LD Organization for this organizer
//   generateBreadcrumbSchema → Home > Organizations > <org> trail
//   jsonLd                   → render a schema object as a <script ld+json>
import {
  buildEntityMetadata,
  resolveOgImage,
  generatePublicOrgSchema,
  generateBreadcrumbSchema,
  siteConfig,
  jsonLd,
} from "@/lib/seo";

// WRAPPER PATTERN (same as teams/[id]/layout.tsx):
// app/(user)/organizations/[slug]/page.tsx is a CLIENT component ("use client" —
// it fetches via organizersApi in useEffect and renders dialogs). Client
// components cannot export generateMetadata, so the route's rich link embed lives
// here in this SERVER layout. The client page still renders below via {children},
// so the interactive org page is completely unaffected.
type Props = {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
};

// Server-side fetch of the public org for SEO. Hits the SAME public endpoint the
// client page reads: GET /organizers/get-organization-public/<slug>/ (no auth).
// Response: { name, slug, logo, default_banner, description, socials,
//   events: [...], rating }. Suspended / deleted / missing orgs return 404 → null,
// so generateMetadata falls back gracefully. Never throws.
async function getOrgData(slug: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizers/get-organization-public/${encodeURIComponent(
        decodeURIComponent(slug),
      )}/`,
      { next: { revalidate: 60 } },
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const org = await getOrgData(slug);

  // Missing / suspended org → branded fallback embed (still a large card).
  if (!org) {
    return buildEntityMetadata({
      title: "Organization",
      description:
        "View Free Fire tournament organizers and their events on African Freefire Community.",
      path: `/organizations/${slug}`,
    });
  }

  // Info-rich description from the org's REAL data: its own short description (if
  // present) plus a truthful event count. Keeps the embed specific to this org.
  const eventCount = Array.isArray(org.events) ? org.events.length : 0;
  const eventBit =
    eventCount > 0
      ? `${eventCount} event${eventCount === 1 ? "" : "s"} on AFC.`
      : "Tournament organizer on AFC.";
  const ownDesc = (org.description || "").replace(/\s+/g, " ").trim();
  const description = (
    ownDesc ? `${ownDesc} ${eventBit}` : `${org.name}: ${eventBit} View their events and ratings.`
  ).slice(0, 180);

  return buildEntityMetadata({
    title: org.name,
    description,
    path: `/organizations/${org.slug || slug}`,
    // Prefer the wide default banner for a large card; fall back to the logo.
    // resolveOgImage (inside the builder) proxies backend /media/ paths.
    image: org.default_banner || org.logo || null,
    tags: [org.name, "tournament organizer", "Free Fire", "esports"].filter(
      Boolean,
    ),
  });
}

export default async function OrganizationLayout({ children, params }: Props) {
  // Re-use the cached org fetch (same request as generateMetadata) to embed real
  // JSON-LD in the INITIAL HTML. The client org page still renders via {children}.
  const { slug } = await params;
  const org = await getOrgData(slug);

  let orgSchema: object | null = null;
  let breadcrumbSchema: object | null = null;
  if (org) {
    const path = `/organizations/${org.slug || slug}`;
    orgSchema = generatePublicOrgSchema({
      name: org.name,
      url: `${siteConfig.url}${path}`,
      // Prefer logo for the Organization mark; proxy backend /media/ via og-image.
      logo: resolveOgImage(org.logo || org.default_banner),
      description: org.description,
    });
    breadcrumbSchema = generateBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Organizations", path: "/organizations" },
      { name: org.name, path },
    ]);
  }

  return (
    <>
      {orgSchema && <script {...jsonLd(orgSchema)} />}
      {breadcrumbSchema && <script {...jsonLd(breadcrumbSchema)} />}
      {children}
    </>
  );
}
