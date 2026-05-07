import { describe, it, expect, beforeEach } from "vitest";
import { resetDB, getDB } from "../store";
import { teardownPubsub } from "../pubsub";
import { resetClock } from "../clock";
import {
  listPendingSettlements,
  confirmSettlement,
  generateVoucher,
  redeemVoucher,
  listWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  freezeWallet,
  unfreezeWallet,
  listAuditLog,
  VoucherInvalid,
  VoucherExhausted,
  VoucherExpired,
  VoucherAlreadyRedeemed,
  WithdrawalNotFound,
} from "../handlers/admin";
import { credit, getBalance, debit } from "../handlers/wallet";
import { placeWager } from "../handlers/wagers";
import { HOUSE_USER_ID, GIFT_DAILY_CAP_KOBO } from "../../utils";
import type { Market, MarketStatus, WithdrawalRequest } from "../types";

const FX_ID = "fx_admin_test";

async function bootstrap() {
  const db = await getDB();
  await db.put("fx_snapshots", {
    id: FX_ID,
    captured_at: new Date().toISOString(),
    ngn_per_usd: 1500,
    source: "test",
  });
  for (const u of ["alice", "bob", HOUSE_USER_ID, "wallet_admin_kofi", "head_admin_jay"]) {
    await db.put("users", {
      id: u,
      username: u,
      display_name: u,
      role:
        u === HOUSE_USER_ID
          ? "house"
          : u === "wallet_admin_kofi"
            ? "wallet_admin"
            : u === "head_admin_jay"
              ? "head_admin"
              : "user",
      created_at: new Date().toISOString(),
    });
    await db.put("wallets", {
      id: `w_${u}`,
      user_id: u,
      balance_kobo: u === HOUSE_USER_ID ? 0 : 5_000_000,
      locked_kobo: 0,
      balance_purchased_kobo: u === HOUSE_USER_ID ? 0 : 5_000_000,
      balance_won_kobo: 0,
      balance_gift_kobo: 0,
      status: "ACTIVE",
    });
  }
  await db.put("events", {
    id: "ev1",
    slug: "ev1",
    name: "Event 1",
    status: "ongoing",
    start_at: new Date().toISOString(),
  });
}

async function makeMarketWithWagers(opts: {
  id: string;
  status?: MarketStatus;
  suggested?: string;
}) {
  const db = await getDB();
  const market: Market = {
    id: opts.id,
    event_id: "ev1",
    match_id: null,
    template_code: "match_winner",
    title: opts.id,
    description: "",
    status: opts.status ?? "PENDING_SETTLEMENT",
    opens_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    lock_at: new Date(Date.now() - 60_000).toISOString(),
    min_stake_kobo: 10_000,
    max_per_user_kobo: null,
    cancel_fee_bps: 100,
    rake_bps: 500,
    suggested_option_id: opts.suggested ?? null,
    winning_option_id: null,
    total_pool_kobo: 0,
    total_lines: 0,
    options: [],
    created_by_admin_id: "wager_admin_jane",
  };
  await db.put("markets", market);
  for (let i = 0; i < 2; i++) {
    await db.put("market_options", {
      id: `${opts.id}_o${i + 1}`,
      market_id: opts.id,
      label: i === 0 ? "A" : "B",
      ref_team_id: null,
      ref_player_id: null,
      ref_numeric: null,
      image: null,
      sort_order: i,
      cached_pool_kobo: 0,
      cached_wager_count: 0,
    });
  }
  // To use placeWager we need OPEN; flip status temporarily
  market.status = "OPEN";
  market.lock_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await db.put("markets", market);
  await placeWager({
    market_id: opts.id,
    user_id: "alice",
    lines: [{ option_id: `${opts.id}_o1`, stake_kobo: 600_000 }],
  });
  await placeWager({
    market_id: opts.id,
    user_id: "bob",
    lines: [{ option_id: `${opts.id}_o2`, stake_kobo: 400_000 }],
  });
  // Now flip to PENDING_SETTLEMENT
  const fresh = (await db.get("markets", opts.id))!;
  fresh.status = opts.status ?? "PENDING_SETTLEMENT";
  fresh.lock_at = new Date(Date.now() - 60_000).toISOString();
  await db.put("markets", fresh);
  return fresh;
}

