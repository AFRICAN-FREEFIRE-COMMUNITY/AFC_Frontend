import { openDB, type IDBPDatabase, type DBSchema } from "idb";
import type {
  User,
  Wager,
  WagerLine,
  Market,
  MarketOption,
  Settlement,
  Voucher,
  WithdrawalRequest,
  FxSnapshot,
  KYCStatus,
  WalletTxn,
} from "./types";

interface AfcWagerDB extends DBSchema {
  users: { key: string; value: User; indexes: { "by-username": string } };
  wallets: {
    key: string;
    value: {
      id: string;
      user_id: string;
      balance_kobo: number;
      locked_kobo: number;
      balance_purchased_kobo: number;
      balance_won_kobo: number;
      balance_gift_kobo: number;
      status: "ACTIVE" | "FROZEN";
    };
    indexes: { "by-user": string };
  };
  wallet_txns: {
    key: string;
    value: WalletTxn;
    indexes: {
      "by-wallet": string;
      "by-kind": string;
      "by-created": string;
      "by-idempotency": string;
    };
  };
  events: {
    key: string;
    value: {
      id: string;
      slug: string;
      name: string;
      status: "upcoming" | "ongoing" | "completed";
      start_at: string;
    };
  };
  markets: {
    key: string;
    value: Market;
    indexes: { "by-event": string; "by-status": string; "by-lock-at": string };
  };
  market_options: {
    key: string;
    value: MarketOption;
    indexes: { "by-market": string };
  };
  wagers: {
    key: string;
    value: Wager;
    indexes: { "by-user": string; "by-market": string; "by-user-market": [string, string] };
  };
  wager_lines: {
    key: string;
    value: WagerLine;
    indexes: { "by-wager": string; "by-option": string };
  };
  settlements: {
    key: string;
    value: Settlement;
    indexes: { "by-market": string };
  };
  vouchers: {
    key: string;
    value: Voucher;
    indexes: { "by-code": string };
  };
  voucher_redemptions: {
    key: string;
    value: { id: string; voucher_id: string; user_id: string; redeemed_at: string; txn_id: string };
    indexes: { "by-user-voucher": [string, string] };
  };
  withdrawal_requests: {
    key: string;
    value: WithdrawalRequest;
    indexes: { "by-user": string; "by-status": string };
  };
  fx_snapshots: {
    key: string;
    value: FxSnapshot;
  };
  kyc_tiers: {
    key: string;
    value: KYCStatus & { id: string; user_id: string };
    indexes: { "by-user": string };
  };
  audit_log: {
    key: string;
    value: {
      id: string;
      admin_user_id: string;
      action_kind: string;
      target_type: string;
      target_id: string;
      payload: Record<string, unknown>;
      created_at: string;
    };
    indexes: { "by-admin": string; "by-created": string };
  };
}

let dbPromise: Promise<IDBPDatabase<AfcWagerDB>> | null = null;

export async function openMockDB(): Promise<IDBPDatabase<AfcWagerDB>> {
  if (dbPromise) return dbPromise;
  dbPromise = openDB<AfcWagerDB>("afc-wager-mock", 1, {
    upgrade(db) {
      const users = db.createObjectStore("users", { keyPath: "id" });
      users.createIndex("by-username", "username", { unique: true });

      const wallets = db.createObjectStore("wallets", { keyPath: "id" });
      wallets.createIndex("by-user", "user_id", { unique: true });

      const txns = db.createObjectStore("wallet_txns", { keyPath: "id" });
      txns.createIndex("by-wallet", "wallet_id");
      txns.createIndex("by-kind", "kind");
      txns.createIndex("by-created", "created_at");
      txns.createIndex("by-idempotency", "idempotency_key", { unique: true });

      db.createObjectStore("events", { keyPath: "id" });

      const markets = db.createObjectStore("markets", { keyPath: "id" });
      markets.createIndex("by-event", "event_id");
      markets.createIndex("by-status", "status");
      markets.createIndex("by-lock-at", "lock_at");

      const opts = db.createObjectStore("market_options", { keyPath: "id" });
      opts.createIndex("by-market", "market_id");

      const wagers = db.createObjectStore("wagers", { keyPath: "id" });
      wagers.createIndex("by-user", "user_id");
      wagers.createIndex("by-market", "market_id");
      wagers.createIndex("by-user-market", ["user_id", "market_id"], { unique: true });

      const lines = db.createObjectStore("wager_lines", { keyPath: "id" });
      lines.createIndex("by-wager", "wager_id");
      lines.createIndex("by-option", "option_id");

      const settlements = db.createObjectStore("settlements", { keyPath: "id" });
      settlements.createIndex("by-market", "market_id", { unique: true });

      const vouchers = db.createObjectStore("vouchers", { keyPath: "id" });
      vouchers.createIndex("by-code", "code", { unique: true });

      const vr = db.createObjectStore("voucher_redemptions", { keyPath: "id" });
      vr.createIndex("by-user-voucher", ["user_id", "voucher_id"], { unique: true });

      const wreq = db.createObjectStore("withdrawal_requests", { keyPath: "id" });
      wreq.createIndex("by-user", "user_id");
      wreq.createIndex("by-status", "status");

      db.createObjectStore("fx_snapshots", { keyPath: "id" });

      const kyc = db.createObjectStore("kyc_tiers", { keyPath: "id" });
      kyc.createIndex("by-user", "user_id", { unique: true });

      const audit = db.createObjectStore("audit_log", { keyPath: "id" });
      audit.createIndex("by-admin", "admin_user_id");
      audit.createIndex("by-created", "created_at");
    },
  });
  return dbPromise;
}

export const getDB = openMockDB;

export async function resetDB(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
  }
  dbPromise = null;
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase("afc-wager-mock");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export type { AfcWagerDB };
