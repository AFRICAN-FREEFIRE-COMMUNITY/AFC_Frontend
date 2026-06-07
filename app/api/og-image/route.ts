import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

// ─────────────────────────────────────────────────────────────────────────────
// /api/og-image  ·  same-origin image proxy for social link embeds
//
// Re-serves a backend /media/ upload (event banner, news image, org banner, ...)
// from OUR own origin so social crawlers (Discord, X, WhatsApp, ...) can always
// fetch the og:image, even when the backend host blocks bots or sets unfriendly
// headers. Called indirectly by lib/seo.ts → resolveOgImage(), which rewrites a
// backend /media/ URL to /api/og-image?url=<encoded backend media url>.
//
// SECURITY: this is an open-ish fetch proxy, so it is locked to media paths on
// the configured backend origin ONLY (an SSRF guard). It refuses anything else.
// ─────────────────────────────────────────────────────────────────────────────

// The set of "<origin>/media/" prefixes we will proxy. We allow BOTH the env-
// configured backend (correct for local dev, e.g. http://localhost:8000) AND the
// known production API host, so the route works in every environment without
// reconfiguration. Computed once at module load.
const ALLOWED_MEDIA_PREFIXES = (() => {
  const prefixes = new Set<string>([
    "https://api.africanfreefirecommunity.com/media/",
  ]);
  try {
    const backendOrigin = new URL(env.NEXT_PUBLIC_BACKEND_API_URL).origin;
    prefixes.add(`${backendOrigin}/media/`);
  } catch {
    // env not a valid URL → fall back to the prod prefix already in the set.
  }
  return [...prefixes];
})();

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // Only allow proxying a /media/ file from an allowed backend origin (SSRF guard).
  const allowed = ALLOWED_MEDIA_PREFIXES.some((prefix) => url.startsWith(prefix));
  if (!allowed) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const imageRes = await fetch(url, {
      headers: { "User-Agent": "AfricanFreefireCommunity/1.0" },
      next: { revalidate: 3600 },
    });

    if (!imageRes.ok) {
      return new NextResponse("Image not found", { status: 404 });
    }

    const contentType =
      imageRes.headers.get("content-type") || "image/jpeg";
    const buffer = await imageRes.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse("Failed to fetch image", { status: 500 });
  }
}
