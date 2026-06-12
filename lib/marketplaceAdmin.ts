// ─────────────────────────────────────────────────────────────────────────────
// lib/marketplaceAdmin.ts
//
// Typed client for the MARKETPLACE ADMIN API (backend prefix /shop/admin/,
// implemented in afc_shop/vendors.py clusters A + B and the Phase B3 payout rails
// afc_shop/connect.py + afc_shop/paystack_payout.py). This is the data layer behind
// the AFC admin marketplace surfaces:
//   - app/(a)/a/shop/vendors/page.tsx    → "Manage vendors"  (cluster A)
//   - app/(a)/a/shop/approvals/page.tsx  → "Product approvals" (cluster B)
//   - app/(a)/a/shop/payouts/page.tsx    → "Vendor payouts"  (the B3 ledger)
//
// WHY a dedicated client (not inline fetch on each page): both admin pages hit the
// same /shop/admin/ cluster, so centralising the Bearer auth + base URL in one place
// mirrors the repo's existing admin-client idiom (lib/partners.ts, lib/organizers.ts:
// axios + the BASE url + Bearer read from the same `auth_token` cookie AuthContext
// writes via js-cookie). Callers don't thread the token through props/hooks; errors
// surface as axios errors with `err.response.data.message`, handled with a toast at
// the call site like the rest of the app.
//
// AUTH: every endpoint below is require_admin server-side (role == "admin"). The
// vendor CRUD endpoints (cluster C, /shop/vendor/*) belong to the SEPARATE vendor
// portal and live in lib/vendor.ts — they are intentionally NOT in this admin client.
//
// VENDORS ARE INVITE-ONLY: there is no public "Sell on AFC" application. An admin
// links an EXISTING User to a new Vendor (admin_create_vendor), so createVendor takes
// a user_id OR email of an already-registered login.
//
// BACKEND MODELS this rides on (afc_shop/models.py + vendors.py serialisers):
//   - Vendor       → _serialize_vendor   (the "Manage vendors" row)
//   - Product (+ the Phase B1 approval fields approval_status / submitted_at /
//     rejection_reason / vendor) → _serialize_vendor_product (the approval-queue row)
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import Cookies from "js-cookie";
import { env } from "@/lib/env";

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

