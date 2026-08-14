// lib/eventFormats.ts
//
// Single source of truth for the stage BRACKET-types + their human labels.
// Replaces the copies that had drifted across the create types.ts, the edit types.tsx,
// and the two stage modals. Keeping them here means the dropdown options + labels can
// never disagree between the create flow, the edit flow, and the organizer flow.
//
// IMPORTANT: scoring is no longer a "format". The old "br - point rush" and
// "br - champion rush" pseudo-formats have been dropped - Champion-Point and Point-Rush
// are now independent, combinable per-stage toggles (see WEBSITE/tasks/scoring-modes-design.md).
// A stage picks a bracket type here AND, optionally, enables either/both scoring modes.

// The bracket types a stage can run. `as const` so callers get a precise string union.
export const STAGE_FORMATS = [
  // ── what the picker writes now (owner backlog item 21, 2026-08-13) ──
  // Game only; the MODE is the second question, and for Clash Squad it lives on the group.
  // Listed first so they are the top of the dropdown for anyone still seeing the flat list.
  "br",
  "cs",
  // ── legacy values: still selectable, still meaningful, still what old stages carry ──
  "br - normal",
  // Legacy bracket value. The backend's Stages.STAGE_FORMAT_CHOICES labels this
  // key "Battle Royale - Knockout" (NOT "Round Robin"), so we mirror that label in
  // FORMAT_LABEL below. It is kept selectable for parity with the backend choices +
  // back-compat with stages already stored as "br - roundrobin"; it does NOT drive
  // the round-robin builder.
  "br - roundrobin",
  // The live BR Round-Robin bracket (sub-project B). The backend uses the SPACED
  // "br - round robin" value, and only THIS value triggers the base-groups +
  // game-day-lobbies builder - which is why it is a separate key from the legacy
  // unspaced "br - roundrobin"/Knockout entry above.
  "br - round robin",
  "cs - normal",
  "cs - league",
  "cs - knockout",
  "cs - double elimination",
  "cs - round robin",
] as const;

// Display label for each bracket type (used in the stage-format <Select> options).
//
// i18n: these English strings are the source-of-truth + en fallback. The user-facing
// localized labels live in the "eventFormats" namespace (messages/{en,fr,pt}/eventFormats.json),
// keyed by the SAME bracket codes as this map. The public Tournament Structure view
// (app/(user)/tournaments/[slug]/_components/TournamentStructure.tsx, owned by the tournaments
// workstream) resolves the localized label via useTranslations("eventFormats") with these codes,
// falling back to FORMAT_LABEL here. Admin/organizer create/edit surfaces are i18n-exempt and
// keep reading these English labels directly.
export const FORMAT_LABEL: Record<string, string> = {
  "br": "Battle Royale",
  "cs": "Clash Squad",
  "br - normal": "Battle Royale - Normal",
  // Mirror the backend label for the legacy unspaced key (it is "Knockout" there,
  // not "Round Robin") so the dropdown no longer shows two identical "Round Robin"
  // options - only the spaced "br - round robin" below is the real round-robin.
  "br - roundrobin": "Battle Royale - Knockout",
  "br - round robin": "Battle Royale - Round Robin",
  "cs - normal": "Clash Squad - Normal",
  "cs - league": "Clash Squad - League",
  "cs - knockout": "Clash Squad - Knockout",
  "cs - double elimination": "Clash Squad - Double Elimination",
  "cs - round robin": "Clash Squad - Round Robin",
};

// ── Stage SHAPE helpers: which stages actually own classic BR groups ────────────
//
// Three stage shapes exist and each keeps its "groups" somewhere DIFFERENT:
//   • classic BR ("br - normal", "br - roundrobin")  -> stage.groups
//     (the Step-2 lobby wizard: per-group maps, room, match count)
//   • BR Round-Robin ("br - round robin")            -> stage.round_robin.round_robin_groups
//     (base groups A/B/C built in RoundRobinPanel; stage.groups stays EMPTY on purpose,
//      see the create pages' handleSaveStage which sends `groups: []` for this format)
//   • Clash Squad ("cs - *")                          -> NO groups at all. A CS stage runs as a
//     head-to-head bracket generated later from the event page (components/h2h-bracket.tsx),
//     so there is nothing group-shaped to configure at creation time (see ClashSquadPanel).
//
// Any validation that asks "does this stage have groups yet?" MUST branch on the shape first.
// BUG THIS FIXES (owner 2026-08-12): the create wizard's Step-4 gate asked the blanket
// `stage.groups.length > 0`, so BOTH Clash Squad and BR Round-Robin stages saved fine and then
// Next refused with "One or more stages have not been fully configured with groups" - with no
// groups UI anywhere to satisfy it. Clash Squad events could not be created at all. The EDIT
// flow already branched correctly (app/(a)/a/events/[slug]/edit/types.tsx validateEventData),
// so these helpers exist to keep the create + edit + organizer surfaces on ONE rule.
//
// CONSUMED BY: app/(a)/a/events/create/page.tsx (Step-4 gate),
// app/(organizer)/organizer/events/create/page.tsx (same gate),
// app/(a)/a/events/create/_components/Step4StageOrdering.tsx (the stage summary line).

