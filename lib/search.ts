// lib/search.ts — shared client-side fuzzy-ish text matching for every "Search ..." box on the site.
//
// WHY THIS EXISTS
// Every list page used to filter with `field.toLowerCase().includes(query.toLowerCase())`. That is
// punctuation- and accent-sensitive, so a team literally named "V-E" never showed up for the query
// "ve" ("v-e".includes("ve") === false). Owners reported exactly this. This helper makes search
// punctuation-insensitive, accent-insensitive, and word-order-independent across the whole app.
//
// HOW IT CONNECTS
// - Frontend callers: the teams list (app/(user)/teams/page.tsx), rankings, tournaments, player
//   markets, glossary, shop, news, rules, and the admin/organizer/sponsor/vendor list pages all import
//   `matchesSearch` and use it inside their `.filter(...)` instead of raw `.includes`.
// - Backend twin: the server-side typeaheads (GET /team/search-teams/, GET /auth/search-users/) apply
//   the SAME normalization in backend/afc/search_utils.py, so a search behaves identically whether it
//   runs in the browser (full list already loaded) or on the server (typeahead, list not loaded).
//
// MATCHING CONTRACT (intentionally a strict SUPERSET of the old `.includes`, so nothing that matched
// before stops matching, this change only ever widens results, never narrows them):
//   1. Both sides are normalized: lower-cased, accents stripped ("Andre" stays "andre", "Andre`"
//      collapses too), and every non-alphanumeric character removed ("V-E" becomes "ve",
//      "Team_Alpha!" becomes "teamalpha").
//   2. A normalized substring match wins first: query "ve" matches "venigeria" (from "V-E Nigeria").
//   3. Multi-word queries are order-independent: "nigeria ve" matches "V-E Nigeria" because every
//      whitespace-separated token is found in the normalized haystack.

// CONFUSABLES: stylized letterforms that Unicode NFKD does NOT fold to plain ASCII, mapped to their
// plain-letter equivalent. Free Fire / esports in-game names lean heavily on these "fancy font"
// generators, so folding them is what lets a normal-keyboard query find a stylized name.
//
// NFKD already handles the BIG families on its own (mathematical bold/italic/script/double-struck/
// monospace/sans, fullwidth, circled, squared, fraktur) — those are NOT listed here. This map only
// covers what NFKD leaves behind:
//   - Latin small-caps / phonetic letters (ᴀ-ᴢ): the most common lowercase stylization in IGNs.
//   - Cyrillic and Greek look-alikes (а е о ρ ν ...): visually identical to Latin letters.
// Regional-indicator "flag" letters (🇦-🇿) are handled by code-point range in foldConfusables below.
const CONFUSABLES: Record<string, string> = {
  // Latin small-caps + phonetic capitals used as stylized letters
  ᴀ: "a", ʙ: "b", ᴄ: "c", ᴅ: "d", ᴇ: "e", ꜰ: "f", ɢ: "g", ʜ: "h", ɪ: "i", ᴊ: "j",
  ᴋ: "k", ʟ: "l", ᴍ: "m", ɴ: "n", ᴏ: "o", ᴘ: "p", ʀ: "r", ꜱ: "s", ᴛ: "t", ᴜ: "u",
  ᴠ: "v", ᴡ: "w", ʏ: "y", ᴢ: "z",
  // Cyrillic look-alikes (keyed by lowercase; foldConfusables lowercases before lookup)
  а: "a", в: "b", е: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t",
  у: "y", х: "x", і: "i", ј: "j", ѕ: "s", ѵ: "v",
  // Greek look-alikes
  α: "a", β: "b", ε: "e", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x",
  // Cherokee + Georgian look-alikes used as Latin capitals by "Cherokee/aesthetic" text generators.
  // Data-driven: real AFC team names spell words in Cherokee letters (e.g. "SUPREME" = Ꮪ Ⴎ Ꮲ Ꭱ Ꭼ Ꮇ).
  // Normal names never contain these code points, so a slightly-off mapping can never cause a false
  // match on an ordinary name; it only ever helps a stylized name become searchable.
  Ꭺ: "a", Ᏼ: "b", Ꮯ: "c", Ꭼ: "e", Ꮐ: "g", Ꮋ: "h", Ꭻ: "j", Ꮶ: "k", Ꮮ: "l", Ꮇ: "m",
  Ꭱ: "r", Ꮪ: "s", Ꭲ: "t", Ꮙ: "v", Ꮃ: "w", Ꮲ: "p", Ꮓ: "z", Ꭹ: "y", Ⴎ: "u",
};

