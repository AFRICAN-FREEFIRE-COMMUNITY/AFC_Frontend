// lib/eventFormats.ts
//
// Single source of truth for the stage BRACKET-types + their human labels.
// Replaces the copies that had drifted across the create types.ts, the edit types.tsx,
// and the two stage modals. Keeping them here means the dropdown options + labels can
// never disagree between the create flow, the edit flow, and the organizer flow.
//
// IMPORTANT: scoring is no longer a "format". The old "br - point rush" and
// "br - champion rush" pseudo-formats have been dropped — Champion-Point and Point-Rush
// are now independent, combinable per-stage toggles (see WEBSITE/tasks/scoring-modes-design.md).
// A stage picks a bracket type here AND, optionally, enables either/both scoring modes.

// The bracket types a stage can run. `as const` so callers get a precise string union.
export const STAGE_FORMATS = [
  "br - normal",
  "br - roundrobin",
  "cs - normal",
  "cs - league",
  "cs - knockout",
  "cs - double elimination",
  "cs - round robin",
] as const;

// Display label for each bracket type (used in the stage-format <Select> options).
export const FORMAT_LABEL: Record<string, string> = {
  "br - normal": "Battle Royale - Normal",
  "br - roundrobin": "Battle Royale - Round Robin",
  "cs - normal": "Clash Squad - Normal",
  "cs - league": "Clash Squad - League",
  "cs - knockout": "Clash Squad - Knockout",
  "cs - double elimination": "Clash Squad - Double Elimination",
  "cs - round robin": "Clash Squad - Round Robin",
};
