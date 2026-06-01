import axios from "axios";
import { env } from "@/lib/env";

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

export const rankingsApi = {
  teamsMonthly: (month?: string) => get<TeamRow>("teams/monthly/", month ? { month } : undefined),
  teamsQuarterly: (seasonId?: number) => get<TeamRow>("teams/quarterly/", seasonId ? { season_id: seasonId } : undefined),
  playersMonthly: (month?: string) => get<PlayerRow>("players/monthly/", month ? { month } : undefined),
  playersQuarterly: (seasonId?: number) => get<PlayerRow>("players/quarterly/", seasonId ? { season_id: seasonId } : undefined),
  currentSeason: async (): Promise<Season | null> => {
    const res = await axios.get(`${BASE}/rankings/seasons/current/`);
    return res.data;
  },
  seasons: () => get<Season>("seasons/"),
};
