/**
 * lib/i18n/countryName.ts - an ISO country code as a name in the viewer's language.
 *
 * The vote tracking (inbox #453) answers countries as ISO 3166-1 alpha-2 codes ("NG", "GH"), so the
 * same number reads "Nigeria" in English, "Nigéria" in French and Portuguese without a translation
 * table: the browser's Intl.DisplayNames knows every country in every locale. An empty or unknown
 * code comes back as "" so the caller can print its own "Unknown" from the message files.
 *
 * CALLERS: app/(a)/a/polls/_components/VoteTracking.tsx, VoteFlags.tsx and
 * app/(user)/awards/live/[token]/LiveView.tsx.
 */
const cache = new Map<string, Intl.DisplayNames | null>();

function displayNames(locale: string): Intl.DisplayNames | null {
  if (!cache.has(locale)) {
    try {
      cache.set(locale, new Intl.DisplayNames([locale], { type: "region" }));
    } catch {
      cache.set(locale, null);
    }
  }
  return cache.get(locale) ?? null;
}

/** "NG" -> "Nigeria" (in `locale`); "" for an empty code; the code itself if the name is unknown. */
export function countryName(code: string | null | undefined, locale: string): string {
  const value = (code || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(value)) return "";
  try {
    return displayNames(locale)?.of(value) || value;
  } catch {
    return value;
  }
}
