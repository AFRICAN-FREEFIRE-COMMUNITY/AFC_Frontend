import axios from "axios";
import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

/**
 * Typed client for the "Sign in with AFC" partner-admin surface (prefix /sso/admin/).
 *
 * Mirrors lib/partners.ts (axios + the BASE url + Bearer-from-cookie auth): every call
 * carries the Bearer token read from the same `auth_token` cookie AuthContext sets, so
 * callers don't thread it through props. These are the AFC-staff (head_admin /
 * partner_admin) provisioning endpoints in backend/afc_sso/admin_api.py, NOT the
 * player-facing Connected apps API (that one is /sso/me/connected-apps/) and NOT the
 * OIDC protocol surface a partner talks to.
 *
 * What an SSO application is (so the types below read in context): an outside org AFC has
 * approved to offer "Sign in with AFC". The org gets a client_id (public) and a
 * client_secret (shown ONCE, see below), and eight share_* toggles decide the MOST it can
 * ever learn about a player. Every toggle defaults OFF. A toggle only raises a ceiling:
 * the player still has to approve the request on the consent screen, and
 * backend/afc_sso/claims.py applies AFC's own rules on top.
 *
 * THE SECRET IS SHOWN ONCE. django-oauth-toolkit hashes client_secret on save, so the
 * plaintext exists for one moment. It is present in createApplication's and
 * rotateSecret's response and in NO other response, ever. There is no "show it again"
 * call because there cannot be one; a lost secret is replaced by rotating.
 *
 * Consumed by: app/(a)/a/partners/_components/SsoAppsPanel.tsx (the "Sign in with AFC"
 * tab of the admin API Keys page). Errors surface as axios errors with
 * `err.response.data.message` - toast them at the call site, like the rest of the app.
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

const url = (path: string) => `${BASE}/sso/admin/${path}`;

async function aGet<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  return (await axios.get(url(path), { params, headers: authHeaders() })).data;
}
async function aPost<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.post(url(path), body ?? {}, { headers: authHeaders() })).data;
}
async function aPatch<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.patch(url(path), body ?? {}, { headers: authHeaders() })).data;
}
async function aDelete<T = any>(path: string): Promise<T> {
  return (await axios.delete(url(path), { headers: authHeaders() })).data;
}
// Multipart POST for the one file upload on this surface. Content-Type is deliberately
// NOT set: axios has to write it itself so the multipart boundary matches the body.
async function aUpload<T = any>(path: string, form: FormData): Promise<T> {
  return (await axios.post(url(path), form, { headers: authHeaders() })).data;
}

// ── The eight data toggles (must stay in lock-step with the backend SSO_FIELD_TOGGLES) ──
// Declared in the SAME order as afc_sso/models.py TOGGLE_TO_SCOPE, which is the order the
// edit form renders them in and the order /sso/admin/scopes/ returns them in. Each one
// unlocks exactly one OIDC scope; the mapping lives on the backend and is echoed in the
// `scopes` field of SsoApplicationDetail so it never has to be duplicated here.
export const SSO_FIELD_TOGGLES = [
  "share_profile",
  "share_email",
  "share_freefire_uid",
  "share_team",
  "share_history",
  "share_stats",
  "share_ranking",
  "share_standing",
] as const;

export type SsoToggle = (typeof SSO_FIELD_TOGGLES)[number];

// ── Payload / response shapes (mirror the admin_api.py serializers) ──

// Lean row from the list endpoint (_serialize_summary). `shared_field_count` is how many
// of the eight toggles are on, so the table can show at a glance who has been granted most.
export interface SsoApplicationSummary {
  application_id: number;
  name: string;
  display_name: string;
  status: string;
  client_id: string;
  shared_field_count: number;
  created_at: string | null;
}

// Full config from the detail endpoint (_serialize_detail): the summary PLUS the identity
// URLs, the redirect URI list (space-separated, as django-oauth-toolkit stores it) and
// every toggle as a boolean keyed by its field name. `scopes` is READ-ONLY - it is derived
// from the toggles server-side (AFCSSOApplication.allowed_scopes()). No client_secret
// field exists here, by construction.
//
// THE THREE LOGO FIELDS, and why the UI needs to tell them apart (owner 2026-08-03, the
// logo became an upload instead of a URL):
//   logo_display_url  the ONE resolved value, and the only one to RENDER: the logo a
//                     player will actually be shown on the consent screen. The uploaded
//                     file if there is one, the legacy URL otherwise, "" for neither.
//   logo_image_url    set only when AFC HOSTS the file. Non-empty means there is
//                     something to replace or remove.
//   logo_url          the raw legacy third-party URL still stored on older rows. Set
//                     WITHOUT logo_image_url means this partner's logo still lives on
//                     their own server, which is what the panel prompts staff to fix.
// Resolution happens server-side (AFCSSOApplication.resolved_logo_url), so no caller has
// to reimplement the precedence.
export type SsoApplicationDetail = SsoApplicationSummary & {
  [key in SsoToggle]: boolean;
} & {
  logo_url: string;
  logo_image_url: string;
  logo_display_url: string;
  homepage_url: string;
  deletion_webhook_url: string;
  redirect_uris: string;
  // Space-separated, like redirect_uris. Empty for a partner that does not offer
  // RP-initiated logout. Same backend policy applies (afc_sso/redirect_policy.py).
  post_logout_redirect_uris: string;
  scopes: string[];
};

// Create + rotate both hand back the plaintext secret exactly once, alongside the app.
export interface SsoSecretResponse {
  message: string;
  client_secret: string; // the plaintext - present in these two responses ONLY
  application: SsoApplicationDetail;
}

// The create body. Toggles are deliberately NOT accepted: a new partner starts with every
// one OFF and is granted data afterwards from the edit form, so "created" and "granted
// access" stay two separate, auditable admin actions.
export interface CreateSsoApplicationBody {
  name: string;
  redirect_uris: string;
  post_logout_redirect_uris?: string;
  display_name?: string;
  homepage_url?: string;
  logo_url?: string;
  deletion_webhook_url?: string;
}

// The whitelisted edit body: any subset of the identity fields + the eight toggles. True
// PATCH - only keys present are touched; unknown keys (including `status`, which the
// suspend endpoint owns) 400 the whole request server-side.
export type EditSsoApplicationBody = Partial<Record<SsoToggle, boolean>> & {
  name?: string;
  display_name?: string;
  logo_url?: string;
  homepage_url?: string;
  redirect_uris?: string;
  post_logout_redirect_uris?: string;
  deletion_webhook_url?: string;
};

// One row of the scope catalogue: the toggle, the OIDC scope it unlocks, and the exact
// sentence the PLAYER reads on the consent screen (from settings.OAUTH2_PROVIDER SCOPES).
export interface SsoScopeCatalogueEntry {
  field: SsoToggle;
  scope: string;
  description: string;
}

export const ssoApi = {
  // ── Provisioning + oversight ─────────────────────────────────────────────
  // listApplications paginates server-side: { search?, status?, limit, offset } →
  // { results, total_count, has_more } (same shape as partnersApi.listPartners).
  listApplications: (params?: Record<string, any>) =>
    aGet<{
      results: SsoApplicationSummary[];
      total_count: number;
      has_more: boolean;
    }>("apps/", params),
  // createApplication returns the client secret ONCE (SsoSecretResponse.client_secret).
  createApplication: (body: CreateSsoApplicationBody) =>
    aPost<SsoSecretResponse>("apps/", body),
  // getApplication - full config for the edit form (no secret, there cannot be one).
  getApplication: (applicationId: number) =>
    aGet<{ application: SsoApplicationDetail }>(`apps/${applicationId}/`),
  // editApplication - whitelist-validated PATCH of identity + the eight toggles.
  editApplication: (applicationId: number, body: EditSsoApplicationBody) =>
    aPatch<{ message: string; application: SsoApplicationDetail }>(
      `apps/${applicationId}/`,
      body,
    ),
  // suspendApplication - reversible freeze; { suspend: true } blocks every new sign-in.
  suspendApplication: (applicationId: number, body: { suspend: boolean }) =>
    aPost<{ message: string; status: string }>(`apps/${applicationId}/suspend/`, body),
  // ── The partner logo AFC hosts itself ────────────────────────────────────
  // uploadLogo - multipart POST of one image field, `logo`. Replaces whatever was there.
  // The server identifies the file by DECODING it (afc_sso/admin_api.py
  // _clean_logo_upload), so a 400 here means the bytes were not a PNG / JPG / WEBP, were
  // over 2 MB, or were too many pixels - not that the name looked wrong. Callers should
  // still run the file through lib/imageCompress.ts first, so a phone-sized image never
  // reaches the cap.
  //
  // WHY AN UPLOAD AND NOT A URL: this logo is rendered on the CONSENT SCREEN, the page a
  // player reads before trusting a partner with their data. A URL meant the partner could
  // swap that image at any time and every player load pinged their server. AFC hosting the
  // file means what staff approved is what players see.
  uploadLogo: (applicationId: number, file: File) => {
    const form = new FormData();
    form.append("logo", file);
    return aUpload<{ message: string; application: SsoApplicationDetail }>(
      `apps/${applicationId}/logo/`,
      form,
    );
  },
  // removeLogo - clears BOTH the uploaded file and any legacy logo_url, because an admin
  // sees one logo and expects removing it to remove it. It is the only way to say "this
  // partner has no logo" now that the URL text field is gone.
  removeLogo: (applicationId: number) =>
    aDelete<{ message: string; application: SsoApplicationDetail }>(
      `apps/${applicationId}/logo/`,
    ),

  // rotateSecret - issues a new secret and invalidates the old one immediately. Returns
  // the new plaintext ONCE. The partner's integration breaks until they deploy it, which
  // is why the UI confirms first.
  rotateSecret: (applicationId: number) =>
    aPost<SsoSecretResponse>(`apps/${applicationId}/rotate-secret/`),

  // ── The document AFC sends a partner ─────────────────────────────────────
  // integrationGuide - the partner integration guide PDF, streamed by
  // backend/afc_sso/admin_api.py sso_integration_guide (GET /sso/admin/integration-guide/)
  // from a copy of docs/afc-sso-integration-guide.pdf shipped inside the app.
  //
  // Returns a Blob rather than JSON, so it is the one call here that does not go through
  // aGet. A plain <a href> download is not an option: the route needs the Bearer header
  // like every other /sso/admin/ route, and a browser navigation cannot send one. The
  // caller saves the blob through a transient anchor, the same idiom as the leaderboard
  // graphic export in app/(a)/a/leaderboards/standalone/_components/ExportGraphicDialog.tsx.
  integrationGuide: async (): Promise<Blob> =>
    (
      await axios.get(url("integration-guide/"), {
        headers: authHeaders(),
        responseType: "blob",
      })
    ).data,

  // ── Reference ────────────────────────────────────────────────────────────
  // scopeCatalogue - the eight toggles with the consent-screen sentence for each. The UI
  // renders its own translated copy of those sentences (messages/*/ssoAdmin.json); this
  // is the canonical source they were taken from and the place to check for drift.
  scopeCatalogue: () =>
    aGet<{ toggles: SsoScopeCatalogueEntry[] }>("scopes/"),
};
