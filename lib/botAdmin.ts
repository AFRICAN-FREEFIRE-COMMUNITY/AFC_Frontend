import axios from "axios";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

/**
 * lib/botAdmin.ts - typed client for the AFC Discord bot's admin surface (prefix /bot/).
 *
 * Mirrors lib/fantasy.ts: axios, the shared BASE url, authHeaders() reading the same `auth_token`
 * cookie AuthContext sets.
 *
 * EVERY CALL IS HEAD-ADMIN ONLY and every call is a PROXY. The Django backend (afc_bot/views.py)
 * forwards to the bot's own control API, which runs in a separate process and repo (AFC/AFCBot).
 * The bot's control token never reaches this code or the browser, which is the whole reason the
 * proxy exists.
 *
 * 503 IS A NORMAL ANSWER HERE, not an exception to hide. This is the page an admin opens BECAUSE
 * the bot looks wrong, so "could not reach the bot" is information, and the page renders it as
 * state rather than a toast that disappears.
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;
const url = (path: string) => `${BASE}/bot/${path}`;

/** One background loop's heartbeat. `last_run_at` is a unix timestamp in seconds. */
export type BotLoop = {
  runs: number;
  errors: number;
  last_run_at?: number;
  last_error?: string;
  last_error_at?: number;
};

/** What the bot reports about itself. The Status tab is a rendering of exactly this. */
export type BotStatus = {
  online: boolean;
  user: string | null;
  started_at: number;
  uptime_secs: number;
  guilds: { id: string; name: string; members: number }[];
  /** Primary first, then each configured fallback. Printed because "answering" and "answering on
   *  the last-resort free tier" look identical from Discord and cost very different things. */
  providers: { name: string; model?: string; base_url?: string; configured: boolean }[];
  loops: Record<string, BotLoop>;
  knowledge_chars: number;
  pending_approvals: number;
  listening_channels: number;
  listening_categories: number;
};

/** One editable setting, with the value declared in bot.py alongside it so the page can show
 *  "default: X" and offer a reset. */
export type BotConfigField = {
  name: string;
  kind: "ids" | "id" | "int";
  bounds: [number, number] | null;
  value: number | number[] | null;
  default: number | number[] | null;
  overridden: boolean;
};

export type BotDocument = {
  name: string;
  scope: "public" | "staff";
  bytes: number;
  modified: number;
};

export type BotApproval = {
  message_id: string;
  event_id: number | string;
  event_name: string;
  competition_type: string;
  organization_name: string | null;
  start_date: string | null;
  slug: string | null;
};

export const botApi = {
  status: async (): Promise<BotStatus> =>
    (await axios.get(url("status/"), { headers: authHeaders() })).data,

  config: async (): Promise<{ fields: BotConfigField[] }> =>
    (await axios.get(url("config/"), { headers: authHeaders() })).data,

  /** Save settings. The bot validates the whole set and applies it live, or refuses all of it, so
   *  a bad entry cannot leave announcements routed half to the old channel and half to the new. */
  saveConfig: async (values: Record<string, number | number[]>) =>
    (await axios.post(url("config/"), { values }, { headers: authHeaders() })).data,

  /** Put one setting back to the value declared in bot.py. */
  resetConfig: async (name: string) =>
    (await axios.delete(url(`config/?name=${encodeURIComponent(name)}`), {
      headers: authHeaders(),
    })).data,

  knowledge: async (): Promise<{ documents: BotDocument[]; total_chars: number }> =>
    (await axios.get(url("knowledge/"), { headers: authHeaders() })).data,

  /** Multipart, so it gets its own shape rather than dragging the rest through FormData. */
  uploadDocument: async (file: File, scope: "public" | "staff") => {
    const body = new FormData();
    body.append("file", file);
    body.append("scope", scope);
    return (await axios.post(url("knowledge/"), body, { headers: authHeaders() })).data;
  },

  removeDocument: async (name: string, scope: "public" | "staff") =>
    (await axios.delete(
      url(`knowledge/?name=${encodeURIComponent(name)}&scope=${scope}`),
      { headers: authHeaders() },
    )).data,

  /** Re-read the website into the knowledge base now, instead of waiting for the 3-hour job. */
  rescrape: async (): Promise<{ message: string; chars?: number }> =>
    (await axios.post(url("rescrape/"), {}, { headers: authHeaders() })).data,

  approvals: async (): Promise<{ pending: BotApproval[] }> =>
    (await axios.get(url("approvals/"), { headers: authHeaders() })).data,

  /** Approve or reject a pending announcement. Approving calls the same announce_event() the
   *  Discord button calls, so the web and the buttons cannot drift. */
  decide: async (messageId: string, action: "approve" | "reject") =>
    (await axios.post(
      url("approvals/"),
      { message_id: messageId, action },
      { headers: authHeaders() },
    )).data,
};
