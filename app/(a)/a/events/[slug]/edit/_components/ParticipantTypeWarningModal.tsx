import { AlertTriangle } from "lucide-react";
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
            Change Participant Type?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            You are changing the participant type from{" "}
            <span className="font-semibold capitalize text-foreground">
              {currentType}
            </span>{" "}
            to{" "}
            <span className="font-semibold capitalize text-foreground">
              {pendingType}
            </span>
            .
          </p>
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <strong>Warning:</strong> All currently registered{" "}
            {participantLabel}{" "}
            will be <strong>automatically removed</strong> from this event when
            you save. This action cannot be undone.
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (pendingType) {
                onConfirm(pendingType);
              }
            }}
          >
            Yes, Change Type
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
