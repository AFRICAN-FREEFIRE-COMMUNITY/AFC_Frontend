// Mirrors DRF serializer output 1:1. Backend keeps these in sync via parity tests.

export type Kobo = number; // integer kobo, 1 NGN = 100 kobo, 1 coin = 50_000 kobo
export type SourceTag = "PURCHASED" | "WON" | "GIFT";
export type KYCTierLevel = "TIER_0" | "TIER_LITE";

export type MarketStatus =
  | "DRAFT"
  | "OPEN"
  | "LOCKED"
  | "PENDING_SETTLEMENT"
  | "SETTLED"
  | "VOIDED";

export type WagerStatus = "ACTIVE" | "SETTLED" | "VOIDED" | "CANCELLED";

export type WagerLineOutcome = "WIN" | "LOSS" | "VOID" | null;

export type SettlementResolution =
  | "WINNER"
  | "VOID_NO_WINNER"
  | "VOID_ADMIN"
  | "VOID_SOLO_WAGER";

export type DepositRail = "PAYSTACK" | "STRIPE" | "CRYPTO" | "VOUCHER";
export type WithdrawRail = "PAYSTACK_TRANSFER" | "CRYPTO_USDT";

export type WalletTxnKind =
  | "DEPOSIT_PAYSTACK"
  | "DEPOSIT_STRIPE"
  | "DEPOSIT_CRYPTO"
  | "DEPOSIT_VOUCHER"
  | "WAGER_PLACE"
  | "WAGER_REFUND"
  | "WAGER_PAYOUT"
  | "WAGER_CANCEL_FEE"
  | "HOUSE_RAKE"
  | "P2P_OUT"
  | "P2P_IN"
  | "P2P_FEE"
  | "WITHDRAW_HOLD"
  | "WITHDRAW_REVERSAL"
  | "ADJUSTMENT";

export interface User {
  id: string;
  username: string;
  display_name: string;
  role: "user" | "wager_admin" | "wallet_admin" | "head_admin" | "house";
  created_at: string;
}

export interface FxSnapshot {
  id: string;
  captured_at: string;
  ngn_per_usd: number;
  source: string;
}

export interface Balance {
  total_kobo: Kobo;
  purchased_kobo: Kobo;
  won_kobo: Kobo;
  gift_kobo: Kobo;
  locked_kobo: Kobo;
  fx: FxSnapshot;
}

export interface WalletTxn {
  id: string;
  wallet_id: string;
  amount_kobo: number; // signed: + credit, - debit
  kind: WalletTxnKind;
  source_tag: SourceTag;
  ref_type: string;
  ref_id: string;
  fx_snapshot_id: string;
  idempotency_key: string;
  created_at: string;
}

export interface KYCStatus {
  tier: KYCTierLevel;
  whatsapp_number: string | null;
  whatsapp_verified_at: string | null;
  discord_user_id: string | null;
  discord_linked_at: string | null;
}

export interface MarketTemplate {
  code: string;
  display_name: string;
  option_source: "TEAMS" | "PLAYERS" | "NUMERIC" | "FREEFORM";
  auto_gradable: boolean;
  grader_key: string | null;
}

export interface MarketOption {
  id: string;
  market_id: string;
  label: string;
  ref_team_id: string | null;
  ref_player_id: string | null;
  ref_numeric: number | null;
  image: string | null;
  sort_order: number;
  cached_pool_kobo: Kobo;
  cached_wager_count: number;
}

export interface Market {
  id: string;
  event_id: string;
  match_id: string | null;
  template_code: string;
  title: string;
  description: string;
  status: MarketStatus;
  opens_at: string;
  lock_at: string;
  min_stake_kobo: Kobo;
  max_per_user_kobo: Kobo | null;
  cancel_fee_bps: number;
  rake_bps: number;
  suggested_option_id: string | null;
  winning_option_id: string | null;
  total_pool_kobo: Kobo;
  total_lines: number;
  options: MarketOption[];
  created_by_admin_id: string;
}

export interface WagerLine {
  id: string;
  wager_id: string;
  option_id: string;
  stake_kobo: Kobo;
  payout_kobo: Kobo | null;
  outcome: WagerLineOutcome;
}

export interface Wager {
  id: string;
  user_id: string;
  market_id: string;
  total_stake_kobo: Kobo;
  status: WagerStatus;
  placed_at: string;
  cancelled_at: string | null;
  debit_txn_id: string;
  lines: WagerLine[];
}

export interface Settlement {
  id: string;
  market_id: string;
  suggested_option_id: string | null;
  final_option_id: string | null;
  resolution: SettlementResolution;
  override_reason: string | null;
  total_pool_kobo: Kobo;
  rake_kobo: Kobo;
  paid_out_kobo: Kobo;
  winners_count: number;
  lines_count: number;
  confirmed_by_admin_id: string;
  confirmed_at: string;
}

export interface DepositIntent {
  id: string;
  user_id: string;
  rail: DepositRail;
  amount_kobo: Kobo;
  provider_ref: string;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED";
  resulting_txn_id: string | null;
  created_at: string;
}

export interface Voucher {
  id: string;
  code: string;
  amount_kobo: Kobo;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
}

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount_kobo: Kobo;
  rail: WithdrawRail;
  destination: Record<string, unknown>;
  status: "REQUESTED" | "APPROVED" | "SENT" | "FAILED" | "CANCELLED";
  approved_by_admin_id: string | null;
  cosign_status: "NOT_REQUIRED" | "AWAITING" | "APPROVED";
  created_at: string;
}

export interface P2PResult {
  transfer_id: string;
  amount_kobo: Kobo;
  fee_kobo: Kobo;
  recipient_username: string;
  receipt_txn_ids: string[];
}

export interface PoolUpdate {
  market_id: string;
  totals_by_option: Record<string, { pool_kobo: Kobo; wager_count: number }>;
  total_pool_kobo: Kobo;
  total_lines: number;
}
