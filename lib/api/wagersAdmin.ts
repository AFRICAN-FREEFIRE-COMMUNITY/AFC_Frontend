/**
 * lib/api/wagersAdmin.ts - the wager CMS client. Every call hits afc_wager.views_admin
 * (mounted at /wagers/admin/) with the session bearer; the server decides the role
 * (wager_admin for markets, finance_admin for money, head_admin for settings and co-signs).
 *
 * CONNECTS TO: app/(a)/a/wagers/* (markets, queue, templates, settings) and
 * app/(a)/a/winnings/* (overview, players, withdrawals, adjustments, KYC, ledger). Shared shapes
 * (MarketDetail, Wager, Withdrawal, Limits, KycState, LedgerEntry, Page, refusalOf, naira) come
 * from lib/api/wagers.ts so the two clients never describe the same row twice.
 */
import axios from "axios";

import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";
import type {
  KycState, LedgerEntry, Limits, MarketDetail, MarketStatus, Page, Wager, Withdrawal,
} from "@/lib/api/wagers";

const API = `${env.NEXT_PUBLIC_BACKEND_API_URL}/wagers/admin`;

// ── shapes ────────────────────────────────────────────────────────────────────────────────────
export interface WagerSettings {
  wagering_enabled: boolean;
  maintenance_message: string;
  rake_bps: number;
  cancel_fee_bps: number;
  min_stake_kobo: number;
  max_stake_per_user_kobo: number;
  max_pool_kobo: number;
  payment_expiry_minutes: number;
  min_withdrawal_kobo: number;
  cosign_threshold_kobo: number;
  min_age: number;
  default_daily_stake_cap_kobo: number;
  default_weekly_stake_cap_kobo: number;
  default_daily_loss_cap_kobo: number;
  updated_at: string | null;
}

export type OptionSource = "teams_in_match" | "players_in_match" | "custom" | "over_under";
export type SettleRule =
  | "team_placement_1" | "team_most_kills" | "player_most_kills" | "match_mvp"
  | "total_kills_over_under" | "manual";

