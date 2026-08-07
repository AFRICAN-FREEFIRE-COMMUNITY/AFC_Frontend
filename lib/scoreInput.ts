// lib/scoreInput.ts
// ─────────────────────────────────────────────────────────────────────────────
// ONE place where a manual result-entry box decides what "empty" means.
//
// WHY THIS EXISTS (owner bug report 2026-08-06)
//   "when they are updating leaderboards using the manual method, if they put 0 as score for a
//    particular player it glitches and does not calculate the results well, and they can leave
//    score blank for certain players."
//
//   Every manual entry surface used to render a number with `value={row.placement || ""}` and
//   read it back with `parseInt(e.target.value) || 0`. Zero is falsy in JavaScript, so those two
//   lines collapsed "the organizer has not filled this in" and "the organizer entered zero" into
//   the SAME value, in both directions:
//
//     • typing 0 stored 0 and then re-rendered the box as EMPTY, so the typed zero vanished
//       on screen and the box looked broken or disabled;
//     • leaving the box empty posted the NUMBER 0, so the backend guard in
//       afc_tournament_and_scrims.views.validate_placements ("Every team that played this map
//       needs a finishing position...") - which only rejects None / "" - could never fire from
//       this UI. A blanked placement saved with HTTP 200 and scored 0 placement points.
//       Proven against the running stack: posting placement 0 for one team returned 200 and
//       stored placement=0, placement_points=0 (that team quietly lost 6 points); posting
//       placement null for the same team returned 400 with the correct message.
//
// THE RULE THIS MODULE ENCODES
//   A score box holds `ScoreValue = number | null`. `null` means "nothing entered yet" and is a
//   DIFFERENT thing from `0`. Rendering and parsing both go through here so the distinction
//   cannot be lost again by a stray `||`.
//
//   On the way out to the API the two kinds of field part company, and that difference is the
//   whole point:
//     • PLACEMENT is sent as-is, so `null` reaches the backend and its existing blank guard
//       rejects the save with a message naming what to do. There is no such thing as 0th place.
//     • COUNT fields (kills / damage / assists / bonus / penalty) go through `scoreOrZero`,
//       because a blank kills box genuinely means "no kills" and making an organizer type 0 into
//       forty boxes for a wipe-out lobby would be hostile.
//
// USED BY (every manual result-entry surface)
//   • components/leaderboards/MatchResultsGrid.tsx        - shared admin + organizer edit grid
//   • app/(a)/a/leaderboards/[id]/edit/page.tsx           - admin event leaderboard editor
//   • app/(organizer)/organizer/events/[slug]/leaderboard/page.tsx - organizer editor
//   • app/(a)/a/leaderboards/_components/GroupResultsEditor.tsx    - whole-group editor
//   • app/(a)/a/leaderboards/_components/ManualMatchResultStep.tsx - first manual entry
//   • app/(a)/a/leaderboards/standalone/create/_components/ResultsStep.tsx - standalone wizard
// ─────────────────────────────────────────────────────────────────────────────

/** A manual score box: a number the organizer entered, or `null` for a box left empty. */
export type ScoreValue = number | null;

/**
 * What a controlled <Input type="number"> should display for a ScoreValue.
 *
 * `null` -> "" (empty box, so backspacing to clear a field still works and the placeholder shows)
 * `0`    -> "0" (an entered zero STAYS on screen - this is the "typing 0 does nothing" symptom)
 */
export function scoreInputValue(value: ScoreValue): string {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * Read an <Input type="number"> back into a ScoreValue.
 *
 * ""      -> null (empty is empty, NOT zero)
 * "0"     -> 0    (a real zero, distinct from empty)
 * garbage -> null (a number input can hand back "" or "-" mid-typing; treat as not-yet-entered)
 */
export function parseScoreInput(raw: string): ScoreValue {
  if (raw.trim() === "") return null;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Collapse a COUNT field for the API: an empty kills/damage/assists/bonus/penalty box means zero.
 * Never use this for placement - a blank placement must stay null so the backend can reject it.
 */
export function scoreOrZero(value: ScoreValue): number {
  return value === null || value === undefined ? 0 : value;
}

/** True when the organizer put something in this box, including a deliberate 0. */
export function hasScore(value: ScoreValue): boolean {
  return value !== null && value !== undefined;
}

/**
 * The names of the rows that PLAYED this map but have no finishing position entered.
 *
 * The backend rejects the whole save in this case (validate_placements), but its message cannot
 * name the offenders. Calling this before the POST lets each surface say exactly which teams or
 * players are missing, which is the difference between a 12-row lobby being fixable and not.
 */
export function rowsMissingPlacement<T extends { name: string; placement: ScoreValue; played: boolean }>(
  rows: T[],
): string[] {
  return rows.filter((r) => r.played && !hasScore(r.placement)).map((r) => r.name);
}
