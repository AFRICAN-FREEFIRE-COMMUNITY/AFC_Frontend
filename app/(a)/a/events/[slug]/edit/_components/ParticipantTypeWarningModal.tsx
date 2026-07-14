"use client";

import { AlertTriangle } from "lucide-react";
// i18n: this warning modal is shared by the admin + organizer event-edit flows. All copy is
// internationalized via the "evEditTabs" namespace (messages/{en,fr,pt}/evEditTabs.json).
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ParticipantTypeWarningModalProps {
  open: boolean;
  currentType: string;
  pendingType: string | null;
  participantLabel: string;
  onCancel: () => void;
  onConfirm: (newType: string) => void;
}

export function ParticipantTypeWarningModal({
  open,
  currentType,
  pendingType,
  participantLabel,
  onCancel,
  onConfirm,
}: ParticipantTypeWarningModalProps) {
  const t = useTranslations("evEditTabs");
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onCancel();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t("participantWarning.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            {t("participantWarning.bodyFrom")}{" "}
            <span className="font-semibold capitalize text-foreground">
              {currentType}
            </span>{" "}
            {t("participantWarning.bodyTo")}{" "}
            <span className="font-semibold capitalize text-foreground">
              {pendingType}
            </span>
            .
          </p>
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {/* t.rich embeds the emphasized "automatically removed" inline; {label} is the
                localized participant noun (teams/players) passed from the parent. */}
            <strong>{t("participantWarning.warningLabel")}</strong>{" "}
            {t.rich("participantWarning.warningBody", {
              label: participantLabel,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t("participantWarning.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (pendingType) {
                onConfirm(pendingType);
              }
            }}
          >
            {t("participantWarning.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
