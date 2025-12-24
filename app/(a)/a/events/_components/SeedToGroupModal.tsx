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
import { IconPlayerPlay } from "@tabler/icons-react";

export const SeedToGroupModal = ({
  stageId,
  onSuccess,
}: {
  stageId: number | undefined;
  onSuccess?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { token } = useAuth();
  const router = useRouter();

  const handleSeed = () => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seed-stage-competitors-to-groups/`,
          { stage_id: stageId },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        toast.success(res.data.message || "Stage seeded successfully");
        setOpen(false);

        onSuccess?.();
      } catch (e: any) {
        toast.error(
          e.response?.data?.message || "Failed to seed stage to groups"
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex-1" variant="outline" size="md">
          <IconPlayerPlay />
          Seed to groups
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[400px]">
        <div className="text-center">
          <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-green-600" />
          </div>

          <DialogTitle className="text-xl">Seed to Groups?</DialogTitle>
          <DialogDescription className="mt-2 text-base">
            Are you sure you want to seed competitors to group now?
          </DialogDescription>

          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSeed} disabled={pending}>
              {pending ? (
                <Loader text="Seeding..." />
              ) : (
                <>
                  <IconPlayerPlay /> Seed
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
