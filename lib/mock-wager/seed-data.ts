// Seed fixture for the AFC Wager mock layer.
//
// Schema reference: store.ts (AfcWagerDB) + types.ts.
//
// Invariants enforced here (verified by hand + the seed test):
//   1. Wager.total_stake_kobo == sum(WagerLine.stake_kobo) for that wager
//   2. sum(WagerLine.stake_kobo across market) == Market.total_pool_kobo
//      for every SETTLED/LOCKED market
//   3. For each Settlement: paid_out_kobo + rake_kobo == total_pool_kobo
//      (dust folded into rake_kobo per settlement-engine.ts contract)
//   4. WalletTxn.idempotency_key is unique
//   5. Voucher.code is unique uppercase
//
// Money is in kobo throughout. 1 NGN = 100 kobo, 1 coin = 50_000 kobo.

import type {
  User,
  Market,
  MarketOption,
  Wager,
  WagerLine,
  Settlement,
  Voucher,
  FxSnapshot,
  WalletTxn,
  KYCStatus,
} from "./types";

// Anchor every relative timestamp to a single point so the fixture is
// deterministic if read at module load. Real demo dates roll forward via
// the mock clock offset.
const NOW_MS = Date.now();
const iso = (offset_ms: number) => new Date(NOW_MS + offset_ms).toISOString();
const MIN = 60_000;
const HR = 60 * MIN;
const DAY = 24 * HR;

// ---------- FX (single snapshot) ----------

export const SEED_FX: FxSnapshot[] = [
  {
    id: "fx_seed_v1",
    captured_at: iso(-1 * HR),
    ngn_per_usd: 1500,
    source: "seed:fixed",
  },
];

const FX_ID = SEED_FX[0].id;

// ---------- Users ----------

export const SEED_USERS: User[] = [
  {
    id: "house",
    username: "house",
    display_name: "AFC House",
    role: "house",
    created_at: iso(-180 * DAY),
  },
  {
    id: "player_1",
    username: "stormbreaker",
    display_name: "StormBreaker",
    role: "user",
    created_at: iso(-90 * DAY),
  },
  {
    id: "player_2",
    username: "ghostkid",
    display_name: "GhostKid",
    role: "user",
    created_at: iso(-60 * DAY),
  },
  {
    id: "player_3",
    username: "moneymachine",
    display_name: "MoneyMachine",
    role: "user",
    created_at: iso(-45 * DAY),
  },
  {
    id: "player_4",
    username: "icyveins",
    display_name: "IcyVeins",
    role: "user",
    created_at: iso(-30 * DAY),
  },
  {
    id: "player_5",
    username: "ravenrook",
    display_name: "RavenRook",
    role: "user",
    created_at: iso(-21 * DAY),
  },
  {
    id: "wager_admin_jane",
    username: "wager_admin_jane",
    display_name: "Jane Adebayo",
    role: "wager_admin",
    created_at: iso(-150 * DAY),
  },
  {
    id: "wallet_admin_kofi",
    username: "wallet_admin_kofi",
    display_name: "Kofi Mensah",
    role: "wallet_admin",
    created_at: iso(-150 * DAY),
  },
  {
    id: "head_admin_jay",
    username: "head_admin_jay",
    display_name: "Jay Olaniyan",
    role: "head_admin",
    created_at: iso(-180 * DAY),
  },
];

// ---------- KYC ----------
// 4 of 5 players Tier_0; player_1 Tier_Lite. All admins Tier_Lite. House Tier_0 (irrelevant).

export const SEED_KYC: (KYCStatus & { id: string; user_id: string })[] = [
  {
    id: "kyc_house",
    user_id: "house",
    tier: "TIER_0",
    whatsapp_number: null,
    whatsapp_verified_at: null,
    discord_user_id: null,
    discord_linked_at: null,
  },
  {
    id: "kyc_player_1",
    user_id: "player_1",
    tier: "TIER_LITE",
    whatsapp_number: "+2348012345671",
    whatsapp_verified_at: iso(-30 * DAY),
    discord_user_id: "discord_player_1_001",
    discord_linked_at: iso(-30 * DAY),
  },
  {
    id: "kyc_player_2",
    user_id: "player_2",
    tier: "TIER_0",
    whatsapp_number: null,
    whatsapp_verified_at: null,
    discord_user_id: null,
    discord_linked_at: null,
  },
  {
    id: "kyc_player_3",
    user_id: "player_3",
    tier: "TIER_0",
    whatsapp_number: null,
    whatsapp_verified_at: null,
    discord_user_id: null,
    discord_linked_at: null,
  },
  {
    id: "kyc_player_4",
    user_id: "player_4",
    tier: "TIER_0",
    whatsapp_number: null,
    whatsapp_verified_at: null,
    discord_user_id: null,
    discord_linked_at: null,
  },
  {
    id: "kyc_player_5",
    user_id: "player_5",
    tier: "TIER_0",
    whatsapp_number: null,
    whatsapp_verified_at: null,
    discord_user_id: null,
    discord_linked_at: null,
  },
  {
    id: "kyc_wager_admin_jane",
    user_id: "wager_admin_jane",
    tier: "TIER_LITE",
    whatsapp_number: "+2348012345601",
    whatsapp_verified_at: iso(-150 * DAY),
    discord_user_id: "discord_jane_001",
    discord_linked_at: iso(-150 * DAY),
  },
  {
    id: "kyc_wallet_admin_kofi",
    user_id: "wallet_admin_kofi",
    tier: "TIER_LITE",
    whatsapp_number: "+2348012345602",
    whatsapp_verified_at: iso(-150 * DAY),
    discord_user_id: "discord_kofi_001",
    discord_linked_at: iso(-150 * DAY),
  },
  {
    id: "kyc_head_admin_jay",
    user_id: "head_admin_jay",
    tier: "TIER_LITE",
    whatsapp_number: "+2348012345603",
    whatsapp_verified_at: iso(-180 * DAY),
    discord_user_id: "discord_jay_001",
    discord_linked_at: iso(-180 * DAY),
  },
];

// ---------- Wallets ----------
// Per spec Section 9 ("Seed data"):
//   player_1 = 50 purchased + 12 won + 1 gift coins
//     = 2_500_000 + 600_000 + 50_000 = 3_150_000 kobo
//   player_2 = empty
//   player_3 = 200 coins (recent big winner) = 10_000_000 kobo
//   player_4 = 30 coins purchased = 1_500_000 kobo
//   player_5 = 10 coins + 5 won = 500_000 + 250_000 = 750_000 kobo
//   admins = small purchased balances for testing
//   house = pre-seeded with rake from historical SETTLED markets
//     m_match4_kills:        rake = 200_000
//     m_finals_winner_lw:    rake = 500_000 + 1 dust = 500_001
//     m_dust_demo:           rake = 50_267 + 1 dust = 50_268
//     m_solo_void:           rake = 0 (full refund)
//     plus rounded total of older settled history we don't model = 1_249_731
//     = 2_000_000 kobo round number

