import axios from "axios";
import Cookies from "js-cookie";
import { env } from "@/lib/env";

/**
 * Typed client for the paid-event registration + admin escrow API (all routes under
 * /events/). Phase 1 uses Stripe Checkout: the user is sent to a hosted checkout_url,
 * pays, and is redirected back to our success page which verifies the payment and then
 * completes the EXISTING register-for-event call.
 *
 * Mirrors lib/api/ocr.ts / lib/rankingsAdmin.ts (axios + the BASE url + Bearer-from-cookie
 * auth): every call carries the Bearer token read from the same `auth_token` cookie that
 * AuthContext sets (js-cookie), so callers don't have to thread it through props/hooks.
 *
 * Who consumes this client (end-to-end trace):
 *   USER FLOW
 *   - app/(user)/tournaments/[slug]/_components/EventDetailsWrapper.tsx
 *       calls initRegistrationPayment(...) at the point a PAID event would normally
 *       register, saves the register-for-event payload to localStorage, then redirects
 *       the browser to checkout_url (window.location.href).
 *   - app/(user)/tournaments/[slug]/register/success/page.tsx
 *       reads ?session_id / ?payment_id off the Stripe return URL, calls
 *       verifyRegistrationPayment(...) (polled until "paid"), then replays the saved
 *       payload through the existing /events/register-for-event/ endpoint to finish
 *       registration.
 *   ADMIN FLOW (staff-gated, app/(a)/a pages - see ProtectedRoute adminOnly in (a)/a/layout)
 *   - app/(a)/a/events/payments/page.tsx
 *       calls adminListEventPayments(...) to fill the escrow table, and
 *       adminReleasePayment / adminRefundPayment on the per-row Release / Refund actions.
 *
 * Related backend contract (afc_tournament_and_scrims, prefix /events/):
 *   - POST init-registration-payment/   {event_id, team_id?} -> {payment_id, checkout_url, session_id}
 *       (409 already registered; 402-ish messages; 200 {already_paid:true, payment_id})
 *   - POST verify-registration-payment/ {session_id?, payment_id?} -> {status}
 *   - POST register-for-event/          the EXISTING register endpoint (402 {code:"payment_required"}
 *                                       for a paid event until paid) - called directly in
 *                                       EventDetailsWrapper / the success page, NOT through this client.
 *   - GET  admin/event-payments/?event_id=        -> {payments:[...], summary:{...}}
 *   - POST admin/event-payments/release/  {payment_id}
 *   - POST admin/event-payments/refund/   {payment_id}
 *
 * Errors surface as axios errors with `err.response.data.message` (and, on init, an
 * optional `code` like "payment_required") - handle them with a toast at the call site,
 * exactly like the rest of the app.
 */

const BASE = env.NEXT_PUBLIC_BACKEND_API_URL;

