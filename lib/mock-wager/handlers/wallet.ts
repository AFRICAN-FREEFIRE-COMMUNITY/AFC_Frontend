// Wallet handler — credit / debit / getBalance / listTxns + sendP2P + startWithdrawal.
//
// All money in kobo. Source-tags: PURCHASED / WON / GIFT.
// Spend ladder for debit: GIFT → WON → PURCHASED.
// Idempotency: every call must include an idempotency_key. Re-using a key
// returns the existing txn(s) without further mutation.
//
// Atomicity: a single idb readwrite transaction wraps all mutations.

import { getDB } from "../store";
import { mockNow } from "../clock";
import { publish } from "../pubsub";
import {
  GIFT_DAILY_CAP_KOBO,
  HOUSE_USER_ID,
  MIN_WITHDRAW_KOBO,
  P2P_DAILY_CAP_KOBO,
  P2P_FEE_BPS,
} from "../../utils";
import type {
  Balance,
  FxSnapshot,
  P2PResult,
  SourceTag,
  WalletTxn,
  WalletTxnKind,
  WithdrawRail,
  WithdrawalRequest,
} from "../types";

// --- Errors ---------------------------------------------------------------

export class WalletNotFound extends Error {
  constructor(user_id: string) {
    super(`Wallet not found for user ${user_id}`);
    this.name = "WalletNotFound";
  }
}

export class WalletFrozen extends Error {
  constructor(user_id: string) {
    super(`Wallet frozen for user ${user_id}`);
    this.name = "WalletFrozen";
  }
}

export class InsufficientFunds extends Error {
  constructor(public required_kobo: number, public available_kobo: number) {
    super(
      `Insufficient funds: required ${required_kobo}, available ${available_kobo}`,
    );
    this.name = "InsufficientFunds";
  }
}

export class GiftDailyCapExceeded extends Error {
  constructor(public remaining_kobo: number, public requested_kobo: number) {
    super(
      `Gift daily cap exceeded: remaining ${remaining_kobo}, requested ${requested_kobo}`,
    );
    this.name = "GiftDailyCapExceeded";
  }
}

// --- Helpers --------------------------------------------------------------

