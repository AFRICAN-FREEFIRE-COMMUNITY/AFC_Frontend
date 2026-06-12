/**
 * lib/headToHead.ts — typed client for the CLASH SQUAD head-to-head BRACKET feature.
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

/** One head-to-head match box in the tree (or one row in a league matchday). */
export interface H2HMatch {
  h2h_match_id: number;
  bracket: "winners" | "losers" | "league";
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
  losses: number;
  rounds_won: number;
  rounds_lost: number;
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
  };
  standings: H2HStandingRow[];
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
  getBracket: async (stageId: number) =>
    (await axios.get<H2HBracket>(`${BASE}/stages/${stageId}/bracket/`, { headers: headers() }))
      .data,

  /** Generate (or regenerate, while no real match has completed) the bracket.
   *  teamIds is the SEED ORDER: index 0 = seed 1. fmt omitted = backend derives from stage_format. */
  generateBracket: async (stageId: number, teamIds: number[], fmt?: BracketFormat) =>
    (
      await axios.post<GenerateBracketResponse>(
        `${BASE}/stages/${stageId}/bracket/generate/`,
        { team_ids: teamIds, ...(fmt ? { fmt } : {}) },
        { headers: headers() },
      )
    ).data,

  /** Report (or correct, while downstream allows) a match result. Ties 400 in elimination
   *  formats; the backend error message is surfaced verbatim by the caller. */
  reportResult: async (matchId: number, scoreA: number, scoreB: number) =>
    (
      await axios.post<ReportResultResponse>(
        `${BASE}/h2h-matches/${matchId}/result/`,
        { score_a: scoreA, score_b: scoreB },
        { headers: headers() },
      )
    ).data,
};