// Bearer header from the auth_token cookie (the cookie AuthContext writes on login).
function authHeaders() {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token ?? ""}` };
}

// All endpoints sit under the /events/ prefix.
const url = (path: string) => `${BASE}/events/${path}`;

async function aGet<T = any>(
  path: string,
  params?: Record<string, any>,
): Promise<T> {
  return (await axios.get(url(path), { params, headers: authHeaders() })).data;
}
async function aPost<T = any>(path: string, body?: any): Promise<T> {
  return (await axios.post(url(path), body ?? {}, { headers: authHeaders() }))
    .data;
}

// ── Types ──────────────────────────────────────────────────────────────────────
// These mirror the JSON the backend hands back (see the contract block above).

/** Response of POST init-registration-payment/. */
export interface InitRegistrationPaymentResponse {
  // The AFC-side EventRegistrationPayment id. Used as the localStorage key suffix
  // (afc_evt_reg_<payment_id>) and passed back to verify-registration-payment/.
  payment_id: string | number;
  // Stripe-hosted Checkout URL to send the browser to. Present on a fresh init.
  checkout_url?: string;
  // Stripe Checkout Session id, echoed back on the success URL as ?session_id=.
  session_id?: string;
  // Set when the user has ALREADY paid for this event (no checkout needed) - the
  // caller skips straight to completing registration with this payment_id.
  already_paid?: boolean;
}

/** Response of POST verify-registration-payment/. */
export interface VerifyRegistrationPaymentResponse {
  // Stripe-derived payment state. "paid" means we can complete registration.
  status: "paid" | "unpaid" | "pending" | "processing" | "failed" | string;
  // Echoed back so the success page can locate the saved localStorage payload even
  // when only session_id was on the URL.
  payment_id?: string | number;
}

/** One row in the admin escrow table (GET admin/event-payments/). */
export interface AdminEventPayment {
  payment_id: string | number;
  event_id: number;
  event_name: string;
  // The paying user (display label - username/email, backend-decided).
  user: string;
  // The team the payment registered, or null for a solo registration.
  team: string | null;
  amount: number;
  currency: string;
  // Stripe payment status (e.g. "paid", "unpaid", "refunded").
  status: string;
  // AFC escrow state: funds are HELD until staff Release (to organizer) or Refund.
  release_status: "held" | "released" | "refunded" | string;
  paid_at: string | null;
  created_at: string;
}

/** Summary block returned alongside the payments list. */
export interface AdminEventPaymentsSummary {
  held_count: number;
  total_payments: number;
}

/** Full response of GET admin/event-payments/. */
export interface AdminEventPaymentsResponse {
  payments: AdminEventPayment[];
  summary: AdminEventPaymentsSummary;
}

export const eventPaymentsApi = {
  // ── User: start + verify a registration payment ───────────────────────────
  /**
   * POST /events/init-registration-payment/ ({event_id, team_id?}).
   * Creates (or re-finds) the registration payment and returns the Stripe checkout_url
   * + session_id, OR {already_paid:true, payment_id} when the user already paid.
   * Consumed by EventDetailsWrapper.tsx right before it would call register-for-event.
   */
  initRegistrationPayment: (body: { event_id: number; team_id?: number | string }) =>
    aPost<InitRegistrationPaymentResponse>("init-registration-payment/", body),

  /**
   * POST /events/verify-registration-payment/ ({session_id?, payment_id?}).
   * Returns the current {status} of the payment. Consumed (polled) by the success page
   * until status === "paid", at which point it completes the registration.
   */
  verifyRegistrationPayment: (body: {
    session_id?: string;
    payment_id?: string | number;
  }) =>
    aPost<VerifyRegistrationPaymentResponse>(
      "verify-registration-payment/",
      body,
    ),

  // ── Admin escrow (staff only - gated by (a)/a layout's ProtectedRoute) ─────
  /**
   * GET /events/admin/event-payments/?event_id= (event_id optional → all events).
   * Lists event payments + the held/total summary. Consumed by the escrow dashboard
   * at app/(a)/a/events/payments/page.tsx.
   */
  adminListEventPayments: (params?: { event_id?: number | string }) =>
    aGet<AdminEventPaymentsResponse>("admin/event-payments/", params),

  /**
   * POST /events/admin/event-payments/release/ ({payment_id}).
   * Releases a held payment to the organizer. Consumed by the escrow dashboard's
   * per-row "Release" action (confirm-gated).
   */
  adminReleasePayment: (paymentId: string | number) =>
    aPost<{ message?: string }>("admin/event-payments/release/", {
      payment_id: paymentId,
    }),

  /**
   * POST /events/admin/event-payments/refund/ ({payment_id}).
   * Refunds a held payment back to the user. Consumed by the escrow dashboard's
   * per-row "Refund" action (confirm-gated).
   */
  adminRefundPayment: (paymentId: string | number) =>
    aPost<{ message?: string }>("admin/event-payments/refund/", {
      payment_id: paymentId,
    }),
};
