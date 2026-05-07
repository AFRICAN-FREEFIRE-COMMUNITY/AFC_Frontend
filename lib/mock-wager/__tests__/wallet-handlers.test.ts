import { describe, it, expect, beforeEach } from "vitest";
import { resetDB, getDB } from "../store";
import {
  credit,
  debit,
  getBalance,
  listTxns,
  InsufficientFunds,
  WalletFrozen,
  GiftDailyCapExceeded,
  WalletNotFound,
} from "../handlers/wallet";
import { subscribe, teardownPubsub } from "../pubsub";
import { GIFT_DAILY_CAP_KOBO } from "../../utils";

const FX_ID = "fx_test_v1";

async function bootstrap(opts?: {
  user_id?: string;
  balance_kobo?: number;
  purchased?: number;
  won?: number;
  gift?: number;
  status?: "ACTIVE" | "FROZEN";
}) {
  const u = opts?.user_id ?? "u1";
  const db = await getDB();
  await db.put("fx_snapshots", {
    id: FX_ID,
    captured_at: new Date().toISOString(),
    ngn_per_usd: 1500,
    source: "test",
  });
  await db.put("users", {
    id: u,
    username: u,
    display_name: u,
    role: "user",
    created_at: new Date().toISOString(),
  });
  await db.put("wallets", {
    id: `w_${u}`,
    user_id: u,
    balance_kobo: opts?.balance_kobo ?? 0,
    locked_kobo: 0,
    balance_purchased_kobo: opts?.purchased ?? 0,
    balance_won_kobo: opts?.won ?? 0,
    balance_gift_kobo: opts?.gift ?? 0,
    status: opts?.status ?? "ACTIVE",
  });
  return u;
}

describe("wallet handlers — credit", () => {
  beforeEach(async () => {
    await resetDB();
    teardownPubsub();
  });

  it("credits a new amount, increments total + sub-balance, creates txn", async () => {
    const u = await bootstrap();
    const txn = await credit({
      user_id: u,
      amount_kobo: 100_000,
      kind: "DEPOSIT_PAYSTACK",
      source_tag: "PURCHASED",
      ref_type: "deposit",
      ref_id: "d1",
      idempotency_key: "ik-credit-1",
    });
    expect(txn.amount_kobo).toBe(100_000);
    expect(txn.kind).toBe("DEPOSIT_PAYSTACK");
    expect(txn.source_tag).toBe("PURCHASED");
    expect(txn.idempotency_key).toBe("ik-credit-1");

    const bal = await getBalance(u);
    expect(bal.total_kobo).toBe(100_000);
    expect(bal.purchased_kobo).toBe(100_000);
    expect(bal.won_kobo).toBe(0);
    expect(bal.gift_kobo).toBe(0);
  });

  it("idempotency replay: calling credit twice with same key returns existing txn", async () => {
    const u = await bootstrap();
    const t1 = await credit({
      user_id: u,
      amount_kobo: 50_000,
      kind: "DEPOSIT_PAYSTACK",
      source_tag: "PURCHASED",
      ref_type: "deposit",
      ref_id: "d1",
      idempotency_key: "ik-replay",
    });
    const t2 = await credit({
      user_id: u,
      amount_kobo: 50_000,
      kind: "DEPOSIT_PAYSTACK",
      source_tag: "PURCHASED",
      ref_type: "deposit",
      ref_id: "d1",
      idempotency_key: "ik-replay",
    });
    expect(t2.id).toBe(t1.id);

    const bal = await getBalance(u);
    expect(bal.total_kobo).toBe(50_000); // not doubled
  });

  it("publishes wallet:credited pubsub event", async () => {
    const u = await bootstrap();
    let seen: { user_id: string; amount_kobo: number } | null = null;
    const off = subscribe("wallet:credited", (msg) => {
      if (msg.type === "wallet:credited") seen = { user_id: msg.user_id, amount_kobo: msg.amount_kobo };
    });
    await credit({
      user_id: u,
      amount_kobo: 25_000,
      kind: "DEPOSIT_PAYSTACK",
      source_tag: "PURCHASED",
      ref_type: "deposit",
      ref_id: "d1",
      idempotency_key: "ik-pub",
    });
    off();
    expect(seen).toEqual({ user_id: u, amount_kobo: 25_000 });
  });

  it("rejects gift credit when cap already exhausted", async () => {
    const u = await bootstrap();
    // Fill 24h with ₦100k of GIFT
    await credit({
      user_id: u,
      amount_kobo: GIFT_DAILY_CAP_KOBO,
      kind: "DEPOSIT_VOUCHER",
      source_tag: "GIFT",
      ref_type: "voucher",
      ref_id: "v1",
      idempotency_key: "ik-fill",
    });
    await expect(
      credit({
        user_id: u,
        amount_kobo: 1,
        kind: "DEPOSIT_VOUCHER",
        source_tag: "GIFT",
        ref_type: "voucher",
        ref_id: "v2",
        idempotency_key: "ik-over",
      }),
    ).rejects.toBeInstanceOf(GiftDailyCapExceeded);
  });

  it("throws WalletNotFound for non-existent user", async () => {
    await expect(
      credit({
        user_id: "ghost",
        amount_kobo: 100,
        kind: "DEPOSIT_PAYSTACK",
        source_tag: "PURCHASED",
        ref_type: "deposit",
        ref_id: "d1",
        idempotency_key: "ik-ghost",
      }),
    ).rejects.toBeInstanceOf(WalletNotFound);
  });
});

