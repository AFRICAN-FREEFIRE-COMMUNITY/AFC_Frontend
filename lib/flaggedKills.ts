/**
 * Flagged-kill controls API (owner 2026-06-16).
 *
 * A "ringer" is a Free Fire UID that played for a team in a match-log FILE upload but is NOT on
 * that team's site roster. The backend records each as a MatchKillFlag and credits its kills to the
 * team only when it "counts" (per-flag override else the event-wide default). These helpers back the
 * <FlaggedKillsPanel/> shown on the event leaderboard editor for admins AND organizers.
 *
 * Endpoints (afc_tournament_and_scrims.views, prefix events/):
 *   GET   events/flagged-kills/?event_id=        -> list flags + the event default
 *   PATCH events/flagged-kills/set/              -> flip the event-wide default (recomputes totals)
 *   PATCH events/flagged-kills/flag/             -> override one flag's count_kills (recomputes)
 *   PATCH events/flagged-kills/bulk/             -> apply MANY flag/team decisions in ONE recompute
 * Auth: Bearer token of an AFC event admin OR an org member with can_upload_results.
 */
import { env } from "@/lib/env";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

// Name-based matching reasons (name-matching feature): a file player whose NAME matches a roster
// member but whose UID differs (uid_changed), or whose name matches a member registered on another
// team. Both are created pending (count_kills=false) and approved via the same setFlag PATCH.
// "unlisted_in_file" (owner 2026-07-07): the file's team KillScore exceeded the kills it listed against
// players (the Free Fire client dropped a player row). The gap is one synthetic flag (uid "unlisted",
// no registered_username) that counts by default (follows the event toggle) so the team total honors
// the official KillScore, and the organizer can switch it off here if a KillScore looks wrong.
export type FlagReason =
  | "not_on_roster"
  | "belongs_to_other_team"
  | "name_matched_uid_changed"
  | "name_matched_other_team"
  | "unlisted_in_file";

export type FlaggedKill = {
  flag_id: number;
  match_id: number;
  tournament_team_id: number;
  team_name: string | null;
  uid: string;
  name: string;
  kills: number;
  reason: FlagReason;
  registered_username: string | null;
  count_kills: boolean | null; // null = follow the event default
  effective_count: boolean; // resolved: does this player's kills count right now?
  // Where the flag was raised (owner 2026-07-10 scoping). null when the match has no group.
  stage_id: number | null;
  stage_name: string | null;
  group_id: number | null;
  group_name: string | null;
};

// An in-game team block from a match-log upload that matched NO registered team (owner 2026-06-30).
// The panel attributes it to a registered team (or leaves it uncounted) - the team-level companion to
// the per-player flags above, resolved on the SAME surface.
export type UnmatchedTeamRow = {
  block_id: number;
  match_id: number;
  team_name: string;
  placement: number;
  kills: number;
  attributed_team_id: number | null;
  attributed_team_name: string | null;
  // Where the block came from (owner 2026-07-10 scoping). null when the match has no group.
  stage_id: number | null;
  stage_name: string | null;
  group_id: number | null;
  group_name: string | null;
};

export type EventTeamOption = { tournament_team_id: number; team_name: string };

// The event's stage -> group structure, used to build the flagged-players combine picker.
export type FlaggedStage = {
  stage_id: number;
  stage_name: string;
  groups: { group_id: number; group_name: string }[];
};

export type FlaggedKillsResponse = {
  event_id: number;
  count_flagged_kills: boolean;
  flags: FlaggedKill[];
  flag_count: number;
  unmatched_teams: UnmatchedTeamRow[];
  event_teams: EventTeamOption[];
  // Stage/group structure for the combine picker + whether the response was scoped (owner 2026-07-10).
  stages: FlaggedStage[];
  scoped: boolean;
};

const authHeaders = (token: string, json = false): HeadersInit => ({
  ...(json ? { "Content-Type": "application/json" } : {}),
  Authorization: `Bearer ${token}`,
});

export const flaggedKillsApi = {
  // List an event's flagged players + the event-wide count_flagged_kills default. Optionally scope to
  // specific stages/groups (owner 2026-07-10): pass stageIds/groupIds and only flags raised in those
  // stages/groups come back. Omit both for the whole event. The response also carries the event's
  // stage->group structure so the panel can render its combine picker.
  get: async (
    eventId: number | string,
    token: string,
    opts?: { stageIds?: number[]; groupIds?: number[] },
  ): Promise<FlaggedKillsResponse> => {
    const params = new URLSearchParams({ event_id: String(eventId) });
    if (opts?.stageIds?.length) params.set("stage_ids", opts.stageIds.join(","));
    if (opts?.groupIds?.length) params.set("group_ids", opts.groupIds.join(","));
    const r = await fetch(`${BASE}/events/flagged-kills/?${params.toString()}`, {
      headers: authHeaders(token),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.message || "Failed to load flagged kills.");
    return r.json();
  },

  // Flip the event-wide default (true = count every flagged player's kills). Recomputes team totals.
  setEventDefault: async (eventId: number | string, count: boolean, token: string) => {
    const r = await fetch(`${BASE}/events/flagged-kills/set/`, {
      method: "PATCH",
      headers: authHeaders(token, true),
      body: JSON.stringify({ event_id: eventId, count_flagged_kills: count }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.message || "Failed to update.");
    return r.json();
  },

  // Override ONE flagged player: true = always count, false = never, null = follow the event default.
  setFlag: async (flagId: number, count: boolean | null, token: string) => {
    const r = await fetch(`${BASE}/events/flagged-kills/flag/`, {
      method: "PATCH",
      headers: authHeaders(token, true),
      body: JSON.stringify({ flag_id: flagId, count_kills: count }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.message || "Failed to update.");
    return r.json();
  },

  // Attribute one unmatched in-game team block to a registered team (its placement + kills are scored
  // for that team), or pass null to clear it ("don't count"). Recomputes the event standings.
  attributeUnmatchedTeam: async (
    blockId: number,
    tournamentTeamId: number | null,
    token: string,
  ) => {
    const r = await fetch(`${BASE}/events/flagged-kills/unmatched-team/`, {
      method: "PATCH",
      headers: authHeaders(token, true),
      body: JSON.stringify({ block_id: blockId, tournament_team_id: tournamentTeamId }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.message || "Failed to update.");
    return r.json();
  },

  // Bulk accept/reject (owner 2026-07-13): apply MANY flagged-player decisions AND/OR unmatched-team
  // attributions in ONE call that recomputes the event totals just ONCE. Each single setFlag/
  // attributeUnmatchedTeam re-scores the whole event, so accepting/rejecting one by one felt slow;
  // the panel's "Accept all" / "Reject all" / per-team buttons batch every decision through here.
  // flags: [{flag_id, count_kills:true|false|null}], unmatched: [{block_id, tournament_team_id|null}].
  bulkSet: async (
    eventId: number | string,
    payload: {
      flags?: { flag_id: number; count_kills: boolean | null }[];
      unmatched?: { block_id: number; tournament_team_id: number | null }[];
    },
    token: string,
  ) => {
    const r = await fetch(`${BASE}/events/flagged-kills/bulk/`, {
      method: "PATCH",
      headers: authHeaders(token, true),
      body: JSON.stringify({ event_id: eventId, ...payload }),
    });
    if (!r.ok)
      throw new Error(
        (await r.json().catch(() => ({})))?.message || "Failed to apply bulk update.",
      );
    return r.json();
  },
};
