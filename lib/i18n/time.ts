/**
 * lib/i18n/time.ts - local-time / local-date formatting helpers (string form).
 *
 * Purpose: the AFC backend stores and serves EVERY timestamp in UTC (Django
 * settings.TIME_ZONE = "UTC"), and next-intl is deliberately pinned to UTC in
 * i18n/request.ts so server + client formatting match and never trip a React
 * hydration warning. That is correct for the markup the server emits, but it
 * means next-intl's own date formatting always renders in UTC - NOT in the
 * viewer's own timezone.
 *
 * This module is the single place that converts a stored UTC instant into a
 * string rendered in the VIEWER's browser timezone and language. Use it for the
 * (rarer) cases that need a plain string - e.g. an `aria-label`, a `title`
 * attribute, a `toast` message, a value passed to a chart tooltip, a CSV cell.
 * For anything rendered as visible page text, prefer the <LocalTime/> component
 * (components/LocalTime.tsx) instead, which is the same logic but hydration-safe
 * and wrapped in a semantic <time> element.
 *
 * Timezone resolution: Intl.DateTimeFormat().resolvedOptions().timeZone - the
 * IANA zone the browser is actually configured to (e.g. "Africa/Lagos",
 * "Europe/Paris"). It is NEVER hardcoded, so each viewer sees their own region.
 *
 * Locale resolution: month / weekday NAMES ("June" vs "juin" vs "junho") must
 * follow the active UI language. There are no React hooks in a plain module, so
 * we read the active next-intl locale from the NEXT_LOCALE cookie (the same
 * cookie i18n/request.ts trusts) via document.cookie, falling back to the
 * browser's own navigator.language and finally to "en". A Client Component that
 * already holds the locale (e.g. from useLocale()) can pass it explicitly to
 * skip the cookie read.
 *
 * How it connects to the rest of the system:
 * - Mirrors the formatting logic in components/LocalTime.tsx (keep them in
 *    sync); LocalTime is the component wrapper, this is the string wrapper.
 * - Reads the NEXT_LOCALE cookie written by the language switcher and read by
 *    i18n/request.ts (i18n/config.ts is the source of truth for LOCALES).
 * - CLIENT-ONLY: every export guards `typeof window` and returns a safe empty
 *    string on the server, because the browser timezone simply does not exist
 *    during SSR. Do not call these in a Server Component for visible text - use
 *    next-intl's formatter (UTC) or render <LocalTime/> on the client instead.
 *
 * Usage:
 *   import { formatLocalTime, getBrowserTimeZone } from "@/lib/i18n/time";
 *   const label = formatLocalTime(order.created_at, "datetime"); // "Jun 15, 2026, 3:42 PM"
 *   const tz = getBrowserTimeZone();                              // "Africa/Lagos"
 */

// The supported display modes. Mirrors the `mode` prop of <LocalTime/>.
// - "datetime" → date + time   (default)
// - "date"     → date only
// - "time"     → time only
// - "relative" → "2 hours ago" / "in 3 days" (Intl.RelativeTimeFormat)
export type LocalTimeMode = "datetime" | "date" | "time" | "relative";

// Anything a stored timestamp can arrive as: a UTC ISO string from the API, a
// Date already in hand, or an epoch-millisecond number.
export type LocalTimeValue = string | number | Date | null | undefined;

// The cookie the language switcher writes and i18n/request.ts reads. Kept in
// sync with LOCALE_COOKIE in i18n/request.ts so the string form follows the
// exact same locale the rest of the app is rendering in.
const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * The IANA timezone the viewer's browser is configured to (e.g. "Africa/Lagos").
 * Returns "UTC" on the server (no browser context) so callers degrade safely.
 * This is the one and only source of the display timezone - never hardcode one.
 */
export function getBrowserTimeZone(): string {
  if (typeof window === "undefined") return "UTC";
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    // Extremely old / locked-down engines: fall back to UTC rather than throw.
    return "UTC";
  }
}

/**
 * The active display locale for month / weekday names. Order of preference:
 *   1. the NEXT_LOCALE cookie (the UI language the user picked), so "June"
 *      becomes "juin" / "junho" when the site is in French / Portuguese;
 *   2. the browser's own navigator.language (their OS/browser language);
 *   3. "en" as the final fallback.
 * Returns "en" on the server. A caller that already has the locale (e.g. from
 * next-intl's useLocale()) should pass it to formatLocalTime() to skip this.
 */
export function getActiveLocale(): string {
  if (typeof window === "undefined") return "en";
  // 1. NEXT_LOCALE cookie - the explicit UI-language choice.
  try {
    const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
    if (match?.[1]) return decodeURIComponent(match[1]);
  } catch {
    // document.cookie can throw in sandboxed iframes; fall through.
  }
  // 2/3. Browser language, then "en".
  return navigator.language || "en";
}
// Reference the constant so its intent (cookie name parity) is documented and
// it is not flagged as unused; the regex above reads the same cookie by name.
void LOCALE_COOKIE;

/**
 * Coerce the loose input into a valid Date, or null when it cannot be parsed.
 * Centralizes the null/invalid handling both this module and <LocalTime/> need.
 */
function toDate(value: LocalTimeValue): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Pick the Intl.DateTimeFormat options for a given mode. Kept tiny and explicit
 * so the produced strings read like the rest of the AFC UI (medium date, short
 * time). "relative" is handled separately by formatRelative().
 */
function optionsFor(mode: Exclude<LocalTimeMode, "relative">): Intl.DateTimeFormatOptions {
  switch (mode) {
    case "date":
      // e.g. "Jun 15, 2026"
      return { year: "numeric", month: "short", day: "numeric" };
    case "time":
      // e.g. "3:42 PM"
      return { hour: "numeric", minute: "2-digit" };
    case "datetime":
    default:
      // e.g. "Jun 15, 2026, 3:42 PM"
      return {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      };
  }
}

