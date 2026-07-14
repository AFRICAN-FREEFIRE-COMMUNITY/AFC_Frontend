"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
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
  // i18n: shares the `pmPost` namespace with the parent page (page.tsx).
  const t = useTranslations("pmPost");
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
          toast.success(
            t("apply.success", { team: teamName ?? t("apply.teamFallback") }),
          );
          setApplied(true);
        } catch (error: any) {
          toast.error(
            error?.response?.data?.message || t("apply.error"),
          );
        }
      });
    });
  };

  if (applied) {
    return (
      <Button disabled className="flex-1">
        {t("apply.sent")}
      </Button>
    );
  }

  return (
    <span className="flex flex-1 items-center gap-1.5">
      <Button onClick={handleApply} disabled={isPending} className="flex-1">
        {isPending ? t("apply.applying") : t("apply.cta")}
      </Button>
      <InfoTip id="player_market.apply" />
    </span>
  );
}
