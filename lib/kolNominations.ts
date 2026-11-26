import axios from "axios";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

/**
 * lib/kolNominations.ts - the KOL creators' nomination round (AFC inbox #633 / #634).
 *
 * The creators on Garena's KOL List nominate for the six KOL Awards with a PERSONAL CODE (no account): up to 6 per
 * award, themselves included, and anybody they add by TikTok @handle (a WRITE-IN: owner, 26 Nov 2026, #637, a
 * person one creator adds is a candidate on every creator's ballot, never a voter, and nobody counts twice in one
 * award). Later the same day (#638 to #640): every award explained on the page by its `key`, SPARE codes with
 * nobody behind them (the door answers `needs_claim`, then `claim` says who they are), and codes a poll admin can
 * read back to copy (`readCode`). Backend: AFC-B afc_polls/kol_nominations.py (read its header for the shape). Design:
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
 * kol_bad_handle, kol_handle_unavailable, kol_write_in_too_fast, kol_write_ins_too_many, kol_claim_needed,
 * kol_claim_listed, kol_already_claimed, kol_claim_too_fast; admin: kol_admin_only, kol_bad_dates,
 * kol_round_missing, kol_merge_not_write_in, kol_bad_merge, kol_bad_spare_count, kol_code_not_found,
 * kol_code_unreadable ...) that the pages translate from their
 * own namespaces (awardsKol.nominate.errors, adminPolls.kolNom.errors).
 */

const BASE = `${env.NEXT_PUBLIC_BACKEND_API_URL}/polls`;

export type NominationState = "not_open" | "open" | "closed";

// write_in: somebody a creator added by handle (#637). WHO added them is never sent.
export type NominationCandidate = { creator_id: number; name: string; handle: string; country: string; write_in: boolean };

export type NominationBallot = {
  round: { edition_title: string; state: NominationState; opens_at: string | null; closes_at: string | null };
  me: { creator_id: number; name: string; handle: string };
  // key: creator | breakthrough | educational | streamer | voice | funniest (#638), what the page explains it by.
  awards: { question_id: number; name: string; key: string; max: number }[];
  candidates: NominationCandidate[];
  // {"<question_id>": [creator_id, ...]}
  picks: Record<string, number[]>;
  saved_at: string | null;
  // Only on a save: switched-off creators the server left out of what was sent.
  dropped?: number[];
};

/** What the door answers for an unclaimed SPARE code (#639): the round only; the page asks who they are. */
export type NominationClaim = { needs_claim: true; round: NominationBallot["round"] };

export const needsClaim = (answer: NominationBallot | NominationClaim): answer is NominationClaim =>
  "needs_claim" in answer && answer.needs_claim === true;

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
  // An unclaimed spare code answers NominationClaim instead (#639).
  openWithCode: (edition: string, code: string) =>
    creatorCall<NominationBallot | NominationClaim>(`${encodeURIComponent(edition)}/door/`, {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  // POST polls/kol-nominations/<edition>/claim/ {name, handle, country}: a spare code says who it belongs to (#639);
  // answers that creator's ballot.
  claim: (edition: string, body: { name: string; handle: string; country: string }) =>
    creatorCall(`${encodeURIComponent(edition)}/claim/`, { method: "POST", body: JSON.stringify(body) }),
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
  // The live code's id, for readCode (#640); null without a code.
  code_id: number | null;
  voted: boolean;
  last_used_at: string | null;
};

export type NominationAdmin = {
  edition: { slug: string; title: string; hidden: boolean };
  round: {
    state: NominationState;
    opens_at: string | null;
    closes_at: string | null;
    awards: { question_id: number; prompt: string; key: string }[];
  } | null;
  creators: NominationAdminCreator[];
  tally: Record<string, { creator_id: number; name: string; picks: number }[]>;
  failed_attempts: number;
  // Spare codes (#639), live ones, oldest first.
  spare_codes: {
    code_id: number;
    created_at: string;
    last_used_at: string | null;
    claimed_by: { creator_id: number; name: string; handle: string } | null;
  }[];
};

export type NominationCodeCopy = { code: string; link: string; message: string; language: "en" | "fr" | "pt" };

const admin = (edition: string, rest = "") => `${BASE}/admin/kol-nominations/${encodeURIComponent(edition)}/${rest}`;

export const kolNominationsAdminApi = {
  // GET polls/admin/kol-nominations/<edition>/
  get: async (edition: string) => (await axios.get<NominationAdmin>(admin(edition), { headers: authHeaders() })).data,
  // POST polls/admin/kol-nominations/<edition>/ {opens_at, closes_at}: set the round up (idempotent).
  setUp: async (edition: string, body: { opens_at: string | null; closes_at: string | null }) =>
    (await axios.post<NominationAdmin>(admin(edition), body, { headers: authHeaders() })).data,
  // POST polls/admin/kol-nominations/<edition>/codes/ {creator_ids?}: the CSV of NEW codes, as a Blob to save.
  // POST .../codes/ {spare: n}: n SPARE codes (1 to 50) as a CSV Blob (#639).
  spareCodes: async (edition: string, count: number) =>
    (await axios.post<Blob>(admin(edition, "codes/"), { spare: count }, {
      headers: authHeaders(),
      responseType: "blob",
    })).data,
  // GET .../codes/<code_id>/?lang=: one live code read back to copy, with its ready message (#640).
  readCode: async (edition: string, codeId: number, lang?: "en" | "fr" | "pt") =>
    (await axios.get<NominationCodeCopy>(admin(edition, `codes/${codeId}/`), {
      headers: authHeaders(),
      params: lang ? { lang } : undefined,
    })).data,
  // DELETE .../codes/<code_id>/: revoke one code.
  revokeCode: async (edition: string, codeId: number) =>
    (await axios.delete(admin(edition, `codes/${codeId}/`), { headers: authHeaders() })).data,
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
