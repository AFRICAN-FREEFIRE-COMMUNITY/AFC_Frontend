// lib/referrals.ts
// ─────────────────────────────────────────────────────────────────────────────
// REFERRAL PROGRAMS client (inbox #47, owner 2026-09-26; mockup approved the same day as
// mockups/referrals/referrals-mockup.html).
//
// How a referral travels:
//   1. a visitor opens /r/<code> (app/r/[code]) -> recordClick() -> the code and click token are
//      kept in the `afc_ref` cookie for 30 days (savePendingReferral)
//   2. they sign up (the code shows, editable, on the sign-up form) by email, Google or Discord
//   3. on their FIRST signed-in page, components/referrals/ReferralClaimer.tsx calls
//      claimPendingReferral(): POST referrals/claim/. The server decides everything (is the account
//      new, is the code valid, is it their own); the cookie is dropped once there is an answer.
//
// Backend: afc_referrals/views.py (prefix referrals/). Admin calls are head admin only there.
// Callers: app/r/[code], app/(auth)/_components/CreateAccountForm.tsx, components/referrals/*,
// app/(a)/a/referrals/*.
// ─────────────────────────────────────────────────────────────────────────────
import axios from "axios";
import Cookies from "js-cookie";
import { env } from "@/lib/env";
import { authHeaders, optionalAuthHeaders } from "@/lib/http";

const BASE = `${env.NEXT_PUBLIC_BACKEND_API_URL}/referrals`;
const COOKIE = "afc_ref";
const COOKIE_DAYS = 30;

// The day referrals went live: every NEW tag for the feature expires 5 days after it (lib/newBadge.ts).
export const REFERRALS_LAUNCH_DATE = "2026-09-26";

// Fired on window when a waiting referral has just been claimed. The claim and the profile's
// Referrals tab load at the same moment on a new player's first page, so the tab listens for this and
// reloads rather than showing numbers from before the claim (seen on the walk, 26 Sep 2026).
export const REFERRAL_CLAIMED_EVENT = "afc:referral-claimed";

export type CountRule = "signup" | "team" | "event" | "purchase";
export type Scope = "everyone" | "countries" | "teams" | "users";
export type PrizeKind = "milestone" | "rank" | "welcome";
export type PrizeType = "shop_item" | "diamonds" | "coupon" | "cash" | "custom";
export type ReferralStatus = "pending" | "counted" | "rejected" | "flagged";
export type RewardStatus = "pending" | "delivered" | "cancelled";
export type ProgramState = "draft" | "scheduled" | "running" | "ended";

export interface Prize {
  prize_id: number;
  kind: PrizeKind;
  threshold: number | null;
  rank: number | null;
  prize_type: PrizeType;
  product_variant: string | null;
  product_variant_title: string | null;
  diamonds_amount: number | null;
  coupon_discount_type: "percent" | "fixed" | null;
  coupon_discount_value: string | null;
  cash_amount: string | null;
  custom_text: string | null;
  label: string;
}

export interface ProgramPublic {
  slug: string;
  name: string;
  description: string;
  starts_at: string;
  ends_at: string;
  count_rule: CountRule;
  count_event: { slug: string; name: string } | null;
  running: boolean;
}

export interface Landing {
  code: string;
  referrer: string | null;
  program: ProgramPublic;
  welcome_prizes: Prize[];
}

export interface MyProgram extends ProgramPublic {
  code: string;
  link_path: string;
  clicks: number;
  signups: number;
  counted: number;
  pending: number;
  next_milestone: { threshold: number; remaining: number } | null;
  rank: number | null;
  prizes: Prize[];
}

export interface MyReward {
  token: string;
  program: string;
  kind: PrizeKind;
  prize: Prize;
  status: RewardStatus;
  created_at: string;
  delivered_at: string | null;
  coupon_code: string | null;
}

export interface Mine {
  programs: MyProgram[];
  rewards: MyReward[];
  referred_by: { program: string; referrer: string | null; status: ReferralStatus; count_rule: CountRule } | null;
}

export interface AdminProgram extends ProgramPublic {
  is_published: boolean;
  state: ProgramState;
  scope: Scope;
  countries: string[];
  teams: string[];
  users: string[];
  program_code: string | null;
  ranks_awarded_at: string | null;
  funnel: {
    clicks: number;
    signups: number;
    /** came through an opened link; the rest typed the code, so they have no click */
    signups_via_link: number;
    signups_typed: number;
    counted: number;
    pending: number;
    flagged: number;
    rejected: number;
  };
  rewards_pending: number;
  created_at: string;
  prizes?: Prize[];
  leaderboard?: { rank: number; username: string; counted: number; last_counted_at: string | null }[];
}

export interface AdminReferral {
  token: string;
  referrer: string | null;
  referred: string;
  code: string;
  status: ReferralStatus;
  reason: string | null;
  created_at: string;
  counted_at: string | null;
}

export interface AdminReward extends MyReward {
  username: string;
  note: string | null;
}

export interface Page<T> {
  results: T[];
  total_count: number;
  has_more: boolean;
  next_offset: number | null;
}

/** What the editor sends. Teams and players by name, the event by slug, shop items by SKU. */
export interface ProgramInput {
  name: string;
  description: string;
  starts_at: string;
  ends_at: string;
  is_published: boolean;
  scope: Scope;
  countries: string[];
  teams: string[];
  users: string[];
  count_rule: CountRule;
  count_event: string;
  program_code: string;
  prizes: PrizeInput[];
}

