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
import { IconBell } from "@tabler/icons-react";

export const SendNotificationModal = ({
  eventId,
  groupId,
  onSuccess,
}: {
  eventId: number | undefined;
  groupId: number | undefined;
  onSuccess?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { token } = useAuth();
  const router = useRouter();

  const handleSend = () => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/send-match-room-details-notification-to-competitor/`,
          { event_id: eventId, group_id: groupId },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        toast.success(res.data.message || "Notification sent successfully");
        setOpen(false);

        onSuccess?.();
      } catch (e: any) {
        toast.error(e.response?.data?.message || "Failed to send notification");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon">
          <IconBell />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[400px]">
        <div className="text-center">
          <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <IconBell className="h-7 w-7 text-green-600" />
          </div>

          <DialogTitle className="text-xl">Send notification</DialogTitle>
          <DialogDescription className="mt-2 text-base">
            Are you sure you want to send notification to every player?
          </DialogDescription>

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSend} disabled={pending}>
              {pending ? <Loader text="Sending..." /> : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
