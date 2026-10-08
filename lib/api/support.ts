/**
 * lib/api/support.ts - the one client for the support desk (backend app: afc_support).
 *
 * WHY IT IS ALL HERE
 *   Four surfaces talk to the desk: the public contact form, the requester's own thread page, the
 *   staff dashboard and the head-admin audit. They share the ticket and message SHAPES, so the
 *   types live once (R24) and every fetch goes through one place rather than each page inventing
 *   its own axios call and its own error handling.
 *
 * ADDRESSES (afc_support/urls.py)
 *   POST support/contact/                     public, multipart, files allowed
 *   GET  support/t/<token>/                   public, the requester's thread
 *   POST support/t/<token>/reply/             public, multipart
 *   GET  support/mine/                        signed in: the player's own tickets (the /support page)
 *   GET  support/access/                      what may the caller do here
 *   GET  support/tickets/                     staff queue
 *   GET  support/tickets/<number>/            staff, one thread
 *   POST support/tickets/<number>/reply/      staff, multipart
 *   POST support/tickets/<number>/status/     staff
 *   GET  support/audit/                       head admins only
 *   GET  support/people/                      staff: the desk by PERSON (inbox #174)
 *   GET  support/people/<key>/                staff: one person, every ticket (by-ticket/?ticket=N too)
 *   POST support/people/<key>/reply/          staff: one reply on several of their requests
 *   POST support/people/bulk-reply/           staff: the same reply to several people
 *   GET  support/attachments/<id>/            staff session, or ?t=<ticket token>
 */
import axios from "axios";

import { env } from "@/lib/env";

const API = env.NEXT_PUBLIC_BACKEND_API_URL;

export type SupportDirection = "in" | "out";

export interface SupportAttachment {
  id: number;
  name: string;
  content_type: string;
  size_bytes: number;
  /** Relative to the API host, and always through the guarded view: these files are private. */
  url: string;
}

export interface SupportMessage {
  id: number;
  direction: SupportDirection;
  channel: "web" | "email" | "auto";
  body: string;
  author_name: string;
  created_at: string;
  attachments: SupportAttachment[];
  /** Staff surfaces only: who on the team wrote it. The requester never receives this. */
  author_username?: string;
}

export interface SupportTicket {
  ticket_number: string;
  name: string;
  email: string;
  subject: string;
  status: "open" | "waiting" | "resolved" | "closed";
  source: string;
  created_at: string;
  last_message_at: string;
  messages?: SupportMessage[];
  /** Staff surfaces only. */
  user_id?: number | null;
  username?: string;
  has_discord?: boolean;
  assigned_to?: string;
  ticket_url?: string;
}

export interface SupportQueue {
  results: SupportTicket[];
  has_more: boolean;
  next_offset: number;
  total_count: number;
  open_count: number;
}

export interface SupportAuditRow {
  id: number;
  ticket_number: string;
  ticket_status: string;
  from_name: string;
  from_email: string;
  direction: SupportDirection;
  channel: string;
  author_username: string;
  body: string;
  attachments: SupportAttachment[];
  created_at: string;
}

export interface SupportAudit {
  results: SupportAuditRow[];
  has_more: boolean;
  next_offset: number;
  total_count: number;
  attachment_count: number;
  ticket_count: number;
}

/** A file the desk refused, so the screen can say which one and why instead of dropping it. */
export interface RejectedFile {
  name: string;
  reason: "type" | "size" | "count";
}

const bearer = (token?: string | null) =>
  token ? { Authorization: `Bearer ${token}` } : {};

/**
 * Absolute URL for an attachment. `ticketToken` is how the requester's own page reads its files.
 * Staff rows already arrive SIGNED (`.../?s=...`, AFC-B afc_support/views.py _signed_attachment_url,
 * inbox #168): a browser following a link sends no Authorization header, so the desk's plain links
 * answered 404 to every admin. The URL is used as given; a token, when there is one, is added with
 * the right separator.
 */
