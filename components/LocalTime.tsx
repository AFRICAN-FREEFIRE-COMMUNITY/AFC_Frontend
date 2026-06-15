"use client";

/**
 * components/LocalTime.tsx - render any stored UTC timestamp in the VIEWER's own
 * timezone and language.
 *
 * Why this exists: the AFC backend stores and serves every timestamp in UTC
 * (Django settings.TIME_ZONE = "UTC"), and next-intl is pinned to UTC in
 * i18n/request.ts so server-rendered markup matches the first client paint and
 * never trips a React hydration warning. The trade-off is that next-intl's own
 * date formatting always shows UTC, not the viewer's local time. This component
 * is the canonical fix: it converts a UTC instant into the viewer's local
 * wall-clock time, in their language, without breaking hydration.
 *
 * HYDRATION STRATEGY (why mount-gating, not suppressHydrationWarning):
 *   The server has no idea what timezone the browser is in, so the server and
 *   the first client render CANNOT agree on the localized string - they would
 *   legitimately differ. Rather than paper over a real mismatch with
 *   suppressHydrationWarning (which also suppresses genuine bugs on that node),
 *   we render a STABLE, server-safe placeholder first (the ISO date part, which
 *   is identical on both sides), then swap in the localized string after mount
 *   via useState + useEffect. The server HTML and the first client render are
 *   byte-identical, so there is nothing for React to warn about; the localized
 *   text appears one tick later, client-side only. The placeholder still carries
 *   the machine-readable instant in <time dateTime>, so it is meaningful even in
 *   the brief pre-mount window and for crawlers / no-JS.
 *
 * Timezone + locale resolution:
 * - Timezone: Intl.DateTimeFormat().resolvedOptions().timeZone - the IANA zone
 *     the browser is actually set to (e.g. "Africa/Lagos"). NEVER hardcoded.
 *     Resolved through getBrowserTimeZone() in lib/i18n/time.ts.
 * - Locale: the active next-intl UI locale via useLocale() (fed by
 *     I18nProvider → NextIntlClientProvider, ultimately the NEXT_LOCALE cookie),
 *     so month / weekday names follow the language: "June" / "juin" / "junho".
 *
 * How it connects to the rest of the system:
 * - Shares its formatting logic with lib/i18n/time.ts (formatLocalTime); that
 *     module is the string form for non-JSX needs (title/aria-label/toast/CSV).
 *     This component is the JSX form and is what visible page text should use.
 * - Depends on useLocale() from next-intl, available because I18nProvider
 *     wraps the tree in app/layout.tsx (same provider that powers
 *     useTranslations() / lib/i18n/toast.ts).
 * - Replaces ad-hoc `new Date(x).toLocaleDateString("en-US", ...)` calls
 *     scattered across the (user) and (organizer) surfaces, which both hardcode
 *     "en-US" AND render in the server's/UTC clock instead of the viewer's.
 *
 * Usage:
 *   import { LocalTime } from "@/components/LocalTime";
 *   <LocalTime value={order.created_at} />                       // datetime (default)
 *   <LocalTime value={event.start_date} mode="date" />           // date only
 *   <LocalTime value={match.kickoff} mode="time" />              // time only
 *   <LocalTime value={post.created_at} mode="relative" />        // "2 hours ago"
 *   <LocalTime value={iso} mode="date" className="text-muted-foreground" />
 *
 * Props:
 *   value     UTC ISO string | Date | epoch ms | null/undefined (invalid → renders nothing)
 *   mode      "datetime" (default) | "date" | "time" | "relative"
 *   className optional CSS classes applied to the wrapping <time> element
 */

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import {
  formatLocalTime,
  getBrowserTimeZone,
  type LocalTimeMode,
  type LocalTimeValue,
} from "@/lib/i18n/time";

type LocalTimeProps = {
  // The stored UTC instant. Accepts the loose shapes the API actually returns.
  value: LocalTimeValue;
  // How to render it. Defaults to a full date + time.
  mode?: LocalTimeMode;
  // Optional classes for the wrapping <time> element.
  className?: string;
};

/**
 * Normalize the loose input to a valid Date, or null when unparseable. Mirrors
 * toDate() in lib/i18n/time.ts so the component and the string helper agree on
 * exactly which inputs count as "nothing to render".
 */
function toDate(value: LocalTimeValue): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function LocalTime({ value, mode = "datetime", className }: LocalTimeProps) {
  // Active UI locale (en / fr / pt ...) from next-intl, so month + weekday names
  // follow the chosen language. Available via I18nProvider in app/layout.tsx.
  const locale = useLocale();

  // Mount gate: false on the server and on the very first client render, so both
  // emit the SAME placeholder. Flips to true after mount, when it is safe to use
  // the browser timezone / locale for the localized string. See HYDRATION note.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const date = toDate(value);

  // null / invalid input → render nothing, per spec.
  if (!date) return null;

  // The canonical machine-readable instant for the <time dateTime> attribute and
  // for the pre-mount placeholder. Always UTC ISO, so it is identical on server
  // and client (no hydration mismatch on the attribute or the placeholder text).
  const iso = date.toISOString();

  // Before mount: a stable, timezone-independent placeholder. We show the ISO
  // date portion ("2026-06-15") - present and identical on both renders - rather
  // than an empty node, so the value is still meaningful with JS disabled / for
  // crawlers and there is no layout jump to a blank. After mount: the localized,
  // viewer-timezone string (formatLocalTime is client-only and reads the browser
  // tz + the passed locale).
  const text = mounted
    ? formatLocalTime(date, mode, locale)
    : iso.slice(0, 10);

  return (
    <time
      dateTime={iso}
      // title gives the precise local datetime on hover once mounted; before
      // mount it is the ISO instant. getBrowserTimeZone() returns "UTC" pre-mount.
      title={mounted ? `${formatLocalTime(date, "datetime", locale)} (${getBrowserTimeZone()})` : iso}
      className={className}
    >
      {text}
    </time>
  );
}
