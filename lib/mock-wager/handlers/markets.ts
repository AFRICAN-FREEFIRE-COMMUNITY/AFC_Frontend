// Market handler — list / get / subscribeToPool + admin lock/void/settle.
//
// settleMarket runs the pure settle() function from settlement-engine.ts and
// applies its results: credits winners (WAGER_PAYOUT/WON), credits house
// (HOUSE_RAKE/PURCHASED), writes Settlement row, updates market status,
// publishes market:settled. Audit log entry per privileged action.

import { getDB } from "../store";
import { mockNow } from "../clock";
import { publish, subscribe, type PubsubMessage } from "../pubsub";
import { settle } from "../settlement-engine";
import { credit } from "./wallet";
import { HOUSE_USER_ID } from "../../utils";
import type {
  Market,
  MarketOption,
  MarketStatus,
  PoolUpdate,
  Settlement,
  SettlementResolution,
  WagerLine,
} from "../types";

// --- Errors ---------------------------------------------------------------

export class MarketNotFound extends Error {
  constructor(id: string) {
    super(`Market ${id} not found`);
    this.name = "MarketNotFound";
  }
}

export class MarketAlreadyLocked extends Error {
  constructor(id: string) {
    super(`Market ${id} already locked`);
    this.name = "MarketAlreadyLocked";
  }
}

export class MarketAlreadySettled extends Error {
  constructor(id: string) {
    super(`Market ${id} already settled`);
    this.name = "MarketAlreadySettled";
  }
}

export class MarketWinningOptionInvalid extends Error {
  constructor(market_id: string, option_id: string) {
    super(`Option ${option_id} not in market ${market_id}`);
    this.name = "MarketWinningOptionInvalid";
  }
}

export class MarketCannotVoid extends Error {
  constructor(id: string, reason: string) {
    super(`Market ${id} cannot be voided: ${reason}`);
    this.name = "MarketCannotVoid";
  }
}

// --- ID helpers -----------------------------------------------------------

function newSettlementId(): string {
  return `set_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function newAuditId(): string {
  return `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// --- Filters / sorting ----------------------------------------------------

export interface ListMarketsInput {
  event_id?: string;
  status?: MarketStatus;
  q?: string;
  sort?: "closing_soonest" | "most_recent" | "largest_pool";
  limit?: number;
  offset?: number;
}

export async function listMarkets(input: ListMarketsInput): Promise<Market[]> {
  const db = await getDB();
  let markets: Market[];
  if (input.event_id) {
    markets = await db.getAllFromIndex("markets", "by-event", input.event_id);
  } else {
    markets = await db.getAll("markets");
  }
  if (input.status) markets = markets.filter((m) => m.status === input.status);
  if (input.q) {
    const q = input.q.toLowerCase();
    markets = markets.filter(
      (m) => m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q),
    );
  }

  // Default sort: closing_soonest if status=OPEN, else most_recent.
  const sort =
    input.sort ?? (input.status === "OPEN" ? "closing_soonest" : "most_recent");
  if (sort === "closing_soonest") {
    markets.sort((a, b) => new Date(a.lock_at).getTime() - new Date(b.lock_at).getTime());
  } else if (sort === "most_recent") {
    markets.sort((a, b) => new Date(b.opens_at).getTime() - new Date(a.opens_at).getTime());
  } else if (sort === "largest_pool") {
    markets.sort((a, b) => b.total_pool_kobo - a.total_pool_kobo);
  }

  const offset = input.offset ?? 0;
  const limit = input.limit ?? markets.length;
  const slice = markets.slice(offset, offset + limit);

  for (const m of slice) {
    const opts = await db.getAllFromIndex("market_options", "by-market", m.id);
    opts.sort((a, b) => a.sort_order - b.sort_order);
    m.options = opts;
  }
  return slice;
}

export async function getMarket(market_id: string): Promise<Market> {
  const db = await getDB();
  const m = await db.get("markets", market_id);
  if (!m) throw new MarketNotFound(market_id);
  const opts = await db.getAllFromIndex("market_options", "by-market", market_id);
  opts.sort((a, b) => a.sort_order - b.sort_order);
  return { ...m, options: opts };
}

// --- subscribeToPool ------------------------------------------------------

export function subscribeToPool(
  market_id: string,
  cb: (update: PoolUpdate) => void,
): () => void {
  return subscribe("pool:updated", (msg: PubsubMessage) => {
    if (msg.type !== "pool:updated") return;
    if (msg.market_id !== market_id) return;
    cb({
      market_id: msg.market_id,
      totals_by_option: msg.totals_by_option,
      total_pool_kobo: msg.total_pool_kobo,
      total_lines: msg.total_lines,
    });
  });
}

// --- Admin: lockMarket ----------------------------------------------------

export interface LockMarketInput {
  market_id: string;
  admin_user_id: string;
}

