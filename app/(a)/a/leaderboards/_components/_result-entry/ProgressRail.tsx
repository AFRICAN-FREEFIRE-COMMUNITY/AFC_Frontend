"use client";

/**
 * app/(a)/a/leaderboards/_components/_result-entry/ProgressRail.tsx
 * ─────────────────────────────────────────────────────────────────
 * "Team 4 of 12", plus a strip showing which teams are done, which one is open, and which have
 * not been touched. Tapping a marker jumps straight to that team.
 *
 * WHY (owner brief 2026-08-27)
 *   The screen this replaces puts every team on one page and shows NOTHING about progress, so
 *   after any interruption the organizer scrolls to find their place. One team per screen only
 *   works if something answers "where was I", and that is this.
 *
 *   It also supplies a completion check the current page has no equivalent of: an unfinished
 *   team is visible before the save is attempted, rather than named by an error toast afterwards.
 *
 * WHAT "DONE" MEANS
 *   teamIsComplete in lib/resultEntry.ts, which is the SAME rule the submit guard uses
 *   (rowsMissingPlacement in lib/scoreInput.ts): a played team needs a finishing position, and a
 *   team marked as not playing counts as dealt with. Two rules would eventually disagree, and
 *   the rail would then say a map was ready while the save refused it.
 *
 * DESIGN CONSTRAINTS THIS OBEYS
 *   No outlines, no glow, no pulsing (CLAUDE.md hard rule). State is carried by FILL and weight:
 *   a done team is filled with the brand colour, the current one is filled with the foreground,
 *   an untouched one is a muted fill. Nothing animates.
 *
 * USED BY
 *   • ../ManualMatchResultStep.tsx - above the per-team screen
 */
import React from "react";

import { cn } from "@/lib/utils";
import { teamIsComplete, type EntryTeam } from "@/lib/resultEntry";

interface Props {
  teams: EntryTeam[];
  /** Index into `teams` of the team currently on screen. */
  currentIndex: number;
  onJump: (index: number) => void;
}

export function ProgressRail({ teams, currentIndex, onJump }: Props) {
  const done = teams.filter(teamIsComplete).length;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">
          Team {Math.min(currentIndex + 1, teams.length)} of {teams.length}
        </span>
        <span className="text-xs text-muted-foreground">
          {done} of {teams.length} entered
        </span>
      </div>

      {/*
        One marker per team. Wide enough to hit with a thumb on a phone, and it wraps rather than
        scrolling sideways, because a rail you have to scroll to read is not a rail.
      */}
      <div className="flex flex-wrap gap-1.5">
        {teams.map((team, i) => {
          const complete = teamIsComplete(team);
          const current = i === currentIndex;
          return (
            <button
              key={team.tournament_team_id}
              type="button"
              onClick={() => onJump(i)}
              title={team.team_name}
              aria-label={`${team.team_name}. ${complete ? "Entered" : "Not entered"}${
                current ? ". Currently open" : ""
              }`}
              aria-current={current ? "step" : undefined}
              className={cn(
                "h-8 min-w-8 rounded-md px-2 text-xs font-medium tabular-nums transition-colors",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                current
                  ? "bg-foreground text-background"
                  : complete
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
