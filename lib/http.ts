import Cookies from "js-cookie";
import { getAuthToken } from "./authToken";

/**
 * Shared HTTP helpers for the typed API clients in lib/*.ts.
 *
 * Cleanup 2026-06-14: every lib client declared its OWN identical `authHeaders()` (read the
 * `auth_token` cookie AuthContext writes on login, return a Bearer header). This is the one copy;
 * the clients import it instead of re-declaring it. Each client keeps its own BASE/url(path) prefix
 * (those legitimately differ per API area), so only the duplicated auth header + error-message
 * idiom are centralized here.
 */

/** Bearer auth header for a gated API call.
 *
 * PREFERS the authoritative in-memory token AuthContext keeps in sync (lib/authToken), and
 * falls back to the `auth_token` cookie only before AuthContext has hydrated. This avoids the
 * "everything 401s" bug where a STALE DUPLICATE auth_token cookie (shadowing the canonical one)
 * made `Cookies.get` return a dead token on every request. See lib/authToken.ts. */
export function authHeaders() {
  const token = getAuthToken() ?? Cookies.get("auth_token");
  if (!token) throw new SessionExpiredError();
  return { Authorization: `Bearer ${token}` };
}

/**
 * Thrown by authHeaders() when there is no session token to send.
 *
 * WHY THIS THROWS RATHER THAN SENDING AN EMPTY BEARER (owner bug 2026-08-29)
 *   It used to return `Bearer ${token ?? ""}`. With no token that is the string "Bearer ", and
 *   axios trims the trailing space, so the backend receives exactly "Bearer". Its gate is
 *   `auth.startswith("Bearer ")` WITH the space, which fails, so a DEAD SESSION was reported as a
 *   MALFORMED REQUEST:
 *
 *     no header      -> "Invalid or missing Authorization token."  400
 *     "Bearer "      -> "Invalid or missing Authorization token."  400   <- what players hit
 *     "Bearer junk"  -> "Invalid or expired session token."        401
 *
 *   Proved against production, not reasoned about.
 *
 *   Nothing then recovered, which is what made it a dead end rather than a blip. AuthContext's
 *   interceptor acts on `status === 401 && token`; this was 400 with no token, so neither held.
 *   No logout, no login modal. The owner reported it as "Invalid or missing Authorization token."
 *   while visibly signed in, next to a form that could never submit.
 *
 *   So: do not make the request at all. Raise the same auth:session-expired event the interceptor
 *   raises, which opens the login modal in place, and throw an error carrying a sentence a person
 *   can act on. Every caller already funnels errors through getErrorMessage or a toast, so this
 *   surfaces correctly without touching any of them.
 *
 *   This lives here on purpose. `Bearer ${token ?? ""}` was written out in 12 files; fixing the one
 *   screen where it was noticed would have left the same dead end everywhere else.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super("Your session expired. Please sign in again.");
    this.name = "SessionExpiredError";
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth:session-expired"));
    }
  }
}

/**
 * Pull a human-readable message out of an axios error, falling back to a generic line. Centralizes
 * the `err?.response?.data?.message` idiom repeated across hundreds of call sites; new call sites
 * should use this. (We are not sweeping every existing inline use in this pass.)
 */
export function getErrorMessage(err: any, fallback = "Something went wrong. Please try again."): string {
  return err?.response?.data?.message || err?.message || fallback;
}
