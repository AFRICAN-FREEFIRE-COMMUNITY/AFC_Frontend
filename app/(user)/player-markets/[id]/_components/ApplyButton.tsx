"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/components/AuthModal";
import axios from "axios";

interface ApplyButtonProps {
  postId: number;
  teamName: string | null;
}

export default function ApplyButton({ postId, teamName }: ApplyButtonProps) {
  const { token } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [applied, setApplied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const requireAuth = (action: () => void) => {
    if (!token) {
      openAuthModal({ defaultTab: "login", onSuccess: action });
      return;
    }
    action();
  };

  const handleApply = () => {
    requireAuth(() => {
      startTransition(async () => {
        try {
          await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/apply-to-team/`,
            { post_id: String(postId) },
            { headers: { Authorization: `Bearer ${token}` } },
          );
          toast.success(`Application sent to ${teamName ?? "team"}!`);
          setApplied(true);
        } catch (error: any) {
          toast.error(
            error?.response?.data?.message || "Failed to send application.",
          );
        }
      });
    });
  };

  if (applied) {
    return (
      <Button disabled className="flex-1">
        Application Sent
      </Button>
    );
  }

  return (
    <Button onClick={handleApply} disabled={isPending} className="flex-1">
      {isPending ? "Applying..." : "Apply to This Team"}
    </Button>
  );
}