describe("wallet handlers — debit + spend ladder", () => {
  beforeEach(async () => {
    await resetDB();
    teardownPubsub();
  });

  it("simple debit decrements balance from a single bucket", async () => {
    const u = await bootstrap({ balance_kobo: 500_000, purchased: 500_000 });
    const result = await debit({
      user_id: u,
      amount_kobo: 100_000,
      kind: "WAGER_PLACE",
      ref_type: "wager",
      ref_id: "wgr1",
      idempotency_key: "ik-debit-1",
    });
    expect(result.txns.length).toBe(1);
    expect(result.txns[0].amount_kobo).toBe(-100_000);
    expect(result.txns[0].source_tag).toBe("PURCHASED");

    const bal = await getBalance(u);
    expect(bal.total_kobo).toBe(400_000);
    expect(bal.purchased_kobo).toBe(400_000);
  });

  it("spend ladder: 100 GIFT + 200 WON + 500 PURCHASED, debit 250 → 0/50/500", async () => {
    const u = await bootstrap({
      balance_kobo: 800,
      gift: 100,
      won: 200,
      purchased: 500,
    });
    const result = await debit({
      user_id: u,
      amount_kobo: 250,
      kind: "WAGER_PLACE",
      ref_type: "wager",
      ref_id: "w1",
      idempotency_key: "ik-ladder",
    });

    // Should have generated 2 txns: -100 GIFT then -150 WON
    expect(result.txns.length).toBe(2);
    const sourceTags = result.txns.map((t) => t.source_tag);
    expect(sourceTags).toContain("GIFT");
    expect(sourceTags).toContain("WON");
    const giftTxn = result.txns.find((t) => t.source_tag === "GIFT")!;
    const wonTxn = result.txns.find((t) => t.source_tag === "WON")!;
    expect(giftTxn.amount_kobo).toBe(-100);
    expect(wonTxn.amount_kobo).toBe(-150);

    const bal = await getBalance(u);
    expect(bal.gift_kobo).toBe(0);
    expect(bal.won_kobo).toBe(50);
    expect(bal.purchased_kobo).toBe(500);
    expect(bal.total_kobo).toBe(550);
  });

  it("spend ladder: 100 GIFT + 200 WON + 500 PURCHASED, debit 800 → 0/0/0 with 3 txns", async () => {
    const u = await bootstrap({
      balance_kobo: 800,
      gift: 100,
      won: 200,
      purchased: 500,
    });
    const result = await debit({
      user_id: u,
      amount_kobo: 800,
      kind: "WAGER_PLACE",
      ref_type: "wager",
      ref_id: "w_full",
      idempotency_key: "ik-full",
    });
    expect(result.txns.length).toBe(3);

    const bal = await getBalance(u);
    expect(bal.total_kobo).toBe(0);
    expect(bal.gift_kobo).toBe(0);
    expect(bal.won_kobo).toBe(0);
    expect(bal.purchased_kobo).toBe(0);
  });

  it("returns breakdown so callers (P2P) can inherit source-tags on credit", async () => {
    const u = await bootstrap({
      balance_kobo: 800,
      gift: 100,
      won: 200,
      purchased: 500,
    });
    const result = await debit({
      user_id: u,
      amount_kobo: 250,
      kind: "P2P_OUT",
      ref_type: "p2p",
      ref_id: "tr1",
      idempotency_key: "ik-p2p",
    });
    expect(result.breakdown.GIFT).toBe(100);
    expect(result.breakdown.WON).toBe(150);
    expect(result.breakdown.PURCHASED).toBe(0);
    expect(result.total_debited_kobo).toBe(250);
  });

  it("rejects when amount exceeds total balance", async () => {
    const u = await bootstrap({ balance_kobo: 100, purchased: 100 });
    await expect(
      debit({
        user_id: u,
        amount_kobo: 9999,
        kind: "WAGER_PLACE",
        ref_type: "wager",
        ref_id: "w1",
        idempotency_key: "ik-over",
      }),
    ).rejects.toBeInstanceOf(InsufficientFunds);

    // No mutation should have happened
    const bal = await getBalance(u);
    expect(bal.total_kobo).toBe(100);
  });

  it("blocks debit on a frozen wallet", async () => {
    const u = await bootstrap({
      balance_kobo: 500_000,
      purchased: 500_000,
      status: "FROZEN",
    });
    await expect(
      debit({
        user_id: u,
        amount_kobo: 100_000,
        kind: "WAGER_PLACE",
        ref_type: "wager",
        ref_id: "w1",
        idempotency_key: "ik-frozen",
      }),
    ).rejects.toBeInstanceOf(WalletFrozen);
  });

  it("idempotent debit: replays return same total_debited", async () => {
    const u = await bootstrap({ balance_kobo: 500_000, purchased: 500_000 });
    const r1 = await debit({
      user_id: u,
      amount_kobo: 100_000,
      kind: "WAGER_PLACE",
      ref_type: "wager",
      ref_id: "w1",
      idempotency_key: "ik-debit-once",
    });
    const r2 = await debit({
      user_id: u,
      amount_kobo: 100_000,
      kind: "WAGER_PLACE",
      ref_type: "wager",
      ref_id: "w1",
      idempotency_key: "ik-debit-once",
    });
    expect(r2.total_debited_kobo).toBe(r1.total_debited_kobo);
    const bal = await getBalance(u);
    expect(bal.total_kobo).toBe(400_000); // not double-debited
  });

  it("publishes wallet:debited with summed amount", async () => {
    const u = await bootstrap({
      balance_kobo: 800,
      gift: 100,
      won: 200,
      purchased: 500,
    });
    let total = 0;
    const off = subscribe("wallet:debited", (msg) => {
      if (msg.type === "wallet:debited") total = msg.amount_kobo;
    });
    await debit({
      user_id: u,
      amount_kobo: 250,
      kind: "WAGER_PLACE",
      ref_type: "wager",
      ref_id: "w1",
      idempotency_key: "ik-pubdb",
    });
    off();
    expect(total).toBe(250);
  });
});

