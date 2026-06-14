import axios from "axios";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

/**
 * Typed client for the Partner Data API admin surface (prefix /partners/admin/).
 *
 * Mirrors lib/organizers.ts (axios + the BASE url + Bearer-from-cookie auth): every
 * call carries the Bearer token read from the same `auth_token` cookie that AuthContext
 * sets (js-cookie), so callers don't have to thread it through props/hooks. These are the
 * AFC-staff (head_admin / partner_admin) provisioning endpoints - the human session
 * surface, NOT the partner-facing X-API-Key read API (that one lives under
 * /api/v1/partner/ and never touches this client).
 *
 * What a Partner is (so the types below read in context): an AFC-approved external
 * consumer of completed/published tournament data. ALL of its access is described by
 * config on the Partner row - its scope (which events it may read) and its 14 toggles
 * (6 resource toggles = which endpoints respond, 8 field toggles = which fields appear),
 * every one defaulting OFF for least privilege. PartnerApiKey rows are rotatable
 * credentials that inherit that config; only a key's sha256 hash is stored, so the
 * plaintext is returned by issueKey EXACTLY ONCE and can never be re-fetched.
 *
 * Errors surface as axios errors with `err.response.data.message` - handle them with a
 * toast at the call site, like the rest of the app.
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

const url = (path: string) => `${BASE}/partners/${path}`;

async function aGet<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  return (await axios.get(url(path), { params, headers: authHeaders() })).data;
}
async function aPost<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.post(url(path), body ?? {}, { headers: authHeaders() })).data;
}
async function aPatch<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.patch(url(path), body ?? {}, { headers: authHeaders() })).data;
}

// ── Toggle whitelist (must stay in lock-step with the backend PARTNER_TOGGLE_FIELDS) ──
// The single source of truth for the FE: the Scope+Toggles tab renders one Switch per
// id below, and editPartner only ever sends these keys. If the backend adds a toggle,
// add it here (and to the labels map in the detail page) - exactly the same rule the
// backend documents ("a new toggle must be added to PARTNER_TOGGLE_FIELDS AND the FE
// switches").
//
// 6 RESOURCE toggles - which endpoints (resources) respond at all.
export const RESOURCE_TOGGLES = [
  "can_read_events",
  "can_read_stages",
  "can_read_matches",
  "can_read_standings",
  "can_read_teams",
  "can_read_players",
] as const;

// 8 FIELD toggles - which fields appear inside a resource the partner can already read.
export const FIELD_TOGGLES = [
  "include_placements",
  "include_kills",
  "include_damage",
  "include_assists",
  "include_rosters",
  "include_maps",
  "include_prize",
  "include_mvp",
] as const;

export const PARTNER_TOGGLE_FIELDS = [
  ...RESOURCE_TOGGLES,
  ...FIELD_TOGGLES,
] as const;

export type ResourceToggle = (typeof RESOURCE_TOGGLES)[number];
export type FieldToggle = (typeof FIELD_TOGGLES)[number];
export type PartnerToggle = (typeof PARTNER_TOGGLE_FIELDS)[number];

// ── Payload / response shapes (mirror the views_admin serializers) ──

// Lean row from list_partners (_serialize_partner_summary).
export interface PartnerSummary {
  partner_id: number;
  slug: string;
  name: string;
  status: string;
  active_key_count: number;
  created_at: string | null;
}

// Full config from get_partner / edit_partner (_serialize_partner_detail). It is the
// summary PLUS every toggle (as a boolean keyed by its toggle id), the scope id-lists,
// the native-AFC switch, and the INTERNAL contact_email (admin-only - the partner
// firewall never emits it). `[key in PartnerToggle]: boolean` keeps the toggles typed.
export type PartnerDetail = PartnerSummary & {
  [key in PartnerToggle]: boolean;
} & {
  allow_all_native_afc: boolean;
  allowed_events: number[];          // Event pks the partner is explicitly granted
  allowed_organizations: number[];   // Organization pks whose events are all granted
  contact_email: string;
};

// Metadata-only view of a key (_serialize_key). NEVER the plaintext or the hash - the
// admin sees the prefix (to identify the key), its label, status and audit stamps.
export interface PartnerKey {
  key_id: number;
  key_prefix: string;
  label: string;
  status: string;
  rate_limit_per_min: number;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string | null;
}

// get_partner returns the detail dict + the partner's keys as metadata.
export interface PartnerDetailResponse {
  partner: PartnerDetail;
  keys: PartnerKey[];
}

// issue_key returns the plaintext key ONCE (`api_key`) alongside the new key's metadata.
export interface IssueKeyResponse {
  message: string;
  api_key: string;       // the full plaintext - present in this response ONLY
  key: PartnerKey;
}

// The whitelisted edit body: any subset of the 14 toggles + the scope grants + the
// native switch. True PATCH - only keys present are touched; unknown keys 400 server-side.
export interface EditPartnerBody {
  // toggles (optional, partial) - Partial<Record<PartnerToggle, boolean>>
  can_read_events?: boolean;
  can_read_stages?: boolean;
  can_read_matches?: boolean;
  can_read_standings?: boolean;
  can_read_teams?: boolean;
  can_read_players?: boolean;
  include_placements?: boolean;
  include_kills?: boolean;
  include_damage?: boolean;
  include_assists?: boolean;
  include_rosters?: boolean;
  include_maps?: boolean;
  include_prize?: boolean;
  include_mvp?: boolean;
  // scope
  allow_all_native_afc?: boolean;
  allowed_events?: number[];
  allowed_organizations?: number[];
}

export const partnersApi = {
  // ── Provisioning + oversight ─────────────────────────────────────────────
  // createPartner only needs a name (everything else is configured afterward); the
  // backend derives a unique slug. contact_email is optional internal metadata.
  createPartner: (body: { name: string; contact_email?: string }) =>
    aPost<{ message: string; partner: PartnerSummary }>("admin/create/", body),
  // listPartners paginates server-side: pass { search?, status?, limit, offset };
  // returns { results, total_count, has_more } (same shape as adminListOrganizations).
  listPartners: (params?: Record<string, any>) =>
    aGet<{ results: PartnerSummary[]; total_count: number; has_more: boolean }>(
      "admin/list/",
      params,
    ),
  // getPartner - full config (toggles + scope + internal email) + keys metadata.
  getPartner: (slug: string) =>
    aGet<PartnerDetailResponse>(`admin/${slug}/`),
  // editPartner - whitelist-validated PATCH of scope + toggles (see EditPartnerBody).
  // Sending only the keys you change keeps the rest untouched (true PATCH semantics).
  editPartner: (slug: string, body: EditPartnerBody) =>
    aPatch<{ message: string; partner: PartnerDetail }>(`admin/${slug}/`, body),
  // suspendPartner - reversible freeze; { suspend: true } blocks every key, false restores.
  suspendPartner: (slug: string, body: { suspend: boolean }) =>
    aPost<{ message: string; status: string }>(`admin/${slug}/suspend/`, body),

  // ── Key management ───────────────────────────────────────────────────────
  // issueKey mints a new key and returns the plaintext ONCE (IssueKeyResponse.api_key).
  // Optional label + per-key rate-limit override (defaults to 60/min server-side).
  issueKey: (slug: string, body?: { label?: string; rate_limit_per_min?: number }) =>
    aPost<IssueKeyResponse>(`admin/${slug}/keys/`, body),
  // revokeKey permanently disables one key (addressed by id - a key is the thing acted on).
  // Idempotent server-side: re-revoking is a harmless no-op success.
  revokeKey: (keyId: number | string) =>
    aPost<{ message: string }>(`admin/keys/${keyId}/revoke/`),

  // ── Per-event publish gate ───────────────────────────────────────────────
  // publishEvent flips Event.partner_published - the gate the read API applies FIRST,
  // so no partner (however broadly scoped) can read an event until it is published here.
  publishEvent: (eventSlug: string, body: { published: boolean }) =>
    aPost<{ message: string; partner_published: boolean }>(
      `admin/events/${eventSlug}/publish/`,
      body,
    ),
};
