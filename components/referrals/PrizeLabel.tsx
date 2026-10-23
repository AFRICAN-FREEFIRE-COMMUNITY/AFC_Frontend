"use client";

/**
 * components/referrals/PrizeLabel.tsx
 * What a referral prize IS, in the viewer's language and currency (inbox #47). The server sends the
 * parts (a shop item's title, a coupon's percent or amount, a cash amount in USD, a custom text); the
 * sentence around them comes from messages/<loc>/referrals.json and money goes through <Money/>, so a
 * Ghanaian sees cedis and a Nigerian naira for the same $10 prize.
 * Callers: components/referrals/ReferralsTab.tsx, app/(user)/r/[code], app/(a)/a/referrals/*.
 */
import { useTranslations } from "next-intl";

import { Money } from "@/components/Money";
import type { Prize } from "@/lib/referrals";

export function PrizeLabel({ prize }: { prize: Prize }) {
  const t = useTranslations("referrals");
  switch (prize.prize_type) {
    case "diamonds":
    case "shop_item":
      return <>{prize.product_variant_title ?? t("prizeLabel.shopItem")}</>;
    case "coupon":
      return prize.coupon_discount_type === "fixed" ? (
        <>{t.rich("prizeLabel.couponFixed", { amount: () => <Money amount={prize.coupon_discount_value} from="USD" /> })}</>
      ) : (
        <>{t("prizeLabel.couponPercent", { value: Number(prize.coupon_discount_value ?? 0) })}</>
      );
    case "cash":
      return <>{t.rich("prizeLabel.cash", { amount: () => <Money amount={prize.cash_amount} from="USD" /> })}</>;
    default:
      return <>{prize.custom_text}</>;
  }
}

/** When a prize is earned ("at 5 counted referrals", "top referrer #1 ..."), for lists. */
export function PrizeWhen({ prize }: { prize: Prize }) {
  const t = useTranslations("referrals");
  if (prize.kind === "milestone") return <>{t("prizeWhen.milestone", { count: prize.threshold ?? 0 })}</>;
  if (prize.kind === "rank") return <>{t("prizeWhen.rank", { rank: prize.rank ?? 0 })}</>;
  return <>{t("prizeWhen.welcome")}</>;
}