export const SEED_WALLETS: {
  id: string;
  user_id: string;
  balance_kobo: number;
  locked_kobo: number;
  balance_purchased_kobo: number;
  balance_won_kobo: number;
  balance_gift_kobo: number;
  status: "ACTIVE" | "FROZEN";
}[] = [
  {
    id: "w_house",
    user_id: "house",
    balance_kobo: 2_000_000,
    locked_kobo: 0,
    balance_purchased_kobo: 0,
    balance_won_kobo: 2_000_000, // book "won" by the house from rake
    balance_gift_kobo: 0,
    status: "ACTIVE",
  },
  {
    id: "w_player_1",
    user_id: "player_1",
    balance_kobo: 3_150_000,
    locked_kobo: 0,
    balance_purchased_kobo: 2_500_000,
    balance_won_kobo: 600_000,
    balance_gift_kobo: 50_000,
    status: "ACTIVE",
  },
  {
    id: "w_player_2",
    user_id: "player_2",
    balance_kobo: 0,
    locked_kobo: 0,
    balance_purchased_kobo: 0,
    balance_won_kobo: 0,
    balance_gift_kobo: 0,
    status: "ACTIVE",
  },
  {
    id: "w_player_3",
    user_id: "player_3",
    balance_kobo: 10_000_000,
    locked_kobo: 0,
    balance_purchased_kobo: 1_817_143,
    balance_won_kobo: 8_182_857, // recent big winner
    balance_gift_kobo: 0,
    status: "ACTIVE",
  },
  {
    id: "w_player_4",
    user_id: "player_4",
    balance_kobo: 1_500_000,
    locked_kobo: 0,
    balance_purchased_kobo: 1_500_000,
    balance_won_kobo: 0,
    balance_gift_kobo: 0,
    status: "ACTIVE",
  },
  {
    id: "w_player_5",
    user_id: "player_5",
    balance_kobo: 750_000,
    locked_kobo: 0,
    balance_purchased_kobo: 500_000,
    balance_won_kobo: 250_000,
    balance_gift_kobo: 0,
    status: "ACTIVE",
  },
  {
    id: "w_wager_admin_jane",
    user_id: "wager_admin_jane",
    balance_kobo: 500_000,
    locked_kobo: 0,
    balance_purchased_kobo: 500_000,
    balance_won_kobo: 0,
    balance_gift_kobo: 0,
    status: "ACTIVE",
  },
  {
    id: "w_wallet_admin_kofi",
    user_id: "wallet_admin_kofi",
    balance_kobo: 500_000,
    locked_kobo: 0,
    balance_purchased_kobo: 500_000,
    balance_won_kobo: 0,
    balance_gift_kobo: 0,
    status: "ACTIVE",
  },
  {
    id: "w_head_admin_jay",
    user_id: "head_admin_jay",
    balance_kobo: 500_000,
    locked_kobo: 0,
    balance_purchased_kobo: 500_000,
    balance_won_kobo: 0,
    balance_gift_kobo: 0,
    status: "ACTIVE",
  },
];

// ---------- Wallet TXN history ----------
// Minimum credit/debit history to back current balances. Idempotency
// keys must be globally unique.

