import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerClient } from "./_components/PlayerClient"; // Adjust path as needed
import { env } from "@/lib/env";
// Existence-aware detail fetch (lib/detailFetch.ts): "missing" = confirmed backend
// 404 (User.DoesNotExist) → notFound() (real 404); "error" = transient → keep the
// 200 fallback so a live profile is never deindexed on an API blip.
import { fetchDetail } from "@/lib/detailFetch";
// Shared link-embed builder + image resolver (lib/seo.ts). buildEntityMetadata
// emits a LARGE Twitter card and absolute, crawler-safe URLs; resolveOgImage
// proxies a backend /media/ avatar through /api/og-image so crawlers can fetch it.
//   generatePlayerSchema     → JSON-LD Person/ProfilePage for this athlete
//   generateBreadcrumbSchema → Home > Players > <ign> trail
//   jsonLd                   → render a schema object as a <script ld+json>
import {
  buildEntityMetadata,
  resolveOgImage,
  generatePlayerSchema,
  generateBreadcrumbSchema,
  siteConfig,
  jsonLd,
} from "@/lib/seo";

type Params = Promise<{
  username: string;
}>;

// Server-side fetch of the public player (no auth, no PII). Same endpoint the
// client reads + the metadata uses, so Next's fetch cache de-dupes the call.
// Returns the player object or null on any failure (callers fall back gracefully).
async function getPlayerData(ign: string) {
  return fetchDetail(
    `${env.NEXT_PUBLIC_BACKEND_API_URL}/player/get-public-player-stats/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_ign: ign }),
      next: { revalidate: 3600 },
    },
    (j) => j?.player,
  );
}

// ── generateMetadata: rich link embed for a single player profile ────────────
// Data source: POST /player/get-public-player-stats/ (public, no auth, no PII) —
// the SAME endpoint PlayerClient reads, so the embed matches what the page shows.
// Response shape: { player: { username, team: {team_name,...}|null,
//   profile_picture, esports_picture, kdr, total_kills, total_wins, win_rate, ... } }.
// The embed surfaces the player IGN + team + headline stats (kills / wins / KDR)
// and uses the profile/esports picture as the image. Falls back to site-default
// metadata when the player is missing — never throws.
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { username } = await params;
  const ign = decodeURIComponent(username);

  // Re-use the shared helper (Next de-dupes nothing for POST, but keeping ONE
  // fetch path means the metadata + the page agree on existence).
  const result = await getPlayerData(ign);
  // Confirmed-gone player (backend 404 → User.DoesNotExist) → real 404.
  if (result.status === "missing") notFound();

  try {
    const player = result.status === "ok" ? result.data : null;

    // Transient failure (not a confirmed 404) → branded fallback embed at 200,
    // never a broken one. omitImage: opengraph-image.tsx renders the branded card.
    if (!player) {
      return buildEntityMetadata({
        title: ign,
        description: `View ${ign}'s Free Fire player profile, stats, and tournament history on African Freefire Community.`,
        path: `/players/${username}`,
        type: "profile",
        omitImage: true,
      });
    }

    // team is an object ({ team_name, ... }) or null on the public endpoint.
    const teamName = player.team?.team_name;

    // Build a concise, info-rich description from the player's REAL aggregates.
    // Only stats that are actually present are included (truthful, no fabrication).
    const statBits: string[] = [];
    if (player.total_kills != null) statBits.push(`${player.total_kills} kills`);
    if (player.total_wins != null) statBits.push(`${player.total_wins} wins`);
    if (player.kdr != null) statBits.push(`${player.kdr} KDR`);

    const lead = teamName
      ? `${player.username} plays for ${teamName}.`
      : `${player.username} is a Free Fire esports athlete.`;
    const description =
      statBits.length > 0
        ? `${lead} ${statBits.join(" · ")}. View full stats and tournament history on AFC.`
        : `${lead} View stats, roles, and tournament history on African Freefire Community.`;

    return buildEntityMetadata({
      title: player.username,
      description,
      path: `/players/${username}`,
      // omitImage: the sibling opengraph-image.tsx renders a branded 1200x630 card
      // (avatar + IGN + team + kills/wins/KDR) as THE og:image. A raw avatar is
      // often small/portrait and embeds poorly; the card always reads well. This
      // avoids a second, competing og:image tag.
      omitImage: true,
      type: "profile",
      tags: [
        player.username,
        teamName,
        player.in_game_role,
        "Free Fire player",
        "esports player",
      ].filter(Boolean) as string[],
    });
  } catch (error) {
    console.error("Error generating player metadata:", error);
    return buildEntityMetadata({
      title: ign,
      description: `View ${ign}'s Free Fire player profile on African Freefire Community.`,
      path: `/players/${username}`,
      type: "profile",
      omitImage: true,
    });
  }
}

const Page = async ({ params }: { params: Params }) => {
  const { username } = await params;
  const ign = decodeURIComponent(username);

  // Re-use the cached public-stats fetch to embed JSON-LD in the INITIAL HTML.
  // The interactive profile still renders via <PlayerClient> below, unaffected.
  const result = await getPlayerData(ign);
  // Confirmed-gone player (backend 404) → real 404. Transient errors fall
  // through to player=null and render at 200 (PlayerClient retries).
  if (result.status === "missing") notFound();
  const player = result.status === "ok" ? result.data : null;

  let playerSchema: object | null = null;
  let breadcrumbSchema: object | null = null;
  if (player) {
    const path = `/players/${username}`;
    const teamName = player.team?.team_name || null;
    // Only the stats that actually exist (truthful, no fabricated numbers).
    const stats: string[] = [];
    if (player.total_kills != null) stats.push(`${player.total_kills} kills`);
    if (player.total_wins != null) stats.push(`${player.total_wins} wins`);
    if (player.kdr != null) stats.push(`${player.kdr} KDR`);

    playerSchema = generatePlayerSchema({
      name: player.username,
      url: `${siteConfig.url}${path}`,
      // Proxy the backend avatar so crawlers can fetch it; null → site default.
      image: resolveOgImage(player.profile_picture || player.esports_picture),
      teamName,
      country: player.country || null,
      stats,
    });
    breadcrumbSchema = generateBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Players", path: "/players" },
      { name: player.username, path },
    ]);
  }

  return (
    <main className="mx-auto py-6">
      {playerSchema && <script {...jsonLd(playerSchema)} />}
      {breadcrumbSchema && <script {...jsonLd(breadcrumbSchema)} />}
      <PlayerClient username={username} />
    </main>
  );
};

export default Page;
