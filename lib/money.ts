/**
 * lib/money.ts
 * ────────────
 * Multi-currency money helpers (owner 2026-06-30): the platform stores money in USD (and some
 * legacy/NGN amounts), and shows each user their own currency. These pure functions do the
 * conversion + locale-aware formatting; the rates come from the backend /auth/fx-rates/ endpoint
 * (base USD, units per USD) via CurrencyContext.
 *
 * convertMoney(amount, from, to, rates): amount in `from` currency -> `to` currency, via USD.
 * formatMoney(amount, currency): Intl.NumberFormat with the right symbol + decimals.
 * displayMoney(amount, from, toCurrency, rates): convert + format in one call (what <Money/> uses).
 *
 * Rates shape: Record<currencyCode, number> where the value = units of that currency per 1 USD
 * (so USD === 1). Unknown/zero rate -> no conversion (never fabricate a rate that could mislead).
 */

export type FxRates = Record<string, number>;

/** Convert an amount from one currency to another, via USD. Unknown rates pass the amount through. */
export function convertMoney(
  amount: number,
  from: string,
  to: string,
  rates: FxRates,
): number {
  const a = Number(amount) || 0;
  const f = (from || "USD").toUpperCase();
  const t = (to || "USD").toUpperCase();
  if (f === t) return a;
  // amount(f) -> USD
  const fromRate = f === "USD" ? 1 : rates[f];
  const usd = fromRate && fromRate !== 0 ? a / fromRate : a;
  // USD -> to
  const toRate = t === "USD" ? 1 : rates[t];
  return toRate ? usd * toRate : usd;
}

/** Currencies with no minor units (whole-number display). */
const ZERO_DECIMAL = new Set(["JPY", "XOF", "XAF", "KRW", "VND", "CLP", "RWF", "UGX", "GNF", "BIF"]);

/** Format an amount already IN `currency` with the correct symbol + decimals (locale-aware). */
export function formatMoney(amount: number, currency: string): string {
  const cur = (currency || "USD").toUpperCase();
  const fractionDigits = ZERO_DECIMAL.has(cur) ? 0 : 2;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
      // narrowSymbol -> "₦29.99" / "$3.63" instead of the ISO code "NGN 29.99" (the browser locale
      // is often en-US, which would otherwise print the code). Falls back to the code if no symbol.
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(Number(amount) || 0);
  } catch {
    // Unknown/invalid ISO code -> fall back to "<CODE> 1,234.56".
    return `${cur} ${(Number(amount) || 0).toLocaleString(undefined, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })}`;
  }
}

/** Convert `amount` (in `from` currency) to `toCurrency` and format it. The one call <Money/> needs. */
export function displayMoney(
  amount: number,
  from: string,
  toCurrency: string,
  rates: FxRates,
): string {
  return formatMoney(convertMoney(amount, from, toCurrency, rates), toCurrency);
}
