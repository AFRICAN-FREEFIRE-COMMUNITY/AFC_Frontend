import axios from "axios";
import Cookies from "js-cookie";
import { env } from "@/lib/env";

/**
 * Typed client for the PUBLIC (read-only, unauthenticated) rankings API (prefix /rankings/).
 *
 * Returns the canonical {results, pagination, month?/season?} envelope straight from the
 * backend - no Bearer token, since these endpoints are open to everyone. This is the
 * public counterpart to lib/rankingsAdmin.ts, which hits the same /rankings/ prefix but
 * carries the auth_token Bearer header for the head_admin / metrics_admin write surface.
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

// Canonical envelope from the rankings API: { results: [...], pagination: {...}, month?/season? }
export interface Pagination {
  limit: number;
  offset: number;
  total_count: number;
  has_more: boolean;
  next_offset: number | null;
}

// claim_status mirrors the backend GhostTeam/GhostPlayer.claim_status enum. Only "unclaimed"
// rows can be requested; the others hide the public "Claim" button.
export type GhostClaimStatus = "unclaimed" | "pending" | "claimed" | "revoked";

export interface TeamRow {
  rank: number | null;
  team_id: number | null;
  team_name: string;
  // Team country (Team.country) for the flag beside the name; null for ghost rows. From the
  // team_monthly/team_quarterly serializer. (owner 2026-06-20)
  country?: string | null;
  is_ghost: boolean;
  // Ghost-claim hints (NULL on real rows). ghost_team_id is the UUID the public claim-request
  // endpoint is keyed on; claim_status gates the "Claim" button on /rankings. Both are emitted by
  // afc_rankings.serializers team_monthly/team_quarterly (_ghost_team_claim).
  ghost_team_id?: string | null;
  claim_status?: GhostClaimStatus | null;
  total_score: number;
  tournament_pts: number;
  scrim_pts: number;
  prize_money_pts?: number;
  social_media_pts?: number;
  wins?: number;
  kills?: number;
  tournaments_played?: number;
  tier?: 0 | 1 | 2 | 3 | null;
  tier_label?: string | null;
}

/**
 * One in-game role on the public role tab bar.
 *
 * Served by GET /rankings/players/by-role/ (backend afc_rankings/player_roles.py) and sourced
 * from afc_team.TeamMembers.IN_GAME_ROLE_CHOICES, so a role added to the model appears here
 * without a frontend change. `label` is the model's English name and is only a fallback: the
 * UI translates the known roles and falls back to this for anything new.
 */
export interface PlayerRoleOption {
  role: string;
  label: string;
  player_count: number;
}

export interface PlayerRow {
  rank: number | null;
  player_id: number;
  username: string;
  /**
   * Present on the by-role ladder only. When a role is selected, `rank` is the rank WITHIN
   * that role (1, 2, 3...) and this carries the position on the full ladder, so a row can say
   * "1st sniper, 24th overall". With no role selected the two are equal.
   */
  overall_rank?: number | null;
  // True when this row is a ghost player interleaved into the ladder by score.
  // The username already carries the "[Ghost] <ign>" prefix from the backend; a
  // ghost has no public profile, so the UI renders it as plain text + a Ghost
  // badge instead of a PlayerLink (see app/(user)/rankings/page.tsx RankingsView).
  is_ghost?: boolean;
  // Ghost-claim hints (NULL on real rows). ghost_player_id is the int the public claim-request
  // endpoint is keyed on; claim_status gates the "This is me" button. Emitted by
  // afc_rankings.serializers player_monthly/player_quarterly (_ghost_player_claim).
  ghost_player_id?: number | null;
  claim_status?: GhostClaimStatus | null;
  total_score: number;
  kill_pts?: number;
  placement_pts?: number;
  mvp_pts?: number;
  finals_pts?: number;
  team_win_pts?: number;
  participation_pts?: number;
  scrim_pts?: number;
  prize_money_pts?: number;
  kills?: number;
  mvps?: number;
  tier?: 0 | 1 | 2 | 3 | null;
  /**
   * STORED in-game role for this period, and the play behind it (owner 2026-08-04: "role history
   * is not stored ... fix the above so it records properly using data and is stored").
   *
   * `role` is the role the player actually held WHEN the points were earned, not the one they hold
   * today: the backend stamps it on each match result from the frozen event roster and files the
   * period under the role played most (afc_rankings/aggregation.primary_role). null is a real
   * answer meaning no role was recorded for the period, which is the truth for staff, ghosts, a
   * period spent on solo leaderboards, and anything played before the stamping existed. Render it
   * as "not recorded", never as a blank that reads like "has no role".
   *
   * `role_matches` / `role_kills` are scoped TO THAT ROLE, so a mixed-role player's numbers describe
   * their sniper games rather than their whole month. Kills are the only per-player statistic the
   * match pipeline actually records, so these two are the honest limit of what a role column can
   * show; there is no role-specific score and none is invented.
   *
   * `role_is_mixed` = played two or more roles in the period. The row is still listed under exactly
   * one role so the tables stay a partition of the ladder; this flag is how the UI discloses that.
   *
   * Emitted by afc_rankings.serializers._role_columns on EVERY player row, ladder or role table.
   */
  role?: string | null;
  role_matches?: number;
  role_kills?: number;
  role_is_mixed?: boolean;
}

