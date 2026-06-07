import { Metadata } from "next";
// Shared link-embed plumbing (lib/seo.ts):
//   buildEntityMetadata    → LARGE Twitter card + absolute og:url/og:image/canonical
//   resolveOgImage         → proxy a backend /media/ logo through /api/og-image
//   generateTeamSchema     → JSON-LD SportsTeam for Google rich results
//   generateBreadcrumbSchema → Home > Teams > <team> trail
//   jsonLd                 → render a schema object as a <script ld+json>
import {
  buildEntityMetadata,
  resolveOgImage,
  generateTeamSchema,
  generateBreadcrumbSchema,
  formatTier,
  siteConfig,
  jsonLd,
} from "@/lib/seo";

// NOTE ON THE WRAPPER PATTERN:
// app/(user)/teams/[id]/page.tsx is a CLIENT component ("use client" — it uses
// hooks, dialogs, auth). Client components CANNOT export generateMetadata, so the
// route's metadata lives here in this SERVER layout instead. The layout fetches
// the team's REAL data and returns the rich embed; the client page renders below
// via {children}, so the interactive UI is completely unaffected.
type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

// Server-side fetch of the team for SEO. Hits the backend base URL directly
// (POST /team/get-team-details/, the SAME endpoint the client page reads).
// Response: { team: { team_name, team_logo (absolute), team_tier, country,
//   total_members, team_description, ... } }. Returns null on any failure so
// generateMetadata can fall back gracefully (never throws).
async function getTeamData(teamName: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_name: decodeURIComponent(teamName) }),
        next: { revalidate: 60 },
      },
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.team;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const teamName = decodeURIComponent(id);
  const team = await getTeamData(id);

  // Missing team → branded fallback embed (still a large card). Image is omitted
  // here too: the sibling opengraph-image.tsx still renders a branded card (it
  // falls back to the team name), so it remains the single og:image.
  if (!team) {
    return buildEntityMetadata({
      title: teamName,
      description: `View the ${teamName} Free Fire team on African Freefire Community: roster, stats, and tournament history.`,
      path: `/teams/${id}`,
      omitImage: true,
    });
  }

  // Info-rich description from the team's REAL fields: tier, country, member count.
  // formatTier normalizes the raw tier code ("3") into a clean label ("Tier 3").
  const tier = formatTier(team.team_tier);
  const tierBit = tier ? `${tier} ` : "";
  const fromCountry = team.country ? ` from ${team.country}` : "";
  const memberBit =
    team.total_members != null ? ` ${team.total_members}-player roster.` : "";
  const description =
    `${team.team_name} is a ${tierBit}Free Fire esports team${fromCountry} on AFC.${memberBit} View roster, stats, and tournament history.`.trim();

  // Absolute, crawler-safe path to the team page (encode the name for the URL).
  const path = `/teams/${encodeURIComponent(team.team_name)}`;

  // NOTE: JSON-LD is NOT emitted here via `other`. Next renders `other` keys as
  // <meta> tags, and a `<meta name="script:ld+json">` is NOT valid structured
  // data (crawlers ignore it). The SportsTeam + BreadcrumbList JSON-LD is instead
  // rendered as a real <script type="application/ld+json"> in the layout body
  // below, so it lands in the initial HTML where Google/AI crawlers read it.
  return buildEntityMetadata({
    title: team.team_name,
    description,
    path,
    // The sibling opengraph-image.tsx renders a branded 1200x630 card (logo +
    // name + tier + stats) as THE og:image for this route — a raw logo embeds
    // poorly, the card always reads well. omitImage avoids a second, competing
    // og:image tag. The JSON-LD below still references the real logo.
    omitImage: true,
    tags: [
      team.team_name,
      "Free Fire team",
      team.country,
      team.team_tier,
      "esports team",
    ].filter(Boolean) as string[],
  });
}

export default async function TeamDetailLayout({ children, params }: Props) {
  // Re-use the same team fetch (Next caches the identical request from
  // generateMetadata) to embed real JSON-LD in the INITIAL HTML. The client page
  // still renders via {children}, completely unaffected.
  const { id } = await params;
  const team = await getTeamData(id);

  let teamSchema: object | null = null;
  let breadcrumbSchema: object | null = null;
  if (team) {
    const path = `/teams/${encodeURIComponent(team.team_name)}`;
    const tier = formatTier(team.team_tier);
    const tierBit = tier ? `${tier} ` : "";
    const description = `${team.team_name} is a ${tierBit}Free Fire esports team on AFC. View roster, stats, and tournament history.`;
    teamSchema = generateTeamSchema({
      name: team.team_name,
      description,
      image: resolveOgImage(team.team_logo),
      url: `${siteConfig.url}${path}`,
      country: team.country,
    });
    breadcrumbSchema = generateBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Teams", path: "/teams" },
      { name: team.team_name, path },
    ]);
  }

  return (
    <>
      {teamSchema && <script {...jsonLd(teamSchema)} />}
      {breadcrumbSchema && <script {...jsonLd(breadcrumbSchema)} />}
      {children}
    </>
  );
}
