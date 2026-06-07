// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Open Graph image for a single TEAM  ·  /teams/<id>
//
// Next.js file-convention image route: this renders the 1200x630 og:image that
// social platforms show when /teams/<name> is shared. We generate a BRANDED card
// (dark AFC background, green/gold accents, the team name, tier, country, and a
// couple of headline stats) with Next's ImageResponse, fetching the team's REAL
// data from the same backend endpoint the page uses (POST /team/get-team-details/).
//
// Why a generated card instead of just the logo: a raw team logo is often small,
// square, or transparent and embeds poorly. A branded 1200x630 card always reads
// well in a large Twitter/Discord embed. The team logo is composited INTO the card
// when present. The route's layout.tsx (generateMetadata) sets the rest of the OG
// tags; this file supplies the image itself.
//
// Connects to: app/(user)/teams/[id]/layout.tsx (metadata), lib/seo.ts (colors via
// the AFC palette mirrored below), backend afc_team/views.get_team_details.
// ─────────────────────────────────────────────────────────────────────────────
import { ImageResponse } from "next/og";
import { formatTier } from "@/lib/seo";

// Required exports for a Next image route: fixed OG size + content type.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AFC team profile";
// Revalidate the generated image hourly so stats stay reasonably fresh without
// regenerating on every crawl.
export const revalidate = 3600;

// AFC palette (mirrors globals.css: dark bg, green primary, gold accent). Kept as
// plain hex here because ImageResponse's Satori renderer does not support oklch().
const BG = "#0a0a0a";
const PRIMARY = "#22c55e"; // AFC green
const GOLD = "#fbbf24"; // AFC gold accent
const MUTED = "#a1a1aa";

async function getTeam(id: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_name: decodeURIComponent(id) }),
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.team;
  } catch {
    return null;
  }
}

// Satori throws HARD if it cannot fetch an <img> src, which would 500 the whole
// OG route. Probe the logo URL first and only use it when it resolves (200); on
// any failure render the initial-letter fallback instead. Keeps the route
// resilient to missing media (common after a DB clone, possible in prod too).
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
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const team = await getTeam(id);

  const name = team?.team_name || decodeURIComponent(id);
  // Clean tier label ("Tier 3") from the raw code ("3"); null when no tier.
  const tier = formatTier(team?.team_tier);
  const country = team?.country || null;
  const wins = team?.total_wins ?? null;
  const avgKills = team?.average_kills ?? null;
  const winRate = team?.win_rate ?? null;
  // Probe the logo before handing it to Satori so a missing image can't 500 the
  // route (falls back to the initial-letter mark below).
  const logo = await resolveImage(team?.team_logo || null);

  // The headline stat chips, only built from values that actually exist (truthful).
  const stats: { label: string; value: string }[] = [];
  if (wins != null) stats.push({ label: "Wins", value: String(wins) });
  if (avgKills != null)
    stats.push({ label: "Avg Kills", value: String(avgKills) });
  if (winRate != null)
    stats.push({ label: "Win Rate", value: `${winRate}%` });

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
          // Subtle AFC green→gold corner glow, matching the site gradient overlay.
          backgroundImage: `radial-gradient(circle at 0% 0%, rgba(34,197,94,0.20), transparent 45%), radial-gradient(circle at 100% 100%, rgba(251,191,36,0.18), transparent 45%)`,
          padding: 72,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top row: AFC wordmark + the entity kind label */}
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

        {/* Middle: logo + team name + tier/country line */}
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              width={180}
              height={180}
              alt=""
              style={{
                borderRadius: 24,
                objectFit: "cover",
                border: `4px solid ${PRIMARY}`,
              }}
            />
          ) : (
            <div
              style={{
                width: 180,
                height: 180,
                borderRadius: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#18181b",
                border: `4px solid ${PRIMARY}`,
                fontSize: 90,
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
                fontSize: name.length > 18 ? 64 : 80,
                fontWeight: 800,
                lineHeight: 1.05,
                maxWidth: 760,
              }}
            >
              {name}
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              {tier ? (
                <div
                  style={{
                    fontSize: 26,
                    color: GOLD,
                    border: `2px solid ${GOLD}`,
                    borderRadius: 999,
                    padding: "4px 20px",
                  }}
                >
                  {tier}
                </div>
              ) : null}
              {country ? (
                <div style={{ fontSize: 28, color: MUTED, paddingTop: 4 }}>
                  {country}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Bottom: headline stat chips (or a generic tagline when none exist) */}
        <div style={{ display: "flex", gap: 28 }}>
          {stats.length > 0 ? (
            stats.map((s) => (
              <div
                key={s.label}
                style={{ display: "flex", flexDirection: "column" }}
              >
                <div style={{ fontSize: 44, fontWeight: 800, color: PRIMARY }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 24, color: MUTED }}>{s.label}</div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 28, color: MUTED }}>
              Free Fire esports team on AFC
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
