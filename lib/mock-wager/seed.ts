import { getDB } from "./store";
import * as data from "./seed-data";

export async function isSeeded(): Promise<boolean> {
  const db = await getDB();
  const u = await db.get("users", "house");
  return !!u;
}

export async function runSeed(): Promise<void> {
  if (await isSeeded()) return;
  const db = await getDB();
  const tx = db.transaction(
    [
      "users",
      "wallets",
      "wallet_txns",
      "events",
      "markets",
      "market_options",
      "wagers",
      "wager_lines",
      "settlements",
      "vouchers",
      "fx_snapshots",
      "kyc_tiers",
    ],
    "readwrite",
  );

  for (const u of data.SEED_USERS) await tx.objectStore("users").put(u);
  for (const w of data.SEED_WALLETS) await tx.objectStore("wallets").put(w);
  for (const txn of data.SEED_TXNS) await tx.objectStore("wallet_txns").put(txn);
  for (const e of data.SEED_EVENTS) await tx.objectStore("events").put(e);
  for (const m of data.SEED_MARKETS) await tx.objectStore("markets").put(m);
  for (const o of data.SEED_OPTIONS) await tx.objectStore("market_options").put(o);
  for (const w of data.SEED_WAGERS) await tx.objectStore("wagers").put(w);
  for (const l of data.SEED_LINES) await tx.objectStore("wager_lines").put(l);
  for (const s of data.SEED_SETTLEMENTS) await tx.objectStore("settlements").put(s);
  for (const v of data.SEED_VOUCHERS) await tx.objectStore("vouchers").put(v);
  for (const f of data.SEED_FX) await tx.objectStore("fx_snapshots").put(f);
  for (const k of data.SEED_KYC) await tx.objectStore("kyc_tiers").put(k);

  await tx.done;
}
