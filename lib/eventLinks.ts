/**
 * lib/eventLinks.ts — typed client for EVENT LINKING / qualification chains (P1).
 *
 * Backend: afc_tournament_and_scrims/event_links.py, mounted under /events/ (see that module's
 * header for full shapes). A link = "top N of SOURCE STAGE qualify into TARGET EVENT"; firing
 * creates EventQualification rows and (auto_promote) registers them into the target. Every
 * decision is undoable; standings edited after a fire surface as diff + creator notification.
 *
 * CONSUMED BY: components/event-links.tsx (the "Linked events" card on the admin event page).
 */
import axios from "axios";
import Cookies from "js-cookie";

import { env } from "@/lib/env";

const BASE = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events`;

function headers() {
  return { Authorization: `Bearer ${Cookies.get("auth_token") ?? ""}` };
}

export interface EventQualificationRow {
  id: number;
  placement: number;
  team_id: number | null;
  user_id: number | null;
  name: string;
  status: "pending" | "promoted" | "declined" | "replaced" | "rejected";
  note: string;
  can_undo: boolean;
}

export interface EventLinkRow {
  id: number;
  source_event_id: number;
  source_event_name: string;
  source_stage_id: number;
  source_stage_name: string;
  target_event_id: number;
  target_event_name: string;
  qualify_count: number;
  auto_promote: boolean;
  roster_mode: "copy" | "captain_repick";
  status: "active" | "fired" | "cancelled";
  created_by: string | null;
  qualifications?: EventQualificationRow[];
  // outbound only: the standings-edited diff vs the fire-time snapshot
  standings_changed?: boolean;
  diff?: Array<{
    placement: number;
    was: string | null;
    now: string | null;
    now_team_id: number | null;
    now_user_id: number | null;
  }>;
}

export type DecideAction = "allow" | "reject" | "decline" | "replace_next" | "replace_team" | "undo";

export const eventLinksApi = {
  list: async (eventId: number) =>
    (await axios.get<{ outbound: EventLinkRow[]; inbound: EventLinkRow[] }>(
      `${BASE}/${eventId}/links/`, { headers: headers() },
    )).data,
  create: async (
    eventId: number,
    body: {
      source_stage_id: number;
      target_event_id: number;
      qualify_count: number;
      auto_promote: boolean;
      roster_mode: "copy" | "captain_repick";
    },
  ) => (await axios.post(`${BASE}/${eventId}/links/create/`, body, { headers: headers() })).data,
  cancel: async (linkId: number) =>
    (await axios.delete(`${BASE}/links/${linkId}/`, { headers: headers() })).data,
  fire: async (linkId: number) =>
    (await axios.post(`${BASE}/links/${linkId}/fire/`, {}, { headers: headers() })).data,
  decide: async (linkId: number, qualificationId: number, action: DecideAction, teamId?: number) =>
    (await axios.post(
      `${BASE}/links/${linkId}/decide/`,
      { qualification_id: qualificationId, action, ...(teamId ? { team_id: teamId } : {}) },
      { headers: headers() },
    )).data,
};
