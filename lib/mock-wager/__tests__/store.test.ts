import { describe, it, expect, beforeEach } from "vitest";
import { openMockDB, getDB, resetDB } from "../store";

describe("mock-wager store", () => {
  beforeEach(async () => {
    await resetDB();
  });

  it("opens DB and creates expected stores", async () => {
    const db = await openMockDB();
    const names = Array.from(db.objectStoreNames);
    expect(names).toContain("users");
    expect(names).toContain("wallets");
    expect(names).toContain("wallet_txns");
    expect(names).toContain("markets");
    expect(names).toContain("market_options");
    expect(names).toContain("wagers");
    expect(names).toContain("wager_lines");
    expect(names).toContain("settlements");
    expect(names).toContain("vouchers");
    expect(names).toContain("voucher_redemptions");
    expect(names).toContain("withdrawal_requests");
    expect(names).toContain("fx_snapshots");
    expect(names).toContain("kyc_tiers");
    expect(names).toContain("audit_log");
    expect(names).toContain("events");
  });

  it("supports unique constraint on wallet_txns.idempotency_key", async () => {
    const db = await getDB();
    const tx = db.transaction("wallet_txns", "readwrite");
    await tx.store.add({
      id: "t1",
      wallet_id: "w1",
      amount_kobo: 100,
      kind: "DEPOSIT_PAYSTACK",
      source_tag: "PURCHASED",
      ref_type: "deposit",
      ref_id: "d1",
      fx_snapshot_id: "fx1",
      idempotency_key: "key-A",
      created_at: new Date().toISOString(),
    });
    await tx.done;

    const tx2 = db.transaction("wallet_txns", "readwrite");
    // Swallow the implicit tx.done rejection that idb raises when an add()
    // fails — fake-indexeddb surfaces it as an unhandled rejection otherwise.
    const done = tx2.done.catch(() => {});
    await expect(
      tx2.store.add({
        id: "t2",
        wallet_id: "w1",
        amount_kobo: 100,
        kind: "DEPOSIT_PAYSTACK",
        source_tag: "PURCHASED",
        ref_type: "deposit",
        ref_id: "d1",
        fx_snapshot_id: "fx1",
        idempotency_key: "key-A", // duplicate
        created_at: new Date().toISOString(),
      }),
    ).rejects.toThrow();
    await done;
  });
});
