/**
 * lib/api/wagers.ts - the one client for the wager feature (backend app: afc_wager).
 *
 * WHY IT IS ALL HERE
 *   Four player surfaces (the market list, a market page, My wagers, Winnings) and the whole CMS
 *   read the same shapes: a market, a wager, a ledger line, a withdrawal. The types live once
 *   (R24) and every fetch goes through one place, so an error reads the server's {message, code}
 *   the same way everywhere (R44: `apiMessage`).
 *
 * MONEY: every amount is an INTEGER IN KOBO on the wire, exactly as the backend stores it. The
 * pages format it with `naira()` below (formatMoney on the active locale). No coins anywhere
 * (owner 2026-09-18, inbox #33).
 *
 * ADDRESSES (afc_wager/urls.py), player side:
 *   GET  wagers/settings/                       public dials + kill switch
 *   GET  wagers/markets/?status&event&q         list (public; "mine" needs a session)
 *   GET  wagers/markets/<slug>/                 detail (+ my wagers when signed in)
 *   POST wagers/markets/<slug>/place/           -> {wager, payment_url}
 *   GET  wagers/payments/verify/?reference=     after Paystack sends the player back
 *   GET  wagers/mine/                           my wagers + totals
 *   POST wagers/wager/<token>/cancel/
 *   GET  wagers/winnings/  ledger/  banks/  bank-accounts/  POST withdraw/  withdrawals/<t>/cancel/
 *   GET/POST wagers/limits/  POST limits/cooloff/  limits/self-exclude/
 *   GET  wagers/kyc/  POST kyc/whatsapp/start/  kyc/whatsapp/verify/
 * The CMS half is in lib/api/wagersAdmin.ts.
 */
import axios, { AxiosError } from "axios";

import { env } from "@/lib/env";
import { authHeaders, optionalAuthHeaders } from "@/lib/http";
import { formatMoney } from "@/lib/money";

const API = `${env.NEXT_PUBLIC_BACKEND_API_URL}/wagers`;

// ── money ─────────────────────────────────────────────────────────────────────────────────────
/** "₦2,375.00" from kobo, on the active locale. The ONLY way an amount is written on screen. */
export function naira(kobo: number | null | undefined): string {
  return formatMoney((Number(kobo) || 0) / 100, "NGN");
}

