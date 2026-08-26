// ─────────────────────────────────────────────────────────────────────────────
// lib/waivers.ts
//
// Typed client for EVENT REQUIREMENT WAIVERS (backend afc_tournament_and_scrims/
// waiver_views.py, routes under /events/).
//
// A waiver is an admin's on-the-record decision to excuse ONE competitor from named
// event requirements. It exists because an invited team is judged by exactly the same
// gates as a self-registering one (the invitation accept replays through
// register_for_event on purpose), so letting a team in anyway needs a record rather
// than a bypass.
//
// CALLERS: components/events/WaiverDialog.tsx, from the admin event Registered Teams
// tab and from the bulk-add refusal panel.
// ─────────────────────────────────────────────────────────────────────────────
import axios from "axios";

import { env } from "@/lib/env";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export type Waiver = {
  waiver_id: number;
  event_id: number;
  team_id: number | null;
  user_id: number | null;
  /** Refusal codes this waiver excuses: the same strings register_for_event puts in a 403. */
  waived_codes: string[];
  reason: string;
  created_by: string;
  /** ISO string. Render through <LocalTime>. */
  created_at: string | null;
};

/** Active waivers on one event. Revoked ones are not returned. */
export async function listWaivers(token: string, eventId: number): Promise<Waiver[]> {
  const res = await axios.get<{ waivers: Waiver[] }>(
    `${BASE}/events/${eventId}/waivers/`,
    { headers: bearer(token) },
  );
  return res.data?.waivers ?? [];
}

/**
 * Grant or replace the active waiver for one competitor. Granting twice edits the
 * existing row rather than stacking, which is what the database constraint enforces.
 * Throws with response.data.message naming the problem when a code is not waivable or
 * the reason is blank.
 */
export async function grantWaiver(
  token: string,
  payload: {
    event_id: number;
    team_id?: number | null;
    user_id?: number | null;
    codes: string[];
    reason: string;
  },
): Promise<Waiver> {
  const res = await axios.post<{ waiver: Waiver }>(`${BASE}/events/waivers/`, payload, {
    headers: bearer(token),
  });
  return res.data.waiver;
}

/** Retire a waiver. The row survives so the record outlives the event. Idempotent. */
export async function revokeWaiver(token: string, waiverId: number): Promise<void> {
  await axios.delete(`${BASE}/events/waivers/${waiverId}/`, { headers: bearer(token) });
}
