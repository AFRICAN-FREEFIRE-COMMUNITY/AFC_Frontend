"use client";

import { useFormContext } from "react-hook-form";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Remove Stage?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to remove this stage?
          </p>

          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive font-medium">
              ⚠️ This action cannot be undone
            </p>
            <ul className="text-xs text-muted-foreground mt-2 space-y-1 ml-4 list-disc">
              <li>All groups in this stage will be removed</li>
              <li>All match data will be lost</li>
              <li>Stage order will be updated automatically</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remove Stage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