// ── The two-question stage picker (owner backlog item 21, 2026-08-13) ───────────
//
// A stage now answers ONE question in its format field - which GAME is this? - and the specific
// mode is a second question. For Clash Squad the mode lives on the GROUP
// (StageGroups.bracket_format), which is what lets one stage run "Group A - Knockout" beside
// "Group B - League". Every legacy value above still works and still means what it meant; these
// are just the shorter way to say the same thing, and what the picker writes now.

/** The value a stage carries when the organizer picks Clash Squad in the new picker. */
export const CS_STAGE_FORMAT = "cs";
/** The value a stage carries when the organizer picks Battle Royale in the new picker. */
export const BR_STAGE_FORMAT = "br";

/** The four bracket modes a Clash Squad group can run, with their labels.
 *  Mirrors StageGroups.BRACKET_FORMAT_CHOICES on the backend - keep the codes identical. */
export const CS_BRACKET_MODES = [
  { value: "single_elim", label: "Knockout" },
  { value: "double_elim", label: "Double elimination" },
  { value: "league", label: "League" },
  { value: "round_robin_h2h", label: "Round robin" },
] as const;

export type CSBracketMode = (typeof CS_BRACKET_MODES)[number]["value"];

/** The mode a LEGACY Clash Squad format implied, so an old stage opens on the right one.
 *  Mirrors stage_formats.LEGACY_CS_MODE on the backend. Returns null for the plain "cs". */
export function legacyClashSquadMode(format?: string | null): CSBracketMode | null {
  const map: Record<string, CSBracketMode> = {
    "cs - knockout": "single_elim",
    "cs - double elimination": "double_elim",
    "cs - league": "league",
    "cs - round robin": "round_robin_h2h",
    "cs - normal": "single_elim",
  };
  return map[String(format ?? "").trim().toLowerCase()] ?? null;
}

/** True for any Clash Squad stage, of any generation: the plain "cs" the picker writes now, and
 *  every legacy "cs - knockout" / "cs - league" / ... value. */
export function isClashSquadFormat(format?: string | null): boolean {
  const value = String(format ?? "").trim().toLowerCase();
  return value === CS_STAGE_FORMAT || /^cs\s*-/i.test(value);
}

/** True for any Battle Royale stage, of any generation. */
export function isBattleRoyaleFormat(format?: string | null): boolean {
  const value = String(format ?? "").trim().toLowerCase();
  return value === BR_STAGE_FORMAT || /^br\s*-/i.test(value);
}

/** True ONLY for the live BR Round-Robin builder format (the SPACED backend value).
 *  The legacy unspaced "br - roundrobin" is a plain knockout and keeps classic groups. */
export function isRoundRobinBuilderFormat(format?: string | null): boolean {
  return String(format ?? "").trim().toLowerCase() === "br - round robin";
}

/** True when the stage is configured with the classic per-group lobby wizard (stage.groups).
 *  False for Clash Squad (bracket) and BR Round-Robin (base groups) stages. */
export function stageUsesClassicGroups(format?: string | null): boolean {
  return !isClashSquadFormat(format) && !isRoundRobinBuilderFormat(format);
}

