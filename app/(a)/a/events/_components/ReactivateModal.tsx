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
import { IconUserMinus } from "@tabler/icons-react";

export const ReactivateModal = ({
  competitor_id,
  event_id,
  name,
  onSuccess,
  redirectTo,
  showLabel = false,
}: {
  competitor_id: number;
  event_id: number;
  name: string;
  onSuccess?: () => void;
  redirectTo?: string;
  showLabel?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { token } = useAuth();
  const router = useRouter();

  const handleActivate = () => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/reactivate-registered-competitor/`,
          { competitor_id: competitor_id, event_id: event_id },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        toast.success(res.data.message || "Reactivated successfully");
        setOpen(false);

        if (redirectTo) {
          router.push(redirectTo);
        } else {
          onSuccess?.();
        }
      } catch (e: any) {
        toast.error(e.response?.data?.message || "Failed to reactivate");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={cn("flex-1", showLabel ? "" : "px-8")}>
          <IconUserMinus />

          {showLabel && <span className="ml-2">Reactivate</span>}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[400px]">
        <div className="text-center">
          <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-green-600" />
          </div>

          <DialogTitle className="text-xl">Reactivate competitor</DialogTitle>
          <DialogDescription className="mt-2 text-base">
            Are you sure you want to reactivate <b>"{name}"</b>?
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
            <Button
              className="flex-1"
              onClick={handleActivate}
              disabled={pending}
            >
              {pending ? (
                <Loader text="Reactivating..." />
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" /> Activate
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
