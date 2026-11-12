/**
 * lib/howto-guides.ts - the how-to clips as the site shows them (inbox #255, owner 2026-10-16:
 * "i approve the mock up, i have seen it", mockups/help-page/).
 *
 * WHAT: one row per recorded clip (howto/clips/<id>.mjs): which messages key holds its title,
 * summary and steps (messages/<loc>/howto.json, the clip's own captions, so the written steps on
 * the page are word for word what the video shows), its topic on /help, who it is for, and the
 * screen it starts on. Plus where its files are served from and how long each take runs.
 *
 * FILES: howto/render.mjs records every clip in en, fr and pt at desktop (1440) and phone (390)
 * sizes; when a clip's lock is written it publishes the takes to public/howto/<clip>/<lang>-<size>
 * .{webm,mp4,jpg} and their lengths to lib/howto-clips.generated.json (howto/lib/publish.mjs).
 * Nothing here is typed by hand that the recorder knows, so a re-render updates the page by itself.
 *
 * USED BY: components/howto/HelpGuides.tsx (/help), components/howto/HowtoVideo.tsx (the player),
 * components/howto/WatchHowTip.tsx (the "Watch how" link in the event page's info tip) and
 * components/help-center/HelpCenter.tsx (the organizer guide "Upload match results" plays clip 4).
 * Held by scripts/check-howto-clips.mjs (HOWTO-PUBLIC: every locked take is published).
 */
import CLIP_SECONDS from "./howto-clips.generated.json";

export type HowtoClipId = "signup-discord" | "team-invite" | "register-tournament" | "organizer-results";
export type HowtoTopic = "start" | "teams" | "tournaments" | "organizers";
export type HowtoAudience = "everyone" | "players" | "captains" | "organizers";
export type HowtoSize = "desktop" | "phone";

export interface HowtoGuide {
  clip: HowtoClipId;
  // key under "clips" in messages/<loc>/howto.json (title, summary, steps.*)
  messages: string;
  topic: HowtoTopic;
  who: HowtoAudience;
  // the screen the task starts on ("Open this screen")
  href: string;
}

// The order is the order a new player meets these tasks.
export const HOWTO_GUIDES: HowtoGuide[] = [
  { clip: "signup-discord", messages: "signupDiscord", topic: "start", who: "everyone", href: "/create-account" },
  { clip: "team-invite", messages: "teamInvite", topic: "teams", who: "players", href: "/teams" },
  { clip: "register-tournament", messages: "registerTournament", topic: "tournaments", who: "captains", href: "/tournaments" },
  { clip: "organizer-results", messages: "organizerResults", topic: "organizers", who: "organizers", href: "/organizer/events" },
];

export const HOWTO_TOPICS: HowtoTopic[] = ["start", "teams", "tournaments", "organizers"];

export const HOWTO_GUIDE_BY_CLIP = Object.fromEntries(HOWTO_GUIDES.map((g) => [g.clip, g])) as Record<HowtoClipId, HowtoGuide>;

// The day /help, its menu entry and its footer link went live, for every NewBadge that marks them
// (owner rule: a new page wears NEW for 5 days). ONE constant, so the ship day is one edit.
// The day /help goes live: the NEW badge on the page and the menu runs five days from it. Set to the ship day.
export const HELP_PAGE_LIVE_SINCE = "2026-11-12";

const LANGS = ["en", "fr", "pt"] as const;
type Lang = (typeof LANGS)[number];
type SecondsTable = Record<string, Partial<Record<Lang, Partial<Record<HowtoSize, number>>>>>;

// A clip is recorded in en, fr and pt; any other locale shows the English take.
export function howtoLang(locale: string): Lang {
  return (LANGS as readonly string[]).includes(locale) ? (locale as Lang) : "en";
}

// "/howto/register-tournament/fr-phone" + ".webm" | ".mp4" | ".jpg"
export function howtoMediaBase(clip: HowtoClipId, locale: string, size: HowtoSize): string {
  return `/howto/${clip}/${howtoLang(locale)}-${size}`;
}

// Whole seconds of a take, for "Watch how, 13 s" and the video's label; null when not published.
export function howtoSeconds(clip: HowtoClipId, locale: string, size: HowtoSize = "desktop"): number | null {
  const s = (CLIP_SECONDS as SecondsTable)[clip]?.[howtoLang(locale)]?.[size];
  return typeof s === "number" ? Math.round(s) : null;
}
