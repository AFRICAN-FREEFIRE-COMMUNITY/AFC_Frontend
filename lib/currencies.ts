/**
 * lib/currencies.ts
 * ─────────────────
 * THE single source of truth for every currency menu on the AFC frontend (owner backlog item 28,
 * 2026-08-03: "Currency lists are incomplete: some currencies are missing when entering a prize
 * pool, and when sending notifications or announcements").
 *
 * WHY THIS FILE EXISTS
 *   The app used to carry four separate hand-maintained arrays that had drifted apart, so the menu
 *   you got depended on which screen you were standing on:
 *     - components/CurrencyPicker.tsx                              13 codes (display currency)
 *     - app/(a)/a/events/create/_components/types.ts               7 codes  (registration fee)
 *     - app/(a)/a/events/create/_components/Step5PrizePool.tsx     20 codes (prize pool)
 *     - app/(a)/a/_components/BroadcastTokenInserts.tsx            8 codes  (notifications)
 *   The broadcast one was both the shortest and the strangest: it offered BRL but not XOF or XAF, the
 *   currencies most of francophone West and Central Africa actually use. All four now import from
 *   here. Add a currency in ONE place: this file and its backend twin.
 *
 * BACKEND TWIN - KEEP IN SYNC
 *   backend/afc_auth/currencies.py holds the identical list in the identical order and is the
 *   authority for what the API will ACCEPT. afc_auth.tests.CurrencySourceOfTruthTests parses THIS
 *   file and diffs the two, so they cannot silently diverge again. Edit both together.
 *
 * FX SAFETY
 *   Money conversion runs through lib/money.ts (rates from /auth/fx-rates/, USD base, served out of
 *   the backend FxRate table). convertMoney() does not fabricate a missing rate: it passes the amount
 *   through unconverted, which shows a wrong number instead of failing loudly. Every code below was
 *   verified to have rate data on 2026-08-03, and the backend test asserts it continues to.
 *
 * CONSUMERS
 *   components/CurrencyPicker.tsx (user display currency, CurrencyContext),
 *   Step1EventDetails + BasicInfoTab + CountryPaymentRulesEditor (registration fee),
 *   Step5PrizePool + PrizeRulesTab (prize pool),
 *   BroadcastTokenInserts ({{money:...}} tokens in notifications and announcements).
 */

export interface CurrencyOption {
  /** ISO-4217 three-letter code. This is the value persisted on the backend. */
  code: string;
  /** English display name. Currency names are not user content, so they are not translated. */
  name: string;
}

/**
 * The canonical menu: every African currency AFC's community plausibly transacts in, plus USD (the
 * platform's base/storage currency) and EUR, plus the non-African majors that were already
 * selectable somewhere and so may already be persisted on real rows.
 *
 * Order is deliberate, not alphabetical: AFC's highest-volume currencies sit at the top so the
 * common pick is reachable without scrolling on a phone.
 */