export interface MarketTemplate {
  id: number;
  code: string;
  name: string;
  description: string;
  option_source: OptionSource;
  settle_rule: SettleRule;
  needs_match: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface PickerEvent { id: number; slug: string; name: string; status: string }
export interface PickerEventDetail {
  event: PickerEvent;
  stages: { id: number; name: string }[];
  matches: { id: number; number: number; stage_id: number | null; group: string | null; result_in: boolean; map: string }[];
  teams: { id: number; name: string }[];
  players: { id: number; username: string; team: string }[];
}

export interface Settlement {
  resolution: "WINNER" | "VOID_NO_WINNER" | "VOID_SOLO_WAGER" | "VOID_ADMIN";
  final_option: string | null;
  suggested_option: string | null;
  override_reason: string;
  evidence: Record<string, unknown>;
  pool_kobo: number;
  rake_kobo: number;
  net_pool_kobo: number;
  dust_kobo: number;
  paid_total_kobo: number;
  refund_total_kobo: number;
  winners_count: number;
  confirmed_by: string | null;
  confirmed_at: string | null;
}

/** admin_market_row: the public summary plus who made it and where it sits. */
export interface AdminMarketRow {
  id: number;
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
  visibility: "public" | "signed_in";
  suggested_option: string | null;
  suggested_at: string | null;
  locked_at: string | null;
  created_by: string | null;
  created_at: string;
  match_id: number | null;
  stage_id: number | null;
  event_id: number;
}

export interface AdminMarketDetail extends Omit<MarketDetail, "my_wagers">, AdminMarketRow {
  suggestion_evidence: Record<string, unknown>;
  suggested_option_id: number | null;
  template_detail: MarketTemplate;
  settlement: Settlement | null;
}

export interface AdminWagerRow extends Wager { user: string }

export interface StaffWithdrawal extends Withdrawal {
  user: string;
  bank: Withdrawal["bank"] & { account_number: string };
  failure_reason: string;
  reviewed_by: string | null;
  cosigned_by: string | null;
  needs_cosign: boolean;
}

export interface AdminAccountRow {
  username: string;
  email: string;
  balance_kobo: number;
  held_kobo: number;
  frozen: boolean;
  frozen_reason: string;
  kyc: KycState | null;
  limits: Limits | null;
  updated_at: string | null;
}

export interface Adjustment {
  id: number;
  user: string;
  direction: "CREDIT" | "DEBIT";
  amount_kobo: number;
  reason: string;
  status: "EXECUTED" | "PENDING_COSIGN" | "REJECTED";
  submitted_by: string | null;
  cosigned_by: string | null;
  reject_reason: string;
  created_at: string;
  executed_at: string | null;
}

export interface AdminLedgerRow extends LedgerEntry {
  user: string | null;
  is_house: boolean;
  created_by: string | null;
}

export interface KycRow extends KycState {
  username: string;
  forced_by: string | null;
  force_reason: string;
  forced_at: string | null;
}

export interface Overview {
  house: { HOUSE_RAKE: number; HOUSE_CANCEL_FEE: number; HOUSE_DUST: number; total_kobo: number };
  liabilities_kobo: number;
  held_kobo: number;
  open_pool_kobo: number;
  markets: Partial<Record<MarketStatus, number>>;
  queue: { locked: number; pending_settlement: number };
  withdrawals: Partial<Record<Withdrawal["status"], number>>;
  adjustments_pending: number;
  stakes_24h_kobo: number;
  stakes_7d_kobo: number;
  paid_out_7d_kobo: number;
  players_with_balance: number;
  frozen_accounts: number;
  settings: WagerSettings;
}

export interface UserDetail {
  account: AdminAccountRow;
  wagers: Wager[];
  ledger: LedgerEntry[];
  withdrawals: StaffWithdrawal[];
  adjustments: Adjustment[];
}

/** What the market form sends. Amounts in kobo, percentages in bps, times as ISO strings. */
export interface MarketInput {
  template?: string;
  event_id?: number;
  stage_id?: number | null;
  match_id?: number | null;
  title?: string;
  description?: string;
  rules_text?: string;
  lock_at?: string;
  open_at?: string | null;
  visibility?: "public" | "signed_in";
  featured?: boolean;
  over_under_line?: number | null;
  rake_bps?: number;
  cancel_fee_bps?: number;
  min_stake_kobo?: number;
  max_stake_per_user_kobo?: number;
  max_pool_kobo?: number;
  options?: { label?: string; team_id?: number; player_id?: number }[];
  publish?: boolean;
}

const h = () => ({ headers: authHeaders() });

// ── overview, settings, templates ─────────────────────────────────────────────────────────────
export async function getOverview(): Promise<Overview> {
  const { data } = await axios.get(`${API}/overview/`, h());
  return data;
}

export async function getAdminSettings(): Promise<WagerSettings> {
  const { data } = await axios.get(`${API}/settings/`, h());
  return data.settings;
}

export async function saveAdminSettings(patch: Partial<WagerSettings>): Promise<{ message: string; settings: WagerSettings }> {
  const { data } = await axios.patch(`${API}/settings/`, patch, h());
  return data;
}

export async function listTemplates(): Promise<MarketTemplate[]> {
  const { data } = await axios.get(`${API}/templates/`, h());
  return data.results;
}

export async function createTemplate(body: Partial<MarketTemplate>): Promise<{ message: string; template: MarketTemplate }> {
  const { data } = await axios.post(`${API}/templates/`, body, h());
  return data;
}

export async function saveTemplate(code: string, body: Partial<MarketTemplate>): Promise<{ message: string; template: MarketTemplate }> {
  const { data } = await axios.patch(`${API}/templates/${encodeURIComponent(code)}/`, body, h());
  return data;
}

// ── pickers ───────────────────────────────────────────────────────────────────────────────────
export async function pickerEvents(q = ""): Promise<PickerEvent[]> {
  const { data } = await axios.get(`${API}/pickers/events/`, { ...h(), params: q ? { q } : {} });
  return data.results;
}

export async function pickerEvent(eventId: number): Promise<PickerEventDetail> {
  const { data } = await axios.get(`${API}/pickers/events/${eventId}/`, h());
  return data;
}

// ── markets ───────────────────────────────────────────────────────────────────────────────────
export async function listAdminMarkets(params: {
  status?: string; event?: string; template?: string; q?: string; limit?: number; offset?: number;
} = {}): Promise<Page<AdminMarketRow>> {
  const { data } = await axios.get(`${API}/markets/`, { ...h(), params });
  return data;
}

export async function createMarket(body: MarketInput): Promise<{ message: string; market: AdminMarketDetail }> {
  const { data } = await axios.post(`${API}/markets/create/`, body, h());
  return data;
}

export async function getAdminMarket(slug: string): Promise<AdminMarketDetail | { status: "moved"; slug: string }> {
  const { data } = await axios.get(`${API}/markets/${encodeURIComponent(slug)}/`, h());
  return data.market ?? data;
}

export async function saveMarket(slug: string, body: MarketInput): Promise<{ message: string; market: AdminMarketDetail }> {
  const { data } = await axios.patch(`${API}/markets/${encodeURIComponent(slug)}/`, body, h());
  return data;
}

/** The market image on its own: a multipart PATCH carrying only the file (the JSON form
 *  never carries files, and a multipart body would turn the options list into a string). */
export async function uploadMarketImage(slug: string, file: File): Promise<{ message: string; market: AdminMarketDetail }> {
  const form = new FormData();
  form.append("image", file);
  const { data } = await axios.patch(`${API}/markets/${encodeURIComponent(slug)}/`, form, h());
  return data;
}

const marketAction = async (slug: string, action: string, body: Record<string, unknown> = {}) => {
  const { data } = await axios.post(`${API}/markets/${encodeURIComponent(slug)}/${action}/`, body, h());
  return data as { message: string; market: AdminMarketDetail; settlement?: Settlement };
};
export const publishMarket = (slug: string) => marketAction(slug, "publish");
export const lockMarket = (slug: string) => marketAction(slug, "lock");
export const reopenMarket = (slug: string, lock_at: string, reason: string) => marketAction(slug, "reopen", { lock_at, reason });
export const voidMarket = (slug: string, reason: string) => marketAction(slug, "void", { reason });
export const suggestMarket = (slug: string) => marketAction(slug, "suggest");
export const settleMarket = (slug: string, option_id: number, override_reason = "") =>
  marketAction(slug, "settle", { option_id, override_reason });

export async function listMarketWagers(slug: string, params: { limit?: number; offset?: number } = {}): Promise<Page<AdminWagerRow>> {
  const { data } = await axios.get(`${API}/markets/${encodeURIComponent(slug)}/wagers/`, { ...h(), params });
  return data;
}

export async function getQueue(): Promise<{ results: AdminMarketDetail[]; pending: number; locked: number }> {
  const { data } = await axios.get(`${API}/queue/`, h());
  return data;
}

// ── players and their winnings ────────────────────────────────────────────────────────────────
export async function listAccounts(params: { q?: string; frozen?: "1"; with_balance?: "1"; limit?: number; offset?: number } = {}): Promise<Page<AdminAccountRow>> {
  const { data } = await axios.get(`${API}/users/`, { ...h(), params });
  return data;
}

export async function getUserDetail(username: string): Promise<UserDetail> {
  const { data } = await axios.get(`${API}/users/${encodeURIComponent(username)}/`, h());
  return data;
}

export async function freezeUser(username: string, frozen: boolean, reason: string): Promise<{ message: string; account: AdminAccountRow }> {
  const { data } = await axios.post(`${API}/users/${encodeURIComponent(username)}/freeze/`, { frozen, reason }, h());
  return data;
}

export async function adjustUser(username: string, body: { direction: "CREDIT" | "DEBIT"; amount_kobo: number; reason: string }): Promise<{ message: string; adjustment: Adjustment }> {
  const { data } = await axios.post(`${API}/users/${encodeURIComponent(username)}/adjust/`, body, h());
  return data;
}

export async function setUserLimits(username: string, body: {
  daily_stake_cap_kobo?: number; weekly_stake_cap_kobo?: number; daily_loss_cap_kobo?: number; cooloff_days?: number;
}): Promise<{ message: string; limits: Limits }> {
  const { data } = await axios.post(`${API}/users/${encodeURIComponent(username)}/limits/`, body, h());
  return data;
}

export async function listAdminLedger(params: { kind?: string; user?: string; house?: "1"; ref?: string; limit?: number; offset?: number } = {}): Promise<Page<AdminLedgerRow>> {
  const { data } = await axios.get(`${API}/ledger/`, { ...h(), params });
  return data;
}

// ── withdrawals ───────────────────────────────────────────────────────────────────────────────
export async function listWithdrawals(params: { status?: string; limit?: number; offset?: number } = {}): Promise<Page<StaffWithdrawal>> {
  const { data } = await axios.get(`${API}/withdrawals/`, { ...h(), params });
  return data;
}

const withdrawalAction = async (token: string, action: string, body: Record<string, unknown> = {}) => {
  const { data } = await axios.post(`${API}/withdrawals/${encodeURIComponent(token)}/${action}/`, body, h());
  return data as { message: string; withdrawal: StaffWithdrawal };
};
export const approveWithdrawal = (token: string) => withdrawalAction(token, "approve");
export const rejectWithdrawal = (token: string, reason: string) => withdrawalAction(token, "reject", { reason });
export const markWithdrawalPaid = (token: string, reference = "") => withdrawalAction(token, "mark-paid", { reference });

// ── adjustments ───────────────────────────────────────────────────────────────────────────────
export async function listAdjustments(params: { status?: string; limit?: number; offset?: number } = {}): Promise<Page<Adjustment>> {
  const { data } = await axios.get(`${API}/adjustments/`, { ...h(), params });
  return data;
}

export async function cosignAdjustment(id: number, approve: boolean, reason = ""): Promise<{ message: string; adjustment: Adjustment }> {
  const { data } = await axios.post(`${API}/adjustments/${id}/cosign/`, { approve, reason }, h());
  return data;
}

// ── KYC ───────────────────────────────────────────────────────────────────────────────────────
export async function listKyc(params: { q?: string; limit?: number; offset?: number } = {}): Promise<Page<KycRow>> {
  const { data } = await axios.get(`${API}/kyc/`, { ...h(), params });
  return data;
}

export async function forceKyc(username: string, verified: boolean, reason: string): Promise<{ message: string; kyc: KycState }> {
  const { data } = await axios.post(`${API}/kyc/${encodeURIComponent(username)}/force/`, { verified, reason }, h());
  return data;
}
