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
 * The subset usable for PER-COUNTRY registration-fee OVERRIDES (CountryPaymentRulesEditor).
 *
 * This is narrower than AFC_CURRENCIES on purpose, and it is NOT a second hardcoded list: it is a
 * filter over the canonical one. The backend validator `_ALLOWED_CCY` in
 * backend/afc_tournament_and_scrims/views.py (_parse_country_payment_rules, ~line 929) still rejects
 * anything outside these seven codes with a 400, because a per-country override feeds a real Stripe
 * charge and only these are wired through the checkout path. Offering the full menu here would let an
 * admin pick XOF and then get an unexplained save failure.
 *
 * TO LIFT THIS: widen `_ALLOWED_CCY` in that backend file to import CURRENCY_CODES from
 * afc_auth.currencies, then delete this constant and use AFC_CURRENCIES directly. The event app is
 * owned by another workstream right now, which is why it was left alone.
 *
 * The base `registration_fee_currency` field has no such restriction (the backend only uppercases and
 * truncates it), so Step1EventDetails and BasicInfoTab use the FULL list.
 */
const COUNTRY_PAYMENT_RULE_CODES = ["USD", "NGN", "GHS", "KES", "ZAR", "GBP", "EUR"];

export const COUNTRY_PAYMENT_RULE_CURRENCIES: CurrencyOption[] = AFC_CURRENCIES.filter((c) =>
  COUNTRY_PAYMENT_RULE_CODES.includes(c.code),
);
