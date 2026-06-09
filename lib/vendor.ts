// ─────────────────────────────────────────────────────────────────────────────
// lib/vendor.ts
//
// Typed client for the MARKETPLACE FULFILMENT API (backend prefix /shop/fulfilment/,
// implemented in afc_shop/fulfilment.py). This is the data layer behind the AFC
// Vendor Portal (app/(vendor)/vendor/*): the vendor's fulfilment queue + the four
// lifecycle transitions a vendor drives an order through.
//
// WHY a dedicated client (and not inline fetch on every page): the portal layout's
// guard, the orders queue, and the per-order page all hit the SAME five endpoints.
// Centralising them here keeps the Bearer auth + base URL in one place and mirrors
// the repo's existing lib/organizers.ts idiom (axios + the BASE url + Bearer read
// from the same `auth_token` cookie AuthContext writes via js-cookie). Callers don't
// thread the token through props/hooks; errors surface as axios errors with
// `err.response.data.message`, handled with a toast at the call site like the rest
// of the app.
//
// THE LIFECYCLE (afc_shop/fulfilment.py state machine; only physical/vendor orders
// enter it, digital diamond orders never do):
//   received → acknowledged → ship_scheduled → shipped → completed
//
// CONSUMED BY:
//   - app/(vendor)/vendor/layout.tsx            → getMyOrders() as the VENDOR GATE
//     (200 ⇒ vendor, render the portal; 403 ⇒ "no vendor access" card).
//   - app/(vendor)/vendor/_components/VendorContext.tsx → owns the order list + refetch.
//   - app/(vendor)/vendor/orders/page.tsx       → the queue table.
//   - app/(vendor)/vendor/orders/[id]/page.tsx  → the per-order stepper + actions.
//
// BACKEND MODELS this rides on (afc_shop/models.py): Order (fulfilment_state /
// ship_date / acknowledged_at / shipped_at / completed_at), OrderItem (the line
// snapshots), Vendor (the permission edge: order → variant → product.vendor.user ==
// caller), FulfillmentEvidence (shipped-proof media stored by mark-shipped).
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import Cookies from "js-cookie";
import { env } from "@/lib/env";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

// Bearer header from the auth_token cookie (the cookie AuthContext writes on login),
// mirroring lib/organizers.ts::authHeaders so the whole app reads the token one way.
function authHeaders() {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token ?? ""}` };
}

const url = (path: string) => `${BASE}/shop/fulfilment/${path}`;

// ── Response/row shapes ────────────────────────────────────────────────────────
// These mirror vendor_my_orders' PII-firewalled payload in afc_shop/fulfilment.py
// EXACTLY (buyer NAME + delivery address + items + state only — never the buyer's
// email, phone, account id, payment refs, or money internals).

// The five lifecycle states the backend VALID_TRANSITIONS map allows. "cancelled"
// exists on the model but no transition wires it yet, so it is included for display
// completeness only.
export type FulfilmentState =
  | "received"
  | "acknowledged"
  | "ship_scheduled"
  | "shipped"
  | "completed"
  | "cancelled";

// One line on an order (OrderItem snapshot fields).
export interface VendorOrderItem {
  name: string; // product_name_snapshot
  variant: string; // variant_title_snapshot (may be "")
  quantity: number;
}

// One order row as returned by GET /shop/fulfilment/my-orders/.
export interface VendorOrder {
  order_id: number;
  fulfilment_state: FulfilmentState | null;
  ship_date: string | null; // "YYYY-MM-DD" once set, else null
  buyer_name: string;
  delivery: {
    address: string;
    city: string;
    state: string;
    postcode: string;
  };
  items: VendorOrderItem[];
  created_at: string; // ISO timestamp
}

// The my-orders envelope: { count, results } (count is the pagination metadata the
// backend returns so a future paginated dashboard has it).
export interface VendorOrdersResponse {
  count: number;
  results: VendorOrder[];
}

export const vendorApi = {
  // ── QUEUE / GATE ──────────────────────────────────────────────────────────
  // GET /shop/fulfilment/my-orders/ → the caller-vendor's PII-scoped orders.
  // Doubles as the VENDOR GATE: a 200 means the caller has a Vendor account
  // (render the portal); a 403 ({ message: "You are not a vendor." }) means they
  // don't (the layout shows a "no vendor access" card). The layout therefore lets
  // the 403 propagate so it can branch on err.response.status.
  getMyOrders: async (): Promise<VendorOrdersResponse> =>
    (await axios.get(url("my-orders/"), { headers: authHeaders() })).data,

  // ── TRANSITIONS (each POSTs { order_id }; the backend gates to THIS order's
  //    vendor and enforces the legal state jump, returning 400 on an illegal one) ──

  // received → acknowledged. POST /shop/fulfilment/acknowledge/.
  acknowledge: async (orderId: number) =>
    (
      await axios.post(
        url("acknowledge/"),
        { order_id: orderId },
        { headers: authHeaders() },
      )
    ).data,

  // acknowledged → ship_scheduled. POST /shop/fulfilment/set-ship-date/.
  // ship_date is a plain "YYYY-MM-DD" string (the backend stores it on a DateField).
  setShipDate: async (orderId: number, shipDate: string) =>
    (
      await axios.post(
        url("set-ship-date/"),
        { order_id: orderId, ship_date: shipDate },
        { headers: authHeaders() },
      )
    ).data,

  // ship_scheduled → shipped (MULTIPART). POST /shop/fulfilment/mark-shipped/.
  // Each uploaded photo/video is stored as a FulfillmentEvidence row server-side and
  // the buyer is emailed "on the way". We send the files under the "evidence" field
  // (the backend accepts files under ANY field name via request.FILES.items()); an
  // optional "note" rides along. We set NO explicit Content-Type so axios fills in
  // the multipart boundary itself — the same upload idiom as lib/organizers.ts and
  // teams/[id]/edit. Returns { evidence_saved, fulfilment_state }.
  markShipped: async (orderId: number, files: File[], note?: string) => {
    const form = new FormData();
    form.append("order_id", String(orderId));
    if (note) form.append("note", note);
    files.forEach((file) => form.append("evidence", file));
    return (await axios.post(url("mark-shipped/"), form, { headers: authHeaders() }))
      .data;
  },

  // shipped → completed. POST /shop/fulfilment/mark-completed/.
  markCompleted: async (orderId: number) =>
    (
      await axios.post(
        url("mark-completed/"),
        { order_id: orderId },
        { headers: authHeaders() },
      )
    ).data,
};
