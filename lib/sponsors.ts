/**
 * lib/sponsors.ts - typed client for the sponsor-system redesign P1 (backend afc_sponsors).
 *
 * Backend: afc_sponsors/views.py, mounted at /sponsors/ (see that module's header for the full
 * request/response shapes). Auth: Bearer auth_token cookie, same axios idiom as
 * lib/standaloneLeaderboards.ts.
 *
 * CONSUMED BY:
 *  - app/(a)/a/sponsors/_components/SponsorProfilesContent.tsx (admin CRUD + members + events)
 *  - app/(sponsor)/sponsor/dashboard/page.tsx (the member-scoped portal: mine -> events ->
 *    submissions + CSV)
 *
 * PRIVACY: portal payloads carry usernames + submitted values only; no emails (owner decision).
 */
import axios from "axios";
import Cookies from "js-cookie";

import { env } from "@/lib/env";
// Routed through lib/http authHeaders (owner bug 2026-08-29): building the header inline as
// `Bearer ${token ?? ""}` sent "Bearer " when the cookie had lapsed, which axios trims to
// "Bearer", so the backend reported a DEAD SESSION as a MALFORMED REQUEST (400) and nothing
// logged the user out. authHeaders throws SessionExpiredError instead, which opens the login
// modal in place.
import { authHeaders } from "@/lib/http";

const BASE = `${env.NEXT_PUBLIC_BACKEND_API_URL}/sponsors`;

function headers() {
  const token = Cookies.get("auth_token");
  return authHeaders();
}

async function sGet<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  return (await axios.get(`${BASE}/${path}`, { headers: headers(), params })).data;
}
async function sPost<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.post(`${BASE}/${path}`, body ?? {}, { headers: headers() })).data;
}
async function sPatch<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.patch(`${BASE}/${path}`, body ?? {}, { headers: headers() })).data;
}
async function sDelete<T = any>(path: string): Promise<T> {
  return (await axios.delete(`${BASE}/${path}`, { headers: headers() })).data;
}

// ── shapes (mirror afc_sponsors.views serializers) ───────────────────────────
export interface SponsorRow {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  description: string;
  website: string;
  socials: Array<{ platform: string; url: string }>;
  status: "active" | "suspended";
  events_count: number;
  members_count: number;
  created_at: string | null;
  // present only on sponsor_detail
  members?: Array<{ member_id: number; user_id: number; username: string; role: string }>;
}

export interface SponsorEventRow {
  event_id: number;
  event_name: string;
  slug: string | null;
  event_status: string;
  participant_type: string;
  registrants: number;
  requires_approval: boolean;
}

export interface SponsorSubmissionRow {
  id: number;
  username: string;
  team_name: string | null;
  value: string | null;
  status: string;
}

// ── P2/P3/P4 shapes (backend afc_sponsors/engagements.py) ─────────────────────
// One engagement entry of a sponsorship's config (the wizard builder writes these,
// the registration step renders inputs from them). Schema per the design spec:
//   collect_id {label, help?} / follow_social {platform, url, actions[], collect_profile_link}
//   create_account {label, signup_url} / join_group {platform: whatsapp|discord, invite_url}
export interface SponsorEngagement {
  type: "collect_id" | "follow_social" | "create_account" | "join_group";
  label?: string;
  help?: string;
  platform?: string;
  url?: string;
  actions?: Array<"follow" | "like" | "share">;
  collect_profile_link?: boolean;
  signup_url?: string;
  invite_url?: string;
}

// An event's sponsorship + config, as returned by GET sponsors/for-event/<event_id>/
// (public; consumed by the registration sponsor step and the wizard rehydrate).
export interface EventSponsorshipRow {
  sponsorship_id: number;
  sponsor: {
    id: number;
    name: string;
    slug: string;
    logo: string | null;
    website: string;
    socials: Array<{ platform: string; url: string }>;
  };
  requires_approval: boolean;
  engagements: SponsorEngagement[];
  /**
   * The organizer's explainer, shown to players above this sponsor's fields (owner 2026-08-29).
   * Always a string from the backend, never null, so no call site needs a ?? "".
   */
  player_note: string;
}

