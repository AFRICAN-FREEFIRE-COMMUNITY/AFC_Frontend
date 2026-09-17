/**
 * lib/i18n/number.ts - the one place a plain number becomes text for a reader.
 *
 * Owner rule R31 (2026-09-13, "one timing model"): `total.toLocaleString()` picks its thousands
 * separator and decimal mark from the DEVICE, not from the language the reader chose on the site, so
 * a reader on French AFC with an English phone gets "1,234.5" where the rest of the page says
 * "1 234,5". Same class of fault as a date rendered in the device language; same fix: one door,
 * the active UI locale (lib/i18n/time.ts getActiveLocale, the NEXT_LOCALE cookie).
 *
 * Money is NOT this file: lib/money.ts formatMoney knows currencies and their decimals. This is for
 * counts, kills, votes, thresholds, percentages, anything without a currency.
 *
 * Usage:
 *   formatNumber(12345)                         "12,345" / "12 345" in French
 *   formatNumber(0.5, { style: "percent" })     "50%"
 *   formatNumber(1234.567, { maximumFractionDigits: 2 })
 *
 * Client and server safe: on the server (no cookie) it formats in "en", which matches the
 * pre-mount placeholder convention of <LocalTime/>. scripts/check-datetime.mjs treats this file as
 * the model (MODEL_FILES) and grades every other locale-less number as a note.
 */
import { getActiveLocale } from "@/lib/i18n/time";

export function formatNumber(
  value: number | string | null | undefined,
  options?: Intl.NumberFormatOptions,
  locale?: string,
): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  try {
    return new Intl.NumberFormat(locale ?? getActiveLocale(), options).format(n);
  } catch {
    // an unknown locale string or an impossible option set: never blank a number over formatting
    return String(n);
  }
}