export const SEED_TXNS: WalletTxn[] = [
  // House — accumulated rake from historical settled markets
  {
    id: "txn_house_rake_001",
    wallet_id: "w_house",
    amount_kobo: 200_000,
    kind: "HOUSE_RAKE",
    source_tag: "WON",
    ref_type: "settlement",
    ref_id: "set_match4_kills",
    fx_snapshot_id: FX_ID,
    idempotency_key: "house-rake-set_match4_kills",
    created_at: iso(-7 * DAY),
  },
  {
    id: "txn_house_rake_002",
    wallet_id: "w_house",
    amount_kobo: 500_001,
    kind: "HOUSE_RAKE",
    source_tag: "WON",
    ref_type: "settlement",
    ref_id: "set_finals_winner_lw",
    fx_snapshot_id: FX_ID,
    idempotency_key: "house-rake-set_finals_winner_lw",
    created_at: iso(-7 * DAY),
  },
  {
    id: "txn_house_rake_003",
    wallet_id: "w_house",
    amount_kobo: 50_268,
    kind: "HOUSE_RAKE",
    source_tag: "WON",
    ref_type: "settlement",
    ref_id: "set_dust_demo",
    fx_snapshot_id: FX_ID,
    idempotency_key: "house-rake-set_dust_demo",
    created_at: iso(-7 * DAY),
  },
  {
    id: "txn_house_rake_historical",
    wallet_id: "w_house",
    amount_kobo: 1_249_731,
    kind: "HOUSE_RAKE",
    source_tag: "WON",
    ref_type: "adjustment",
    ref_id: "seed_pre_history",
    fx_snapshot_id: FX_ID,
    idempotency_key: "house-rake-historical-seed",
    created_at: iso(-30 * DAY),
  },

  // player_1 — 50 purchased + 12 won + 1 gift, post-loss history
  {
    id: "txn_p1_dep_1",
    wallet_id: "w_player_1",
    amount_kobo: 4_000_000, // 80 coins purchased originally
    kind: "DEPOSIT_PAYSTACK",
    source_tag: "PURCHASED",
    ref_type: "deposit",
    ref_id: "dep_p1_001",
    fx_snapshot_id: FX_ID,
    idempotency_key: "dep-p1-001",
    created_at: iso(-15 * DAY),
  },
  {
    id: "txn_p1_lost_finals",
    wallet_id: "w_player_1",
    amount_kobo: -500_000,
    kind: "WAGER_PLACE",
    source_tag: "PURCHASED",
    ref_type: "wager",
    ref_id: "wgr_p1_finals_lw",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-place-wgr_p1_finals_lw",
    created_at: iso(-7 * DAY - 6 * HR),
  },
  {
    id: "txn_p1_lost_match4",
    wallet_id: "w_player_1",
    amount_kobo: -1_000_000,
    kind: "WAGER_PLACE",
    source_tag: "PURCHASED",
    ref_type: "wager",
    ref_id: "wgr_p1_match4_kills",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-place-wgr_p1_match4_kills",
    created_at: iso(-7 * DAY - 8 * HR),
  },
  {
    id: "txn_p1_dust_loss",
    wallet_id: "w_player_1",
    amount_kobo: -100,
    kind: "WAGER_PLACE",
    source_tag: "PURCHASED",
    ref_type: "wager",
    ref_id: "wgr_p1_dust",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-place-wgr_p1_dust",
    created_at: iso(-7 * DAY - 4 * HR),
  },
  {
    id: "txn_p1_dust_payout",
    wallet_id: "w_player_1",
    amount_kobo: 159_180,
    kind: "WAGER_PAYOUT",
    source_tag: "WON",
    ref_type: "settlement",
    ref_id: "set_dust_demo",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-payout-line_p1_dust",
    created_at: iso(-7 * DAY),
  },
  {
    id: "txn_p1_voucher",
    wallet_id: "w_player_1",
    amount_kobo: 50_000,
    kind: "DEPOSIT_VOUCHER",
    source_tag: "GIFT",
    ref_type: "voucher",
    ref_id: "v_welcome500",
    fx_snapshot_id: FX_ID,
    idempotency_key: "voucher-redeem-v_welcome500-player_1",
    created_at: iso(-14 * DAY),
  },
  {
    id: "txn_p1_balance_adjust",
    wallet_id: "w_player_1",
    amount_kobo: 440_920,
    kind: "ADJUSTMENT",
    source_tag: "WON",
    ref_type: "adjustment",
    ref_id: "seed_balance_top",
    fx_snapshot_id: FX_ID,
    idempotency_key: "adj-p1-seed-top",
    created_at: iso(-7 * DAY + 10 * MIN),
  },

  // player_2 — empty wallet, but had a deposit that got entirely consumed
  {
    id: "txn_p2_dep_1",
    wallet_id: "w_player_2",
    amount_kobo: 1_000_000,
    kind: "DEPOSIT_PAYSTACK",
    source_tag: "PURCHASED",
    ref_type: "deposit",
    ref_id: "dep_p2_001",
    fx_snapshot_id: FX_ID,
    idempotency_key: "dep-p2-001",
    created_at: iso(-12 * DAY),
  },
  {
    id: "txn_p2_lost_finals",
    wallet_id: "w_player_2",
    amount_kobo: -1_000_000,
    kind: "WAGER_PLACE",
    source_tag: "PURCHASED",
    ref_type: "wager",
    ref_id: "wgr_p2_finals_lw",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-place-wgr_p2_finals_lw",
    created_at: iso(-7 * DAY - 6 * HR),
  },
  {
    id: "txn_p2_dust_loss",
    wallet_id: "w_player_2",
    amount_kobo: -200,
    kind: "WAGER_PLACE",
    source_tag: "PURCHASED",
    ref_type: "wager",
    ref_id: "wgr_p2_dust",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-place-wgr_p2_dust",
    created_at: iso(-7 * DAY - 4 * HR),
  },
  {
    id: "txn_p2_dust_payout",
    wallet_id: "w_player_2",
    amount_kobo: 318_361,
    kind: "WAGER_PAYOUT",
    source_tag: "WON",
    ref_type: "settlement",
    ref_id: "set_dust_demo",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-payout-line_p2_dust",
    created_at: iso(-7 * DAY),
  },
  {
    id: "txn_p2_drained",
    wallet_id: "w_player_2",
    amount_kobo: -318_161,
    kind: "ADJUSTMENT",
    source_tag: "WON",
    ref_type: "adjustment",
    ref_id: "seed_balance_drain",
    fx_snapshot_id: FX_ID,
    idempotency_key: "adj-p2-seed-drain",
    created_at: iso(-3 * DAY),
  },

  // player_3 — recent big winner
  {
    id: "txn_p3_dep_1",
    wallet_id: "w_player_3",
    amount_kobo: 5_000_000,
    kind: "DEPOSIT_PAYSTACK",
    source_tag: "PURCHASED",
    ref_type: "deposit",
    ref_id: "dep_p3_001",
    fx_snapshot_id: FX_ID,
    idempotency_key: "dep-p3-001",
    created_at: iso(-20 * DAY),
  },
  {
    id: "txn_p3_lost_match4",
    wallet_id: "w_player_3",
    amount_kobo: -2_000_000,
    kind: "WAGER_PLACE",
    source_tag: "PURCHASED",
    ref_type: "wager",
    ref_id: "wgr_p3_match4_kills",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-place-wgr_p3_match4_kills",
    created_at: iso(-7 * DAY - 8 * HR),
  },
  {
    id: "txn_p3_payout_match4",
    wallet_id: "w_player_3",
    amount_kobo: 3_040_000,
    kind: "WAGER_PAYOUT",
    source_tag: "WON",
    ref_type: "settlement",
    ref_id: "set_match4_kills",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-payout-line_p3_match4",
    created_at: iso(-7 * DAY),
  },
  {
    id: "txn_p3_lost_finals_place",
    wallet_id: "w_player_3",
    amount_kobo: -3_000_000,
    kind: "WAGER_PLACE",
    source_tag: "PURCHASED",
    ref_type: "wager",
    ref_id: "wgr_p3_finals_lw",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-place-wgr_p3_finals_lw",
    created_at: iso(-7 * DAY - 6 * HR),
  },
  {
    id: "txn_p3_payout_finals",
    wallet_id: "w_player_3",
    amount_kobo: 8_142_857,
    kind: "WAGER_PAYOUT",
    source_tag: "WON",
    ref_type: "settlement",
    ref_id: "set_finals_winner_lw",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-payout-line_p3_finals",
    created_at: iso(-7 * DAY),
  },
  {
    id: "txn_p3_dust_win_place",
    wallet_id: "w_player_3",
    amount_kobo: -300,
    kind: "WAGER_PLACE",
    source_tag: "PURCHASED",
    ref_type: "wager",
    ref_id: "wgr_p3_dust",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-place-wgr_p3_dust",
    created_at: iso(-7 * DAY - 4 * HR),
  },
  {
    id: "txn_p3_dust_payout",
    wallet_id: "w_player_3",
    amount_kobo: 477_541,
    kind: "WAGER_PAYOUT",
    source_tag: "WON",
    ref_type: "settlement",
    ref_id: "set_dust_demo",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-payout-line_p3_dust",
    created_at: iso(-7 * DAY),
  },
  {
    id: "txn_p3_settle_smoothing",
    wallet_id: "w_player_3",
    amount_kobo: -1_660_098,
    kind: "ADJUSTMENT",
    source_tag: "WON",
    ref_type: "adjustment",
    ref_id: "seed_balance_smoothing",
    fx_snapshot_id: FX_ID,
    idempotency_key: "adj-p3-seed-smoothing",
    created_at: iso(-3 * DAY),
  },

  // player_4 — small winner via finals_winner_lw, lost on match4_kills
  {
    id: "txn_p4_dep_1",
    wallet_id: "w_player_4",
    amount_kobo: 1_500_000,
    kind: "DEPOSIT_PAYSTACK",
    source_tag: "PURCHASED",
    ref_type: "deposit",
    ref_id: "dep_p4_001",
    fx_snapshot_id: FX_ID,
    idempotency_key: "dep-p4-001",
    created_at: iso(-10 * DAY),
  },
  {
    id: "txn_p4_match4_place",
    wallet_id: "w_player_4",
    amount_kobo: -500_000,
    kind: "WAGER_PLACE",
    source_tag: "PURCHASED",
    ref_type: "wager",
    ref_id: "wgr_p4_match4_kills",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-place-wgr_p4_match4_kills",
    created_at: iso(-7 * DAY - 8 * HR),
  },
  {
    id: "txn_p4_match4_payout",
    wallet_id: "w_player_4",
    amount_kobo: 760_000,
    kind: "WAGER_PAYOUT",
    source_tag: "WON",
    ref_type: "settlement",
    ref_id: "set_match4_kills",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-payout-line_p4_match4",
    created_at: iso(-7 * DAY),
  },
  {
    id: "txn_p4_finals_place",
    wallet_id: "w_player_4",
    amount_kobo: -500_000,
    kind: "WAGER_PLACE",
    source_tag: "PURCHASED",
    ref_type: "wager",
    ref_id: "wgr_p4_finals_lw",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-place-wgr_p4_finals_lw",
    created_at: iso(-7 * DAY - 6 * HR),
  },
  {
    id: "txn_p4_finals_payout",
    wallet_id: "w_player_4",
    amount_kobo: 1_357_142,
    kind: "WAGER_PAYOUT",
    source_tag: "WON",
    ref_type: "settlement",
    ref_id: "set_finals_winner_lw",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-payout-line_p4_finals",
    created_at: iso(-7 * DAY),
  },
  {
    id: "txn_p4_solo_void_place",
    wallet_id: "w_player_4",
    amount_kobo: -1_500_000,
    kind: "WAGER_PLACE",
    source_tag: "PURCHASED",
    ref_type: "wager",
    ref_id: "wgr_p4_solo_void",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-place-wgr_p4_solo_void",
    created_at: iso(-7 * DAY - 2 * HR),
  },
  {
    id: "txn_p4_solo_refund",
    wallet_id: "w_player_4",
    amount_kobo: 1_500_000,
    kind: "WAGER_REFUND",
    source_tag: "PURCHASED",
    ref_type: "settlement",
    ref_id: "set_solo_void",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-refund-line_p4_solo",
    created_at: iso(-7 * DAY),
  },
  {
    id: "txn_p4_smoothing",
    wallet_id: "w_player_4",
    amount_kobo: -117_142,
    kind: "ADJUSTMENT",
    source_tag: "WON",
    ref_type: "adjustment",
    ref_id: "seed_balance_smoothing",
    fx_snapshot_id: FX_ID,
    idempotency_key: "adj-p4-seed-smoothing",
    created_at: iso(-3 * DAY),
  },

  // player_5 — lost on finals, small remainder
  {
    id: "txn_p5_dep_1",
    wallet_id: "w_player_5",
    amount_kobo: 5_500_000,
    kind: "DEPOSIT_PAYSTACK",
    source_tag: "PURCHASED",
    ref_type: "deposit",
    ref_id: "dep_p5_001",
    fx_snapshot_id: FX_ID,
    idempotency_key: "dep-p5-001",
    created_at: iso(-15 * DAY),
  },
  {
    id: "txn_p5_match4_place",
    wallet_id: "w_player_5",
    amount_kobo: -500_000,
    kind: "WAGER_PLACE",
    source_tag: "PURCHASED",
    ref_type: "wager",
    ref_id: "wgr_p5_match4_kills",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-place-wgr_p5_match4_kills",
    created_at: iso(-7 * DAY - 8 * HR),
  },
  {
    id: "txn_p5_finals_place",
    wallet_id: "w_player_5",
    amount_kobo: -5_000_000,
    kind: "WAGER_PLACE",
    source_tag: "PURCHASED",
    ref_type: "wager",
    ref_id: "wgr_p5_finals_lw",
    fx_snapshot_id: FX_ID,
    idempotency_key: "wager-place-wgr_p5_finals_lw",
    created_at: iso(-7 * DAY - 6 * HR),
  },
  {
    id: "txn_p5_smoothing",
    wallet_id: "w_player_5",
    amount_kobo: 750_000,
    kind: "ADJUSTMENT",
    source_tag: "WON",
    ref_type: "adjustment",
    ref_id: "seed_balance_smoothing",
    fx_snapshot_id: FX_ID,
    idempotency_key: "adj-p5-seed-smoothing",
    created_at: iso(-3 * DAY),
  },

  // Admin starter deposits
  {
    id: "txn_jane_dep",
    wallet_id: "w_wager_admin_jane",
    amount_kobo: 500_000,
    kind: "DEPOSIT_PAYSTACK",
    source_tag: "PURCHASED",
    ref_type: "deposit",
    ref_id: "dep_jane_001",
    fx_snapshot_id: FX_ID,
    idempotency_key: "dep-jane-001",
    created_at: iso(-30 * DAY),
  },
  {
    id: "txn_kofi_dep",
    wallet_id: "w_wallet_admin_kofi",
    amount_kobo: 500_000,
    kind: "DEPOSIT_PAYSTACK",
    source_tag: "PURCHASED",
    ref_type: "deposit",
    ref_id: "dep_kofi_001",
    fx_snapshot_id: FX_ID,
    idempotency_key: "dep-kofi-001",
    created_at: iso(-30 * DAY),
  },
  {
    id: "txn_jay_dep",
    wallet_id: "w_head_admin_jay",
    amount_kobo: 500_000,
    kind: "DEPOSIT_PAYSTACK",
    source_tag: "PURCHASED",
    ref_type: "deposit",
    ref_id: "dep_jay_001",
    fx_snapshot_id: FX_ID,
    idempotency_key: "dep-jay-001",
    created_at: iso(-30 * DAY),
  },
];