// One registrant answer row in the portal's per-engagement table
// (GET .../engagement-submissions/). Privacy: usernames + submitted values only.
export interface EngagementSubmissionRow {
  id: number;
  username: string;
  engagement_index: number;
  engagement_label: string;
  engagement_type: string;
  value: string;
  payload: Record<string, any>;
  approval_status: "not_required" | "pending" | "approved" | "rejected";
  reason: string;
  can_undo: boolean;
  updated_at: string | null;
}

// One row of the CROSS-EVENT approval queue (GET sponsors/queue/engagement-submissions/).
// The same submission as above plus the context the per-event table did not need, because this
// queue spans every event and sponsor the caller may decide for (owner 2026-08-14).
export interface QueuedSubmissionRow extends EngagementSubmissionRow {
  event_id: number;
  event_name: string;
  event_slug: string;
  sponsor_id: number;
  sponsor_name: string;
  requires_approval: boolean;
}

// The dropdown pools the queue endpoint returns: only the events and sponsors the CALLER can
// actually decide for, so the filters can never offer a row the list would refuse to show.
export interface SponsorQueueFilters {
  events: Array<{ event_id: number; event_name: string }>;
  sponsors: Array<{ sponsor_id: number; name: string }>;
}

// A pending email invitation to manage a sponsor (GET sponsors/<id>/members/invites/).
export interface SponsorInviteRow {
  invite_id: number;
  email: string;
  role: "owner" | "member";
  expires_at: string | null;
  created_at: string | null;
}

// The caller's OWN submissions for one event (GET sponsors/my-submissions/<event_id>/),
// powering the "waiting for approval" badges + the rejected re-input prompt.
export interface MySubmissionRow {
  id: number;
  sponsorship_id: number;
  sponsor_name: string;
  engagement_index: number;
  engagement_label: string;
  engagement_type: string;
  payload: Record<string, any>;
  approval_status: "not_required" | "pending" | "approved" | "rejected";
  reason: string;
}

