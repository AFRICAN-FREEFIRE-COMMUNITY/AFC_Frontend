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
 *   - ADMIN     - head-admin organization management (create / list / suspend / delete / members)
 *   - ORGANIZER - an organization owner/member managing their own org + members
 *   - PUBLIC    - the public-facing org page; the ONLY call with no auth header.
 *
 * Logo/banner uploads on editOrganizationProfile go up as multipart FormData - mirroring how
 * the rest of the app uploads images (see app/(user)/teams/[id]/edit/page.tsx): the FormData
 * is handed straight to axios and we set NO explicit Content-Type, so axios fills in the
 * multipart boundary itself. Pass a FormData body (or set the optional `isForm` flag) to use it.
 *
 * Errors surface as axios errors with `err.response.data.message` - handle them with a toast
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
// Multipart POST - for FormData bodies (file uploads). We do NOT set a Content-Type
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

// No-auth GET - used only by the public org page.
async function pGet<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  return (await axios.get(url(path), { params })).data;
}

export const organizersApi = {
  // ── ADMIN - head-admin organization management ───────────────────────────
  adminCreateOrganization: (body: any) => aPost("admin/create-organization/", body),
  adminListOrganizations: (params?: Record<string, any>) => aGet("admin/get-all-organizations/", params),
  adminGetOrganization: (slug: string) => aGet(`admin/get-organization/${slug}/`),
  adminEditOrganization: (slug: string, body: any) => aPatch(`admin/edit-organization/${slug}/`, body),
  adminSuspendOrganization: (slug: string, body: any) => aPost(`admin/suspend-organization/${slug}/`, body),
  adminDeleteOrganization: (slug: string) => aDelete(`admin/delete-organization/${slug}/`),
  adminManageMember: (slug: string, body: any) => aPost(`admin/manage-organization-member/${slug}/`, body),

  // ── DESIGN REQUESTS - AFC admin review queue (list all + update one) ─────
  // adminListDesignRequests paginates server-side: pass { status?, limit, offset };
  // returns { results, total_count, has_more } - same shape as adminListOrganizations.
  adminListDesignRequests: (params?: Record<string, any>) =>
    aGet("admin/design-requests/", params),
  // adminUpdateDesignRequest changes status + resolution_notes on one request.
  adminUpdateDesignRequest: (id: number | string, body: any) =>
    aPatch(`admin/design-requests/${id}/`, body),

  // ── ORGANIZER - owner/member managing their own organization ─────────────
  getMyOrganizations: () => aGet("get-my-organizations/"),
  getOrganization: (slug: string) => aGet(`get-organization/${slug}/`),
  // editOrganizationProfile accepts JSON by default, or multipart FormData for logo/banner uploads.
  // Pass a FormData body (or set isForm) and axios sets the multipart boundary itself - no JSON
  // Content-Type - mirroring app/(user)/teams/[id]/edit/page.tsx.
  editOrganizationProfile: (slug: string, body: any, _isForm?: boolean) =>
    aPatch(`edit-organization-profile/${slug}/`, body),
  // ── DESIGN REQUESTS - organizer-side (submit + list for one org) ─────────
  // submitDesignRequest goes up as multipart FormData (title, notes?, reference_image?)
  // so the optional reference image rides along - mirrors editOrganizationProfile's
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

  // ── REVIEWS - event ratings + comments (Phase 4) ─────────────────────────
  // rateEvent upserts the caller's 1-5 rating (one per event+user); returns the new aggregate.
  rateEvent: (eventId: number | string, score: number) =>
    aPost(`events/${eventId}/rate/`, { score }),
  // getEventRating returns { average, count, my_score } - auth is OPTIONAL (anonymous callers
  // still get average+count; my_score is null without a valid token). Ratings are anonymous to
  // organizers - only the aggregate is ever exposed.
  getEventRating: (eventId: number | string) => aGet(`events/${eventId}/rating/`),
  // commentEvent posts a comment that ONLY the event's organizer (+ AFC) can read.
  commentEvent: (eventId: number | string, text: string) =>
    aPost(`events/${eventId}/comment/`, { text }),
  // getEventComments - organizer-only (can_view_reviews); returns the comments on their event.
  getEventComments: (eventId: number | string) => aGet(`event-comments/${eventId}/`),

  // ── METRICS - organizer dashboard (Phase 4) ──────────────────────────────
  // getOrgMetrics returns a RICH per-org metrics payload (GET /organizers/metrics/<slug>/,
  // org_metrics in afc_organizers/views_reviews.py), gated on can_view_metrics.
  //
  // OPTIONAL DATE RANGE: pass { start, end } (each "YYYY-MM-DD") to scope every time-bounded
  // aggregate (registrations, matches/kills, page views, ratings, the monthly trend) to that
  // INCLUSIVE window. Omit both for all-time (the default). The server echoes the applied
  // window back as `range: { start, end }` so the caller can confirm what it received.
  //
  // Response shape (every count respects the date range when one is supplied):
  //   - range{}:   { start, end } (ISO or null) - the window the server actually applied
  //   - flat back-compat keys: events_count, registered_teams, registered_players,
  //     total_kills, average_rating, ratings_count
  //   - totals{}:  by-status / by-type / by-mode / by-tier splits, unique teams + players,
  //     complete/incomplete registrations, total matches / kills / prize money, total_views,
  //     unique_viewers, avg participants per event, fill-rate, completion rate
  //   - registrations{}: { complete, incomplete, total } (complete = confirmed entrant:
  //     team "active" + solo "registered"/"approved"; incomplete = any other status)
  //   - page_views{}: { total_views, unique_viewers } from EventPageView (in range)
  //   - rating{}:  { average, count }
  //   - monthly[]: { month, registrations, matches, views } trend series (in-range timestamps)
  //   - top_teams[] / top_players[]: org leaderboards by kills (top 10 each, in range)
  //   - events[]:  capped per-event breakdown rows, each enriched with complete/incomplete
  //     registrations, views, unique_viewers, matches, kills, prize, rating (newest first)
  // Consumed by app/(organizer)/organizer/metrics/page.tsx (the detailed Metrics dashboard).
  getOrgMetrics: (slug: string, params?: { start?: string; end?: string }) =>
    aGet(`metrics/${slug}/`, params),

  // ── REPORTS - a user reports an org; AFC reviews + resolves (Phase 4) ─────
  // reportOrganization goes up as multipart FormData (category, details, event_id?, evidence?).
  reportOrganization: (slug: string, body: FormData) =>
    aPostForm(`report-organization/${slug}/`, body),
  adminListReports: (params?: Record<string, any>) => aGet("admin/reports/", params),
  // adminUpdateReport sets status/resolution_notes; pass exclude_event:true to also unverify
  // the reported event for rankings (the integrity action).
  adminUpdateReport: (id: number | string, body: any) => aPatch(`admin/reports/${id}/`, body),

  // ── ORGANIZER BLACKLIST - team blacklists + lift requests (feature "organizer-blacklist") ──
  // Backed by afc_organizers/views_blacklist.py (routes in afc_organizers/urls.py, prefix
  // /organizers/blacklists/...). Two audiences share these calls:
  //   • ORGANIZER staff (gated on can_manage_registrations for the org): create / list / lift a
  //     blacklist, list incoming lift requests, decide one. CONSUMED BY the organizer dashboard
  //     "Blacklists" page (app/(organizer)/organizer/blacklists/page.tsx).
  //   • The AFFECTED PARTY (team manager or snapshot player - NOT org-gated): myBlacklists (the
  //     team auto-discovers the blacklists affecting it) + requestBlacklistLift.
  //     CONSUMED BY the team page "Request blacklist lift" section (app/(user)/teams/[id]/page.tsx).
  // All gating + validation lives server-side; the FE just surfaces the result.

  // createBlacklist - POST blacklists/ -> 201 { message, blacklist }. Blacklists a team for a
  // calendar date RANGE and snapshots its current roster. body: { organization_id, team_id,
  // start_date, end_date, reason }. start_date / end_date are ISO "YYYY-MM-DD" (the backend now
  // takes the range directly; duration_days is only a legacy fallback the FE no longer sends).
  createBlacklist: (body: {
    organization_id: number;
    team_id: number;
    start_date: string;
    end_date: string;
    reason?: string;
  }) => aPost("blacklists/", body),

  // listBlacklists - GET blacklists/?organization_id=&status= -> { results, total_count, has_more }.
  // Each result carries its nested snapshot `players` (the expandable roster on the dashboard).
  listBlacklists: (params: { organization_id: number; status?: string; limit?: number; offset?: number }) =>
    aGet("blacklists/", params),

  // liftBlacklist - POST blacklists/<id>/lift/ -> { message, blacklist }. Organizer early-lift:
  // sets status "lifted" and clears every player block.
  liftBlacklist: (blacklistId: number | string) => aPost(`blacklists/${blacklistId}/lift/`),

  // myBlacklists - GET blacklists/mine/?team_id= -> { results, total_count, has_more }. The
  // AFFECTED PARTY's auto-discovery call: lists the blacklists that affect the caller (the teams
  // they manage AND any blacklist they are a snapshot player on), so the team page never has to
  // ask the user to type a blacklist id. NOT org-permission-gated (the backend scopes results to
  // the caller). Pass team_id to narrow to one team. Each result carries the per-action flags the
  // UI keys off: can_request_team_lift (caller manages that team), can_request_self_lift (caller is
  // an active snapshot player on it), and my_pending_request (the caller's pending lift request,
  // serialized, or null). CONSUMED BY app/(user)/teams/[id]/_components/RequestBlacklistLift.tsx.
  myBlacklists: (params?: { team_id?: number }) => aGet("blacklists/mine/", params),

  // requestBlacklistLift - POST blacklists/<id>/request-lift/ -> 201 { message, lift_request }.
  // The affected party asks for a lift. scope "team" (a manager asks for the whole blacklist) or
  // "player" (the player themselves, or a manager on their behalf, asks for one person);
  // target_user_id is required for player scope. The blacklist id now comes from myBlacklists.
  requestBlacklistLift: (
    blacklistId: number | string,
    body: { scope: "team" | "player"; target_user_id?: number; reason?: string },
  ) => aPost(`blacklists/${blacklistId}/request-lift/`, body),

  // listBlacklistLiftRequests - GET blacklists/lift-requests/?organization_id=&status= ->
  // { results, total_count, has_more }. The org's incoming lift requests (with team context).
  listBlacklistLiftRequests: (params: {
    organization_id: number;
    status?: string;
    limit?: number;
    offset?: number;
  }) => aGet("blacklists/lift-requests/", params),

  // decideBlacklistLiftRequest - POST blacklists/lift-requests/<id>/decide/ -> { message,
  // lift_request }. Organizer approves/denies a pending request. body: { decision, reason }.
  decideBlacklistLiftRequest: (
    requestId: number | string,
    body: { decision: "approve" | "deny"; reason?: string },
  ) => aPost(`blacklists/lift-requests/${requestId}/decide/`, body),

  // ── PUBLIC - public org page (NO auth header) ────────────────────────────
  getOrganizationPublic: (slug: string) => pGet(`get-organization-public/${slug}/`),
  // Public organizer DIRECTORY (NO auth header) - backs the "Organizers" tab on
  // /tournaments. Returns { organizations: [{ slug, name, logo, description,
  // event_count, verified, tier }] } for every active org with published events.
  // Consumed by app/(user)/tournaments/page.tsx → <OrganizerDirectory/>.
  getOrganizationsDirectory: () => pGet("get-organizations-public/"),
};