/**
 * How much of a period actually HAS a stored role, from GET /rankings/players/by-role/.
 *
 * Exists so the UI can be honest about a period that predates the role stamping: without it, a
 * month recorded before the feature shipped renders four empty role tabs that read as "nobody
 * played these roles" instead of "this was not recorded back then". `has_role_data` false means
 * show the notice. Zeroed for a period the publish gate is hiding, so it cannot leak through.
 */
export interface PlayerRoleCoverage {
  players_with_role: number;
  players_scored: number;
  has_role_data: boolean;
}

export interface Season {
  season_id: number;
  name: string;
  quarter: number;
  year: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  // ── the transfer window ──
  // These three have always been on the wire (see rankings/seasons/current/) and were simply
  // never declared here, so anything reading a Season could not see them and fell back to
  // guessing. That is exactly why the admin rankings page printed the SEASON's end date under
  // "Transfer Window" and hardcoded the state as locked. Dates are calendar dates ("2026-07-14"),
  // so render them with formatLocalDateOnly, never with the date-and-time formatter, which reads
  // a bare date as midnight UTC and shows the previous day to anyone west of London.
  transfer_window_open?: string | null;
  transfer_window_close?: string | null;
  transfer_window_is_open?: boolean;
}

export interface Envelope<T> {
  results: T[];
  pagination: Pagination;
  month?: string;
  // The season/month the returned rows actually belong to. NOT necessarily the live one: see
  // is_current_period below.
  season?: Season | null;
  /**
   * Owner 2026-08-03 ("it should show the past one pending when a new one is published").
   *
   * When the live season's rankings are not published yet, the backend keeps serving the last
   * PUBLISHED period instead of an empty ladder (afc_rankings.views._resolve_month /
   * _resolve_quarterly_season) and sets is_current_period=false. Any UI rendering these rows MUST
   * label them when this is false, otherwise a viewer reads last quarter's standings as today's.
   * current_season names the season that is still pending, for that label.
   */
  is_current_period?: boolean;
  current_season?: Season | null;
}

async function get<T>(path: string, params?: Record<string, any>): Promise<Envelope<T>> {
  const res = await axios.get(`${BASE}/rankings/${path}`, { params });
  return res.data;
}

/* ──────────────────────────────────────────────────────────────────────────
 * WHOLE-PERIOD reads for the public ladders.
 *
 * The rankings API pages at 25 by default and CAPS `limit` at 100, so one call returns a
 * fragment of any real period. app/(user)/rankings/page.tsx then filters, searches, groups into
 * tier bands and re-ranks by country entirely CLIENT-side, which means a fragment is not just an
 * incomplete list, it makes those features wrong:
 *   - June 2026 holds 187 player rows; the page fetched 25, so searching for anyone ranked below
 *     25th answered "No matches for ...", which reads as "this player is not ranked".
 *   - SEASON 2 holds 84 quarterly team rows; the Tiers tab fetched 25 and printed "25 teams" as
 *     the size of the tier band, a number that was really just the page size.
 * So these endpoints are read to exhaustion instead.
 *
 * MAX_PAGES caps the walk so a runaway period can never spin forever. When the cap is hit the
 * envelope comes back with truncated=true and the caller must say so on screen rather than
 * silently presenting a partial ladder as the whole one.
 * ────────────────────────────────────────────────────────────────────────── */