// ── Prize distribution helpers ──────────────────────────────────────────────────
//
// prize_distribution is the event-level "1st/2nd/3rd..." payout map. It is held in the
// form as a plain Record<string, string> (position-key -> prize text) and shipped to the
// backend verbatim via JSON.stringify(data.prize_distribution) (see the create + edit
// pages' FormData.append("prize_distribution", ...)). The backend stores/returns the
// same object, so the WIRE SHAPE here is unchanged: an object of string keys -> string
// values. These helpers are the SINGLE source of truth for how a position is added,
// removed, and labelled, shared by:
//   • app/(a)/a/events/create/_components/Step5PrizePool.tsx        (admin create wizard)
//   • app/(a)/a/events/[slug]/edit/_components/PrizeRulesTab.tsx    (admin edit tab)
//   • app/(organizer)/organizer/events/[slug]/edit/page.tsx         (organizer edit, owns the handlers)
// so the four surfaces can never drift again.
//
// ROOT CAUSE this fixes (owner bug 2026-06-22): the old add/remove derived the new
// position key from the array length (`length + 1`) or from `Math.max(existingKeys) + 1`
// and keyed the map BY THE POSITION ITSELF. So after deleting a middle position you got a
// gapped/duplicate key set: e.g. delete "2nd" from {1st,2nd,3rd} left {1st,3rd}; adding
// then either OVERWROTE the existing "3rd" (length+1 = 3 -> silent no-op, the wizard) or
// produced a permanent gap "4" with no "2" (max+1, the edit pages). Either way you could
// not re-add a removed position or fix a wrong one. The fix below ALWAYS renumbers the
// surviving rows to a contiguous "1".."N" (preserving order) on every add/remove, so
// there are never gaps or duplicate keys and the list can always be rebuilt.

// A prize map as it MIGHT arrive: the form schema is Record<string, string>, but a couple
// of legacy create seeds initialise values as the number 0 (e.g. { "1st": 0 }). Accept the
// wider value type on input so those callers type-check; we always EMIT Record<string,string>.
// Exported so components that hold a prize map before renumbering it can name the same
// contract instead of inventing a looser one (PrizeSuggestionDialog does exactly that).
export type PrizeDistInput = Record<string, string | number | null | undefined>;

// Renumber a prize map to contiguous numeric string keys "1".."N", preserving the
// existing left-to-right order of the values. Used after every add/remove so the keys
// stay a gap-free sequence. Returns a fresh object (does not mutate the input).
export function renumberPrizeDistribution(
  dist: PrizeDistInput,
): Record<string, string> {
  // Object insertion order is the visual row order here (all keys are non-negative
  // integer-like strings, so we cannot rely on JS's numeric-key reordering being the
  // order we want once gaps appear). Object.values walks in insertion order, which is
  // exactly the order the rows are rendered, so re-key those values 1..N.
  const values = Object.values(dist ?? {});
  const next: Record<string, string> = {};
  values.forEach((value, index) => {
    // Coerce to string for the Record<string, string> contract. Some legacy create seeds
    // initialised prize values as the number 0 ({ "1st": 0 }); the value input renders
    // `value || ""`, so 0 / "0" / null / undefined all mean "blank" - normalise those to
    // "" so the renumbered map carries a clean empty string, not a stray "0".
    next[`${index + 1}`] =
      value === null || value === undefined || value === 0 || value === "0"
        ? ""
        : `${value}`;
  });
  return next;
}

// Append one position to the end of the map, then renumber so the new key is always the
// next sequential position (N+1) regardless of any prior gaps/duplicates.
export function addPrizePositionTo(
  dist: PrizeDistInput,
): Record<string, string> {
  const renumbered = renumberPrizeDistribution(dist);
  const nextPos = Object.keys(renumbered).length + 1;
  renumbered[`${nextPos}`] = "";
  return renumbered;
}

// Remove the position at `key`, then renumber the survivors back to 1..N so deleting a
// middle row never leaves a gap (and the removed slot can be re-added). Keeps at least
// one row (callers also disable the trash button at length 1).
export function removePrizePositionFrom(
  dist: PrizeDistInput,
  key: string,
): Record<string, string> {
  const current: PrizeDistInput = { ...(dist ?? {}) };
  // Renumber first so the survivors are a clean Record<string, string> 1..N. With <= 1
  // row we still renumber (and emit a string-valued map) but skip the delete.
  if (Object.keys(current).length <= 1) return renumberPrizeDistribution(current);
  delete current[key];
  return renumberPrizeDistribution(current);
}

// Turn a position key (numeric "1" or legacy ordinal "1st" / "1st Place") into the
// "1st / 2nd / 3rd / Nth" label shown in the disabled position input. Tolerant of the
// historic key shapes so already-saved events still display correctly.
export function formatPrizeKey(key: string): string {
  let k = key;
  if (k.endsWith("Place")) k = k.split(" ")[0];
  const numericPart = parseInt(k.replace(/[^0-9]/g, ""), 10);
  if (isNaN(numericPart)) return key;
  const suffix =
    numericPart === 1
      ? "st"
      : numericPart === 2
        ? "nd"
        : numericPart === 3
          ? "rd"
          : "th";
  return `${numericPart}${suffix}`;
}
