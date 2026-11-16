"use client";

// ── LetterSuggestPanel (AFC inbox #602, owner 2026-11-16) ───────────────────────────────────────
// Owner: "there should also be a part that suggests what each team should use, based off what they
// have in each group or if its per stage."
//
// FLOW
//   1. The organizer picks a scope on the Registered Teams tab (Whole event, a stage, or one lobby of
//      it) and presses "Suggest letters". This dialog opens for exactly the teams in that scope.
//   2. lib/letterSuggest.ts proposes a letter per team from the letters it OWNS (its members' letter
//      avatars plus the team's manual extras), keeps letters that already work, serves the most
//      constrained team first, and never repeats a letter inside a lobby. Teams that cannot get one
//      are listed with the reason.
//   3. "Applies to" (LetterAppliesTo) decides whether the letters are kept across ALL stages or only
//      the ticked ones; the suggestion is recomputed against the lobbies of exactly those stages.
//   4. "Apply" POSTs only the teams whose letter CHANGES to /events/assign-team-letters/ (backend
//      assign_team_letters_bulk), one transaction, re-checked server side, one push per team. A 409
//      (letter_taken) names the two teams and the lobby.
//
// DATA: teams + stages come from GET /events/event-team-letters/ via RegisteredTeamsTab; out-of-scope
// teams that share a lobby with a scoped team keep their letters and are passed as `fixed`.

import { useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { IconLoader2 } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NewBadge } from "@/components/NewBadge";
import { suggestLetters } from "@/lib/letterSuggest";
import { letterIn, roomsFor, type LetterStage, type LetterTeam, type ScopeStage } from "@/lib/letterScope";
import { LetterAppliesTo } from "./LetterAppliesTo";

/** The day the letter scope + suggester went live, for the 5-day NEW tag (CLAUDE.md rule). */
export const LETTER_SCOPE_SINCE = "2026-11-16";

