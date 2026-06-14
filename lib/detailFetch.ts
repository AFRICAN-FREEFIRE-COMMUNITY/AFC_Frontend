// lib/detailFetch.ts
//
// Server-side, existence-aware fetch for the public DYNAMIC DETAIL pages:
//   app/(user)/tournaments/[slug]      app/(user)/news/[slug]
//   app/(user)/teams/[id]              app/(user)/organizations/[slug]
//   app/(user)/shop/[id]              app/(user)/players/[username]
//
// WHY THIS EXISTS (SEO soft-404 fix, audit 2026-06-14)
// ---------------------------------------------------------------------------
// The detail pages used to collapse EVERY fetch failure into `null` and then
// render a 200 "fallback" page. For a genuinely DELETED entity that is a
// "soft 404": Google sees HTTP 200 + generic content and flags the URL (e.g.
// /tournaments/test and /tournaments/test-scrims-3 in Search Console). The
// OPPOSITE bug also existed: news/[slug] called notFound() on ANY null, so a
// momentary API blip could wrongly 404 and deindex a real, live article.
//
// This helper splits the two outcomes so callers can do the correct thing:
//   - "missing" → backend returned HTTP 404 → the entity is really gone
//                 → caller calls notFound() → a REAL 404 (correct for SEO).
//   - "error"   → network / timeout / 5xx / malformed-or-empty 200 → TRANSIENT
//                 → caller KEEPS the 200 fallback → a real page is never
//                   deindexed because of a momentary backend hiccup.
//   - "ok"      → the entity loaded; `data` is the extracted payload.
//
// Every AFC detail endpoint returns HTTP 404 for a missing slug/id (verified
// 2026-06-14 across the events / news / team / org / shop / player views), so
// `response.status === 404` is the single reliable "entity is gone" signal.
// Anything else stays a fallback — we ONLY ever 404 on a definitive 404.
//
// CONNECTS TO (callers — each wraps fetchDetail and, in BOTH its generateMetadata
// and its server render body, calls notFound() when the result is "missing"):
//   - app/(user)/tournaments/[slug]/page.tsx        → getEventData
//   - app/(user)/news/[slug]/page.tsx               → getNewsData
//   - app/(user)/shop/[id]/page.tsx                 → getProductData
//   - app/(user)/players/[username]/page.tsx        → getPlayerData
//   - app/(user)/teams/[id]/layout.tsx              → getTeamData
//   - app/(user)/organizations/[slug]/layout.tsx    → getOrgData

// Discriminated result so the caller can tell "gone" from "blip" at the type level.
export type DetailResult<T> =
  | { status: "ok"; data: T } // entity loaded
  | { status: "missing" } //     backend HTTP 404 → entity confirmed gone → notFound()
  | { status: "error" }; //      transient (network / 5xx / empty) → keep 200 fallback

/**
 * Run a server fetch for a single detail entity and classify the outcome.
 *
 * @param url     Absolute backend URL (the same endpoint the page/layout reads).
 * @param init    fetch RequestInit (method, headers, body, caching).
 * @param extract Pulls the entity out of the parsed JSON, e.g.
 *                `(j) => j?.event_details ?? j?.team`. A null/undefined
 *                extraction on an otherwise-OK 200 is treated as a TRANSIENT
 *                "error" (NOT "missing"), so we never 404 a real page on an
 *                unexpected-shape response — only a definitive backend 404 does.
 */
export async function fetchDetail<T>(
  url: string,
  init: RequestInit,
  extract: (json: any) => T | null | undefined,
): Promise<DetailResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { status: "error" }; // network / DNS / timeout → keep fallback
  }

  if (res.status === 404) return { status: "missing" }; // the ONLY "gone" signal
  if (!res.ok) return { status: "error" }; //              5xx / other → transient

  let json: any;
  try {
    json = await res.json();
  } catch {
    return { status: "error" }; // malformed body → do not risk a wrongful 404
  }

  const data = extract(json);
  if (data == null) return { status: "error" }; // unexpected empty 200 → fallback
  return { status: "ok", data };
}