describe("admin handlers — settlement queue", () => {
  beforeEach(async () => {
    await resetDB();
    teardownPubsub();
    resetClock();
  });

  it("listPendingSettlements returns markets in PENDING_SETTLEMENT", async () => {
    await bootstrap();
    await makeMarketWithWagers({ id: "m_pending", suggested: "m_pending_o1" });
    await makeMarketWithWagers({ id: "m_locked_too", status: "LOCKED" });
    const pending = await listPendingSettlements();
    expect(pending.length).toBe(1);
    expect(pending[0].market.id).toBe("m_pending");
    // Auto-suggestion comes from market.suggested_option_id when set
    expect(pending[0].auto_suggested_option_id).toBe("m_pending_o1");
  });

  it("listPendingSettlements falls back to largest cached pool when no explicit suggestion", async () => {
    await bootstrap();
    await makeMarketWithWagers({ id: "m_no_sugg" });
    const pending = await listPendingSettlements();
    expect(pending[0].auto_suggested_option_id).toBe("m_no_sugg_o1"); // alice 600k > bob 400k
  });

  it("confirmSettlement runs settle and credits winners", async () => {
    await bootstrap();
    await makeMarketWithWagers({ id: "m_conf", suggested: "m_conf_o1" });
    await confirmSettlement({
      market_id: "m_conf",
      final_option_id: "m_conf_o1",
      admin_user_id: "wallet_admin_kofi",
    });
    const db = await getDB();
    const m = await db.get("markets", "m_conf");
    expect(m?.status).toBe("SETTLED");
    expect((await getBalance("alice")).won_kobo).toBe(950_000);
  });

  it("confirmSettlement records override_reason in audit", async () => {
    await bootstrap();
    await makeMarketWithWagers({ id: "m_over", suggested: "m_over_o1" });
    await confirmSettlement({
      market_id: "m_over",
      final_option_id: "m_over_o2", // not the suggestion
      admin_user_id: "wallet_admin_kofi",
      override_reason: "stats reader misread",
    });
    const audits = await listAuditLog({ kind: "MARKET_SETTLE_OVERRIDE" });
    expect(audits.some((a) => a.payload.override_reason === "stats reader misread")).toBe(true);
  });
});

describe("admin handlers — vouchers", () => {
  beforeEach(async () => {
    await resetDB();
    teardownPubsub();
    resetClock();
  });

  it("generateVoucher creates a unique uppercase code if not provided", async () => {
    await bootstrap();
    const v = await generateVoucher({
      amount_kobo: 50_000,
      max_uses: 5,
      admin_user_id: "wallet_admin_kofi",
    });
    expect(v.code).toMatch(/^[A-Z0-9]{8}$/);
    expect(v.amount_kobo).toBe(50_000);
    expect(v.max_uses).toBe(5);
    expect(v.used_count).toBe(0);
    const audits = await listAuditLog({ kind: "VOUCHER_GENERATE" });
    expect(audits.length).toBe(1);
  });

  it("generateVoucher uses provided code, uppercased", async () => {
    await bootstrap();
    const v = await generateVoucher({
      code: "freecash",
      amount_kobo: 10_000,
      max_uses: 1,
      admin_user_id: "wallet_admin_kofi",
    });
    expect(v.code).toBe("FREECASH");
  });

  it("redeemVoucher credits user GIFT and increments used_count", async () => {
    await bootstrap();
    const v = await generateVoucher({
      code: "gift1",
      amount_kobo: 50_000,
      max_uses: 2,
      admin_user_id: "wallet_admin_kofi",
    });
    await redeemVoucher({ user_id: "alice", code: "gift1" });
    const bal = await getBalance("alice");
    expect(bal.gift_kobo).toBe(50_000);
    const db = await getDB();
    const after = await db.get("vouchers", v.id);
    expect(after?.used_count).toBe(1);
  });

  it("redeemVoucher rejects unknown code", async () => {
    await bootstrap();
    await expect(
      redeemVoucher({ user_id: "alice", code: "nope" }),
    ).rejects.toBeInstanceOf(VoucherInvalid);
  });

  it("redeemVoucher rejects exhausted voucher", async () => {
    await bootstrap();
    await generateVoucher({
      code: "once",
      amount_kobo: 50_000,
      max_uses: 1,
      admin_user_id: "wallet_admin_kofi",
    });
    await redeemVoucher({ user_id: "alice", code: "once" });
    await expect(
      redeemVoucher({ user_id: "bob", code: "once" }),
    ).rejects.toBeInstanceOf(VoucherExhausted);
  });

  it("redeemVoucher rejects expired voucher", async () => {
    await bootstrap();
    await generateVoucher({
      code: "expired",
      amount_kobo: 50_000,
      max_uses: 5,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
      admin_user_id: "wallet_admin_kofi",
    });
    await expect(
      redeemVoucher({ user_id: "alice", code: "expired" }),
    ).rejects.toBeInstanceOf(VoucherExpired);
  });

  it("redeemVoucher prevents same user redeeming twice", async () => {
    await bootstrap();
    await generateVoucher({
      code: "twice",
      amount_kobo: 50_000,
      max_uses: 5,
      admin_user_id: "wallet_admin_kofi",
    });
    await redeemVoucher({ user_id: "alice", code: "twice" });
    await expect(
      redeemVoucher({ user_id: "alice", code: "twice" }),
    ).rejects.toBeInstanceOf(VoucherAlreadyRedeemed);
  });
});

