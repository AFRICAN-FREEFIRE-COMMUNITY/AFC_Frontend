// lib/authToken.ts
// ─────────────────────────────────────────────────────────────────────────────
// Authoritative in-memory auth token, kept in sync by AuthContext.
//
// WHY THIS EXISTS (bug fix 2026-06-29):
//   The token was read straight from the `auth_token` cookie everywhere (lib/http
//   authHeaders + every lib/* client). But a STALE DUPLICATE auth_token cookie (one
//   written at a deeper path, e.g. /a, shadowing the canonical path "/" cookie) makes
//   `Cookies.get("auth_token")` return the WRONG (dead) token, so every API call 401s
//   while AuthContext's own get-user-profile (which uses its in-memory token state) still
//   works -> the "logged in but everything fails / random logout" symptom.
//
//   AuthContext now mirrors its validated token here on login / restore / refresh, and
//   authHeaders() PREFERS this in-memory value over the cookie. The cookie is still used as
//   the cold-start fallback (first paint before AuthContext hydrates) and for persistence
//   across reloads; the in-memory token just guarantees outgoing requests use the token the
//   backend actually accepted, regardless of any cookie duplication.
// ─────────────────────────────────────────────────────────────────────────────

let _token: string | null = null;
// True once a real token has been set during this page load. It never goes back to false: it is
// the difference between "this person was signed in and lost it" and "this person never signed in",
// which lib/http SessionExpiredError needs (see hadSessionThisLoad).
let _hadSession = false;

/** AuthContext calls this whenever it sets/clears the active session token. */
export function setAuthToken(token: string | null): void {
  _token = token;
  if (token) _hadSession = true;
}

/**
 * Whether a session token has existed at any point during this page load.
 *
 * WHY (bug, 2026-09-12): authHeaders() throws SessionExpiredError when there is no token, and that
 * error opens the "Session expired" login modal. But "no token" is also simply a GUEST, and three
 * reads on the public event page (event rating, event sponsors, group draw) call authHeaders()
 * because a signed-in viewer gets extra fields back. So every logged-out visitor to an event page
 * was greeted with "Session expired". A guest has no session to expire; the modal is only right
 * for someone who HAD one. This flag is how the error tells the two apart.
 */
export function hadSessionThisLoad(): boolean {
  return _hadSession;
}

/** The authoritative in-memory token, or null before AuthContext has hydrated. */
export function getAuthToken(): string | null {
  return _token;
}
