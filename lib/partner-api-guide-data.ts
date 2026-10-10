// ─────────────────────────────────────────────────────────────────────────────
// partner-api-guide-data.ts  -  the STRUCTURE of the public Partner Data API guide
// ----------------------------------------------------------------------------
// PURPOSE
//   Backlog item 8 asks for "a partner-facing explanation guide". This file is the
//   content source for that guide: which sections it has, in what order, and every
//   literal the guide shows a partner (URLs, header names, endpoint paths, HTTP
//   status codes, JSON samples).
//
//   Structure and literals live here. PROSE DOES NOT. Every heading, paragraph, table
//   description and caption is in the "partnerApiGuide" i18n namespace
//   (messages/{en,fr,pt}/partnerApiGuide.json), keyed off the stable ids below. Same
//   split as lib/help-center-data.ts + messages/*/helpCenter.json, for the same reason:
//   English is authored once and fr/pt sit alongside it.
//
//   Code samples are the ONE thing deliberately NOT translated. A curl line and a JSON
//   body are wire format: translating a field name would produce a sample that does not
//   work. Their surrounding captions are translated instead.
//
// HOW IT CONNECTS
//   - RENDERED BY: components/partner-api-guide/PartnerApiGuide.tsx, mounted at
//     app/(root)/partners/api/page.tsx (public, no session - a partner organisation has
//     no AFC account, exactly like app/(root)/partners/apply).
//   - DESCRIBES: the read API in backend/afc_partner_api (partner_urls.py routes,
//     views_partner.py gating, serialize.py field firewall, ratelimit.py budget,
//     auth.py X-API-Key). Every claim below was read out of that code or observed in a
//     live call against a real issued key.
//   - THE ADMIN SIDE of the same feature is app/(a)/a/partners/[slug] (issue keys, set
//     scope and toggles, publish events). That page's "Connection details" card is the
//     short version of this guide, for AFC staff; this page is the long version, for the
//     partner.
//   - LONG-FORM MARKDOWN TWIN: backend/PARTNER_API.md, the document AFC emails (the one in
//     the backend repo, which is the version-controlled one). This page and that file must
//     say the same thing; when one changes, change both.
//
// ACCURACY RULE
//   Every sample below is a real response, trimmed for length, captured from the live
//   API with a real key (secret redacted). Nothing here is illustrative-but-invented. If
//   a behaviour could not be confirmed by calling it, it is not described.
//
// ADDING TO IT
//   1. Add the section / row below with a new stable id (hyphens, never dots - next-intl
//      reads "." as nesting and rejects the whole namespace with INVALID_KEY).
//   2. Add its English copy to messages/en/partnerApiGuide.json under the same id.
//   3. Add fr and pt by hand, and record the English in the .partnerApiGuide.source.json
//      sidecar of each, or the next `pnpm i18n:translate` run will overwrite them.
//
// COPY RULES: no em dashes or en dashes in any user-facing string.
// ─────────────────────────────────────────────────────────────────────────────

/** How a block of a section is drawn. */
export type GuideBlockKind = "prose" | "code" | "table" | "note";

/** Syntax hint for a code block. Only used to label the block, not to highlight it. */
export type GuideCodeLang = "bash" | "json" | "http";

/**
 * One two-or-three column table.
 *
 * `rows[].codes` are the LITERAL leading cells (an endpoint path, a status code, a
 * field name). The LAST column is always translated prose, resolved at
 * `sections.<sectionId>.tables.<tableId>.rows.<rowId>`. That shape covers every table
 * in this guide, so the renderer needs one table component rather than four.
 */
export interface GuideTable {
  id: string;
  /** Header labels, translated at sections.<sectionId>.tables.<id>.headers.<n>. */
  headerCount: number;
  /**
   * `newSince` (YYYY-MM-DD) puts the shared self-expiring NEW badge beside the row for five
   * days (owner rule 2026-08-07): used for an endpoint or resource added to the API.
   */
  rows: { id: string; codes: string[]; newSince?: string }[];
}

