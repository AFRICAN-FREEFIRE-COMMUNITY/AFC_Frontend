import { describe, it, expect, beforeEach } from "vitest";
import { resetDB, getDB } from "../store";
import { advanceClock, resetClock } from "../clock";
import {
  placeWager,
  cancelWager,
  listMyWagers,
  getMarketWithOptions,
  MarketNotOpen,
  MarketLocked,
  StakeTooLow,
  StakeAboveCap,
  DuplicateWager,
  WagerNotFound,
  WagerCannotBeCancelled,
} from "../handlers/wagers";
import { credit, getBalance } from "../handlers/wallet";
import { subscribe, teardownPubsub } from "../pubsub";
import { HOUSE_USER_ID } from "../../utils";
import type { Market, MarketOption, MarketStatus } from "../types";

const FX_ID = "fx_wager_test";

async function bootstrap() {
  const db = await getDB();
  // FX
  await db.put("fx_snapshots", {
    id: FX_ID,
    captured_at: new Date().toISOString(),
    ngn_per_usd: 1500,
    source: "test",
  });
  // Users + wallets
  for (const u of ["alice", "bob", HOUSE_USER_ID]) {
    await db.put("users", {
      id: u,
      username: u,
      display_name: u,
      role: u === HOUSE_USER_ID ? "house" : "user",
      created_at: new Date().toISOString(),
    });
    await db.put("wallets", {
      id: `w_${u}`,
      user_id: u,
      balance_kobo: u === HOUSE_USER_ID ? 0 : 1_000_000,
      locked_kobo: 0,
      balance_purchased_kobo: u === HOUSE_USER_ID ? 0 : 1_000_000,
      balance_won_kobo: 0,
      balance_gift_kobo: 0,
      status: "ACTIVE",
    });
  }
}

async function makeMarket(opts: {
  id?: string;
  status?: MarketStatus;
  lock_at_offset_ms?: number;
  max_per_user_kobo?: number | null;
  min_stake_kobo?: number;
  options?: { id: string; label: string }[];
}): Promise<{ market: Market; options: MarketOption[] }> {
  const db = await getDB();
  const market_id = opts.id ?? "m_test";
  const lock_offset = opts.lock_at_offset_ms ?? 60 * 60 * 1000;
  const market: Market = {
    id: market_id,
    event_id: "ev_test",
    match_id: null,
    template_code: "match_winner",
    title: "Test Market",
    description: "—",
    status: opts.status ?? "OPEN",
    opens_at: new Date(Date.now() - 60_000).toISOString(),
    lock_at: new Date(Date.now() + lock_offset).toISOString(),
    min_stake_kobo: opts.min_stake_kobo ?? 10_000,
    max_per_user_kobo: opts.max_per_user_kobo ?? null,
    cancel_fee_bps: 100,
    rake_bps: 500,
    suggested_option_id: null,
    winning_option_id: null,
    total_pool_kobo: 0,
    total_lines: 0,
    options: [],
    created_by_admin_id: "wager_admin_jane",
  };
  await db.put("markets", market);

  const optionInputs = opts.options ?? [
    { id: `${market_id}_o1`, label: "Team A" },
    { id: `${market_id}_o2`, label: "Team B" },
  ];
  const options: MarketOption[] = optionInputs.map((o, i) => ({
    id: o.id,
    market_id,
    label: o.label,
    ref_team_id: null,
    ref_player_id: null,
    ref_numeric: null,
    image: null,
    sort_order: i,
    cached_pool_kobo: 0,
    cached_wager_count: 0,
  }));
  for (const o of options) await db.put("market_options", o);
  return { market, options };
}

