import axios from "axios";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

/**
 * lib/fantasy.ts - typed client for the AFC Fantasy League API (prefix /fantasy/).
 *
 * Mirrors lib/rankingsAdmin.ts: axios, the shared BASE url, authHeaders() reading the same
 * `auth_token` cookie AuthContext sets, and the {results, pagination} envelope the rest of the
 * platform returns.
 *
 * AUTH IS OPTIONAL ON THE PUBLIC READS and required on the squad endpoints. The headers go out
 * either way: signed out they are simply absent, and the backend answers the parts of a league
 * that are public (its rules, its pool, its table) while leaving `can_enter` false. That is why a
 * signed-out fan can read a whole league page and understand the game before being asked to sign
 * in, which is the point.
 *
 * Backend: afc_fantasy/views.py (fan) and afc_fantasy/admin_views.py (admin).
 * Spec: WEBSITE/tasks/fantasy-league-spec.md.
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;
const url = (path: string) => `${BASE}/fantasy/${path}`;

async function fGet<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  return (await axios.get(url(path), { params, headers: authHeaders() })).data;
}
async function fPost<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.post(url(path), body ?? {}, { headers: authHeaders() })).data;
}
async function fPatch<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.patch(url(path), body ?? {}, { headers: authHeaders() })).data;
}
async function fPut<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.put(url(path), body ?? {}, { headers: authHeaders() })).data;
}

/** One league, plus what THIS viewer may do with it. `can_enter` is decided by the server rather
 *  than inferred here, so there is one authority on whether the button is live. */
export type FantasyLeague = {
  slug: string;
  name: string;
  description: string;
  status: "draft" | "open" | "locked" | "settled";
  scope: "event" | "stage" | "season";
  event: { event_id: number; event_name: string };
  squad_size: number;
  max_per_team: number;
  captain_multiplier: number;
  use_budget: boolean;
  budget_seeds: number | null;
  team_premium_seeds: number;
  entry_type: "free" | "sponsored" | "paid";
  entry_fee: string | null;
  entry_fee_currency: string | null;
  locks_at: string | null;
  locked_at: string | null;
  is_locked: boolean;
  entries: number;
  can_enter: boolean;
  has_entered: boolean;
};

/** A player in the pool. `reason` is the line that produced the price, and the builder prints it:
 *  a price a fan can check is a price they do not argue with twice. */
export type FantasyPlayer = {
  player_id: number;
  username: string;
  team: { team_id: number; team_name: string } | null;
  price_seeds: number;
  is_unproven: boolean;
  reason: string;
};

/** One rule the squad must satisfy, with the fan's own position against it. The builder renders
 *  the whole list, passing rules included, because that is what teaches the game. */
export type SquadRule = {
  key: string;
  ok: boolean;
  label: string;
  detail: string;
};

export type SquadPick = { player_id: number; is_captain: boolean; price_seeds?: number };

export const fantasyApi = {
  // ── public ────────────────────────────────────────────────────────────────
  leagues: (params?: Record<string, any>) => fGet("", params),
  league: (slug: string) => fGet<FantasyLeague>(`${slug}/`),
  players: (slug: string, params?: Record<string, any>) => fGet(`${slug}/players/`, params),
  standings: (slug: string) => fGet(`${slug}/standings/`),

  // ── your squad (login required) ───────────────────────────────────────────
  mySquad: (slug: string) => fGet(`${slug}/my-squad/`),
  /** Save it for real. 400 carries `rules` so the builder can show exactly what failed. */
  saveSquad: (slug: string, body: { squad_name?: string; picks: SquadPick[] }) =>
    fPut(`${slug}/my-squad/`, body),
  /** Validate WITHOUT writing. The builder calls this on every change so its checklist is always
   *  the server's opinion, never a second implementation of the rules in TypeScript that can
   *  drift from the one that actually gates the save. */
  checkSquad: (slug: string, picks: SquadPick[]) =>
    fPut<{ ok: boolean; spent: number; rules: SquadRule[] }>(`${slug}/my-squad/`, {
      picks,
      dry_run: true,
    }),

  // ── admin ─────────────────────────────────────────────────────────────────
  adminLeagues: (params?: Record<string, any>) => fGet("admin/leagues/", params),
  adminCreate: (body: any) => fPost("admin/leagues/", body),
  adminLeague: (slug: string) => fGet(`admin/leagues/${slug}/`),
  adminUpdate: (slug: string, body: any) => fPatch(`admin/leagues/${slug}/`, body),
  /** dry_run previews the price list without writing. Pricing is pure, so a preview costs nothing
   *  and is the one part of this feature an admin will want to look at before committing. */
  adminPrices: (slug: string, dryRun = false) =>
    fPost(`admin/leagues/${slug}/prices/`, { dry_run: dryRun }),
  adminOpen: (slug: string) => fPost(`admin/leagues/${slug}/open/`),
  adminRecompute: (slug: string) => fPost(`admin/leagues/${slug}/recompute/`),
};
