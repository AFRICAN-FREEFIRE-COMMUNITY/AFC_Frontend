// lib/watchlist.ts
// ─────────────────────────────────────────────────────────────────────────────
// WATCHLIST API client (owner 2026-06-21)
//
// Typed client for the shared, AFC-wide advisory watchlist of suspicious players +
// teams. Used by the admin (/a/watchlist) + organizer (/organizer/watchlist) pages,
// the <WatchTag> badge (via watchlistApi.tags), and the "Add to watchlist" buttons on
// the leaderboard upload review (FileUploadStep). Bearer auth from the auth_token cookie
// (same pattern as lib/eventLinks.ts + ReportsAdminContent). Backend:
// afc_auth/views_watchlist.py (prefix auth/). Gate (admin OR organizer) is server-side.
// ─────────────────────────────────────────────────────────────────────────────
import axios from "axios";
import Cookies from "js-cookie";
import { env } from "@/lib/env";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;
const auth = () => ({ Authorization: `Bearer ${Cookies.get("auth_token") ?? ""}` });

export type WatchSubjectType = "player" | "team";
export type WatchSource = "manual" | "upload";

// One watchlist entry as returned by views_watchlist._serialize.
export interface WatchlistEntry {
  watch_id: number;
  subject_type: WatchSubjectType;
  player_id: number | null;
  team_id: number | null;
  subject_name: string;
  player_username: string | null;
  player_uid: string | null; // Free Fire UID (ringer/alt-account context)
  team_name: string | null;
  reason: string;
  source: WatchSource;
  context: string;
  status: "active" | "cleared";
  added_by_username: string | null;
  // Numeric id of the user who added this entry — used client-side to gate the Remove button
  // for organizers (they may only remove entries they themselves added; admins can remove any).
  // Echoed by GET /auth/watchlist/ as of 2026-06-27 backend update.
  added_by_id: number | null;
  cleared_by_username: string | null;
  cleared_at: string | null;
  created_at: string | null;
}

export interface WatchlistListResponse {
  results: WatchlistEntry[];
  total_count: number;
  has_more: boolean;
}

// Payload for adding a player OR team to the watchlist. Identify the subject by id (upload
// one-click / programmatic) OR by name (the manual add dialog sends a typed username/team name).
export interface AddWatchInput {
  subject_type: WatchSubjectType;
  player_id?: number;
  player_username?: string;
  team_id?: number;
  team_name?: string;
  reason: string;
  source?: WatchSource; // "upload" when added from the leaderboard upload review
  context?: string;     // free-text provenance, e.g. "event 130, uid 1270915668"
}

export const watchlistApi = {
  /** List entries. status defaults server-side to "active"; pass "all"/"cleared" to widen. */
  async list(params: {
    subject_type?: WatchSubjectType;
    status?: "active" | "cleared" | "all";
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<WatchlistListResponse> {
    const res = await axios.get<WatchlistListResponse>(`${BASE}/auth/watchlist/`, {
      headers: auth(),
      params,
    });
    return res.data;
  },

  /** Add (or reactivate) a player/team. Returns the entry. */
  async add(input: AddWatchInput): Promise<WatchlistEntry> {
    const res = await axios.post<{ entry: WatchlistEntry }>(`${BASE}/auth/watchlist/`, input, {
      headers: auth(),
    });
    return res.data.entry;
  },

  /** Clear (stop watching) or reactivate an entry. */
  async update(watchId: number, action: "clear" | "reactivate"): Promise<WatchlistEntry> {
    const res = await axios.patch<{ entry: WatchlistEntry }>(
      `${BASE}/auth/watchlist/${watchId}/`,
      { action },
      { headers: auth() },
    );
    return res.data.entry;
  },

  /** Bulk "which of these ids are actively watched" — one call per list page for <WatchTag>. */
  async tags(input: { playerIds?: number[]; teamIds?: number[] }): Promise<{
    watched_player_ids: number[];
    watched_team_ids: number[];
  }> {
    const params: Record<string, string> = {};
    if (input.playerIds?.length) params.player_ids = input.playerIds.join(",");
    if (input.teamIds?.length) params.team_ids = input.teamIds.join(",");
    const res = await axios.get(`${BASE}/auth/watchlist/tags/`, { headers: auth(), params });
    return {
      watched_player_ids: res.data?.watched_player_ids ?? [],
      watched_team_ids: res.data?.watched_team_ids ?? [],
    };
  },
};
