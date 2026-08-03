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
 * Display-only: it never changes stored values or charges - it just shows the viewer their currency.
 */

import { useCurrency } from "@/contexts/CurrencyContext";
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
  const { rates, currency } = useCurrency();
  const value = displayMoney(Number(amount) || 0, from, currency, rates);
  return <span className={className}>{value}</span>;
}
