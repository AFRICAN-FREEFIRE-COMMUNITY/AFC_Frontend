import { Loader } from "@/components/Loader";
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
          <DialogTitle>Confirm Save Changes</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          {changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No changes detected. Are you sure you want to save?
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                The following {changes.length} change
                {changes.length !== 1 ? "s" : ""} will be saved:
              </p>
              <div className="rounded-md border divide-y max-h-64 overflow-y-auto">
                {changes.map((c, i) => (
                  <div key={i} className="px-3 py-2 text-sm">
                    <span className="font-medium">{c.label}:</span>{" "}
                    <span className="line-through text-muted-foreground">
                      {c.from || "—"}
                    </span>
                    {" → "}
                    <span className="text-foreground font-medium">
                      {c.to || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Go Back
          </Button>
          <Button onClick={onConfirm} disabled={pendingSubmit}>
            {pendingSubmit ? <Loader text="Saving..." /> : "Confirm & Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
