import axios from "axios";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

/**
 * Typed client for the OCR match-result review API (all routes under /events/).
 *
 * Mirrors lib/organizers.ts / lib/rankingsAdmin.ts (axios + the BASE url + Bearer-from-cookie
 * auth): every call carries the Bearer token read from the same `auth_token` cookie that
 * AuthContext sets (js-cookie), so callers don't have to thread it through props/hooks. The
 * one exception is the upload, which goes up as multipart FormData (the screenshot bytes) -
 * we do NOT set a Content-Type header so axios fills in the multipart boundary itself, exactly
 * like organizersApi.editOrganizationProfile's FormData path.
 *
 * This is the api surface for the admin OCR review flow that lives under
 * app/(a)/a/leaderboards/_components/:
 *   - MapSelectionStep.tsx  consumes uploadOcrScreenshot (pick a map, drop a screenshot).
 *   - ImageUploadStep.tsx   consumes uploadOcrScreenshot + ocrFromStoredImage (re-run OCR on a
 *                           screenshot already stored on the match).
 *   - OCRReviewTable.tsx    consumes getOcrSession (tab-restore), patchOcrRow (per-edit save),
 *                           commitOcrSession (write to the leaderboard) and discardOcrSession.
 * The flow is mounted from app/(a)/a/leaderboards/[id]/edit/page.tsx (the Upload Results drawer).
 *
 * Backend lives in afc_ocr (views.py / urls.py); the draft-row shape comes from
 * afc_ocr.services.matching.match_name + detect_team_mismatches.
 *
 * Errors surface as axios errors with `err.response.data.message` (plus an optional
 * `unresolved` / `unacknowledged` list on a 400 from commit) - handle them with a toast at the
 * call site, like the rest of the app.
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

// All OCR endpoints sit under the /events/ prefix (afc_ocr.urls is included there).
const url = (path: string) => `${BASE}/events/${path}`;

async function aGet<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  return (await axios.get(url(path), { params, headers: authHeaders() })).data;
}
async function aPost<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.post(url(path), body ?? {}, { headers: authHeaders() })).data;
}
// Multipart POST - for the FormData screenshot upload. We do NOT set a Content-Type header so
// axios fills in the multipart boundary itself (the standard multipart upload idiom in this app).
async function aPostForm<T = any>(path: string, body: FormData): Promise<T> {
  return (await axios.post(url(path), body, { headers: authHeaders() })).data;
}
async function aPatch<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.patch(url(path), body ?? {}, { headers: authHeaders() })).data;
}
async function aDelete<T = any>(path: string, body?: any): Promise<T> {
  // axios DELETE carries a body via the `data` option (unused here, kept for symmetry).
  return (await axios.delete(url(path), { headers: authHeaders(), data: body })).data;
}

// ── Types ─────────────────────────────────────────────────────────────────────
//
// These mirror the JSON the backend hands back. The draft-row shape is produced by
// afc_ocr.services.matching.match_name (identity match + top candidates) and then annotated by
// detect_team_mismatches (the team_mismatch / expected_team_id / admin_confirmed_sub fields).

/** One candidate registered player for a raw OCR name (afc_ocr matching top_candidates). */
export interface OcrCandidate {
  user_id: number;
  username: string;
  confidence: number; // 0..1
}

/**
 * One reviewable row = one player line read off the screenshot.
 *
 * Server-persisted fields (set by match_name / detect_team_mismatches, editable via patchOcrRow):
 *   row_id, raw_name, matched_user_id, matched_username, confidence, kills, placement,
 *   matched_team_id, matched_team_name, expected_team_id, team_mismatch, admin_confirmed_sub,
 *   top_candidates.
 *
 * `corrected_text` is a FRONTEND-ADDED recognition-truth field (see OCRReviewTable.tsx): the
 * exact on-screen text the admin confirms the pixels say. The PATCH endpoint does not persist it
 * today; the review table carries it locally and sends it inside commit's `final_rows` so the
 * (future) training-capture step can read it. It defaults to raw_name. See the comment block in
 * OCRReviewTable.tsx for the full rationale.
 */
export interface DraftRow {
  row_id: string;
  raw_name: string;
  matched_user_id: number | null;
  matched_username: string | null;
  confidence: number | null;
  kills: number | null;
  placement: number | null;
  matched_team_id: number | null;
  matched_team_name: string | null;
  expected_team_id: number | null;
  team_mismatch: boolean;
  admin_confirmed_sub: boolean;
  top_candidates: OcrCandidate[];
  // Frontend-only recognition-truth capture (see note above). Optional; defaults to raw_name.
  corrected_text?: string;
}

