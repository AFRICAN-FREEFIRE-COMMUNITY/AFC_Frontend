/**
 * ONE list of event fields for the four forms (owner 2026-09-22, inbox #41).
 *
 * THE PROBLEM THIS SOLVES
 * -----------------------
 * The backend generates its six readers and writers from one declaration
 * (AFC-B afc_tournament_and_scrims/event_contract.py). The frontend does not: admin create, admin
 * edit, organizer create and organizer edit each repeat the field list by hand, and the admin edit
 * page repeats it five times over (initial state, rehydrate, two save paths, the cached mirror).
 * Adding `required_connections` took about a dozen sites and the count was wrong twice.
 *
 * `scripts/check-event-forms.mjs` already fails the build when a form sends a key the contract does
 * not know, or stops sending one it should. That catches drift; it does not remove the typing. This
 * module removes the typing for the ordinary fields.
 *
 * WHAT IT DOES, AND WHAT IT DELIBERATELY DOES NOT
 * -----------------------------------------------
 * `appendRemainingEventFields` walks the contract, and for every field this role may write that the
 * form has a value for and has NOT already appended, appends it. So:
 *   - every existing `formData.append("event_name", ...)` line keeps working exactly as it is. The
 *     helper skips anything already in the FormData (`formData.has`), so a field with bespoke
 *     formatting, a conditional, or a different source keeps its hand-written line and wins.
 *   - a NEW plain field reaches all four forms the moment the form state carries it, with no edit
 *     to any of the four.
 *
 * It does NOT touch the awkward ones, which the contract itself lists as hand-written: the banner
 * and rules uploads (they come from `request.FILES`), `is_sponsored` and `sponsor_usernames` (they
 * delete and re-create rows), `event_type` (it deletes registrations), `tournament_tier` (owned by
 * apply_event_tier), `stages` and `prize_distribution` (their own shapes). Those stay written out,
 * where a reader can see them.
 *
 * VALUES ARE FORMATTED THE WAY THIS API HAS ALWAYS WANTED THEM: a boolean becomes "True" / "False"
 * (Django reads those), a number becomes its string, null and undefined become "", and anything
 * object-shaped is JSON. That mirrors what the hand-written lines already do.
 *
 * CONNECTS TO: lib/eventContract.generated.json (written by AFC-B tools/export_event_contract.py,
 * staleness caught by check-event-forms), the four forms named above, and the backend's
 * apply_event_writes which is the only thing that stores any of it.
 */

import contract from "./eventContract.generated.json";

export type EventWriteRole = "organizer" | "admin";

type GeneratedContract = {
  fields: { name: string; source: string; read: string; write: string; computed: boolean }[];
  writable: Record<string, string[]>;
  hand_written: string[];
};

const CONTRACT = contract as GeneratedContract;

/** Fields the contract says are written by hand, per role, and therefore skipped here. */
export const HAND_WRITTEN_EVENT_FIELDS: string[] = CONTRACT.hand_written;

/** Every field this role may write, minus the hand-written ones. Sorted, so diffs stay readable. */
export function writableEventFields(role: EventWriteRole): string[] {
  const all = CONTRACT.writable[role] || [];
  return all.filter((name) => !HAND_WRITTEN_EVENT_FIELDS.includes(name)).sort();
}

/** The API's idea of a value: Django reads "True"/"False", everything else is a plain string. */
export function eventFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/**
 * Append every contract field this role may write that `data` has and the FormData does not.
 *
 * Returns the keys it added, so a caller can log or test them. Call it LAST, after the form's own
 * appends: anything already there is left alone.
 */
export function appendRemainingEventFields(
  formData: FormData,
  data: Record<string, unknown>,
  role: EventWriteRole,
  options?: { skip?: string[] },
): string[] {
  const skip = new Set(options?.skip || []);
  const added: string[] = [];
  for (const name of writableEventFields(role)) {
    if (skip.has(name)) continue;
    if (formData.has(name)) continue;            // the form's own line wins
    if (!(name in data)) continue;               // this form does not collect it
    const value = data[name];
    if (value === undefined) continue;           // "not collected" rather than "cleared"
    formData.append(name, eventFieldValue(value));
    added.push(name);
  }
  return added;
}

/**
 * The JSON twin of the above, for a save path that posts an object rather than a FormData (the
 * admin edit page's cached mirror and its PATCH). `already` is whatever the caller has built so
 * far; its keys win.
 */
export function withRemainingEventFields(
  already: Record<string, unknown>,
  data: Record<string, unknown>,
  role: EventWriteRole,
  options?: { skip?: string[] },
): Record<string, unknown> {
  const skip = new Set(options?.skip || []);
  const out: Record<string, unknown> = { ...already };
  for (const name of writableEventFields(role)) {
    if (skip.has(name)) continue;
    if (name in out) continue;
    if (!(name in data)) continue;
    if (data[name] === undefined) continue;
    out[name] = data[name];
  }
  return out;
}