export interface GuideBlock {
  kind: GuideBlockKind;
  /** For prose / note / a code block's caption: the id under the section. */
  id?: string;
  /** For code: the literal sample, shown verbatim and never translated. */
  sample?: string;
  /**
   * For code: the endpoint this sample answers, drawn as a mono line above the caption.
   *
   * It lives HERE and not inside the translated caption for a hard technical reason, not
   * a stylistic one. next-intl runs every message through the ICU parser, which reads
   * "{slug}" as a named argument and "<prefix>" as a rich-text tag. A caption reading
   * "GET events/{slug}/stages/" therefore threw MISSING_MESSAGE and rendered the raw key
   * path on the page in all three locales (caught in the browser 2026-08-06). Keeping
   * every brace and angle bracket out of the catalogue means no locale can trip that,
   * and a translator never has to reproduce ICU escaping to describe a URL.
   */
  endpoint?: string;
  lang?: GuideCodeLang;
  table?: GuideTable;
}

export interface GuideSection {
  id: string;
  blocks: GuideBlock[];
  /** YYYY-MM-DD: a section added after the guide shipped wears a NEW badge for five days. */
  newSince?: string;
}

// The day the country, points, point system and results additions went out (inbox #220 to
// #224, 2026-10-10). One constant so every badge for that release expires together.
const STRUCTURE_RELEASE = "2026-10-10";

// The production origin every sample is written against. The guide is a PUBLIC page
// describing the PRODUCTION API, so this is intentionally the literal production host
// rather than NEXT_PUBLIC_BACKEND_API_URL: a partner reading this on a preview
// deployment still needs to be told the real base URL to integrate against.
export const PARTNER_API_ORIGIN = "https://api.africanfreefirecommunity.com";
export const PARTNER_API_BASE_URL = `${PARTNER_API_ORIGIN}/api/v1/partner/`;
export const PARTNER_API_AUTH_HEADER = "X-API-Key";

/** The copy-paste first call, with the secret redacted the way a partner should treat it. */
export const PARTNER_API_QUICK_START = `curl -H "${PARTNER_API_AUTH_HEADER}: afcp_3f9a_YOUR_SECRET_HERE" \\
  "${PARTNER_API_BASE_URL}events/"`;