// ---------- Events ----------

export const SEED_EVENTS: {
  id: string;
  slug: string;
  name: string;
  status: "upcoming" | "ongoing" | "completed";
  start_at: string;
}[] = [
  {
    id: "e_champs_finals",
    slug: "afc-champs-finals",
    name: "AFC Champs Finals",
    status: "ongoing",
    start_at: iso(-2 * HR),
  },
  {
    id: "e_wed_scrim",
    slug: "afc-wed-scrim",
    name: "AFC Wed Scrim",
    status: "upcoming",
    start_at: iso(2 * DAY),
  },
  {
    id: "e_last_week_cup",
    slug: "afc-last-week-cup",
    name: "AFC Last Week Cup",
    status: "completed",
    start_at: iso(-10 * DAY),
  },
];

// ---------- Markets + Options ----------
//
// 12 markets:
//   OPEN (5): m_match5_winner (locks +12m HOT), m_first_blood_finals,
//             m_mvp_finals, m_top3_finals, m_total_kills_finals
//   LOCKED (2): m_match4_winner_finals, m_match4_first_blood_finals
//   SETTLED (4): m_match4_kills, m_dust_demo, m_solo_void,
//                m_finals_winner_lw
//   DRAFT (1): m_wed_scrim_winner
//
// Lock-at math: relative to NOW_MS so a fresh seed always shows hot countdown.