export interface PrizeInput {
  prize_id?: number;
  kind: PrizeKind;
  threshold?: number | null;
  rank?: number | null;
  prize_type: PrizeType;
  product_variant?: string | null;
  coupon_discount_type?: "percent" | "fixed";
  coupon_discount_value?: string | null;
  cash_amount?: string | null;
  custom_text?: string | null;
}

// ── the pending referral, kept in the browser between the invite and the first sign-in ──

export interface PendingReferral {
  code: string;
  click: string;
}

export function savePendingReferral(code: string, click = "") {
  const clean = code.trim().toUpperCase();
  if (!clean) return;
  // Keep the click token only when it belongs to the same code (a re-typed code has none)
  const prior = readPendingReferral();
  const keepClick = click || (prior && prior.code === clean ? prior.click : "");
  Cookies.set(COOKIE, JSON.stringify({ code: clean, click: keepClick }), {
    expires: COOKIE_DAYS,
    sameSite: "lax",
    secure: typeof location !== "undefined" && location.protocol === "https:",
  });
}

export function readPendingReferral(): PendingReferral | null {
  try {
    const raw = Cookies.get(COOKIE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.code === "string" ? { code: parsed.code, click: String(parsed.click || "") } : null;
  } catch {
    return null;
  }
}

export function clearPendingReferral() {
  Cookies.remove(COOKIE);
}

// ── public ──

export async function getLanding(code: string): Promise<Landing> {
  return (await axios.get<Landing>(`${BASE}/r/${encodeURIComponent(code)}/`)).data;
}

export async function recordClick(code: string): Promise<string> {
  return (await axios.post<{ click_token: string }>(`${BASE}/click/`, { code })).data.click_token;
}

// ── signed in ──

/**
 * Sends the waiting referral, once. Returns the server's code on a refusal so the caller can say why,
 * "ok" on success, or null when there was nothing to send. The cookie is dropped on any definite answer;
 * it is kept on a network failure or a rate limit so the next page load tries again.
 */
export async function claimPendingReferral(): Promise<string | null> {
  const pending = readPendingReferral();
  if (!pending) return null;
  const headers = optionalAuthHeaders();
  if (!("Authorization" in headers)) return null;
  try {
    await axios.post(`${BASE}/claim/`, { code: pending.code, click_token: pending.click }, { headers });
    clearPendingReferral();
    window.dispatchEvent(new Event(REFERRAL_CLAIMED_EVENT));
    return "ok";
  } catch (err: unknown) {
    const code = (err as { response?: { status?: number; data?: { code?: string } } })?.response;
    if (!code?.status || code.status === 429 || code.status >= 500) return null;
    clearPendingReferral();
    return code.data?.code ?? "error";
  }
}

export async function getMine(): Promise<Mine> {
  return (await axios.get<Mine>(`${BASE}/mine/`, { headers: authHeaders() })).data;
}

// ── head admin ──

export const referralsAdmin = {
  async list(offset = 0, limit = 25): Promise<Page<AdminProgram>> {
    return (await axios.get(`${BASE}/admin/programs/`, { headers: authHeaders(), params: { offset, limit } })).data;
  },
  async get(slug: string): Promise<AdminProgram> {
    return (await axios.get(`${BASE}/admin/programs/${slug}/`, { headers: authHeaders() })).data;
  },
  async create(input: ProgramInput): Promise<AdminProgram> {
    return (await axios.post(`${BASE}/admin/programs/`, input, { headers: authHeaders() })).data;
  },
  async update(slug: string, input: Partial<ProgramInput>): Promise<AdminProgram> {
    return (await axios.patch(`${BASE}/admin/programs/${slug}/`, input, { headers: authHeaders() })).data;
  },
  async referrals(slug: string, status = "", offset = 0, limit = 25): Promise<Page<AdminReferral>> {
    return (await axios.get(`${BASE}/admin/programs/${slug}/referrals/`, {
      headers: authHeaders(), params: { status: status || undefined, offset, limit },
    })).data;
  },
  async rewards(slug: string, status = "", offset = 0, limit = 25): Promise<Page<AdminReward>> {
    return (await axios.get(`${BASE}/admin/programs/${slug}/rewards/`, {
      headers: authHeaders(), params: { status: status || undefined, offset, limit },
    })).data;
  },
  async exportCsv(slug: string): Promise<Blob> {
    return (await axios.get(`${BASE}/admin/programs/${slug}/export/`, { headers: authHeaders(), responseType: "blob" })).data;
  },
  async awardRanks(slug: string): Promise<{ awarded: number; program: AdminProgram }> {
    return (await axios.post(`${BASE}/admin/programs/${slug}/award-ranks/`, {}, { headers: authHeaders() })).data;
  },
  async decide(token: string, action: "count" | "reject" | "release"): Promise<AdminReferral> {
    return (await axios.post(`${BASE}/admin/referrals/${token}/decide/`, { action }, { headers: authHeaders() })).data;
  },
  async deliver(token: string, note: string): Promise<AdminReward> {
    return (await axios.post(`${BASE}/admin/rewards/${token}/deliver/`, { note }, { headers: authHeaders() })).data;
  },
};

/** The refusal code on an axios error, for translating (R35 / R44). */
export function errorCode(err: unknown): string {
  return (err as { response?: { data?: { code?: string } } })?.response?.data?.code ?? "error";
}
