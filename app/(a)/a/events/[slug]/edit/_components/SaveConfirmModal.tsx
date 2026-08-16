"use client";

import { Loader } from "@/components/Loader";
// i18n: shared save-confirm modal for the admin + organizer event-edit flows. Copy comes from the
// "evEditTabs" namespace. The per-change `label` shown in the list is a localized string built by
// the parent edit page (out of this component's scope).
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SaveConfirmModalProps {
  open: boolean;
  changes: { label: string; from: string; to: string }[];
  pendingSubmit: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SaveConfirmModal({
  open,
  changes,
  pendingSubmit,
  onCancel,
  onConfirm,
}: SaveConfirmModalProps) {
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("saveConfirm.title")}</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          {changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("saveConfirm.noChanges")}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {t("saveConfirm.changesIntro", { count: changes.length })}
              </p>
              <div className="rounded-md border divide-y max-h-64 overflow-y-auto">
                {changes.map((c, i) => (
                  // break-words: a value can be a long free-text field (a description, a country
                  // list). The builder already truncates, but an unbroken 120-character string
                  // would still push the dialog past the edge of a phone screen without this.
                  <div key={i} className="px-3 py-2 text-sm break-words">
                    <span className="font-medium">{c.label}:</span>{" "}
                    <span className="line-through text-muted-foreground">
                      {c.from || "-"}
                    </span>
                    {" → "}
                    <span className="text-foreground font-medium">
                      {c.to || "-"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t("saveConfirm.goBack")}
          </Button>
          <Button onClick={onConfirm} disabled={pendingSubmit}>
            {pendingSubmit ? (
              <Loader text={t("saveConfirm.saving")} />
            ) : (
              t("saveConfirm.confirmSave")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
