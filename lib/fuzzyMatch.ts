// lib/fuzzyMatch.ts
// ─────────────────────────────────────────────────────────────────────────────
// Typo-forgiving name search (owner, 27 Nov 2026, inbox #654 and #655): typing "jook" must find "Jokie".
//
// CONSUMED BY app/(user)/awards/_kol/KolNominateAward.tsx (the creators' ballot search) and
// app/(a)/a/polls/_components/KolNominationsAdmin.tsx (the admin Creators table search). Pure functions, no
// React, so they run under the Node test runner like lib/scoreInput.test.ts.
//
// How a candidate is scored against a query (both normalised first, see normalizeForSearch):
//   100  the whole text equals the query
//    90  the text starts with the query
//    80  the query sits inside the text
//    <80 typo tolerance: the best Jaro-Winkler similarity (0..1, scaled to 0..70) over the whole text, each of its
//        words, and each word cut to the query's length, accepted at or above FUZZY_MIN (0.8). A one or two
//        character query never gets this tier, or "zz" would match half the list.
// ─────────────────────────────────────────────────────────────────────────────

/** Lower case, no accents, letters and digits only, a run of one letter collapsed to one ("jokkie" -> "jokie"). */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^\s*@/, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .replace(/(\p{L})\1+/gu, "$1");
}

// Like normalizeForSearch but keeps the spaces between words, so a text can be cut into words.
function normalizeWords(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^\s*@/, "")
    .split(/[^\p{L}\p{N}]+/u)
    .map(normalizeForSearch)
    .filter(Boolean);
}

/** Similarity of the two strings, 0 (nothing alike) to 1 (equal), favouring a shared beginning. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aHit: boolean[] = new Array(a.length).fill(false);
  const bHit: boolean[] = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j <= Math.min(b.length - 1, i + range); j++) {
      if (!bHit[j] && a[i] === b[j]) {
        aHit[i] = true;
        bHit[j] = true;
        matches++;
        break;
      }
    }
  }
  if (matches === 0) return 0;
  let swaps = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aHit[i]) continue;
    while (!bHit[k]) k++;
    if (a[i] !== b[k]) swaps++;
    k++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - swaps / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Lowest Jaro-Winkler similarity that counts as "the nearest name". Tuned on the examples in the tests. */
export const FUZZY_MIN = 0.8;
// Queries this short only use the starts-with and contains rules.
const FUZZY_MIN_LENGTH = 3;

/** 0 = no match, higher = closer. `candidateTexts` are the searchable fields of one item (name, handle ...). */
export function fuzzyScore(query: string, candidateTexts: string[]): number {
  const q = normalizeForSearch(query);
  if (!q) return 0;
  let best = 0;
  for (const raw of candidateTexts) {
    if (!raw) continue;
    const text = normalizeForSearch(raw);
    if (!text) continue;
    if (text === q) return 100;
    if (text.startsWith(q)) best = Math.max(best, 90);
    else if (text.includes(q)) best = Math.max(best, 80);
    if (best >= 80 || q.length < FUZZY_MIN_LENGTH) continue;
    // Typo tier: the whole text, each word, and each of those cut to the query's length (a prefix).
    const parts = [text, ...normalizeWords(raw)];
    for (const part of [...parts]) if (part.length > q.length) parts.push(part.slice(0, q.length));
    for (const part of parts) {
      const sim = jaroWinkler(q, part);
      if (sim >= FUZZY_MIN) best = Math.max(best, sim * 70);
    }
  }
  return best;
}

/** The items that match, closest first, ties in their original order. An empty query returns the list as it is. */
export function fuzzyFilter<T>(items: T[], query: string, getTexts: (item: T) => string[]): T[] {
  if (!normalizeForSearch(query)) return items;
  return items
    .map((item, index) => ({ item, index, score: fuzzyScore(query, getTexts(item)) }))
    .filter((r) => r.score > 0)
    .sort((x, y) => y.score - x.score || x.index - y.index)
    .map((r) => r.item);
}
