// Wager handler — placeWager / cancelWager / listMyWagers / getMarketWithOptions.
//
// placeWager rejects when market is not OPEN, locked, below min, above cap, or
// duplicate. Atomic: writes wager + lines, debits stake, updates market totals.
// Publishes pool:updated + wallet:debited.
//
// cancelWager: only OPEN-non-locked. 1% fee → HOUSE, 99% refund → user
// (PURCHASED tag for simplicity per spec). Decrements pool, marks CANCELLED,
// deletes lines.

import { getDB } from "../store";
import { mockNow, isPastLockAt } from "../clock";
import { publish } from "../pubsub";
import { CANCEL_FEE_BPS, HOUSE_USER_ID, MIN_WAGER_KOBO } from "../../utils";
import type {
  Market,
  MarketOption,
  PoolUpdate,
  Wager,
  WagerLine,
} from "../types";
import { credit, debit } from "./wallet";

// --- Errors ---------------------------------------------------------------

export class MarketNotOpen extends Error {
  constructor(market_id: string, status: string) {
    super(`Market ${market_id} not open (status=${status})`);
    this.name = "MarketNotOpen";
  }
}

export class MarketLocked extends Error {
  constructor(market_id: string) {
    super(`Market ${market_id} is locked`);
    this.name = "MarketLocked";
  }
}

export class StakeTooLow extends Error {
  constructor(stake: number, min: number) {
    super(`Stake ${stake} below min ${min}`);
    this.name = "StakeTooLow";
  }
}

export class StakeAboveCap extends Error {
  constructor(stake: number, cap: number) {
    super(`Stake ${stake} above per-user cap ${cap}`);
    this.name = "StakeAboveCap";
  }
}

export class DuplicateWager extends Error {
  constructor(market_id: string, user_id: string) {
    super(`User ${user_id} already has wager on ${market_id}`);
    this.name = "DuplicateWager";
  }
}

export class WagerNotFound extends Error {
  constructor(id: string) {
    super(`Wager ${id} not found`);
    this.name = "WagerNotFound";
  }
}

export class WagerCannotBeCancelled extends Error {
  constructor(id: string, reason: string) {
    super(`Wager ${id} cannot be cancelled: ${reason}`);
    this.name = "WagerCannotBeCancelled";
  }
}

export class MarketOptionMismatch extends Error {
  constructor(option_id: string, market_id: string) {
    super(`Option ${option_id} does not belong to market ${market_id}`);
    this.name = "MarketOptionMismatch";
  }
}

// --- IDs ------------------------------------------------------------------

