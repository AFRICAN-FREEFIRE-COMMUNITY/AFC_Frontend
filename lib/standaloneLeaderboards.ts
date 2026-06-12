import axios from "axios";
import Cookies from "js-cookie";
import { env } from "@/lib/env";

/**
 * Typed client for the Standalone Leaderboards API (prefix /leaderboards/standalone/).
 *
 * MIRRORS lib/rankingsAdmin.ts (axios + the BASE url + an authHeaders() helper that reads the
 * `auth_token` cookie that AuthContext writes on login). Every call carries the Bearer token because
 * the standalone endpoints are gated server-side (AFC event-admin OR an organizer with
 * can_upload_results on the leaderboard's org — see afc_leaderboard.permissions.can_manage_standalone_lb).
 *
 * Backend app: afc_leaderboard (views.py). The list/detail GETs return the house pagination envelope
 * {results, has_more, next_offset, total_count}; create/edit return {leaderboard}; participant/match
 * mutations return the created row. Errors surface as axios errors with `err.response.data.message`,
 * handled with a toast at each call site (same idiom as the rest of the app).
 *
 * CONSUMED BY:
 *  - app/(a)/a/leaderboards/standalone/create/page.tsx (the 4-step create wizard) — create, addParticipant,
 *    removeParticipant, addMatch, saveResults, detail, update(publish).
 *  - app/(a)/a/leaderboards/standalone/[id]/page.tsx (view page) — detail.
 *  - app/(a)/a/_components/LeaderboardsAdminContent.tsx + app/(organizer)/organizer/leaderboards/page.tsx
 *    (list sections) — list, remove.
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

// Bearer header from the auth_token cookie (the cookie AuthContext writes on login).
function authHeaders() {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token ?? ""}` };
}

// All standalone routes hang off this prefix (afc_leaderboard.urls mounted at /leaderboards/).
const url = (path: string) => `${BASE}/leaderboards/standalone/${path}`;

async function aGet<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  return (await axios.get(url(path), { params, headers: authHeaders() })).data;
}
async function aPost<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.post(url(path), body ?? {}, { headers: authHeaders() })).data;
}
// Multipart POST - for the OCR screenshot upload (FormData {screenshot}). We do NOT set a
// Content-Type header so axios fills in the multipart boundary itself (same idiom as
// lib/api/ocr.ts::aPostForm and organizersApi.submitDesignRequest).
async function aPostForm<T = any>(path: string, body: FormData): Promise<T> {
  return (await axios.post(url(path), body, { headers: authHeaders() })).data;
}
async function aPatch<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.patch(url(path), body ?? {}, { headers: authHeaders() })).data;
}
async function aDelete<T = any>(path: string, body?: any): Promise<T> {
  // axios DELETE carries a body via the `data` option (none needed here, kept for parity).
  return (await axios.delete(url(path), { headers: authHeaders(), data: body })).data;
}

// ── Shared shapes (kept loose; the backend is the source of truth) ───────────────
export type LeaderboardFormat = "team" | "solo";
export type LeaderboardStatus = "draft" | "published";
// Stream P3: how much a ranked leaderboard's results weigh in the AFC rankings engine.
// Mirrors the backend RankingTier choices (afc_leaderboard.models). Defaults to tier_3.
export type RankingTier = "tier_1" | "tier_2" | "tier_3";

// Header row returned by create/list/edit.
export interface StandaloneLeaderboardHeader {
  id: number;
  name: string;
  format: LeaderboardFormat;
  organization_id: number | null;
  organization_name?: string | null;
  placement_points: Record<string, number>;
  kill_point: number;
  points_per_assist?: number;
  points_per_1000_damage?: number;
  counts_toward_rankings: boolean;
  // Stream P3 (AFC-admin-only). Only meaningful when counts_toward_rankings is true.
  // played_on: ISO date (YYYY-MM-DD) the results bucket under for rankings, or null.
  // ranking_tier: weight band fed to the rankings engine (defaults to tier_3 server-side).
  played_on: string | null;
  ranking_tier: RankingTier;
  status: LeaderboardStatus;
  creator_id: number;
  created_at: string;
}

// Participant row (one of team/ghost_team/user/ghost_player is set; `kind` names which).
export interface StandaloneParticipant {
  id: number;
  name: string;
  is_ghost: boolean;
  kind: "team" | "ghost_team" | "user" | "ghost_player";
  team_id?: number | null;
  ghost_team_id?: number | null;
  user_id?: number | null;
  ghost_player_id?: number | null;
}

export interface StandaloneMatch {
  id: number;
  match_number: number;
  match_map: string | null;
  created_at: string;
}

export interface StandaloneStandingRow {
  rank: number;
  participant: { id: number; name: string; is_ghost: boolean; kind: string };
  played_count: number;
  total_points: number;
  kills: number;
  booyahs: number;
  per_match: Array<{
    match_number: number;
    placement: number;
    kills: number;
    total_points: number;
  }>;
}

// Full detail returned by GET /<id>/.
export interface StandaloneLeaderboardDetail {
  leaderboard: StandaloneLeaderboardHeader;
  participants: StandaloneParticipant[];
  matches: StandaloneMatch[];
  standings: StandaloneStandingRow[];
  can_manage: boolean;
}

// ── OCR screenshot extract + apply (Stream P2) ───────────────────────────────
// The OCR flow inside the create wizard: upload a results screenshot, the backend reads it and
// returns one draft row per detected competitor (each pre-matched to a real team/user where it
// can, with confidence + alternative candidates), the admin reviews/edits in OcrUploadDialog, and
// "Apply" writes a map + participants + results in one call. Backend lives in afc_leaderboard
// (the standalone /ocr/ + /ocr/apply/ endpoints, manager-gated like the rest of this client).
//
// CONSUMED BY:
//  - app/(a)/a/leaderboards/standalone/create/_components/OcrUploadDialog.tsx (ocrExtract on file
//    select, ocrApply on "Apply"). The dialog is opened from ParticipantsStep's "Upload screenshot"
//    button; on apply it advances the wizard to the Results step with the created match pre-filled.

/** One alternative entity the backend matched a raw OCR name against (team OR user variant).
 *  Team candidates may be GHOST teams (the pool includes afc_rankings.GhostTeam so a ghost created on
 *  an earlier map is suggested instead of duplicated): those carry ghost_team_id + is_ghost and
 *  resolve as kind="ghost_existing", never as an automatic match. */
