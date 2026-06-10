import axios from "axios";
import Cookies from "js-cookie";
import { env } from "@/lib/env";

/**
 * Typed client for event-level mutations (routes under /events/). Today this only holds
 * EVENT DUPLICATION; it is the place to grow other event mutations that deserve a shared,
 * documented call (rather than yet another inline axios block).
 *
 * Mirrors lib/api/eventPayments.ts (axios + the BASE url + Bearer-from-cookie auth): the
 * Bearer token is read from the same `auth_token` cookie AuthContext writes on login
 * (js-cookie), so callers don't have to thread the token through props/hooks.
 *
 * Backend contract (afc_tournament_and_scrims.views.duplicate_event, prefix /events/):
 *   - POST <event_id>/duplicate-event/  (no body)
 *       -> 201 {message, event_id, slug, event_name}  the NEW draft event
 *       Auth: AFC event admin OR org can_create_events on the source event's org.
 *       Clones the event's CONFIG + stage/group/round-robin STRUCTURE into a fresh
 *       upcoming DRAFT; does NOT copy results, registrations, teams, matches, leaderboards,
 *       payments, invite tokens, sponsors, or analytics. The source event is untouched.
 *
 * Who consumes this client (end-to-end trace):
 *   - app/(organizer)/organizer/events/page.tsx  the organizer events list's "Duplicate"
 *       row action (gated on can_create_events / owner) -> routes to the new event's edit page.
 *   - app/(a)/a/_components/EventsAdminContent.tsx  the admin events list's "Duplicate"
 *       row action -> re-fetches the list (and toasts the new event name).
 *
 * Errors surface as axios errors with `err.response.data.message`; handle them with a toast
 * at the call site, exactly like the rest of the app.
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

// Bearer header from the auth_token cookie (the cookie AuthContext writes on login).
function authHeaders() {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token ?? ""}` };
}

// All endpoints sit under the /events/ prefix.
const url = (path: string) => `${BASE}/events/${path}`;

/** 201 response of POST /events/<event_id>/duplicate-event/ — the new draft event. */
export interface DuplicateEventResponse {
  message: string;
  // The newly-created (draft) event's id. Used to route to its edit page.
  event_id: number;
  // The new event's unique slug (base "-copy" then "-2", "-3"...).
  slug: string;
  // The new event's name (the source name with a " (Copy)" suffix).
  event_name: string;
}

export const eventsApi = {
  /**
   * POST /events/<eventId>/duplicate-event/ (no body).
   * Clones the source event into a fresh draft and returns its id/slug/name. The caller
   * confirms first, then on success toasts + routes to /a/events/<slug>/edit (admin) or
   * /organizer/events/<slug>/edit (organizer), or just re-fetches the list.
   */
  duplicateEvent: (eventId: number | string) =>
    aPost<DuplicateEventResponse>(`${eventId}/duplicate-event/`),
};

// POST helper (kept after the export so the public surface reads top-down). Returns the
// response body; axios throws on non-2xx so the call site's try/catch handles errors.
async function aPost<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.post(url(path), body ?? {}, { headers: authHeaders() }))
    .data;
}
