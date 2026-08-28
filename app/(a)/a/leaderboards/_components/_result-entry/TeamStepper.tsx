"use client";

/**
 * app/(a)/a/leaderboards/_components/_result-entry/TeamStepper.tsx
 * ────────────────────────────────────────────────────────────────
 * ONE team's whole entry for one map: whether they played, where they finished, and a kill count
 * for each of the four who were in.
 *
 * WHY (owner brief 2026-08-27)
 *   The screen this replaces stacks every team on one page. On a 12-team squad map that was 156
 *   number inputs and 60 checkboxes at once, and at 390px the page ran to about 17,000 pixels for
 *   a single map. This shows about six controls, and the rail beside it says where you are.
 *
 * THE THREE PARTS, AND WHY EACH IS SHAPED THIS WAY
 *
 *   PLACEMENT is a row of numbers, not a free-text box. The backend already refuses duplicate
 *   placements (validate_placements) but only at SAVE, after all twelve teams have been entered,
 *   so a clash was found long after it was made. Numbers another team already holds are shown as
 *   taken and cannot be chosen, which turns a rejected save into something that cannot be typed.
 *   Nothing is auto-selected: an empty placement stays empty and is NOT zero (bug 2026-08-06).
 *
 *   KILLS use the stepper, so the keyboard never covers the screen. See KillStepper.tsx.
 *
 *   THE LINEUP carries from the previous map and stays editable here. Tapping a player opens a
 *   sheet listing the rest of the roster, and picking somebody swaps them in. The rule that
 *   decides the starting four is resolveLineup in lib/resultEntry.ts, never this component.
 *
 * DESIGN CONSTRAINTS THIS OBEYS
 *   No outlined cards, chips or dividers, and no glow (CLAUDE.md hard rule): hierarchy is built
 *   from filled surfaces and space. A taken placement is a muted fill, the chosen one is a brand
 *   fill. Nothing animates and nothing pulses.
 *
 * USED BY
 *   • ../ManualMatchResultStep.tsx - the per-team view, one of these at a time
 */