/** The OCR draft session returned by upload / getOcrSession. */
export interface OcrSession {
  session_id: string;
  status: "pending_review" | "committed" | "discarded";
  event_type: "solo" | "team";
  draft_rows: DraftRow[];
  // Present only on the GET detail response (not on the upload response).
  match_id?: number;
  map_index?: number;
  created_at?: string;
  updated_at?: string;
  // Which engine answered this session (e.g. "gemini-2.5-pro", "local_student_v1", "hybrid").
  // Not emitted by the current backend (it lives on OCRTrainingPair, written at commit), so this
  // is optional - OCRReviewTable only renders the Engine badge when it is present.
  teacher_model?: string | null;
  engine?: string | null;
}

/** PATCH body for one row (afc_ocr.views.ocr_session_detail PATCH). All fields optional but row_id. */
export interface PatchOcrRowBody {
  row_id: string;
  matched_user_id?: number | null;
  matched_username?: string | null;
  matched_team_id?: number | null;
  kills?: number;
  admin_confirmed_sub?: boolean;
  // corrected_text is accepted here for forward-compat but is NOT persisted server-side today
  // (the PATCH view ignores unknown keys). The review table relies on commit's final_rows for it.
  corrected_text?: string;
}

/** Optional commit body. Omit final_rows to commit the session's current draft_rows as-is. */
export interface CommitOcrBody {
  final_rows?: DraftRow[];
}

/** A 400 from commit carries one of these lists naming the rows that blocked the write. */
export interface CommitOcrError {
  message?: string;
  unresolved?: string[]; // raw_names with no matched player
  unacknowledged?: string[]; // raw_names that are a team mismatch but not yet acknowledged
}

export const ocrApi = {
  // ── Upload + (re)extract ───────────────────────────────────────────────────
  /**
   * POST /events/ocr-match-result/ (multipart FormData {match_id, map_index, screenshot}).
   * Uploads a result screenshot, runs the OCR engine, and returns a fresh draft session.
   * Consumed by MapSelectionStep.tsx (and ImageUploadStep.tsx's extract handler) - the returned
   * session_id + draft_rows are handed straight to OCRReviewTable.
   */
  uploadOcrScreenshot: (body: FormData) =>
    aPostForm<OcrSession>("ocr-match-result/", body),

  /**
   * POST /events/ocr-from-image/ ({image_id, match_id, map_index}).
   * Re-runs OCR on a screenshot ALREADY stored on the match (MatchResultImage) instead of a new
   * upload. Same response shape as uploadOcrScreenshot. Consumed by ImageUploadStep.tsx (the
   * "Extract" action on an existing image).
   */
  ocrFromStoredImage: (body: {
    image_id: number;
    match_id: number;
    map_index: number;
  }) => aPost<OcrSession>("ocr-from-image/", body),

  // ── Session read / edit / commit / discard ─────────────────────────────────
  /**
   * GET /events/ocr-session/<id>/ - refetch a draft (tab-restore).
   * Consumed by OCRReviewTable.tsx when it needs to reload a session it was handed only the id of.
   */
  getOcrSession: (sessionId: string) =>
    aGet<OcrSession>(`ocr-session/${sessionId}/`),

  /**
   * PATCH /events/ocr-session/<id>/ - update ONE row (identity / kills / sub acknowledgement).
   * Consumed by OCRReviewTable.tsx on every inline edit. Returns { message, draft_rows }.
   */
  patchOcrRow: (sessionId: string, body: PatchOcrRowBody) =>
    aPatch<{ message: string; draft_rows: DraftRow[] }>(
      `ocr-session/${sessionId}/`,
      body,
    ),

  /**
   * POST /events/ocr-session/<id>/commit/ - write the reviewed rows to the leaderboard via the
   * existing manual-entry path (afc_ocr.services.commit). May 400 with { unresolved } (rows with
   * no matched player) or { unacknowledged } (un-confirmed team mismatches). Consumed by
   * OCRReviewTable.tsx's Commit button.
   */
  commitOcrSession: (sessionId: string, body?: CommitOcrBody) =>
    aPost<{ message: string; leaderboard_id: number | null }>(
      `ocr-session/${sessionId}/commit/`,
      body ?? {},
    ),

  /**
   * DELETE /events/ocr-session/<id>/ - discard the draft (sets status="discarded").
   * Consumed by OCRReviewTable.tsx's Discard action.
   */
  discardOcrSession: (sessionId: string) =>
    aDelete<{ message: string }>(`ocr-session/${sessionId}/`),

  /**
   * GET /events/ocr-sessions/?match_id=<id> - list sessions (admin only). Optional; not wired
   * into the review flow yet, exposed for a future "resume a draft" picker.
   */
  listOcrSessions: (params?: { match_id?: number }) =>
    aGet<any[]>("ocr-sessions/", params),
};
