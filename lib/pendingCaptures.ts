/**
 * Pending capture bucket API (owner 2026-07-05, complaint D).
 *
 * When the desktop AFC Capture client has an EXTRA game (every configured map slot for a group is
 * already scored) and the operator picks "decide later", the raw upload is PARKED server-side in a
 * PendingCaptureUpload row instead of silently becoming a phantom map. These helpers back the
 * <PendingCapturesPanel/> shown on the admin event leaderboard editor's Flagging tab, where an
 * admin/organizer resolves each parked upload (score it as a NEW or REPLACEMENT map) or discards it.
 *
 * Endpoints (afc_tournament_and_scrims.views_capture_pending, prefix events/):
 *   GET  events/<event_id>/pending-captures/                       -> list unresolved + stage structure
 *   POST events/<event_id>/pending-captures/<id>/resolve/          -> score it (attribution new|replace)
 *   POST events/<event_id>/pending-captures/<id>/discard/          -> drop it (mis-capture)
 * Auth: Bearer token of an AFC event admin OR an org member with can_upload_results (same gate as the
 * other result endpoints). RESOLVE re-runs the SAME scoring path a live upload uses.
 */
import { env } from "@/lib/env";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

export type PendingCaptureSummaryTeam = {
  team_name: string;
  placement: number;
  players: number;
  kills: number;
};

export type PendingCaptureSummary = {
  teams?: PendingCaptureSummaryTeam[];
  team_count?: number;
  player_count?: number;
};

export type PendingCapture = {
  id: number;
  status: "pending" | "resolved" | "discarded";
  file_name: string;
  stage_id: number | null;
  group_id: number | null;
  stage_name: string | null;
  group_name: string | null;
  summary: PendingCaptureSummary;
  uploaded_by: string | null;
  created_at: string | null;
  resolution: string;
  resolved_match_id: number | null;
};

export type PendingMatchSlot = { match_id: number; map: string; scored: boolean };
export type PendingGroup = { group_id: number; group_name: string; match_slots: PendingMatchSlot[] };
export type PendingStage = { stage_id: number; stage_name: string; groups: PendingGroup[] };

export type PendingCapturesResponse = {
  event_id: number;
  pending: PendingCapture[];
  pending_count: number;
  stages: PendingStage[];
};

const authHeaders = (token: string, json = false): HeadersInit => ({
  ...(json ? { "Content-Type": "application/json" } : {}),
  Authorization: `Bearer ${token}`,
});

export const pendingCapturesApi = {
  // List an event's UNRESOLVED parked captures + its stage/group structure (for the resolve target).
  list: async (eventId: number | string, token: string): Promise<PendingCapturesResponse> => {
    const r = await fetch(`${BASE}/events/${eventId}/pending-captures/`, {
      headers: authHeaders(token),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.message || "Failed to load pending captures.");
    return r.json();
  },

  // Resolve one parked capture: score it into a target group as a NEW map or REPLACE an existing map.
  // attribution = "new" | "replace:<match_id>". Runs the same scoring path a live upload uses.
  resolve: async (
    eventId: number | string,
    pendingId: number,
    body: { attribution: string; group_id?: number | null; stage_id?: number | null },
    token: string,
  ) => {
    const r = await fetch(`${BASE}/events/${eventId}/pending-captures/${pendingId}/resolve/`, {
      method: "POST",
      headers: authHeaders(token, true),
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.message || "Failed to resolve capture.");
    return r.json();
  },

  // Discard one parked capture (a genuine mis-capture: wrong event, duplicate run).
  discard: async (eventId: number | string, pendingId: number, token: string) => {
    const r = await fetch(`${BASE}/events/${eventId}/pending-captures/${pendingId}/discard/`, {
      method: "POST",
      headers: authHeaders(token),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.message || "Failed to discard capture.");
    return r.json();
  },
};