/** Whole naira typed in a field -> kobo for the wire. */
export function nairaToKobo(naira: string | number): number {
  const n = Number(String(naira).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

// ── shapes ────────────────────────────────────────────────────────────────────────────────────
export type MarketStatus = "DRAFT" | "OPEN" | "LOCKED" | "PENDING_SETTLEMENT" | "SETTLED" | "VOID";
export type WagerStatus = "PENDING_PAYMENT" | "ACTIVE" | "CANCELLED" | "EXPIRED" | "WON" | "LOST" | "REFUNDED";
export type LineOutcome = "PENDING" | "WON" | "LOST" | "REFUNDED";

export interface WagerSettingsPublic {
  wagering_enabled: boolean;
  maintenance_message: string;
  rake_bps: number;
  cancel_fee_bps: number;
  min_stake_kobo: number;
  max_stake_per_user_kobo: number;
  min_withdrawal_kobo: number;
  min_age: number;
  payment_expiry_minutes: number;
}

export interface MarketOption {
  id: number;
  label: string;
  side: "over" | "under" | null;
  team: string | null;
  player: string | null;
  pool_kobo: number;
  line_count: number;
  share_percent: number;
}

export interface MarketSummary {
  slug: string;
  title: string;
  status: MarketStatus;
  is_open_for_stakes: boolean;
  event: { slug: string; name: string };
  template: string;
  featured: boolean;
  image: string | null;
  open_at: string | null;
  lock_at: string;
  settled_at: string | null;
  pool_kobo: number;
  wager_count: number;
  rake_bps: number;
  cancel_fee_bps: number;
  min_stake_kobo: number;
  max_stake_per_user_kobo: number;
  settled_option: string | null;
  my_stake_kobo: number | null;
}

export interface WagerLine {
  option_id: number;
  option: string;
  stake_kobo: number;
  outcome: LineOutcome;
  payout_kobo: number;
}

export interface Wager {
  token: string;
  status: WagerStatus;
  total_stake_kobo: number;
  payout_kobo: number;
  refund_kobo: number;
  cancel_fee_kobo: number;
  created_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
  payment_expires_at: string | null;
  payment_url: string | null;
  lines: WagerLine[];
  market?: { slug: string; title: string; status: MarketStatus; lock_at: string; settled_option: string | null };
}

export interface MarketDetail extends MarketSummary {
  description: string;
  rules_text: string;
  visibility: "public" | "signed_in";
  stage: string | null;
  match_number: number | null;
  over_under_line: number | null;
  max_pool_kobo: number;
  options: MarketOption[];
  settled_option_id: number | null;
  void_reason: string;
  my_wagers: Wager[];
}

export interface Page<T> {
  results: T[];
  has_more: boolean;
  next_offset: number | null;
  total_count: number;
}

export interface LedgerEntry {
  id: number;
  kind: string;
  amount_kobo: number;
  held_delta_kobo: number;
  balance_after_kobo: number;
  ref_kind: string;
  ref: string;
  /** English audit sentence for staff; the player's page phrases the row from `kind` instead. */
  note: string;
  /** The market title or the bank the money went to, as data. */
  label: string;
  /** A human-written sentence when there is one: an adjustment or rejection reason. */
  reason: string;
  created_at: string;
}

export interface BankAccount {
  id: number;
  bank_code: string;
  bank_name: string;
  account_number_masked: string;
  account_name: string;
  is_default: boolean;
}

export interface Withdrawal {
  token: string;
  status: "REQUESTED" | "PENDING_COSIGN" | "APPROVED" | "PAID" | "FAILED" | "REJECTED" | "CANCELLED";
  amount_kobo: number;
  bank: { bank_name: string; account_number_masked: string; account_name: string };
  reject_reason: string;
  created_at: string;
  reviewed_at: string | null;
  paid_at: string | null;
  transfer_reference: string;
}

export interface Limits {
  daily_stake_cap_kobo: number;
  weekly_stake_cap_kobo: number;
  daily_loss_cap_kobo: number;
  effective: { daily_stake_cap_kobo: number; weekly_stake_cap_kobo: number; daily_loss_cap_kobo: number };
  pending: {
    daily_stake_cap_kobo: number | null;
    weekly_stake_cap_kobo: number | null;
    daily_loss_cap_kobo: number | null;
    effective_at: string | null;
  };
  cooloff_until: string | null;
  self_excluded_until: string | null;
}

export interface KycState {
  whatsapp_number: string;
  whatsapp_verified: boolean;
  whatsapp_verified_at: string | null;
  discord_linked: boolean;
  date_of_birth_on_file: boolean;
  age_ok: boolean;
  min_age: number;
  tier_lite: boolean;
  forced: boolean;
}

export interface Winnings {
  account: {
    balance_kobo: number;
    held_kobo: number;
    available_kobo: number;
    frozen: boolean;
    frozen_reason: string;
    pending_withdrawal: Withdrawal | null;
  };
  kyc: KycState;
  limits: Limits;
  min_withdrawal_kobo: number;
  bank_accounts: BankAccount[];
  recent: LedgerEntry[];
}

/** A refusal the server explained: {message, code} plus any extra field it sent. */
export interface ApiRefusal {
  message: string;
  code: string;
  [key: string]: unknown;
}

export function refusalOf(err: unknown): ApiRefusal | null {
  const data = (err as AxiosError<ApiRefusal>)?.response?.data;
  if (data && typeof data === "object" && "code" in data) return data as ApiRefusal;
  return null;
}

// ── reads ─────────────────────────────────────────────────────────────────────────────────────
export async function getSettings(): Promise<WagerSettingsPublic> {
  const { data } = await axios.get(`${API}/settings/`);
  return data;
}

export async function listMarkets(params: {
  status?: "open" | "locked" | "settled" | "mine";
  event?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<Page<MarketSummary> & { events: { slug: string; name: string }[] }> {
  const { data } = await axios.get(`${API}/markets/`, { params, headers: optionalAuthHeaders() });
  return data;
}

export async function getMarket(slug: string): Promise<MarketDetail | { status: "moved"; slug: string }> {
  const { data } = await axios.get(`${API}/markets/${encodeURIComponent(slug)}/`, { headers: optionalAuthHeaders() });
  return data;
}

export async function getMyWagers(params: { limit?: number; offset?: number } = {}): Promise<
  Page<Wager> & { totals: { staked: number; won: number; refunded: number; lost: number } }
> {
  const { data } = await axios.get(`${API}/mine/`, { params, headers: authHeaders() });
  return data;
}

export async function getWinnings(): Promise<Winnings> {
  const { data } = await axios.get(`${API}/winnings/`, { headers: authHeaders() });
  return data;
}

export async function getLedger(params: { kind?: string; limit?: number; offset?: number } = {}): Promise<Page<LedgerEntry>> {
  const { data } = await axios.get(`${API}/winnings/ledger/`, { params, headers: authHeaders() });
  return data;
}

export async function listBanks(): Promise<{ code: string; name: string }[]> {
  const { data } = await axios.get(`${API}/winnings/banks/`, { headers: authHeaders() });
  return data.results;
}

export async function getKyc(): Promise<KycState> {
  const { data } = await axios.get(`${API}/kyc/`, { headers: authHeaders() });
  return data;
}

export async function getLimits(): Promise<Limits> {
  const { data } = await axios.get(`${API}/limits/`, { headers: authHeaders() });
  return data.limits;
}

// ── writes ────────────────────────────────────────────────────────────────────────────────────
export async function placeWager(
  slug: string,
  lines: { option_id: number; stake_kobo: number }[],
): Promise<{ message: string; wager: Wager; payment_url: string; payment_expires_at: string }> {
  const { data } = await axios.post(`${API}/markets/${encodeURIComponent(slug)}/place/`, { lines }, { headers: authHeaders() });
  return data;
}

export async function verifyPayment(reference: string): Promise<{ message: string; code?: string; wager: Wager }> {
  const { data } = await axios.get(`${API}/payments/verify/`, { params: { reference }, headers: authHeaders() });
  return data;
}

export async function cancelWager(token: string): Promise<{ message: string; wager: Wager }> {
  const { data } = await axios.post(`${API}/wager/${encodeURIComponent(token)}/cancel/`, {}, { headers: authHeaders() });
  return data;
}

export async function addBankAccount(bank_code: string, account_number: string): Promise<{ message: string; bank_account: BankAccount }> {
  const { data } = await axios.post(`${API}/winnings/bank-accounts/`, { bank_code, account_number }, { headers: authHeaders() });
  return data;
}

export async function requestWithdrawal(amount_kobo: number, bank_account_id: number): Promise<{ message: string; withdrawal: Withdrawal }> {
  const { data } = await axios.post(`${API}/winnings/withdraw/`, { amount_kobo, bank_account_id }, { headers: authHeaders() });
  return data;
}

export async function cancelWithdrawal(token: string): Promise<{ message: string; withdrawal: Withdrawal }> {
  const { data } = await axios.post(`${API}/winnings/withdrawals/${encodeURIComponent(token)}/cancel/`, {}, { headers: authHeaders() });
  return data;
}

export async function setLimits(caps: Partial<Record<"daily_stake_cap_kobo" | "weekly_stake_cap_kobo" | "daily_loss_cap_kobo", number>>): Promise<{ message: string; limits: Limits }> {
  const { data } = await axios.post(`${API}/limits/`, caps, { headers: authHeaders() });
  return data;
}

export async function setCooloff(days: number): Promise<{ message: string; limits: Limits }> {
  const { data } = await axios.post(`${API}/limits/cooloff/`, { days }, { headers: authHeaders() });
  return data;
}

export async function setSelfExclusion(months: number): Promise<{ message: string; limits: Limits }> {
  const { data } = await axios.post(`${API}/limits/self-exclude/`, { months }, { headers: authHeaders() });
  return data;
}

export async function startWhatsAppKyc(): Promise<{ message: string; challenge_token: string; sent: boolean; destination: string; retry_after: number }> {
  const { data } = await axios.post(`${API}/kyc/whatsapp/start/`, {}, { headers: authHeaders() });
  return data;
}

export async function verifyWhatsAppKyc(challenge_token: string, code: string): Promise<KycState & { message: string }> {
  const { data } = await axios.post(`${API}/kyc/whatsapp/verify/`, { challenge_token, code }, { headers: authHeaders() });
  return data;
}
