// ─────────────────────────────────────────────────────────────────────────────
// lib/connectedApps.ts
//
// Typed client for the CONNECTED APPS API (backend prefix /sso/, the `me/` routes
// in afc_sso/api.py). A "connected app" is a partner organisation the player has
// approved through "Sign in with AFC", AFC's OpenID Connect provider: the org gets
// to read a fixed, named set of the player's profile data until the player cuts it
// off here.
//
// WHY THIS PAGE EXISTS AT ALL: the consent screen the player approves
// (backend/afc_sso/templates/afc_sso/authorize.html) tells them "You can remove
// this at any time from Connected apps in your AFC profile". This client backs the
// page that makes that promise true.
//
// WHY a dedicated client (not an inline fetch): mirrors lib/deliveryProfiles.ts,
// the closest sibling. Base URL and the Bearer header live in one place, and the
// caller passes the session token explicitly (useAuth().token) rather than the
// helper reaching for a cookie.
//
// SOLE CALLER: app/(user)/profile/_components/ConnectedApps.tsx, rendered at
// /profile/connected-apps.
//
// AUTH NOTE, easy to get wrong: these endpoints sit under /sso/ but they do NOT
// use the cookie bridge that the OIDC authorize view relies on. They take the
// ordinary AFC session token as a Bearer header, exactly like every other
// player-facing endpoint.
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import { env } from "@/lib/env";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

// Every connected-apps path sits under /sso/me/ on the backend.
const url = (path: string) => `${BASE}/sso/me/${path}`;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// ── Row shape (mirrors the JSON built in afc_sso/api.py list_connected_apps) ────
export type ConnectedApp = {
  application_id: number;
  /** The org's display name, falling back to its registered name. */
  name: string;
  /** Empty string, not null, when the org has not supplied one. */
  logo_url: string;
  homepage_url: string;
  /**
   * Plain-language lines describing what this org can read, e.g. "Your Free Fire
   * UID". Produced by the backend from afc_sso.claims.describe_scopes, which is the
   * SAME source the consent screen reads, so what the player was promised and what
   * this page reports can never drift apart.
   */
  scopes: string[];
  /** Parallel to `scopes`: same length, same order. The raw OIDC scope codes. */
  scope_codes: string[];
  /** ISO strings, or null when unknown. */
  granted_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
};

type ListResponse = { apps: ConnectedApp[] };

export type RevokeResponse = {
  message: string;
  application_id: number;
  revoked: {
    access_tokens: number;
    refresh_tokens: number;
    grants: number;
    id_tokens: number;
  };
};

/** Every partner org this player currently has a live connection to, most recently used first. */
export async function listConnectedApps(token: string): Promise<ConnectedApp[]> {
  const res = await axios.get<ListResponse>(url("connected-apps/"), {
    headers: bearer(token),
  });
  return res.data?.apps ?? [];
}

/**
 * Cut an org off. The backend clears the access token, the refresh token, any
 * outstanding authorisation grant and the id token, so the org cannot quietly mint
 * itself a fresh session afterwards.
 *
 * Idempotent by design: revoking something already revoked returns 200 with zero
 * counts rather than an error, so a double tap on a phone cannot produce a scary
 * failure toast.
 */
export async function revokeConnectedApp(
  token: string,
  applicationId: number,
): Promise<RevokeResponse> {
  const res = await axios.delete<RevokeResponse>(
    url(`connected-apps/${applicationId}/`),
    { headers: bearer(token) },
  );
  return res.data;
}
