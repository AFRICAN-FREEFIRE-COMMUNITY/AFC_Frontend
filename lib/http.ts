import Cookies from "js-cookie";

/**
 * Shared HTTP helpers for the typed API clients in lib/*.ts.
 *
 * Cleanup 2026-06-14: every lib client declared its OWN identical `authHeaders()` (read the
 * `auth_token` cookie AuthContext writes on login, return a Bearer header). This is the one copy;
 * the clients import it instead of re-declaring it. Each client keeps its own BASE/url(path) prefix
 * (those legitimately differ per API area), so only the duplicated auth header + error-message
 * idiom are centralized here.
 */

/** Bearer auth header from the `auth_token` cookie (the cookie AuthContext writes on login). */
export function authHeaders() {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token ?? ""}` };
}

/**
 * Pull a human-readable message out of an axios error, falling back to a generic line. Centralizes
 * the `err?.response?.data?.message` idiom repeated across hundreds of call sites; new call sites
 * should use this. (We are not sweeping every existing inline use in this pass.)
 */
export function getErrorMessage(err: any, fallback = "Something went wrong. Please try again."): string {
  return err?.response?.data?.message || err?.message || fallback;
}