export function LetterSuggestPanel({
  eventId,
  token,
  teams,
  stages,
  scopeStage,
  scopeTeamIds,
  scopeLabel,
  eligibleIds,
  onApplied,
}: {
  eventId: number;
  token: string | undefined;
  /** tournament_team_id -> the team's letter row. */
  teams: Record<number, LetterTeam>;
  stages: LetterStage[];
  scopeStage: ScopeStage;
  /** The teams the organizer is looking at (already filtered by stage / lobby, waitlist excluded). */
  scopeTeamIds: number[];
  scopeLabel: string;
  /** Every registered, non-waitlisted team (used when the event has no stages yet). */
  eligibleIds: number[];
  onApplied: () => void;
}) {
  const t = useTranslations("evEditTabs");
  const [open, setOpen] = useState(false);
  const [appliesTo, setAppliesTo] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);

  const openPanel = () => {
    // Default: a stage being viewed -> that stage only; the whole event -> all stages.
    setAppliesTo(scopeStage == null ? null : [scopeStage]);
    setOpen(true);
  };

  // The letter a team holds today in the place this suggestion will write to.
  const currentStage: ScopeStage = appliesTo === null ? null : (appliesTo[0] ?? scopeStage);

  const suggestion = useMemo(() => {
    if (!open) return null;
    const inScope = new Set(scopeTeamIds);
    // Rooms of the stages the letter will apply to. A team OUTSIDE the scope keeps its letter; it is
    // passed as a fixed letter under a per-stage stand-in id, because the same team can hold
    // different letters in different stages.
    const fixed: Record<number, string | null> = {};
    const rooms = roomsFor(stages, appliesTo, eligibleIds).map(({ stageId, room }) =>
      room.tournament_team_ids.map((id) => {
        if (inScope.has(id)) return id;
        const standIn = -((stageId ?? 0) * 1_000_000 + id);
        fixed[standIn] = letterIn(teams[id], stageId);
        return standIn;
      }),
    );
    return suggestLetters({
      teams: scopeTeamIds
        .filter((id) => teams[id])
        .map((id) => ({
          id,
          owned: teams[id].available_letters,
          current: letterIn(teams[id], currentStage),
        })),
      rooms,
      fixed,
    });
  }, [open, scopeTeamIds, stages, appliesTo, eligibleIds, teams, currentStage]);

  const changes = useMemo(
    () =>
      suggestion
        ? Object.entries(suggestion.letters)
            .map(([id, letter]) => ({ id: Number(id), letter }))
            .filter(({ id, letter }) => letterIn(teams[id], currentStage) !== letter)
        : [],
    [suggestion, teams, currentStage],
  );

  const apply = async () => {
    if (!token || changes.length === 0) return;
    setBusy(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/assign-team-letters/`,
        {
          event_id: eventId,
          stage_ids: appliesTo ?? [],
          assignments: changes.map(({ id, letter }) => ({ tournament_team_id: id, letter })),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t("registeredTeams.toastSuggestApplied", { count: changes.length }));
      setOpen(false);
      onApplied();
    } catch (e) {
      // 409 letter_taken names both teams and the lobby (assign_team_letters_bulk).
      const message = axios.isAxiosError(e) ? e.response?.data?.message : undefined;
      toast.error(message || t("registeredTeams.toastLetterFailed"));
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (id: number) => teams[id]?.team_name ?? `#${id}`;

  return (
    <>
      <Button size="sm" variant="secondary" onClick={openPanel} disabled={scopeTeamIds.length === 0}>
        {t("registeredTeams.suggest")}
        <NewBadge since={LETTER_SCOPE_SINCE} />
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("registeredTeams.suggestTitle", { scope: scopeLabel })}</DialogTitle>
            <DialogDescription>{t("registeredTeams.suggestDesc")}</DialogDescription>
          </DialogHeader>

          <LetterAppliesTo stages={stages} value={appliesTo} onChange={setAppliesTo} />

          {suggestion && (
            <div className="max-h-72 overflow-y-auto rounded-md bg-muted/30">
              {scopeTeamIds.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">{t("registeredTeams.suggestEmpty")}</p>
              ) : (
                <ul className="flex flex-col">
                  {Object.entries(suggestion.letters)
                    .map(([id, letter]) => ({ id: Number(id), letter }))
                    .sort((a, b) => nameOf(a.id).localeCompare(nameOf(b.id)))
                    .map(({ id, letter }) => {
                      const before = letterIn(teams[id], currentStage);
                      const kept = before === letter;
                      return (
                        <li
                          key={id}
                          className="flex items-center justify-between gap-2 px-3 py-2 text-xs odd:bg-muted/40"
                        >
                          <span className="min-w-0 truncate font-medium">{nameOf(id)}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="text-muted-foreground">
                              {t("registeredTeams.suggestOwns", {
                                count: teams[id]?.available_letters.length ?? 0,
                              })}
                            </span>
                            {before && !kept && (
                              <span className="font-mono text-muted-foreground line-through">{before}</span>
                            )}
                            <Badge className="rounded-full bg-primary px-2 py-0.5 font-mono text-[11px] text-primary-foreground">
                              {letter}
                            </Badge>
                            {kept && (
                              <span className="text-muted-foreground">{t("registeredTeams.suggestKept")}</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
          )}

          {suggestion && suggestion.impossible.length > 0 && (
            <div className="space-y-1 rounded-md bg-amber-500/10 p-3 text-xs">
              <p className="font-medium text-amber-500">{t("registeredTeams.suggestNone")}</p>
              <ul className="space-y-0.5 text-muted-foreground">
                {suggestion.impossible.map((id) => (
                  <li key={id}>
                    {nameOf(id)}:{" "}
                    {suggestion.reasons[id] === "owns_none"
                      ? t("registeredTeams.reasonOwnsNone")
                      : t("registeredTeams.reasonAllTaken")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {suggestion && changes.length === 0 && scopeTeamIds.length > 0 && (
            <p className="text-xs text-muted-foreground">{t("registeredTeams.suggestNothing")}</p>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              {t("registeredTeams.cancel")}
            </Button>
            <Button
              onClick={apply}
              disabled={busy || changes.length === 0 || (appliesTo !== null && appliesTo.length === 0)}
            >
              {busy && <IconLoader2 className="mr-1 size-4 animate-spin" />}
              {t("registeredTeams.suggestApply", { count: changes.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