export async function lockMarket(input: LockMarketInput): Promise<Market> {
  const db = await getDB();
  const m = await db.get("markets", input.market_id);
  if (!m) throw new MarketNotFound(input.market_id);
  if (m.status === "LOCKED" || m.status === "PENDING_SETTLEMENT") {
    throw new MarketAlreadyLocked(input.market_id);
  }
  if (m.status === "SETTLED" || m.status === "VOIDED") {
    throw new MarketAlreadyLocked(input.market_id);
  }
  m.status = "LOCKED";
  await db.put("markets", m);
  await writeAudit({
    admin_user_id: input.admin_user_id,
    action_kind: "MARKET_LOCK",
    target_type: "market",
    target_id: input.market_id,
    payload: { previous_status: m.status === "LOCKED" ? "OPEN" : m.status },
  });
  publish({ type: "market:locked", market_id: input.market_id });
  return m;
}

// --- Admin: voidMarket ----------------------------------------------------

export interface VoidMarketInput {
  market_id: string;
  reason: string;
  admin_user_id: string;
}

export async function voidMarket(input: VoidMarketInput): Promise<Market> {
  const db = await getDB();
  const m = await db.get("markets", input.market_id);
  if (!m) throw new MarketNotFound(input.market_id);
  if (m.status === "SETTLED") {
    throw new MarketCannotVoid(input.market_id, "already SETTLED");
  }
  if (m.status === "VOIDED") {
    throw new MarketCannotVoid(input.market_id, "already VOIDED");
  }

  // Refund every active wager 100% (no rake, no fee). Mark wagers VOIDED.
  const wagers = await db.getAllFromIndex("wagers", "by-market", input.market_id);
  for (const w of wagers) {
    if (w.status !== "ACTIVE") continue;
    await credit({
      user_id: w.user_id,
      amount_kobo: w.total_stake_kobo,
      kind: "WAGER_REFUND",
      source_tag: "PURCHASED",
      ref_type: "wager",
      ref_id: w.id,
      idempotency_key: `wager-void-refund-${w.id}`,
    });
    w.status = "VOIDED";
    w.cancelled_at = new Date(mockNow()).toISOString();
    await db.put("wagers", w);
    // Mark each line VOID
    const lines = await db.getAllFromIndex("wager_lines", "by-wager", w.id);
    for (const l of lines) {
      l.outcome = "VOID";
      await db.put("wager_lines", l);
    }
  }

  m.status = "VOIDED";
  await db.put("markets", m);

  // Reset cached option pools
  const opts = await db.getAllFromIndex("market_options", "by-market", input.market_id);
  for (const o of opts) {
    o.cached_pool_kobo = 0;
    o.cached_wager_count = 0;
    await db.put("market_options", o);
  }
  m.total_pool_kobo = 0;
  m.total_lines = 0;
  await db.put("markets", m);

  await writeAudit({
    admin_user_id: input.admin_user_id,
    action_kind: "MARKET_VOID",
    target_type: "market",
    target_id: input.market_id,
    payload: { reason: input.reason },
  });
  return m;
}

// --- Admin: settleMarket --------------------------------------------------

export interface SettleMarketInput {
  market_id: string;
  winning_option_id: string;
  admin_user_id: string;
  override_reason?: string;
}

