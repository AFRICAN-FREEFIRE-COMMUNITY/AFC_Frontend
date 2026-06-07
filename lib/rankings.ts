import axios from "axios";
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

export interface TeamRow {
  rank: number | null;
  team_id: number | null;
  team_name: string;
  is_ghost: boolean;
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