export interface OcrCandidate {
  team_id?: number | null;
  team_name?: string;
  user_id?: number;
  username?: string;
  ghost_team_id?: string; // set only on ghost-team candidates (uuid)
  is_ghost?: boolean;
  confidence: number; // 0..1
}

/**
 * One reviewable row = one competitor line read off the screenshot.
 * team format -> matched_team_id + team-shaped top_candidates; solo -> matched_user_id + user-shaped.
 * `is_unmatched` is true when the backend could not confidently link the raw name to a real entity
 * (the admin then re-matches via free-search or creates a ghost).
 */
/**
 * Team format only: ONE read player inside a placement, with their kills and their own platform-user
 * match (mirrors the row-level team matching). Produced by the backend's build_team_ocr_rows when
 * given the platform user pool; consumed by OcrReviewTable's per-player approve/search controls so
 * the admin can confirm or correct who each read name is on the platform.
 */
export interface OcrPlayerDetail {
  name: string; // the IGN exactly as the OCR read it
  kills: number;
  matched_user_id: number | null;
  matched_username: string | null;
  confidence: number;
  top_candidates: OcrCandidate[]; // user-shaped candidates ({user_id, username, confidence})
  is_unmatched: boolean;
}

export interface OcrExtractRow {
  row_id: string;
  raw_name: string;
  // Team format only: the player names the OCR read inside this placement. Shown under the team name so
  // the admin can identify the team (and used to seed a created ghost team's roster). Absent for solo.
  players_read?: string[];
  // Team format only: the same players with kills + per-player platform matches (see OcrPlayerDetail).
  players_detail?: OcrPlayerDetail[];
  placement: number;
  kills: number;
  matched_team_id?: number | null; // team format
  matched_user_id?: number | null; // solo format
  matched_name: string | null;
  confidence: number;
  top_candidates: OcrCandidate[];
  is_unmatched: boolean;
}

/** Response of POST /<id>/ocr/ - the extracted draft, plus the format so the UI knows which idiom. */
export interface OcrExtractResponse {
  draft_id: string;
  format: LeaderboardFormat;
  rows: OcrExtractRow[];
}

/**
 * How one reviewed row resolves to a participant on apply (exactly one per row):
 *   real          -> a matched existing team/user (id is team_id or user_id)
 *   ghost_new     -> mint a fresh ghost from typed fields (team name + country, or solo ign as name)
 *   ghost_existing-> reuse an already-created ghost (ghost_team_id / ghost_player_id)
 */