export const SEED_MARKETS: Market[] = [
  // ----- OPEN markets in champs finals -----
  {
    id: "m_match5_winner",
    event_id: "e_champs_finals",
    match_id: "match_5",
    template_code: "match_winner",
    title: "Match 5 Winner",
    description: "Pick the team that wins Match 5 of the AFC Champs Finals.",
    status: "OPEN",
    opens_at: iso(-1 * HR),
    lock_at: iso(12 * MIN), // HOT countdown
    min_stake_kobo: 10_000,
    max_per_user_kobo: 5_000_000,
    cancel_fee_bps: 100,
    rake_bps: 500,
    suggested_option_id: null,
    winning_option_id: null,
    total_pool_kobo: 0,
    total_lines: 0,
    options: [], // populated by SEED_OPTIONS lookup at runtime
    created_by_admin_id: "wager_admin_jane",
  },
  {
    id: "m_first_blood_finals",
    event_id: "e_champs_finals",
    match_id: "match_5",
    template_code: "first_blood",
    title: "First Blood — Match 5",
    description: "Which team draws first blood in the deciding match?",
    status: "OPEN",
    opens_at: iso(-1 * HR),
    lock_at: iso(30 * MIN),
    min_stake_kobo: 10_000,
    max_per_user_kobo: 2_000_000,
    cancel_fee_bps: 100,
    rake_bps: 500,
    suggested_option_id: null,
    winning_option_id: null,
    total_pool_kobo: 0,
    total_lines: 0,
    options: [],
    created_by_admin_id: "wager_admin_jane",
  },
  {
    id: "m_mvp_finals",
    event_id: "e_champs_finals",
    match_id: null,
    template_code: "mvp",
    title: "Tournament MVP",
    description: "Most Valuable Player across the entire AFC Champs Finals.",
    status: "OPEN",
    opens_at: iso(-2 * HR),
    lock_at: iso(1 * HR),
    min_stake_kobo: 10_000,
    max_per_user_kobo: 3_000_000,
    cancel_fee_bps: 100,
    rake_bps: 500,
    suggested_option_id: null,
    winning_option_id: null,
    total_pool_kobo: 0,
    total_lines: 0,
    options: [],
    created_by_admin_id: "wager_admin_jane",
  },
  {
    id: "m_top3_finals",
    event_id: "e_champs_finals",
    match_id: null,
    template_code: "top_3",
    title: "Finals Top 3 Teams",
    description: "Pick the team that finishes Top 3 in the Finals.",
    status: "OPEN",
    opens_at: iso(-2 * HR),
    lock_at: iso(2 * HR),
    min_stake_kobo: 10_000,
    max_per_user_kobo: 5_000_000,
    cancel_fee_bps: 100,
    rake_bps: 500,
    suggested_option_id: null,
    winning_option_id: null,
    total_pool_kobo: 0,
    total_lines: 0,
    options: [],
    created_by_admin_id: "wager_admin_jane",
  },
  {
    id: "m_total_kills_finals",
    event_id: "e_champs_finals",
    match_id: "match_5",
    template_code: "booyah_count",
    title: "Match 5 Kill Count: Over/Under 60",
    description: "Will Match 5 finish with more or fewer than 60 total kills?",
    status: "OPEN",
    opens_at: iso(-1 * HR),
    lock_at: iso(8 * HR),
    min_stake_kobo: 10_000,
    max_per_user_kobo: 1_000_000,
    cancel_fee_bps: 100,
    rake_bps: 500,
    suggested_option_id: null,
    winning_option_id: null,
    total_pool_kobo: 0,
    total_lines: 0,
    options: [],
    created_by_admin_id: "wager_admin_jane",
  },

  // ----- LOCKED markets (awaiting settle) -----
  {
    id: "m_match4_winner_finals",
    event_id: "e_champs_finals",
    match_id: "match_4_finals",
    template_code: "match_winner",
    title: "Match 4 Winner (Finals)",
    description: "Pick the winner of Finals Match 4.",
    status: "LOCKED",
    opens_at: iso(-4 * HR),
    lock_at: iso(-30 * MIN),
    min_stake_kobo: 10_000,
    max_per_user_kobo: 5_000_000,
    cancel_fee_bps: 100,
    rake_bps: 500,
    suggested_option_id: "opt_m4w_team_a",
    winning_option_id: null,
    total_pool_kobo: 1_500_000, // 500k + 500k + 500k
    total_lines: 3,
    options: [],
    created_by_admin_id: "wager_admin_jane",
  },
  {
    id: "m_match4_first_blood_finals",
    event_id: "e_champs_finals",
    match_id: "match_4_finals",
    template_code: "first_blood",
    title: "Match 4 First Blood (Finals)",
    description: "Which team drew first blood in Finals Match 4?",
    status: "LOCKED",
    opens_at: iso(-4 * HR),
    lock_at: iso(-30 * MIN),
    min_stake_kobo: 10_000,
    max_per_user_kobo: 2_000_000,
    cancel_fee_bps: 100,
    rake_bps: 500,
    suggested_option_id: "opt_m4fb_team_b",
    winning_option_id: null,
    total_pool_kobo: 800_000, // 300k + 500k
    total_lines: 2,
    options: [],
    created_by_admin_id: "wager_admin_jane",
  },

  // ----- SETTLED markets in last week's cup -----
  {
    id: "m_match4_kills",
    event_id: "e_last_week_cup",
    match_id: "lw_match_4",
    template_code: "most_kills",
    title: "Most Kills — Match 4",
    description: "JuiceJoe took 23 kills to lock this in.",
    status: "SETTLED",
    opens_at: iso(-9 * DAY),
    lock_at: iso(-7 * DAY - 9 * HR),
    min_stake_kobo: 10_000,
    max_per_user_kobo: 5_000_000,
    cancel_fee_bps: 100,
    rake_bps: 500,
    suggested_option_id: "opt_m4k_juicejoe",
    winning_option_id: "opt_m4k_juicejoe",
    total_pool_kobo: 4_000_000,
    total_lines: 4,
    options: [],
    created_by_admin_id: "wager_admin_jane",
  },
  {
    id: "m_dust_demo",
    event_id: "e_last_week_cup",
    match_id: "lw_match_2",
    template_code: "match_winner",
    title: "Dust Demo Market",
    description: "Tiny pool to demonstrate 1-kobo dust to the house.",
    status: "SETTLED",
    opens_at: iso(-9 * DAY),
    lock_at: iso(-7 * DAY - 5 * HR),
    min_stake_kobo: 100,
    max_per_user_kobo: null,
    cancel_fee_bps: 100,
    rake_bps: 500,
    suggested_option_id: "opt_dust_winning_side",
    winning_option_id: "opt_dust_winning_side",
    total_pool_kobo: 1_005_350,
    total_lines: 4,
    options: [],
    created_by_admin_id: "wager_admin_jane",
  },
  {
    id: "m_solo_void",
    event_id: "e_last_week_cup",
    match_id: "lw_match_3",
    template_code: "match_winner",
    title: "Solo Void Demo Market",
    description: "Only one user wagered, on the winning team. VOID_SOLO_WAGER refund.",
    status: "SETTLED",
    opens_at: iso(-9 * DAY),
    lock_at: iso(-7 * DAY - 3 * HR),
    min_stake_kobo: 10_000,
    max_per_user_kobo: null,
    cancel_fee_bps: 100,
    rake_bps: 500,
    suggested_option_id: "opt_solo_team_a",
    winning_option_id: "opt_solo_team_a",
    total_pool_kobo: 1_500_000,
    total_lines: 1,
    options: [],
    created_by_admin_id: "wager_admin_jane",
  },
  {
    id: "m_finals_winner_lw",
    event_id: "e_last_week_cup",
    match_id: "lw_finals",
    template_code: "match_winner",
    title: "AFC Last Week Cup — Finals Winner",
    description: "TeamD took the cup in last week's finals.",
    status: "SETTLED",
    opens_at: iso(-9 * DAY),
    lock_at: iso(-7 * DAY - 7 * HR),
    min_stake_kobo: 10_000,
    max_per_user_kobo: 10_000_000,
    cancel_fee_bps: 100,
    rake_bps: 500,
    suggested_option_id: "opt_finals_team_d",
    winning_option_id: "opt_finals_team_d",
    total_pool_kobo: 10_000_000,
    total_lines: 5,
    options: [],
    created_by_admin_id: "wager_admin_jane",
  },

  // ----- DRAFT market (Wed scrim) -----
  {
    id: "m_wed_scrim_winner",
    event_id: "e_wed_scrim",
    match_id: null,
    template_code: "match_winner",
    title: "Wed Scrim — Match 1 Winner (DRAFT)",
    description: "Drafted but not yet open for wagering.",
    status: "DRAFT",
    opens_at: iso(2 * DAY - 1 * HR),
    lock_at: iso(2 * DAY + 30 * MIN),
    min_stake_kobo: 10_000,
    max_per_user_kobo: 2_000_000,
    cancel_fee_bps: 100,
    rake_bps: 500,
    suggested_option_id: null,
    winning_option_id: null,
    total_pool_kobo: 0,
    total_lines: 0,
    options: [],
    created_by_admin_id: "wager_admin_jane",
  },
];

// ---------- Market Options ----------
// Helper for boilerplate: fills sort_order, default null refs, no image.

function mkOpt(
  id: string,
  market_id: string,
  label: string,
  sort_order: number,
  cached_pool_kobo: number,
  cached_wager_count: number,
  ref_team_id: string | null = null,
  ref_player_id: string | null = null,
  ref_numeric: number | null = null,
): MarketOption {
  return {
    id,
    market_id,
    label,
    ref_team_id,
    ref_player_id,
    ref_numeric,
    image: null,
    sort_order,
    cached_pool_kobo,
    cached_wager_count,
  };
}

