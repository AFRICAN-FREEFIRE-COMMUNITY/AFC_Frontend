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

  // ── ORGANIZER — owner/member managing their own organization ─────────────
  getMyOrganizations: () => aGet("get-my-organizations/"),
  getOrganization: (slug: string) => aGet(`get-organization/${slug}/`),
  // editOrganizationProfile accepts JSON by default, or multipart FormData for logo/banner uploads.
  // Pass a FormData body (or set isForm) and axios sets the multipart boundary itself — no JSON
  // Content-Type — mirroring app/(user)/teams/[id]/edit/page.tsx.
  editOrganizationProfile: (slug: string, body: any, _isForm?: boolean) =>
    aPatch(`edit-organization-profile/${slug}/`, body),
  getOrganizationMembers: (slug: string) => aGet(`get-organization-members/${slug}/`),
  addOrganizationMember: (slug: string, body: any) => aPost(`add-organization-member/${slug}/`, body),
  editOrganizationMember: (slug: string, userId: number | string, body: any) =>
    aPatch(`edit-organization-member/${slug}/${userId}/`, body),
  removeOrganizationMember: (slug: string, userId: number | string) =>
    aDelete(`remove-organization-member/${slug}/${userId}/`),

  // ── PUBLIC — public org page (NO auth header) ────────────────────────────
  getOrganizationPublic: (slug: string) => pGet(`get-organization-public/${slug}/`),
};