function newTxnId(): string {
  return `txn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getCurrentFxId(): Promise<string> {
  const db = await getDB();
  const all = (await db.getAll("fx_snapshots")) as FxSnapshot[];
  if (all.length === 0) {
    // Synthesize a default fallback so credit/debit can still write.
    const fb: FxSnapshot = {
      id: "fx_default",
      captured_at: new Date(mockNow()).toISOString(),
      ngn_per_usd: 1500,
      source: "fallback",
    };
    await db.put("fx_snapshots", fb);
    return fb.id;
  }
  // Most recent (max captured_at)
  return all.reduce((latest, x) =>
    new Date(x.captured_at).getTime() > new Date(latest.captured_at).getTime()
      ? x
      : latest,
  ).id;
}

async function getCurrentFx(): Promise<FxSnapshot> {
  const db = await getDB();
  const all = (await db.getAll("fx_snapshots")) as FxSnapshot[];
  if (all.length === 0) {
    const fb: FxSnapshot = {
      id: "fx_default",
      captured_at: new Date(mockNow()).toISOString(),
      ngn_per_usd: 1500,
      source: "fallback",
    };
    await db.put("fx_snapshots", fb);
    return fb;
  }
  return all.reduce((latest, x) =>
    new Date(x.captured_at).getTime() > new Date(latest.captured_at).getTime()
      ? x
      : latest,
  );
}

// --- credit ---------------------------------------------------------------

export interface CreditInput {
  user_id: string;
  amount_kobo: number;
  kind: WalletTxnKind;
  source_tag: SourceTag;
  ref_type: string;
  ref_id: string;
  idempotency_key: string;
}

export async function credit(input: CreditInput): Promise<WalletTxn> {
  if (input.amount_kobo <= 0) {
    throw new Error("credit amount must be positive");
  }
  const db = await getDB();

  // Idempotency check (separate small read; the followup tx still re-checks).
  const existing = await db.getFromIndex(
    "wallet_txns",
    "by-idempotency",
    input.idempotency_key,
  );
  if (existing) return existing;

  // Gift cap pre-check (read-only). Re-check inside the tx.
  if (input.source_tag === "GIFT") {
    const used = await sumGiftReceiptsLast24hInternal(input.user_id);
    const remaining = GIFT_DAILY_CAP_KOBO - used;
    if (input.amount_kobo > remaining) {
      throw new GiftDailyCapExceeded(remaining, input.amount_kobo);
    }
  }

  const fx_id = await getCurrentFxId();

  // Write inside one transaction.
  const tx = db.transaction(["wallets", "wallet_txns"], "readwrite");
  // Swallow the implicit tx.done rejection that idb raises when we abort
  // the tx so test runners don't surface it as an unhandled rejection.
  const txDone = tx.done.catch(() => {});
  try {
    // Re-check idempotency inside tx.
    const idemIdx = tx.objectStore("wallet_txns").index("by-idempotency");
    const dup = await idemIdx.get(input.idempotency_key);
    if (dup) {
      await txDone;
      return dup;
    }

    const walletIdx = tx.objectStore("wallets").index("by-user");
    const wallet = await walletIdx.get(input.user_id);
    if (!wallet) throw new WalletNotFound(input.user_id);
    if (wallet.status === "FROZEN") throw new WalletFrozen(input.user_id);

    const txnRow: WalletTxn = {
      id: newTxnId(),
      wallet_id: wallet.id,
      amount_kobo: input.amount_kobo,
      kind: input.kind,
      source_tag: input.source_tag,
      ref_type: input.ref_type,
      ref_id: input.ref_id,
      fx_snapshot_id: fx_id,
      idempotency_key: input.idempotency_key,
      created_at: new Date(mockNow()).toISOString(),
    };

    wallet.balance_kobo += input.amount_kobo;
    if (input.source_tag === "PURCHASED") {
      wallet.balance_purchased_kobo += input.amount_kobo;
    } else if (input.source_tag === "WON") {
      wallet.balance_won_kobo += input.amount_kobo;
    } else if (input.source_tag === "GIFT") {
      wallet.balance_gift_kobo += input.amount_kobo;
    }

    await tx.objectStore("wallet_txns").put(txnRow);
    await tx.objectStore("wallets").put(wallet);
    await txDone;

    publish({
      type: "wallet:credited",
      user_id: input.user_id,
      amount_kobo: input.amount_kobo,
    });
    return txnRow;
  } catch (e) {
    try {
      tx.abort();
    } catch {
      /* already finished */
    }
    await txDone;
    throw e;
  }
}

// --- debit ----------------------------------------------------------------

export interface DebitInput {
  user_id: string;
  amount_kobo: number;
  kind: WalletTxnKind;
  ref_type: string;
  ref_id: string;
  idempotency_key: string;
}

export interface DebitResult {
  txns: WalletTxn[];
  breakdown: Record<SourceTag, number>;
  total_debited_kobo: number;
}

const SPEND_LADDER: SourceTag[] = ["GIFT", "WON", "PURCHASED"];

function bucketBalance(
  wallet: { balance_gift_kobo: number; balance_won_kobo: number; balance_purchased_kobo: number },
  tag: SourceTag,
): number {
  if (tag === "GIFT") return wallet.balance_gift_kobo;
  if (tag === "WON") return wallet.balance_won_kobo;
  return wallet.balance_purchased_kobo;
}

function bucketKey(tag: SourceTag): "balance_gift_kobo" | "balance_won_kobo" | "balance_purchased_kobo" {
  if (tag === "GIFT") return "balance_gift_kobo";
  if (tag === "WON") return "balance_won_kobo";
  return "balance_purchased_kobo";
}

export async function debit(input: DebitInput): Promise<DebitResult> {
  if (input.amount_kobo <= 0) {
    throw new Error("debit amount must be positive");
  }
  const db = await getDB();

  // Idempotency: if any txn with this key exists, reconstruct the result.
  // Debit may produce multiple txns sharing a base key (suffixed per bucket),
  // so we look up by the prefix-matching base key with index range.
  const existing = await findDebitByBaseKey(input.idempotency_key);
  if (existing.length > 0) {
    const breakdown: Record<SourceTag, number> = { GIFT: 0, WON: 0, PURCHASED: 0 };
    let total = 0;
    for (const t of existing) {
      breakdown[t.source_tag] += -t.amount_kobo;
      total += -t.amount_kobo;
    }
    return { txns: existing, breakdown, total_debited_kobo: total };
  }

  const fx_id = await getCurrentFxId();
  const tx = db.transaction(["wallets", "wallet_txns"], "readwrite");
  const txDone = tx.done.catch(() => {});
  try {
    // Re-check inside tx
    const dups = await findDebitByBaseKeyInTx(tx, input.idempotency_key);
    if (dups.length > 0) {
      await txDone;
      const breakdown: Record<SourceTag, number> = { GIFT: 0, WON: 0, PURCHASED: 0 };
      let total = 0;
      for (const t of dups) {
        breakdown[t.source_tag] += -t.amount_kobo;
        total += -t.amount_kobo;
      }
      return { txns: dups, breakdown, total_debited_kobo: total };
    }

    const walletIdx = tx.objectStore("wallets").index("by-user");
    const wallet = await walletIdx.get(input.user_id);
    if (!wallet) throw new WalletNotFound(input.user_id);
    if (wallet.status === "FROZEN") throw new WalletFrozen(input.user_id);
    if (wallet.balance_kobo < input.amount_kobo) {
      throw new InsufficientFunds(input.amount_kobo, wallet.balance_kobo);
    }

    const breakdown: Record<SourceTag, number> = { GIFT: 0, WON: 0, PURCHASED: 0 };
    const txns: WalletTxn[] = [];
    let remaining = input.amount_kobo;
    const now_iso = new Date(mockNow()).toISOString();

    for (const tag of SPEND_LADDER) {
      if (remaining === 0) break;
      const avail = bucketBalance(wallet, tag);
      if (avail <= 0) continue;
      const take = Math.min(avail, remaining);

      const txnRow: WalletTxn = {
        id: newTxnId(),
        wallet_id: wallet.id,
        amount_kobo: -take,
        kind: input.kind,
        source_tag: tag,
        ref_type: input.ref_type,
        ref_id: input.ref_id,
        fx_snapshot_id: fx_id,
        idempotency_key: `${input.idempotency_key}::${tag}`,
        created_at: now_iso,
      };
      await tx.objectStore("wallet_txns").put(txnRow);

      const key = bucketKey(tag);
      wallet[key] -= take;
      wallet.balance_kobo -= take;
      breakdown[tag] = take;
      txns.push(txnRow);
      remaining -= take;
    }

    await tx.objectStore("wallets").put(wallet);
    await txDone;

    publish({
      type: "wallet:debited",
      user_id: input.user_id,
      amount_kobo: input.amount_kobo,
    });

    return { txns, breakdown, total_debited_kobo: input.amount_kobo };
  } catch (e) {
    try {
      tx.abort();
    } catch {
      /* already finished */
    }
    await txDone;
    throw e;
  }
}

async function findDebitByBaseKey(base: string): Promise<WalletTxn[]> {
  const db = await getDB();
  const all = await db.getAll("wallet_txns");
  return all.filter((t) =>
    t.idempotency_key === base ||
    t.idempotency_key.startsWith(`${base}::`),
  );
}

async function findDebitByBaseKeyInTx(
  tx: Awaited<ReturnType<Awaited<ReturnType<typeof getDB>>["transaction"]>>,
  base: string,
): Promise<WalletTxn[]> {
  // We iterate the index by-idempotency. Since txn keys are unique,
  // we look up exact + prefix matches.
  const idemIdx = tx.objectStore("wallet_txns").index("by-idempotency");
  const out: WalletTxn[] = [];
  let cursor = await idemIdx.openCursor();
  while (cursor) {
    const k = cursor.value.idempotency_key;
    if (k === base || k.startsWith(`${base}::`)) {
      out.push(cursor.value);
    }
    cursor = await cursor.continue();
  }
  return out;
}

// --- Gift cap helper (internal — same logic as gift-cap.ts but without the
// extra index round-trip) ----------------------------------------------------

async function sumGiftReceiptsLast24hInternal(user_id: string): Promise<number> {
  const db = await getDB();
  const wallets = await db.getAllFromIndex("wallets", "by-user", user_id);
  if (wallets.length === 0) return 0;
  const wallet = wallets[0];
  const txns = await db.getAllFromIndex("wallet_txns", "by-wallet", wallet.id);
  const cutoff = mockNow() - 24 * 60 * 60 * 1000;
  return txns
    .filter(
      (t) =>
        t.source_tag === "GIFT" &&
        t.amount_kobo > 0 &&
        new Date(t.created_at).getTime() >= cutoff,
    )
    .reduce((a, t) => a + t.amount_kobo, 0);
}

// --- getBalance -----------------------------------------------------------

export async function getBalance(user_id: string): Promise<Balance> {
  const db = await getDB();
  const wallets = await db.getAllFromIndex("wallets", "by-user", user_id);
  if (wallets.length === 0) throw new WalletNotFound(user_id);
  const w = wallets[0];
  const fx = await getCurrentFx();
  return {
    total_kobo: w.balance_kobo,
    purchased_kobo: w.balance_purchased_kobo,
    won_kobo: w.balance_won_kobo,
    gift_kobo: w.balance_gift_kobo,
    locked_kobo: w.locked_kobo,
    fx,
  };
}

// --- listTxns -------------------------------------------------------------

export interface ListTxnsInput {
  user_id: string;
  kind?: WalletTxnKind;
  source_tag?: SourceTag;
  since?: string; // ISO
  until?: string; // ISO
  limit?: number;
  offset?: number;
}

export async function listTxns(input: ListTxnsInput): Promise<WalletTxn[]> {
  const db = await getDB();
  const wallets = await db.getAllFromIndex("wallets", "by-user", input.user_id);
  if (wallets.length === 0) return [];
  const w = wallets[0];
  let txns = await db.getAllFromIndex("wallet_txns", "by-wallet", w.id);

  if (input.kind) txns = txns.filter((t) => t.kind === input.kind);
  if (input.source_tag) txns = txns.filter((t) => t.source_tag === input.source_tag);
  if (input.since) {
    const since_ms = new Date(input.since).getTime();
    txns = txns.filter((t) => new Date(t.created_at).getTime() >= since_ms);
  }
  if (input.until) {
    const until_ms = new Date(input.until).getTime();
    txns = txns.filter((t) => new Date(t.created_at).getTime() <= until_ms);
  }

  txns.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const offset = input.offset ?? 0;
  const limit = input.limit ?? txns.length;
  return txns.slice(offset, offset + limit);
}

// --- sendP2P --------------------------------------------------------------

export class RecipientNotFound extends Error {
  constructor(username: string) {
    super(`Recipient '${username}' not found`);
    this.name = "RecipientNotFound";
  }
}

export class CannotSendToSelf extends Error {
  constructor() {
    super("Cannot P2P to your own account");
    this.name = "CannotSendToSelf";
  }
}

export class P2PDailyCapExceeded extends Error {
  constructor(public remaining_kobo: number, public requested_kobo: number) {
    super(
      `Daily cap exceeded: remaining ${remaining_kobo}, requested ${requested_kobo}`,
    );
    this.name = "P2PDailyCapExceeded";
  }
}

export interface SendP2PInput {
  sender_id: string;
  recipient_username: string;
  amount_kobo: number;
  note?: string;
}

/**
 * Sender debits (amount + 1% fee). Recipient credits amount as PURCHASED.
 * House credits the fee as WON. Atomicity is best-effort across handlers
 * (each is itself transactional). Daily ₦25M outbound cap enforced per sender.
 */
export async function sendP2P(input: SendP2PInput): Promise<P2PResult> {
  if (input.amount_kobo <= 0) {
    throw new Error("amount must be positive");
  }
  const db = await getDB();
  const recipient = await db.getFromIndex(
    "users",
    "by-username",
    input.recipient_username,
  );
  if (!recipient) throw new RecipientNotFound(input.recipient_username);
  if (recipient.id === input.sender_id) throw new CannotSendToSelf();

  const fee_kobo = Math.floor((input.amount_kobo * P2P_FEE_BPS) / 10000);
  const total_debit = input.amount_kobo + fee_kobo;

  // Daily cap check (rolling 24h sum of P2P_OUT |amount|)
  const used = await sumP2POutLast24h(input.sender_id);
  const remaining = P2P_DAILY_CAP_KOBO - used;
  if (input.amount_kobo > remaining) {
    throw new P2PDailyCapExceeded(remaining, input.amount_kobo);
  }

  const transferId = `p2p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // Step 1: debit sender
  const debitRes = await debit({
    user_id: input.sender_id,
    amount_kobo: total_debit,
    kind: "P2P_OUT",
    ref_type: "p2p_transfer",
    ref_id: transferId,
    idempotency_key: `p2p-out-${transferId}`,
  });

  // Step 2: credit recipient
  const recipientTxn = await credit({
    user_id: recipient.id,
    amount_kobo: input.amount_kobo,
    kind: "P2P_IN",
    source_tag: "PURCHASED",
    ref_type: "p2p_transfer",
    ref_id: transferId,
    idempotency_key: `p2p-in-${transferId}`,
  });

  // Step 3: house gets fee
  let feeTxnId: string | null = null;
  if (fee_kobo > 0) {
    const feeTxn = await credit({
      user_id: HOUSE_USER_ID,
      amount_kobo: fee_kobo,
      kind: "P2P_FEE",
      source_tag: "WON",
      ref_type: "p2p_transfer",
      ref_id: transferId,
      idempotency_key: `p2p-fee-${transferId}`,
    });
    feeTxnId = feeTxn.id;
  }

  return {
    transfer_id: transferId,
    amount_kobo: input.amount_kobo,
    fee_kobo,
    recipient_username: input.recipient_username,
    receipt_txn_ids: [
      ...debitRes.txns.map((t) => t.id),
      recipientTxn.id,
      ...(feeTxnId ? [feeTxnId] : []),
    ],
  };
}