export const SEED_OPTIONS: MarketOption[] = [
  // m_match5_winner — 4 teams, OPEN, no wagers yet
  mkOpt("opt_m5w_team_a", "m_match5_winner", "Team Alpha", 0, 0, 0, "team_a"),
  mkOpt("opt_m5w_team_b", "m_match5_winner", "Team Bravo", 1, 0, 0, "team_b"),
  mkOpt("opt_m5w_team_c", "m_match5_winner", "Team Charlie", 2, 0, 0, "team_c"),
  mkOpt("opt_m5w_team_d", "m_match5_winner", "Team Delta", 3, 0, 0, "team_d"),

  // m_first_blood_finals — 4 teams, OPEN, no wagers
  mkOpt("opt_fbf_team_a", "m_first_blood_finals", "Team Alpha", 0, 0, 0, "team_a"),
  mkOpt("opt_fbf_team_b", "m_first_blood_finals", "Team Bravo", 1, 0, 0, "team_b"),
  mkOpt("opt_fbf_team_c", "m_first_blood_finals", "Team Charlie", 2, 0, 0, "team_c"),
  mkOpt("opt_fbf_team_d", "m_first_blood_finals", "Team Delta", 3, 0, 0, "team_d"),

  // m_mvp_finals — 4 players
  mkOpt("opt_mvp_juicejoe", "m_mvp_finals", "JuiceJoe", 0, 0, 0, null, "p_juicejoe"),
  mkOpt("opt_mvp_kappa", "m_mvp_finals", "Kappa", 1, 0, 0, null, "p_kappa"),
  mkOpt("opt_mvp_skyfire", "m_mvp_finals", "Skyfire", 2, 0, 0, null, "p_skyfire"),
  mkOpt("opt_mvp_phantom", "m_mvp_finals", "Phantom", 3, 0, 0, null, "p_phantom"),

  // m_top3_finals — 4 teams (any of these can be top-3)
  mkOpt("opt_t3_team_a", "m_top3_finals", "Team Alpha", 0, 0, 0, "team_a"),
  mkOpt("opt_t3_team_b", "m_top3_finals", "Team Bravo", 1, 0, 0, "team_b"),
  mkOpt("opt_t3_team_c", "m_top3_finals", "Team Charlie", 2, 0, 0, "team_c"),
  mkOpt("opt_t3_team_d", "m_top3_finals", "Team Delta", 3, 0, 0, "team_d"),

  // m_total_kills_finals — binary
  mkOpt("opt_tk_over_60", "m_total_kills_finals", "Over 60 kills", 0, 0, 0, null, null, 60.5),
  mkOpt("opt_tk_under_60", "m_total_kills_finals", "Under 60 kills", 1, 0, 0, null, null, 59.5),

  // m_match4_winner_finals — LOCKED, 4 teams, with wagers
  mkOpt(
    "opt_m4w_team_a",
    "m_match4_winner_finals",
    "Team Alpha",
    0,
    1_000_000,
    2,
    "team_a",
  ),
  mkOpt(
    "opt_m4w_team_b",
    "m_match4_winner_finals",
    "Team Bravo",
    1,
    500_000,
    1,
    "team_b",
  ),
  mkOpt("opt_m4w_team_c", "m_match4_winner_finals", "Team Charlie", 2, 0, 0, "team_c"),
  mkOpt("opt_m4w_team_d", "m_match4_winner_finals", "Team Delta", 3, 0, 0, "team_d"),

  // m_match4_first_blood_finals — LOCKED
  mkOpt(
    "opt_m4fb_team_a",
    "m_match4_first_blood_finals",
    "Team Alpha",
    0,
    300_000,
    1,
    "team_a",
  ),
  mkOpt(
    "opt_m4fb_team_b",
    "m_match4_first_blood_finals",
    "Team Bravo",
    1,
    500_000,
    1,
    "team_b",
  ),
  mkOpt("opt_m4fb_team_c", "m_match4_first_blood_finals", "Team Charlie", 2, 0, 0, "team_c"),
  mkOpt("opt_m4fb_team_d", "m_match4_first_blood_finals", "Team Delta", 3, 0, 0, "team_d"),

  // m_match4_kills — SETTLED, JuiceJoe wins
  mkOpt(
    "opt_m4k_juicejoe",
    "m_match4_kills",
    "JuiceJoe (23 kills)",
    0,
    2_500_000, // player_3 + player_4
    2,
    null,
    "p_juicejoe",
  ),
  mkOpt(
    "opt_m4k_kappa",
    "m_match4_kills",
    "Kappa",
    1,
    1_000_000, // player_1 lost
    1,
    null,
    "p_kappa",
  ),
  mkOpt(
    "opt_m4k_skyfire",
    "m_match4_kills",
    "Skyfire",
    2,
    0,
    0,
    null,
    "p_skyfire",
  ),
  mkOpt(
    "opt_m4k_phantom",
    "m_match4_kills",
    "Phantom",
    3,
    500_000, // player_5 lost
    1,
    null,
    "p_phantom",
  ),

  // m_dust_demo — SETTLED, "winning side" wins. 4 lines, dust scenario
  mkOpt(
    "opt_dust_winning_side",
    "m_dust_demo",
    "Winning Side",
    0,
    600, // 100 + 200 + 300 (player_1, player_2, player_3)
    3,
    "team_w",
  ),
  mkOpt(
    "opt_dust_losing_side",
    "m_dust_demo",
    "Losing Side",
    1,
    1_004_750, // player_5 lost a chunk
    1,
    "team_l",
  ),

  // m_solo_void — SETTLED
  mkOpt(
    "opt_solo_team_a",
    "m_solo_void",
    "Team Alpha",
    0,
    1_500_000, // player_4 only
    1,
    "team_a",
  ),
  mkOpt("opt_solo_team_b", "m_solo_void", "Team Bravo", 1, 0, 0, "team_b"),

  // m_finals_winner_lw — SETTLED, 4 teams
  mkOpt(
    "opt_finals_team_a",
    "m_finals_winner_lw",
    "Team Alpha",
    0,
    500_000, // player_1 lost
    1,
    "team_a",
  ),
  mkOpt(
    "opt_finals_team_b",
    "m_finals_winner_lw",
    "Team Bravo",
    1,
    1_000_000, // player_2 lost
    1,
    "team_b",
  ),
  mkOpt(
    "opt_finals_team_c",
    "m_finals_winner_lw",
    "Team Charlie",
    2,
    5_000_000, // player_5 lost
    1,
    "team_c",
  ),
  mkOpt(
    "opt_finals_team_d",
    "m_finals_winner_lw",
    "Team Delta (Winner)",
    3,
    3_500_000, // player_3 (3M) + player_4 (500k)
    2,
    "team_d",
  ),

  // m_wed_scrim_winner — DRAFT, 2 placeholder teams
  mkOpt("opt_ws_team_x", "m_wed_scrim_winner", "Team X", 0, 0, 0, "team_x"),
  mkOpt("opt_ws_team_y", "m_wed_scrim_winner", "Team Y", 1, 0, 0, "team_y"),
];

// ---------- Wagers + Wager lines ----------
//
// Per spec invariants:
//   - Wager.total_stake_kobo == sum(WagerLine.stake_kobo) per wager
//   - sum(WagerLine.stake_kobo across market) == Market.total_pool_kobo
//     for SETTLED + LOCKED markets

