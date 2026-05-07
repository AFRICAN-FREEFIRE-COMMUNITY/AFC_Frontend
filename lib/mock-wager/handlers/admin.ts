// Admin handler — settlement queue, voucher gen/redeem, withdrawal review,
// wallet freeze/unfreeze, audit log.
//
// All privileged actions hit audit_log via writeAudit().

import { getDB } from "../store";
import { mockNow } from "../clock";
import { credit } from "./wallet";
import { settleMarket, voidMarket, writeAudit } from "./markets";
import type {
  Market,
  Settlement,
  Voucher,
  WithdrawalRequest,
} from "../types";

// --- Errors ---------------------------------------------------------------

export class VoucherInvalid extends Error {
  constructor(code: string) {
    super(`Voucher ${code} not found`);
    this.name = "VoucherInvalid";
  }
}

export class VoucherExpired extends Error {
  constructor(code: string) {
    super(`Voucher ${code} expired`);
    this.name = "VoucherExpired";
  }
}

export class VoucherExhausted extends Error {
  constructor(code: string) {
    super(`Voucher ${code} fully redeemed`);
    this.name = "VoucherExhausted";
  }
}

export class VoucherAlreadyRedeemed extends Error {
  constructor(code: string, user_id: string) {
    super(`User ${user_id} already redeemed ${code}`);
    this.name = "VoucherAlreadyRedeemed";
  }
}

export class WithdrawalNotFound extends Error {
  constructor(id: string) {
    super(`Withdrawal ${id} not found`);
    this.name = "WithdrawalNotFound";
  }
}

export class WithdrawalAlreadyHandled extends Error {
  constructor(id: string, status: string) {
    super(`Withdrawal ${id} already handled (status=${status})`);
    this.name = "WithdrawalAlreadyHandled";
  }
}

// --- ID helpers -----------------------------------------------------------

