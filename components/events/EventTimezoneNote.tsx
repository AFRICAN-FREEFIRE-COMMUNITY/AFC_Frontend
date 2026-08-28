"use client";

// ─────────────────────────────────────────────────────────────────────────────
// <EventTimezoneNote/> - one line under an event form's time fields saying WHICH TIMEZONE those
// times are in, and what they come to in the reader's own.
//
// WHY (owner report 2026-08-28). An organizer: "i hired two people to assist me with hosting And
// they from Nigeria But the time for them is showing in SA time."
//
// Event times are stored as NAIVE wall-clock (22:00) paired with Event.timezone. The forms rendered
// a bare "22:00" with the timezone nowhere on the page, so an assistant in Lagos read a
// Johannesburg wall-clock as their own and was an hour out. Nothing was broken in the data; the
// screen simply never said what the number meant.
//
// The public event page has always been fine: components/LocalEventTime.tsx shows viewer time and
// host time together. This is the same idea brought to the FORMS, which is where the numbers are
// entered and read by staff.
//
// THE OTHER HALF OF THAT BUG, fixed separately: both edit pages used to stamp Event.timezone from
// Intl.DateTimeFormat().resolvedOptions().timeZone on every save, so the Lagos assistant fixing a
// typo silently re-labelled a Johannesburg event and moved it an hour for everybody. They no longer
// send the field at all. See afc_tournament_and_scrims/test_event_timezone.py.
//
// TWO MODES, because a create and an edit are answering different questions:
//   mode="edit"    "these times are in <the event's timezone>" - a statement about stored data
//   mode="create"  "these times will be saved as <your timezone>" - makes the stamp VISIBLE before
//                  it happens, rather than taken silently from the browser
//
// HYDRATION: the reader's timezone does not exist during SSR, so the first paint renders only the
// event's timezone, which is browser-independent and identical on both sides. The "that is HH:MM
// your time" half is added after mount. Same approach, and same reason, as LocalEventTime.
//
// USED BY the four event forms:
//   app/(a)/a/events/create/_components/Step1EventDetails.tsx
//   app/(a)/a/events/[slug]/edit/_components/BasicInfoTab.tsx
//   app/(organizer)/organizer/events/create/...   (step 1)
//   app/(organizer)/organizer/events/[slug]/edit/...
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  formatLocalTime,
  getBrowserTimeZone,
  zonedWallClockToInstant,
} from "@/lib/i18n/time";

interface Props {
  /** "edit" states the event's stored timezone; "create" states the one about to be saved. */
  mode: "edit" | "create";
  /** Event.timezone. Null or absent on a legacy event, and always absent on create. */
  tz?: string | null;
  /** "YYYY-MM-DD" and "HH:MM", used only to show what the start time is in the reader's zone. */
  date?: string | null;
  startTime?: string | null;
  className?: string;
}

export function EventTimezoneNote({ mode, tz, date, startTime, className }: Props) {
  const t = useTranslations("common");
  // Null until mount: see the hydration note above.
  const [viewerTz, setViewerTz] = useState<string | null>(null);

  useEffect(() => {
    setViewerTz(getBrowserTimeZone() || null);
  }, []);

  const base = "mt-2 text-xs text-muted-foreground " + (className ?? "");

  // ── CREATE: name the timezone the times are ABOUT to be saved in ───────────────────────────
  // Before mount there is nothing honest to say, because the answer IS the browser's timezone.
  if (mode === "create") {
    if (!viewerTz) return null;
    return (
      <p className={base}>{t("eventTimezone.willSave", { tz: viewerTz })}</p>
    );
  }

  // ── EDIT, legacy event: no stored timezone ─────────────────────────────────────────────────
  // Say so plainly rather than guessing one. A guessed timezone reads as fact on the public page,
  // and 13 of 35 events on the production clone have none.
  if (!tz) {
    return <p className={base}>{t("eventTimezone.noneStored")}</p>;
  }

  // ── EDIT: the times belong to the EVENT's timezone, not the reader's ───────────────────────
  const sameZone = viewerTz !== null && viewerTz === tz;
  const inYourTime =
    viewerTz && !sameZone && date && startTime
      ? formatLocalTime(zonedWallClockToInstant(date, startTime, tz), "time")
      : "";

  return (
    <p className={base}>
      {t("eventTimezone.storedIn", { tz })}
      {inYourTime ? " " + t("eventTimezone.yourTime", { time: inYourTime }) : ""}
    </p>
  );
}
