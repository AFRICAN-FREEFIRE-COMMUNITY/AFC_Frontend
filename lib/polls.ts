import axios from "axios";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

/**
 * Typed client for the AFC poll engine (backend app `afc_polls`, URL prefix `polls/`).
 *
 * Mirrors lib/partners.ts: axios + the BASE url + Bearer-from-cookie auth, so callers never
 * thread a token through props. Errors surface as axios errors with `err.response.data.message`
 * and are handled with a toast at the call site, like the rest of the app.
 *
 * WHAT A POLL IS, so the types below read in context. One engine, with award ballots as a preset
 * of it: an award category is a single-choice question whose options are the nominees, so
 * `kind: "award"` is presentation plus a place on the Polls page, not a second code path. See
 * backend/afc_polls/models.py and WEBSITE/tasks/polls-spec.md.
 *
 * THE TWO THINGS A READER OF THIS FILE SHOULD KNOW
 *   1. THE SUBMIT BUTTON IS NOT THE GATE. `submitResponse` can come back 403 with the FULL
 *      eligibility verdict in `error.response.data.eligibility`, because the server re-checks at
 *      submit. That body is the same shape `getPoll` already returned, so a refusal arriving late
 *      is rendered by the code that was already on the page.
 *   2. A PUBLISHED WINNER IS NOT A TALLY. `published_winner_option_id` carries the claim the site
 *      has been making since 2025, transcribed from the old page file, and it can legitimately
 *      disagree with the recomputed counts. Render the published fields on an award result and the
 *      per-option `votes` as the runner-up detail; never treat max(votes) as the winner.
 *
 * CONSUMED BY
 *   app/(user)/polls/page.tsx, app/(user)/polls/[slug]/page.tsx  - the public ballot
 *   app/(user)/awards/...                                        - the grand awards surface
 *   app/(a)/a/polls/...                                          - the builder and results
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

const url = (path: string) => `${BASE}/polls/${path}`;

async function aGet<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  return (await axios.get(url(path), { params, headers: authHeaders() })).data;
}
async function aPost<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.post(url(path), body ?? {}, { headers: authHeaders() })).data;
}
async function aPatch<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.patch(url(path), body ?? {}, { headers: authHeaders() })).data;
}
async function aPut<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.put(url(path), body ?? {}, { headers: authHeaders() })).data;
}
async function aDelete<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.delete(url(path), { headers: authHeaders(), data: body })).data;
}

// ── the six answer types ──────────────────────────────────────────────────────────────────────
// Deliberately six. Date, number, file upload and matrix are excluded: a matrix is a grid of
// single-choice questions and is unusable at 390px, and most AFC users are on phones. Branching
// reads the first three only, because an option id and a scale point are stable things to write a
// rule against and free text is not.
export const ANSWER_TYPES = [
  "single_choice",
  "multiple_choice",
  "rating",
  "ranking",
  "short_text",
  "long_text",
] as const;
export type AnswerType = (typeof ANSWER_TYPES)[number];

/** The answer types a branch rule may watch. Kept here so the builder and the backend's
 *  `branching.branching_questions` cannot drift apart. */
export const BRANCHABLE_TYPES: AnswerType[] = ["single_choice", "multiple_choice", "rating"];

export type LinkedEntity = {
  type: "user" | "team";
  id: number;
  display_name: string;
  /** NULL means "draw the monogram". Never a placeholder URL: the frontend picks a designed
   *  monogram from the name, so a nominee with no photo is the same card with a different fill
   *  rather than a degraded one. */
  avatar_url: string | null;
  team_name: string;
  team_logo_url: string | null;
  profile_url: string;
};

export type PollOption = {
  option_id: number;
  order: number;
  /** A NAME, never machine-translated. "SCARLETT" in French is still "SCARLETT". */
  label: string;
  description?: string;
  image_url?: string;
  video_url?: string;
  linked_type?: "none" | "user" | "team";
  linked_id?: number | null;
  linked?: LinkedEntity | null;
  votes?: number;
};

