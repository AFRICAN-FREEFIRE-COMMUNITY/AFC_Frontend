"use client";

// ── Clash Squad (head-to-head) stage panel (CS sub-project, P1#2) ────────────────
//
// Sibling of RoundRobinPanel: shared between the CREATE wizard (StageModal) and the
// EDIT flow (StageConfigModal) so the two never drift. Rendered ONLY when a stage's
// format starts with "cs - " (see lib/eventFormats.ts); the caller guards the render
// and, like round-robin, skips the classic "Number of Groups" + Step-2 per-group
// (maps / room / match-count) wizard for this format.
//
// Why it is just an explainer and not a builder:
//   A Clash Squad stage is run as a BRACKET, not as BR lobbies. The bracket is seeded
//   and generated from the EVENT PAGE (components/h2h-bracket.tsx → H2HBracketCard →
//   POST events/bracket/generate/) once the event has registered teams, and results
//   are entered on that same card. So there is nothing map/group-shaped to configure
//   at stage-creation time - the admin only picks the format + dates + how many
//   qualify. This panel makes that explicit instead of forcing the BR lobby wizard
//   (which used to materialise phantom BR Match rows next to the real bracket - see
//   the P1#1 backend guard in views.create_event / edit_event).
//
// Connects to: StageModal.tsx + StageConfigModal.tsx (render it), lib/eventFormats.ts
// (FORMAT_LABEL for the human name), and the backend head_to_head.generate_bracket
// which actually builds the tree from the registered team_ids.

import React from "react";
import { IconTournament } from "@tabler/icons-react";
import { FORMAT_LABEL } from "@/lib/eventFormats";

interface ClashSquadPanelProps {
  // The stage's chosen format, e.g. "cs - knockout". Used only to show the human
  // label + a one-line description of how that specific bracket type resolves.
  stageFormat: string;
}

// One-line description of how each CS bracket type decides its standings. Keyed by the
// bare format after "cs - " so it survives label changes. Falls back to a generic line.
const CS_FORMAT_HINT: Record<string, string> = {
  normal:
    "Single-elimination bracket: lose once and you are out; the last team standing wins.",
  knockout:
    "Single-elimination bracket: lose once and you are out; the last team standing wins.",
  "double elimination":
    "Double-elimination bracket: a team must lose twice (winners + losers bracket) before it is out.",
  league:
    "League bracket: every team plays every other, ranked by wins (round-diff breaks ties).",
  "round robin":
    "Round-robin bracket: every team plays every other, ranked by wins (round-diff breaks ties).",
};

export function ClashSquadPanel({ stageFormat }: ClashSquadPanelProps) {
  const bare = String(stageFormat || "")
    .replace(/^cs\s*-\s*/i, "")
    .trim()
    .toLowerCase();
  const label = FORMAT_LABEL[stageFormat] || "Clash Squad";
  const hint =
    CS_FORMAT_HINT[bare] ||
    "Head-to-head bracket: teams are matched pair by pair until a winner is decided.";

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
        <IconTournament className="size-4 shrink-0" />
        {label} runs as a bracket
      </p>

      <p className="text-xs text-muted-foreground">{hint}</p>

      {/* No group / map / room fields: a bracket has none. Tell the admin exactly where the
          real setup happens so the empty step does not read as "unfinished". */}
      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground space-y-1.5">
        <p className="font-medium text-foreground">Nothing to configure here</p>
        <p>
          There are no Battle Royale groups, maps or lobby rooms for a Clash Squad
          stage. Just set the stage name, dates and how many teams qualify, then save.
        </p>
        <p>
          Once the event is saved and teams have registered, open the event page and
          use the bracket card to generate the bracket (it seeds from the registered
          teams) and enter each match result.
        </p>
      </div>
    </div>
  );
}
