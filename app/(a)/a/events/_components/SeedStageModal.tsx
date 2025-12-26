"use client";
import React from "react";
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
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seed Teams to Next Stage</DialogTitle>
          <DialogDescription>
            This will seed all qualified teams from{" "}
            <span className="font-medium">
              {activeGroup?.group_name || "this group"}
            </span>{" "}
            to the next stage.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pb-4">
          <div className="bg-primary/10 p-4 rounded-md border">
            <p className="text-sm font-medium">
              Qualified teams: {activeGroup?.teams_qualifying || 0}
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={pendingSeeding}
            onClick={() => onConfirm(activeGroup?.id)}
          >
            {pendingSeeding ? (
              <Loader text="Seeding..." />
            ) : (
              "Confirm & Send Notifications"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