export const sponsorsApi = {
  // ── admin (sponsor-admin gated) ──
  create: (body: { name: string; description?: string; website?: string }) =>
    sPost<{ sponsor: SponsorRow }>("create/", body),
  list: (params?: { q?: string; limit?: number; offset?: number }) =>
    sGet<{ results: SponsorRow[]; total_count: number }>("", params),
  detail: (id: number) => sGet<{ sponsor: SponsorRow }>(`${id}/`),
  update: (id: number, body: Partial<Pick<SponsorRow, "name" | "description" | "website" | "status">>) =>
    sPatch<{ sponsor: SponsorRow }>(`${id}/edit/`, body),
  addMember: (id: number, body: { user_id: number; role?: "owner" | "member" }) =>
    sPost(`${id}/members/add/`, body),
  removeMember: (id: number, memberId: number) => sDelete(`${id}/members/${memberId}/`),
  // ── inviting a sponsor's own contact by EMAIL (owner 2026-08-14) ──
  // addMember above needs an AFC username, which a brand contact does not have yet. This takes an
  // address: one that already has an account becomes a member at once (outcome "member_added"),
  // anything else gets a mailed invitation (outcome "invited") that is claimed automatically when
  // that account is verified. Backend: afc_sponsors/invites.py.
  inviteMember: (id: number, body: { email: string; role?: "owner" | "member" }) =>
    sPost<{
      message: string;
      outcome: "member_added" | "already_member" | "invited" | "already_invited";
      username?: string;
      email?: string;
    }>(`${id}/members/invite/`, body),
  listInvites: (id: number) =>
    sGet<{ results: SponsorInviteRow[]; total_count: number }>(`${id}/members/invites/`),
  revokeInvite: (id: number, inviteId: number) =>
    sDelete(`${id}/members/invites/${inviteId}/`),
  attachEvent: (id: number, eventId: number) =>
    sPost(`${id}/events/attach/`, { event_id: eventId }),
  detachEvent: (id: number, eventId: number) => sDelete(`${id}/events/${eventId}/`),

  // ── portal (member-scoped) ──
  mine: () => sGet<{ results: SponsorRow[]; total_count: number }>("mine/"),
  events: (id: number) => sGet<{ results: SponsorEventRow[]; total_count: number }>(`${id}/events/`),
  submissions: (id: number, eventId: number) =>
    sGet<{ event: { event_id: number; event_name: string }; results: SponsorSubmissionRow[]; total_count: number }>(
      `${id}/events/${eventId}/submissions/`,
    ),
  // CSV download: fetch as blob and hand to the browser (same idiom as esport-media.tsx).
  submissionsCsv: async (id: number, eventId: number, filename: string) => {
    const res = await axios.get(`${BASE}/${id}/events/${eventId}/submissions/`, {
      headers: headers(),
      params: { csv: 1 },
      responseType: "blob",
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ── P2: wizard sponsorship config ──
  // PATCH the per-sponsorship engagement builder + approval toggle (sponsor-admin or the
  // event's organizer). Attach/detach above remain the way sponsors join/leave an event.
  configureSponsorship: (
    sponsorId: number,
    eventId: number,
    body: { requires_approval?: boolean; engagements?: SponsorEngagement[]; player_note?: string },
  ) => sPatch(`${sponsorId}/events/${eventId}/configure/`, body),
  // PUBLIC read of an event's sponsorships + engagement config (registration UI + wizard
  // rehydrate). No auth header needed but harmless to send.
  forEvent: (eventId: number) =>
    sGet<{ results: EventSponsorshipRow[]; total_count: number }>(`for-event/${eventId}/`),

  // ── P3: the portal's per-engagement submission tables ──
  engagementSubmissions: (
    sponsorId: number,
    eventId: number,
    params?: { engagement?: number; status?: string; limit?: number; offset?: number },
  ) =>
    sGet<{
      event: { event_id: number; event_name: string };
      engagements: SponsorEngagement[];
      requires_approval: boolean;
      results: EngagementSubmissionRow[];
      total_count: number;
      has_more: boolean;
      next_offset: number | null;
    }>(`${sponsorId}/events/${eventId}/engagement-submissions/`, params),
  engagementSubmissionsCsv: async (
    sponsorId: number, eventId: number, filename: string,
    params?: { engagement?: number; status?: string },
  ) => {
    const res = await axios.get(
      `${BASE}/${sponsorId}/events/${eventId}/engagement-submissions/`,
      { headers: headers(), params: { ...(params ?? {}), csv: 1 }, responseType: "blob" },
    );
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ── P4: the decision surface + the player's side of the rejection loop ──
  // decide: approve | reject (reason REQUIRED) | reject_final (reason REQUIRED, frees the
  // slot) | undo (one-step revert). Member of the sponsor or sponsor-admin.
  decideSubmission: (
    submissionId: number,
    action: "approve" | "reject" | "reject_final" | "undo",
    reason?: string,
  ) => sPost(`submissions/${submissionId}/decide/`, { action, ...(reason ? { reason } : {}) }),
  // The player re-enters a corrected value on a rejected submission; row returns to pending.
  resubmitSubmission: (submissionId: number, payload: Record<string, any>) =>
    sPost(`submissions/${submissionId}/resubmit/`, { payload }),
  // The caller's own submissions for one event (status badges + re-input prompts).
  mySubmissions: (eventId: number) =>
    sGet<{ results: MySubmissionRow[]; total_count: number }>(`my-submissions/${eventId}/`),

  // ── the CROSS-EVENT approval queue (owner 2026-08-14) ──
  // Every submission the caller may decide, across all events and sponsors, pending first.
  // Backend: afc_sponsors/engagements.py admin_submission_queue, which scopes the list with the
  // very same permission it applies to deciding, so a visible row is always an actionable one.
  // Consumed by app/(a)/a/sponsor-dashboard (the Approvals tab). Decisions go through
  // decideSubmission above, unchanged.
  queue: (params?: {
    status?: string;
    event?: number;
    sponsor?: number;
    engagement?: number;
    limit?: number;
    offset?: number;
  }) =>
    sGet<{
      results: QueuedSubmissionRow[];
      total_count: number;
      has_more: boolean;
      next_offset: number | null;
      filters: SponsorQueueFilters;
    }>("queue/engagement-submissions/", params),
  // Same rows, same filters, as a CSV download (blob idiom shared with the two exports above).
  queueCsv: async (
    filename: string,
    params?: { status?: string; event?: number; sponsor?: number },
  ) => {
    const res = await axios.get(`${BASE}/queue/engagement-submissions/`, {
      headers: headers(),
      params: { ...(params ?? {}), csv: 1 },
      responseType: "blob",
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};
