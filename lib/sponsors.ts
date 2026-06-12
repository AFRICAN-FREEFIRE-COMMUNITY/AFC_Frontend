/**
 * lib/sponsors.ts — typed client for the sponsor-system redesign P1 (backend afc_sponsors).
 *
 * Backend: afc_sponsors/views.py, mounted at /sponsors/ (see that module's header for the full
 * request/response shapes). Auth: Bearer auth_token cookie, same axios idiom as
 * lib/standaloneLeaderboards.ts.
 *
 * CONSUMED BY:
 *  - app/(a)/a/sponsors/_components/SponsorProfilesContent.tsx (admin CRUD + members + events)
 *  - app/(sponsor)/sponsor/dashboard/page.tsx (the member-scoped portal: mine -> events ->
 *    submissions + CSV)
 *
 * PRIVACY: portal payloads carry usernames + submitted values only; no emails (owner decision).
 */
import axios from "axios";
import Cookies from "js-cookie";

import { env } from "@/lib/env";

const BASE = `${env.NEXT_PUBLIC_BACKEND_API_URL}/sponsors`;

function headers() {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token ?? ""}` };
}

async function sGet<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  return (await axios.get(`${BASE}/${path}`, { headers: headers(), params })).data;
}
async function sPost<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.post(`${BASE}/${path}`, body ?? {}, { headers: headers() })).data;
}
async function sPatch<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.patch(`${BASE}/${path}`, body ?? {}, { headers: headers() })).data;
}
async function sDelete<T = any>(path: string): Promise<T> {
  return (await axios.delete(`${BASE}/${path}`, { headers: headers() })).data;
}

// ── shapes (mirror afc_sponsors.views serializers) ───────────────────────────
export interface SponsorRow {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  description: string;
  website: string;
  socials: Array<{ platform: string; url: string }>;
  status: "active" | "suspended";
  events_count: number;
  members_count: number;
  created_at: string | null;
  // present only on sponsor_detail
  members?: Array<{ member_id: number; user_id: number; username: string; role: string }>;
}

export interface SponsorEventRow {
  event_id: number;
  event_name: string;
  slug: string | null;
  event_status: string;
  participant_type: string;
  registrants: number;
  requires_approval: boolean;
}

export interface SponsorSubmissionRow {
  id: number;
  username: string;
  team_name: string | null;
  value: string | null;
  status: string;
}

export const sponsorsApi = {
  // ── admin (sponsor-admin gated) ──
  create: (body: { name: string; description?: string; website?: string }) =>
    sPost<{ sponsor: SponsorRow }>("create/", body),
  list: (params?: { q?: string; limit?: number; offset?: number }) =>
    sGet<{ results: SponsorRow[]; total_count: number }>("", params),
  detail: (id: number) => sGet<{ sponsor: SponsorRow }>(`${id}/`),
  update: (id: number, body: Partial<Pick<SponsorRow, "name" | "description" | "website" | "status">>) =>
    sPatch<{ sponsor: SponsorRow }>(`${id}/edit/`, body),
  addMember: (id: number, body: { user_id: number; role?: "owner" | "member" }) =>
    sPost(`${id}/members/add/`, body),
  removeMember: (id: number, memberId: number) => sDelete(`${id}/members/${memberId}/`),
  attachEvent: (id: number, eventId: number) =>
    sPost(`${id}/events/attach/`, { event_id: eventId }),
  detachEvent: (id: number, eventId: number) => sDelete(`${id}/events/${eventId}/`),

  // ── portal (member-scoped) ──
  mine: () => sGet<{ results: SponsorRow[]; total_count: number }>("mine/"),
  events: (id: number) => sGet<{ results: SponsorEventRow[]; total_count: number }>(`${id}/events/`),
  submissions: (id: number, eventId: number) =>
    sGet<{ event: { event_id: number; event_name: string }; results: SponsorSubmissionRow[]; total_count: number }>(
      `${id}/events/${eventId}/submissions/`,
    ),
  // CSV download: fetch as blob and hand to the browser (same idiom as esport-media.tsx).
  submissionsCsv: async (id: number, eventId: number, filename: string) => {
    const res = await axios.get(`${BASE}/${id}/events/${eventId}/submissions/`, {
      headers: headers(),
      params: { csv: 1 },
      responseType: "blob",
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};