describe("admin handlers — withdrawals", () => {
  beforeEach(async () => {
    await resetDB();
    teardownPubsub();
    resetClock();
  });

  async function seedWithdrawal(amount = 500_000): Promise<WithdrawalRequest> {
    const db = await getDB();
    // Hold the funds via a debit
    await debit({
      user_id: "alice",
      amount_kobo: amount,
      kind: "WITHDRAW_HOLD",
      ref_type: "withdrawal",
      ref_id: "wd_1",
      idempotency_key: "wd-hold-1",
    });
    const wd: WithdrawalRequest = {
      id: "wd_1",
      user_id: "alice",
      amount_kobo: amount,
      rail: "PAYSTACK_TRANSFER",
      destination: { account_number: "0123456789" },
      status: "REQUESTED",
      approved_by_admin_id: null,
      cosign_status: "NOT_REQUIRED",
      created_at: new Date().toISOString(),
    };
    await db.put("withdrawal_requests", wd);
    return wd;
  }

  it("listWithdrawals returns the queue, filterable by status", async () => {
    await bootstrap();
    await seedWithdrawal();
    const all = await listWithdrawals({});
    expect(all.length).toBe(1);
    const onlyReq = await listWithdrawals({ status: "REQUESTED" });
    expect(onlyReq.length).toBe(1);
  });

  it("approveWithdrawal flips to SENT and writes audit", async () => {
    await bootstrap();
    await seedWithdrawal();
    await approveWithdrawal({ id: "wd_1", admin_user_id: "wallet_admin_kofi" });
    const db = await getDB();
    const fresh = await db.get("withdrawal_requests", "wd_1");
    expect(fresh?.status).toBe("SENT");
    expect(fresh?.approved_by_admin_id).toBe("wallet_admin_kofi");
    const audits = await listAuditLog({ kind: "WITHDRAWAL_APPROVE" });
    expect(audits.length).toBe(1);
  });

  it("rejectWithdrawal re-credits user, marks CANCELLED", async () => {
    await bootstrap();
    await seedWithdrawal(500_000);
    expect((await getBalance("alice")).total_kobo).toBe(4_500_000); // 5M - 500k held
    await rejectWithdrawal({
      id: "wd_1",
      admin_user_id: "wallet_admin_kofi",
      reason: "invalid bank details",
    });
    expect((await getBalance("alice")).total_kobo).toBe(5_000_000);
    const db = await getDB();
    const fresh = await db.get("withdrawal_requests", "wd_1");
    expect(fresh?.status).toBe("CANCELLED");
  });

  it("approveWithdrawal throws when id unknown", async () => {
    await bootstrap();
    await expect(
      approveWithdrawal({ id: "ghost", admin_user_id: "wallet_admin_kofi" }),
    ).rejects.toBeInstanceOf(WithdrawalNotFound);
  });
});

describe("admin handlers — wallet freeze", () => {
  beforeEach(async () => {
    await resetDB();
    teardownPubsub();
    resetClock();
  });

  it("freezeWallet sets status FROZEN, unfreeze restores ACTIVE", async () => {
    await bootstrap();
    await freezeWallet({
      user_id: "alice",
      admin_user_id: "wallet_admin_kofi",
      reason: "fraud investigation",
    });
    const db = await getDB();
    const ws = await db.getAllFromIndex("wallets", "by-user", "alice");
    expect(ws[0].status).toBe("FROZEN");

    await unfreezeWallet({
      user_id: "alice",
      admin_user_id: "wallet_admin_kofi",
    });
    const after = await db.getAllFromIndex("wallets", "by-user", "alice");
    expect(after[0].status).toBe("ACTIVE");

    const audits = await listAuditLog({});
    expect(audits.some((a) => a.action_kind === "WALLET_FREEZE")).toBe(true);
    expect(audits.some((a) => a.action_kind === "WALLET_UNFREEZE")).toBe(true);
  });
});

describe("admin handlers — listAuditLog", () => {
  beforeEach(async () => {
    await resetDB();
    teardownPubsub();
    resetClock();
  });

  it("filters by admin and kind", async () => {
    await bootstrap();
    await generateVoucher({
      code: "auditv",
      amount_kobo: 10_000,
      max_uses: 1,
      admin_user_id: "wallet_admin_kofi",
    });
    await freezeWallet({
      user_id: "alice",
      admin_user_id: "head_admin_jay",
      reason: "x",
    });
    const onlyVoucher = await listAuditLog({ kind: "VOUCHER_GENERATE" });
    expect(onlyVoucher.length).toBe(1);
    const onlyHead = await listAuditLog({ admin: "head_admin_jay" });
    expect(onlyHead.length).toBe(1);
    expect(onlyHead[0].action_kind).toBe("WALLET_FREEZE");
  });
});