export const SEED_WAGERS: Wager[] = [
  // ===== LOCKED: m_match4_winner_finals (pool 1_500_000) =====
  {
    id: "wgr_p1_m4w",
    user_id: "player_1",
    market_id: "m_match4_winner_finals",
    total_stake_kobo: 500_000,
    status: "ACTIVE",
    placed_at: iso(-3 * HR),
    cancelled_at: null,
    debit_txn_id: "txn_p1_locked_m4w_place", // synthetic — not in SEED_TXNS for brevity
    lines: [],
  },
  {
    id: "wgr_p3_m4w",
    user_id: "player_3",
    market_id: "m_match4_winner_finals",
    total_stake_kobo: 500_000,
    status: "ACTIVE",
    placed_at: iso(-3 * HR + 5 * MIN),
    cancelled_at: null,
    debit_txn_id: "txn_p3_locked_m4w_place",
    lines: [],
  },
  {
    id: "wgr_p4_m4w",
    user_id: "player_4",
    market_id: "m_match4_winner_finals",
    total_stake_kobo: 500_000,
    status: "ACTIVE",
    placed_at: iso(-3 * HR + 10 * MIN),
    cancelled_at: null,
    debit_txn_id: "txn_p4_locked_m4w_place",
    lines: [],
  },

  // ===== LOCKED: m_match4_first_blood_finals (pool 800_000) =====
  {
    id: "wgr_p2_m4fb",
    user_id: "player_2",
    market_id: "m_match4_first_blood_finals",
    total_stake_kobo: 300_000,
    status: "ACTIVE",
    placed_at: iso(-3 * HR + 15 * MIN),
    cancelled_at: null,
    debit_txn_id: "txn_p2_locked_m4fb_place",
    lines: [],
  },
  {
    id: "wgr_p5_m4fb",
    user_id: "player_5",
    market_id: "m_match4_first_blood_finals",
    total_stake_kobo: 500_000,
    status: "ACTIVE",
    placed_at: iso(-3 * HR + 20 * MIN),
    cancelled_at: null,
    debit_txn_id: "txn_p5_locked_m4fb_place",
    lines: [],
  },

  // ===== SETTLED: m_match4_kills (pool 4_000_000) =====
  {
    id: "wgr_p3_match4_kills",
    user_id: "player_3",
    market_id: "m_match4_kills",
    total_stake_kobo: 2_000_000,
    status: "SETTLED",
    placed_at: iso(-7 * DAY - 8 * HR),
    cancelled_at: null,
    debit_txn_id: "txn_p3_lost_match4",
    lines: [],
  },
  {
    id: "wgr_p4_match4_kills",
    user_id: "player_4",
    market_id: "m_match4_kills",
    total_stake_kobo: 500_000,
    status: "SETTLED",
    placed_at: iso(-7 * DAY - 8 * HR + 5 * MIN),
    cancelled_at: null,
    debit_txn_id: "txn_p4_match4_place",
    lines: [],
  },
  {
    id: "wgr_p1_match4_kills",
    user_id: "player_1",
    market_id: "m_match4_kills",
    total_stake_kobo: 1_000_000,
    status: "SETTLED",
    placed_at: iso(-7 * DAY - 8 * HR + 10 * MIN),
    cancelled_at: null,
    debit_txn_id: "txn_p1_lost_match4",
    lines: [],
  },
  {
    id: "wgr_p5_match4_kills",
    user_id: "player_5",
    market_id: "m_match4_kills",
    total_stake_kobo: 500_000,
    status: "SETTLED",
    placed_at: iso(-7 * DAY - 8 * HR + 15 * MIN),
    cancelled_at: null,
    debit_txn_id: "txn_p5_match4_place",
    lines: [],
  },

  // ===== SETTLED: m_dust_demo (pool 1_005_350) =====
  {
    id: "wgr_p1_dust",
    user_id: "player_1",
    market_id: "m_dust_demo",
    total_stake_kobo: 100,
    status: "SETTLED",
    placed_at: iso(-7 * DAY - 4 * HR),
    cancelled_at: null,
    debit_txn_id: "txn_p1_dust_loss",
    lines: [],
  },
  {
    id: "wgr_p2_dust",
    user_id: "player_2",
    market_id: "m_dust_demo",
    total_stake_kobo: 200,
    status: "SETTLED",
    placed_at: iso(-7 * DAY - 4 * HR + 1 * MIN),
    cancelled_at: null,
    debit_txn_id: "txn_p2_dust_loss",
    lines: [],
  },
  {
    id: "wgr_p3_dust",
    user_id: "player_3",
    market_id: "m_dust_demo",
    total_stake_kobo: 300,
    status: "SETTLED",
    placed_at: iso(-7 * DAY - 4 * HR + 2 * MIN),
    cancelled_at: null,
    debit_txn_id: "txn_p3_dust_win_place",
    lines: [],
  },
  {
    id: "wgr_p5_dust_loser",
    user_id: "player_5",
    market_id: "m_dust_demo",
    total_stake_kobo: 1_004_750,
    status: "SETTLED",
    placed_at: iso(-7 * DAY - 4 * HR + 3 * MIN),
    cancelled_at: null,
    debit_txn_id: "txn_p5_dust_loser_place", // synthetic
    lines: [],
  },

  // ===== SETTLED: m_solo_void (pool 1_500_000) =====
  {
    id: "wgr_p4_solo_void",
    user_id: "player_4",
    market_id: "m_solo_void",
    total_stake_kobo: 1_500_000,
    status: "VOIDED",
    placed_at: iso(-7 * DAY - 2 * HR),
    cancelled_at: null,
    debit_txn_id: "txn_p4_solo_void_place",
    lines: [],
  },

  // ===== SETTLED: m_finals_winner_lw (pool 10_000_000) =====
  {
    id: "wgr_p1_finals_lw",
    user_id: "player_1",
    market_id: "m_finals_winner_lw",
    total_stake_kobo: 500_000,
    status: "SETTLED",
    placed_at: iso(-7 * DAY - 6 * HR),
    cancelled_at: null,
    debit_txn_id: "txn_p1_lost_finals",
    lines: [],
  },
  {
    id: "wgr_p2_finals_lw",
    user_id: "player_2",
    market_id: "m_finals_winner_lw",
    total_stake_kobo: 1_000_000,
    status: "SETTLED",
    placed_at: iso(-7 * DAY - 6 * HR + 5 * MIN),
    cancelled_at: null,
    debit_txn_id: "txn_p2_lost_finals",
    lines: [],
  },
  {
    id: "wgr_p3_finals_lw",
    user_id: "player_3",
    market_id: "m_finals_winner_lw",
    total_stake_kobo: 3_000_000,
    status: "SETTLED",
    placed_at: iso(-7 * DAY - 6 * HR + 10 * MIN),
    cancelled_at: null,
    debit_txn_id: "txn_p3_lost_finals_place",
    lines: [],
  },
  {
    id: "wgr_p4_finals_lw",
    user_id: "player_4",
    market_id: "m_finals_winner_lw",
    total_stake_kobo: 500_000,
    status: "SETTLED",
    placed_at: iso(-7 * DAY - 6 * HR + 15 * MIN),
    cancelled_at: null,
    debit_txn_id: "txn_p4_finals_place",
    lines: [],
  },
  {
    id: "wgr_p5_finals_lw",
    user_id: "player_5",
    market_id: "m_finals_winner_lw",
    total_stake_kobo: 5_000_000,
    status: "SETTLED",
    placed_at: iso(-7 * DAY - 6 * HR + 20 * MIN),
    cancelled_at: null,
    debit_txn_id: "txn_p5_finals_place",
    lines: [],
  },
];

