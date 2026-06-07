// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Open Graph image for a single PLAYER  ·  /players/<username>
//
// Next.js file-convention image route: renders the 1200x630 og:image shown when a
// player profile link is shared. We generate a BRANDED card (dark AFC background,
// green/gold accents, the player IGN, their team, and headline stats: kills, wins,
// KDR) with Next's ImageResponse, fetching REAL data from the public, no-auth,
// no-PII endpoint POST /player/get-public-player-stats/ — the same data the page
// and its generateMetadata use. The player's avatar/esports picture is composited
// into the card when present.
//
// Why a generated card instead of just the avatar: avatars are often small or
// portrait and embed poorly; a branded 1200x630 card always reads well in a large
// Twitter/Discord embed. The route's page.tsx (generateMetadata) supplies the
// other OG tags; this file supplies the image.
//
// Connects to: app/(user)/players/[username]/page.tsx (metadata + PlayerClient),
// lib/seo.ts (AFC palette mirrored below), backend get_public_player_stats.
// ─────────────────────────────────────────────────────────────────────────────
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AFC player profile";
export const revalidate = 3600;

// AFC palette (mirrors globals.css). Plain hex because Satori has no oklch().
const BG = "#0a0a0a";
const PRIMARY = "#22c55e";
const GOLD = "#fbbf24";
const MUTED = "#a1a1aa";

async function getPlayer(ign: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/player/get-public-player-stats/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_ign: decodeURIComponent(ign) }),
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.player;
  } catch {
    return null;
  }
}

// Satori (the ImageResponse renderer) throws HARD if it cannot fetch an <img>
// src, which would 500 the whole OG route. So we probe the avatar/logo URL first
// and only use it when it actually resolves (200). On any failure we return null
// and the card renders its initial-letter fallback instead. This keeps the OG
// image route resilient to missing media (common after a DB clone, and possible
// in prod for any one broken upload).
async function resolveImage(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    return res.ok ? url : null;
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const player = await getPlayer(username);

  const name = player?.username || decodeURIComponent(username);
  const teamName = player?.team?.team_name || null;
  const role = player?.in_game_role || null;
  // Probe the avatar before handing it to Satori so a missing image can't 500
  // the route (falls back to the initial-letter avatar below).
  const avatar = await resolveImage(
    player?.esports_picture || player?.profile_picture || null,
  );

  // Headline stat chips from REAL aggregates, only when present (truthful).
  const stats: { label: string; value: string }[] = [];
  if (player?.total_kills != null)
    stats.push({ label: "Kills", value: String(player.total_kills) });
  if (player?.total_wins != null)
    stats.push({ label: "Wins", value: String(player.total_wins) });
  if (player?.kdr != null)
    stats.push({ label: "KDR", value: String(player.kdr) });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          backgroundImage: `radial-gradient(circle at 0% 0%, rgba(34,197,94,0.20), transparent 45%), radial-gradient(circle at 100% 100%, rgba(251,191,36,0.18), transparent 45%)`,
          padding: 72,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top: AFC wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: PRIMARY,
              letterSpacing: 1,
            }}
          >
            AFC
          </div>
          <div style={{ fontSize: 22, color: MUTED }}>
            African Freefire Community
          </div>
        </div>

        {/* Middle: avatar + IGN + team / role line */}
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              width={190}
              height={190}
              alt=""
              style={{
                borderRadius: 999,
                objectFit: "cover",
                border: `4px solid ${PRIMARY}`,
              }}
            />
          ) : (
            <div
              style={{
                width: 190,
                height: 190,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#18181b",
                border: `4px solid ${PRIMARY}`,
                fontSize: 96,
                fontWeight: 800,
                color: PRIMARY,
              }}
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                fontSize: name.length > 16 ? 64 : 82,
                fontWeight: 800,
                lineHeight: 1.05,
                maxWidth: 740,
              }}
            >
              {name}
            </div>
            {/* Satori requires display:flex on any node with >1 child, so this
                team/role line is an explicit flex row. */}
            <div style={{ display: "flex", fontSize: 30, color: MUTED }}>
              <span>{teamName ? teamName : "Free Fire player"}</span>
              {role ? <span style={{ color: GOLD }}>{` · ${role}`}</span> : null}
            </div>
          </div>
        </div>

        {/* Bottom: headline stat chips, or a tagline when the player has no stats */}
        <div style={{ display: "flex", gap: 36 }}>
          {stats.length > 0 ? (
            stats.map((s) => (
              <div
                key={s.label}
                style={{ display: "flex", flexDirection: "column" }}
              >
                <div style={{ fontSize: 46, fontWeight: 800, color: PRIMARY }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 24, color: MUTED }}>{s.label}</div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 28, color: MUTED }}>
              Free Fire esports athlete on AFC
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