export type OcrRowResolution =
  | { kind: "real"; id: number }
  // players (team format): the admin-approved roster (matched usernames where approved, else the
  // OCR-read names), seeded into the new ghost team so a created ghost carries its players (the
  // backend ghost_new team path accepts a `players` IGN list and dedupes case-insensitively).
  | { kind: "ghost_new"; name: string; country?: string; players?: string[] }
  // players (team format): same list for an EXISTING ghost team - the backend APPENDS the slots the
  // ghost does not have yet (never edits existing slots), so OCR-read players can be attached to an
  // old ghost team too.
  | { kind: "ghost_existing"; id: number | string; players?: string[] };

/** One row in the apply payload: the (possibly edited) score plus its single resolution. */
export interface OcrApplyRow {
  placement: number;
  kills: number;
  resolution: OcrRowResolution;
}

/** Body for POST /<id>/ocr/apply/. match_map is an optional label for the created map. */
export interface OcrApplyPayload {
  match_map?: string;
  rows: OcrApplyRow[];
}

/**
 * Response of POST /<id>/ocr/apply/. The backend creates one map + participants (ghosts for
 * ghost_new) + results in one call and returns the fresh match, the full participant list, and the
 * recomputed standings - the dialog hands `match` + `participants` to the wizard to advance to
 * Results pre-filled.
 */
export interface OcrApplyResponse {
  match: StandaloneMatch;
  participants: StandaloneParticipant[];
  standings: StandaloneStandingRow[];
}

// ── OCR batch (async, multi-image, Phase 2.6) ────────────────────────────────
// The synchronous single-shot ocrExtract above could time out on prod (a Gemini read is 12-26s). The
// batch backgrounds the read: the admin uploads 1+ screenshots PER MAP, the server persists them as an
// OcrJob (one job == one map), a Celery worker reads + merges + matches them, and the FE POLLS the job
// until done. `rows` is the same OcrExtractRow shape the single-shot returned (null until done).
export type OcrJobStatus = "pending" | "processing" | "done" | "failed" | "applied";
export interface OcrJob {
  id: string;
  map_label: string;
  status: OcrJobStatus;
  engine: string; // which engine read it ("gemini-2.5-flash", "local_student_vN", ...)
  error: string; // populated when status === "failed"
  image_count: number;
  applied_match_id: number | null; // set once the job's rows were applied to a map
  rows: OcrExtractRow[] | null; // merged + matched review rows, null until status === "done"
  created_at: string | null;
}

// ── Create / edit payloads ───────────────────────────────────────────────────
// Kept loose (index signature) to match the existing "plain body" convention while still
// surfacing the Stream P3 ranking fields so callers get autocompletion + type-checking on them.
// played_on / ranking_tier are AFC-admin-only and only attached when counts_toward_rankings is on.
export interface StandaloneLeaderboardCreatePayload {
  name: string;
  format: LeaderboardFormat;
  placement_points?: Record<string, number>;
  kill_point?: number;
  points_per_assist?: number;
  points_per_1000_damage?: number;
  organization_id?: number; // admin: optional (omit = AFC-native); organizer: REQUIRED (their own org)
  counts_toward_rankings?: boolean; // admin only
  played_on?: string | null; // admin only, Stream P3: ISO date the results bucket under
  ranking_tier?: RankingTier; // admin only, Stream P3: weight band for the rankings engine
  [key: string]: any;
}

// Edit reuses the same shape; every field is optional on a PATCH.
export type StandaloneLeaderboardEditPayload = Partial<StandaloneLeaderboardCreatePayload>;

