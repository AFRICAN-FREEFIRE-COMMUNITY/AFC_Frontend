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

export const DeleteEventModal = ({
  eventId,
  eventName,
  onSuccess,
  redirectTo,
  showLabel = false,
  isIcon,
}: {
  eventId: number;
  eventName: string;
  onSuccess?: () => void;
  redirectTo?: string;
  showLabel?: boolean;
  isIcon?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { token } = useAuth();
  const router = useRouter();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/delete-event/`,
          { event_id: eventId },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        toast.success(res.data.message || "Event deleted successfully");
        setOpen(false);
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          onSuccess?.();
        }
      } catch (e: any) {
        toast.error(e.response?.data?.message || "Failed to delete event");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          // className={cn("h-full", !isIcon && "flex-1", showLabel ? "" : "px-8")}
          // size={isIcon ? "icon" : "default"}
        >
          <Trash2 />
          {showLabel && <>Delete Event</>}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <div className="text-center">
          <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <DialogTitle className="text-xl">Delete Event</DialogTitle>
          <DialogDescription className="mt-2 text-base">
            Are you sure you want to delete <b>"{eventName}"</b>?
          </DialogDescription>
          <p className="text-sm text-muted-foreground mt-4">
            This action cannot be undone. The event, all registrations, stages,
            groups, and related data will be permanently removed.
          </p>
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending ? (
                <Loader text="Deleting..." />
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
