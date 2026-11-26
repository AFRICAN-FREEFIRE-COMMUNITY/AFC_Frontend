import axios from "axios";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

/**
 * lib/kolNominations.ts - the KOL creators' nomination round (AFC inbox #633 / #634).
 *
 * The creators on Garena's KOL List nominate for the six KOL Awards with a PERSONAL CODE (no account): up to 6 per
 * award, themselves included, and anybody they add by TikTok @handle (a WRITE-IN: owner, 26 Nov 2026, #637, a
 * person one creator adds is a candidate on every creator's ballot, never a voter, and nobody counts twice in one
 * award). Backend: AFC-B afc_polls/kol_nominations.py (read its header for the whole shape). Design:
 * WEBSITE/tasks/kol-nominations-design-2026-11-25.md, sections 10 and 11 for the write-ins.
 *
 * TWO DOORS, TWO WAYS OF KNOWING WHO IS ASKING
 *   1. The creator's page (KolNominate.tsx). No Bearer token: the code is posted once to the door, the server
 *      answers with an http-only `kol_ballot` cookie on the API's own host, and every later call sends that cookie
 *      (`credentials: "include"`). The page never sees the cookie and never stores the code.
 *   2. The admin tab (KolNominationsAdmin.tsx). The site's usual Bearer session, AFC poll admins only.
 *
 * Refusals carry a `code` (kol_code_wrong, kol_code_too_many, kol_code_needed, kol_code_replaced,
 * kol_too_many_picks, kol_bad_picks, kol_round_closed, kol_round_not_open, kol_save_too_many, kol_round_not_found,
 * kol_bad_handle, kol_handle_unavailable, kol_write_in_too_fast, kol_write_ins_too_many; admin: kol_admin_only,
 * kol_bad_dates, kol_round_missing, kol_merge_not_write_in, kol_bad_merge ...) that the pages translate from their
 * own namespaces (awardsKol.nominate.errors, adminPolls.kolNom.errors).
 */

const BASE = `${env.NEXT_PUBLIC_BACKEND_API_URL}/polls`;

export type NominationState = "not_open" | "open" | "closed";

// write_in: somebody a creator added by handle (#637). WHO added them is never sent.
export type NominationCandidate = { creator_id: number; name: string; handle: string; country: string; write_in: boolean };

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

async function creatorCall<T = NominationBallot>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/kol-nominations/${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new NominationError(res.status, body);
  return body as T;
}

/** A typed handle as the server keys it (afc_polls.kol_nominations.handle_from_text): a pasted profile link gives
 *  its @name, then spaces and a leading "@" go and the rest is lower case. Lets the page find a candidate already on
 *  screen without asking the server. */
export function handleKey(raw: string): string {
  let text = raw.trim();
  const link = /tiktok\.com\/@([^/?#\s]+)/i.exec(text);
  if (link) text = link[1];
  return text.trim().replace(/^@+/, "").trim().toLowerCase();
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
  // POST polls/kol-nominations/<edition>/write-in/ {handle, name?}: the candidate this handle is in the round, added
  // now when nobody had it (created). The page then picks them and saves the sheet as usual (saveBallot).
  addWriteIn: (edition: string, handle: string, name?: string) =>
    creatorCall<{ candidate: NominationCandidate; created: boolean }>(`${encodeURIComponent(edition)}/write-in/`, {
      method: "POST",
      body: JSON.stringify({ handle, ...(name?.trim() ? { name: name.trim() } : {}) }),
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
  // "list": on Garena's KOL List (a voter too); "write-in": added by a creator, a candidate only (#637).
  origin: "list" | "write-in";
  // A merged duplicate write-in: the candidate its picks moved to.
  merged_into: number | null;
  // How many people this creator added (a count only: who added whom is never sent).
  write_ins_added: number;
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
  // PATCH polls/admin/kol-nominations/<edition>/creators/<id>/ {merge_into}: a duplicate write-in's picks move to
  // the person it repeats (a ballot holding both keeps one), and the write-in leaves every ballot.
  merge: async (edition: string, creatorId: number, targetId: number) =>
    (await axios.patch(admin(edition, `creators/${creatorId}/`), { merge_into: targetId }, { headers: authHeaders() }))
      .data,
};