import React, { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { type ScoreValue } from "@/lib/scoreInput";
import { takenPlacements, type EntryPlayer, type EntryTeam } from "@/lib/resultEntry";

import { KillStepper } from "./KillStepper";

interface Props {
  team: EntryTeam;
  /** Every team on this map, so the placement picker knows which numbers are already taken. */
  allTeams: EntryTeam[];
  /** How many players may be in the lineup at once. 4 for a squad map; the backend rejects more. */
  maxPlayed: number;
  onChange: (next: EntryTeam) => void;
}

export function TeamStepper({ team, allTeams, maxPlayed, onChange }: Props) {
  // Which player row has its swap sheet open, by user_id. null means no sheet.
  const [swapping, setSwapping] = useState<number | null>(null);

  const taken = takenPlacements(allTeams, team.tournament_team_id);
  const lineup = team.players.filter((p) => p.played);
  const bench = team.players.filter((p) => !p.played);

  const setPlayer = (userId: number, patch: Partial<EntryPlayer>) =>
    onChange({
      ...team,
      players: team.players.map((p) => (p.user_id === userId ? { ...p, ...patch } : p)),
    });

  /** Swap `outId` out of the lineup and `inId` into it, keeping the roster order on screen. */
  const swap = (outId: number, inId: number) =>
    onChange({
      ...team,
      players: team.players.map((p) => {
        if (p.user_id === outId) return { ...p, played: false, kills: null };
        if (p.user_id === inId) return { ...p, played: true };
        return p;
      }),
    });

  return (
    <div className="space-y-5">
      {/* ── did they play at all ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Checkbox
          id={`team-played-${team.tournament_team_id}`}
          checked={team.played}
          onCheckedChange={(v) => onChange({ ...team, played: !!v })}
        />
        <label
          htmlFor={`team-played-${team.tournament_team_id}`}
          className="cursor-pointer text-lg font-semibold select-none"
        >
          {team.team_name}
        </label>
      </div>

      {!team.played ? (
        // A filled surface with a sentence in it, never a dashed outline box.
        <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          Marked as not playing this map. Nothing is recorded for them, and the save will not ask
          for a finishing position.
        </div>
      ) : (
        <>
          {/* ── placement ──────────────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Finishing position
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: allTeams.length }, (_, i) => i + 1).map((n) => {
                const isTaken = taken.includes(n);
                const chosen = team.placement === n;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={isTaken}
                    // Tapping the chosen number again clears it, which is how a mistake gets
                    // undone without a separate control.
                    onClick={() => onChange({ ...team, placement: chosen ? null : n })}
                    aria-pressed={chosen}
                    aria-label={
                      isTaken ? `Position ${n}, already taken by another team` : `Position ${n}`
                    }
                    className={cn(
                      "h-11 min-w-11 rounded-md px-2 text-sm font-medium tabular-nums transition-colors",
                      "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      chosen
                        ? "bg-primary text-primary-foreground"
                        : isTaken
                          ? "cursor-not-allowed bg-muted/50 text-muted-foreground/40"
                          : "bg-muted hover:bg-muted/80",
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            {team.placement === null && (
              <p className="text-xs text-muted-foreground">
                Not set yet. The save will refuse this team until a position is picked, or until
                they are marked as not playing.
              </p>
            )}
          </div>

          {/* ── the lineup ─────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Players
              </p>
              <span className="text-xs text-muted-foreground">
                {lineup.length} of {maxPlayed}
              </span>
            </div>

            {lineup.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Nobody is in the lineup. Add a player below.
              </p>
            ) : (
              <div className="space-y-2">
                {lineup.map((player) => (
                  <div
                    key={player.user_id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3"
                  >
                    {/*
                      The name is the swap control. Tapping it offers the rest of the roster,
                      which is the whole "teams swap players between maps" complaint answered in
                      one tap instead of untick-then-tick.
                    */}
                    <button
                      type="button"
                      onClick={() => setSwapping(player.user_id)}
                      className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      aria-label={`Swap ${player.username} for another player`}
                    >
                      {player.username}
                    </button>
                    <KillStepper
                      value={player.kills}
                      onChange={(kills: ScoreValue) => setPlayer(player.user_id, { kills })}
                      label={`Kills for ${player.username}`}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Bringing somebody in when there is room, without swapping anyone out. */}
            {lineup.length < maxPlayed && bench.length > 0 && (
              <button
                type="button"
                onClick={() => setSwapping(-1)}
                className="h-11 w-full rounded-lg bg-muted px-3 text-sm font-medium hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                Add a player
              </button>
            )}
          </div>
        </>
      )}

      {/* ── the swap sheet ───────────────────────────────────────────────── */}
      <Sheet open={swapping !== null} onOpenChange={(open) => !open && setSwapping(null)}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {swapping === -1
                ? "Add a player"
                : `Swap in for ${team.players.find((p) => p.user_id === swapping)?.username ?? ""}`}
            </SheetTitle>
            <SheetDescription>
              {bench.length > 0
                ? `The rest of ${team.team_name}'s roster for this event.`
                : "Everyone on this team's roster is already in the lineup."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-2 px-4 pb-6">
            {bench.map((candidate) => (
              <button
                key={candidate.user_id}
                type="button"
                onClick={() => {
                  if (swapping === -1) setPlayer(candidate.user_id, { played: true });
                  else if (swapping !== null) swap(swapping, candidate.user_id);
                  setSwapping(null);
                }}
                className="h-12 w-full rounded-lg bg-muted px-3 text-left text-sm font-medium hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {candidate.username}
              </button>
            ))}

            {/* Taking somebody out without putting anyone in: a real case at the end of a map. */}
            {swapping !== null && swapping !== -1 && (
              <button
                type="button"
                onClick={() => {
                  setPlayer(swapping, { played: false, kills: null });
                  setSwapping(null);
                }}
                className="h-12 w-full rounded-lg px-3 text-left text-sm font-medium text-muted-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                Take them out and leave the place empty
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
