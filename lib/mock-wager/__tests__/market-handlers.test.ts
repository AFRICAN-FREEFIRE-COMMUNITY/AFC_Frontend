import { describe, it, expect, beforeEach } from "vitest";
import { resetDB, getDB } from "../store";
import { resetClock } from "../clock";
import { teardownPubsub, subscribe } from "../pubsub";
import {
  listMarkets,
  getMarket,
  subscribeToPool,
  lockMarket,
  voidMarket,
  settleMarket,
  MarketAlreadyLocked,
  MarketAlreadySettled,
  MarketWinningOptionInvalid,
} from "../handlers/markets";
import { placeWager } from "../handlers/wagers";
import { getBalance } from "../handlers/wallet";
import { HOUSE_USER_ID } from "../../utils";
import type { Market, MarketStatus } from "../types";

const FX_ID = "fx_market_test";

async function bootstrap() {
  const db = await getDB();
  await db.put("fx_snapshots", {
    id: FX_ID,
    captured_at: new Date().toISOString(),
    ngn_per_usd: 1500,
    source: "test",
  });
  // Players + admin + house
  for (const u of ["alice", "bob", "carol", HOUSE_USER_ID, "wager_admin_jane"]) {
    await db.put("users", {
      id: u,
      username: u,
      display_name: u,
      role: u === HOUSE_USER_ID ? "house" : u === "wager_admin_jane" ? "wager_admin" : "user",
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
  await db.put("events", {
    id: "ev1",
    slug: "ev1",
    name: "Event 1",
    status: "ongoing",
    start_at: new Date().toISOString(),
  });
}

async function makeMarket(opts: {
  id: string;
  status?: MarketStatus;
  lock_at_offset_ms?: number;
  total_pool_kobo?: number;
  options?: { id: string; label: string }[];
}) {
  const db = await getDB();
  const market: Market = {
    id: opts.id,
    event_id: "ev1",
    match_id: null,
    template_code: "match_winner",
    title: `Market ${opts.id}`,
    description: "—",
    status: opts.status ?? "OPEN",
    opens_at: new Date(Date.now() - 60_000).toISOString(),
    lock_at: new Date(Date.now() + (opts.lock_at_offset_ms ?? 60 * 60 * 1000)).toISOString(),
    min_stake_kobo: 10_000,
    max_per_user_kobo: null,
    cancel_fee_bps: 100,
    rake_bps: 500,
    suggested_option_id: null,
    winning_option_id: null,
    total_pool_kobo: opts.total_pool_kobo ?? 0,
    total_lines: 0,
    options: [],
    created_by_admin_id: "wager_admin_jane",
  };
  await db.put("markets", market);
  const optionInputs = opts.options ?? [
    { id: `${opts.id}_a`, label: "A" },
    { id: `${opts.id}_b`, label: "B" },
  ];
  for (let i = 0; i < optionInputs.length; i++) {
    const o = optionInputs[i];
    await db.put("market_options", {
      id: o.id,
      market_id: opts.id,
      label: o.label,
      ref_team_id: null,
      ref_player_id: null,
      ref_numeric: null,
      image: null,
      sort_order: i,
      cached_pool_kobo: 0,
      cached_wager_count: 0,
    });
  }
  return market;
}

describe("market handlers — list / get", () => {
  beforeEach(async () => {
    await resetDB();
    teardownPubsub();
    resetClock();
  });

  it("listMarkets returns all when no filter", async () => {
    await bootstrap();
    await makeMarket({ id: "m1" });
    await makeMarket({ id: "m2" });
    const all = await listMarkets({});
    expect(all.length).toBe(2);
    for (const m of all) expect(m.options.length).toBeGreaterThan(0);
  });

  it("listMarkets filters by event_id and status", async () => {
    await bootstrap();
    await makeMarket({ id: "m_open", status: "OPEN" });
    await makeMarket({ id: "m_locked", status: "LOCKED" });
    const onlyOpen = await listMarkets({ status: "OPEN" });
    expect(onlyOpen.length).toBe(1);
    expect(onlyOpen[0].id).toBe("m_open");
    const ev1 = await listMarkets({ event_id: "ev1" });
    expect(ev1.length).toBe(2);
  });

  it("listMarkets sorts by closing_soonest for OPEN by default", async () => {
    await bootstrap();
    await makeMarket({ id: "m_late", status: "OPEN", lock_at_offset_ms: 60 * 60 * 1000 });
    await makeMarket({ id: "m_soon", status: "OPEN", lock_at_offset_ms: 60_000 });
    const list = await listMarkets({ status: "OPEN" });
    expect(list[0].id).toBe("m_soon");
    expect(list[1].id).toBe("m_late");
  });

  it("listMarkets filters by q (case-insensitive search)", async () => {
    await bootstrap();
    const db = await getDB();
    const m = await makeMarket({ id: "m_search" });
    m.title = "MVP Final";
    await db.put("markets", m);
    const m2 = await makeMarket({ id: "m_other" });
    m2.title = "Match 5 Winner";
    await db.put("markets", m2);
    const list = await listMarkets({ q: "mvp" });
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("m_search");
  });

  it("getMarket returns market with options", async () => {
    await bootstrap();
    await makeMarket({ id: "m_get" });
    const m = await getMarket("m_get");
    expect(m.id).toBe("m_get");
    expect(m.options.length).toBe(2);
  });
});

describe("market handlers — subscribeToPool", () => {
  beforeEach(async () => {
    await resetDB();
    teardownPubsub();
    resetClock();
  });

  it("invokes callback on pool:updated for matching market_id", async () => {
    await bootstrap();
    await makeMarket({ id: "m_sub" });
    let received = 0;
    const off = subscribeToPool("m_sub", () => {
      received++;
    });
    await placeWager({
      market_id: "m_sub",
      user_id: "alice",
      lines: [{ option_id: "m_sub_a", stake_kobo: 100_000 }],
    });
    off();
    expect(received).toBe(1);
  });

  it("ignores updates for other markets", async () => {
    await bootstrap();
    await makeMarket({ id: "m_one" });
    await makeMarket({ id: "m_two" });
    let one = 0;
    const off = subscribeToPool("m_one", () => {
      one++;
    });
    await placeWager({
      market_id: "m_two",
      user_id: "alice",
      lines: [{ option_id: "m_two_a", stake_kobo: 100_000 }],
    });
    off();
    expect(one).toBe(0);
  });

  it("returns an unsubscribe function", async () => {
    await bootstrap();
    await makeMarket({ id: "m_unsub" });
    let count = 0;
    const off = subscribeToPool("m_unsub", () => {
      count++;
    });
    off();
    await placeWager({
      market_id: "m_unsub",
      user_id: "alice",
      lines: [{ option_id: "m_unsub_a", stake_kobo: 100_000 }],
    });
    expect(count).toBe(0);
  });
});

describe("market handlers — admin actions", () => {
  beforeEach(async () => {
    await resetDB();
    teardownPubsub();
    resetClock();
  });

  it("lockMarket flips OPEN -> LOCKED and publishes market:locked", async () => {
    await bootstrap();
    await makeMarket({ id: "m_lock" });
    let saw = false;
    const off = subscribe("market:locked", (msg) => {
      if (msg.type === "market:locked" && msg.market_id === "m_lock") saw = true;
    });
    await lockMarket({ market_id: "m_lock", admin_user_id: "wager_admin_jane" });
    off();
    const fresh = await getMarket("m_lock");
    expect(fresh.status).toBe("LOCKED");
    expect(saw).toBe(true);

    // Audit log entry
    const db = await getDB();
    const audits = await db.getAllFromIndex("audit_log", "by-admin", "wager_admin_jane");
    expect(audits.some((a) => a.action_kind === "MARKET_LOCK")).toBe(true);
  });

  it("lockMarket rejects already-locked", async () => {
    await bootstrap();
    await makeMarket({ id: "m_l2", status: "LOCKED" });
    await expect(
      lockMarket({ market_id: "m_l2", admin_user_id: "wager_admin_jane" }),
    ).rejects.toBeInstanceOf(MarketAlreadyLocked);
  });

  it("voidMarket refunds all wagers 100%, no rake/fee", async () => {
    await bootstrap();
    await makeMarket({ id: "m_void" });
    await placeWager({
      market_id: "m_void",
      user_id: "alice",
      lines: [{ option_id: "m_void_a", stake_kobo: 200_000 }],
    });
    await placeWager({
      market_id: "m_void",
      user_id: "bob",
      lines: [{ option_id: "m_void_b", stake_kobo: 100_000 }],
    });
    expect((await getBalance("alice")).total_kobo).toBe(800_000);
    expect((await getBalance("bob")).total_kobo).toBe(900_000);

    await voidMarket({
      market_id: "m_void",
      reason: "match cancelled",
      admin_user_id: "wager_admin_jane",
    });
    const m = await getMarket("m_void");
    expect(m.status).toBe("VOIDED");
    expect((await getBalance("alice")).total_kobo).toBe(1_000_000);
    expect((await getBalance("bob")).total_kobo).toBe(1_000_000);
    expect((await getBalance(HOUSE_USER_ID)).total_kobo).toBe(0);
  });

  it("settleMarket: WINNER scenario, credits winners + house", async () => {
    await bootstrap();
    await makeMarket({ id: "m_set" });
    // alice on a (winner), bob on b (loser)
    await placeWager({
      market_id: "m_set",
      user_id: "alice",
      lines: [{ option_id: "m_set_a", stake_kobo: 600_000 }],
    });
    await placeWager({
      market_id: "m_set",
      user_id: "bob",
      lines: [{ option_id: "m_set_b", stake_kobo: 400_000 }],
    });
    // pool = 1_000_000; rake 5% = 50_000; net = 950_000
    // single winner alice → 950_000 → +350k profit (had 400k after debit)
    await settleMarket({
      market_id: "m_set",
      winning_option_id: "m_set_a",
      admin_user_id: "wager_admin_jane",
    });
    const m = await getMarket("m_set");
    expect(m.status).toBe("SETTLED");
    expect(m.winning_option_id).toBe("m_set_a");

    const aliceBal = await getBalance("alice");
    expect(aliceBal.won_kobo).toBe(950_000);
    expect(aliceBal.total_kobo).toBe(400_000 + 950_000); // had 400k post-debit + 950k won

    const houseBal = await getBalance(HOUSE_USER_ID);
    expect(houseBal.total_kobo).toBe(50_000); // pure rake, dust=0

    const db = await getDB();
    const settlement = await db.getFromIndex("settlements", "by-market", "m_set");
    expect(settlement).toBeDefined();
    expect(settlement!.resolution).toBe("WINNER");
    expect(settlement!.paid_out_kobo).toBe(950_000);
    expect(settlement!.rake_kobo).toBe(50_000);
    expect(settlement!.winners_count).toBe(1);
  });

  it("settleMarket VOID_NO_WINNER refunds 100%", async () => {
    await bootstrap();
    await makeMarket({ id: "m_nowin" });
    await placeWager({
      market_id: "m_nowin",
      user_id: "alice",
      lines: [{ option_id: "m_nowin_a", stake_kobo: 200_000 }],
    });
    await placeWager({
      market_id: "m_nowin",
      user_id: "bob",
      lines: [{ option_id: "m_nowin_b", stake_kobo: 300_000 }],
    });
    // Settle on a 3rd option (which has no stake) — but our market only has 2 opts.
    // Add a 3rd option then settle it.
    const db = await getDB();
    await db.put("market_options", {
      id: "m_nowin_c",
      market_id: "m_nowin",
      label: "C",
      ref_team_id: null,
      ref_player_id: null,
      ref_numeric: null,
      image: null,
      sort_order: 2,
      cached_pool_kobo: 0,
      cached_wager_count: 0,
    });
    await settleMarket({
      market_id: "m_nowin",
      winning_option_id: "m_nowin_c",
      admin_user_id: "wager_admin_jane",
    });
    const settlement = await db.getFromIndex("settlements", "by-market", "m_nowin");
    expect(settlement!.resolution).toBe("VOID_NO_WINNER");
    expect((await getBalance("alice")).total_kobo).toBe(1_000_000);
    expect((await getBalance("bob")).total_kobo).toBe(1_000_000);
  });

  it("settleMarket VOID_SOLO_WAGER refunds 100% when only winners staked", async () => {
    await bootstrap();
    await makeMarket({ id: "m_solo" });
    await placeWager({
      market_id: "m_solo",
      user_id: "alice",
      lines: [{ option_id: "m_solo_a", stake_kobo: 500_000 }],
    });
    // Nobody on B
    await settleMarket({
      market_id: "m_solo",
      winning_option_id: "m_solo_a",
      admin_user_id: "wager_admin_jane",
    });
    const db = await getDB();
    const settlement = await db.getFromIndex("settlements", "by-market", "m_solo");
    expect(settlement!.resolution).toBe("VOID_SOLO_WAGER");
    expect((await getBalance("alice")).total_kobo).toBe(1_000_000);
  });

  it("settleMarket rejects already-settled", async () => {
    await bootstrap();
    await makeMarket({ id: "m_already" });
    await placeWager({
      market_id: "m_already",
      user_id: "alice",
      lines: [{ option_id: "m_already_a", stake_kobo: 100_000 }],
    });
    await placeWager({
      market_id: "m_already",
      user_id: "bob",
      lines: [{ option_id: "m_already_b", stake_kobo: 100_000 }],
    });
    await settleMarket({
      market_id: "m_already",
      winning_option_id: "m_already_a",
      admin_user_id: "wager_admin_jane",
    });
    await expect(
      settleMarket({
        market_id: "m_already",
        winning_option_id: "m_already_a",
        admin_user_id: "wager_admin_jane",
      }),
    ).rejects.toBeInstanceOf(MarketAlreadySettled);
  });

  it("settleMarket rejects invalid winning_option", async () => {
    await bootstrap();
    await makeMarket({ id: "m_bad" });
    await placeWager({
      market_id: "m_bad",
      user_id: "alice",
      lines: [{ option_id: "m_bad_a", stake_kobo: 100_000 }],
    });
    await expect(
      settleMarket({
        market_id: "m_bad",
        winning_option_id: "ghost",
        admin_user_id: "wager_admin_jane",
      }),
    ).rejects.toBeInstanceOf(MarketWinningOptionInvalid);
  });
});
