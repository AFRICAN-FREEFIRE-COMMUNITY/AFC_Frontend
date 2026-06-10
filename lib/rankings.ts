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

export interface PlayerRow {
  rank: number | null;
  player_id: number;
  username: string;
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
}

export interface Season {
  season_id: number;
  name: string;
  quarter: number;
  year: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface Envelope<T> {
  results: T[];
  pagination: Pagination;
  month?: string;
  season?: Season | null;
}

async function get<T>(path: string, params?: Record<string, any>): Promise<Envelope<T>> {
  const res = await axios.get(`${BASE}/rankings/${path}`, { params });
  return res.data;
}

// PUBLIC rankings client (no auth), consumed by app/(user)/rankings/page.tsx; the
// Bearer-gated admin twin is lib/rankingsAdmin.ts.
export const rankingsApi = {
  teamsMonthly: (month?: string) => get<TeamRow>("teams/monthly/", month ? { month } : undefined),
  teamsQuarterly: (seasonId?: number) => get<TeamRow>("teams/quarterly/", seasonId ? { season_id: seasonId } : undefined),
  playersMonthly: (month?: string) => get<PlayerRow>("players/monthly/", month ? { month } : undefined),
  playersQuarterly: (seasonId?: number) => get<PlayerRow>("players/quarterly/", seasonId ? { season_id: seasonId } : undefined),
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
