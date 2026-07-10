"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState, useTransition } from "react";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/Loader";
import { ArrowRight } from "lucide-react";

// AdvanceToNextStageModal — the discoverable, stage-header action that advances a ROUND-ROBIN stage's
// teams into the NEXT stage by that stage's COMBINED (all-groups) standings, snake-distributed across
// the next stage's groups.
//
// WHY this exists as its OWN button (owner 2026-07-10: "advance teams based off cumulative results of
// groups combined together in a stage to the next stage ... i dont see any button or ways to run it"):
// the same flow shipped 2026-07-07 (v7.1.24) but ONLY as a hidden Switch buried inside SeedToGroupModal's
// "Seed to groups" popup, so the owner could never find it. This surfaces it as a first-class button on
// the Round-Robin stage header (next to the RR Standings button in StagesGroupsTab), on BOTH the admin
// and organizer event-edit pages (organizer imports the same StagesGroupsTab). When it cannot run yet
// (stage unsaved / no next stage) the button is shown DISABLED with the reason, so the requirement is
// visible instead of the action silently vanishing — that vanishing was the whole bug.
//
// HOW IT CONNECTS:
//   • Calls POST /events/seeding/seed-next-stage-by-standings/
//     (afc_tournament_and_scrims.seeding_management.seed_next_stage_by_standings).
//   • That endpoint orders the next stage's teams by round_robin.cumulative_standings(THIS stage) — the
//     same authoritative table the RR Standings modal, advancement, and the public leaderboard read —
//     then snakes them across the next stage's groups. It AUTO-ADVANCES the RR top-N first when the next
//     stage is still empty (N = teams_qualifying_from_stage), so no separate advance step is needed.
//   • The backend still owns the remaining guards: "round-robin not played yet" (no results), "next
//     stage has no groups", and "next stage already has entered results" (requires force). Those come
//     back as 400s and are surfaced here as toasts; the results case asks the user to confirm via
//     "Advance anyway" (force=true), mirroring SeedToGroupModal's prior handling.
//   • Rendered by StagesGroupsTab only for `br - round robin` team stages; onSuccess refetches the event
//     so the newly seeded next-stage groups render in place (no manual reload).
//
// English-only on purpose: this file lives under app/(a)/ (admin, i18n-exempt) and mirrors its sibling
// SeedToGroupModal, which is also English even on the organizer edit page. Keeping parity avoids
// introducing a lone i18n pattern into this event-edit surface.
export const AdvanceToNextStageModal = ({
  stageId,
  nextStageName,
  onSuccess,
}: {
  /** THIS round-robin stage's id. undefined until the stage is saved -> button disabled with a reason. */
  stageId: number | undefined;
  /** Name of the stage AFTER this one in display order, or null if this is the last stage. */
  nextStageName?: string | null;
  onSuccess?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // Set when the next stage already has entered results and the backend asks to confirm the overwrite.
  const [forceNeeded, setForceNeeded] = useState(false);
  const { token } = useAuth();

  // The action can only run once THIS stage is saved (needs its id) AND a next stage exists to fill.
  // Surfaced as a disabled button + tooltip so the prerequisite is visible, not hidden.
  const disabledReason = !stageId
    ? "Save this stage first, then you can advance its teams."
    : !nextStageName
      ? "Create the next stage first, then advance teams into it."
      : null;
  const canRun = !disabledReason;

  // POST the combined-standings advance. `force` re-runs past the "next stage already has results" guard.
  const advance = (force: boolean) => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seeding/seed-next-stage-by-standings/`,
          { stage_id: stageId, force },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success(res.data.message || "Teams advanced to the next stage.");
        setOpen(false);
        setForceNeeded(false);
        onSuccess?.();
      } catch (e: any) {
        if (e.response?.status === 400 && e.response?.data?.requires_force) {
          // Next stage already has entered results: surface the warning and let the user confirm.
          setForceNeeded(true);
          toast.warning(e.response.data.message);
        } else {
          toast.error(
            e.response?.data?.message || "Failed to advance to the next stage.",
          );
        }
      }
    });
  };

  // Disabled state: a plain button (no dialog) carrying the reason as a tooltip, matching the disabled
  // Delete-button idiom in StagesGroupsTab. Keeps the action VISIBLE so its requirement is discoverable.
  if (!canRun) {
    return (
      <Button
        variant="outline"
        size="md"
        disabled
        title={disabledReason ?? undefined}
      >
        <ArrowRight />
        Advance to next stage
      </Button>
    );
  }

  // Reset the transient force flag whenever the dialog is (re)opened/closed.
  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) setForceNeeded(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {/* Names the destination stage so it can't be confused with the per-group "Seed to Next Stage". */}
        <Button variant="outline" size="md">
          <ArrowRight />
          Advance to {nextStageName}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[400px]">
        <div className="text-center">
          <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <ArrowRight className="h-7 w-7 text-green-600" />
          </div>

          <DialogTitle className="text-xl">
            Advance to {nextStageName}?
          </DialogTitle>
          <DialogDescription className="mt-2 text-base">
            Rank every team by this stage&apos;s combined results across all its
            groups, then place the qualifiers into{" "}
            <strong>{nextStageName}</strong>&apos;s groups, balanced so each
            group gets a fair mix.
          </DialogDescription>

          {/* Overwrite confirmation when the next stage already has entered results. */}
          {forceNeeded && (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 text-left">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {nextStageName} already has entered results. Advancing
                re-distributes its teams and those results become unreachable.
                Press Advance anyway to confirm.
              </p>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => advance(forceNeeded)}
              disabled={pending}
            >
              {pending ? (
                <Loader text="Advancing..." />
              ) : (
                <>
                  <ArrowRight /> {forceNeeded ? "Advance anyway" : "Advance"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
