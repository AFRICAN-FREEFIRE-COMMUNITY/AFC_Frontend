// lib/routes.ts
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// ADDRESSES THAT CARRY A NAME (owner 2026-09-30, inbox #90 and #91).
//
// THE BUG THIS MODULE EXISTS TO END
//   Player and team pages are addressed by the name itself (owner rule R22: names, never ids). A
//   name is typed by a person, so it can hold spaces, "#", "?", "/", "%", accents and Free Fire
//   glyphs: NG.KILLA ends in U+F8FF. Such a name has to be percent-encoded on the way INTO an
//   address and decoded on the way OUT, and the site did each half by hand, in 50-odd places:
//     - a link that skipped encodeURIComponent sent "/teams/A#1" to "/teams/A" (the "#" starts a
//       fragment), and a "/" in a name split it into two path segments;
//     - a page that skipped decodeURIComponent sent "NG.KILLA%EF%A3%BF" to the API, which answered
//       "Player not found" (the admin player page, inbox #90);
//     - a page that DID call decodeURIComponent crashed on any name holding a lone "%" (it throws
//       URIError), so a team called "100%" had no page at all.
//
// THE RULE
//   Links:  playerPath / teamPath / adminPlayerPath / adminTeamPath / adminSponsorPath / couponPath
//           / referralPath, or segment() for a one-off. Never `/teams/${name}`.
//   Reads:  readSegment(raw) on every [segment] a person typed, in pages, layouts, metadata and
//           opengraph images alike. Never a bare decodeURIComponent.
//   Which segments are typed is declared ONCE in lib/routeSegments.json. The checker
//   scripts/check-route-segments.mjs (in check-all) fails a raw link to one of those prefixes, a
//   read of one that skips readSegment, and a new dynamic folder nobody classified.
//
// The backend builds the same addresses for emails, notifications, QR codes and poll results with
// urllib.parse.quote(value, safe="") (AFC-B afc_auth/notification_links.py, afc_polls/hydration.py,
// afc_qr/targets.py, afc_player/views.py moved_to), so both halves encode the same way.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** One path segment: every character that is not safe in a path is percent-encoded, "/" included. */
export function segment(value: string | number | null | undefined): string {
  // A missing value yields "" (the list page) rather than the word "undefined" in the address.
  return encodeURIComponent(value == null ? "" : String(value));
}

/**
 * The value of a typed [segment], decoded. Accepts what Next hands over (params entry or
 * useParams, which can be string | string[] | undefined). Never throws: a lone "%" that is not an
 * escape makes decodeURIComponent throw URIError, and then the raw text IS the name.
 */
export function readSegment(raw: string | string[] | undefined | null): string {
  const value = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * One path segment for a NAME (a username or a team name): segment() without trailing whitespace.
 *
 * WHY (Search Console 2026-10-16): 169 team names and 1,179 usernames on production end in a space,
 * so their links ended in %20 and Google saw two addresses for one page ("Alternative page with
 * proper canonical", "Duplicate without user-selected canonical"). The production name columns use
 * a PAD SPACE collation (utf8mb4_unicode_ci, verified 2026-10-16): "NAME " and "NAME" are the same
 * value to the database, so dropping TRAILING spaces can never point at a different row. LEADING
 * spaces are kept on purpose: they DO tell names apart (38 usernames start with one, and
 * "GLT.ELYTRA" exists in three spacings), so trimming them could open someone else's page.
 */
export function nameSegment(value: string | number | null | undefined): string {
  return segment(value == null ? value : String(value).replace(/\s+$/u, ""));
}

/**
 * Whether a name can be a path segment at all. "." and ".." cannot: every browser and crawler
 * resolves /teams/. to /teams before the request leaves (the URL standard treats "%2E" the same),
 * so a team named "." has no reachable address (Search Console mirror, 2026-10-16: the sitemap
 * listed /teams/. and it answered 308 to /teams). Read by app/sitemap.ts.
 */
export function isAddressableName(value: string | number | null | undefined): boolean {
  const v = value == null ? "" : String(value).replace(/\s+$/u, "");
  return v !== "" && v !== "." && v !== "..";
}

/** Public player page, by in-game name. `rest` is an optional sub-path such as "/stats". */
export function playerPath(username: string | number | null | undefined, rest = ""): string {
  return `/players/${nameSegment(username)}${rest}`;
}

/** Public team page, by team name. `rest` is an optional sub-path such as "/roster" or "/edit". */
export function teamPath(teamName: string | number | null | undefined, rest = ""): string {
  return `/teams/${nameSegment(teamName)}${rest}`;
}

/** Admin player page, by in-game name. */
export function adminPlayerPath(username: string | number | null | undefined, rest = ""): string {
  return `/a/players/${nameSegment(username)}${rest}`;
}

/** Admin team page, by team name. */
export function adminTeamPath(teamName: string | number | null | undefined, rest = ""): string {
  return `/a/teams/${nameSegment(teamName)}${rest}`;
}

/** Admin sponsor page, by the sponsor account's username. */
export function adminSponsorPath(username: string | number | null | undefined, rest = ""): string {
  return `/a/sponsors/${nameSegment(username)}${rest}`;
}

/** Admin coupon page, by slug (or the legacy code / id). */
export function couponPath(ref: string | number | null | undefined, rest = ""): string {
  return `/a/shop/coupons/${segment(ref)}${rest}`;
}

/** Referral landing page, by code. */
export function referralPath(code: string | number | null | undefined): string {
  return `/r/${segment(code)}`;
}
