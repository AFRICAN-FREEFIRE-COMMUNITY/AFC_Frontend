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
import { useTranslations } from "next-intl";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader } from "@/components/Loader";
import { AlertTriangle } from "lucide-react";
import { IconPlayerPlay } from "@tabler/icons-react";

// SeedToGroupModal - the stage-header "Seed to groups" action (mounted per stage by StagesGroupsTab,
// on BOTH the admin and organizer edit pages). Job: deal THIS stage's competitors into THIS stage's
// own groups (shuffle or registration order).
//
// NOTE (owner 2026-07-10): the "seed the NEXT stage by this round-robin's combined standings" flow used
// to live here as a hidden Switch, but the owner could not find it. It now has its own first-class,
// visible button - AdvanceToNextStageModal - on the round-robin stage header, so this modal is back to
// its single job. The combined-standings endpoint (seed-next-stage-by-standings) is called from there.
export const SeedToGroupModal = ({
  stageId,
  onSuccess,
  participantType,
}: {
  stageId: number | undefined;
  onSuccess?: () => void;
  participantType?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [shuffle, setShuffle] = useState(false);
  const [clearExisting, setClearExisting] = useState(false);
  const { token } = useAuth();
  // i18n: strings live under the evEditStages namespace ("seedToGroup" group),
  // shared with the sibling AdvanceToNextStageModal and the StagesGroupsTab that mounts this.
  const t = useTranslations("evEditStages");

  const isTeam = participantType !== "solo";

  const handleSeed = () => {
    startTransition(async () => {
      try {
        if (isTeam) {
          const res = await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seed-stage-competitors-to-groups-team/`,
            { stage_id: stageId, shuffle, clear_existing: clearExisting },
            { headers: { Authorization: `Bearer ${token}` } },
          );
          toast.success(res.data.message || t("seedToGroup.toastSuccess"));
        } else {
          const res = await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seed-stage-competitors-to-groups/`,
            { stage_id: stageId },
            { headers: { Authorization: `Bearer ${token}` } },
          );
          toast.success(res.data.message || t("seedToGroup.toastSuccess"));
        }

        setOpen(false);
        onSuccess?.();
      } catch (e: any) {
        toast.error(
          e.response?.data?.message || t("seedToGroup.toastError"),
        );
      }
    });
  };

  const onOpenChange = (o: boolean) => {
    setOpen(o);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex-1" variant="outline" size="md">
          <IconPlayerPlay />
          {t("seedToGroup.trigger")}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[400px]">
        <div className="text-center">
          <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-green-600" />
          </div>

          <DialogTitle className="text-xl">
            {t("seedToGroup.title")}
          </DialogTitle>
          <DialogDescription className="mt-2 text-base">
            {t("seedToGroup.description")}
          </DialogDescription>

          {/* Team events can shuffle and/or clear existing group assignments before seeding. */}
          {isTeam && (
            <div className="space-y-2 mt-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted text-left">
                <div>
                  <p className="text-sm font-medium">
                    {t("seedToGroup.shuffleLabel")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("seedToGroup.shuffleHelp")}
                  </p>
                </div>
                <Switch checked={shuffle} onCheckedChange={setShuffle} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted text-left">
                <div>
                  <p className="text-sm font-medium">
                    {t("seedToGroup.clearLabel")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("seedToGroup.clearHelp")}
                  </p>
                </div>
                <Switch
                  checked={clearExisting}
                  onCheckedChange={setClearExisting}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t("seedToGroup.cancel")}
            </Button>
            <Button
              className="flex-1"
              onClick={() => handleSeed()}
              disabled={pending}
            >
              {pending ? (
                <Loader text={t("seedToGroup.seeding")} />
              ) : (
                <>
                  <IconPlayerPlay /> {t("seedToGroup.seed")}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
