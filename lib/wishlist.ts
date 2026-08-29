// ─────────────────────────────────────────────────────────────────────────────
// lib/wishlist.ts
//
// Typed client for the SHOP WISHLIST ("save for later") API (backend prefix
// /shop/wishlist/, implemented in afc_shop). This is the data layer behind the
// storefront's save-toggle hearts and the "Saved Items" page:
//   - app/(user)/shop/_components/ShopClient.tsx        → heart toggle on each card
//   - app/(user)/shop/_components/ProductDetailPage.tsx → Save / Saved button
//   - app/(user)/shop/_components/WishlistClient.tsx    → the Saved Items list
//   - app/(user)/shop/saved/page.tsx                    → the saved-items route
//
// WHY a dedicated client (not inline fetch on each surface): all three wishlist
// surfaces hit the same /shop/wishlist/ endpoints, so centralising the base URL +
// Bearer header in one place mirrors the repo's existing client idiom
// (lib/marketplaceAdmin.ts). Unlike the admin clients (which read the auth_token
// cookie via authHeaders()), the shop surfaces already hold the live token from
// useAuth() and pass it as `Bearer ${token}` (see OrdersClient / ProductDetailPage),
// so these helpers take the token explicitly and build the same header, keeping the
// wishlist calls consistent with the rest of the shop.
//
// AUTH: every endpoint is per-user and needs a Bearer token (the signed-in user's
// own saved list). Anonymous callers have no token; the UI gates the heart for them.
//
// BACKEND CONTRACT (afc_shop wishlist endpoints - backend is DONE):
//   POST /shop/wishlist/toggle/  body {product_id} -> {saved, message} (201 added / 200 removed)
//   GET  /shop/wishlist/         -> {products: WishlistProduct[], count}
//   GET  /shop/wishlist/ids/     -> {product_ids: number[]}
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import { env } from "@/lib/env";
import { SessionExpiredError } from "@/lib/http";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

// Bearer auth header built from the live token the shop surfaces hold via
// useAuth().token (matches the `Bearer ${token}` idiom in OrdersClient /
// ProductDetailPage, rather than the cookie-reading authHeaders() the admin clients use).
//
// CORRECTION 2026-08-29: the old comment here claimed "the empty-string fallback keeps the header
// well-formed ... per-user endpoints will simply 401 in that case". That was WRONG, and it is the
// belief behind a real bug. `Bearer ${""}` is the string "Bearer ", axios trims the trailing space
// to "Bearer", and the backend gate is `startswith("Bearer ")` WITH the space. So it did not 401 as
// "expired"; it 400'd as "Invalid or missing Authorization token.", and AuthContext's interceptor
// (which acts on 401 WITH a token) never fired, leaving the user visibly signed in beside an action
// that could never succeed.
//
// Now a missing token raises the same session-expired flow the rest of the app uses, before any
// request goes out. See lib/http.ts SessionExpiredError.
const tokenHeaders = (token: string | null | undefined) => {
  if (!token) throw new SessionExpiredError();
  return { Authorization: `Bearer ${token}` };
};

// One saved product row from GET /shop/wishlist/ (the Saved Items list card). This is a
// LIGHT product shape (just enough to render a card + link to the full product), distinct
// from the full Product on ShopClient / ProductDetailPage. starting_price is a decimal
// STRING server-side (same convention as prices everywhere else), formatted at the render
// site via Intl.NumberFormat "en-NG".
export interface WishlistProduct {
  id: number;
  name: string;
  image: string | null;
  category: string | null;
  status: string;
  starting_price: string;
  in_stock: boolean;
}

// POST /shop/wishlist/toggle/ - add or remove a product from the signed-in user's saved
// list. Idempotent per state: returns { saved: true } (201, just added) or { saved: false }
// (200, just removed) plus a server message. Called by the heart toggle on ShopClient cards,
// the Save / Saved button on ProductDetailPage, and the Remove button on WishlistClient.
export async function toggleWishlist(
  productId: number,
  token: string | null | undefined,
): Promise<{ saved: boolean; message: string }> {
  const res = await axios.post(
    `${BASE}/shop/wishlist/toggle/`,
    { product_id: productId },
    { headers: tokenHeaders(token) },
  );
  return res.data;
}

// GET /shop/wishlist/ - the full saved-items list (product cards + a count). Consumed by
// WishlistClient on the /shop/saved page.
export async function getMyWishlist(
  token: string | null | undefined,
): Promise<{ products: WishlistProduct[]; count: number }> {
  const res = await axios.get(`${BASE}/shop/wishlist/`, {
    headers: tokenHeaders(token),
  });
  return res.data;
}

// GET /shop/wishlist/ids/ - just the saved product ids (no product payload). Cheap lookup
// used to seed the "which cards are already saved" Set on ShopClient and the saved state on
// ProductDetailPage, so each heart renders filled / outline correctly on mount.
export async function getMyWishlistIds(
  token: string | null | undefined,
): Promise<{ product_ids: number[] }> {
  const res = await axios.get(`${BASE}/shop/wishlist/ids/`, {
    headers: tokenHeaders(token),
  });
  return res.data;
}
