"use client";

import { useFormContext } from "react-hook-form";
// i18n (namespace "evEditStages"): this confirm dialog is rendered by StagesGroupsTab, which the
// ADMIN and ORGANIZER event-edit pages both mount, so its copy must be localized (en/fr/pt).
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2 } from "lucide-react";
import { type EventFormType } from "../types";

interface RemoveStageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function RemoveStageModal({
  open,
  onOpenChange,
  onConfirm,
}: RemoveStageModalProps) {
  const form = useFormContext<EventFormType>();
  // Shared namespace with the rest of the stage/group edit flow (StagesGroupsTab, StageConfigModal, SeedStageModal).
  const t = useTranslations("evEditStages");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            {t("removeStageTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            {t("removeStageConfirm")}
          </p>

          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive font-medium">
              {t("cannotUndo")}
            </p>
            <ul className="text-xs text-muted-foreground mt-2 space-y-1 ml-4 list-disc">
              <li>{t("removeListGroups")}</li>
              <li>{t("removeListMatchData")}</li>
              <li>{t("removeListOrder")}</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t("removeStage")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
