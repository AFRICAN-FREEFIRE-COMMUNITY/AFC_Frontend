"use client";

// ─────────────────────────────────────────────────────────────────────────────
// <LocalEventTime/> - shows an event's start (and optional end) TIME in BOTH the
// viewer's own timezone AND the host's timezone with a label, e.g.
//   "17:00 to 20:00 (your time) • 18:00 to 21:00 WAT (host)".
//
// WHY (owner 2026-06-21): event/registration times are entered in the CREATOR's
// timezone and stored as the host's wall-clock (a date + an "HH:MM" time) paired
// with the host's IANA tz (Event.timezone). A viewer in another country needs to
// know both "when is it for me" and "when is it where the host is". This component
// is the single place that renders that dual-tz pair.
//
// HYDRATION: the viewer's timezone does not exist during SSR, so the server and
// the first client paint render the raw host wall-clock ("18:00 to 21:00") - a
// deterministic, browser-independent fallback that matches on both sides. After
// mount we upgrade to the full viewer+host string. When the viewer IS in the host
// tz (or there is no stored tz, i.e. a legacy event) we show a single time.
//
// CONNECTS TO: lib/i18n/time.ts (zonedWallClockToInstant + formatTimeInZone +
// formatLocalTime). Rendered by app/(user)/tournaments/[slug]/_components/
// EventDetailsWrapper.tsx (the public event page schedule block). Data comes from
// get_event_details (event_start_time/event_end_time/registration_*_time +
// timezone), persisted by create_event / edit_event.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
// i18n: the range connector ("to") and the "(your time)" / "(host)" tags are
// localized via the shared common namespace (messages/{en,fr,pt}/common.json ->
// "eventTime.*"). next-intl resolves the same NEXT_LOCALE on the server and the
// client, so the deterministic SSR / first-paint fallback stays hydration-safe.
import { useTranslations } from "next-intl";
import {
  formatLocalTime,
  formatTimeInZone,
  getBrowserTimeZone,
  zonedWallClockToInstant,
} from "@/lib/i18n/time";

interface LocalEventTimeProps {
  // "YYYY-MM-DD" - the date the time belongs to (needed to pin the wall clock to
  // an absolute instant, which is what makes cross-tz conversion correct).
  date?: string | null;
  // "HH:MM" or "HH:MM:SS" host wall-clock times.
  startTime?: string | null;
  endTime?: string | null;
  // Host IANA timezone (Event.timezone). When absent (legacy events) we just show
  // the raw stored time with no conversion or label.
  tz?: string | null;
  className?: string;
}

// Trim a stored "HH:MM[:SS]" to "HH:MM" for the deterministic fallback.
function hhmm(t?: string | null): string {
  if (!t) return "";
  const parts = t.split(":");
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : t;
}

export function LocalEventTime({
  date,
  startTime,
  endTime,
  tz,
  className,
}: LocalEventTimeProps) {
  const t = useTranslations("common");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!startTime) return null;

  // Deterministic SSR / first-paint fallback: the raw host wall-clock, no tz math.
  const rawRange = endTime
    ? `${hhmm(startTime)} ${t("eventTime.to")} ${hhmm(endTime)}`
    : hhmm(startTime);

  // Before mount, or with no host tz to convert from, show the raw range only.
  if (!mounted || !tz) {
    return <span className={className}>{rawRange}</span>;
  }

  // Pin the host wall-clock times to absolute instants so we can re-render them in
  // any zone. If parsing fails for any reason, fall back to the raw range.
  const startInstant = zonedWallClockToInstant(date, startTime, tz);
  const endInstant = endTime
    ? zonedWallClockToInstant(date, endTime, tz)
    : null;
  if (!startInstant) {
    return <span className={className}>{rawRange}</span>;
  }

  // Host-tz strings (the end carries the tz short-name, e.g. "21:00 WAT").
  const hostStart = formatTimeInZone(startInstant, tz);
  const hostEnd = endInstant
    ? formatTimeInZone(endInstant, tz, { withZoneName: true })
    : formatTimeInZone(startInstant, tz, { withZoneName: true });
  const hostRange = endInstant ? `${hostStart} ${t("eventTime.to")} ${hostEnd}` : hostEnd;

  // If the viewer is already in the host tz, one line is enough (no "(host)").
  const viewerTz = getBrowserTimeZone();
  if (viewerTz === tz) {
    return <span className={className}>{hostRange}</span>;
  }

  // Viewer-local strings (formatLocalTime renders in the browser's own tz).
  const viewerStart = formatLocalTime(startInstant, "time");
  const viewerEnd = endInstant ? formatLocalTime(endInstant, "time") : "";
  const viewerRange = endInstant
    ? `${viewerStart} ${t("eventTime.to")} ${viewerEnd}`
    : viewerStart;

  return (
    <span className={className}>
      {viewerRange} {t("eventTime.yourTime")} • {hostRange} {t("eventTime.host")}
    </span>
  );
}
