import { GIFT_DAILY_CAP_KOBO } from "../utils";
import { getDB } from "./store";

export { GIFT_DAILY_CAP_KOBO };

export async function sumGiftReceiptsLast24h(user_id: string, now: Date): Promise<number> {
  const db = await getDB();
  const wallets = await db.getAllFromIndex("wallets", "by-user", user_id);
  if (wallets.length === 0) return 0;
  const wallet = wallets[0];
  const txns = await db.getAllFromIndex("wallet_txns", "by-wallet", wallet.id);
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  return txns
    .filter(
      (t) =>
        t.source_tag === "GIFT" &&
        t.amount_kobo > 0 &&
        new Date(t.created_at).getTime() >= cutoff,
    )
    .reduce((a, t) => a + t.amount_kobo, 0);
}

export async function canReceiveGift(
  user_id: string,
  amount_kobo: number,
  now: Date,
): Promise<{ ok: boolean; remaining_kobo: number }> {
  const used = await sumGiftReceiptsLast24h(user_id, now);
  const remaining = GIFT_DAILY_CAP_KOBO - used;
  return { ok: amount_kobo <= remaining, remaining_kobo: remaining };
}