// Bearer header from the auth_token cookie (the cookie AuthContext writes on login),
// mirroring lib/partners.ts::authHeaders so the whole app reads the token one way.
function authHeaders() {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token ?? ""}` };
}

// Every admin marketplace path sits under /shop/admin/ on the backend.
const url = (path: string) => `${BASE}/shop/admin/${path}`;

async function aGet<T = any>(path: string): Promise<T> {
  return (await axios.get(url(path), { headers: authHeaders() })).data;
}
async function aPost<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.post(url(path), body ?? {}, { headers: authHeaders() })).data;
}

// ── Response / row shapes (mirror afc_shop/vendors.py serialisers EXACTLY) ──────

// A vendor's lifecycle status. The admin flips between these two via setVendorStatus;
// the backend only accepts "active" | "suspended".
export type VendorStatus = "active" | "suspended";

// One row from GET /shop/admin/vendors/list/ (_serialize_vendor). Carries the linked
// login (user_id + username) so the admin can see WHO the vendor signs in as, plus a
// live product_count for context before suspending.
export interface AdminVendor {
  id: number;
  display_name: string;
  contact_email: string;
  whatsapp_number: string;
  status: VendorStatus;
  user_id: number | null;
  username: string | null;
  stripe_account_id: string | null;
  product_count: number;
  created_at: string; // ISO timestamp
}

// One variant on a pending product (subset of _serialize_vendor_product variants).
// price is a decimal STRING server-side (matches view_all_products), so we keep it a
// string and parse at the render site.
export interface PendingProductVariant {
  id: number;
  sku: string;
  title: string;
  price: string;
  diamonds_amount: number;
  stock_qty: number;
  is_active: boolean;
  in_stock: boolean;
}

// One media item in a pending product's gallery (mirrors _serialize_media in
// afc_shop/views.py, which both the storefront ProductDetailPage and the admin
// approval-detail modal consume). `ordering` controls display order (the primary
// image is ordering 0); `media_type` chooses an <img> vs a <video> at the render
// site. `url` is the absolute media URL, or null if the file is missing.
export interface PendingProductMedia {
  id: number;
  url: string | null;
  media_type: "image" | "video";
  ordering: number;
}

// The structured category attached to a pending product (mirrors _serialize_category
// in afc_shop/views.py). It is null for legacy diamond rows that predate categories,
// in which case the UI falls back to the product `type`. Consumed by the approval
// detail modal to show the category label.
export interface PendingProductCategory {
  id: number;
  name: string;
  slug: string;
  is_physical: boolean;
  is_active: boolean;
}

// One row from GET /shop/admin/products/pending/ (_serialize_vendor_product). These
// are products a vendor SUBMITTED (approval_status == "submitted"). The queue table
// renders a summary (name, vendor, price via variants, submitted_at), while the
// approval DETAIL MODAL (approvals/page.tsx) renders the rest: the full `media`
// gallery, `category`, `description`, and every `variant`. All of these come from the
// SAME serialiser, so no extra fetch is needed to open a product.
export interface PendingProduct {
  id: number;
  name: string;
  type: string;
  // Structured category object, or null for legacy rows (fall back to `type`).
  category: PendingProductCategory | null;
  description: string;
  status: string;
  // The single primary image (ordering 0). `media` is the full gallery below; this
  // stays as the fallback when `media` is empty.
  image: string | null;
  // Full media gallery (images + videos) the detail modal renders, ordered by
  // `ordering`. May be empty for older products that only have `image`.
  media: PendingProductMedia[];
  approval_status: string;
  submitted_at: string | null;
  // BUGFIX (2026-06-10): the approval audit trail. approved_at is WHEN an admin approved
  // the product; approved_by is the approver's username (null until first approved). The
  // approvals page shows both on the Approved tab so an admin can see a product WAS
  // accepted and by whom (the backend serialiser previously omitted approved_by).
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string;
  vendor_id: number | null;
  vendor_name: string | null;
  created_at: string;
  updated_at: string;
  variants: PendingProductVariant[];
}

// The status filter the approvals page passes to listPendingProducts. Mirrors the
// backend ?status= contract (admin_list_pending_products): submitted is the default
// pending queue; approved/rejected show decided products; all = every state.
export type ProductApprovalStatus = "submitted" | "approved" | "rejected" | "all";

// The create-vendor body. INVITE-ONLY: provide the user_id (preferred) OR the email
// of an EXISTING user to link; display_name is the required shop-facing seller name.
export interface CreateVendorBody {
  user_id?: number | string;
  email?: string;
  display_name: string;
  contact_email?: string;
  whatsapp_number?: string;
}

// ── Payouts (Phase B3) row shapes: mirror connect.admin_list_vendor_payouts ────

// A payout row's lifecycle (VendorPayout.STATUS in afc_shop/models.py):
//   owed     -> AFC owes the vendor; no transfer landed yet (vendor not onboarded /
//               bank not saved, or a transfer attempt failed). Releasable.
//   released -> transient seam between owed and paid (treated like owed by the
//               backend release/retry endpoints).
//   paid     -> the transfer succeeded; stripe_transfer_id holds the reference. Final.
export type PayoutStatus = "owed" | "released" | "paid";

// Which rail settles the row (Vendor.payout_provider): Paystack Transfers is the
// PRIMARY rail (African vendors, local banks); Stripe Connect is the fallback for
// vendors Stripe can actually reach. Decides which release endpoint applies.
export type PayoutProvider = "paystack" | "stripe";

// One row from GET /shop/admin/payouts/ (connect.admin_list_vendor_payouts). Both
// rails write the SAME VendorPayout table, so this one shape covers Paystack and
// Stripe rows alike. amount/platform_fee are decimal STRINGS server-side (same
// convention as prices everywhere else); stripe_transfer_id is the SHARED transfer
// reference column (a Stripe tr_... id OR a Paystack TRF_... code), blank while owed.
export interface AdminVendorPayout {
  id: number;
  vendor_id: number;
  vendor_name: string;
  provider: PayoutProvider;
  order_id: number;
  amount: string;
  platform_fee: string;
  status: PayoutStatus;
  stripe_transfer_id: string;
  paid_at: string | null; // ISO timestamp, null while owed
  created_at: string; // ISO timestamp
}

// The escrow-style totals block on the same response (for the ledger header cards).
export interface PayoutSummary {
  owed_count: number;
  owed_amount: string;
  paid_count: number;
  paid_amount: string;
}

// The release/retry endpoints share one response shape: how many flipped to paid,
// how many are still owed, plus a per-payout result trail (id + status + note/detail).
export interface ReleasePayoutsResult {
  released: number;
  still_owed: number;
  results: Array<{
    payout_id: number;
    status: PayoutStatus;
    note?: string;
    detail?: string;
    stripe_transfer_id?: string;
    transfer_code?: string;
  }>;
}

export const marketplaceAdminApi = {
  // ── A) VENDOR MANAGEMENT (require_admin) ──────────────────────────────────

  // POST /shop/admin/vendors/create/ — link an EXISTING user (by user_id|email) to a
  // new active Vendor. Returns 201 { message, vendor }. Consumed by the "Add vendor"
  // dialog on the Manage vendors page.
  createVendor: (body: CreateVendorBody) =>
    aPost<{ message: string; vendor: AdminVendor }>("vendors/create/", body),

  // GET /shop/admin/vendors/list/ — every vendor (the Manage vendors table).
  // Returns { count, vendors }.
  listVendors: () =>
    aGet<{ count: number; vendors: AdminVendor[] }>("vendors/list/"),

  // POST /shop/admin/vendors/set-status/ — flip a vendor active <-> suspended (the
  // suspend/reactivate toggle). A suspended vendor is blocked from every vendor action
  // server-side. Returns { message, vendor }.
  setVendorStatus: (vendorId: number, status: VendorStatus) =>
    aPost<{ message: string; vendor: AdminVendor }>("vendors/set-status/", {
      vendor_id: vendorId,
      status,
    }),

  // POST /shop/admin/vendors/assign-product/ — set (vendorId) or clear (null) which
  // vendor owns a product. Used by the "assign product to vendor" action. Returns
  // { message, product_id, vendor_id }.
  assignProduct: (productId: number, vendorId: number | null) =>
    aPost<{ message: string; product_id: number; vendor_id: number | null }>(
      "vendors/assign-product/",
      { product_id: productId, vendor_id: vendorId },
    ),

  // ── B) PRODUCT APPROVAL (require_admin) ───────────────────────────────────

  // GET /shop/admin/products/pending/ - vendor products by approval state. With no
  // argument it returns the pending queue (approval_status == "submitted", back-compat);
  // pass a status to fetch approved / rejected / all instead. BUGFIX (2026-06-10): the
  // Approved/Rejected tabs on the approvals page use this so an approved product (and its
  // approver) is visible, not lost the moment it leaves the queue. Returns { count,
  // status, products }.
  listPendingProducts: (status?: ProductApprovalStatus) =>
    aGet<{ count: number; status: string; products: PendingProduct[] }>(
      status ? `products/pending/?status=${status}` : "products/pending/",
    ),

  // POST /shop/admin/products/approve/ — submitted -> approved (the Approve button).
  // Returns { message, product_id, approval_status }.
  approveProduct: (productId: number) =>
    aPost<{ message: string; product_id: number; approval_status: string }>(
      "products/approve/",
      { product_id: productId },
    ),

  // POST /shop/admin/products/reject/ — submitted -> rejected WITH a reason (shown
  // back to the vendor). reason is required server-side. Returns { message,
  // product_id, approval_status }.
  rejectProduct: (productId: number, reason: string) =>
    aPost<{ message: string; product_id: number; approval_status: string }>(
      "products/reject/",
      { product_id: productId, reason },
    ),

  // ── C) VENDOR PAYOUTS LEDGER (require_admin, Phase B3) ─────────────────────

  // GET /shop/admin/payouts/ - every VendorPayout row (both rails: Paystack +
  // Stripe write the one table) plus the owed/paid summary totals. Consumed by the
  // payouts ledger table on /a/shop/payouts. Returns { count, currency, payouts,
  // summary }.
  listPayouts: () =>
    aGet<{
      count: number;
      currency: string;
      payouts: AdminVendorPayout[];
      summary: PayoutSummary;
    }>("payouts/"),

  // POST /shop/admin/payouts/release/ - (re)attempt the STRIPE transfer for a
  // vendor's owed payouts (connect.admin_release_owed_payouts). Pass the vendor_id;
  // the backend releases every owed/released row of that vendor (a vendor without a
  // stripe_account_id stays owed, reported in still_owed). The "Release owed
  // (Stripe)" button calls this once per vendor that has owed Stripe rows.
  releaseOwedStripe: (vendorId: number) =>
    aPost<ReleasePayoutsResult>("payouts/release/", { vendor_id: vendorId }),

  // POST /shop/admin/payouts/retry-paystack/ - the Paystack twin
  // (paystack_payout.admin_retry_owed_paystack_payouts): (re)attempt the PAYSTACK
  // transfer for a vendor's owed payouts once they have saved their bank. The
  // "Retry owed (Paystack)" button calls this once per vendor with owed Paystack rows.
  retryOwedPaystack: (vendorId: number) =>
    aPost<ReleasePayoutsResult>("payouts/retry-paystack/", { vendor_id: vendorId }),
};