function newWagerId(): string {
  return `wgr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function newLineId(): string {
  return `wln_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// --- placeWager -----------------------------------------------------------

export interface PlaceWagerInput {
  market_id: string;
  user_id: string;
  lines: { option_id: string; stake_kobo: number }[];
}

export async function placeWager(input: PlaceWagerInput): Promise<Wager> {
  if (input.lines.length === 0) {
    throw new StakeTooLow(0, MIN_WAGER_KOBO);
  }
  const total_stake = input.lines.reduce((a, l) => a + l.stake_kobo, 0);
  for (const l of input.lines) {
    if (l.stake_kobo <= 0) throw new StakeTooLow(l.stake_kobo, 1);
  }

  const db = await getDB();
  const market = await db.get("markets", input.market_id);
  if (!market) throw new MarketNotOpen(input.market_id, "MISSING");
  if (market.status !== "OPEN") {
    throw new MarketNotOpen(input.market_id, market.status);
  }
  if (isPastLockAt(market.lock_at)) {
    throw new MarketLocked(input.market_id);
  }
  if (total_stake < (market.min_stake_kobo || MIN_WAGER_KOBO)) {
    throw new StakeTooLow(total_stake, market.min_stake_kobo || MIN_WAGER_KOBO);
  }
  if (
    market.max_per_user_kobo != null &&
    total_stake > market.max_per_user_kobo
  ) {
    throw new StakeAboveCap(total_stake, market.max_per_user_kobo);
  }

  // Validate options belong to this market
  const optMap = new Map<string, MarketOption>();
  const allOpts = await db.getAllFromIndex(
    "market_options",
    "by-market",
    input.market_id,
  );
  for (const o of allOpts) optMap.set(o.id, o);
  for (const l of input.lines) {
    if (!optMap.has(l.option_id)) {
      throw new MarketOptionMismatch(l.option_id, input.market_id);
    }
  }

  // Duplicate check
  const dup = await db.getFromIndex(
    "wagers",
    "by-user-market",
    [input.user_id, input.market_id] as [string, string],
  );
  if (dup) throw new DuplicateWager(input.market_id, input.user_id);

  // Debit first (transactional inside wallet handler)
  const wagerId = newWagerId();
  const idemKey = `wager-place-${wagerId}`;
  const debitRes = await debit({
    user_id: input.user_id,
    amount_kobo: total_stake,
    kind: "WAGER_PLACE",
    ref_type: "wager",
    ref_id: wagerId,
    idempotency_key: idemKey,
  });

  // Aggregate per-option totals & counts (one wager = at most 1 count per option)
  const perOption = new Map<string, { stake: number; count: number }>();
  for (const l of input.lines) {
    const cur = perOption.get(l.option_id) ?? { stake: 0, count: 0 };
    cur.stake += l.stake_kobo;
    perOption.set(l.option_id, cur);
  }
  for (const opt_id of perOption.keys()) {
    perOption.get(opt_id)!.count = 1;
  }

  // Now atomically create wager + lines + update market + options
  const tx = db.transaction(["wagers", "wager_lines", "markets", "market_options"], "readwrite");
  const txDone = tx.done.catch(() => {});
  try {
    const lineRows: WagerLine[] = [];
    for (const l of input.lines) {
      const lr: WagerLine = {
        id: newLineId(),
        wager_id: wagerId,
        option_id: l.option_id,
        stake_kobo: l.stake_kobo,
        payout_kobo: null,
        outcome: null,
      };
      await tx.objectStore("wager_lines").put(lr);
      lineRows.push(lr);
    }

    const wager: Wager = {
      id: wagerId,
      user_id: input.user_id,
      market_id: input.market_id,
      total_stake_kobo: total_stake,
      status: "ACTIVE",
      placed_at: new Date(mockNow()).toISOString(),
      cancelled_at: null,
      debit_txn_id: debitRes.txns[0]?.id ?? "",
      lines: lineRows,
    };
    await tx.objectStore("wagers").put(wager);

    // Update market totals
    const m = (await tx.objectStore("markets").get(input.market_id))!;
    m.total_pool_kobo += total_stake;
    m.total_lines += input.lines.length;
    await tx.objectStore("markets").put(m);

    // Update each option
    for (const [opt_id, agg] of perOption.entries()) {
      const opt = (await tx.objectStore("market_options").get(opt_id))!;
      opt.cached_pool_kobo += agg.stake;
      opt.cached_wager_count += agg.count;
      await tx.objectStore("market_options").put(opt);
    }

    await txDone;

    await publishPoolUpdate(input.market_id);
    return wager;
  } catch (e) {
    try {
      tx.abort();
    } catch {
      /* */
    }
    await txDone;
    throw e;
  }
}

// --- cancelWager ----------------------------------------------------------

export async function cancelWager(wager_id: string): Promise<Wager> {
  const db = await getDB();
  const w = await db.get("wagers", wager_id);
  if (!w) throw new WagerNotFound(wager_id);
  if (w.status !== "ACTIVE") {
    throw new WagerCannotBeCancelled(wager_id, `status=${w.status}`);
  }
  const m = await db.get("markets", w.market_id);
  if (!m) throw new WagerCannotBeCancelled(wager_id, "market missing");
  if (m.status !== "OPEN") {
    throw new WagerCannotBeCancelled(wager_id, `market status=${m.status}`);
  }
  if (isPastLockAt(m.lock_at)) {
    throw new MarketLocked(m.id);
  }

  const fee_kobo = Math.floor((w.total_stake_kobo * CANCEL_FEE_BPS) / 10000);
  const refund_kobo = w.total_stake_kobo - fee_kobo;

  // Refund user (PURCHASED — simple convention per spec)
  await credit({
    user_id: w.user_id,
    amount_kobo: refund_kobo,
    kind: "WAGER_REFUND",
    source_tag: "PURCHASED",
    ref_type: "wager",
    ref_id: wager_id,
    idempotency_key: `wager-refund-${wager_id}`,
  });

  // House gets the fee
  if (fee_kobo > 0) {
    await credit({
      user_id: HOUSE_USER_ID,
      amount_kobo: fee_kobo,
      kind: "WAGER_CANCEL_FEE",
      source_tag: "WON",
      ref_type: "wager",
      ref_id: wager_id,
      idempotency_key: `wager-cancel-fee-${wager_id}`,
    });
  }

  // Update wager + market + options + delete lines atomically
  const lines = await db.getAllFromIndex("wager_lines", "by-wager", wager_id);
  const perOption = new Map<string, { stake: number; count: number }>();
  for (const l of lines) {
    const cur = perOption.get(l.option_id) ?? { stake: 0, count: 0 };
    cur.stake += l.stake_kobo;
    cur.count = 1;
    perOption.set(l.option_id, cur);
  }

  const tx = db.transaction(
    ["wagers", "wager_lines", "markets", "market_options"],
    "readwrite",
  );
  const txDone = tx.done.catch(() => {});
  try {
    for (const l of lines) {
      await tx.objectStore("wager_lines").delete(l.id);
    }
    const fresh = await tx.objectStore("wagers").get(wager_id);
    if (fresh) {
      fresh.status = "CANCELLED";
      fresh.cancelled_at = new Date(mockNow()).toISOString();
      fresh.lines = [];
      await tx.objectStore("wagers").put(fresh);
    }
    const fm = await tx.objectStore("markets").get(w.market_id);
    if (fm) {
      fm.total_pool_kobo -= w.total_stake_kobo;
      fm.total_lines -= lines.length;
      await tx.objectStore("markets").put(fm);
    }
    for (const [opt_id, agg] of perOption.entries()) {
      const opt = await tx.objectStore("market_options").get(opt_id);
      if (opt) {
        opt.cached_pool_kobo -= agg.stake;
        opt.cached_wager_count -= agg.count;
        await tx.objectStore("market_options").put(opt);
      }
    }
    await txDone;

    await publishPoolUpdate(w.market_id);
    const updated = await db.get("wagers", wager_id);
    return updated!;
  } catch (e) {
    try {
      tx.abort();
    } catch {
      /* */
    }
    await txDone;
    throw e;
  }
}

// --- listMyWagers ---------------------------------------------------------

export interface ListMyWagersInput {
  user_id: string;
  status?: Wager["status"];
  market_id?: string;
  limit?: number;
  offset?: number;
}

export async function listMyWagers(input: ListMyWagersInput): Promise<Wager[]> {
  const db = await getDB();
  let wagers = await db.getAllFromIndex("wagers", "by-user", input.user_id);
  if (input.status) wagers = wagers.filter((w) => w.status === input.status);
  if (input.market_id) wagers = wagers.filter((w) => w.market_id === input.market_id);
  wagers.sort(
    (a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime(),
  );
  const offset = input.offset ?? 0;
  const limit = input.limit ?? wagers.length;
  const slice = wagers.slice(offset, offset + limit);

  // Hydrate lines
  for (const w of slice) {
    const lines = await db.getAllFromIndex("wager_lines", "by-wager", w.id);
    w.lines = lines;
  }
  return slice;
}

// --- getMarketWithOptions -------------------------------------------------

export async function getMarketWithOptions(market_id: string): Promise<Market> {
  const db = await getDB();
  const market = await db.get("markets", market_id);
  if (!market) throw new Error(`Market ${market_id} not found`);
  const options = await db.getAllFromIndex(
    "market_options",
    "by-market",
    market_id,
  );
  options.sort((a, b) => a.sort_order - b.sort_order);
  return { ...market, options };
}

// --- helpers --------------------------------------------------------------

async function publishPoolUpdate(market_id: string): Promise<void> {
  const db = await getDB();
  const market = await db.get("markets", market_id);
  if (!market) return;
  const opts = await db.getAllFromIndex(
    "market_options",
    "by-market",
    market_id,
  );
  const totals_by_option: PoolUpdate["totals_by_option"] = {};
  for (const o of opts) {
    totals_by_option[o.id] = {
      pool_kobo: o.cached_pool_kobo,
      wager_count: o.cached_wager_count,
    };
  }
  publish({
    type: "pool:updated",
    market_id,
    totals_by_option,
    total_pool_kobo: market.total_pool_kobo,
    total_lines: market.total_lines,
  });
}