export const standaloneLeaderboardsApi = {
  // ── Leaderboard CRUD ───────────────────────────────────────────────────────
  // create body: {name, format, placement_points?, kill_point?, points_per_assist?,
  //               points_per_1000_damage?, organization_id?(admin), counts_toward_rankings?(admin),
  //               played_on?(admin), ranking_tier?(admin)}
  //   played_on / ranking_tier are Stream P3 AFC-admin-only ranking fields. They are only sent
  //   when counts_toward_rankings is on (see BasicsStep); the backend ignores them otherwise.
  create: (body: StandaloneLeaderboardCreatePayload) =>
    aPost<{ leaderboard: StandaloneLeaderboardHeader }>("create/", body),
  // list params: {limit, offset, status, format, q, organization_id(admin)} -> envelope of headers.
  list: (params?: Record<string, any>) => aGet("", params),
  // detail -> {leaderboard, participants, matches, standings, can_manage}
  detail: (id: number | string) => aGet<StandaloneLeaderboardDetail>(`${id}/`),
  // edit body: {name?, placement_points?, kill_point?, ..., status?, counts_toward_rankings?(admin),
  //             played_on?(admin), ranking_tier?(admin)}  (same Stream P3 ranking fields as create).
  update: (id: number | string, body: StandaloneLeaderboardEditPayload) =>
    aPatch<{ leaderboard: StandaloneLeaderboardHeader }>(`${id}/edit/`, body),
  remove: (id: number | string) => aDelete(`${id}/delete/`),

  // ── Participants ───────────────────────────────────────────────────────────
  // body: {kind:"real"|"ghost_new"|"ghost_existing", ...}
  //   real   team -> {team_id};         real   solo -> {user_id}
  //   ghost_new team -> {name, country?, players?:[ign]};   ghost_new solo -> {ign}
  //   ghost_existing -> {ghost_team_id} | {ghost_player_id}
  addParticipant: (id: number | string, body: any) =>
    aPost<{ participant: StandaloneParticipant }>(`${id}/participants/`, body),
  removeParticipant: (id: number | string, pid: number | string) =>
    aDelete(`${id}/participants/${pid}/`),

  // ── Matches (maps) ─────────────────────────────────────────────────────────
  addMatch: (id: number | string, body?: any) =>
    aPost<{ match: StandaloneMatch }>(`${id}/matches/`, body),
  removeMatch: (mid: number | string) => aDelete(`matches/${mid}/`),

  // ── Results (bulk per map) ─────────────────────────────────────────────────
  // body: {results:[{participant_id, placement, kills, damage?, assists?, bonus?, penalty?, played?}]}
  saveResults: (mid: number | string, body: any) => aPost(`matches/${mid}/results/`, body),

  // ── OCR screenshot extract + apply (Stream P2) ─────────────────────────────
  // ocrExtract: multipart POST /<id>/ocr/ (field `screenshot`). Reads the screenshot and returns a
  //   draft (one OcrExtractRow per competitor, pre-matched where possible). Consumed by
  //   OcrUploadDialog on file select.
  ocrExtract: (id: number | string, file: File) => {
    const fd = new FormData();
    fd.append("screenshot", file);
    return aPostForm<OcrExtractResponse>(`${id}/ocr/`, fd);
  },
  // ocrApply: POST /<id>/ocr/apply/ - writes one map + participants (ghosts for ghost_new) + results
  //   in one call from the reviewed rows. Returns {match, participants, standings}. Consumed by
  //   OcrUploadDialog's "Apply" button; the wizard then advances to Results with `match` pre-filled.
  ocrApply: (id: number | string, body: OcrApplyPayload) =>
    aPost<OcrApplyResponse>(`${id}/ocr/apply/`, body),

  // ── OCR batch (async, multi-image, Phase 2.6) ──────────────────────────────
  // One job == one map. Flow: ocrJobCreate (upload that map's screenshots) -> ocrJobRun OR ocrRunAll
  // (enqueue the background read) -> poll ocrJobList until each job is done/failed -> ocrJobApply
  // (turn the reviewed rows into a map + participants + results). Consumed by OcrBatchDialog.
  ocrJobCreate: (id: number | string, images: File[], mapLabel?: string) => {
    const fd = new FormData();
    images.forEach((f) => fd.append("images", f)); // backend reads request.FILES.getlist("images")
    if (mapLabel) fd.append("map_label", mapLabel);
    return aPostForm<{ job: OcrJob }>(`${id}/ocr/jobs/create/`, fd);
  },
  // Poll endpoint: every job for this leaderboard with status + merged rows (rows null until done).
  ocrJobList: (id: number | string) => aGet<{ jobs: OcrJob[] }>(`${id}/ocr/jobs/`),
  // Enqueue ONE map's background read.
  ocrJobRun: (id: number | string, jobId: string) =>
    aPost<{ job: OcrJob }>(`${id}/ocr/jobs/${jobId}/run/`),
  // Enqueue EVERY pending/failed map at once (parallel "run as a group").
  ocrRunAll: (id: number | string) =>
    aPost<{ jobs: OcrJob[]; queued: number }>(`${id}/ocr/run-all/`),
  // Apply ONE map's reviewed rows -> a map + participants + results (reuses the apply contract above).
  ocrJobApply: (id: number | string, jobId: string, body: OcrApplyPayload) =>
    aPost<OcrApplyResponse>(`${id}/ocr/jobs/${jobId}/apply/`, body),
  // Discard a map's job + its uploaded screenshots.
  ocrJobDelete: (id: number | string, jobId: string) =>
    aDelete(`${id}/ocr/jobs/${jobId}/`),
};