// The backend's own ceiling (afc_rankings pagination). Asking for more is silently clamped to it.
const PAGE_LIMIT = 100;
// 20 pages x 100 = 20,000 rows, far above any real period, but bounded.
const MAX_PAGES = 20;

export type FullEnvelope<T> = Envelope<T> & { truncated: boolean };

// Query params are only ever month / season_id / role / period plus the limit + offset added
// below, so this is typed concretely rather than reusing get()'s looser Record<string, any>.
type LadderParams = Record<string, string | number | undefined>;

async function getAll<T>(path: string, params?: LadderParams): Promise<FullEnvelope<T>> {
  let offset = 0;
  let rows: T[] = [];
  let envelope: Envelope<T> | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const env = await get<T>(path, { ...params, limit: PAGE_LIMIT, offset });
    envelope = env;
    rows = rows.concat(env.results ?? []);
    if (!env.pagination?.has_more) {
      // Keep the LAST envelope's month/season/publish metadata: it is identical on every page,
      // and it is what the page reads to label the period and honour the publish gate.
      return { ...env, results: rows, truncated: false };
    }
    offset = env.pagination.next_offset ?? offset + PAGE_LIMIT;
  }
  return { ...(envelope as Envelope<T>), results: rows, truncated: true };
}

// PUBLIC rankings client (no auth), consumed by app/(user)/rankings/page.tsx; the
// Bearer-gated admin twin is lib/rankingsAdmin.ts.
export const rankingsApi = {
  // The four ladders below read the WHOLE period (see getAll): the /rankings page searches,
  // filters and re-ranks them client-side, so a single page of 25 would make those features lie.
  teamsMonthly: (month?: string) => getAll<TeamRow>("teams/monthly/", month ? { month } : undefined),
  teamsQuarterly: (seasonId?: number) => getAll<TeamRow>("teams/quarterly/", seasonId ? { season_id: seasonId } : undefined),
  playersMonthly: (month?: string) => getAll<PlayerRow>("players/monthly/", month ? { month } : undefined),
  playersQuarterly: (seasonId?: number) => getAll<PlayerRow>("players/quarterly/", seasonId ? { season_id: seasonId } : undefined),
  /**
   * The player ladder for ONE in-game role, plus the role tab bar, in a single call.
   *
   * Backend: afc_rankings/player_roles.py (GET /rankings/players/by-role/). A role table is a
   * FILTER over the ladder above, not a second scoring system: the scores are identical, only
   * the population differs, and the ranks are renumbered within the role. Pass no `role` (or
   * "all") for the unfiltered ladder. Publish gating is the same as the plain ladders.
   *
   * The role a row is filed under is the one it was STORED with for that period (see PlayerRow
   * .role), so an old month keeps the roles it was played under even after a player transfers or
   * switches role. `role_coverage` says whether the period has any stored role data at all; when
   * it does not, the page must say so rather than present empty role tabs as fact.
   *
   * Consumed by app/(user)/rankings/page.tsx (the player role tabs).
   */
  playersByRole: (params?: { role?: string; period?: "monthly" | "quarterly"; month?: string; seasonId?: number }) =>
    // Read to exhaustion like the ladders above: this IS the player ladder the page renders, and
    // the role tab bar / role_coverage ride along on the same envelope (preserved by getAll,
    // which keeps the last page's non-results fields).
    getAll<PlayerRow>("players/by-role/", {
      ...(params?.role ? { role: params.role } : {}),
      ...(params?.period ? { period: params.period } : {}),
      ...(params?.month ? { month: params.month } : {}),
      ...(params?.seasonId ? { season_id: params.seasonId } : {}),
    }) as Promise<FullEnvelope<PlayerRow> & {
      role: string | null;
      roles: PlayerRoleOption[];
      role_coverage?: PlayerRoleCoverage;
      published?: boolean;
    }>,
  // Feeds the transfer-window banner on /rankings, /teams and /player-markets; response
  // carries Phase-2c flags (transfer_window_is_open, transfer_window_close,
  // rankings_published, tiers_published).
  currentSeason: async (): Promise<Season | null> => {
    const res = await axios.get(`${BASE}/rankings/seasons/current/`);
    return res.data;
  },
  seasons: () => get<Season>("seasons/"),
};