export const attachmentUrl = (att: SupportAttachment, ticketToken?: string) =>
  `${API}${att.url}${ticketToken ? `${att.url.includes("?") ? "&" : "?"}t=${encodeURIComponent(ticketToken)}` : ""}`;

// ── public ───────────────────────────────────────────────────────────────────────────────────
export async function sendContactMessage(input: {
  name: string;
  email: string;
  message: string;
  files?: File[];
  // Cloudflare Turnstile token (owner 2026-09-22). The server verifies it before a ticket
  // exists or staff are emailed; empty in an environment with no site key, which the server
  // also treats as "no check configured".
  botToken?: string;
}) {
  const form = new FormData();
  form.append("name", input.name);
  form.append("email", input.email);
  form.append("message", input.message);
  if (input.botToken) form.append("cf_turnstile_response", input.botToken);
  (input.files ?? []).forEach((f) => form.append("files", f));
  const { data } = await axios.post(`${API}/support/contact/`, form);
  return data as {
    message: string;
    ticket_number: string;
    ticket_url: string;
    rejected_files: RejectedFile[];
  };
}

export async function getTicketByToken(token: string) {
  const { data } = await axios.get(`${API}/support/t/${encodeURIComponent(token)}/`);
  return data as SupportTicket;
}

export async function replyAsRequester(token: string, message: string, files: File[] = []) {
  const form = new FormData();
  form.append("message", message);
  files.forEach((f) => form.append("files", f));
  const { data } = await axios.post(
    `${API}/support/t/${encodeURIComponent(token)}/reply/`,
    form,
  );
  return data as { message: string; rejected_files: RejectedFile[]; ticket: SupportTicket };
}

// ── signed in: my own tickets (inbox #71, 2026-09-28) ──────────────────────────────────────────
// One row of GET support/mine/ (afc_support.views.support_mine): only what the list shows. `token`
// addresses the ticket's own page, app/(user)/support/t/[token].
export interface MySupportTicket {
  ticket_number: string;
  token: string;
  subject: string;
  status: SupportTicket["status"];
  created_at: string;
  last_message_at: string;
}

export interface MySupportTickets {
  results: MySupportTicket[];
  has_more: boolean;
  next_offset: number;
  total_count: number;
  // Tickets AFC has answered that now wait on the player (status "waiting"): the menu count.
  waiting_count: number;
}

export async function getMySupportTickets(token: string, params: { limit?: number; offset?: number } = {}) {
  const { data } = await axios.get(`${API}/support/mine/`, { headers: bearer(token), params });
  return data as MySupportTickets;
}

// ── staff ────────────────────────────────────────────────────────────────────────────────────
export async function getSupportAccess(token?: string | null) {
  const { data } = await axios.get(`${API}/support/access/`, { headers: bearer(token) });
  return data as { can_work_tickets: boolean; can_read_audit: boolean };
}

export async function getTicketQueue(
  token: string,
  params: { q?: string; status?: string; assigned?: string; limit?: number; offset?: number } = {},
) {
  const { data } = await axios.get(`${API}/support/tickets/`, {
    headers: bearer(token),
    params,
  });
  return data as SupportQueue;
}

export async function getTicket(token: string, number: string) {
  const { data } = await axios.get(`${API}/support/tickets/${encodeURIComponent(number)}/`, {
    headers: bearer(token),
  });
  return data as SupportTicket;
}

export async function replyAsStaff(
  token: string,
  number: string,
  message: string,
  files: File[] = [],
  status?: string,
) {
  const form = new FormData();
  form.append("message", message);
  if (status) form.append("status", status);
  files.forEach((f) => form.append("files", f));
  const { data } = await axios.post(
    `${API}/support/tickets/${encodeURIComponent(number)}/reply/`,
    form,
    { headers: bearer(token) },
  );
  return data as {
    message: string;
    emailed: boolean;
    discord_dm: boolean;
    rejected_files: RejectedFile[];
    ticket: SupportTicket;
  };
}

