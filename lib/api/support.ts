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
 *   GET  support/access/                      what may the caller do here
 *   GET  support/tickets/                     staff queue
 *   GET  support/tickets/<number>/            staff, one thread
 *   POST support/tickets/<number>/reply/      staff, multipart
 *   POST support/tickets/<number>/status/     staff
 *   GET  support/audit/                       head admins only
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

/** Absolute URL for an attachment. `ticketToken` is how the requester's own page reads its files. */
export const attachmentUrl = (att: SupportAttachment, ticketToken?: string) =>
  `${API}${att.url}${ticketToken ? `?t=${encodeURIComponent(ticketToken)}` : ""}`;

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
