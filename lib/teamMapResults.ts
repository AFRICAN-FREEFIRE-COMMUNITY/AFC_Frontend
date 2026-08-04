import axios from "axios";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

/**
 * Typed client for TEAM-SUBMITTED map results (owner backlog item 6).
 *
 * WHAT THE FEATURE IS: on a large event, only an organizer could enter a result, so one person
 * ended up transcribing screenshots that teams had already sent them on WhatsApp. A team can now
 * file its own row for one map, and the organizer approves it before it counts. The approval is
 * what writes the standings, so nothing a team types is ever live until a human says so.
 *
 * TWO SIDES, one module:
 *   TEAM      submit()  and  mine()      - a player on the roster proposes and watches their claim
 *   ORGANIZER queue(), approve(), reject() - the person who decides what is true
 *
 * Backend: afc_tournament_and_scrims/views_team_submissions.py, mounted under
 * events/team-map-results/. Auth is the house Bearer + validate_token on every call including the
 * team's, because "are you actually on this team" is the whole permission question here.
 *
 * CONSUMED BY:
 *   app/(user)/tournaments/[slug]/_components/TeamMapResultPanel.tsx   (the team's side)
 *   app/(a)/a/events/[slug]/_components/TeamResultQueue.tsx            (the organizer's queue)
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;
const url = (path: string) => `${BASE}/events/team-map-results/${path}`;

/** One player's line inside a team's proposed row. `user_id` is required: the backend drops
 *  entries without one, because a per-player stat row needs a named player to attach to. */
export type TeamResultPlayerEntry = {
  user_id: number;
  kills: number;
  damage?: number;
  assists?: number;
  played?: boolean;
};

/** What a team proposes for ONE map. Deliberately narrow, and it mirrors what the backend
 *  accepts: no team id (taken from the submitter's membership, never the body) and no point
 *  columns (computed from the event's scoring settings at approval time). Bonus and penalty are
 *  absent BY DESIGN on the team's side, see the note on `approve` below. */
export type TeamResultPayload = {
  placement: number;
  played: boolean;
  players: TeamResultPlayerEntry[];
};

export type TeamMapSubmissionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "superseded";

/** A conflict is the one thing an organizer cannot see by reading a single row: another team
 *  claiming the same finishing position on the same map. Reported rather than blocked at
 *  submission time, so one team's early mistake cannot stop another team filing anything. */
export type TeamMapSubmissionConflict = {
  submission_id: number;
  team_name: string;
  placement: number;
};

export type TeamMapSubmission = {
  submission_id: number;
  match_id: number;
  tournament_team_id: number;
  team_name: string;
  status: TeamMapSubmissionStatus;
  submitted_by: number;
  submitted_by_username: string;
  /** ISO 8601 UTC. Render through LocalTime, never pre-formatted here. */
  submitted_at: string | null;
  reviewed_by_username: string;
  reviewed_at: string | null;
  review_note: string;
  /** `{ "7709": "NXT TYSTER" }` for every player named in either payload, so the organizer's
   *  queue can show WHOSE ranking the kills land in rather than a bare total. Keyed by the id as
   *  a string because it arrives as a JSON object. Missing ids are simply absent, and the UI
   *  falls back to the id: a deleted account should not blank the row. */
  player_names?: Record<string, string>;
  submitted_payload?: TeamResultPayload | null;
  /** What was ACTUALLY written. Null until approved. When it differs from submitted_payload,
   *  the organizer corrected something, and showing both is what makes that visible instead of
   *  taken on trust. */
  approved_payload?: TeamResultPayload | null;
  conflicts?: TeamMapSubmissionConflict[];
};

export const teamMapResultsApi = {
  /** POST submit/ - propose this team's row for one map. Replaces the team's own pending row
   *  rather than queueing a second one, so the organizer always sees one current answer. */
  submit: async (matchId: number, results: TeamResultPayload) =>
    (
      await axios.post(
        url("submit/"),
        { match_id: matchId, results },
        { headers: authHeaders() },
      )
    ).data as { submission: TeamMapSubmission },

  /** GET mine/ - every submission this player's team has made for one map, in any state, so a
   *  rejection and its note stay readable after the fact. */
  mine: async (matchId: number) =>
    (
      await axios.get(url("mine/"), {
        params: { match_id: matchId },
        headers: authHeaders(),
      })
    ).data as { submissions: TeamMapSubmission[] },

  /** GET queue/ - everything filed for one map, each row carrying its conflicts. */
  queue: async (matchId: number) =>
    (
      await axios.get(url("queue/"), {
        params: { match_id: matchId },
        headers: authHeaders(),
      })
    ).data as { submissions: TeamMapSubmission[]; match_id: number },

  /**
   * POST <id>/approve/ - write the result.
   *
   * `results` is optional and carries the organizer's CORRECTION: omit it to approve exactly what
   * the team sent, pass it to approve something different. Both versions are kept server side.
   *
   * `bonus_points` and `penalty_points` are organizer-only and are not part of TeamResultPayload
   * on purpose. A sanction is a ruling, not a claim, so a team cannot propose one for itself.
   */
  approve: async (
    submissionId: number,
    body?: {
      results?: TeamResultPayload;
      bonus_points?: number;
      penalty_points?: number;
    },
  ) =>
    (
      await axios.post(url(`${submissionId}/approve/`), body ?? {}, {
        headers: authHeaders(),
      })
    ).data as { submission: TeamMapSubmission },

  /** POST <id>/reject/ - refuse it. The note is REQUIRED by the backend and is shown to the
   *  team: "rejected" on its own makes them resubmit the same numbers and costs the organizer
   *  the round trip twice. */
  reject: async (submissionId: number, note: string) =>
    (
      await axios.post(
        url(`${submissionId}/reject/`),
        // The body key is `note`, NOT `review_note`. review_note is what the MODEL column is
        // called and what comes back on the serialized submission, which is exactly why this was
        // wrong first time: sending review_note left the endpoint seeing no note at all and
        // refusing every rejection, with the organizer staring at a filled-in box.
        { note },
        { headers: authHeaders() },
      )
    ).data as { submission: TeamMapSubmission },
};