export async function setTicketStatus(
  token: string,
  number: string,
  body: { status?: string; assign_to_me?: boolean },
) {
  const { data } = await axios.post(
    `${API}/support/tickets/${encodeURIComponent(number)}/status/`,
    body,
    { headers: bearer(token) },
  );
  return data as { message: string; ticket: SupportTicket };
}

export async function getSupportAudit(
  token: string,
  params: {
    q?: string;
    direction?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const { data } = await axios.get(`${API}/support/audit/`, {
    headers: bearer(token),
    params,
  });
  return data as SupportAudit;
}

// ── the desk by PERSON (inbox #169 / #174, AFC-B afc_support/views_people.py) ─────────────────
// Owner 2026-10-08: "view all messages from each user in a single place without having to scroll
// ... filter requests by dates, time, country ... reply all messages together or at least reply one
// by one". A person is addressed by an opaque `key` (no email, no id in any URL).

export interface SupportPerson {
  key: string;
  name: string;
  username: string;
  email: string;
  /** Canonical country key ("nigeria") and its label; empty for a signed-out sender. */
  country: string;
  country_name: string;
  has_discord: boolean;
  ticket_count: number;
  /** Requests still open or waiting on them. */
  open_count: number;
  /** The most urgent status among their requests. */
  status: SupportTicket["status"];
  /** They wrote last on something still open: the desk should answer. */
  needs_reply: boolean;
  last_at: string;
  snippet: string;
  ticket_numbers: string[];
}

export interface SupportPeople {
  results: SupportPerson[];
  total_count: number;
  has_more: boolean;
  next_offset: number;
  countries: { value: string; label: string }[];
  status_counts: Record<SupportTicket["status"], number>;
}

export interface SupportPersonDetail {
  person: SupportPerson;
  /** Newest activity first, every message, staff shape (files arrive as signed links). */
  tickets: SupportTicket[];
}

export interface SupportPeopleFilters {
  q?: string;
  /** Comma list of statuses. */
  status?: string;
  /** ISO date-times (the viewer's local choice converted with new Date(...).toISOString()). */
  date_from?: string;
  date_to?: string;
  country?: string;
  source?: string;
  assigned?: string;
  has_files?: string;
  limit?: number;
  offset?: number;
}

export async function getSupportPeople(token: string, params: SupportPeopleFilters = {}) {
  const { data } = await axios.get(`${API}/support/people/`, { headers: bearer(token), params });
  return data as SupportPeople;
}

export async function getSupportPerson(token: string, key: string) {
  const { data } = await axios.get(`${API}/support/people/${encodeURIComponent(key)}/`, {
    headers: bearer(token),
  });
  return data as SupportPersonDetail;
}

/** The staff heads-up email and Discord DM link to a TICKET; this opens that ticket's person. */
export async function getSupportPersonByTicket(token: string, ticketNumber: string) {
  const { data } = await axios.get(`${API}/support/people/by-ticket/`, {
    headers: bearer(token),
    params: { ticket: ticketNumber },
  });
  return data as SupportPersonDetail;
}

export async function replyToPerson(
  token: string,
  key: string,
  input: { message: string; ticketNumbers: string[]; files?: File[]; resolve?: boolean },
) {
  const form = new FormData();
  form.append("message", input.message);
  form.append("ticket_numbers", input.ticketNumbers.join(","));
  if (input.resolve) form.append("resolve", "true");
  (input.files ?? []).forEach((f) => form.append("files", f));
  const { data } = await axios.post(`${API}/support/people/${encodeURIComponent(key)}/reply/`, form, {
    headers: bearer(token),
  });
  return data as SupportPersonDetail & {
    message: string;
    emailed: boolean;
    discord_dm: boolean;
    rejected_files: RejectedFile[];
    answered: string[];
  };
}

export async function bulkReplyToPeople(
  token: string,
  input: { keys: string[]; message: string; resolve?: boolean },
) {
  const { data } = await axios.post(
    `${API}/support/people/bulk-reply/`,
    { keys: input.keys, message: input.message, resolve: input.resolve ? "true" : "" },
    { headers: bearer(token) },
  );
  return data as { message: string; people_sent: number; requests_answered: number; skipped: number };
}