function newVoucherId(): string {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function newRedemptionId(): string {
  return `vr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateCode(): string {
  // Excludes 0/O/1/I to make it human-readable.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

// --- Settlement queue -----------------------------------------------------

export interface PendingSettlementRow {
  market: Market;
  auto_suggested_option_id: string | null;
}

export async function listPendingSettlements(): Promise<PendingSettlementRow[]> {
  const db = await getDB();
  const markets = await db.getAllFromIndex("markets", "by-status", "PENDING_SETTLEMENT");
  const rows: PendingSettlementRow[] = [];
  for (const m of markets) {
    const opts = await db.getAllFromIndex("market_options", "by-market", m.id);
    opts.sort((a, b) => a.sort_order - b.sort_order);
    let suggested: string | null = m.suggested_option_id ?? null;
    if (!suggested && opts.length > 0) {
      // Fallback: pick the option with the largest cached pool
      const top = opts.reduce((a, b) =>
        b.cached_pool_kobo > a.cached_pool_kobo ? b : a,
      );
      suggested = top.cached_pool_kobo > 0 ? top.id : null;
    }
    rows.push({ market: { ...m, options: opts }, auto_suggested_option_id: suggested });
  }
  return rows;
}

export interface ConfirmSettlementInput {
  market_id: string;
  final_option_id: string;
  admin_user_id: string;
  override_reason?: string;
}

export async function confirmSettlement(
  input: ConfirmSettlementInput,
): Promise<Settlement> {
  return await settleMarket({
    market_id: input.market_id,
    winning_option_id: input.final_option_id,
    admin_user_id: input.admin_user_id,
    override_reason: input.override_reason,
  });
}

export interface AdminVoidMarketInput {
  market_id: string;
  reason: string;
  admin_user_id: string;
}

export async function adminVoidMarket(input: AdminVoidMarketInput): Promise<Market> {
  return await voidMarket(input);
}

// --- Vouchers -------------------------------------------------------------

export interface GenerateVoucherInput {
  code?: string;
  amount_kobo: number;
  max_uses: number;
  expires_at?: string;
  admin_user_id: string;
}

export async function generateVoucher(input: GenerateVoucherInput): Promise<Voucher> {
  const db = await getDB();
  const codeRaw = input.code ?? generateCode();
  const code = codeRaw.trim().toUpperCase();
  if (code.length === 0) throw new Error("voucher code empty");

  // Reject duplicate code
  const existing = await db.getFromIndex("vouchers", "by-code", code);
  if (existing) {
    throw new Error(`Voucher code ${code} already exists`);
  }

  const v: Voucher = {
    id: newVoucherId(),
    code,
    amount_kobo: input.amount_kobo,
    max_uses: input.max_uses,
    used_count: 0,
    expires_at: input.expires_at ?? null,
  };
  await db.put("vouchers", v);
  await writeAudit({
    admin_user_id: input.admin_user_id,
    action_kind: "VOUCHER_GENERATE",
    target_type: "voucher",
    target_id: v.id,
    payload: { code, amount_kobo: input.amount_kobo, max_uses: input.max_uses },
  });
  return v;
}

export interface RedeemVoucherInput {
  user_id: string;
  code: string;
}

export async function redeemVoucher(input: RedeemVoucherInput) {
  const db = await getDB();
  const code = input.code.trim().toUpperCase();
  const v = await db.getFromIndex("vouchers", "by-code", code);
  if (!v) throw new VoucherInvalid(code);

  // Already redeemed by this user?
  const prior = await db.getFromIndex(
    "voucher_redemptions",
    "by-user-voucher",
    [input.user_id, v.id] as [string, string],
  );
  if (prior) throw new VoucherAlreadyRedeemed(code, input.user_id);

  if (v.expires_at) {
    const exp = new Date(v.expires_at).getTime();
    if (mockNow() >= exp) throw new VoucherExpired(code);
  }
  if (v.used_count >= v.max_uses) throw new VoucherExhausted(code);

  // Atomic-ish: increment used_count + write redemption row, then credit GIFT.
  // The credit() call has its own gift-cap check; if it throws, we revert
  // the voucher counter.
  const tx = db.transaction(["vouchers", "voucher_redemptions"], "readwrite");
  const txDone = tx.done.catch(() => {});
  let redemptionId: string;
  try {
    const fresh = await tx.objectStore("vouchers").get(v.id);
    if (!fresh) throw new VoucherInvalid(code);
    if (fresh.used_count >= fresh.max_uses) throw new VoucherExhausted(code);
    fresh.used_count += 1;
    await tx.objectStore("vouchers").put(fresh);

    redemptionId = newRedemptionId();
    await tx.objectStore("voucher_redemptions").put({
      id: redemptionId,
      voucher_id: v.id,
      user_id: input.user_id,
      redeemed_at: new Date(mockNow()).toISOString(),
      txn_id: "", // filled after credit
    });
    await txDone;
  } catch (e) {
    try {
      tx.abort();
    } catch {
      /* */
    }
    await txDone;
    throw e;
  }

  // Credit GIFT (gift cap enforced inside credit())
  try {
    const txn = await credit({
      user_id: input.user_id,
      amount_kobo: v.amount_kobo,
      kind: "DEPOSIT_VOUCHER",
      source_tag: "GIFT",
      ref_type: "voucher",
      ref_id: v.id,
      idempotency_key: `voucher-${v.id}-${input.user_id}`,
    });
    // Fill in the txn_id we left blank
    const r = await db.get("voucher_redemptions", redemptionId);
    if (r) {
      r.txn_id = txn.id;
      await db.put("voucher_redemptions", r);
    }
    return txn;
  } catch (e) {
    // Revert the used_count + redemption row
    const r = await db.get("voucher_redemptions", redemptionId);
    if (r) await db.delete("voucher_redemptions", redemptionId);
    const fresh = await db.get("vouchers", v.id);
    if (fresh && fresh.used_count > 0) {
      fresh.used_count -= 1;
      await db.put("vouchers", fresh);
    }
    throw e;
  }
}

// --- Withdrawals ----------------------------------------------------------

export interface ListWithdrawalsInput {
  status?: WithdrawalRequest["status"];
  limit?: number;
  offset?: number;
}

export async function listWithdrawals(
  input: ListWithdrawalsInput,
): Promise<WithdrawalRequest[]> {
  const db = await getDB();
  let all = await db.getAll("withdrawal_requests");
  if (input.status) all = all.filter((w) => w.status === input.status);
  all.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const offset = input.offset ?? 0;
  const limit = input.limit ?? all.length;
  return all.slice(offset, offset + limit);
}

export interface ApproveWithdrawalInput {
  id: string;
  admin_user_id: string;
}

export async function approveWithdrawal(
  input: ApproveWithdrawalInput,
): Promise<WithdrawalRequest> {
  const db = await getDB();
  const wd = await db.get("withdrawal_requests", input.id);
  if (!wd) throw new WithdrawalNotFound(input.id);
  if (wd.status !== "REQUESTED" && wd.status !== "APPROVED") {
    throw new WithdrawalAlreadyHandled(input.id, wd.status);
  }
  // Mock: skip Paystack — go straight to SENT.
  wd.status = "SENT";
  wd.approved_by_admin_id = input.admin_user_id;
  await db.put("withdrawal_requests", wd);
  await writeAudit({
    admin_user_id: input.admin_user_id,
    action_kind: "WITHDRAWAL_APPROVE",
    target_type: "withdrawal",
    target_id: input.id,
    payload: { amount_kobo: wd.amount_kobo, rail: wd.rail },
  });
  return wd;
}

export interface RejectWithdrawalInput {
  id: string;
  admin_user_id: string;
  reason: string;
}

export async function rejectWithdrawal(
  input: RejectWithdrawalInput,
): Promise<WithdrawalRequest> {
  const db = await getDB();
  const wd = await db.get("withdrawal_requests", input.id);
  if (!wd) throw new WithdrawalNotFound(input.id);
  if (wd.status !== "REQUESTED") {
    throw new WithdrawalAlreadyHandled(input.id, wd.status);
  }
  // Reverse the WITHDRAW_HOLD by re-crediting the user (PURCHASED — they get
  // their money back into a cashable bucket regardless of original mix).
  await credit({
    user_id: wd.user_id,
    amount_kobo: wd.amount_kobo,
    kind: "WITHDRAW_REVERSAL",
    source_tag: "PURCHASED",
    ref_type: "withdrawal",
    ref_id: wd.id,
    idempotency_key: `wd-reverse-${wd.id}`,
  });
  wd.status = "CANCELLED";
  await db.put("withdrawal_requests", wd);
  await writeAudit({
    admin_user_id: input.admin_user_id,
    action_kind: "WITHDRAWAL_REJECT",
    target_type: "withdrawal",
    target_id: input.id,
    payload: { reason: input.reason, amount_kobo: wd.amount_kobo },
  });
  return wd;
}

// --- Wallet freeze --------------------------------------------------------

export interface FreezeWalletInput {
  user_id: string;
  admin_user_id: string;
  reason: string;
}

export async function freezeWallet(input: FreezeWalletInput): Promise<void> {
  const db = await getDB();
  const wallets = await db.getAllFromIndex("wallets", "by-user", input.user_id);
  if (wallets.length === 0) throw new Error(`Wallet for ${input.user_id} not found`);
  const w = wallets[0];
  w.status = "FROZEN";
  await db.put("wallets", w);
  await writeAudit({
    admin_user_id: input.admin_user_id,
    action_kind: "WALLET_FREEZE",
    target_type: "wallet",
    target_id: w.id,
    payload: { user_id: input.user_id, reason: input.reason },
  });
}

export interface UnfreezeWalletInput {
  user_id: string;
  admin_user_id: string;
}

export async function unfreezeWallet(input: UnfreezeWalletInput): Promise<void> {
  const db = await getDB();
  const wallets = await db.getAllFromIndex("wallets", "by-user", input.user_id);
  if (wallets.length === 0) throw new Error(`Wallet for ${input.user_id} not found`);
  const w = wallets[0];
  w.status = "ACTIVE";
  await db.put("wallets", w);
  await writeAudit({
    admin_user_id: input.admin_user_id,
    action_kind: "WALLET_UNFREEZE",
    target_type: "wallet",
    target_id: w.id,
    payload: { user_id: input.user_id },
  });
}

// --- Global txns (admin) --------------------------------------------------

export interface ListAllTxnsInput {
  user_id?: string;
  kind?: string;
  source_tag?: string;
  since?: string;
  until?: string;
  min_kobo?: number;
  max_kobo?: number;
  limit?: number;
  offset?: number;
}

export interface AllTxnsRow {
  id: string;
  user_id: string;
  username: string;
  amount_kobo: number;
  kind: string;
  source_tag: string;
  ref_type: string;
  ref_id: string;
  created_at: string;
}

export async function listAllTxns(
  input: ListAllTxnsInput,
): Promise<AllTxnsRow[]> {
  const db = await getDB();
  const wallets = await db.getAll("wallets");
  const users = await db.getAll("users");
  const userById = new Map(users.map((u) => [u.id, u]));
  let rows: AllTxnsRow[] = [];
  for (const w of wallets) {
    const txns = await db.getAllFromIndex("wallet_txns", "by-wallet", w.id);
    const u = userById.get(w.user_id);
    for (const t of txns) {
      rows.push({
        id: t.id,
        user_id: w.user_id,
        username: u?.username ?? w.user_id,
        amount_kobo: t.amount_kobo,
        kind: t.kind,
        source_tag: t.source_tag,
        ref_type: t.ref_type,
        ref_id: t.ref_id,
        created_at: t.created_at,
      });
    }
  }
  if (input.user_id) rows = rows.filter((r) => r.user_id === input.user_id);
  if (input.kind) rows = rows.filter((r) => r.kind === input.kind);
  if (input.source_tag) rows = rows.filter((r) => r.source_tag === input.source_tag);
  if (input.since) {
    const since_ms = new Date(input.since).getTime();
    rows = rows.filter((r) => new Date(r.created_at).getTime() >= since_ms);
  }
  if (input.until) {
    const until_ms = new Date(input.until).getTime();
    rows = rows.filter((r) => new Date(r.created_at).getTime() <= until_ms);
  }
  if (input.min_kobo != null) {
    rows = rows.filter((r) => Math.abs(r.amount_kobo) >= input.min_kobo!);
  }
  if (input.max_kobo != null) {
    rows = rows.filter((r) => Math.abs(r.amount_kobo) <= input.max_kobo!);
  }
  rows.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const offset = input.offset ?? 0;
  const limit = input.limit ?? rows.length;
  return rows.slice(offset, offset + limit);
}

// --- Audit log ------------------------------------------------------------

export interface ListAuditLogInput {
  admin?: string;
  kind?: string;
  limit?: number;
  offset?: number;
}

export async function listAuditLog(input: ListAuditLogInput) {
  const db = await getDB();
  let entries = input.admin
    ? await db.getAllFromIndex("audit_log", "by-admin", input.admin)
    : await db.getAll("audit_log");
  if (input.kind) entries = entries.filter((e) => e.action_kind === input.kind);
  entries.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const offset = input.offset ?? 0;
  const limit = input.limit ?? entries.length;
  return entries.slice(offset, offset + limit);
}
