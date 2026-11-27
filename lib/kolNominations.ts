import axios from "axios";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";
import type { AwardsEdition } from "@/lib/polls";

/**
 * lib/kolNominations.ts - the KOL creators' nomination round (AFC inbox #633 / #634).
 *
 * The creators on Garena's KOL List nominate for the six KOL Awards with a PERSONAL CODE (no account): up to 6 per
 * award, themselves included, and anybody they add by TikTok @handle (a WRITE-IN: owner, 26 Nov 2026, #637, a
 * person one creator adds is a candidate on every creator's ballot, never a voter, and nobody counts twice in one
 * award). Later the same day (#638 to #640): every award explained on the page by its `key`, SPARE codes with
 * nobody behind them (the door answers `needs_claim`, then `claim` says who they are), and codes a poll admin can
 * read back to copy (`readCode`). 27 Nov (#643 to #648): a ballot COUNTS only once every award has a pick (`complete`),
 * the creator gives an email and a WhatsApp number before their first pick (`contact_needed`, `saveContact`), can email
 * themselves their picks (`emailMe`), and admins keep each creator's contact and email them their codes
 * (`setContact`, `sendCodeEmails`). Backend: AFC-B afc_polls/kol_nominations.py (read its header for the shape). Design:
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
 * kol_code_unreadable; 27 Nov: kol_contact_needed, kol_bad_email, kol_bad_whatsapp, kol_whatsapp_country_code,
 * kol_contact_too_fast, kol_email_too_many, kol_email_send_failed, kol_bad_creator_ids ...) that the pages translate from their
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
  // #643: every award holds a pick, so the ballot counts (the server's word; the page also works it out live).
  complete: boolean;
  // #644: the creator still has to give their email and WhatsApp number before any pick is saved.
  contact_needed: boolean;
  // #648: "l***@gmail.com", where "Email me my picks" writes to; "" before the contact is given.
  email_hint: string;
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
  // PUT polls/kol-nominations/<edition>/contact/ {email, whatsapp}: both required (#644); answers the ballot.
  saveContact: (edition: string, body: { email: string; whatsapp: string }) =>
    creatorCall(`${encodeURIComponent(edition)}/contact/`, { method: "PUT", body: JSON.stringify(body) }),
  // POST polls/kol-nominations/<edition>/email-me/: the creator's picks as saved now, to the email they gave (#648).
  emailMe: (edition: string) =>
    creatorCall<{ message: string; email_hint: string }>(`${encodeURIComponent(edition)}/email-me/`, { method: "POST" }),
  // POST polls/kol-nominations/<edition>/search/ (#653): one search on the ballot, reported when it ends (a pick from
  // the results, or the box left without one). Read only by the admin Metrics tab (afc_polls/kol_metrics.py
  // search_log). Fire and forget: a failed report never shows the creator anything.
  logSearch: (edition: string, body: { question_id: number; query: string; result_count: number; picked_id: number | null }) =>
    creatorCall<{ logged: boolean }>(`${encodeURIComponent(edition)}/search/`, { method: "POST", body: JSON.stringify(body) })
      .catch(() => null),
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
  // #643: the ballot COUNTS (every award has a pick). awards_done: awards a saved ballot fills ("4 of 6").
  voted: boolean;
  awards_done: number;
  last_used_at: string | null;
  // #644: how AFC and Garena reach them ("" when unknown); contact_given_at: when the creator gave it on the ballot.
  email: string;
  whatsapp: string;
  contact_given_at: string | null;
  // #657: whether this creator's own saved ballot counts (a switch separate from `active`).
  ballot_counts: boolean;
  // #646: the latest code email. A queued one left by a restart arrives as failed / kol_email_interrupted.
  last_email: { status: "queued" | "sent" | "failed"; at: string; error: string; to: string } | null;
};

// The day the contacts and the code emails went live (#643 to #648): the NEW badges on the admin tab.
export const KOL_CONTACTS_SINCE = "2026-11-27";

// The day Garena's access went live (#641): the KOL Admin role and the round on Garena's live page. Drives the NEW
// badges on the KOL-only /a/polls, the Nominations tab's live link card, the role in Settings and the live page.
export const GARENA_ACCESS_SINCE = "2026-11-26";

/** One edition that has a nomination round (GET polls/admin/kol-nominations/, #641). */
export type NominationEdition = Pick<AwardsEdition, "slug" | "title" | "theme"> & { hidden: boolean };

