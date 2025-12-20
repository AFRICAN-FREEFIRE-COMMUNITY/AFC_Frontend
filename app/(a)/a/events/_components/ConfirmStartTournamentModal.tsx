"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/Loader";
import { Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconCheck, IconUserMinus } from "@tabler/icons-react";

export const ConfirmStartTournamentModal = ({
  eventId,
  eventName,
  onSuccess,
  open,
  onClose,
  stageId,
}: {
  eventName: string;
  eventId: number;
  stageId: number;
  onSuccess?: () => void;
  onClose?: () => void;
  open?: boolean;
}) => {
  const [pending, startTransition] = useTransition();
  const { token } = useAuth();
  const router = useRouter();

  console.log(eventId, stageId);

  const handleStart = () => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seed-solo-players-to-stage/`,
          { event_id: `${eventId}`, stage_id: `${stageId}` },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        toast.success(res.data.message || "Tournament started successfully");
        onClose?.();
        onSuccess?.();
      } catch (e: any) {
        toast.error(e.response?.data?.message || "Failed to start");
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
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleStart} disabled={pending}>
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
