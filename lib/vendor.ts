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

// ═════════════════════════════════════════════════════════════════════════════
// VENDOR PRODUCT CRUD  (backend prefix /shop/vendor/, afc_shop/vendors.py cluster C)
//
// The data layer behind the AFC Vendor Portal › PRODUCTS section
// (app/(vendor)/vendor/products/*) — the vendor's self-serve catalogue. A vendor
// manages ONLY their own products and can NEVER approve their own; the lifecycle is:
//
//   draft ──submit──▶ submitted ──(AFC admin)──▶ approved | rejected
//     ▲                                              │
//     └──────────── edit (draft/rejected only) ◀─────┘ (rejected re-submits)
//
// Only an APPROVED (+ active) product reaches the storefront (gate in
// views.view_active_products). A vendor can edit only draft/rejected products, and
// submit only draft/rejected → submitted. All four endpoints are gated to the
// CALLER's own ACTIVE Vendor (vendors._require_active_vendor) using the SAME Bearer
// auth as the fulfilment client above.
//
// CONSUMED BY:
//   - app/(vendor)/vendor/products/page.tsx                       → the product list.
//   - app/(vendor)/vendor/products/_components/ProductFormDialog.tsx → create/edit.
//
// BACKEND MODELS this rides on (afc_shop/models.py): Product (+ the Phase B1
// approval fields approval_status / submitted_at / approved_by / rejection_reason),
// ProductVariant (a product carries variants, each {sku, price, ...}), ProductMedia
// (the optional image gallery — the create form sends a single primary `image`,
// matching views.add_product). Vendor is the ownership edge (product.vendor == caller).
// ═════════════════════════════════════════════════════════════════════════════

// The four approval states a vendor product moves through (mirrors the backend
// Product.approval_status field set in afc_shop/vendors.py).
export type ApprovalStatus = "draft" | "submitted" | "approved" | "rejected";

// One variant of a vendor product, as returned by _serialize_vendor_product
// (afc_shop/vendors.py). price comes back as a string (DecimalField), so we keep it
// a string on read and coerce on write.
export interface VendorProductVariant {
  id: number;
  sku: string;
  title: string;
  price: string;
  diamonds_amount: number;
  stock_qty: number;
  is_active: boolean;
  in_stock: boolean;
}

// One product owned by the caller-vendor (the _serialize_vendor_product shape).
// Only the fields the vendor dashboard needs are typed here.
export interface VendorProduct {
  id: number;
  name: string;
  type: string; // product_type (category slug)
  description: string;
  status: string; // "active" | ... (live status; independent of approval)
  is_limited_stock: boolean;
  image: string | null; // absolute primary image url
  // ── Phase B1 approval fields ──
  approval_status: ApprovalStatus;
  submitted_at: string | null;
  rejection_reason: string; // "" unless rejected
  vendor_id: number | null;
  vendor_name: string | null;
  created_at: string;
  updated_at: string;
  variants: VendorProductVariant[];
}

// The vendor_my_products envelope: { count, products }.
export interface VendorProductsResponse {
  count: number;
  products: VendorProduct[];
}

// The variant fields the create/edit form submits (a subset of the read shape).
// price is sent as a string/number; the backend stores it on a DecimalField.
export interface VendorVariantInput {
  id?: number; // present on EDIT (in-place update keyed by id); absent on CREATE
  sku: string;
  title?: string;
  price: string | number;
  diamonds_amount?: number;
  stock_qty?: number;
  is_active?: boolean;
}

// The product fields the create form submits.
export interface VendorProductCreateInput {
  name: string;
  product_type: string; // category slug (required by vendor_create_product)
  description?: string;
  is_limited_stock?: boolean;
  variants: VendorVariantInput[]; // non-empty (backend rejects an empty list)
  image?: File | null; // optional primary image (multipart)
}

// The product fields the update form submits (product_id + any editable field).
export interface VendorProductUpdateInput {
  product_id: number;
  name?: string;
  product_type?: string;
  description?: string;
  is_limited_stock?: boolean;
  variants?: VendorVariantInput[]; // in-place variant edits keyed by id
  image?: File | null; // optional replacement primary image (multipart)
}

// vendor product endpoints live under /shop/vendor/ (NOT /shop/fulfilment/), so
// they get their own url() builder rather than reusing the fulfilment one above.
const productUrl = (path: string) => `${BASE}/shop/vendor/${path}`;

export const vendorProductApi = {
  // ── LIST ──────────────────────────────────────────────────────────────────
  // GET /shop/vendor/products/ → the caller-vendor's OWN products (every approval
  // state), each with its approval_status + rejection_reason + variants.
  getMyProducts: async (): Promise<VendorProductsResponse> =>
    (await axios.get(productUrl("products/"), { headers: authHeaders() })).data,

  // ── CREATE (MULTIPART) ──────────────────────────────────────────────────────
  // POST /shop/vendor/products/create/ → create a product owned by the caller's
  // vendor, starting approval_status="draft". variants[] rides along as a JSON
  // string (the backend _parse_variants accepts a JSON string in multipart) and the
  // optional primary `image` is a real file. We set NO explicit Content-Type so
  // axios fills the multipart boundary, matching the mark-shipped / admin upload idiom.
  // Returns { message, product_id, variant_ids }.
  createProduct: async (input: VendorProductCreateInput) => {
    const form = new FormData();
    form.append("name", input.name);
    form.append("product_type", input.product_type);
    form.append("description", input.description ?? "");
    form.append("is_limited_stock", String(input.is_limited_stock ?? false));
    form.append("variants", JSON.stringify(input.variants));
    if (input.image) form.append("image", input.image);
    return (
      await axios.post(productUrl("products/create/"), form, {
        headers: authHeaders(),
      })
    ).data;
  },

  // ── UPDATE (MULTIPART) ──────────────────────────────────────────────────────
  // POST /shop/vendor/products/update/ → edit ONE of the caller-vendor's OWN
  // draft/rejected products (the backend enforces ownership + state). Only the
  // fields present are changed; variants[] (keyed by id) are edited in place. An
  // optional `image` replaces the primary image. Returns { message }.
  updateProduct: async (input: VendorProductUpdateInput) => {
    const form = new FormData();
    form.append("product_id", String(input.product_id));
    if (input.name !== undefined) form.append("name", input.name);
    if (input.product_type !== undefined)
      form.append("product_type", input.product_type);
    if (input.description !== undefined)
      form.append("description", input.description);
    if (input.is_limited_stock !== undefined)
      form.append("is_limited_stock", String(input.is_limited_stock));
    if (input.variants !== undefined)
      form.append("variants", JSON.stringify(input.variants));
    if (input.image) form.append("image", input.image);
    return (
      await axios.post(productUrl("products/update/"), form, {
        headers: authHeaders(),
      })
    ).data;
  },

  // ── SUBMIT FOR APPROVAL ─────────────────────────────────────────────────────
  // POST /shop/vendor/products/submit/ → move a draft|rejected product to
  // "submitted" (into the AFC admin approval queue). A vendor can NEVER move it to
  // "approved". Returns { message, product_id, approval_status }.
  submitProduct: async (productId: number) =>
    (
      await axios.post(
        productUrl("products/submit/"),
        { product_id: productId },
        { headers: authHeaders() },
      )
    ).data,
};
