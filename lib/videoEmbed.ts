// lib/videoEmbed.ts - parse a gameplay video LINK (YouTube / TikTok) into a safe embed URL.
//
// WHY THIS EXISTS
// Player-market posts carry an OPTIONAL gameplay video link (owner 2026-06-12: video by link, not
// upload - hosting video would crush the prod box; a link captures the recruiting value free).
// The backend stores the URL after an allowlist check (_validate_video_url in
// afc_player_market/views.py); this module is the FRONTEND twin: it derives the iframe `src` from
// the parsed host + video id, so we NEVER embed an arbitrary URL - an unparseable link falls back
// to a plain outbound link.
//
// CONSUMED BY: app/(user)/player-markets/page.tsx (the View Player dialog renders the embed; the
// create/edit forms use isAllowedVideoUrl for client-side validation before submit).

export interface VideoEmbed {
  provider: "youtube" | "tiktok" | "instagram";
  /** Safe iframe src derived from the video id - never the raw user URL. */
  embedUrl: string;
}

// Human-readable platform list (owner 2026-06-12: "tell them the platform links we are
// accepting"). Shown in the form helper text + validation toasts; the backend names the same
// list in its 400 message (_VIDEO_PLATFORMS_LABEL in afc_player_market/views.py).
export const VIDEO_PLATFORMS_LABEL = "YouTube, TikTok or Instagram";

// Hosts the backend accepts; mirror of _VIDEO_HOSTS in afc_player_market/views.py.
const ALLOWED_HOSTS = new Set([
  "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
  "tiktok.com", "www.tiktok.com", "vm.tiktok.com",
  "instagram.com", "www.instagram.com", "m.instagram.com", "instagr.am",
]);

function parseUrl(raw: string | null | undefined): URL | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  // Tolerate a missing scheme, same as the backend normalization.
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

/** Form validation twin of the backend allowlist: empty is fine (optional field). */
export function isAllowedVideoUrl(raw: string | null | undefined): boolean {
  const value = (raw ?? "").trim();
  if (!value) return true;
  const url = parseUrl(value);
  return !!url && ALLOWED_HOSTS.has(url.hostname.toLowerCase());
}

/**
 * Derive the embeddable player for a stored video link.
 * Returns null when no embed can be derived (unknown pattern, vm.tiktok.com short links whose
 * video id needs a server-side resolve) - callers then render a plain outbound link instead.
 */
export function parseVideoEmbed(raw: string | null | undefined): VideoEmbed | null {
  const url = parseUrl(raw);
  if (!url || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;
  const host = url.hostname.toLowerCase();

  // ── YouTube ── watch?v=ID | youtu.be/ID | /shorts/ID | /embed/ID -> nocookie embed.
  if (host.includes("youtube.com") || host === "youtu.be") {
    let id = "";
    if (host === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    } else if (url.searchParams.get("v")) {
      id = url.searchParams.get("v") ?? "";
    } else {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" || parts[0] === "embed") id = parts[1] ?? "";
    }
    // YouTube ids are 11 url-safe chars; reject anything else rather than embed junk.
    if (/^[\w-]{11}$/.test(id)) {
      return { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    return null;
  }

  // ── TikTok ── .../video/<digits> -> the v2 embed player. vm.tiktok.com short links carry no
  // id in the URL, so they fall through to the outbound-link rendering.
  if (host.includes("tiktok.com")) {
    const match = url.pathname.match(/\/video\/(\d+)/);
    if (match) {
      return { provider: "tiktok", embedUrl: `https://www.tiktok.com/embed/v2/${match[1]}` };
    }
    return null;
  }

  // ── Instagram ── /reel/<code>, /p/<code>, /tv/<code> -> the public /embed endpoint (works for
  // public posts without the IG JS SDK). Shortcodes are url-safe; reject anything else.
  const ig = url.pathname.match(/^\/(reel|reels|p|tv)\/([\w-]+)/);
  if (ig) {
    const kind = ig[1] === "reels" ? "reel" : ig[1];
    return {
      provider: "instagram",
      embedUrl: `https://www.instagram.com/${kind}/${ig[2]}/embed`,
    };
  }
  return null;
}
