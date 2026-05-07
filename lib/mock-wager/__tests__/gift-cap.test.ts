import { describe, it, expect, beforeEach } from "vitest";
import { resetDB, getDB } from "../store";
import { sumGiftReceiptsLast24h, GIFT_DAILY_CAP_KOBO } from "../gift-cap";

describe("gift cap rolling window", () => {
  beforeEach(async () => {
    await resetDB();
    const db = await getDB();
    await db.put("wallets", {
      id: "w1",
      user_id: "u1",
      balance_kobo: 0,
      locked_kobo: 0,
      balance_purchased_kobo: 0,
      balance_won_kobo: 0,
      balance_gift_kobo: 0,
      status: "ACTIVE",
    });
  });

  it("returns 0 when no gift txns", async () => {
    const sum = await sumGiftReceiptsLast24h("u1", new Date());
    expect(sum).toBe(0);
  });

  it("sums voucher + p2p_in gift txns within 24h", async () => {
    const db = await getDB();
    const now = new Date();
    const within = new Date(now.getTime() - 1000 * 60 * 60).toISOString();
    const outside = new Date(now.getTime() - 1000 * 60 * 60 * 25).toISOString();
    await db.put("wallet_txns", {
      id: "t1", wallet_id: "w1", amount_kobo: 5_000_000,
      kind: "DEPOSIT_VOUCHER", source_tag: "GIFT",
      ref_type: "voucher", ref_id: "v1",
      fx_snapshot_id: "fx1", idempotency_key: "k1",
      created_at: within,
    });
    await db.put("wallet_txns", {
      id: "t2", wallet_id: "w1", amount_kobo: 3_000_000,
      kind: "P2P_IN", source_tag: "GIFT",
      ref_type: "p2p", ref_id: "tr1",
      fx_snapshot_id: "fx1", idempotency_key: "k2",
      created_at: within,
    });
    await db.put("wallet_txns", {
      id: "t3", wallet_id: "w1", amount_kobo: 8_000_000,
      kind: "DEPOSIT_VOUCHER", source_tag: "GIFT",
      ref_type: "voucher", ref_id: "v2",
      fx_snapshot_id: "fx1", idempotency_key: "k3",
      created_at: outside, // outside window
    });
    const sum = await sumGiftReceiptsLast24h("u1", now);
    expect(sum).toBe(8_000_000);
  });

  it("expects cap = ₦100,000 = 10,000,000 kobo", () => {
    expect(GIFT_DAILY_CAP_KOBO).toBe(10_000_000);
  });
});