export async function settleMarket(input: SettleMarketInput): Promise<Settlement> {
  const db = await getDB();
  const m = await db.get("markets", input.market_id);
  if (!m) throw new MarketNotFound(input.market_id);
  if (m.status === "SETTLED") {
    throw new MarketAlreadySettled(input.market_id);
  }
  if (m.status === "VOIDED") {
    throw new MarketAlreadySettled(input.market_id);
  }

  // Validate winning_option_id belongs to this market
  const opts = await db.getAllFromIndex("market_options", "by-market", input.market_id);
  const winning_option = opts.find((o) => o.id === input.winning_option_id);
  if (!winning_option) {
    throw new MarketWinningOptionInvalid(input.market_id, input.winning_option_id);
  }

  // Pull lines for the winning option and total stake
  const allLines: WagerLine[] = [];
  for (const opt of opts) {
    const lines = await db.getAllFromIndex("wager_lines", "by-option", opt.id);
    allLines.push(...lines);
  }
  const winning_lines = allLines.filter((l) => l.option_id === input.winning_option_id);

  // Need user_id per winning line — look up via wager
  const winning_with_user = await Promise.all(
    winning_lines.map(async (l) => {
      const w = await db.get("wagers", l.wager_id);
      return { user: w!.user_id, stake_kobo: l.stake_kobo, line_id: l.id };
    }),
  );
  const loser_total = allLines
    .filter((l) => l.option_id !== input.winning_option_id)
    .reduce((a, l) => a + l.stake_kobo, 0);

  const result = settle({
    pool_kobo: m.total_pool_kobo,
    rake_bps: m.rake_bps,
    winning_lines: winning_with_user.map(({ user, stake_kobo }) => ({ user, stake_kobo })),
    loser_total_kobo: loser_total,
  });

  const settlementId = newSettlementId();

  if (result.resolution === "WINNER") {
    // Credit each winning USER (not line) — payouts is keyed by user.
    for (const [user_id, amount_kobo] of Object.entries(result.payouts)) {
      if (amount_kobo <= 0) continue;
      await credit({
        user_id,
        amount_kobo,
        kind: "WAGER_PAYOUT",
        source_tag: "WON",
        ref_type: "settlement",
        ref_id: settlementId,
        idempotency_key: `payout-${settlementId}-${user_id}`,
      });
    }
    // House gets rake + dust
    if (result.house_total > 0) {
      await credit({
        user_id: HOUSE_USER_ID,
        amount_kobo: result.house_total,
        kind: "HOUSE_RAKE",
        source_tag: "WON",
        ref_type: "settlement",
        ref_id: settlementId,
        idempotency_key: `house-rake-${settlementId}`,
      });
    }

    // Mark winning lines + losing lines outcome
    for (const wl of winning_with_user) {
      const line = (await db.get("wager_lines", wl.line_id))!;
      // Lines are per-option, but payouts are aggregated per user. Allocate
      // each line its share by stake (this matches the line's own contribution).
      const userTotalStake = winning_with_user
        .filter((x) => x.user === wl.user)
        .reduce((a, x) => a + x.stake_kobo, 0);
      const userPayout = result.payouts[wl.user] ?? 0;
      const linePayout = userTotalStake > 0
        ? Math.floor((userPayout * wl.stake_kobo) / userTotalStake)
        : 0;
      line.outcome = "WIN";
      line.payout_kobo = linePayout;
      await db.put("wager_lines", line);
    }
    for (const l of allLines) {
      if (l.option_id === input.winning_option_id) continue;
      l.outcome = "LOSS";
      l.payout_kobo = 0;
      await db.put("wager_lines", l);
    }

    // Mark wagers settled
    const wagers = await db.getAllFromIndex("wagers", "by-market", input.market_id);
    for (const w of wagers) {
      if (w.status === "ACTIVE") {
        w.status = "SETTLED";
        await db.put("wagers", w);
      }
    }
  } else {
    // VOID_NO_WINNER or VOID_SOLO_WAGER: refund all 100%
    const wagers = await db.getAllFromIndex("wagers", "by-market", input.market_id);
    for (const w of wagers) {
      if (w.status !== "ACTIVE") continue;
      await credit({
        user_id: w.user_id,
        amount_kobo: w.total_stake_kobo,
        kind: "WAGER_REFUND",
        source_tag: "PURCHASED",
        ref_type: "settlement",
        ref_id: settlementId,
        idempotency_key: `refund-${settlementId}-${w.id}`,
      });
      w.status = "VOIDED";
      w.cancelled_at = new Date(mockNow()).toISOString();
      await db.put("wagers", w);
      const lines = await db.getAllFromIndex("wager_lines", "by-wager", w.id);
      for (const l of lines) {
        l.outcome = "VOID";
        await db.put("wager_lines", l);
      }
    }
  }

  // Settlement row
  const winners_count = Object.keys(result.payouts).length;
  const settlement: Settlement = {
    id: settlementId,
    market_id: input.market_id,
    suggested_option_id: m.suggested_option_id,
    final_option_id: input.winning_option_id,
    resolution: result.resolution as SettlementResolution,
    override_reason: input.override_reason ?? null,
    total_pool_kobo: m.total_pool_kobo,
    rake_kobo: result.house_total,
    paid_out_kobo: Object.values(result.payouts).reduce((a, b) => a + b, 0),
    winners_count,
    lines_count: allLines.length,
    confirmed_by_admin_id: input.admin_user_id,
    confirmed_at: new Date(mockNow()).toISOString(),
  };
  await db.put("settlements", settlement);

  // Update market status
  m.status = "SETTLED";
  m.winning_option_id = input.winning_option_id;
  await db.put("markets", m);

  await writeAudit({
    admin_user_id: input.admin_user_id,
    action_kind: input.override_reason ? "MARKET_SETTLE_OVERRIDE" : "MARKET_SETTLE_AUTO",
    target_type: "market",
    target_id: input.market_id,
    payload: {
      winning_option_id: input.winning_option_id,
      override_reason: input.override_reason ?? null,
      resolution: result.resolution,
      rake_kobo: result.house_total,
      paid_out_kobo: settlement.paid_out_kobo,
    },
  });

  publish({ type: "market:settled", market_id: input.market_id, settlement_id: settlementId });
  return settlement;
}

// --- audit helper ---------------------------------------------------------

export async function writeAudit(entry: {
  admin_user_id: string;
  action_kind: string;
  target_type: string;
  target_id: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const db = await getDB();
  await db.put("audit_log", {
    id: newAuditId(),
    admin_user_id: entry.admin_user_id,
    action_kind: entry.action_kind,
    target_type: entry.target_type,
    target_id: entry.target_id,
    payload: entry.payload,
    created_at: new Date(mockNow()).toISOString(),
  });
}
