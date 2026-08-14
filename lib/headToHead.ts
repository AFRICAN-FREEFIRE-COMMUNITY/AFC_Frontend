/**
 * lib/headToHead.ts - typed client for the CLASH SQUAD head-to-head BRACKET feature.
 *
 * Backend: afc_tournament_and_scrims/head_to_head_views.py, mounted under /events/ (see that
 * module's header for full shapes). A bracket = seeded H2H matches for a clash squad stage
 * (single elim, double elim, league, or round robin). Generating writes the full match tree
 * up-front (byes auto-complete 0-0); reporting a result advances winners (and losers, for
 * double elim) into their next slot. When the last match completes the backend writes final
 * placements to the stage leaderboard and returns bracket_complete: true.
 *
 * Endpoints used here:
 *   GET  /events/stages/<stage_id>/bracket/            -> bracket JSON (public read)
 *   POST /events/stages/<stage_id>/bracket/generate/   -> {message, bracket} (manager only;
 *        regeneration allowed only while no real match has completed)
 *   POST /events/h2h-matches/<match_id>/result/        -> {message, match, bracket_complete}
 *        (ties refused in elimination formats; allowed in league formats)
 *
 * CONSUMED BY: components/h2h-bracket.tsx (the bracket card on the admin event page).
 */
import axios from "axios";
import Cookies from "js-cookie";

import { env } from "@/lib/env";
// The room-settings summary shape is owned by lib/csRoom.ts (the room-settings client); the
// bracket payload embeds it per match and per stage, so it is imported rather than re-declared.
import type { CSRoomSummary } from "@/lib/csRoom";