export type PollQuestion = {
  question_id: number;
  /** The stable anchor: /awards/2025#best-esports-player survives a reorder. */
  slug: string;
  order: number;
  section_id?: number | null;
  prompt: string;
  help_text: string;
  answer_type: AnswerType;
  required: boolean;
  config: { max_choices?: number; scale_points?: number; scale_labels?: string[]; max_length?: number };
  options: PollOption[];
  published_winner_option_id?: number | null;
  published_winner_votes?: number | null;
  published_at?: string | null;
  response_count?: number;
};

export type BranchRule = {
  rule_id?: number;
  order?: number;
  when_question_id: number;
  operator: "is" | "is_not" | "is_any_of" | "gte" | "lte";
  value: { option_ids?: number[]; rating?: number };
  action: "show" | "hide";
  target_question_id: number | null;
  target_section_id: number | null;
};

export type Requirement = {
  key: string;
  label: string;
  requirement_text: string;
  /** null means "cannot be told yet", which is what a signed-out visitor sees. Refusing somebody
   *  we have not identified would be a guess dressed as a decision. */
  passed: boolean | null;
  your_value: string;
  fix_hint: string;
  fix_url: string;
};

export type Verdict = {
  eligible: boolean;
  /** "any" once the poll has explicitly picked people or teams, because a picked voter UNIONS
   *  with the category filters rather than intersecting. The panel has to word its heading
   *  differently in the two cases and cannot work that out from a flat list of ticks. */
  match_rule: "all" | "any";
  requirements: Requirement[];
};

export type TeamRollupRow = {
  question_id: number;
  winning_option_id: number | null;
  tally: Record<string, number>;
  answered_count: number;
  /** The quorum denominator is the PLAYING roles only. Counting coaches and managers would give
   *  the better-staffed team the harder quorum. */
  playing_roster_size: number;
  full_roster_size: number;
  quorum_target: number;
  quorum_met: boolean;
  resolution:
    | "plurality"
    | "tie_broken_by_captain"
    | "no_consensus"
    | "captain_override"
    | "below_quorum";
  set_by_username: string;
};

export type TeamBlock = {
  team_id: number;
  team_name: string;
  is_captain: boolean;
  captain_override_allowed: boolean;
  tie_policy: string;
  quorum: string;
  rollup: TeamRollupRow[];
};

export type PollCard = {
  slug: string;
  title: string;
  description: string;
  kind: "award" | "standard";
  awards_edition: string;
  subject?: "individual" | "team";
  opens_at: string | null;
  closes_at: string | null;
  is_open: boolean;
  is_closed: boolean;
  question_count: number | null;
  response_count: number | null;
  visibility?: string;
  anonymous?: boolean;
};

export type PollDetail = {
  poll: PollCard & {
    visibility: string;
    results_visibility: string;
    anonymous: boolean;
    allow_edit_until_close: boolean;
    show_voter_list: boolean;
    can_manage: boolean;
    accepting_answers: boolean;
    edition_slug: string;
  };
  questions: PollQuestion[];
  branch_rules: BranchRule[];
  sections: { section_id: number; title: string; order: number; max_selections: number | null }[];
  eligibility: Verdict;
  your_response: {
    answers: Record<string, number[]>;
    values: Record<string, { rating?: number; text?: string; positions?: Record<string, number> }>;
    status: string;
    submitted_at: string | null;
    can_edit: boolean;
  } | null;
  team: TeamBlock | null;
  results_visible: boolean;
  results_suppressed_small_cell: boolean;
  response_count: number;
};

export type AwardsEdition = {
  slug: string;
  title: string;
  year: number | null;
  tagline: string;
  hero_image: string;
  nominations_close: string | null;
  voting_opens_at: string | null;
  voting_closes_at: string | null;
  winners_announced_at: string | null;
  /** DERIVED from the dates on every read, never stored, so a countdown and a live ballot can
   *  never disagree about which moment the season is in. */
  phase: "announced" | "voting" | "counting" | "winners" | "archived";
  winners_are_public: boolean;
  poll_count: number;
};

