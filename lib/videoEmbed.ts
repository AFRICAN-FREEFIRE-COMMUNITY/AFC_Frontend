// lib/videoEmbed.ts - parse a gameplay video LINK (YouTube / TikTok / Instagram / X / Facebook)
// into a safe embed URL that PLAYS on the AFC site instead of sending the viewer out to the app.
//
// WHY THIS EXISTS
// Player-market posts carry an OPTIONAL gameplay video link (owner 2026-06-12: video by link, not
// upload - hosting video would crush the prod box; a link captures the recruiting value free).
// The backend stores the URL after an allowlist check (_validate_video_url in
// afc_player_market/views.py); this module is the FRONTEND twin: it derives the iframe `src` from
// the parsed host + video id, so we NEVER embed an arbitrary URL - an unparseable link falls back
// to a plain outbound link.
//
// CSP / SECURITY NOTE: every provider below resolves to a PLAIN official-embed iframe (YouTube
// nocookie, TikTok v2 player, Instagram /embed, X's platform.twitter.com/embed/Tweet.html,
// Facebook's /plugins/video.php). We deliberately do NOT inject any third-party widget script
// (twttr.widgets / connect.facebook.net) - a plain iframe is lighter and stays CSP-safe (no
// new script-src origins, no runtime <script> injection). The embed HOST (platform.twitter.com,
// www.facebook.com) is only ever the iframe target we build; it is never taken from user input.
//
// CONSUMED BY: app/(user)/player-markets/page.tsx (the View Player dialog renders the embed; the
// create/edit forms use isAllowedVideoUrl for client-side validation before submit).

export interface VideoEmbed {
  provider: "youtube" | "tiktok" | "instagram" | "twitter" | "facebook" | "drive";
  /** Safe iframe src derived from the parsed link - never the raw user URL verbatim. */
  embedUrl: string;
}

// Human-readable platform list (owner 2026-06-12: "tell them the platform links we are
// accepting"). Shown in the form helper text + validation toasts; the backend names the same
// list in its 400 message (_VIDEO_PLATFORMS_LABEL in afc_player_market/views.py). Brand names,
// so it is passed as the {platforms} param into the already-translated i18n strings rather than
// being a translatable string itself.
export const VIDEO_PLATFORMS_LABEL =
  "YouTube, TikTok, Instagram, X (Twitter), Facebook or Google Drive";

// Hosts the backend accepts; mirror of _VIDEO_HOSTS in afc_player_market/views.py.
const ALLOWED_HOSTS = new Set([
  "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
  // TikTok: full links + the vm./vt. share short links (resolved server-side to a /video/<id> URL).
  "tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com",
  "instagram.com", "www.instagram.com", "m.instagram.com", "instagr.am",
  // X / Twitter: status links on either domain (embedded via platform.twitter.com/embed).
  "twitter.com", "www.twitter.com", "mobile.twitter.com", "x.com", "www.x.com", "mobile.x.com",
  // Facebook: watch/video/reel links + the fb.watch share short link (resolved server-side).
  "facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.watch",
  // Google Drive: a shared video file plays inline via /preview (owner 2026-07-15: gameplay clips are
  // commonly uploaded to Drive). The file must be shared "anyone with the link".
  "drive.google.com", "docs.google.com",
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

  // ── TikTok ── .../video/<digits> -> the v2 embed player. vm./vt. share short links carry no
  // id in the URL; the backend (_resolve_video_url) follows the redirect and stores the canonical
  // /video/<id> URL, so by the time we render here a short link has already become embeddable. An
  // unresolved short link (network failure at save time) has no id and falls through to the
  // outbound-link rendering.
  if (host.includes("tiktok.com")) {
    const match = url.pathname.match(/\/video\/(\d+)/);
    if (match) {
      return { provider: "tiktok", embedUrl: `https://www.tiktok.com/embed/v2/${match[1]}` };
    }
    return null;
  }

  // ── X / Twitter ── /<user>/status/<digits> (also /statuses/ and /i/web/status/) -> the official
  // single-tweet iframe. platform.twitter.com/embed/Tweet.html is the exact frame X's own
  // widgets.js builds, so we get the tweet + its inline video WITHOUT loading any widget script
  // (CSP-safe). theme=dark matches the AFC dark UI.
  if (host === "twitter.com" || host.endsWith(".twitter.com") || host === "x.com" || host.endsWith(".x.com")) {
    const match = url.pathname.match(/\/status(?:es)?\/(\d+)/);
    if (match) {
      return {
        provider: "twitter",
        embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${match[1]}&theme=dark`,
      };
    }
    return null;
  }

  // ── Facebook ── watch/video/reel permalinks -> the official video plugin iframe. We hand the
  // FULL post URL to plugins/video.php as the `href`; the plugin resolves and renders the video
  // server-side (again, no connect.facebook.net SDK script needed, so it stays CSP-safe). fb.watch
  // share short links are resolved to a canonical facebook.com URL by the backend before storage
  // (mirrors the TikTok short-link handling); a genuine video permalink is required for the plugin
  // to render, otherwise Facebook shows nothing and we would rather fall back to the outbound link.
  // KNOWN LIMITATION: a private / login-walled Facebook video cannot be embedded by anyone; the
  // plugin renders empty for those. There is no public-iframe workaround, so such links effectively
  // rely on the outbound-link fallback in the consumer.
  if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.watch") {
    // A bare fb.watch/<code> that never got resolved has no video permalink to feed the plugin;
    // treat it as unembeddable so the caller renders a tappable outbound link instead.
    if (host === "fb.watch") return null;
    return {
      provider: "facebook",
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.href)}&show_text=false`,
    };
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

  // ── Google Drive ── a shared video file: /file/d/<id>/view (also /d/<id>) or ?id=<id> -> the
  // /preview iframe, which streams the video inline. The link must be shared "anyone with the link"
  // for the preview to play for a viewer; a private file renders Google's "no access" page (the same
  // login-wall caveat as a private Facebook video). File ids are url-safe, 10+ chars.
  if (host === "drive.google.com" || host === "docs.google.com") {
    let id = "";
    const m = url.pathname.match(/\/(?:file\/)?d\/([\w-]+)/);
    if (m) id = m[1];
    else if (url.searchParams.get("id")) id = url.searchParams.get("id") ?? "";
    if (/^[\w-]{10,}$/.test(id)) {
      return { provider: "drive", embedUrl: `https://drive.google.com/file/d/${id}/preview` };
    }
    return null;
  }

  return null;
}