const BASE = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events`;

function headers() {
  return { Authorization: `Bearer ${Cookies.get("auth_token") ?? ""}` };
}

// ── shapes (mirror head_to_head_views.py serialization exactly) ──────────────

/** The four bracket formats the backend can generate. Defaults derive from stage_format:
 *  'cs - knockout' -> single_elim, 'cs - double elimination' -> double_elim,
 *  'cs - league' -> league, 'cs - round robin' -> round_robin_h2h, 'cs - normal' -> single_elim. */
export type BracketFormat = "single_elim" | "double_elim" | "league" | "round_robin_h2h";

/** A team slot inside a match. null = slot not filled yet (TBD, waiting on a feeder match). */
export interface H2HTeamRef {
  tournament_team_id: number;
  team_name: string;
}

/** One player's line in one Clash Squad set. Written from the "Enter result" dialog; summed per
 *  player by the backend into the stage's single TournamentPlayerMatchStats row, which is what
 *  player profiles, kill tables and the ranking ladders read (owner 2026-08-12). */
export interface H2HPlayerStatLine {
  player_id: number;
  tournament_team_id: number;
  kills: number;
  damage: number;
  assists: number;
  played: boolean;
}

/** A rostered player who can be given a stat line, from GET h2h-matches/<id>/rosters/. */
export interface H2HRosterPlayer {
  player_id: number;
  username: string;
  in_game_name: string;
  in_game_role: string;
}

/** One side of a set plus its roster (the rosters endpoint returns team_a first, then team_b). */
export interface H2HRosterTeam {
  tournament_team_id: number;
  team_name: string;
  players: H2HRosterPlayer[];
}

/** How a set was decided. "normal" is an ordinary played set; the other three mean nobody played
 *  it, and the bracket card shows a badge saying which (owner 2026-08-12). */
export type H2HResultType = "normal" | "forfeit" | "walkover" | "dq";

/** The room settings in force for one match, already resolved match -> stage -> event by the
 *  backend. source_scope says where they came from, so the card can print "from Stage 1".
 *  room_id / room_password are blank until the organizer publishes them (or always, for a viewer
 *  who cannot manage the event). */
export interface H2HMatchRoom {
  source_scope: "match" | "stage" | "event";
  summary: CSRoomSummary | null;
  room_id: string;
  room_password: string;
  notes: string;
  is_published: boolean;
  has_room_credentials: boolean;
}

/** One head-to-head match box in the tree (or one row in a league matchday). */
export interface H2HMatch {
  h2h_match_id: number;
  /** "third" is the optional bronze match in a single-elimination bracket. */
  bracket: "winners" | "losers" | "league" | "third";
  round_number: number;
  position: number;
  team_a: H2HTeamRef | null;
  team_b: H2HTeamRef | null;
  score_a: number | null;
  score_b: number | null;
  winner_id: number | null; // tournament_team_id of the winner (null until completed / on league tie)
  status: "pending" | "live" | "completed";
  is_bye: boolean; // bye matches auto-complete 0-0 and just pass the seeded team through
  next_match_id: number | null; // where the winner advances to
  next_match_slot: "a" | "b" | null;
  loser_next_match_id: number | null; // double elim only: where the loser drops to
  loser_next_match_slot: "a" | "b" | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  /** "normal" unless the set was awarded without being played (forfeit / walkover / dq), in which
   *  case result_note carries the organizer's one-line reason. */
  result_type?: H2HResultType;
  result_note?: string;
  /** The room settings that apply to THIS set, or null when the event has none configured. */
  room?: H2HMatchRoom | null;
  /** Per-player lines already entered for this set; empty when only the score was recorded.
   *  The result dialog pre-fills from these so a correction starts from the last entry. */
  player_stats?: H2HPlayerStatLine[];
}

/** One round (column in the tree / matchday in a league). */
export interface H2HRound {
  round: number;
  matches: H2HMatch[];
}

/** One standings row. placement is null until the bracket finishes (league: until all played). */
export interface H2HStandingRow {
  tournament_team_id: number;
  team_name: string;
  placement: number | null;
  wins: number;
  /** Drawn sets. Always 0 in an elimination bracket (ties are refused there), so the table only
   *  shows the column for league formats (owner 2026-08-12: a team that drew once read "2-2" and
   *  looked like it had played one match fewer than it had). */
  draws?: number;
  losses: number;
  rounds_won: number;
  rounds_lost: number;
  /** League points on the backend's 3/1/0 scale (bracket.league_points), which is also what the
   *  league table is RANKED by. Carried on every row so the FE reads one shape. */
  points?: number;
}

/** The full bracket payload. Double-elim grand final lives in rounds.winners at round R+1. */
export interface H2HBracket {
  stage_id: number;
  stage_name: string;
  stage_format: string;
  fmt: BracketFormat;
  generated: boolean;
  rounds: {
    winners: H2HRound[];
    losers: H2HRound[]; // populated for double_elim only
    league: H2HRound[]; // populated for league / round_robin_h2h only
    /** The optional third-place match: single elimination only, and only when the bracket was
     *  generated with third_place. One round holding one match, fed by the two semifinals'
     *  losers - its winner is 3rd, its loser 4th. Optional so an older payload still parses. */
    third?: H2HRound[];
  };
  /** Which bracket this payload IS. null for the legacy stage-wide bracket. */
  group_id?: number | null;
  group_name?: string | null;
  /** Every bracket in the stage, so a page can draw one card per group without a second
   *  request (owner item 21, 2026-08-13). One entry for a stage nobody split. */
  stage_brackets?: Array<{
    group_id: number;
    group_name: string;
    bracket_format: BracketFormat;
    third_place: boolean;
  }>;
  standings: H2HStandingRow[];
  /** The stage's OWN competitor pool (StageCompetitor rows), in the order they entered the stage.
   *  Written by "Add Teams to Stage" and by advancing qualifiers out of a previous stage, so for a
   *  finals stage this is exactly the qualified teams in placement order. The generate dialog seeds
   *  from this when it is non-empty and falls back to the full event registration list when it is
   *  empty (a one-stage event where nobody curated a pool). Optional so an older cached payload
   *  without the field still parses. */
  stage_competitors?: H2HTeamRef[];
  /** {round_number: the team resting that matchday} - only for an odd-sized round robin, where
   *  the circle method leaves exactly one team unpaired per matchday and the bracket never said
   *  who (owner 2026-08-12). Keys arrive as strings because it is JSON. */
  sit_outs?: Record<string, H2HTeamRef>;
  /** The points scale the backend ranked the league table by, so the FE labels match the maths. */
  league_points?: { win: number; draw: number; loss: number };
  /** The STAGE-level room settings (resolved stage -> event), shown above the tree. Null when the
   *  event has no room settings configured anywhere. */
  room?: {
    source_scope: "stage" | "event" | null;
    summary: CSRoomSummary | null;
    is_published: boolean;
    /** True when a room ID exists at all, even while it is being withheld. */
    has_room_credentials: boolean;
    room_id: string;
    room_password: string;
    notes: string;
  } | null;
}

/** Response of POST .../bracket/generate/. */
export interface GenerateBracketResponse {
  message: string;
  bracket: H2HBracket;
}

/** Response of POST /events/h2h-matches/<id>/result/. bracket_complete: true means the final
 *  match just finished and placements were written to the stage leaderboard. */
export interface ReportResultResponse {
  message: string;
  match: H2HMatch;
  bracket_complete: boolean;
}

// ── api ───────────────────────────────────────────────────────────────────────

export const headToHeadApi = {
  /** Read the bracket for a stage (public; works pre-generation too: generated will be false). */
  getBracket: async (stageId: number, groupId?: number | null) =>
    (
      await axios.get<H2HBracket>(
        `${BASE}/stages/${stageId}/bracket/${groupId ? `?group_id=${groupId}` : ""}`,
        { headers: headers() },
      )
    ).data,

  /** Generate (or regenerate, while no real match has completed) the bracket.
   *  teamIds is the SEED ORDER: index 0 = seed 1. fmt omitted = backend derives from stage_format.
   *  thirdPlace adds the bronze match between the two semifinal losers; the backend ignores it
   *  for any format other than single elimination and for a bracket with no semifinals. */
  generateBracket: async (
    stageId: number,
    teamIds: number[],
    fmt?: BracketFormat,
    thirdPlace?: boolean,
    /** Which group's bracket, when the stage has been split (owner item 21). Omitted, the
     *  backend uses the stage's single bracket and creates its group the first time. */
    groupId?: number | null,
  ) =>
    (
      await axios.post<GenerateBracketResponse>(
        `${BASE}/stages/${stageId}/bracket/generate/`,
        {
          team_ids: teamIds,
          ...(fmt ? { fmt } : {}),
          ...(thirdPlace ? { third_place: true } : {}),
          ...(groupId ? { group_id: groupId } : {}),
        },
        { headers: headers() },
      )
    ).data,

  /** Report (or correct, while downstream allows) a match result. Ties 400 in elimination
   *  formats; the backend error message is surfaced verbatim by the caller.
   *  playerStats REPLACES this set's per-player lines; omit it to leave them untouched. Every
   *  line must name a player on that team's roster for the event or the whole call 400s and the
   *  score is rolled back with it. */
  reportResult: async (
    matchId: number,
    scoreA: number,
    scoreB: number,
    playerStats?: H2HPlayerStatLine[],
  ) =>
    (
      await axios.post<ReportResultResponse>(
        `${BASE}/h2h-matches/${matchId}/result/`,
        {
          score_a: scoreA,
          score_b: scoreB,
          ...(playerStats ? { player_stats: playerStats } : {}),
        },
        { headers: headers() },
      )
    ).data,

  /** Both teams' rosters for one set, for the per-player stat rows in the result dialog.
   *  Manager-only (same gate as entering the result), so it is fetched when the dialog opens
   *  rather than riding along with the public bracket read. */
  getMatchRosters: async (matchId: number) =>
    (
      await axios.get<{ teams: H2HRosterTeam[] }>(
        `${BASE}/h2h-matches/${matchId}/rosters/`,
        { headers: headers() },
      )
    ).data.teams,

  /** Award a set that was never played: a forfeit, a walkover or a disqualification.
   *  Records WHO advances and WHY instead of making the organizer invent a scoreline that then
   *  feeds the round-difference tiebreak as if a real set had happened (owner 2026-08-12). */
  awardOutcome: async (
    matchId: number,
    outcome: Exclude<H2HResultType, "normal">,
    winnerId: number,
    note?: string,
  ) =>
    (
      await axios.post<ReportResultResponse>(
        `${BASE}/h2h-matches/${matchId}/result/`,
        { outcome, winner_id: winnerId, result_note: note ?? "" },
        { headers: headers() },
      )
    ).data,

  /** Set a match's kick-off time, or mark it live. Gated on can_edit_events (scheduling is event
   *  editing, not result entry). Pass null to clear a date or time; "completed" is never settable
   *  here - a match completes by having a result. */
  updateMatch: async (
    matchId: number,
    patch: {
      scheduled_date?: string | null;
      scheduled_time?: string | null;
      status?: "pending" | "live";
    },
  ) =>
    (
      await axios.patch<{ message: string; match: H2HMatch }>(
        `${BASE}/h2h-matches/${matchId}/`,
        patch,
        { headers: headers() },
      )
    ).data,
};

// ── player-side result submission (owner 2026-08-12) ─────────────────────────
// The head-to-head counterpart of the Battle Royale team-submission flow: a player on one of the
// two teams proposes the set result, and an organizer approves (which writes it) or rejects it.
// Backend: afc_tournament_and_scrims/h2h_submissions.py.

/** One submission in the queue. score_a / score_b are always in the MATCH's own a/b order, never
 *  "us/them", so the two teams' claims can be compared directly. */
export interface H2HSubmission {
  submission_id: number;
  h2h_match_id: number;
  tournament_team_id: number;
  team_name: string;
  submitted_by: string;
  submitted_at: string;
  score_a: number | null;
  score_b: number | null;
  note: string;
  status: "pending" | "approved" | "rejected" | "superseded";
  reviewed_at: string | null;
  review_note: string;
  players?: Array<{ player_id: number; kills: number; damage: number; assists: number }>;
}

/** Whether the two teams' pending submissions say the same thing. Two agreeing submissions are
 *  the strongest evidence an organizer can get; a disagreement is worth showing rather than
 *  resolving silently in favour of whoever typed first. */
export type H2HAgreement = "agree" | "disagree" | "one_side" | "none";

export const h2hSubmissionApi = {
  /** A player on one of the two teams proposes the result. Submitting again REPLACES their own
   *  pending submission. players may only name their OWN roster. */
  submit: async (
    matchId: number,
    scoreA: number,
    scoreB: number,
    players?: Array<{ player_id: number; kills: number; damage: number; assists: number }>,
    note?: string,
  ) =>
    (
      await axios.post<{ message: string; submission: H2HSubmission }>(
        `${BASE}/h2h-matches/${matchId}/submit-result/`,
        { score_a: scoreA, score_b: scoreB, players: players ?? [], note: note ?? "" },
        { headers: headers() },
      )
    ).data,

  /** Everything sent in for this set, plus whether the two sides agree. Visible to the organizer
   *  AND to a player on either team (a team should be able to see whether its opponent agreed). */
  list: async (matchId: number) =>
    (
      await axios.get<{
        submissions: H2HSubmission[];
        agreement: H2HAgreement;
        can_review: boolean;
      }>(`${BASE}/h2h-matches/${matchId}/submissions/`, { headers: headers() })
    ).data,

  /** Approve, optionally correcting the scoreline first. This is what writes the result. */
  approve: async (
    submissionId: number,
    correction?: { score_a: number; score_b: number },
    reviewNote?: string,
  ) =>
    (
      await axios.post<ReportResultResponse>(
        `${BASE}/h2h-submissions/${submissionId}/approve/`,
        { ...(correction ?? {}), review_note: reviewNote ?? "" },
        { headers: headers() },
      )
    ).data,

  /** Reject with a reason (required: a rejection with no reason just makes the team guess). */
  reject: async (submissionId: number, reviewNote: string) =>
    (
      await axios.post<{ message: string; submission: H2HSubmission }>(
        `${BASE}/h2h-submissions/${submissionId}/reject/`,
        { review_note: reviewNote },
        { headers: headers() },
      )
    ).data,
};
