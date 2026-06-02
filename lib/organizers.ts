import axios from "axios";
import Cookies from "js-cookie";
import { env } from "@/lib/env";

/**
 * Typed client for the organizer API (prefix /organizers/).
 *
 * Mirrors lib/rankingsAdmin.ts (axios + the BASE url + Bearer-from-cookie auth):
 * every gated call carries the Bearer token read from the same `auth_token` cookie that
 * AuthContext sets (js-cookie), so callers don't have to thread it through props/hooks.
 *
 * Three tiers of endpoints live here:
 *   - ADMIN     — head-admin organization management (create / list / suspend / delete / members)
 *   - ORGANIZER — an organization owner/member managing their own org + members
 *   - PUBLIC    — the public-facing org page; the ONLY call with no auth header.
 *
 * Logo/banner uploads on editOrganizationProfile go up as multipart FormData — mirroring how
 * the rest of the app uploads images (see app/(user)/teams/[id]/edit/page.tsx): the FormData
 * is handed straight to axios and we set NO explicit Content-Type, so axios fills in the
 * multipart boundary itself. Pass a FormData body (or set the optional `isForm` flag) to use it.
 *
 * Errors surface as axios errors with `err.response.data.message` — handle them with a toast
 * at the call site, like the rest of the app.
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

// Bearer header from the auth_token cookie (the cookie AuthContext writes on login).
function authHeaders() {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token ?? ""}` };
}

const url = (path: string) => `${BASE}/organizers/${path}`;

async function aGet<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  return (await axios.get(url(path), { params, headers: authHeaders() })).data;
}
async function aPost<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.post(url(path), body ?? {}, { headers: authHeaders() })).data;
}
// Multipart POST — for FormData bodies (file uploads). We do NOT set a Content-Type
// header so axios fills in the multipart boundary itself, mirroring editOrganizationProfile.
async function aPostForm<T = any>(path: string, body: FormData): Promise<T> {
  return (await axios.post(url(path), body, { headers: authHeaders() })).data;
}
async function aPatch<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.patch(url(path), body ?? {}, { headers: authHeaders() })).data;
}
async function aDelete<T = any>(path: string, body?: any): Promise<T> {
  // axios DELETE carries a body via the `data` option.
  return (await axios.delete(url(path), { headers: authHeaders(), data: body })).data;
}

// No-auth GET — used only by the public org page.
async function pGet<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  return (await axios.get(url(path), { params })).data;
}

export const organizersApi = {
  // ── ADMIN — head-admin organization management ───────────────────────────
  adminCreateOrganization: (body: any) => aPost("admin/create-organization/", body),
  adminListOrganizations: (params?: Record<string, any>) => aGet("admin/get-all-organizations/", params),
  adminGetOrganization: (slug: string) => aGet(`admin/get-organization/${slug}/`),
  adminEditOrganization: (slug: string, body: any) => aPatch(`admin/edit-organization/${slug}/`, body),
  adminSuspendOrganization: (slug: string, body: any) => aPost(`admin/suspend-organization/${slug}/`, body),
  adminDeleteOrganization: (slug: string) => aDelete(`admin/delete-organization/${slug}/`),
  adminManageMember: (slug: string, body: any) => aPost(`admin/manage-organization-member/${slug}/`, body),

  // ── DESIGN REQUESTS — AFC admin review queue (list all + update one) ─────
  // adminListDesignRequests paginates server-side: pass { status?, limit, offset };
  // returns { results, total_count, has_more } — same shape as adminListOrganizations.
  adminListDesignRequests: (params?: Record<string, any>) =>
    aGet("admin/design-requests/", params),
  // adminUpdateDesignRequest changes status + resolution_notes on one request.
  adminUpdateDesignRequest: (id: number | string, body: any) =>
    aPatch(`admin/design-requests/${id}/`, body),

  // ── ORGANIZER — owner/member managing their own organization ─────────────
  getMyOrganizations: () => aGet("get-my-organizations/"),
  getOrganization: (slug: string) => aGet(`get-organization/${slug}/`),
  // editOrganizationProfile accepts JSON by default, or multipart FormData for logo/banner uploads.
  // Pass a FormData body (or set isForm) and axios sets the multipart boundary itself — no JSON
  // Content-Type — mirroring app/(user)/teams/[id]/edit/page.tsx.
  editOrganizationProfile: (slug: string, body: any, _isForm?: boolean) =>
    aPatch(`edit-organization-profile/${slug}/`, body),
  // ── DESIGN REQUESTS — organizer-side (submit + list for one org) ─────────
  // submitDesignRequest goes up as multipart FormData (title, notes?, reference_image?)
  // so the optional reference image rides along — mirrors editOrganizationProfile's
  // FormData path. axios sets the multipart boundary itself (no explicit Content-Type).
  submitDesignRequest: (slug: string, body: FormData) =>
    aPostForm(`design-requests/${slug}/`, body),
  // listDesignRequests returns the org's own requests: { results: [...] }.
  listDesignRequests: (slug: string) => aGet(`design-requests/${slug}/`),

  getOrganizationMembers: (slug: string) => aGet(`get-organization-members/${slug}/`),
  addOrganizationMember: (slug: string, body: any) => aPost(`add-organization-member/${slug}/`, body),
  editOrganizationMember: (slug: string, userId: number | string, body: any) =>
    aPatch(`edit-organization-member/${slug}/${userId}/`, body),
  removeOrganizationMember: (slug: string, userId: number | string) =>
    aDelete(`remove-organization-member/${slug}/${userId}/`),

  // ── REVIEWS — event ratings + comments (Phase 4) ─────────────────────────
  // rateEvent upserts the caller's 1–5 rating (one per event+user); returns the new aggregate.
  rateEvent: (eventId: number | string, score: number) =>
    aPost(`events/${eventId}/rate/`, { score }),
  // getEventRating returns { average, count, my_score } — auth is OPTIONAL (anonymous callers
  // still get average+count; my_score is null without a valid token). Ratings are anonymous to
  // organizers — only the aggregate is ever exposed.
  getEventRating: (eventId: number | string) => aGet(`events/${eventId}/rating/`),
  // commentEvent posts a comment that ONLY the event's organizer (+ AFC) can read.
  commentEvent: (eventId: number | string, text: string) =>
    aPost(`events/${eventId}/comment/`, { text }),
  // getEventComments — organizer-only (can_view_reviews); returns the comments on their event.
  getEventComments: (eventId: number | string) => aGet(`event-comments/${eventId}/`),

  // ── METRICS — organizer dashboard (Phase 4) ──────────────────────────────
  // getOrgMetrics aggregates the org's events: events_count, registered teams/players,
  // total kills, average rating. Gated on can_view_metrics.
  getOrgMetrics: (slug: string) => aGet(`metrics/${slug}/`),

  // ── REPORTS — a user reports an org; AFC reviews + resolves (Phase 4) ─────
  // reportOrganization goes up as multipart FormData (category, details, event_id?, evidence?).
  reportOrganization: (slug: string, body: FormData) =>
    aPostForm(`report-organization/${slug}/`, body),
  adminListReports: (params?: Record<string, any>) => aGet("admin/reports/", params),
  // adminUpdateReport sets status/resolution_notes; pass exclude_event:true to also unverify
  // the reported event for rankings (the integrity action).
  adminUpdateReport: (id: number | string, body: any) => aPatch(`admin/reports/${id}/`, body),

  // ── PUBLIC — public org page (NO auth header) ────────────────────────────
  getOrganizationPublic: (slug: string) => pGet(`get-organization-public/${slug}/`),
};