export const AFC_CURRENCIES: CurrencyOption[] = [
  // ── platform base + the currencies AFC actually settles in most often ──
  { code: "USD", name: "US Dollar" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "GHS", name: "Ghanaian Cedi" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "ZAR", name: "South African Rand" },
  { code: "XOF", name: "West African CFA Franc" },
  { code: "XAF", name: "Central African CFA Franc" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "MAD", name: "Moroccan Dirham" },

  // ── rest of West Africa ──
  { code: "SLE", name: "Sierra Leonean Leone" },
  { code: "LRD", name: "Liberian Dollar" },
  { code: "GMD", name: "Gambian Dalasi" },
  { code: "GNF", name: "Guinean Franc" },
  { code: "CVE", name: "Cape Verdean Escudo" },
  { code: "MRU", name: "Mauritanian Ouguiya" },

  // ── rest of East Africa + Indian Ocean ──
  { code: "TZS", name: "Tanzanian Shilling" },
  { code: "UGX", name: "Ugandan Shilling" },
  { code: "RWF", name: "Rwandan Franc" },
  { code: "ETB", name: "Ethiopian Birr" },
  { code: "BIF", name: "Burundian Franc" },
  { code: "SOS", name: "Somali Shilling" },
  { code: "DJF", name: "Djiboutian Franc" },
  { code: "ERN", name: "Eritrean Nakfa" },
  { code: "SSP", name: "South Sudanese Pound" },
  { code: "MUR", name: "Mauritian Rupee" },
  { code: "SCR", name: "Seychellois Rupee" },
  { code: "MGA", name: "Malagasy Ariary" },
  { code: "KMF", name: "Comorian Franc" },

  // ── rest of Southern Africa ──
  { code: "ZMW", name: "Zambian Kwacha" },
  { code: "ZWG", name: "Zimbabwe Gold" },
  { code: "MZN", name: "Mozambican Metical" },
  { code: "MWK", name: "Malawian Kwacha" },
  { code: "BWP", name: "Botswana Pula" },
  { code: "NAD", name: "Namibian Dollar" },
  { code: "AOA", name: "Angolan Kwanza" },
  { code: "LSL", name: "Lesotho Loti" },
  { code: "SZL", name: "Swazi Lilangeni" },

  // ── rest of North Africa ──
  { code: "DZD", name: "Algerian Dinar" },
  { code: "TND", name: "Tunisian Dinar" },
  { code: "LYD", name: "Libyan Dinar" },
  { code: "SDG", name: "Sudanese Pound" },

  // ── rest of Central Africa ──
  { code: "CDF", name: "Congolese Franc" },
  { code: "STN", name: "Sao Tome and Principe Dobra" },

  // ── non-African majors. EUR is an owner requirement; GBP/CAD/INR/BRL were already selectable in one
  // of the four legacy pickers, so they stay: removing a code would orphan any event or broadcast
  // token already saved with it. ──
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "INR", name: "Indian Rupee" },
  { code: "BRL", name: "Brazilian Real" },
];

/** Just the ISO codes, in menu order. For pickers that render a bare code with no friendly name. */
export const AFC_CURRENCY_CODES: string[] = AFC_CURRENCIES.map((c) => c.code);

/**
 * How many decimal places each currency is written with (ISO-4217 "minor units").
 *
 * ONLY the exceptions are listed: anything not named here has 2, which covers 42 of the 48 codes.
 * Widening the menu is what made this necessary. The four legacy pickers only ever offered
 * two-decimal currencies plus a handful of zero-decimal ones, so a flat "2 decimals unless it is in
 * a short hardcoded set" rule happened to be right. It is not right for the currencies added in
 * item 28: a prize of 1500 TND rendered as "1,500.00" is wrong (TND has three decimals), and 1500
 * DJF rendered as "1,500.00" invents a subunit Djibouti does not use.
 *
 * The values below are CLDR's, verified against the runtime rather than written from memory: for
 * every one of the 48 menu codes, this table matches
 * `new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions()
 *   .maximumFractionDigits`. The table is kept explicit rather than read from Intl at call time so
 * the number of decimals in a money figure cannot change with the browser's ICU build.
 * lib/money.ts formatMoney() is the only reader.
 *
 * DISPLAY ONLY. This is not the rule for charging: Stripe's minor-unit contract has its own special
 * cases (ISK and UGX are charged as two-decimal values ending in 00), which is one of the reasons
 * real charges are restricted to CHARGEABLE_CURRENCIES below.
 */
export const CURRENCY_MINOR_UNITS: Record<string, number> = {
  // ── zero-decimal: no subunit in use ──
  XOF: 0, XAF: 0, GNF: 0, RWF: 0, UGX: 0, BIF: 0, DJF: 0, KMF: 0, MGA: 0, SOS: 0,
  // ── three-decimal ──
  TND: 3, LYD: 3,
};