describe("wager handlers — placeWager", () => {
  beforeEach(async () => {
    await resetDB();
    teardownPubsub();
    resetClock();
  });

  it("places single-line wager: balance debited, market pool grows, line created", async () => {
    await bootstrap();
    await makeMarket({ id: "m_single" });
    const w = await placeWager({
      market_id: "m_single",
      user_id: "alice",
      lines: [{ option_id: "m_single_o1", stake_kobo: 100_000 }],
    });
    expect(w.total_stake_kobo).toBe(100_000);
    expect(w.lines.length).toBe(1);
    expect(w.lines[0].stake_kobo).toBe(100_000);
    expect(w.status).toBe("ACTIVE");

    const bal = await getBalance("alice");
    expect(bal.total_kobo).toBe(900_000);

    const m = await getMarketWithOptions("m_single");
    expect(m.total_pool_kobo).toBe(100_000);
    expect(m.total_lines).toBe(1);
    const opt = m.options.find((o) => o.id === "m_single_o1")!;
    expect(opt.cached_pool_kobo).toBe(100_000);
    expect(opt.cached_wager_count).toBe(1);
  });

  it("places multi-line (D2) wager: 2 lines, single Wager row", async () => {
    await bootstrap();
    await makeMarket({ id: "m_multi" });
    const w = await placeWager({
      market_id: "m_multi",
      user_id: "alice",
      lines: [
        { option_id: "m_multi_o1", stake_kobo: 50_000 },
        { option_id: "m_multi_o2", stake_kobo: 70_000 },
      ],
    });
    expect(w.lines.length).toBe(2);
    expect(w.total_stake_kobo).toBe(120_000);

    const m = await getMarketWithOptions("m_multi");
    expect(m.total_pool_kobo).toBe(120_000);
    expect(m.total_lines).toBe(2);
    const o1 = m.options.find((o) => o.id === "m_multi_o1")!;
    const o2 = m.options.find((o) => o.id === "m_multi_o2")!;
    expect(o1.cached_pool_kobo).toBe(50_000);
    expect(o1.cached_wager_count).toBe(1);
    expect(o2.cached_pool_kobo).toBe(70_000);
    expect(o2.cached_wager_count).toBe(1);
  });

  it("publishes pool:updated and wallet:debited", async () => {
    await bootstrap();
    await makeMarket({ id: "m_pub" });
    let pool_seen = false;
    let debit_seen = false;
    const off1 = subscribe("pool:updated", (msg) => {
      if (msg.type === "pool:updated" && msg.market_id === "m_pub") pool_seen = true;
    });
    const off2 = subscribe("wallet:debited", (msg) => {
      if (msg.type === "wallet:debited" && msg.user_id === "alice") debit_seen = true;
    });
    await placeWager({
      market_id: "m_pub",
      user_id: "alice",
      lines: [{ option_id: "m_pub_o1", stake_kobo: 100_000 }],
    });
    off1();
    off2();
    expect(pool_seen).toBe(true);
    expect(debit_seen).toBe(true);
  });

  it("rejects when market.status !== OPEN", async () => {
    await bootstrap();
    await makeMarket({ id: "m_locked", status: "LOCKED" });
    await expect(
      placeWager({
        market_id: "m_locked",
        user_id: "alice",
        lines: [{ option_id: "m_locked_o1", stake_kobo: 100_000 }],
      }),
    ).rejects.toBeInstanceOf(MarketNotOpen);
  });

  it("rejects after lock_at passed (clock advanced)", async () => {
    await bootstrap();
    await makeMarket({ id: "m_clock", lock_at_offset_ms: 10_000 });
    advanceClock(60_000); // jump past lock
    await expect(
      placeWager({
        market_id: "m_clock",
        user_id: "alice",
        lines: [{ option_id: "m_clock_o1", stake_kobo: 100_000 }],
      }),
    ).rejects.toBeInstanceOf(MarketLocked);
  });

  it("rejects when total stake below min_stake_kobo", async () => {
    await bootstrap();
    await makeMarket({ id: "m_min" });
    await expect(
      placeWager({
        market_id: "m_min",
        user_id: "alice",
        lines: [{ option_id: "m_min_o1", stake_kobo: 5_000 }],
      }),
    ).rejects.toBeInstanceOf(StakeTooLow);
  });

  it("rejects when total stake above max_per_user_kobo", async () => {
    await bootstrap();
    await makeMarket({ id: "m_cap", max_per_user_kobo: 100_000 });
    await expect(
      placeWager({
        market_id: "m_cap",
        user_id: "alice",
        lines: [{ option_id: "m_cap_o1", stake_kobo: 200_000 }],
      }),
    ).rejects.toBeInstanceOf(StakeAboveCap);
  });

  it("rejects duplicate wager on same market by same user", async () => {
    await bootstrap();
    await makeMarket({ id: "m_dup" });
    await placeWager({
      market_id: "m_dup",
      user_id: "alice",
      lines: [{ option_id: "m_dup_o1", stake_kobo: 100_000 }],
    });
    await expect(
      placeWager({
        market_id: "m_dup",
        user_id: "alice",
        lines: [{ option_id: "m_dup_o1", stake_kobo: 50_000 }],
      }),
    ).rejects.toBeInstanceOf(DuplicateWager);
  });
});

