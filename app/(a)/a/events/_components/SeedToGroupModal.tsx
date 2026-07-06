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
import { Switch } from "@/components/ui/switch";
import { Loader } from "@/components/Loader";
import { AlertTriangle } from "lucide-react";
import { IconPlayerPlay } from "@tabler/icons-react";

// SeedToGroupModal — the stage-header "Seed to groups" action (mounted per stage by StagesGroupsTab,
// on BOTH the admin and organizer edit pages). Default job: deal THIS stage's competitors into THIS
// stage's own groups (shuffle or registration order).
//
// Owner 2026-07-06 addition — "seed teams from round robin games where the teams are seeded from the
// combined overall matches": for a ROUND-ROBIN stage that has a NEXT stage, the modal offers a second
// mode that seeds the NEXT stage's groups ordered by THIS round-robin's combined standings, snaked
// (balanced) across the groups. That mode calls POST /events/seeding/seed-next-stage-by-standings/
// (seeding_management.seed_next_stage_by_standings); the default mode still calls the two existing
// seed endpoints. stageFormat + nextStageName are passed in by StagesGroupsTab so the option only
// shows where it applies.
export const SeedToGroupModal = ({
  stageId,
  onSuccess,
  participantType,
  stageFormat,
  nextStageName,
}: {
  stageId: number | undefined;
  onSuccess?: () => void;
  participantType?: string;
  /** The current stage's format, e.g. "br - round robin". Enables the next-stage seed option. */
  stageFormat?: string;
  /** Name of the stage AFTER this one (null/undefined if this is the last stage). */
  nextStageName?: string | null;
}) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [shuffle, setShuffle] = useState(false);
  const [clearExisting, setClearExisting] = useState(false);
  // When ON, seed the NEXT stage by this round-robin's combined standings instead of this stage.
  const [seedNext, setSeedNext] = useState(false);
  // Set when the next stage already has entered results and the backend asks to confirm the overwrite.
  const [forceNeeded, setForceNeeded] = useState(false);
  const { token } = useAuth();

  const isTeam = participantType !== "solo";
  // The next-stage-by-standings option only makes sense for a team round-robin stage that is followed
  // by another stage (the one whose groups we fill).
  const canSeedNext =
    isTeam && stageFormat === "br - round robin" && !!nextStageName;

  // Seed the NEXT stage's groups by this round-robin's combined standings (snake). `force` re-runs
  // past the "next stage already has results" guard.
  const seedNextStage = (force: boolean) => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seeding/seed-next-stage-by-standings/`,
          { stage_id: stageId, force },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success(res.data.message || "Next stage seeded by standings.");
        setOpen(false);
        setForceNeeded(false);
        onSuccess?.();
      } catch (e: any) {
        if (e.response?.status === 400 && e.response?.data?.requires_force) {
          // Next stage has entered results: surface the warning and let the user confirm.
          setForceNeeded(true);
          toast.warning(e.response.data.message);
        } else {
          toast.error(
            e.response?.data?.message || "Failed to seed the next stage.",
          );
        }
      }
    });
  };

  const handleSeed = () => {
    if (seedNext) {
      seedNextStage(false);
      return;
    }
    startTransition(async () => {
      try {
        if (isTeam) {
          const res = await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seed-stage-competitors-to-groups-team/`,
            { stage_id: stageId, shuffle, clear_existing: clearExisting },
            { headers: { Authorization: `Bearer ${token}` } },
          );
          toast.success(res.data.message || "Stage seeded successfully");
        } else {
          const res = await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seed-stage-competitors-to-groups/`,
            { stage_id: stageId },
            { headers: { Authorization: `Bearer ${token}` } },
          );
          toast.success(res.data.message || "Stage seeded successfully");
        }

        setOpen(false);
        onSuccess?.();
      } catch (e: any) {
        toast.error(
          e.response?.data?.message || "Failed to seed stage to groups",
        );
      }
    });
  };

  // Reset the transient choices whenever the dialog is (re)opened/closed.
  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setForceNeeded(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex-1" variant="outline" size="md">
          <IconPlayerPlay />
          Seed to groups
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[400px]">
        <div className="text-center">
          <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-green-600" />
          </div>

          <DialogTitle className="text-xl">Seed to Groups?</DialogTitle>
          <DialogDescription className="mt-2 text-base">
            {seedNext ? (
              <>
                Fill <strong>{nextStageName}</strong>&apos;s groups using this
                round-robin&apos;s combined standings, balanced across groups.
              </>
            ) : (
              <>Are you sure you want to seed competitors to groups now?</>
            )}
          </DialogDescription>

          {isTeam && (
            <div className="space-y-2 mt-4">
              {/* Round-robin only: seed the NEXT stage by these combined standings (snake). */}
              {canSeedNext && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted text-left">
                  <div>
                    <p className="text-sm font-medium">
                      Seed next stage by combined standings
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Rank teams by this round-robin&apos;s overall results and
                      snake them into {nextStageName}&apos;s groups
                    </p>
                  </div>
                  <Switch
                    checked={seedNext}
                    onCheckedChange={(v) => {
                      setSeedNext(v);
                      setForceNeeded(false);
                    }}
                  />
                </div>
              )}

              {/* This-stage options only apply to the default (seed-this-stage) mode. */}
              {!seedNext && (
                <>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted text-left">
                    <div>
                      <p className="text-sm font-medium">Shuffle competitors</p>
                      <p className="text-xs text-muted-foreground">
                        Randomize competitor placement across groups
                      </p>
                    </div>
                    <Switch checked={shuffle} onCheckedChange={setShuffle} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted text-left">
                    <div>
                      <p className="text-sm font-medium">
                        Clear existing seeding
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Remove existing group assignments before seeding
                      </p>
                    </div>
                    <Switch
                      checked={clearExisting}
                      onCheckedChange={setClearExisting}
                    />
                  </div>
                </>
              )}

              {/* Overwrite confirmation when the next stage already has results. */}
              {seedNext && forceNeeded && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 text-left">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {nextStageName} already has entered results. Seeding
                    re-distributes its teams and those results become
                    unreachable. Press Seed anyway to confirm.
                  </p>
                </div>
              )}
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
              onClick={() =>
                seedNext && forceNeeded ? seedNextStage(true) : handleSeed()
              }
              disabled={pending}
            >
              {pending ? (
                <Loader text="Seeding..." />
              ) : (
                <>
                  <IconPlayerPlay />{" "}
                  {seedNext && forceNeeded ? "Seed anyway" : "Seed"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