/**
 * Format `date` as a human-readable RELATIVE phrase ("2 hours ago", "in 3 days")
 * in `locale`, using Intl.RelativeTimeFormat. It picks the largest sensible unit
 * (year → month → day → hour → minute → second) so the phrase stays short.
 */
function formatRelative(date: Date, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  // Positive = future, negative = past. Seconds difference from "now".
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);

  // [threshold-in-seconds-for-the-next-unit, seconds-per-this-unit, unit-name]
  const divisions: Array<[number, number, Intl.RelativeTimeFormatUnit]> = [
    [60, 1, "second"],
    [3600, 60, "minute"],
    [86400, 3600, "hour"],
    [604800, 86400, "day"],
    [2629800, 604800, "week"], // ~30.44-day month / 7
    [31557600, 2629800, "month"], // ~365.25-day year / 12
    [Infinity, 31557600, "year"],
  ];

  for (const [limit, secondsPerUnit, unit] of divisions) {
    if (abs < limit) {
      // Round toward zero so "59 minutes" stays "in 59 minutes", not "in 1 hour".
      const valueInUnit = Math.trunc(diffSeconds / secondsPerUnit);
      return rtf.format(valueInUnit, unit);
    }
  }
  // Unreachable (Infinity bound), but satisfies the return contract.
  return rtf.format(diffSeconds, "second");
}

/**
 * Convert a stored UTC instant into a string in the VIEWER's timezone + language.
 *
 * @param value  UTC ISO string / Date / epoch ms (or null/invalid → "").
 * @param mode   "datetime" (default) | "date" | "time" | "relative".
 * @param locale Optional explicit locale (e.g. from useLocale()); when omitted
 *               it is resolved from the NEXT_LOCALE cookie / navigator.language.
 * @returns      The localized string, or "" on the server / for invalid input.
 *
 * Returns "" on the server because the viewer's timezone does not exist during
 * SSR; render <LocalTime/> (hydration-safe) for visible page text instead.
 */
export function formatLocalTime(
  value: LocalTimeValue,
  mode: LocalTimeMode = "datetime",
  locale?: string,
): string {
  // Client-only: the browser timezone is meaningless on the server.
  if (typeof window === "undefined") return "";

  const date = toDate(value);
  if (!date) return ""; // null / invalid input renders nothing.

  const resolvedLocale = locale ?? getActiveLocale();

  if (mode === "relative") {
    // Relative phrasing is timezone-independent (it is a delta from "now").
    return formatRelative(date, resolvedLocale);
  }

  // Absolute date/time: format in the viewer's own IANA timezone so a UTC
  // instant shows as their local wall-clock time, with locale-aware month names.
  return new Intl.DateTimeFormat(resolvedLocale, {
    ...optionsFor(mode),
    timeZone: getBrowserTimeZone(),
  }).format(date);
}

// ── Event times (host wall-clock + tz) ────────────────────────────────────────
// Event start/end + registration times are stored as the HOST's wall-clock
// (a "YYYY-MM-DD" date + an "HH:MM[:SS]" time) PLUS the host's IANA timezone
// (Event.timezone, owner 2026-06-21). Unlike the UTC instants formatLocalTime
// handles, these need the host tz to be pinned to an absolute moment first, so we
// can then show BOTH the viewer's local time and the host's time with a label
// ("17:00 your time • 18:00 WAT host"). Used by components/LocalEventTime.tsx.

/**
 * The offset (ms) of an IANA timezone at a given instant: how far that zone is
 * from UTC then (handles DST). Computed by formatting the instant AS the zone's
 * wall clock and diffing against the same wall clock read as UTC.
 */
function tzOffsetMs(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  // 24:00 can appear for midnight in some engines; normalise to 0.
  const hour = map.hour === 24 ? 0 : map.hour;
  const asUTC = Date.UTC(map.year, map.month - 1, map.day, hour, map.minute, map.second);
  return asUTC - instant.getTime();
}

/**
 * Convert a HOST wall-clock (date "YYYY-MM-DD" + time "HH:MM[:SS]") in IANA `tz`
 * into the absolute instant it represents. Returns null on missing/invalid input.
 * Two-pass to settle DST boundaries (the offset can differ side-to-side of the
 * wall clock); zones without DST (e.g. WAT) resolve exactly on the first pass.
 */
export function zonedWallClockToInstant(
  dateStr?: string | null,
  timeStr?: string | null,
  tz?: string | null,
): Date | null {
  if (!dateStr || !timeStr || !tz) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  if ([y, mo, d, h, mi].some((n) => Number.isNaN(n))) return null;

  const wallAsUTC = Date.UTC(y, mo - 1, d, h, mi);
  let instant = new Date(wallAsUTC - tzOffsetMs(new Date(wallAsUTC), tz));
  // Second pass: re-evaluate the offset at the resolved instant (DST safety).
  instant = new Date(wallAsUTC - tzOffsetMs(instant, tz));
  return instant;
}

/**
 * Format an absolute instant as "HH:MM" in a SPECIFIC IANA timezone, optionally
 * with the zone's short name appended ("18:00 WAT"). Works on the server too
 * (a fixed tz needs no browser context), so it is safe as an SSR fallback.
 */
export function formatTimeInZone(
  value: LocalTimeValue,
  tz: string,
  opts?: { withZoneName?: boolean; locale?: string },
): string {
  const date = toDate(value);
  if (!date) return "";
  const locale = opts?.locale ?? getActiveLocale();
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
    ...(opts?.withZoneName ? { timeZoneName: "short" } : {}),
  }).format(date);
}
