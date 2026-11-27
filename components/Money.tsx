"use client";

/**
 * Money.tsx - <Money/>
 * ────────────────────
 * The single money-rendering chokepoint (multi-currency, owner 2026-06-30). Converts a stored
 * amount into the viewer's display currency (from CurrencyContext) and formats it with the right
 * symbol + decimals. Replaces the scattered `₦`+toLocaleString / Intl.NumberFormat("en-NG") /
 * NairaIcon usages across the app.
 *
 * Props:
 *   amount: the stored numeric amount (string or number).
 *   from:   the currency the amount is STORED in. Default "NGN" (the shop + rankings legacy currency);
 *           pass "USD" for USD-stored amounts (e.g. event registration fees / prizepools already in USD).
 *   className: optional styling on the <span>.
 *
 * CBN source note (owner 2026-11-27, AFC inbox #649): when the amount is shown CONVERTED and a Central
 * Bank of Nigeria rate was used, the span carries a `title` naming the source and the rate date (the
 * CBN's terms allow copying only with it named). The amount itself looks exactly as before.
 *
 * Display-only: it never changes stored values or charges - it just shows the viewer their currency.
 */

import { useLocale, useTranslations } from "next-intl";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCalendarDateAnywhere } from "@/lib/i18n/time";
import { displayMoney } from "@/lib/money";

export function Money({
  amount,
  from = "NGN",
  className,
}: {
  amount: number | string | null | undefined;
  from?: string;
  className?: string;
}) {
  const { rates, currency, cbnNoteFor } = useCurrency();
  const t = useTranslations("common");
  const locale = useLocale();
  const value = displayMoney(Number(amount) || 0, from, currency, rates);
  // Only a converted amount (stored currency differs from the display one) used a rate at all.
  const converted = (from || "USD").toUpperCase() !== (currency || "USD").toUpperCase();
  const note = converted ? cbnNoteFor(from, currency) : null;
  const title = note
    ? t("fx.convertedNote", { date: formatCalendarDateAnywhere(note.date, locale) })
    : undefined;
  return (
    <span className={className} title={title}>
      {value}
    </span>
  );
}
