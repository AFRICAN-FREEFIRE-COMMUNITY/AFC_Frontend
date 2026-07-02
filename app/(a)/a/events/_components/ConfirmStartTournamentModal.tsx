"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
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
import { IconCheck } from "@tabler/icons-react";

export const ConfirmStartTournamentModal = ({
  eventId,
  eventName,
  onSuccess,
  open,
  onClose,
  stageId,
  participantType,
}: {
  eventName: string;
  eventId: number;
  stageId: number;
  onSuccess?: () => void;
  onClose?: () => void;
  open?: boolean;
  participantType?: string;
}) => {
  const [pending, startTransition] = useTransition();
  const [clearExisting, setClearExisting] = useState(false);
  // Registration-still-open override (owner 2026-07-02): the seed endpoint 400s with
  // requires_force when registration has not closed yet. We show the reason IN the dialog
  // (a toast alone vanished before people read it) and offer an explicit "Start anyway".
  const [forceNotice, setForceNotice] = useState<string | null>(null);
  const { token } = useAuth();

  const isTeam = participantType !== "solo";

  const handleStart = (forceBeforeRegEnd = false) => {
    startTransition(async () => {
      try {
        if (isTeam) {
          const res = await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seed-event-competitors-to-stage/`,
            {
              stage_id: `${stageId}`,
              clear_existing: clearExisting,
              // Explicit acknowledgement that registration is still open (see forceNotice).
              ...(forceBeforeRegEnd ? { force_before_registration_end: true } : {}),
            },
            { headers: { Authorization: `Bearer ${token}` } },
          );
          toast.success(res.data.message || "Tournament started successfully");
        } else {
          const res = await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seed-solo-players-to-stage/`,
            { event_id: `${eventId}`, stage_id: `${stageId}` },
            { headers: { Authorization: `Bearer ${token}` } },
          );
          toast.success(res.data.message || "Tournament started successfully");
        }

        setForceNotice(null);
        onClose?.();
        onSuccess?.();
      } catch (e: any) {
        const data = e.response?.data;
        if (e.response?.status === 400 && data?.requires_force) {
          // Keep the dialog open and show WHY, with an explicit Start-anyway path.
          setForceNotice(data.message || "Registration is still open for this event.");
        } else {
          toast.error(data?.message || "Failed to start");
        }
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <div className="text-center">
          <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-green-600" />
          </div>

          <DialogTitle className="text-xl">Start this tournament?</DialogTitle>
          <DialogDescription className="mt-2 text-base">
            Are you sure you want to start <b>"{eventName}"</b>?
          </DialogDescription>

          {isTeam && (
            <div className="flex items-center justify-between mt-4 p-3 rounded-lg bg-muted text-left">
              <div>
                <p className="text-sm font-medium">Clear existing seeding</p>
                <p className="text-xs text-muted-foreground">
                  Remove any existing stage seeds before starting
                </p>
              </div>
              <Switch
                checked={clearExisting}
                onCheckedChange={setClearExisting}
              />
            </div>
          )}

          {forceNotice && (
            <div className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-left">
              <p className="text-sm font-medium text-amber-500">Registration is still open</p>
              <p className="text-xs text-muted-foreground mt-1">{forceNotice}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use "Start anyway" to begin with the competitors registered so far.
              </p>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={() => handleStart(!!forceNotice)} disabled={pending}>
              {pending ? (
                <Loader text="Starting..." />
              ) : (
                <>
                  <IconCheck className="h-4 w-4 mr-2" /> Start now
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
