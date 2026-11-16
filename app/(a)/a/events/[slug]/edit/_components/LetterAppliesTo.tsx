"use client";

// ── LetterAppliesTo (AFC inbox #602, owner 2026-11-16) ──────────────────────────────────────────
// "Which stages does this letter apply to?" Owner: "The admin or organizer decides that, also decides
// what stages it applies to." Two filled choices: ALL STAGES (the team keeps the letter across stages,
// stored on TournamentTeam.assigned_letter) or ONLY THESE STAGES (one StageTeamLetter row per ticked
// stage, overriding the all-stages letter there).
//
// value === null  -> all stages;  value = [ids] -> only those stages (empty = nothing picked yet).
// The caller sends it as `stage_ids` to POST /events/assign-team-letter/ or
// /events/assign-team-letters/ (null -> []), where afc_tournament_and_scrims/letter_rooms.py
// apply_letters writes and checks it.
//
// Used by RegisteredTeamsTab.tsx (the per-row Assign confirm) and LetterSuggestPanel.tsx.
// Filled chips, never ringed (design rule); the checkboxes are native-style form controls.

import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { LetterStage } from "@/lib/letterScope";

export function LetterAppliesTo({
  stages,
  value,
  onChange,
}: {
  stages: LetterStage[];
  value: number[] | null;
  onChange: (next: number[] | null) => void;
}) {
  const t = useTranslations("evEditTabs");
  // No stages yet: a letter can only be the all-stages one, so there is nothing to choose.
  if (stages.length === 0) return null;
  const chip = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
    );
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">{t("registeredTeams.appliesTo")}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(value === null)} onClick={() => onChange(null)}>
          {t("registeredTeams.appliesAll")}
        </button>
        <button
          type="button"
          className={chip(value !== null)}
          onClick={() => value === null && onChange([])}
        >
          {t("registeredTeams.appliesStages")}
        </button>
      </div>
      {value !== null && (
        <div className="flex flex-col gap-1.5 rounded-md bg-muted/40 p-2">
          {stages.map((s) => {
            const checked = value.includes(s.stage_id);
            return (
              <label key={s.stage_id} className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) =>
                    onChange(c ? [...value, s.stage_id] : value.filter((id) => id !== s.stage_id))
                  }
                />
                {s.stage_name}
              </label>
            );
          })}
          {value.length === 0 && (
            <p className="text-[11px] text-amber-500">{t("registeredTeams.appliesPickOne")}</p>
          )}
        </div>
      )}
    </div>
  );
}
