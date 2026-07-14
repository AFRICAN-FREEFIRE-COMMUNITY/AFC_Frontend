"use client";
import React from "react";
// i18n (namespace "evEditStages"): this seed-confirm dialog is rendered from the stage/group edit
// flow shared by the ADMIN and ORGANIZER event-edit pages, so its copy is localized (en/fr/pt).
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader } from "@/components/Loader";

interface SeedStageModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeGroup: any;
  onConfirm: (groupId: number) => void;
  pendingSeeding: boolean;
}

export const SeedStageModal = ({
  isOpen,
  onOpenChange,
  activeGroup,
  onConfirm,
  pendingSeeding,
}: SeedStageModalProps) => {
  const t = useTranslations("evEditStages");
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("seedTitle")}</DialogTitle>
          <DialogDescription>
            {/* t.rich keeps the group name bold while letting each language own the word order. */}
            {t.rich("seedDesc", {
              name: () => (
                <span className="font-medium">
                  {activeGroup?.group_name || t("thisGroup")}
                </span>
              ),
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pb-4">
          <div className="bg-primary/10 p-4 rounded-md border">
            <p className="text-sm font-medium">
              {t("qualifiedTeams", { count: activeGroup?.teams_qualifying || 0 })}
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            disabled={pendingSeeding}
            onClick={() => onConfirm(activeGroup?.id)}
          >
            {pendingSeeding ? (
              <Loader text={t("seeding")} />
            ) : (
              t("confirmSendNotifications")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
