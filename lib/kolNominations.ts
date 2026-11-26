import axios from "axios";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

/**
 * lib/kolNominations.ts - the KOL creators' nomination round (AFC inbox #633 / #634).
 *
 * The creators on Garena's KOL List nominate each other for the six KOL Awards with a PERSONAL CODE (no account):
 * up to 6 per award, never themselves. Backend: AFC-B afc_polls/kol_nominations.py (read its header for the
 * whole shape). Design: WEBSITE/tasks/kol-nominations-design-2026-11-25.md.
 *
 * TWO DOORS, TWO WAYS OF KNOWING WHO IS ASKING
 *   1. The creator's page (KolNominate.tsx). No Bearer token: the code is posted once to the door, the server
 *      answers with an http-only `kol_ballot` cookie on the API's own host, and every later call sends that cookie
 *      (`credentials: "include"`). The page never sees the cookie and never stores the code.
 *   2. The admin tab (KolNominationsAdmin.tsx). The site's usual Bearer session, AFC poll admins only.
 *
 * Refusals carry a `code` (kol_code_wrong, kol_code_too_many, kol_code_needed, kol_code_replaced,
 * kol_self_pick, kol_too_many_picks, kol_bad_picks, kol_round_closed, kol_round_not_open, kol_save_too_many,
 * kol_round_not_found, kol_admin_only, kol_bad_dates, kol_round_missing ...) that the pages print through
 * useServerMessage (messages/<locale>/serverMessages.json).
 */

const BASE = `${env.NEXT_PUBLIC_BACKEND_API_URL}/polls`;

export type NominationState = "not_open" | "open" | "closed";

export type NominationCandidate = { creator_id: number; name: string; handle: string; country: string };

export type NominationBallot = {
  round: { edition_title: string; state: NominationState; opens_at: string | null; closes_at: string | null };
  me: { creator_id: number; name: string; handle: string };
  awards: { question_id: number; name: string; max: number }[];
  candidates: NominationCandidate[];
  // {"<question_id>": [creator_id, ...]}
  picks: Record<string, number[]>;
  saved_at: string | null;
  // Only on a save: switched-off creators the server left out of what was sent.
  dropped?: number[];
};

/** A refusal from the nomination endpoints: the HTTP status plus the server's {message, code}. */
export class NominationError extends Error {
  status: number;
  code: string;
  constructor(status: number, body: { message?: string; code?: string } | null) {
    super(body?.message || "Request failed");
    this.status = status;
    this.code = body?.code || "";
  }
}

async function creatorCall(path: string, init: RequestInit = {}): Promise<NominationBallot> {
  const res = await fetch(`${BASE}/kol-nominations/${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new NominationError(res.status, body);
  return body as NominationBallot;
}

export const kolNominationsApi = {
  // POST polls/kol-nominations/<edition>/door/: the code, once; answers the ballot and sets the cookie.
  openWithCode: (edition: string, code: string) =>
    creatorCall(`${encodeURIComponent(edition)}/door/`, { method: "POST", body: JSON.stringify({ code }) }),
  // GET polls/kol-nominations/<edition>/ballot/: the ballot behind the cookie (401 kol_code_needed without one).
  getBallot: (edition: string) => creatorCall(`${encodeURIComponent(edition)}/ballot/`),
  // PUT polls/kol-nominations/<edition>/ballot/: the whole sheet, every award.
  saveBallot: (edition: string, picks: Record<string, number[]>, deviceKey?: string) =>
    creatorCall(`${encodeURIComponent(edition)}/ballot/`, {
      method: "PUT",
      body: JSON.stringify({ picks, ...(deviceKey ? { device_key: deviceKey } : {}) }),
    }),
  // POST polls/kol-nominations/<edition>/signout/: forget the cookie ("Not you? Use another code").
  signOut: (edition: string) =>
    fetch(`${BASE}/kol-nominations/${encodeURIComponent(edition)}/signout/`, {
      method: "POST",
      credentials: "include",
    }),
};

// ── admin (AFC poll admins, Bearer session) ──────────────────────────────────────────────────────────────────────

export type NominationAdminCreator = {
  creator_id: number;
  name: string;
  handle: string;
  country: string;
  sheet_status: string;
  active: boolean;
  has_code: boolean;
  voted: boolean;
  last_used_at: string | null;
};

export type NominationAdmin = {
  edition: { slug: string; title: string; hidden: boolean };
  round: {
    state: NominationState;
    opens_at: string | null;
    closes_at: string | null;
    awards: { question_id: number; prompt: string }[];
  } | null;
  creators: NominationAdminCreator[];
  tally: Record<string, { creator_id: number; name: string; picks: number }[]>;
  failed_attempts: number;
};

const admin = (edition: string, rest = "") => `${BASE}/admin/kol-nominations/${encodeURIComponent(edition)}/${rest}`;

export const kolNominationsAdminApi = {
  // GET polls/admin/kol-nominations/<edition>/
  get: async (edition: string) => (await axios.get<NominationAdmin>(admin(edition), { headers: authHeaders() })).data,
  // POST polls/admin/kol-nominations/<edition>/ {opens_at, closes_at}: set the round up (idempotent).
  setUp: async (edition: string, body: { opens_at: string | null; closes_at: string | null }) =>
    (await axios.post<NominationAdmin>(admin(edition), body, { headers: authHeaders() })).data,
  // POST polls/admin/kol-nominations/<edition>/codes/ {creator_ids?}: the CSV of NEW codes, as a Blob to save.
  codes: async (edition: string, creatorIds?: number[]) =>
    (await axios.post<Blob>(admin(edition, "codes/"), creatorIds ? { creator_ids: creatorIds } : {}, {
      headers: authHeaders(),
      responseType: "blob",
    })).data,
  // PATCH polls/admin/kol-nominations/<edition>/creators/<id>/ {active}
  setActive: async (edition: string, creatorId: number, active: boolean) =>
    (await axios.patch(admin(edition, `creators/${creatorId}/`), { active }, { headers: authHeaders() })).data,
};
