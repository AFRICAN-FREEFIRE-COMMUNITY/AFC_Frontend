import axios from "axios";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

/**
 * Typed client for the partner application queue (prefix /partner-apply/).
 *
 * WHAT THIS IS FOR: an organisation that wants "Sign in with AFC" or a Data API key used to
 * email AFC their details for an admin to retype at /a/partners. Now they fill a public form,
 * their values are validated against the real rules on submit, and the owner approves from a
 * review screen. Backend: backend/afc_partner_apply/views_public.py and views_admin.py.
 *
 * TWO HALVES, TWO AUTH MODELS, and that is the reason for the split below:
 *   PUBLIC   the applicant has NO AFC account, so nothing here sends a Bearer header. They
 *            authenticate with a random token from their email, passed as ?token=. Calls that
 *            need it take it as an argument rather than reading a cookie.
 *   ADMIN    ordinary AFC staff auth: Bearer from the auth_token cookie via authHeaders(),
 *            exactly like lib/sso.ts and lib/partners.ts. Gated to head_admin / partner_admin.
 *
 * THE CREDENTIAL RULE, mirrored from the backend: no response here except claimCredentials
 * ever contains a client secret or an API key, and claimCredentials works exactly once. AFC
 * deliberately does not email either one. See backend/afc_partner_apply/emails.py.
 *
 * Consumed by:
 *   app/(root)/partners/apply/page.tsx              -> submitApplication
 *   app/(root)/partners/apply/status/page.tsx       -> getApplication, updateApplication
 *   app/(root)/partners/apply/credentials/page.tsx  -> claimCredentials
 *   app/(a)/a/partners/_components/PartnerApplicationsPanel.tsx -> the four admin calls
 * Errors surface as axios errors with `err.response.data.message`; toast them at the call site
 * with getErrorMessage(), like the rest of the app.
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

const publicUrl = (path: string) => `${BASE}/partner-apply/${path}`;
const adminUrl = (path: string) => `${BASE}/partner-apply/admin/${path}`;

// ── Types ─────────────────────────────────────────────────────────────────────────────────

/** The four states an application moves through. Mirrors PartnerApplication.STATUS_CHOICES. */
export type ApplicationStatus =
  | "pending"
  | "changes_requested"
  | "approved"
  | "rejected";

/** What the APPLICANT is allowed to see about their own application. Deliberately narrower than
 * the admin view: no internal note, and no credential of any kind. */
export interface ApplicantView {
  reference: string;
  status: ApplicationStatus;
  organisation_name: string;
  display_name: string;
  homepage_url: string;
  country: string;
  contact_name: string;
  contact_email: string;
  contact_role: string;
  wants_sso: boolean;
  wants_data_api: boolean;
  redirect_uris: string;
  post_logout_redirect_uris: string;
  deletion_webhook_url: string;
  use_case: string;
  data_needed: string;
  /** AFC's message to the applicant: the rejection reason, or what to fix. */
  decision_note: string;
  /** True only while AFC has asked for changes. The status page shows its edit form on this. */
  is_editable: boolean;
  claim_is_open: boolean;
  claimed_at: string | null;
  /** Public by design (it travels in every authorize URL), so it is safe to show repeatedly. */
  client_id: string | null;
  created_at: string;
  updated_at: string;
}

/** One row in the owner's queue. */
export interface ApplicationSummary {
  id: number;
  reference: string;
  organisation_name: string;
  contact_email: string;
  country: string;
  wants_sso: boolean;
  wants_data_api: boolean;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
}

/** Everything the review screen prefills its editable form from. */
export interface ApplicationDetail extends ApplicationSummary {
  display_name: string;
  homepage_url: string;
  contact_name: string;
  contact_role: string;
  redirect_uris: string;
  post_logout_redirect_uris: string;
  deletion_webhook_url: string;
  use_case: string;
  data_needed: string;
  locale: string;
  logo_url: string;
  decision_note: string;
  /** AFC's note to itself. Never shown to the applicant by any endpoint. */
  internal_note: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  sso_application_id: number | null;
  client_id: string | null;
  data_partner_slug: string | null;
  claim_is_open: boolean;
  claimed_at: string | null;
  claim_expires_at: string | null;
  /** Other applications from the same contact address. The signal that a rejection is being
   * appealed by resubmission, which is the one thing rejected-is-terminal makes possible. */
  earlier_applications: number;
}

/** What an approved applicant collects, once. The only response in this client that carries a
 * credential; `client_secret` appears only for an SSO partner and `api_key` only for a Data API
 * one, so a partner who asked for both gets both. */
