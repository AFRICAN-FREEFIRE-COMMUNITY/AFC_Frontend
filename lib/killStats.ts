// ─────────────────────────────────────────────────────────────────────────────
// Kill stats reads for the event page's Kill stats tab (inbox #392; approved mockup
// mockups/kill-feed-tab/, owner notes #383 third party, #384 who killed who, #385 knocks count).
//
// Talks to AFC-B GET events/kill-stats/ (afc_tournament_and_scrims/views_kill_feed.py):
//   killStatsApi.get(slug, stage?)          the tab: sniper kills recorded, team head to head (with
//                                           how often a third team came in), who killed and knocked
//                                           who for every two players who met in a fight.
//   killStatsApi.pair(slug, a, b, stage?)   one team pair's fights, every kill and knock in order,
//                                           and the two teams' players against each other. Asked only
//                                           when a pair is opened, so the first read stays small.
//   killStatsApi.csvUrl(slug, stage?)       the GFX team's CSV, when the event switched it on.
// The reads are public once the event switched the tab on, so they send a session only if there is
// one (optionalAuthHeaders: an organizer previewing a switched-off event is let through by the server).
// Consumed by components/events/KillStatsTab.tsx.
// ─────────────────────────────────────────────────────────────────────────────
import axios from "axios";
import { env } from "@/lib/env";
import { optionalAuthHeaders } from "@/lib/http";

const URL = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/kill-stats/`;

/** [uid_a, uid_b, kills a on b, kills b on a, knocks a on b, knocks b on a]; uid_a < uid_b. */
export type Duel = [string, string, number, number, number, number];

export type KillStats = {
  event: string;
  stage: number | null;
  stages: { id: number; name: string }[];
  switches: { tab: boolean; overlay: boolean; export: boolean };
  coverage: { maps: number; kills: number; kills_with_weapon: number };
  sniper: { uid: string; username: string; team_name: string; sniper_kills: number }[];
  head_to_head: {
    team_a: { id: number; name: string };
    team_b: { id: number; name: string };
    met: number;
    wins_a: number;
    wins_b: number;
    draws: number;
    /** In how many of their fights a third team came in. */
    third_party: number;
  }[];
  teams: Record<string, string>;
  players: Record<string, { name: string; team_id: number }>;
  player_pairs: Duel[];
};

/** [game seconds, "kill" | "knock", killer uid, victim uid, killer team, victim team]. */
export type FightEvent = [number, "kill" | "knock", string, string, number, number];

export type PairFights = {
  pair: [number, number];
  fights: {
    match_id: number;
    match_number: number | null;
    stage: string;
    group: string;
    start: number;
    end: number;
    started_by: [number, number];
    /** Teams that came in after the first two, in the order they came. */
    third_parties: number[];
    /** Players each team had left when the fight ended (team id as a string key). */
    left: Record<string, number>;
    /** The pair's winner in this fight: more players left; null is a draw. */
    winner: number | null;
    events: FightEvent[];
  }[];
  duels: Duel[];
};

const params = (slug: string, stage?: number | null) => ({ event: slug, ...(stage ? { stage } : {}) });

export const killStatsApi = {
  get: async (slug: string, stage?: number | null) =>
    (await axios.get<KillStats>(URL, { params: params(slug, stage), headers: optionalAuthHeaders() })).data,

  pair: async (slug: string, a: number, b: number, stage?: number | null) =>
    (
      await axios.get<PairFights>(URL, {
        params: { ...params(slug, stage), pair: `${a}-${b}` },
        headers: optionalAuthHeaders(),
      })
    ).data,

  csvUrl: (slug: string, stage?: number | null) =>
    `${URL}?${new URLSearchParams({ event: slug, ...(stage ? { stage: String(stage) } : {}), export: "csv" })}`,
};
