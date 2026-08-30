import axios from "axios";

import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";

/**
 * The login handoff for "Sign in with AFC".
 *
 * WHY THIS EXISTS (owner report 2026-08-30, V-ENT the first partner to try the flow)
 *   Signing in with AFC from a partner site went into an infinite redirect loop:
 *
 *     v-ent.co -> api.africanfreefirecommunity.com/sso/authorize/
 *              -> africanfreefirecommunity.com/login?redirect=<the authorize url>
 *              -> back to /sso/authorize/ -> back to /login -> forever
 *
 *   The backend's OIDC authorize view works out who you are by reading the `auth_token`
 *   cookie. But AuthContext sets that cookie with no `domain`, which makes it HOST-ONLY to
 *   africanfreefirecommunity.com, so it is never sent to the api. subdomain. Authorize saw
 *   an anonymous visitor every time and bounced to /login; /login saw a perfectly good
 *   session and bounced straight back.
 *
 *   It was never caught because local development runs the frontend on 127.0.0.1:3000 and
 *   the API on 127.0.0.1:8000, and COOKIES IGNORE THE PORT. The cookie does reach the API
 *   on a developer machine. The bridge worked locally and could not work in production.
 *
 * WHAT THIS DOES
 *   This page HAS the session token. It swaps it for a single-use code, and only that code
 *   travels in the authorize URL. The backend exchanges the code for a real Django session
 *   on the API host and strips it from the address bar. See backend afc_sso/handoff.py for
 *   the whole design, including why a session rather than a one-shot lookup.
 *
 * WHY NOT JUST WIDEN THE COOKIE to .africanfreefirecommunity.com
 *   It would work, and it exposes the session token to every subdomain while re-opening the
 *   duplicate-cookie shadowing bug AuthContext.clearAuthCookieEverywhere exists because of.
 *
 * CONSUMED BY: app/(auth)/_components/LoginForm.tsx, the only caller.
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

/** What POST /sso/handoff/ answers with. `param` is returned by the server rather than
 *  hardcoded here so the two sides cannot drift apart if the name ever changes. */
interface HandoffResponse {
  code: string;
  param: string;
  expires_in: number;
}

/**
 * True when `target` is an AFC OIDC authorize URL, which is the only redirect that needs a
 * handoff. Everything else on this site is a same-origin path and already works.
 *
 * Deliberately strict: it compares the ORIGIN against the configured API base rather than
 * pattern-matching the string, so a partner cannot craft a `?redirect=` that talks us into
 * minting a login code and posting it to their own host.
 */
export function needsSsoHandoff(target: string): boolean {
  try {
    const url = new URL(target, window.location.origin);
    const api = new URL(BASE);
    return url.origin === api.origin && url.pathname.startsWith("/sso/authorize");
  } catch {
    // A relative path or an unparseable string is an ordinary in-app redirect.
    return false;
  }
}

/**
 * Swap this session for a single-use code and return `target` with the code attached.
 *
 * Returns `target` UNCHANGED when anything goes wrong. That is the deliberate choice: an
 * unmodified URL degrades to the old bounce to /login, which is a state the player can see
 * and act on, rather than an error page in the middle of signing in to a partner.
 */
export async function withSsoHandoff(target: string): Promise<string> {
  try {
    const { data } = await axios.post<HandoffResponse>(
      `${BASE}/sso/handoff/`,
      {},
      { headers: authHeaders() },
    );
    if (!data?.code) return target;

    const url = new URL(target, window.location.origin);
    url.searchParams.set(data.param || "afc_handoff", data.code);
    return url.toString();
  } catch {
    return target;
  }
}
