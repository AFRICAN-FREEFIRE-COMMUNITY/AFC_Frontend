// Glossary STRUCTURE for the user-facing /glossary page.
//
// This file no longer holds the English copy. It only carries the stable shape
// of the glossary: the ordered list of terms, each term's display token (an
// acronym / proper noun that is NOT translated, e.g. "BR", "K/D", "IGL"), its
// category, a stable i18n `key`, and whether it has an alias line.
//
// All translatable copy (category labels, definitions, and "also" aliases) lives
// in the "glossary" i18n namespace: messages/{en,fr,pt}/glossary.json. The page
// resolves each field at render time via useTranslations("glossary"):
//   - categories.<CATEGORY_I18N_KEYS[category]>  -> the category label
//   - definitions.<term.key>                     -> the definition text
//   - aliases.<term.key>                         -> the "also" alias text
//
// Consumed by: app/(user)/glossary/page.tsx (search + category filter render).
// Keep definitions short, plain, and beginner-friendly in the JSON. No em dashes
// or en dashes anywhere (house rule).

export type GlossaryCategory =
  | "Getting Started"
  | "Game Modes"
  | "Competitive Formats"
  | "Team Roles"
  | "In-Game Terms"
  | "Scoring"
  | "Esports Business";

export interface GlossaryTerm {
  term: string; // display token (acronym / proper noun) - never translated
  category: GlossaryCategory;
  key: string; // stable i18n key into glossary.definitions.* / glossary.aliases.*
  hasAlias?: boolean; // true when glossary.aliases.<key> exists (renders the "also" line)
}

// Category display ORDER (drives the filter pills and the "All" section order).
// The English strings double as the stable enum values; their translated labels
// come from glossary.categories.* via CATEGORY_I18N_KEYS below.
export const GLOSSARY_CATEGORIES: GlossaryCategory[] = [
  "Getting Started",
  "Game Modes",
  "Competitive Formats",
  "Team Roles",
  "In-Game Terms",
  "Scoring",
  "Esports Business",
];

// Maps each category enum value to its i18n key under glossary.categories.*.
// The page reads t(`categories.${CATEGORY_I18N_KEYS[cat]}`) to get the label.
export const CATEGORY_I18N_KEYS: Record<GlossaryCategory, string> = {
  "Getting Started": "gettingStarted",
  "Game Modes": "gameModes",
  "Competitive Formats": "competitiveFormats",
  "Team Roles": "teamRoles",
  "In-Game Terms": "inGameTerms",
  "Scoring": "scoring",
  "Esports Business": "esportsBusiness",
};

export const GLOSSARY: GlossaryTerm[] = [
  // ── Getting Started ──────────────────────────────────────────────
  { term: "Esports", category: "Getting Started", key: "esports", hasAlias: true },
  { term: "Free Fire", category: "Getting Started", key: "freeFire", hasAlias: true },
  { term: "UID", category: "Getting Started", key: "uid", hasAlias: true },
  { term: "IGN", category: "Getting Started", key: "ign", hasAlias: true },
  { term: "Profile", category: "Getting Started", key: "profile" },
  { term: "Roster", category: "Getting Started", key: "roster" },

  // ── Game Modes ───────────────────────────────────────────────────
  { term: "Battle Royale", category: "Game Modes", key: "battleRoyale", hasAlias: true },
  { term: "Clash Squad", category: "Game Modes", key: "clashSquad", hasAlias: true },
  { term: "Booyah", category: "Game Modes", key: "booyah" },
  { term: "Bermuda", category: "Game Modes", key: "bermuda" },
  { term: "Lobby", category: "Game Modes", key: "lobby", hasAlias: true },

  // ── Competitive Formats ──────────────────────────────────────────
  { term: "Scrims", category: "Competitive Formats", key: "scrims", hasAlias: true },
  { term: "Tournament", category: "Competitive Formats", key: "tournament" },
  { term: "Group Stage", category: "Competitive Formats", key: "groupStage" },
  { term: "Finals", category: "Competitive Formats", key: "finals" },
  { term: "Bracket", category: "Competitive Formats", key: "bracket" },
  { term: "Seeding", category: "Competitive Formats", key: "seeding" },
  { term: "Single Elimination", category: "Competitive Formats", key: "singleElimination" },
  { term: "Double Elimination", category: "Competitive Formats", key: "doubleElimination" },
  { term: "Round Robin", category: "Competitive Formats", key: "roundRobin" },
  { term: "Swiss", category: "Competitive Formats", key: "swiss" },
  { term: "Qualifier", category: "Competitive Formats", key: "qualifier" },
  { term: "LAN", category: "Competitive Formats", key: "lan", hasAlias: true },
  { term: "Point Rush", category: "Competitive Formats", key: "pointRush" },

  // ── Team Roles ───────────────────────────────────────────────────
  { term: "IGL", category: "Team Roles", key: "igl", hasAlias: true },
  { term: "Rusher", category: "Team Roles", key: "rusher", hasAlias: true },
  { term: "Sniper", category: "Team Roles", key: "sniper" },
  { term: "Grenadier", category: "Team Roles", key: "grenadier", hasAlias: true },
  { term: "Support", category: "Team Roles", key: "support" },
  { term: "Substitute", category: "Team Roles", key: "substitute", hasAlias: true },
  { term: "Coach", category: "Team Roles", key: "coach" },
  { term: "Manager", category: "Team Roles", key: "manager" },

  // ── In-Game Terms ────────────────────────────────────────────────
  { term: "Gloo Wall", category: "In-Game Terms", key: "glooWall" },
  { term: "Rotation", category: "In-Game Terms", key: "rotation" },
  { term: "Zone", category: "In-Game Terms", key: "zone", hasAlias: true },
  { term: "Knock", category: "In-Game Terms", key: "knock", hasAlias: true },
  { term: "Revive", category: "In-Game Terms", key: "revive" },
  { term: "Third Party", category: "In-Game Terms", key: "thirdParty" },
  { term: "Camp", category: "In-Game Terms", key: "camp" },
  { term: "Loadout", category: "In-Game Terms", key: "loadout" },
  { term: "Ping", category: "In-Game Terms", key: "ping", hasAlias: true },

  // ── Scoring ──────────────────────────────────────────────────────
  { term: "Placement Points", category: "Scoring", key: "placementPoints" },
  { term: "Kill Points", category: "Scoring", key: "killPoints", hasAlias: true },
  { term: "WWCD", category: "Scoring", key: "wwcd" },
  { term: "MVP", category: "Scoring", key: "mvp" },
  { term: "Tiebreaker", category: "Scoring", key: "tiebreaker" },

  // ── Esports Business ─────────────────────────────────────────────
  { term: "Organization", category: "Esports Business", key: "organization", hasAlias: true },
  { term: "Sponsor", category: "Esports Business", key: "sponsor" },
  { term: "Prize Pool", category: "Esports Business", key: "prizePool" },
  { term: "Payout", category: "Esports Business", key: "payout" },
  { term: "Free Agent", category: "Esports Business", key: "freeAgent" },
  { term: "Transfer Window", category: "Esports Business", key: "transferWindow" },
  { term: "Bootcamp", category: "Esports Business", key: "bootcamp" },
  { term: "Slot", category: "Esports Business", key: "slot" },
  { term: "Tier", category: "Esports Business", key: "tier" },
  { term: "Promotion and Relegation", category: "Esports Business", key: "promotionAndRelegation" },
  { term: "Caster", category: "Esports Business", key: "caster", hasAlias: true },
  { term: "Ghost Team", category: "Esports Business", key: "ghostTeam", hasAlias: true },
];