// ── the guide ────────────────────────────────────────────────────────────────
export const PARTNER_API_GUIDE: GuideSection[] = [
  // 1. What this is, and the hard limits on it, before any mechanics.
  {
    id: "overview",
    blocks: [
      { kind: "prose", id: "intro" },
      {
        kind: "table",
        table: {
          id: "resources",
          headerCount: 2,
          rows: [
            { id: "events", codes: ["events"] },
            { id: "stages", codes: ["stages"] },
            { id: "matches", codes: ["matches"] },
            { id: "standings", codes: ["standings"] },
            { id: "results", codes: ["results"], newSince: STRUCTURE_RELEASE },
            { id: "teams", codes: ["teams"] },
            { id: "players", codes: ["players"] },
            { id: "designs", codes: ["designs"] },
          ],
        },
      },
      { kind: "note", id: "neverReturns" },
      { kind: "prose", id: "slugs" },
    ],
  },

  // 2. Authentication. Second because nothing else can be tried without it.
  {
    id: "auth",
    blocks: [
      { kind: "prose", id: "header" },
      { kind: "code", lang: "bash", sample: PARTNER_API_QUICK_START, id: "quickStartCaption" },
      { kind: "note", id: "secrecy" },
      { kind: "prose", id: "lifecycle" },
      // Why a 401 says what it says. It sits in the auth section rather than in errors
      // because the partner reading it is holding a key that has stopped working, and the
      // distinction it draws (the message is specific to YOU, generic to a stranger) is a
      // property of the credential, not of the error model.
      { kind: "prose", id: "whyItFailed" },
    ],
  },

  // 3. The two-layer access model. Put BEFORE the endpoint reference on purpose: almost
  //    every "why is this field missing" question is answered here, not there.
  {
    id: "access",
    blocks: [
      { kind: "prose", id: "intro" },
      { kind: "prose", id: "published" },
      { kind: "prose", id: "resourceToggles" },
      { kind: "prose", id: "fieldToggles" },
      {
        kind: "table",
        table: {
          id: "fields",
          headerCount: 2,
          rows: [
            { id: "placements", codes: ["placement"] },
            { id: "kills", codes: ["kills"] },
            { id: "damage", codes: ["damage"] },
            { id: "assists", codes: ["assists"] },
            { id: "rosters", codes: ["roster"] },
            { id: "maps", codes: ["maps, map"] },
            { id: "prize", codes: ["prize_pool"] },
            { id: "mvp", codes: ["mvp"] },
            {
              id: "media",
              codes: ["banner_url, logo_url, esports_image_url, ..."],
            },
            { id: "text", codes: ["rules_text, description"] },
          ],
        },
      },
      { kind: "note", id: "alwaysSent" },
      { kind: "note", id: "absentNotNull" },
    ],
  },

  // 3b. Reading the numbers (inbox #220 to #224, 2026-10-10): countries, how points add up,
  //     an admin's hand adjustments, the point system, and whether a result is complete. Placed
  //     before the endpoint reference because every endpoint below uses these fields.
  {
    id: "numbers",
    newSince: STRUCTURE_RELEASE,
    blocks: [
      { kind: "prose", id: "intro" },
      { kind: "code", lang: "json", id: "countriesCaption", sample: `{ "country": "Nigeria", "country_code": "NG" }` },
      { kind: "prose", id: "countries" },
      { kind: "code", id: "sumCaption", sample: `points = placement_points + kill_points + other_points
       + bonus_points - penalty_points + carry_over_points` },
      {
        kind: "table",
        table: {
          id: "parts",
          headerCount: 2,
          rows: [
            { id: "placementPoints", codes: ["placement_points"] },
            { id: "killPoints", codes: ["kill_points"] },
            { id: "otherPoints", codes: ["other_points"] },
            { id: "bonusPoints", codes: ["bonus_points"] },
            { id: "penaltyPoints", codes: ["penalty_points"] },
            { id: "carryOverPoints", codes: ["carry_over_points"] },
          ],
        },
      },
      { kind: "prose", id: "adjustments" },
      { kind: "note", id: "corrections" },
      { kind: "prose", id: "whyIntro" },
      {
        kind: "table",
        table: {
          id: "why",
          headerCount: 2,
          rows: [
            { id: "adjustments", codes: ["bonus_points, penalty_points"] },
            { id: "pointRush", codes: ["point_rush, carry_over_points"] },
            { id: "championPoint", codes: ["champion_point, champion"] },
            { id: "tieBreakers", codes: ["booyahs, kills"] },
            { id: "finalStandings", codes: ["decided_in"] },
          ],
        },
      },
      // Real: the point system of DYNASTY CUP NIGERIA's maps (every map the same).
      { kind: "code", lang: "json", id: "pointSystemCaption", sample: `{
  "placement_points": { "1": 12, "2": 9, "3": 8, "4": 7, "5": 6, "6": 5, "7": 4, "8": 3, "9": 2, "10": 1 },
  "points_per_kill": 1,
  "points_per_assist": 0,
  "points_per_1000_damage": 0
}` },
      { kind: "prose", id: "pointSystem" },
      { kind: "note", id: "complete" },
    ],
  },

  // 4. The endpoint reference, with a real response under each one.
  {
    id: "endpoints",
    blocks: [
      { kind: "prose", id: "intro" },
      {
        kind: "table",
        table: {
          id: "list",
          headerCount: 3,
          rows: [
            { id: "events", codes: ["GET events/", "events"] },
            { id: "event", codes: ["GET events/{slug}/", "events"] },
            { id: "stages", codes: ["GET events/{slug}/stages/", "stages"] },
            { id: "matches", codes: ["GET events/{slug}/matches/", "matches"] },
            { id: "standings", codes: ["GET events/{slug}/standings/", "standings"] },
            { id: "results", codes: ["GET events/{slug}/results/", "standings"], newSince: STRUCTURE_RELEASE },
            { id: "teams", codes: ["GET events/{slug}/teams/", "teams"] },
            { id: "players", codes: ["GET events/{slug}/players/", "players"] },
            { id: "designs", codes: ["GET events/{slug}/designs/", "designs"] },
          ],
        },
      },

      // Real capture: GET /events/ on a key scoped to one native AFC event, with the
      // Images/files and Descriptions toggles on.
      { kind: "code", lang: "json", id: "eventsSample", endpoint: "GET events/", sample: `{
  "results": [
    {
      "slug": "dynasty-cup-nigeria",
      "name": "DYNASTY CUP NIGERIA",
      "competition_type": "tournament",
      "participant_type": "squad",
      "tier": "tier_3",
      "status": "completed",
      "start_date": "2026-06-29",
      "end_date": "2026-07-31",
      "is_native_afc": true,
      "point_system": { "placement_points": { "1": 12, "2": 9, "3": 8 }, "points_per_kill": 1,
                        "points_per_assist": 0, "points_per_1000_damage": 0 },
      "point_system_varies": false,
      "final_stage": "QUALIFIER FINALS",
      "final_stage_has_results": true,
      "banner_url": "${PARTNER_API_ORIGIN}/media/event_banner/DYNASTY_CUP_POSTER.png",
      "rules_file_url": "${PARTNER_API_ORIGIN}/media/event_rules/AFC_RULESET.pdf",
      "rules_text": null
    }
  ],
  "has_more": false,
  "next_offset": null,
  "total_count": 1
}` },

      { kind: "code", lang: "json", id: "stagesSample", endpoint: "GET events/<slug>/stages/", sample: `{
  "stage_name": "Grand Final",
  "order": 3,
  "format": "br - normal",
  "status": "completed",
  "start_date": "2026-06-28",
  "end_date": "2026-06-28",
  "champion_point": null,
  "point_rush": null,
  "groups": [
    { "group_name": "Group A", "playing_date": "2026-06-28", "maps": ["bermuda"] }
  ]
}` },

      // Real capture (trimmed): the Point Rush stage of DYNASTY CUP GRAND FINALS SSA.
      { kind: "code", lang: "json", id: "pointRushSample", endpoint: "GET events/<slug>/stages/", sample: `{
  "stage_name": "RUSH POINT",
  "order": 2,
  "point_rush": {
    "reward": { "1": 10, "2": 7, "3": 6, "4": 3, "5": 2, "6": 1 },
    "target_stage": "GRAND FINALS"
  }
}` },

      // Real capture (trimmed): DYNASTY CUP GRAND FINALS SSA, the first map of the semi finals.
      { kind: "code", lang: "json", id: "matchesSample", endpoint: "GET events/<slug>/matches/", sample: `{
  "stage_name": "SEMI FINALS",
  "stage_order": 1,
  "group_name": "Day 1: A+B",
  "match_number": 1,
  "result_inputted": true,
  "point_system": { "placement_points": { "1": 12, "2": 9, "3": 8 }, "points_per_kill": 1,
                    "points_per_assist": 0, "points_per_1000_damage": 0 },
  "map": "Bermuda",
  "mvp": null
}` },

      // Real capture: GET /events/dynasty-cup-grand-finals-ssa/standings/?limit=1
      { kind: "code", lang: "json", id: "standingsSample", endpoint: "GET events/<slug>/standings/", sample: `{
  "results": [
    {
      "rank": 1,
      "team": "NEM JOGOU",
      "country": "Mozambique",
      "country_code": "MZ",
      "logo_url": "${PARTNER_API_ORIGIN}/media/teams_logos/LOGO_DA_NJ_BB_1.jpg",
      "decided_in": "GRAND FINALS",
      "reached_final_stage": true,
      "points": 118,
      "bonus_points": 0,
      "penalty_points": 0,
      "adjusted": false,
      "carry_over_points": 0,
      "placement_points": 34,
      "kill_points": 84,
      "other_points": 0,
      "matches_played": 5,
      "placement": 1,
      "booyahs": 2,
      "kills": 84
    }
  ],
  "has_more": true,
  "next_offset": 1,
  "total_count": 17
}` },
      { kind: "prose", id: "standingsRanking" },

      { kind: "code", lang: "json", id: "teamsSample", endpoint: "GET events/<slug>/teams/", sample: `{
  "team": "ALLSTARS NG",
  "team_tag": "ASN",
  "country": "Nigeria",
  "country_code": "NG",
  "status": "played",
  "logo_url": "${PARTNER_API_ORIGIN}/media/teams_logos/asn.jpg",
  "description": "We grind every night.",
  "placement": 1,
  "kills": 44,
  "roster": [
    { "username": "ASN GABBY", "in_game_id": "3098864559", "country": "Nigeria",
      "country_code": "NG", "kills": 3 }
  ]
}` },
      { kind: "prose", id: "teamsStatusWhy" },
      {
        kind: "table",
        table: {
          id: "teamStatus",
          headerCount: 2,
          rows: [
            { id: "played", codes: ["played"] },
            { id: "registered", codes: ["registered"] },
            { id: "waitlisted", codes: ["waitlisted"] },
            { id: "pending", codes: ["pending"] },
            { id: "noShow", codes: ["no_show"] },
            { id: "withdrawn", codes: ["withdrawn"] },
            { id: "left", codes: ["left"] },
            { id: "disqualified", codes: ["disqualified"] },
          ],
        },
      },
      { kind: "note", id: "teamsStatusPrecedence" },

      // Real capture: GET /events/dynasty-cup-nigeria/players/?limit=2
      { kind: "code", lang: "json", id: "playersSample", endpoint: "GET events/<slug>/players/", sample: `{
  "username": "Ak REBORN",
  "in_game_id": "7171703030",
  "country": "Nigeria",
  "country_code": "NG",
  "esports_image_url": "${PARTNER_API_ORIGIN}/media/esports_pictures/reborn.jpg",
  "kills": 2
}` },

      // Real capture, trimmed to one row of each list: DYNASTY CUP GRAND FINALS SSA, a round robin,
      // a Point Rush stage and a grand final in one event (inbox #222).
      { kind: "code", lang: "json", id: "resultsSample", endpoint: "GET events/<slug>/results/", sample: `{
  "event": {
    "slug": "dynasty-cup-grand-finals-ssa",
    "name": "DYNASTY CUP GRAND FINALS SSA",
    "point_system": null,
    "point_system_varies": true,
    "final_stage": "GRAND FINALS",
    "final_stage_has_results": true
  },
  "final_standings": [
    { "rank": 1, "team": "NEM JOGOU", "country_code": "MZ", "decided_in": "GRAND FINALS",
      "reached_final_stage": true, "points": 118 }
  ],
  "stages": [
    {
      "order": 1,
      "stage_name": "SEMI FINALS",
      "game": "battle_royale",
      "structure": "round_robin",
      "is_final_stage": false,
      "teams_qualifying": 12,
      "champion_point": null,
      "point_rush": null,
      "standings": [
        { "rank": 1, "team": "PARADOX GAMING", "country_code": "ZA", "points": 307 }
      ],
      "round_robin_groups": [
        { "label": "A", "teams": ["Alpha Wolves", "FORSE ESP"] }
      ],
      "groups": [
        {
          "group_name": "Day 1: A+B",
          "type": "lobby",
          "game_day": 1,
          "standings": [
            { "rank": 1, "team": "UNDERGROUND", "country_code": "CV", "points": 119 }
          ],
          "matches": [
            {
              "match_number": 1,
              "map": "Bermuda",
              "results": [
                { "team": "UNDERGROUND", "country_code": "CV", "played": true, "points": 28,
                  "bonus_points": 0, "penalty_points": 0, "adjusted": false,
                  "placement_points": 12, "kill_points": 16, "placement": 1, "kills": 16 }
              ]
            }
          ]
        }
      ]
    }
  ]
}` },
      { kind: "prose", id: "resultsLevels" },
      { kind: "prose", id: "resultsLobby" },
      { kind: "prose", id: "resultsBracket" },
      {
        kind: "table",
        table: {
          id: "bracket",
          headerCount: 2,
          rows: [
            { id: "format", codes: ["bracket_format"] },
            { id: "table", codes: ["standings"] },
            { id: "side", codes: ["bracket"] },
            { id: "teams", codes: ["team_a, team_b"] },
            { id: "score", codes: ["score_a, score_b, winner"] },
            { id: "result", codes: ["result"] },
          ],
        },
      },
      { kind: "prose", id: "resultsImages" },

      // Real capture: GET /events/dynasty-cup-nigeria/designs/
      { kind: "code", lang: "json", id: "designsSample", endpoint: "GET events/<slug>/designs/", sample: `{
  "name": "DYNASTY CUP",
  "design_type": "leaderboard",
  "text_color": "#FFFFFF",
  "accent_color": "#34d27b",
  "transparent_background": false,
  "max_rows": 18,
  "is_default": true,
  "background_instagram_url": "${PARTNER_API_ORIGIN}/media/org_leaderboard_designs/DYNASTY_IG.png",
  "background_youtube_url": "${PARTNER_API_ORIGIN}/media/org_leaderboard_designs/DYNASTY_YT.png",
  "logos": [
    { "image_url": "${PARTNER_API_ORIGIN}/media/org_leaderboard_logos/sponsor.png",
      "x_pct": 12.5, "y_pct": 8.0, "size": "medium" }
  ]
}` },
      { kind: "prose", id: "designsCanvas" },
    ],
  },

  // 5. Pagination.
  {
    id: "pagination",
    blocks: [
      { kind: "prose", id: "intro" },
      {
        kind: "table",
        table: {
          id: "params",
          headerCount: 3,
          rows: [
            { id: "limit", codes: ["limit", "25 (max 100)"] },
            { id: "offset", codes: ["offset", "0"] },
          ],
        },
      },
      { kind: "code", lang: "json", id: "envelopeCaption", sample: `{
  "results": [ ... ],
  "has_more": true,
  "next_offset": 25,
  "total_count": 37
}` },
      { kind: "prose", id: "loop" },
    ],
  },

  // 6. Rate limits.
  {
    id: "rateLimits",
    blocks: [
      { kind: "prose", id: "intro" },
      { kind: "code", lang: "http", id: "headersCaption", sample: `X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59` },
      { kind: "code", lang: "http", id: "exceededCaption", sample: `HTTP/1.1 429 Too Many Requests
Retry-After: 60

{ "error": "rate_limit_exceeded" }` },
      { kind: "prose", id: "backoff" },
    ],
  },

  // 7. Errors, and what to do about each.
  {
    id: "errors",
    blocks: [
      { kind: "prose", id: "intro" },
      // The literal body shape, as a sample rather than inside the prose: a "{" in a
      // translated string is an ICU argument opener and breaks the whole message.
      { kind: "code", lang: "json", sample: `{ "error": "not_found" }` },
      {
        kind: "table",
        table: {
          id: "codes",
          headerCount: 3,
          rows: [
            { id: "unauthorized", codes: ["401", "Unknown or revoked key."] },
            { id: "forbidden", codes: ["403", "resource_not_enabled"] },
            { id: "notFound", codes: ["404", "not_found"] },
            // Deliberately NOT a literal message. A 405 is raised by DRF before this API's
            // code runs, so its body is {"detail": "Method \"POST\" not allowed."} - a
            // different key from every other row here, and one whose text varies with the
            // verb the caller sent. Naming the FIELD is the part a partner can rely on
            // (verified live 2026-08-07).
            { id: "methodNotAllowed", codes: ["405", "detail, not error"] },
            { id: "rateLimited", codes: ["429", "rate_limit_exceeded"] },
          ],
        },
      },
      { kind: "note", id: "why404" },
    ],
  },

  // 8. Media, called out separately because it is the part with an operational cost
  //    (bandwidth, hot-linking) rather than just a shape.
  {
    id: "media",
    blocks: [
      { kind: "prose", id: "intro" },
      { kind: "code", lang: "json", id: "urlCaption", sample: `"logo_url": "${PARTNER_API_ORIGIN}/media/teams_logos/asn.jpg"` },
      { kind: "prose", id: "nullNotError" },
      { kind: "note", id: "cache" },
    ],
  },

  // 9. Operating advice. Last, because it only makes sense once the shape is understood.
  {
    id: "practices",
    blocks: [
      { kind: "prose", id: "poll" },
      { kind: "prose", id: "absentFields" },
      { kind: "prose", id: "permanent404" },
      { kind: "prose", id: "slugs" },
      { kind: "prose", id: "help" },
    ],
  },
];