describe("wallet handlers — listTxns", () => {
  beforeEach(async () => {
    await resetDB();
    teardownPubsub();
  });

  it("returns filtered txns sorted desc by created_at", async () => {
    const u = await bootstrap({
      balance_kobo: 0,
      purchased: 0,
      won: 0,
      gift: 0,
    });
    await credit({
      user_id: u,
      amount_kobo: 100_000,
      kind: "DEPOSIT_PAYSTACK",
      source_tag: "PURCHASED",
      ref_type: "deposit",
      ref_id: "d1",
      idempotency_key: "ik-l1",
    });
    await new Promise((r) => setTimeout(r, 5));
    await credit({
      user_id: u,
      amount_kobo: 200_000,
      kind: "DEPOSIT_PAYSTACK",
      source_tag: "PURCHASED",
      ref_type: "deposit",
      ref_id: "d2",
      idempotency_key: "ik-l2",
    });
    const txns = await listTxns({ user_id: u });
    expect(txns.length).toBe(2);
    // Most recent first
    expect(new Date(txns[0].created_at).getTime()).toBeGreaterThanOrEqual(
      new Date(txns[1].created_at).getTime(),
    );
  });

  it("filters by kind", async () => {
    const u = await bootstrap({
      balance_kobo: 0,
      purchased: 0,
      won: 0,
      gift: 0,
    });
    await credit({
      user_id: u,
      amount_kobo: 100_000,
      kind: "DEPOSIT_PAYSTACK",
      source_tag: "PURCHASED",
      ref_type: "deposit",
      ref_id: "d1",
      idempotency_key: "ik-k1",
    });
    await credit({
      user_id: u,
      amount_kobo: 50_000,
      kind: "DEPOSIT_VOUCHER",
      source_tag: "GIFT",
      ref_type: "voucher",
      ref_id: "v1",
      idempotency_key: "ik-k2",
    });
    const onlyVouchers = await listTxns({ user_id: u, kind: "DEPOSIT_VOUCHER" });
    expect(onlyVouchers.length).toBe(1);
    expect(onlyVouchers[0].kind).toBe("DEPOSIT_VOUCHER");
  });

  it("respects limit + offset", async () => {
    const u = await bootstrap({
      balance_kobo: 0,
      purchased: 0,
      won: 0,
      gift: 0,
    });
    for (let i = 0; i < 5; i++) {
      await credit({
        user_id: u,
        amount_kobo: 1000,
        kind: "DEPOSIT_PAYSTACK",
        source_tag: "PURCHASED",
        ref_type: "deposit",
        ref_id: `d${i}`,
        idempotency_key: `ik-loop-${i}`,
      });
      await new Promise((r) => setTimeout(r, 3));
    }
    const page = await listTxns({ user_id: u, limit: 2, offset: 1 });
    expect(page.length).toBe(2);
  });
});

describe("wallet handlers — getBalance", () => {
  beforeEach(async () => {
    await resetDB();
    teardownPubsub();
  });

  it("returns shape matching Balance type", async () => {
    const u = await bootstrap({
      balance_kobo: 800,
      gift: 100,
      won: 200,
      purchased: 500,
    });
    const bal = await getBalance(u);
    expect(bal.total_kobo).toBe(800);
    expect(bal.gift_kobo).toBe(100);
    expect(bal.won_kobo).toBe(200);
    expect(bal.purchased_kobo).toBe(500);
    expect(bal.locked_kobo).toBe(0);
    expect(bal.fx).toBeDefined();
    expect(bal.fx.id).toBe(FX_ID);
  });
});