describe("wager handlers — cancelWager", () => {
  beforeEach(async () => {
    await resetDB();
    teardownPubsub();
    resetClock();
  });

  it("refunds 99% to user, 1% to house, decrements pool, marks CANCELLED", async () => {
    await bootstrap();
    await makeMarket({ id: "m_cancel" });
    const w = await placeWager({
      market_id: "m_cancel",
      user_id: "alice",
      lines: [{ option_id: "m_cancel_o1", stake_kobo: 100_000 }],
    });
    // alice should have 900k now (debited 100k stake)
    expect((await getBalance("alice")).total_kobo).toBe(900_000);

    await cancelWager(w.id);

    // 1% fee = 1k → alice gets back 99k → 999k total; house gets 1k
    expect((await getBalance("alice")).total_kobo).toBe(999_000);
    expect((await getBalance(HOUSE_USER_ID)).total_kobo).toBe(1_000);

    // Market pool reset
    const m = await getMarketWithOptions("m_cancel");
    expect(m.total_pool_kobo).toBe(0);
    expect(m.total_lines).toBe(0);
    const opt = m.options.find((o) => o.id === "m_cancel_o1")!;
    expect(opt.cached_pool_kobo).toBe(0);
    expect(opt.cached_wager_count).toBe(0);

    // Wager state
    const db = await getDB();
    const updated = await db.get("wagers", w.id);
    expect(updated?.status).toBe("CANCELLED");
    const lines = await db.getAllFromIndex("wager_lines", "by-wager", w.id);
    expect(lines.length).toBe(0);
  });

  it("rejects cancel after lock_at", async () => {
    await bootstrap();
    await makeMarket({ id: "m_late", lock_at_offset_ms: 60_000 });
    const w = await placeWager({
      market_id: "m_late",
      user_id: "alice",
      lines: [{ option_id: "m_late_o1", stake_kobo: 100_000 }],
    });
    advanceClock(120_000); // pushes past lock
    await expect(cancelWager(w.id)).rejects.toBeInstanceOf(MarketLocked);
  });

  it("rejects cancel when market is no longer OPEN", async () => {
    await bootstrap();
    const { market } = await makeMarket({ id: "m_lockstate" });
    const w = await placeWager({
      market_id: market.id,
      user_id: "alice",
      lines: [{ option_id: "m_lockstate_o1", stake_kobo: 100_000 }],
    });
    // Manually flip the market to LOCKED via direct write to mimic admin lock
    const db = await getDB();
    const fresh = await db.get("markets", market.id);
    fresh!.status = "LOCKED";
    await db.put("markets", fresh!);
    await expect(cancelWager(w.id)).rejects.toBeInstanceOf(WagerCannotBeCancelled);
  });

  it("throws WagerNotFound for unknown id", async () => {
    await bootstrap();
    await expect(cancelWager("does_not_exist")).rejects.toBeInstanceOf(WagerNotFound);
  });
});

describe("wager handlers — listMyWagers", () => {
  beforeEach(async () => {
    await resetDB();
    teardownPubsub();
    resetClock();
  });

  it("returns wagers with lines, filtered by user", async () => {
    await bootstrap();
    await makeMarket({ id: "m_a" });
    await makeMarket({ id: "m_b" });
    await placeWager({
      market_id: "m_a",
      user_id: "alice",
      lines: [{ option_id: "m_a_o1", stake_kobo: 100_000 }],
    });
    await placeWager({
      market_id: "m_b",
      user_id: "alice",
      lines: [{ option_id: "m_b_o1", stake_kobo: 200_000 }],
    });
    await placeWager({
      market_id: "m_a",
      user_id: "bob",
      lines: [{ option_id: "m_a_o2", stake_kobo: 50_000 }],
    });
    const aliceList = await listMyWagers({ user_id: "alice" });
    expect(aliceList.length).toBe(2);
    for (const w of aliceList) expect(w.lines.length).toBeGreaterThan(0);
    const onlyA = await listMyWagers({ user_id: "alice", market_id: "m_a" });
    expect(onlyA.length).toBe(1);
  });
});
