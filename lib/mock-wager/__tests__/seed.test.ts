import { describe, it, expect, beforeEach } from "vitest";
import { runSeed, isSeeded } from "../seed";
import { resetDB, getDB } from "../store";

describe("seed runner", () => {
  beforeEach(async () => {
    await resetDB();
  });

  it("isSeeded returns false on empty DB", async () => {
    expect(await isSeeded()).toBe(false);
  });

  it("seeds all expected entities and is idempotent", async () => {
    await runSeed();
    expect(await isSeeded()).toBe(true);

    const db = await getDB();
    const users = await db.getAll("users");
    const wallets = await db.getAll("wallets");
    const events = await db.getAll("events");
    const markets = await db.getAll("markets");
    const vouchers = await db.getAll("vouchers");

    expect(users).toHaveLength(9); // 8 demo + house
    expect(wallets).toHaveLength(9);
    expect(events).toHaveLength(3);
    expect(markets.length).toBeGreaterThanOrEqual(12);
    expect(vouchers.length).toBeGreaterThanOrEqual(5);

    // run a second time — idempotent
    await runSeed();
    const usersAgain = await db.getAll("users");
    expect(usersAgain).toHaveLength(9); // no duplicates
  });
});
