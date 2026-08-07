/**
 * lib/newBadge.ts
 * ───────────────
 * The expiry maths behind the shared NEW tag (owner rule, CLAUDE.md: "Every new feature or
 * page wears a NEW tag for 5 days"). Pure functions only: no React, no next-intl, no DOM, so
 * the rule's one load-bearing behaviour (it disappears on its own) can be unit tested with
 * `node --test` the same way lib/prizeSuggestion.ts is.
 *
 * How it connects to the rest of the system:
 *  - components/NewBadge.tsx is the only intended caller. It renders the pill when isNew()
 *    says so and renders nothing otherwise. Callers of THAT pass one prop: the go-live date.
 *  - Nothing here reads the clock implicitly. `now` is an injected argument (defaulting to
 *    Date.now()) precisely so the tests in lib/__tests__/newBadge.test.ts can stand on the
 *    boundary instead of hoping the suite runs on the right day.
 *
 * ── WHY A FIXED UTC BOUNDARY AND NOT THE VIEWER'S TIMEZONE ──────────────────────────────
 * This is the one real design decision in the file, and it goes the OPPOSITE way to the
 * project's "always render times in the viewer's timezone" rule. That is deliberate, because
 * the two things are different jobs:
 *
 *   - components/LocalTime.tsx DISPLAYS an instant to a human. A human reads a clock in their
 *     own wall-clock zone, so "18:00" must mean 18:00 where they are sitting. Per viewer.
 *   - This module DECIDES WHETHER AN ELEMENT EXISTS. That is not a reading, it is a single
 *     global fact about the feature: "is this still new?". Per instant, not per viewer.
 *
 * Three concrete reasons the UTC boundary is the correct one here:
 *
 *  1. Hydration. Rendering is server-first. The server has no idea what timezone the browser
 *     is in, which is exactly why i18n/request.ts pins next-intl to timeZone: "UTC". If the
 *     badge's visibility depended on the viewer's zone, the server (UTC) and the first client
 *     render (say Africa/Lagos, UTC+1) could disagree about whether the element should be in
 *     the tree at all, on the boundary day, for a whole hour. A conditionally-rendered node
 *     that appears on one side and not the other is a genuine hydration mismatch, and this
 *     codebase has already lost content to one of those.
 *  2. It cannot flicker back on. AFC's users span roughly UTC-1 (Cabo Verde) to UTC+3 (East
 *     Africa). A viewer-local midnight means the badge dies at four different absolute
 *     moments, so the same account can watch it expire on a phone and then find it alive
 *     again on a laptop set to another zone. A single UTC instant expires once, everywhere.
 *  3. Comparing absolute instants is timezone-independent BY CONSTRUCTION. Date.now() is the
 *     same epoch number in Lagos, Praia and the server rack, so no zone handling is needed at
 *     all: there is no code path here that can get a timezone wrong, because none is consulted.
 *
 * The honest trade-off: a viewer whose DEVICE CLOCK is badly wrong (not their timezone, their
 * clock) can disagree with the server about a decoration. That is unavoidable for anything
 * time-based on the client, it is self-correcting the moment the clock syncs, and the failure
 * is a small pill being present or absent. Accepted.
 */

/**
 * The default life of a NEW tag, in days. The owner's rule says 5. This constant is the ONE
 * place to change it: components/NewBadge.tsx defaults to it and every call site omits the
 * `days` prop, so editing this line re-times every badge on the site at once.
 */
export const NEW_BADGE_DAYS = 5;

/** One day in milliseconds. The window is measured in exact 24h units, not calendar days. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Go-live dates are authored as plain calendar days: "2026-08-06". Nothing else is accepted. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Turn an authored "YYYY-MM-DD" go-live date into the absolute UTC instant it starts at,
 * or null when the string is not a real date.
 *
 * Why parse by hand instead of `new Date(since)`: the ES spec treats a date-ONLY string as UTC
 * but a date-TIME string without a Z as LOCAL, so a caller who one day pastes an ISO timestamp
 * in here would silently shift the boundary by their own offset. Restricting the input to a
 * bare calendar day and building the instant with Date.UTC removes that whole class of bug.
 *
 * Rejected input returns null, which makes the badge render nothing. That is the safe failure
 * for a decoration (same policy as LocalTime, where an unparseable value renders nothing)
 * rather than throwing inside somebody's page header.
 */
export function parseGoLive(since: string): number | null {
  const match = DATE_ONLY.exec(since);
  if (!match) return null;

  const [, year, month, day] = match;
  const ms = Date.UTC(Number(year), Number(month) - 1, Number(day));

  // Date.UTC happily rolls overflow forward ("2026-02-31" becomes 3 March), which would move
  // a badge's expiry somewhere the author did not write. Round-trip the parts to reject it.
  const roundTrip = new Date(ms);
  if (
    roundTrip.getUTCFullYear() !== Number(year) ||
    roundTrip.getUTCMonth() !== Number(month) - 1 ||
    roundTrip.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return ms;
}

/**
 * The half-open window [start, end) an authored go-live date is "new" for, as absolute UTC
 * instants, or null when the date is unparseable.
 *
 * start = midnight UTC on the authored day. end = start + days x 24h, EXCLUSIVE, so a badge
 * shipped on the 6th with the default 5 days is visible through the 6th, 7th, 8th, 9th and
 * 10th and is gone the instant the 11th begins in UTC. Exactly five days of life.
 */
export function newBadgeWindow(
  since: string,
  days: number = NEW_BADGE_DAYS,
): { start: number; end: number } | null {
  const start = parseGoLive(since);
  if (start === null) return null;
  return { start, end: start + days * DAY_MS };
}

/**
 * Is a surface that went live on `since` still inside its NEW window at `now`?
 *
 * Lower bound included on purpose: a date in the future means "not live yet", so the badge
 * stays hidden until that day arrives rather than appearing early. Upper bound excluded, so
 * the badge is never visible on the (days + 1)th day.
 *
 * @param since  the day the surface went live, "YYYY-MM-DD"
 * @param days   how long the tag lives (defaults to NEW_BADGE_DAYS)
 * @param now    epoch ms to judge against; injected so tests can stand on the boundary
 */
export function isNew(
  since: string,
  days: number = NEW_BADGE_DAYS,
  now: number = Date.now(),
): boolean {
  const window = newBadgeWindow(since, days);
  if (!window) return false;
  return now >= window.start && now < window.end;
}
