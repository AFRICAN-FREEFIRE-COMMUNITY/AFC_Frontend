// Invariant validation for the seed fixture. Verifies:
//   1. Wager.total_stake_kobo == sum(WagerLine.stake_kobo) per wager
//   2. sum(WagerLine.stake_kobo across market) == Market.total_pool_kobo
//      for SETTLED + LOCKED markets
//   3. For each Settlement: paid_out_kobo + rake_kobo == total_pool_kobo
//   4. Wallet balance categories sum to balance_kobo
//   5. WalletTxn.idempotency_key is unique
//   6. Voucher.code is unique uppercase
//   7. KYC has one row per user
//   8. Each user has one wallet

import { describe, it, expect } from "vitest";
import {
  SEED_USERS,
  SEED_WALLETS,
  SEED_TXNS,
  SEED_MARKETS,
  SEED_OPTIONS,
  SEED_WAGERS,
  SEED_LINES,
  SEED_SETTLEMENTS,
  SEED_VOUCHERS,
  SEED_KYC,
  SEED_FX,
  SEED_EVENTS,
} from "../seed-data";

describe("seed-data invariants", () => {
  it("9 users total, role mix correct", () => {
    expect(SEED_USERS).toHaveLength(9);
    const roles = SEED_USERS.map((u) => u.role).sort();
    expect(roles).toEqual([
      "head_admin",
      "house",
      "user",
      "user",
      "user",
      "user",
      "user",
      "wager_admin",
      "wallet_admin",
    ]);
  });

  it("9 wallets, one per user", () => {
    expect(SEED_WALLETS).toHaveLength(9);
    const userIds = new Set(SEED_USERS.map((u) => u.id));
    const walletUserIds = new Set(SEED_WALLETS.map((w) => w.user_id));
    expect(walletUserIds).toEqual(userIds);
  });

  it("9 KYC rows, one per user", () => {
    expect(SEED_KYC).toHaveLength(9);
    const userIds = new Set(SEED_USERS.map((u) => u.id));
    const kycUserIds = new Set(SEED_KYC.map((k) => k.user_id));
    expect(kycUserIds).toEqual(userIds);
  });

  it("each wallet's category balances sum to balance_kobo", () => {
    for (const w of SEED_WALLETS) {
      const sum =
        w.balance_purchased_kobo + w.balance_won_kobo + w.balance_gift_kobo;
      expect(sum, `wallet ${w.id} categories sum`).toBe(w.balance_kobo);
    }
  });

  it("3 events with status mix", () => {
    expect(SEED_EVENTS).toHaveLength(3);
    const statuses = SEED_EVENTS.map((e) => e.status).sort();
    expect(statuses).toEqual(["completed", "ongoing", "upcoming"]);
  });

  it("12 markets with status mix: 5 OPEN, 2 LOCKED, 4 SETTLED, 1 DRAFT", () => {
    expect(SEED_MARKETS).toHaveLength(12);
    const counts = SEED_MARKETS.reduce<Record<string, number>>((acc, m) => {
      acc[m.status] = (acc[m.status] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts.OPEN).toBe(5);
    expect(counts.LOCKED).toBe(2);
    expect(counts.SETTLED).toBe(4);
    expect(counts.DRAFT).toBe(1);
  });

  it("each market has 2-12 options", () => {
    const byMarket: Record<string, number> = {};
    for (const o of SEED_OPTIONS) {
      byMarket[o.market_id] = (byMarket[o.market_id] ?? 0) + 1;
    }
    for (const m of SEED_MARKETS) {
      const n = byMarket[m.id] ?? 0;
      expect(n, `${m.id} options count`).toBeGreaterThanOrEqual(2);
      expect(n, `${m.id} options count`).toBeLessThanOrEqual(12);
    }
  });

  it("Wager.total_stake_kobo matches sum of WagerLine.stake_kobo per wager", () => {
    const linesByWager: Record<string, number> = {};
    for (const l of SEED_LINES) {
      linesByWager[l.wager_id] = (linesByWager[l.wager_id] ?? 0) + l.stake_kobo;
    }
    for (const w of SEED_WAGERS) {
      expect(linesByWager[w.id] ?? 0, `wager ${w.id}`).toBe(w.total_stake_kobo);
    }
  });

  it("sum of WagerLine.stake_kobo per market matches Market.total_pool_kobo (SETTLED + LOCKED)", () => {
    const wagerToMarket: Record<string, string> = {};
    for (const w of SEED_WAGERS) wagerToMarket[w.id] = w.market_id;
    const linesByMarket: Record<string, number> = {};
    for (const l of SEED_LINES) {
      const market_id = wagerToMarket[l.wager_id];
      if (!market_id) continue;
      linesByMarket[market_id] = (linesByMarket[market_id] ?? 0) + l.stake_kobo;
    }
    for (const m of SEED_MARKETS) {
      if (m.status !== "SETTLED" && m.status !== "LOCKED") continue;
      expect(linesByMarket[m.id] ?? 0, `market ${m.id} pool`).toBe(
        m.total_pool_kobo,
      );
    }
  });

  it("sum of MarketOption.cached_pool_kobo per market matches Market.total_pool_kobo (SETTLED + LOCKED)", () => {
    const poolByMarket: Record<string, number> = {};
    for (const o of SEED_OPTIONS) {
      poolByMarket[o.market_id] =
        (poolByMarket[o.market_id] ?? 0) + o.cached_pool_kobo;
    }
    for (const m of SEED_MARKETS) {
      if (m.status !== "SETTLED" && m.status !== "LOCKED") continue;
      expect(poolByMarket[m.id] ?? 0, `market ${m.id} options pool`).toBe(
        m.total_pool_kobo,
      );
    }
  });

  it("each Settlement: paid_out_kobo + rake_kobo == total_pool_kobo", () => {
    for (const s of SEED_SETTLEMENTS) {
      expect(s.paid_out_kobo + s.rake_kobo, `settlement ${s.id}`).toBe(
        s.total_pool_kobo,
      );
    }
  });

  it("4 SETTLED markets each have a Settlement", () => {
    const settledMarkets = SEED_MARKETS.filter((m) => m.status === "SETTLED");
    expect(settledMarkets).toHaveLength(4);
    const settlementMarketIds = new Set(SEED_SETTLEMENTS.map((s) => s.market_id));
    for (const m of settledMarkets) {
      expect(settlementMarketIds.has(m.id), `settlement for ${m.id}`).toBe(true);
    }
  });

  it("WalletTxn.idempotency_key is unique", () => {
    const seen = new Set<string>();
    for (const t of SEED_TXNS) {
      expect(seen.has(t.idempotency_key), `dup idempotency ${t.idempotency_key}`)
        .toBe(false);
      seen.add(t.idempotency_key);
    }
  });

  it("Voucher.code is unique and uppercase", () => {
    expect(SEED_VOUCHERS.length).toBeGreaterThanOrEqual(5);
    const codes = SEED_VOUCHERS.map((v) => v.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) {
      expect(c, `voucher code ${c} uppercase`).toBe(c.toUpperCase());
    }
  });

  it("WELCOME500 voucher has expected shape", () => {
    const w = SEED_VOUCHERS.find((v) => v.code === "WELCOME500");
    expect(w).toBeDefined();
    expect(w!.amount_kobo).toBe(50_000);
    expect(w!.max_uses).toBe(100);
    expect(w!.used_count).toBe(8);
  });

  it("HYPE1K voucher has expected shape", () => {
    const h = SEED_VOUCHERS.find((v) => v.code === "HYPE1K");
    expect(h).toBeDefined();
    expect(h!.amount_kobo).toBe(100_000);
    expect(h!.max_uses).toBe(50);
    expect(h!.used_count).toBe(14);
  });

  it("4 of 5 players are TIER_0; player_1 is TIER_LITE; admins are TIER_LITE", () => {
    const playerIds = ["player_1", "player_2", "player_3", "player_4", "player_5"];
    const tier0Players = SEED_KYC.filter(
      (k) => playerIds.includes(k.user_id) && k.tier === "TIER_0",
    );
    const tierLitePlayers = SEED_KYC.filter(
      (k) => playerIds.includes(k.user_id) && k.tier === "TIER_LITE",
    );
    expect(tier0Players).toHaveLength(4);
    expect(tierLitePlayers).toHaveLength(1);
    expect(tierLitePlayers[0].user_id).toBe("player_1");

    const adminIds = ["wager_admin_jane", "wallet_admin_kofi", "head_admin_jay"];
    const tierLiteAdmins = SEED_KYC.filter(
      (k) => adminIds.includes(k.user_id) && k.tier === "TIER_LITE",
    );
    expect(tierLiteAdmins).toHaveLength(3);
  });

  it("FX has exactly 1 snapshot with sane ngn_per_usd", () => {
    expect(SEED_FX).toHaveLength(1);
    expect(SEED_FX[0].ngn_per_usd).toBeGreaterThan(1000);
    expect(SEED_FX[0].ngn_per_usd).toBeLessThan(2500);
  });

  it("at least one OPEN market locks within 15 minutes (HOT countdown)", () => {
    const open = SEED_MARKETS.filter((m) => m.status === "OPEN");
    const now = Date.now();
    const hot = open.filter(
      (m) => new Date(m.lock_at).getTime() - now < 15 * 60_000,
    );
    expect(hot.length).toBeGreaterThanOrEqual(1);
  });

  it("dust scenario reproduces 1-kobo dust shape from shared fixtures", () => {
    const dust = SEED_MARKETS.find((m) => m.id === "m_dust_demo");
    const settlement = SEED_SETTLEMENTS.find(
      (s) => s.market_id === "m_dust_demo",
    );
    expect(dust).toBeDefined();
    expect(settlement).toBeDefined();
    // Pool 1_005_350, rake_kobo = 50_267 base + 1 dust
    expect(dust!.total_pool_kobo).toBe(1_005_350);
    expect(settlement!.rake_kobo).toBe(50_268); // 50_267 + 1 dust
    expect(settlement!.paid_out_kobo).toBe(955_082); // 159180+318361+477541
  });

  it("solo-void scenario reproduces VOID_SOLO_WAGER shape", () => {
    const m = SEED_MARKETS.find((m) => m.id === "m_solo_void");
    const s = SEED_SETTLEMENTS.find((s) => s.market_id === "m_solo_void");
    expect(m).toBeDefined();
    expect(s).toBeDefined();
    expect(s!.resolution).toBe("VOID_SOLO_WAGER");
    expect(s!.rake_kobo).toBe(0);
    expect(s!.paid_out_kobo).toBe(m!.total_pool_kobo); // full refund
  });
});