// foldConfusables: map the exotic letterforms above to plain letters BEFORE NFKD runs. Iterates by
// code point (for...of) so astral-plane characters (the flag letters) are handled whole.
function foldConfusables(input: string): string {
  let out = "";
  for (const ch of input) {
    const cp = ch.codePointAt(0) ?? 0;
    // Regional-indicator symbols 🇦..🇿 (U+1F1E6..U+1F1FF) -> a..z
    if (cp >= 0x1f1e6 && cp <= 0x1f1ff) {
      out += String.fromCharCode(97 + (cp - 0x1f1e6));
      continue;
    }
    out += CONFUSABLES[ch] ?? CONFUSABLES[ch.toLowerCase()] ?? ch;
  }
  return out;
}

/**
 * Collapse a string to its searchable core: fancy-font-folded, accent-free, lower-case, alphanumerics
 * only. This is what makes search work on stylized in-game names.
 *
 *   normalizeSearch("V-E Nigeria!") === "venigeria"
 *   normalizeSearch("𝕍-𝔼")          === "ve"   (NFKD folds double-struck)
 *   normalizeSearch("ᴠᴇ")           === "ve"   (CONFUSABLES folds small-caps)
 *   normalizeSearch("Andre Perez")  === "andreperez"
 *
 * Null/undefined are treated as empty so callers can pass optional fields directly.
 */
export function normalizeSearch(value: string | null | undefined): string {
  return foldConfusables(value ?? "") // fold stylized letters NFKD can't ("ᴠᴇ"/"Ѵе"/"🇻🇪" -> "ve")
    .normalize("NFKD") // fold the math/fullwidth/circled/... families + split accents off base letters
    .replace(/\p{Diacritic}/gu, "") // drop the combining diacritics ("e" + accent becomes "e")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ""); // strip spaces, hyphens, punctuation: the core fix
}

/**
 * Does `haystack` match the user's `query`?
 *
 * `haystack` may be a single string OR an array of fields (e.g. [team_name, team_tag, owner]); an
 * array is joined so a query can match across any of the fields. Falsy array entries are ignored.
 *
 * Returns true for an empty/whitespace/punctuation-only query (an empty search shows everything, which
 * is what every list page wants).
 */
export function matchesSearch(
  haystack: string | null | undefined | Array<string | null | undefined>,
  query: string | null | undefined,
): boolean {
  const raw = (query ?? "").trim();
  if (!raw) return true; // empty query: match all (don't hide the list)

  // Join multi-field haystacks with a space so adjacent fields don't fuse into a false match.
  const hayRaw = Array.isArray(haystack)
    ? haystack.filter(Boolean).join(" ")
    : (haystack ?? "");
  const hay = normalizeSearch(hayRaw);

  const needle = normalizeSearch(raw);
  if (!needle) return true; // query was all punctuation/whitespace: treat as empty

  // 1) Fast path: normalized substring. "ve" is inside "venigeria" so it matches.
  if (hay.includes(needle)) return true;

  // 2) Multi-word, order-independent: every token must appear somewhere in the haystack.
  //    "nigeria ve" becomes tokens ["nigeria","ve"], both found in "venigeria" so it matches.
  const tokens = raw
    .split(/\s+/)
    .map(normalizeSearch)
    .filter(Boolean);
  return tokens.length > 1 && tokens.every((t) => hay.includes(t));
}