export type NominationAdmin = {
  // live_view_token: Garena's private live link of this edition, "" when off (#641)
  edition: { slug: string; title: string; hidden: boolean; live_view_token: string };
  round: {
    state: NominationState;
    opens_at: string | null;
    closes_at: string | null;
    awards: { question_id: number; prompt: string; key: string }[];
  } | null;
  creators: NominationAdminCreator[];
  // How many awards the round has (6): a ballot counts once it fills them all.
  award_count: number;
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
  // GET polls/admin/kol-nominations/: the editions that have a round, the edition picker of a KOL admin (#641),
  // who is refused the full editions list. AFC-B afc_polls/kol_nominations.py admin_editions.
  editions: async () =>
    (await axios.get<{ results: NominationEdition[] }>(`${BASE}/admin/kol-nominations/`, { headers: authHeaders() })).data,
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
  // PATCH polls/admin/kol-nominations/<edition>/creators/<id>/ {ballot_counts}: their own ballot counts or not (#657).
  setBallotCounts: async (edition: string, creatorId: number, ballotCounts: boolean) =>
    (await axios.patch(admin(edition, `creators/${creatorId}/`), { ballot_counts: ballotCounts }, {
      headers: authHeaders(),
    })).data,
  // PATCH polls/admin/kol-nominations/<edition>/creators/<id>/ {email, whatsapp}: their contact (#644); "" clears.
  setContact: async (edition: string, creatorId: number, body: { email: string; whatsapp: string }) =>
    (await axios.patch<{ email: string; whatsapp: string }>(admin(edition, `creators/${creatorId}/`), body, {
      headers: authHeaders(),
    })).data,
  // POST polls/admin/kol-nominations/<edition>/emails/ {creator_ids} or {all: true}: email their codes (#646). Answers
  // at once; the server sends on a paced thread and each row's last_email says how it went.
  sendCodeEmails: async (edition: string, target: { creator_ids: number[] } | { all: true }) =>
    (await axios.post<{ queued: number; no_email: number; not_voters: number; already_sending: number }>(
      admin(edition, "emails/"),
      target,
      { headers: authHeaders() },
    )).data,  // GET polls/admin/kol-nominations/<edition>/metrics/ (#653): everything the Metrics tab's "Nominations round" shows
  // (afc_polls/kol_metrics.py metrics). Read by KolNominationsMetrics.tsx.
  metrics: async (edition: string) =>
    (await axios.get<NominationMetrics>(admin(edition, "metrics/"), { headers: authHeaders() })).data,
};

// ── metrics (#653) ───────────────────────────────────────────────────────────────────────────────────────────────

// The day the nominations metrics went live: the NEW badge on the Metrics tab's "Nominations round".
export const KOL_METRICS_SINCE = "2026-11-28";

type MetricsPerson = { creator_id: number; name: string; handle: string };

/** The answer of GET polls/admin/kol-nominations/<edition>/metrics/, section by section (afc_polls/kol_metrics.py). All
 *  durations are whole seconds; instants are ISO strings for LocalTime; countries are ISO 3166 two-letter codes. */
export type NominationMetrics = {
  round: { opens_at: string | null; closes_at: string | null; state: string; recording_since: string | null };
  headline: {
    voters: number; counting: number; started_not_counting: number; codes_opened: number; never_opened: number;
    median_seconds: number | null; average_seconds: number | null; searches: number; searchers: number;
    searches_nothing: number; code_emails_sent: number; code_emails_failed: number; no_address: number;
  };
  funnel: { key: "in_round" | "emailed" | "opened" | "contact" | "picked" | "counting"; count: number }[];
  time: {
    ballots: number; from_first_save: number;
    bins: { key: "under_2m" | "2_to_5m" | "5_to_10m" | "10_to_30m" | "30m_to_1d" | "over_1d"; count: number }[];
    median_seconds: number | null; average_seconds: number | null; fastest_seconds: number | null;
    longest_seconds: number | null; open_to_first_pick_median: number | null;
    first_pick_to_counting_median: number | null; one_visit: number; came_back: number; visits_average: number | null;
  };
  searches: {
    most_searched: (MetricsPerson & { searches: number; by: number; picks: number })[];
    // `then`: "nothing", "picked:<name>" or "added:<name>" (what the same creator did within 10 minutes).
    found_nothing: { query: string; times: number; by: number; then: string }[];
    most_typed: { query: string; times: number; top: MetricsPerson & { times: number } }[];
  };
  awards: {
    question_id: number; name: string; with_pick: number; empty: number; only_self: number; avg_picks: number;
    distribution: number[]; picked_self: number; write_in_picks: number; nominees: number;
    top: (MetricsPerson & { picks: number }) | null;
  }[];
  activity: { days: { day: string; counted: number }[]; by_hour: number[]; peak_hour: number | null };
  changes: {
    total: number; after_counting: number; per_ballot_average: number | null;
    most_changed_award: { name: string; count: number } | null;
    most_removed: (MetricsPerson & { removed: number; picks: number })[];
    picks_emails: number; picks_emails_by: number; contact_given: number;
  };
  self: {
    picked_self: number;
    only_self: (MetricsPerson & { awards_only_self: number; saved_at: string | null; reminder: string })[];
    write_ins: (MetricsPerson & { added_by: MetricsPerson | null; picks: number })[];
  };
  devices: { key: string; count: number }[];
  countries: { country: string; ballots: number; counting: number; on_list: number }[];
  country_mismatch: number;
  codes: {
    creator_codes: number; opened: number; never_opened_count: number; spare_made: number; spare_claimed: number;
    revoked: number;
    never_opened: (MetricsPerson & {
      has_email: boolean; contact_given: boolean; email_status: "" | "queued" | "sent" | "failed" | "no_address";
      emailed_at: string | null;
    })[];
  };
  emails: {
    code_sent: number; code_failed: number; no_address: number; emailed_creators: number; opened_after_email: number;
    email_to_open_median: number | null; picks_sent: number;
    failed: (MetricsPerson & { address: string; error: string; at: string | null })[];
  };
  creators: (MetricsPerson & {
    country: string; has_email: boolean; contact_given: boolean; emailed: boolean; opened: boolean;
    first_open: string | null; visits: number; searches: number; awards_with_pick: number; counts: boolean;
    counted_at: string | null; seconds_to_count: number | null; changes: number; ballot_counts_switch: boolean;
  })[];
  generated_at: string;
};