/* ──────────────────────────────────────────────────────────────────────────
 * USER-FACING ghost CLAIM REQUESTS (Bearer-authed, logged-in user action)
 *
 * The public ladders (above) are unauthenticated reads. The claim REQUEST is a
 * separate, logged-in user action: a real team owner/captain/manager asks to claim a
 * ghost TEAM for their team, or a user claims a ghost PLAYER as themselves. These hit the
 * user-gated request endpoints in afc_rankings.admin_ghost (NOT the admin _auth gate):
 *
 *   POST /rankings/ghost-teams/<uuid>/request-claim/    body { team_id, evidence? }
 *   POST /rankings/ghost-players/<int>/request-claim/   body { evidence? }
 *
 * Consumed by: app/(user)/rankings/_components/ClaimGhostDialog.tsx (opened from the
 * "Claim" button on a ghost row in app/(user)/rankings/page.tsx). The token comes from the
 * same auth_token cookie AuthContext writes (js-cookie), mirroring lib/rankingsAdmin.ts.
 * ────────────────────────────────────────────────────────────────────────── */

// One of the logged-in user's manageable teams (the dropdown source for a team claim). Shape
// matches afc_team.get-user-current-team's `team` dict (a user belongs to at most one team).
export interface MyTeam {
  team_id: number;
  team_name: string;
  user_role_in_team?: string | null; // owner / captain / manager (management role)
}

function userAuthHeaders() {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token ?? ""}` };
}

export const rankingsClaimApi = {
  // The user's current team, populates the team-claim dropdown. Hits afc_team
  // get-user-current-team (POST, Bearer). Returns null when the user has no team (the
  // endpoint 404s with "not currently a member of any team"), which the dialog treats as
  // "you need a team to claim". `team_owner` / `user_role_in_team` come back on the dict;
  // the backend re-checks owner/captain/manager on request and 403s otherwise.
  myTeam: async (): Promise<MyTeam | null> => {
    try {
      const res = await axios.post(
        `${BASE}/team/get-user-current-team/`,
        {},
        { headers: userAuthHeaders() },
      );
      const t = res.data?.team;
      if (!t) return null;
      return { team_id: t.team_id, team_name: t.team_name, user_role_in_team: t.user_role_in_team };
    } catch {
      // 404 = no team. The dialog surfaces "you need a team" rather than an error toast.
      return null;
    }
  },

  // Request to claim a ghost TEAM for `teamId`. The backend 403s if the user does not run that
  // team (owner/captain/manager) and 400s if the ghost is not unclaimed or a conflict exists.
  requestTeamClaim: async (ghostTeamId: string, teamId: number, evidence?: string) => {
    const res = await axios.post(
      `${BASE}/rankings/ghost-teams/${ghostTeamId}/request-claim/`,
      { team_id: teamId, evidence: evidence ?? "" },
      { headers: userAuthHeaders() },
    );
    return res.data;
  },

  // Request to claim a ghost PLAYER as the logged-in user themselves (no team_id, a self-claim).
  requestPlayerClaim: async (ghostPlayerId: number, evidence?: string) => {
    const res = await axios.post(
      `${BASE}/rankings/ghost-players/${ghostPlayerId}/request-claim/`,
      { evidence: evidence ?? "" },
      { headers: userAuthHeaders() },
    );
    return res.data;
  },
};
