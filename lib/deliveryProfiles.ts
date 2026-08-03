// ─────────────────────────────────────────────────────────────────────────────
// lib/deliveryProfiles.ts
//
// Typed client for the SAVED DELIVERY INFO API (backend prefix /shop/, the
// delivery-profile endpoints in afc_shop). A "delivery profile" is a reusable set
// of shipping details (name, email, phone, address) a logged-in buyer saves so they
// do not retype it at every checkout.
//
// WHY a dedicated client (not inline fetch on each page): the same five endpoints
// are consumed from TWO surfaces, so centralising the base URL + Bearer auth in one
// place mirrors the repo's existing lib-client idiom (lib/marketplaceAdmin.ts:
// axios + a BASE/url(path) prefix + a Bearer header). The two callers are:
//   - app/(user)/shop/_components/CartDetails.tsx  → the checkout "saved address"
//     picker + the "save my info for next time" toggle (list + create on order).
//   - app/(user)/profile/_components/SavedAddresses.tsx → the manage page
//     (/profile/addresses): list, create, update, delete, set-default.
//
// AUTH: every endpoint is per-user and authenticated. Unlike the admin client
// (which reads the cookie via authHeaders()), these helpers take the SESSION TOKEN
// explicitly so callers can pass useAuth().token directly - the same Bearer style
// CartDetails already uses for /shop/buy-now/. The token threads through because the
// checkout flow and the profile page both already hold it from AuthContext.
//
// BACKEND SHAPE this rides on (afc_shop delivery-profile serialiser):
//   - DeliveryProfile → one saved address row (default first in the list response).
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import { env } from "@/lib/env";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

// Every delivery-profile path sits under /shop/ on the backend.
const url = (path: string) => `${BASE}/shop/${path}`;

// Bearer header from the caller-supplied session token (useAuth().token). Mirrors
// the inline `Authorization: Bearer ${token}` CartDetails uses for /shop/buy-now/.
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// ── Row + payload shapes (mirror the afc_shop delivery-profile serialiser) ──────

// One saved address. Returned by the list endpoint (default first) and echoed by
// create/update. `postcode` and `label` may be blank strings server-side.
export interface DeliveryProfile {
  id: number;
  label: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  is_default: boolean;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

// The create body. The required identity + address fields, plus the optional
// postcode/label and an is_default flag (mark this new address as the default).
export interface DeliveryProfilePayload {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  address: string;
  city: string;
  state: string;
  postcode?: string;
  label?: string;
  is_default?: boolean;
}

// The update body: a profile_id plus any subset of the editable fields.
export interface UpdateDeliveryProfilePayload extends Partial<DeliveryProfilePayload> {
  profile_id: number;
}

// GET /shop/delivery-profiles/ - every saved address for the logged-in user, default
// first. Returns the bare array (the endpoint wraps it as { profiles }).
export async function listDeliveryProfiles(
  token: string,
): Promise<DeliveryProfile[]> {
  const res = await axios.get<{ profiles: DeliveryProfile[] }>(
    url("delivery-profiles/"),
    { headers: bearer(token) },
  );
  return res.data.profiles ?? [];
}

// POST /shop/delivery-profiles/create/ - save a new address. Returns the created row.
export async function createDeliveryProfile(
  payload: DeliveryProfilePayload,
  token: string,
): Promise<DeliveryProfile> {
  const res = await axios.post<{ profile: DeliveryProfile }>(
    url("delivery-profiles/create/"),
    payload,
    { headers: bearer(token) },
  );
  return res.data.profile;
}

// POST /shop/delivery-profiles/update/ - edit an existing address (by profile_id).
// Returns the updated row.
export async function updateDeliveryProfile(
  payload: UpdateDeliveryProfilePayload,
  token: string,
): Promise<DeliveryProfile> {
  const res = await axios.post<{ profile: DeliveryProfile }>(
    url("delivery-profiles/update/"),
    payload,
    { headers: bearer(token) },
  );
  return res.data.profile;
}

// POST /shop/delivery-profiles/delete/ - remove a saved address (by profile_id).
export async function deleteDeliveryProfile(
  id: number,
  token: string,
): Promise<{ message: string }> {
  const res = await axios.post<{ message: string }>(
    url("delivery-profiles/delete/"),
    { profile_id: id },
    { headers: bearer(token) },
  );
  return res.data;
}

// POST /shop/delivery-profiles/set-default/ - make a saved address the default (the
// one preselected at checkout).
export async function setDefaultDeliveryProfile(
  id: number,
  token: string,
): Promise<{ message: string }> {
  const res = await axios.post<{ message: string }>(
    url("delivery-profiles/set-default/"),
    { profile_id: id },
    { headers: bearer(token) },
  );
  return res.data;
}
