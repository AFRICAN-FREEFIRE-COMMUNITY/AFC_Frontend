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
 * Auth: Bearer token of an AFC event admin OR an org member with can_upload_results.
 */
import { env } from "@/lib/env";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

// Name-based matching reasons (name-matching feature): a file player whose NAME matches a roster
// member but whose UID differs (uid_changed), or whose name matches a member registered on another
// team. Both are created pending (count_kills=false) and approved via the same setFlag PATCH.
export type FlagReason =
  | "not_on_roster"
  | "belongs_to_other_team"
  | "name_matched_uid_changed"
  | "name_matched_other_team";

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
};

export type EventTeamOption = { tournament_team_id: number; team_name: string };

export type FlaggedKillsResponse = {
  event_id: number;
  count_flagged_kills: boolean;
  flags: FlaggedKill[];
  flag_count: number;
  unmatched_teams: UnmatchedTeamRow[];
  event_teams: EventTeamOption[];
};

const authHeaders = (token: string, json = false): HeadersInit => ({
  ...(json ? { "Content-Type": "application/json" } : {}),
  Authorization: `Bearer ${token}`,
});

export const flaggedKillsApi = {
  // List an event's flagged players + the event-wide count_flagged_kills default.
  get: async (eventId: number | string, token: string): Promise<FlaggedKillsResponse> => {
    const r = await fetch(`${BASE}/events/flagged-kills/?event_id=${eventId}`, {
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
};
