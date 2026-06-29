// lib/godmode.ts
// ─────────────────────────────────────────────────────────────────────────────
// Super-admin "act-as" (god-mode) client state.
//
// WHAT: lets a head_admin / super_admin step INTO any organizer or vendor dashboard.
// They click "Manage as this organizer/vendor" in the admin area, which stores the target
// in a cookie here. The AuthContext axios request interceptor turns those cookies into the
// X-Act-As-Org / X-Act-As-Vendor request headers on EVERY call, and the backend
// (afc_auth/act_as.py) honors them ONLY for a super admin, so a normal user setting these
// cookies gains nothing.
//
// Cookie names (read by the AuthContext interceptor):
//   act_as_org        -> organization slug   -> X-Act-As-Org
//   act_as_vendor     -> vendor id           -> X-Act-As-Vendor
//   act_as_org_name / act_as_vendor_name are FE-only labels for the override banner.
//
// Only ONE tenant is impersonated at a time (entering an org clears any vendor act-as and
// vice versa). "Exit" clears everything and returns the admin to their own context.
// ─────────────────────────────────────────────────────────────────────────────
import Cookies from "js-cookie";

export const ACT_AS_ORG_COOKIE = "act_as_org";
export const ACT_AS_VENDOR_COOKIE = "act_as_vendor";
const ACT_AS_ORG_NAME_COOKIE = "act_as_org_name";
const ACT_AS_VENDOR_NAME_COOKIE = "act_as_vendor_name";

// Same scope as the auth cookie so the act-as state survives navigation + reload.
const OPTS = { path: "/", sameSite: "strict" as const };

/** Begin managing an organizer dashboard as `slug` (clears any vendor act-as). */
export function enterAsOrg(slug: string, name?: string) {
  Cookies.set(ACT_AS_ORG_COOKIE, slug, OPTS);
  if (name) Cookies.set(ACT_AS_ORG_NAME_COOKIE, name, OPTS);
  clearVendorCookies();
}

/** Begin managing a vendor dashboard as `vendorId` (clears any org act-as). */
export function enterAsVendor(vendorId: number | string, name?: string) {
  Cookies.set(ACT_AS_VENDOR_COOKIE, String(vendorId), OPTS);
  if (name) Cookies.set(ACT_AS_VENDOR_NAME_COOKIE, name, OPTS);
  clearOrgCookies();
}

/** Clear all act-as state (return to the admin's own context). */
export function exitGodMode() {
  clearOrgCookies();
  clearVendorCookies();
}

function clearOrgCookies() {
  Cookies.remove(ACT_AS_ORG_COOKIE, { path: "/" });
  Cookies.remove(ACT_AS_ORG_NAME_COOKIE, { path: "/" });
}
function clearVendorCookies() {
  Cookies.remove(ACT_AS_VENDOR_COOKIE, { path: "/" });
  Cookies.remove(ACT_AS_VENDOR_NAME_COOKIE, { path: "/" });
}

export function getActAsOrg(): string | null {
  return Cookies.get(ACT_AS_ORG_COOKIE) || null;
}
export function getActAsOrgName(): string | null {
  return Cookies.get(ACT_AS_ORG_NAME_COOKIE) || null;
}
export function getActAsVendor(): string | null {
  return Cookies.get(ACT_AS_VENDOR_COOKIE) || null;
}
export function getActAsVendorName(): string | null {
  return Cookies.get(ACT_AS_VENDOR_NAME_COOKIE) || null;
}

/** True only for the super admins allowed to act-as any tenant: head_admin / super_admin.
 * Mirrors the role-normalization used by the audit-log gate (app/(a)/a/history/page.tsx).
 * Excludes organizer_admin and plain role=="admin" (owner decision 2026-06-29). */
export function isGodModeAdmin(
  user: { roles?: unknown[] } | null | undefined,
): boolean {
  return Boolean(
    user?.roles?.some((r) => {
      const n = String(r).toLowerCase().replace(/\s+/g, "_");
      return n === "head_admin" || n === "super_admin";
    }),
  );
}