export interface ClaimedCredentials {
  message: string;
  reference: string;
  client_id?: string;
  client_secret?: string;
  api_key?: string;
}

// ── PUBLIC: the applicant ─────────────────────────────────────────────────────────────────

/**
 * Submit one application. POST /partner-apply/applications/.
 *
 * Sent as multipart ALWAYS, not only when a logo is attached, so the request shape does not
 * change depending on whether the applicant picked a file. The backend accepts both and reads
 * booleans through a helper that handles the "true"/"false" strings multipart produces.
 *
 * A 201 means a new application; a 200 with `already_pending` means this contact email already
 * has one open and the caller should show them that reference instead of an error, because the
 * cause is almost always a double-clicked button.
 */
export async function submitApplication(form: FormData): Promise<{
  message: string;
  reference: string;
  status: ApplicationStatus;
  already_pending?: boolean;
}> {
  // Content-Type is deliberately unset: axios must write it itself so the multipart boundary
  // matches the body. Same reason as the logo upload in lib/sso.ts.
  return (await axios.post(publicUrl("applications/"), form)).data;
}

/** Read one application with the token from the applicant's email.
 * GET /partner-apply/applications/<reference>/?token=... */
export async function getApplication(
  reference: string,
  token: string,
): Promise<{ application: ApplicantView }> {
  return (
    await axios.get(publicUrl(`applications/${encodeURIComponent(reference)}/`), {
      params: { token },
    })
  ).data;
}

/** Send corrections. PATCH the same path. Only accepted while AFC has asked for changes; the
 * backend answers 409 otherwise, and submitting returns the application to the owner's queue. */
export async function updateApplication(
  reference: string,
  token: string,
  body: Record<string, unknown>,
): Promise<{ message: string; application: ApplicantView }> {
  return (
    await axios.patch(
      publicUrl(`applications/${encodeURIComponent(reference)}/`),
      body,
      { params: { token } },
    )
  ).data;
}

/**
 * Collect the credentials, once. POST /partner-apply/applications/<reference>/claim/?token=...
 *
 * `token` here is the CLAIM token from the approval email, not the long-lived access token that
 * reads the status page: they are separate credentials with separate lifetimes and the long
 * lived one cannot mint secrets. A second call answers 409.
 */
export async function claimCredentials(
  reference: string,
  token: string,
): Promise<ClaimedCredentials> {
  return (
    await axios.post(
      publicUrl(`applications/${encodeURIComponent(reference)}/claim/`),
      {},
      { params: { token } },
    )
  ).data;
}

// ── ADMIN: the owner ──────────────────────────────────────────────────────────────────────

/** The queue. `pending_count` is the WHOLE queue's outstanding work regardless of the filter,
 * because it drives the tab badge and a badge that changes when you filter is a lie. */
export async function listApplications(params?: {
  status?: string;
  product?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  results: ApplicationSummary[];
  total_count: number;
  has_more: boolean;
  pending_count: number;
}> {
  return (
    await axios.get(adminUrl("applications/"), { params, headers: authHeaders() })
  ).data;
}

/** One application in full, for the review sheet. */
export async function getApplicationDetail(
  id: number,
): Promise<{ application: ApplicationDetail }> {
  return (await axios.get(adminUrl(`applications/${id}/`), { headers: authHeaders() })).data;
}

/**
 * Approve, reject, or ask for changes.
 *
 * On approve, `body` carries the fields AS EDITED ON THE REVIEW SCREEN plus the data grants, so
 * what goes live is what the owner approved rather than what an unknown organisation typed. On
 * reject and request_changes a `note` is required: it is the entire email the applicant gets.
 */
export async function decideApplication(
  id: number,
  body: {
    action: "approve" | "reject" | "request_changes";
    note?: string;
    internal_note?: string;
    [field: string]: unknown;
  },
): Promise<{ message: string; application: ApplicationDetail }> {
  return (
    await axios.post(adminUrl(`applications/${id}/decide/`), body, { headers: authHeaders() })
  ).data;
}

/** Mint a fresh single-use credentials link and email it again. Safe to press twice: each press
 * invalidates the previous link, so only the newest email works. */
export async function resendCredentials(
  id: number,
): Promise<{ message: string; application: ApplicationDetail }> {
  return (
    await axios.post(adminUrl(`applications/${id}/resend-credentials/`), {}, {
      headers: authHeaders(),
    })
  ).data;
}
