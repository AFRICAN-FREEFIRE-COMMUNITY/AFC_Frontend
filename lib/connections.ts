// ─────────────────────────────────────────────────────────────────────────────
// lib/connections.ts
//
// Typed client for CONNECTED ACCOUNTS (backend prefix /auth/connections/, views in
// backend/afc_auth/connections/views.py). A "connection" here is an OUTSIDE account
// the player has linked to their AFC account: Discord, Google, v-ent.co.
//
// NOT TO BE CONFUSED WITH lib/connectedApps.ts, which is the opposite direction:
// partner organisations that use "Sign in with AFC" and can read AFC profile data.
// Both are rendered on the same page, in two sections.
//
// WHY a dedicated client rather than inline fetch: mirrors lib/connectedApps.ts, its
// closest sibling. Base URL and the Bearer header live in one place, and the caller
// passes the session token explicitly (useAuth().token).
//
// CALLERS: app/(user)/profile/_components/ConnectedAccounts.tsx (the player's page)
// and components/events/RequiredConnectionsPicker.tsx (listProviders only).
//
// AUTH NOTE: these sit under /auth/ and take the ordinary AFC session token as a
// Bearer header. They deliberately do NOT live under /sso/, where a cookie bridge
// would make DRF CSRF-refuse the DELETE.
// ─────────────────────────────────────────────────────────────────────────────
import axios from "axios";

import { env } from "@/lib/env";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

const url = (path: string) => `${BASE}/auth/connections/${path}`;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** One row per ENABLED provider, connected or not. Mirrors links.serialize_for(). */
export type Connection = {
  /** Registry slug: "discord" | "google" | "vent". Also the i18n key suffix. */
  provider: string;
  /** English label from the backend registry, used only as a fallback for an unknown slug. */
  label: string;
  /** "oauth2" needs a redirect. "id_token" (Google) links in place. */
  kind: "oauth2" | "id_token";
  connected: boolean;
  username: string;
  avatar_url: string;
  /** ISO string, or null. Render through <LocalTime>, never with toLocale*. */
  connected_at: string | null;
  /**
   * False when removing this link would leave the player no way to sign in (no usable
   * password and no other provider). The button is then disabled WITH A REASON rather
   * than failing on tap. The backend enforces the same rule and answers 409
   * "last_credential", so a hand-made request cannot get past it either.
   */
  can_disconnect: boolean;
};

/** One provider an organizer may require. Same list the profile page offers to connect. */
export type ConnectionProvider = {
  slug: string;
  label: string;
  kind: "oauth2" | "id_token";
};

type ListResponse = { connections: Connection[] };

/** Every enabled provider, with this player's link if there is one. */
export async function listConnections(token: string): Promise<Connection[]> {
  const res = await axios.get<ListResponse>(url(""), { headers: bearer(token) });
  return res.data?.connections ?? [];
}

/**
 * Every provider configured on this deployment. Read by the event-form picker so an
 * organizer can never require something no player is able to connect: a provider with
 * no credentials set is absent here AND absent from the profile page, by construction.
 */
export async function listProviders(token: string): Promise<ConnectionProvider[]> {
  const res = await axios.get<{ providers: ConnectionProvider[] }>(url("providers/"), {
    headers: bearer(token),
  });
  return res.data?.providers ?? [];
}

/**
 * Ask the backend where to send the player to link this provider, then the caller
 * navigates there.
 *
 * WHY TWO STEPS rather than pointing a link straight at the backend: the endpoint
 * authenticates on an Authorization header, and a browser navigation cannot send one.
 * The obvious workaround, putting the session token in the URL, is exactly the defect
 * this whole feature removes: the old Discord flow did that and the token ended up in
 * discord.com's logs, in browser history and in Referer headers. So the token stays in
 * a header here, and only the provider's own consent URL is navigated to.
 */
export async function startConnection(
  token: string,
  provider: string,
  returnTo: string,
): Promise<string> {
  const res = await axios.get<{ authorize_url: string }>(
    `${url(`${provider}/start/`)}?return_to=${encodeURIComponent(returnTo)}`,
    { headers: bearer(token) },
  );
  return res.data.authorize_url;
}

/** Link Google from an ID token the Google button already produced. No redirect. */
export async function linkGoogle(token: string, credential: string): Promise<Connection[]> {
  const res = await axios.post<ListResponse>(
    url("google/"),
    { credential },
    { headers: bearer(token) },
  );
  return res.data?.connections ?? [];
}

/**
 * Cut an outside account off. Idempotent: disconnecting something already gone is a 200,
 * so a double tap cannot produce a scary failure toast. Throws with response.status 409
 * and data.code "last_credential" when this is the player's only way to sign in.
 */
export async function disconnectProvider(
  token: string,
  provider: string,
): Promise<Connection[]> {
  const res = await axios.delete<ListResponse>(url(`${provider}/`), {
    headers: bearer(token),
  });
  return res.data?.connections ?? [];
}