export const SEED_LINES: WagerLine[] = [
  // ===== LOCKED m_match4_winner_finals: pool 1_500_000 =====
  {
    id: "line_p1_m4w_a",
    wager_id: "wgr_p1_m4w",
    option_id: "opt_m4w_team_a",
    stake_kobo: 500_000,
    payout_kobo: null,
    outcome: null,
  },
  {
    id: "line_p3_m4w_a",
    wager_id: "wgr_p3_m4w",
    option_id: "opt_m4w_team_a",
    stake_kobo: 500_000,
    payout_kobo: null,
    outcome: null,
  },
  {
    id: "line_p4_m4w_b",
    wager_id: "wgr_p4_m4w",
    option_id: "opt_m4w_team_b",
    stake_kobo: 500_000,
    payout_kobo: null,
    outcome: null,
  },

  // ===== LOCKED m_match4_first_blood_finals: pool 800_000 =====
  {
    id: "line_p2_m4fb_a",
    wager_id: "wgr_p2_m4fb",
    option_id: "opt_m4fb_team_a",
    stake_kobo: 300_000,
    payout_kobo: null,
    outcome: null,
  },
  {
    id: "line_p5_m4fb_b",
    wager_id: "wgr_p5_m4fb",
    option_id: "opt_m4fb_team_b",
    stake_kobo: 500_000,
    payout_kobo: null,
    outcome: null,
  },

  // ===== SETTLED m_match4_kills: pool 4_000_000, JuiceJoe wins =====
  // player_3 staked 2M on JuiceJoe → won 3_040_000
  {
    id: "line_p3_m4k_jj",
    wager_id: "wgr_p3_match4_kills",
    option_id: "opt_m4k_juicejoe",
    stake_kobo: 2_000_000,
    payout_kobo: 3_040_000,
    outcome: "WIN",
  },
  // player_4 staked 500k on JuiceJoe → won 760_000
  {
    id: "line_p4_m4k_jj",
    wager_id: "wgr_p4_match4_kills",
    option_id: "opt_m4k_juicejoe",
    stake_kobo: 500_000,
    payout_kobo: 760_000,
    outcome: "WIN",
  },
  // player_1 staked 1M on Kappa → lost
  {
    id: "line_p1_m4k_kappa",
    wager_id: "wgr_p1_match4_kills",
    option_id: "opt_m4k_kappa",
    stake_kobo: 1_000_000,
    payout_kobo: 0,
    outcome: "LOSS",
  },
  // player_5 staked 500k on Phantom → lost
  {
    id: "line_p5_m4k_phantom",
    wager_id: "wgr_p5_match4_kills",
    option_id: "opt_m4k_phantom",
    stake_kobo: 500_000,
    payout_kobo: 0,
    outcome: "LOSS",
  },

  // ===== SETTLED m_dust_demo: pool 1_005_350, dust scenario =====
  // Winners: player_1 (100), player_2 (200), player_3 (300)
  // Loser: player_5 (1_004_750)
  // Rake = floor(1_005_350 * 500/10000) = 50_267
  // Net pool = 955_083
  // Winner total = 600
  // payouts: floor(stake/600 * 955_083)
  {
    id: "line_p1_dust",
    wager_id: "wgr_p1_dust",
    option_id: "opt_dust_winning_side",
    stake_kobo: 100,
    payout_kobo: 159_180, // floor(100/600 * 955083)
    outcome: "WIN",
  },
  {
    id: "line_p2_dust",
    wager_id: "wgr_p2_dust",
    option_id: "opt_dust_winning_side",
    stake_kobo: 200,
    payout_kobo: 318_361, // floor(200/600 * 955083)
    outcome: "WIN",
  },
  {
    id: "line_p3_dust",
    wager_id: "wgr_p3_dust",
    option_id: "opt_dust_winning_side",
    stake_kobo: 300,
    payout_kobo: 477_541, // floor(300/600 * 955083)
    outcome: "WIN",
  },
  {
    id: "line_p5_dust_loser",
    wager_id: "wgr_p5_dust_loser",
    option_id: "opt_dust_losing_side",
    stake_kobo: 1_004_750,
    payout_kobo: 0,
    outcome: "LOSS",
  },
  // Sum of winner payouts: 159_180 + 318_361 + 477_541 = 955_082
  // Dust = 955_083 - 955_082 = 1 → folded into rake (settlement reports rake_kobo = 50_268)

  // ===== SETTLED m_solo_void: pool 1_500_000, full refund =====
  {
    id: "line_p4_solo",
    wager_id: "wgr_p4_solo_void",
    option_id: "opt_solo_team_a",
    stake_kobo: 1_500_000,
    payout_kobo: 1_500_000, // refund
    outcome: "VOID",
  },

  // ===== SETTLED m_finals_winner_lw: pool 10_000_000, TeamD wins =====
  // Winners: player_3 (3M on D), player_4 (500k on D). Winner total = 3_500_000
  // Loser total = 6_500_000
  // Rake = floor(10M * 500/10000) = 500_000
  // Net pool = 9_500_000
  // player_3: floor(3M / 3.5M * 9.5M) = floor(8_142_857.14) = 8_142_857
  // player_4: floor(500k / 3.5M * 9.5M) = floor(1_357_142.86) = 1_357_142
  // Sum = 9_499_999. Dust = 1 → rake = 500_001
  {
    id: "line_p1_finals_a",
    wager_id: "wgr_p1_finals_lw",
    option_id: "opt_finals_team_a",
    stake_kobo: 500_000,
    payout_kobo: 0,
    outcome: "LOSS",
  },
  {
    id: "line_p2_finals_b",
    wager_id: "wgr_p2_finals_lw",
    option_id: "opt_finals_team_b",
    stake_kobo: 1_000_000,
    payout_kobo: 0,
    outcome: "LOSS",
  },
  {
    id: "line_p3_finals_d",
    wager_id: "wgr_p3_finals_lw",
    option_id: "opt_finals_team_d",
    stake_kobo: 3_000_000,
    payout_kobo: 8_142_857,
    outcome: "WIN",
  },
  {
    id: "line_p4_finals_d",
    wager_id: "wgr_p4_finals_lw",
    option_id: "opt_finals_team_d",
    stake_kobo: 500_000,
    payout_kobo: 1_357_142,
    outcome: "WIN",
  },
  {
    id: "line_p5_finals_c",
    wager_id: "wgr_p5_finals_lw",
    option_id: "opt_finals_team_c",
    stake_kobo: 5_000_000,
    payout_kobo: 0,
    outcome: "LOSS",
  },
];

// ---------- Settlements ----------

export const SEED_SETTLEMENTS: Settlement[] = [
  // m_match4_kills: pool 4_000_000, rake 200_000, paid 3_800_000, winners 2
  {
    id: "set_match4_kills",
    market_id: "m_match4_kills",
    suggested_option_id: "opt_m4k_juicejoe",
    final_option_id: "opt_m4k_juicejoe",
    resolution: "WINNER",
    override_reason: null,
    total_pool_kobo: 4_000_000,
    rake_kobo: 200_000,
    paid_out_kobo: 3_800_000,
    winners_count: 2,
    lines_count: 4,
    confirmed_by_admin_id: "wager_admin_jane",
    confirmed_at: iso(-7 * DAY),
  },
  // m_dust_demo: pool 1_005_350, rake 50_268 (50_267 + 1 dust), paid 955_082
  {
    id: "set_dust_demo",
    market_id: "m_dust_demo",
    suggested_option_id: "opt_dust_winning_side",
    final_option_id: "opt_dust_winning_side",
    resolution: "WINNER",
    override_reason: null,
    total_pool_kobo: 1_005_350,
    rake_kobo: 50_268,
    paid_out_kobo: 955_082,
    winners_count: 3,
    lines_count: 4,
    confirmed_by_admin_id: "wager_admin_jane",
    confirmed_at: iso(-7 * DAY),
  },
  // m_solo_void: pool 1_500_000, full refund (no rake, no payout)
  {
    id: "set_solo_void",
    market_id: "m_solo_void",
    suggested_option_id: "opt_solo_team_a",
    final_option_id: "opt_solo_team_a",
    resolution: "VOID_SOLO_WAGER",
    override_reason: null,
    total_pool_kobo: 1_500_000,
    rake_kobo: 0,
    paid_out_kobo: 1_500_000, // refund counted as paid_out for parity
    winners_count: 0,
    lines_count: 1,
    confirmed_by_admin_id: "wager_admin_jane",
    confirmed_at: iso(-7 * DAY),
  },
  // m_finals_winner_lw: pool 10_000_000, rake 500_001 (500_000 + 1 dust), paid 9_499_999
  {
    id: "set_finals_winner_lw",
    market_id: "m_finals_winner_lw",
    suggested_option_id: "opt_finals_team_d",
    final_option_id: "opt_finals_team_d",
    resolution: "WINNER",
    override_reason: null,
    total_pool_kobo: 10_000_000,
    rake_kobo: 500_001,
    paid_out_kobo: 9_499_999,
    winners_count: 2,
    lines_count: 5,
    confirmed_by_admin_id: "head_admin_jay",
    confirmed_at: iso(-7 * DAY),
  },
];

// ---------- Vouchers ----------

export const SEED_VOUCHERS: Voucher[] = [
  {
    id: "v_welcome500",
    code: "WELCOME500",
    amount_kobo: 50_000, // ₦500 = 1 coin
    max_uses: 100,
    used_count: 8,
    expires_at: iso(60 * DAY),
  },
  {
    id: "v_hype1k",
    code: "HYPE1K",
    amount_kobo: 100_000, // ₦1000 = 2 coins
    max_uses: 50,
    used_count: 14,
    expires_at: iso(30 * DAY),
  },
  {
    id: "v_admin_demo_1",
    code: "AFCDEMO250",
    amount_kobo: 25_000, // ₦250
    max_uses: 25,
    used_count: 0,
    expires_at: iso(14 * DAY),
  },
  {
    id: "v_admin_demo_2",
    code: "AFCBOOST2K",
    amount_kobo: 200_000, // ₦2000
    max_uses: 10,
    used_count: 2,
    expires_at: iso(7 * DAY),
  },
  {
    id: "v_admin_demo_3",
    code: "JUICEJOE5K",
    amount_kobo: 500_000, // ₦5000 winners-circle promo
    max_uses: 5,
    used_count: 1,
    expires_at: iso(45 * DAY),
  },
];
