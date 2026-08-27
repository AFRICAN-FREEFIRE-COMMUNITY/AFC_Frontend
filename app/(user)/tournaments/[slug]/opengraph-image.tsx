// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Open Graph image for a single EVENT  ·  /tournaments/<slug>
//
// WHY THIS FILE EXISTS (owner report 2026-08-27: "the banners on those events
// don't show fully on any platform").
//
// The route used to hand the RAW event banner straight to the og:image tag while
// declaring width:1200, height:630 alongside it. Crawlers trust that declaration
// and centre-crop whatever they are given to fit it. Measured across 28 live
// event banners on 2026-08-27, NOT ONE of them was that shape:
//
//     1672x941  (16:9)    20 banners   ~7% shaved off the top and bottom
//     1254x1254 (square)   7 banners   ~47% of the image cut away
//     ultrawide (2.52)     1 banner    both sides cut off
//
// So a square banner lost nearly half its height on every platform that renders
// a link preview. That is the whole of the reported bug.
//
// WHAT THIS DOES INSTEAD
// Renders a real 1200x630 card and composites the banner into it with
// objectFit "contain", so the WHOLE banner is always visible whatever shape it
// was uploaded in. The letterbox space around it is filled with the same banner
// scaled to "cover" and heavily darkened, so a square banner reads as a
// deliberate framed card rather than as an image stranded between black bars.
//
// This is the pattern the repo ALREADY uses for teams and players
// (teams/[id]/opengraph-image.tsx, players/[username]/opengraph-image.tsx),
// whose own comment makes exactly this argument: a raw image "is often small,
// square, or transparent and embeds poorly". Events were the one entity that
// never got it.
//
// NO TEXT IS DRAWN OVER THE BANNER. The owner's requirement was that a shared
// link "shows the banner of that event no matter what and properly", so the
// banner is the whole card. The event name, date, prize pool and status already
// ride in the og:title and og:description that page.tsx builds, and every
// platform renders those next to the image.
//
// Connects to: app/(user)/tournaments/[slug]/page.tsx (generateMetadata, which
// no longer sets openGraph.images so that this file-convention route supplies
// them), backend events/get-event-details-not-logged-in (same endpoint the page
// itself uses), lib/seo.ts (siteConfig for the default card).
// ─────────────────────────────────────────────────────────────────────────────
import { ImageResponse } from "next/og";

import { env } from "@/lib/env";
import { siteConfig } from "@/lib/seo";

// Required exports for a Next image route: fixed OG size + content type.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AFC tournament";
// Regenerate hourly. A banner changes rarely, and crawlers re-fetch on their own
// schedule anyway, so this only bounds how stale a freshly-changed banner can be.
export const revalidate = 3600;

// AFC palette (mirrors globals.css). Plain hex on purpose: ImageResponse's Satori
// renderer does not understand oklch().
const BG = "#0a0a0a";
const PRIMARY = "#22c55e"; // AFC green

/**
 * The event's banner as an ABSOLUTE url this route can fetch server-side.
 *
 * Deliberately NOT lib/seo.resolveOgImage: that helper proxies through
 * /api/og-image so an external CRAWLER can fetch a backend image from our own
 * origin. Here the fetch happens inside our own server while rendering, so going
 * straight to the backend skips a pointless hop through our own proxy.
 */
function bannerUrl(data: Record<string, unknown> | null): string | null {
  const raw =
    (data?.event_banner_url as string | undefined) ||
    (data?.event_banner as string | undefined) ||
    (data?.organization_logo as string | undefined);
  if (!raw || typeof raw !== "string" || raw.trim() === "") return null;
  const value = raw.trim();
  return value.startsWith("http")
    ? value
    : `${env.NEXT_PUBLIC_BACKEND_API_URL}/${value.replace(/^\//, "")}`;
}

async function getEvent(slug: string) {
  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details-not-logged-in/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: decodeURIComponent(slug) }),
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.event_details ?? json?.team ?? null;
  } catch {
    // An image route must never throw: a failed fetch has to still produce a
    // card, or the platform shows a broken preview instead of a plain one.
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getEvent(slug);
  const banner = bannerUrl(data);

  // No banner on the event at all: fall back to the site's branded card rather
  // than emitting an empty rectangle.
  if (!banner) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: BG,
            backgroundImage:
              "radial-gradient(circle at 0% 0%, rgba(34,197,94,0.20), transparent 45%), radial-gradient(circle at 100% 100%, rgba(251,191,36,0.18), transparent 45%)",
            fontFamily: "sans-serif",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${siteConfig.url}/assets/opengraph.png`}
            width={size.width}
            height={size.height}
            alt=""
            style={{ objectFit: "cover" }}
          />
        </div>
      ),
      { ...size },
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: BG,
        }}
      >
        {/* ── Layer 1: the banner scaled to COVER, filling the whole card ──
            This exists only to fill the letterbox space that "contain" leaves
            around a banner whose shape is not 1.91:1. Without it a square
            banner sits between two dead black bars. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={banner}
          width={size.width}
          height={size.height}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size.width,
            height: size.height,
            objectFit: "cover",
          }}
        />

        {/* ── Layer 2: darken that backdrop ──
            Heavy enough that it reads as a frame rather than as a second image
            competing with the real one. Satori has no filter:blur(), so depth
            comes from darkness alone. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size.width,
            height: size.height,
            display: "flex",
            // 0.92 rather than something lighter: a BRIGHT banner (the FFWS card is
            // orange and blue on cream) ghosted visibly through the letterbox strips
            // at 0.86 and read as a doubled image. This is dark enough to kill that
            // while still tinting the frame with the banner's own colours.
            background: "rgba(10,10,10,0.92)",
          }}
        />

        {/* ── Layer 3: the banner itself, WHOLE ──
            objectFit "contain" is the entire point of this file: every pixel the
            organizer uploaded is inside the card, whatever shape it was. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={banner}
          width={size.width}
          height={size.height}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size.width,
            height: size.height,
            objectFit: "contain",
          }}
        />

        {/* ── A thin AFC green rule along the bottom ──
            The one piece of branding, kept to a 6px edge so it cannot cover any
            part of the banner. */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: size.width,
            height: 6,
            display: "flex",
            background: PRIMARY,
          }}
        />
      </div>
    ),
    { ...size },
  );
}
