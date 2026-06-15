/**
 * i18n/config.ts — shared locale constants for the AFC app.
 *
 * Purpose: single source of truth for which languages the site supports and
 * which one is the fallback. Everything else in the i18n stack imports from
 * here so there is exactly one place to add a language.
 *
 * How it connects to the rest of the system:
 *  - i18n/request.ts          → uses LOCALES to validate the NEXT_LOCALE cookie
 *                                and DEFAULT_LOCALE as the fallback, and loads
 *                                the matching messages/<locale>/*.json bundles.
 *  - components/I18nProvider  → wraps the app with NextIntlClientProvider so
 *                                Client Components can call useTranslations().
 *  - scripts/i18n-translate.mjs → iterates LOCALES (minus DEFAULT_LOCALE) to
 *                                 machine-translate the English source JSON.
 *
 * NOTE: locale routing is cookie-based (NEXT_LOCALE), NOT URL-prefixed. There
 * are no [locale] route segments. The active locale comes from the cookie set
 * by the language switcher, falling back to English.
 */

// Every language the UI can render. `en` MUST stay first / present because it
// is the canonical source the other bundles are deep-merged on top of.
export const LOCALES = ["en", "fr", "pt"] as const;

// The fallback locale: used when the NEXT_LOCALE cookie is missing or holds a
// value we do not support. English is also the base every other locale merges
// over, so any key missing in fr/pt resolves to the English string.
export const DEFAULT_LOCALE: Locale = "en";

// Union type of the supported locales ("en" | "fr" | "pt"), derived from the
// LOCALES tuple so the type and the runtime list can never drift apart.
export type Locale = (typeof LOCALES)[number];

/**
 * Narrowing helper: returns true when `value` is one of LOCALES. Used by
 * i18n/request.ts to decide whether the cookie value is trustworthy before
 * loading message bundles for it.
 */
export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