/** Decimal places to render `code` with. Unknown or unlisted code -> 2, the overwhelming default. */
export function currencyFractionDigits(code: string): number {
  const cur = (code || "").trim().toUpperCase();
  return CURRENCY_MINOR_UNITS[cur] ?? 2;
}

/** The platform's base/storage currency and the fallback whenever nothing else is known. */
export const DEFAULT_CURRENCY = "USD";

/** Look up a friendly name for a code. Unknown code returns the code itself, never blank. */
export function currencyName(code: string): string {
  const cur = (code || "").toUpperCase();
  return AFC_CURRENCIES.find((c) => c.code === cur)?.name ?? cur;
}

/** True if `code` is on the menu. Mirrors is_supported_currency() in backend afc_auth/currencies.py. */
export function isSupportedCurrency(code: string): boolean {
  return AFC_CURRENCY_CODES.includes((code || "").trim().toUpperCase());
}

/**
 * The subset AFC can actually TAKE MONEY IN, for the two registration-fee fields.
 *
 * WHY THIS IS NARROWER THAN THE MENU, AND WHY THAT IS NOT A SECOND LIST
 *   It is a filter over the canonical array, not a parallel copy, so a code cannot exist here and be
 *   missing above. The distinction it encodes is real: everything on AFC_CURRENCIES is CONVERTIBLE
 *   (every code has an FxRate row, so a prize pool or an announcement can be quoted in it and
 *   re-expressed in the reader's own currency), but only these seven are CHARGEABLE, because a
 *   registration fee becomes a live Stripe Checkout session.
 *
 *   Two things break when an unchargeable code reaches that path:
 *     1. Stripe wants the amount in minor units, and the converter that does that
 *        (backend afc_tournament_and_scrims/event_payments.py `_amount_minor`) multiplies by 100
 *        unless the code is in a short zero-decimal set. A three-decimal fee (TND, LYD) would be
 *        billed at a TENTH of its value, and a zero-decimal one (DJF, KMF, GNF, RWF, BIF, ...) at a
 *        HUNDRED TIMES its value. Stripe's own contract also has per-currency special cases (ISK and
 *        UGX are charged as two-decimal values ending in 00), so this cannot be fixed by a table
 *        written from memory.
 *     2. Stripe only settles a subset of world currencies for a given account, so most of the menu
 *        would fail at session-creation time with an error the organizer cannot act on.
 *
 *   The backend agrees rather than being trusted to: `_ALLOWED_CCY` in
 *   backend/afc_tournament_and_scrims/views.py imports CHARGEABLE_CURRENCY_CODES from
 *   afc_auth/currencies.py, which holds the same seven codes. So the menu an admin sees and the set
 *   the API accepts are the same set, in one place.
 *
 * TO WIDEN IT: confirm the currency is enabled on the AFC Stripe account, confirm `_amount_minor`
 * computes its minor units correctly (check Stripe's zero-decimal and special-case lists, do not
 * assume 2), then add it to CHARGEABLE_CURRENCY_CODES here and in the backend twin.
 *
 * Consumers: Step1EventDetails + BasicInfoTab (base registration_fee_currency) and
 * CountryPaymentRulesEditor (per-country overrides). All three charge, so all three use this list.
 */
export const CHARGEABLE_CURRENCY_CODES = ["USD", "NGN", "GHS", "KES", "ZAR", "GBP", "EUR"];

export const CHARGEABLE_CURRENCIES: CurrencyOption[] = AFC_CURRENCIES.filter((c) =>
  CHARGEABLE_CURRENCY_CODES.includes(c.code),
);

/**
 * Back-compatible alias for the per-country override editor, which named this list after its own
 * screen before the base fee field was found to need exactly the same restriction.
 */
export const COUNTRY_PAYMENT_RULE_CURRENCIES: CurrencyOption[] = CHARGEABLE_CURRENCIES;
