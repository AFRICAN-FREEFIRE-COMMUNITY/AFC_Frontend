/**
 * lib/api/helpBot.ts - the one client for the website Help panel (backend app: afc_helpbot, inbox #109).
 *
 * ADDRESSES (afc_helpbot/urls.py)
 *   GET  help-bot/status/    is the assistant on, how many questions are left today
 *   POST help-bot/chat/      ask a question, get the answer
 *   POST help-bot/handoff/   "Talk to a person": a support ticket with the chat attached
 *   GET  help-bot/conversations/          your earlier chats, newest first (the History view, #147)
 *   GET  help-bot/conversations/<token>/  one of them with its messages, to reopen it
 *   GET  help-bot/admin/log/              every input to the panel, for support staff (#156)
 *
 * All of them work signed in or signed out. Signed in, the Bearer token lets the answer use the person's
 * own account; signed out, `visitor` (a random id this browser keeps, see HelpBot.tsx) is what proves a
 * conversation is theirs. The Accept-Language header the AuthContext interceptor puts on every axios
 * request tells the backend which language to answer in.
 *
 * Refusals come back as { message, code }. The panel never shows `message`; it translates `code`
 * (owner rule R44), so every code the backend can send is listed in HelpBotErrorCode below.
 *
 * CONSUMED BY: components/help/HelpBot.tsx.
 */
import axios from "axios";

import { env } from "@/lib/env";

const API = env.NEXT_PUBLIC_BACKEND_API_URL;

const bearer = (token?: string | null) => (token ? { Authorization: `Bearer ${token}` } : {});

export interface HelpBotStatus {
  online: boolean;
  signed_in: boolean;
  limit: number;
  remaining: number;
  /** A signed-out visitor must pass the Turnstile check to start a chat or open a ticket. */
  bot_check: boolean;
  /** When nothing is left: which allowance ran out (the person's own, or the network's). */
  spent: "help_daily_limit" | "help_network_limit" | null;
}

export interface HelpBotAnswer {
  conversation: string;
  reply: string;
  needs_person: boolean;
  used_account: boolean;
  needs_sign_in: boolean;
  limit: number;
  remaining: number;
}

export interface HelpBotTicket {
  ticket_number: string;
  ticket_url: string;
  /** This chat already had a ticket; the newer messages were added to it. */
  existing: boolean;
}

/** Every refusal code afc_helpbot/views.py (and afc_auth/bot_protection.py) can send. */
export type HelpBotErrorCode =
  | "help_message_invalid"
  | "help_conversation_invalid"
  | "help_conversation_not_found"
  | "help_visitor_required"
  | "help_daily_limit"
  | "help_network_limit"
  | "help_slow_down"
  | "help_busy"
  | "help_ai_offline"
  | "help_ai_timeout"
  | "help_ai_failed"
  | "help_email_invalid"
  | "help_handoff_empty"
  | "help_handoff_limit"
  | "bot_check_failed"
  | "network";

/** The code of a failed call, or "network" when the request never got an answer. */
export function helpBotErrorCode(err: unknown): { code: HelpBotErrorCode | string; limit?: number } {
  if (axios.isAxiosError(err) && err.response) {
    const data = (err.response.data || {}) as { code?: string; limit?: number };
    return { code: data.code || "help_ai_failed", limit: data.limit };
  }
  return { code: "network" };
}

export async function getHelpBotStatus(token: string | null, visitor: string): Promise<HelpBotStatus> {
  const { data } = await axios.get(`${API}/help-bot/status/`, {
    headers: bearer(token),
    params: token ? {} : { visitor },
  });
  return data;
}

export async function askHelpBot(
  token: string | null,
  input: { message: string; conversation?: string; visitor: string; turnstile?: string; page?: string },
): Promise<HelpBotAnswer> {
  const { data } = await axios.post(
    `${API}/help-bot/chat/`,
    {
      message: input.message,
      conversation: input.conversation || undefined,
      visitor: input.visitor,
      // The field afc_auth/bot_protection.py reads (TOKEN_FIELDS).
      cf_turnstile_response: input.turnstile || undefined,
      // The page the question was asked on, for the staff Help log (inbox #156). A path only.
      page: input.page || undefined,
    },
    { headers: bearer(token) },
  );
  return data;
}

export interface HelpConversationSummary {
  conversation: string;
  started_at: string;
  last_message_at: string;
  /** The first question, up to 120 characters. */
  preview: string;
  questions: number;
}

export interface HelpConversationPage {
  results: HelpConversationSummary[];
  total_count: number;
  has_more: boolean;
  next_offset: number | null;
}

export interface HelpConversationDetail {
  conversation: string;
  started_at: string;
  ticket_number: string | null;
  messages: { role: "user" | "assistant"; text: string; used_account: boolean; at: string }[];
}

/** Your earlier chats, newest first (inbox #147): an account's own, or this browser's signed-out ones. */
export async function listHelpConversations(
  token: string | null,
  visitor: string,
  page: { limit?: number; offset?: number } = {},
): Promise<HelpConversationPage> {
  const { data } = await axios.get(`${API}/help-bot/conversations/`, {
    headers: bearer(token),
    params: { ...(token ? {} : { visitor }), limit: page.limit ?? 20, offset: page.offset ?? 0 },
  });
  return data;
}

/** One of your chats with its messages, to reopen it. 404 help_conversation_not_found when it is gone. */
export async function getHelpConversation(
  token: string | null,
  visitor: string,
  conversation: string,
): Promise<HelpConversationDetail> {
  const { data } = await axios.get(`${API}/help-bot/conversations/${encodeURIComponent(conversation)}/`, {
    headers: bearer(token),
    params: token ? {} : { visitor },
  });
  return data;
}

export interface HelpBotLogRow {
  id: number;
  at: string;
  kind: "question" | "handoff";
  /** The account's in-game name, or null for a signed-out visitor. */
  who: string | null;
  signed_in: boolean;
  /** Signed out: the first characters of the salted browser hash (never the browser id). */
  visitor: string | null;
  conversation: string | null;
  page: string | null;
  locale: string;
  text: string;
  answer: string;
  /** "answered", "ticket:<number>", or the refusal code. */
  outcome: string;
  http_status: number;
}

export interface HelpBotLogPage {
  results: HelpBotLogRow[];
  total_count: number;
  has_more: boolean;
  next_offset: number | null;
}

/** Every input to the Help panel, newest first: support staff only (app/(a)/a/support/help-log). */
export async function getHelpBotLog(
  token: string,
  params: { q?: string; who?: string; outcome?: string; kind?: string; limit?: number; offset?: number },
): Promise<HelpBotLogPage> {
  const { data } = await axios.get(`${API}/help-bot/admin/log/`, { headers: bearer(token), params });
  return data;
}

export async function handOffToPerson(
  token: string | null,
  input: { conversation?: string; visitor: string; email?: string; message?: string; turnstile?: string },
): Promise<HelpBotTicket> {
  const { data } = await axios.post(
    `${API}/help-bot/handoff/`,
    {
      conversation: input.conversation || undefined,
      visitor: input.visitor,
      email: input.email || undefined,
      message: input.message || undefined,
      cf_turnstile_response: input.turnstile || undefined,
    },
    { headers: bearer(token) },
  );
  return data;
}