export type EditionDetail = {
  edition: AwardsEdition;
  polls: (PollCard & {
    accepting_answers: boolean;
    results_visible: boolean;
    eligibility: Verdict;
    answered_question_ids: number[];
    questions: PollQuestion[];
  })[];
  totals: { questions: number; answered: number | null };
};

/** One posted answer. Which key is filled depends on the question's answer_type:
 *  choice and ranking send `option_ids` (ranking's ORDER is the ranking), rating sends `rating`,
 *  and the two text types send `text`. */
export type PostedAnswer = {
  question_id: number;
  option_ids?: number[];
  rating?: number;
  text?: string;
};

export const pollsApi = {
  // ── public ──
  listPolls: (params?: { kind?: string; edition?: string; state?: string; limit?: number }) =>
    aGet<{ results: PollCard[]; has_more: boolean; total_count: number }>("", params),
  getPoll: (slug: string) => aGet<PollDetail>(`${slug}/`),
  submitResponse: (slug: string, answers: PostedAnswer[]) =>
    aPost<{ message: string; response_id: number }>(`${slug}/responses/`, { answers }),
  /** The captain sets the team's answer directly. Only reachable when the poll's
   *  `captain_override_allowed` is on, which is OFF by default. */
  setTeamAnswer: (slug: string, question_id: number, option_id: number) =>
    aPost<{ message: string; resolution: string }>(`${slug}/team-answer/`, {
      question_id,
      option_id,
    }),

  listEditions: () => aGet<{ results: AwardsEdition[] }>("editions/"),
  getEdition: (slug: string) => aGet<EditionDetail>(`editions/${slug}/`),

  watch: (body: { poll_slug?: string; edition_slug?: string; reason: string }) =>
    aPost<{ watching: boolean }>("watch/", body),
  unwatch: (body: { poll_slug?: string; edition_slug?: string; reason: string }) =>
    aDelete<{ watching: boolean }>("watch/", body),

  // ── admin ──
  adminList: (params?: { limit?: number; offset?: number }) =>
    aGet<{ results: PollCard[]; has_more: boolean; total_count: number }>("admin/polls/", params),
  adminCreate: (body: Record<string, any>) => aPost<{ slug: string }>("admin/polls/", body),
  adminGet: (slug: string) => aGet<any>(`admin/polls/${slug}/`),
  adminUpdate: (slug: string, body: Record<string, any>) =>
    aPatch<{ slug: string }>(`admin/polls/${slug}/`, body),
  adminDelete: (slug: string) => aDelete(`admin/polls/${slug}/`),
  /** A WHOLE-LIST replace, because that is how the builder works: an admin reorders, renames and
   *  removes in one edit and presses save once. Refused once the poll has answers. */
  adminSaveQuestions: (slug: string, questions: any[], branch_rules?: BranchRule[]) =>
    aPut<{ message: string }>(`admin/polls/${slug}/questions/`, { questions, branch_rules }),
  adminResults: (slug: string) => aGet<any>(`admin/polls/${slug}/results/`),
  adminPublishWinner: (
    slug: string,
    body: { question_id: number; option_id: number | null; votes?: number | null },
  ) => aPost<{ message: string }>(`admin/polls/${slug}/publish-winner/`, body),
  /** Announces to the poll's OWN eligibility spec, so the people notified are exactly the people
   *  who may vote. Inherits the existing broadcast email-volume guard. */
  adminAnnounce: (slug: string, body: { title?: string; message?: string; delivery?: string }) =>
    aPost<{ message: string; pushed: number; emailed: number; audience_count: number }>(
      `admin/polls/${slug}/announce/`,
      body,
    ),

  adminListEditions: () => aGet<{ results: AwardsEdition[] }>("admin/editions/"),
  adminCreateEdition: (body: Record<string, any>) =>
    aPost<{ slug: string }>("admin/editions/", body),
  adminUpdateEdition: (slug: string, body: Record<string, any>) =>
    aPatch<{ slug: string }>(`admin/editions/${slug}/`, body),
  adminDeleteEdition: (slug: string) => aDelete(`admin/editions/${slug}/`),
};