async function sumP2POutLast24h(user_id: string): Promise<number> {
  const db = await getDB();
  const wallets = await db.getAllFromIndex("wallets", "by-user", user_id);
  if (wallets.length === 0) return 0;
  const wallet = wallets[0];
  const txns = await db.getAllFromIndex("wallet_txns", "by-wallet", wallet.id);
  const cutoff = mockNow() - 24 * 60 * 60 * 1000;
  return txns
    .filter(
      (t) =>
        t.kind === "P2P_OUT" &&
        new Date(t.created_at).getTime() >= cutoff,
    )
    .reduce((a, t) => a + Math.abs(t.amount_kobo), 0);
}

export async function getP2PUsedToday(user_id: string): Promise<number> {
  return sumP2POutLast24h(user_id);
}

// --- startWithdrawal ------------------------------------------------------

export class WithdrawalBelowMin extends Error {
  constructor(public amount_kobo: number, public min_kobo: number) {
    super(`Withdrawal ${amount_kobo} below min ${min_kobo}`);
    this.name = "WithdrawalBelowMin";
  }
}

export interface StartWithdrawalInput {
  user_id: string;
  amount_kobo: number;
  rail: WithdrawRail;
  destination: Record<string, unknown>;
}

/**
 * Holds funds (debits) and creates a WithdrawalRequest in REQUESTED state.
 * Admin approve/reject lives in admin handlers. Cosign required >₦5M.
 */
export async function startWithdrawal(
  input: StartWithdrawalInput,
): Promise<WithdrawalRequest> {
  if (input.amount_kobo < MIN_WITHDRAW_KOBO) {
    throw new WithdrawalBelowMin(input.amount_kobo, MIN_WITHDRAW_KOBO);
  }
  const db = await getDB();
  const wid = `wd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // Hold the funds — debit ladder applies (GIFT → WON → PURCHASED).
  await debit({
    user_id: input.user_id,
    amount_kobo: input.amount_kobo,
    kind: "WITHDRAW_HOLD",
    ref_type: "withdrawal",
    ref_id: wid,
    idempotency_key: `wd-hold-${wid}`,
  });

  const cosign_required = input.amount_kobo > 500_000_00;
  const wd: WithdrawalRequest = {
    id: wid,
    user_id: input.user_id,
    amount_kobo: input.amount_kobo,
    rail: input.rail,
    destination: input.destination,
    status: "REQUESTED",
    approved_by_admin_id: null,
    cosign_status: cosign_required ? "AWAITING" : "NOT_REQUIRED",
    created_at: new Date(mockNow()).toISOString(),
  };
  await db.put("withdrawal_requests", wd);
  return wd;
}
