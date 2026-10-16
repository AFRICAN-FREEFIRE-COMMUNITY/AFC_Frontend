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
// Words from messages/<locale>/resultEntry.json (inbox #257, 2026-10-16: English only before).
import { useTranslations } from "next-intl";
import { teamIsComplete, type EntryTeam } from "@/lib/resultEntry";

interface Props {
  teams: EntryTeam[];
  /** Index into `teams` of the team currently on screen. */
  currentIndex: number;
  onJump: (index: number) => void;
}

export function ProgressRail({ teams, currentIndex, onJump }: Props) {
  const t = useTranslations("resultEntry");
  const done = teams.filter(teamIsComplete).length;

  return (
    // w-full: the parent row is a flex container, and without it the rail shrank to its content, so
    // "Team 1 of 12" and "3 of 12 entered" ran together ("Team 1 of 123 of 12 entered", seen on a
    // 390 phone on 2026-10-16). Full width lets justify-between put them at the two ends.
    <div className="w-full space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">
          {t("rail.teamOf", { current: Math.min(currentIndex + 1, teams.length), total: teams.length })}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("rail.entered", { done, total: teams.length })}
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
          const marker = complete
            ? t("rail.markerEntered", { team: team.team_name })
            : t("rail.markerNotEntered", { team: team.team_name });
          return (
            <button
              key={team.tournament_team_id}
              type="button"
              onClick={() => onJump(i)}
              title={team.team_name}
              aria-label={current ? t("rail.markerCurrent", { marker }) : marker}
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
