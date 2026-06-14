import axios from "axios";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

/**
 * Typed client for the player-market MODERATION API (prefix /player-market/),
 * feature "J-market-reporting".
 *
 * Mirrors lib/organizers.ts (axios + the BASE url + Bearer-from-cookie auth): every
 * gated call carries the Bearer token read from the same `auth_token` cookie that
 * AuthContext sets (js-cookie), so callers don't have to thread it through props/hooks.
 *
 * Two tiers of endpoints live here:
 *   - USER  - file a report against a market post (any logged-in user).
 *   - ADMIN - moderators list + triage reports, and ban a player/team from the market.
 *
 * The report-file call goes up as multipart FormData (so the optional evidence image
 * rides along) - mirroring organizersApi.reportOrganization. axios sets the multipart
 * boundary itself (no explicit Content-Type).
 *
 * Errors surface as axios errors with `err.response.data.message` - handle them with a
 * toast at the call site, like the rest of the app.
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

const url = (path: string) => `${BASE}/player-market/${path}`;

async function mGet<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  return (await axios.get(url(path), { params, headers: authHeaders() })).data;
}
async function mPost<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.post(url(path), body ?? {}, { headers: authHeaders() })).data;
}
// Multipart POST - for FormData bodies (the evidence image upload). We do NOT set a
// Content-Type header so axios fills in the multipart boundary itself.
async function mPostForm<T = any>(path: string, body: FormData): Promise<T> {
  return (await axios.post(url(path), body, { headers: authHeaders() })).data;
}
async function mPatch<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.patch(url(path), body ?? {}, { headers: authHeaders() })).data;
}

// ── Row shape returned by the admin reports list (mirrors _serialize_report). ──
// subject_name / reporter_username are denormalised by the backend so the table never
// re-fetches the FKs. reported_team_id / reported_player_id drive the Ban dialog target.
export interface MarketReportRow {
  id: number;
  subject_type: "team" | "player";
  subject_name: string | null;
  reported_team_id: number | null;
  reported_player_id: number | null;
  post_id: number | null;
  category: "bad_tryout" | "scam" | "abusive" | "fake_post" | "other";
  details: string;
  evidence: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed" | "banned";
  resolution_notes: string | null;
  // reporter_id (feature "J-market-rules", J5): the reporter's User id, used by the
  // admin "Ban reporter (false report)" action to ban an abusive/false reporter via
  // adminBan({ scope: "player", target_id: reporter_id }). null when the reporter row
  // was deleted (SET_NULL) - the FE hides the ban-reporter action in that case.
  reporter_id: number | null;
  reporter_username: string | null;
  reviewed_by_username: string | null;
  created_at: string | null;
}

export interface MarketReportsResponse {
  results: MarketReportRow[];
  total_count: number;
  has_more: boolean;
}

export const playerMarketApi = {
  // ── USER - file a report against a market post ───────────────────────────────
  // Goes up as multipart FormData: post_id (required), category, details (required),
  // evidence? (image). Returns { message } on 201.
  fileReport: (body: FormData) => mPostForm("report-post/", body),

  // ── ADMIN - moderator triage queue (list + update one) ───────────────────────
  // adminListReports paginates server-side: pass { status?, category?, search?, limit,
  // offset }; returns { results, total_count, has_more }.
  adminListReports: (params?: Record<string, any>) =>
    mGet<MarketReportsResponse>("admin/reports/", params),
  // adminUpdateReport changes status + resolution_notes on one report (true PATCH).
  adminUpdateReport: (id: number | string, body: any) =>
    mPatch(`admin/reports/${id}/`, body),

  // ── ADMIN - ban a player or team from the market ─────────────────────────────
  // body: { scope: "player"|"team", target_id, duration_days?(null=permanent),
  //         reason, report_id? }. Returns { message, ban }.
  adminBan: (body: any) => mPost("admin/ban/", body),
};
