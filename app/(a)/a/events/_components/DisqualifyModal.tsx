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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "next-intl";

export const DisqualifyModal = ({
  competitor_id,
  event_id,
  name,
  onSuccess,
  redirectTo,
  showLabel = false,
  isTeam = false,
}: {
  competitor_id: number;
  event_id: number;
  name: string;
  onSuccess?: () => void;
  redirectTo?: string;
  showLabel?: boolean;
  // TEAM events use a DIFFERENT endpoint (owner 2026-06-22 bug: disqualify "failed" for teams).
  // For a team, `competitor_id` is the Team id, so route to /events/disqualify-team/ (which is also
  // organizer-gated). Solo keeps the registered-competitor endpoint (competitor_id = user id).
  isTeam?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  // Shared admin + organizer surface, so the copy lives in the events namespace beside the rest
  // of the event-management strings.
  const t = useTranslations("evEditTabs");
  const { token } = useAuth();
  const router = useRouter();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          isTeam
            ? `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/disqualify-team/`
            : `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/disqualify-registered-competitor/`,
          // The reason goes to BOTH endpoints. It is shown to the disqualified competitor, and
          // the backend refuses a blank one, so this is not decoration.
          isTeam
            ? { event_id: event_id, team_id: competitor_id, reason: reason.trim() }
            : {
                competitor_id: competitor_id,
                event_id: event_id,
                reason: reason.trim(),
              },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        toast.success(res.data.message || t("disqualify.toastDone"));
        setOpen(false);
        setReason("");

        if (redirectTo) {
          router.push(redirectTo);
        } else {
          onSuccess?.();
        }
      } catch (e: any) {
        toast.error(e.response?.data?.message || t("disqualify.toastFailed"));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <IconUserMinus />

          {showLabel && <span>{t("disqualify.trigger")}</span>}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[400px]">
        <div className="text-center">
          <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>

          <DialogTitle className="text-xl">{t("disqualify.title")}</DialogTitle>
          <DialogDescription className="mt-2 text-base">
            {t.rich("disqualify.confirm", {
              name: () => <b>{name}</b>,
            })}
          </DialogDescription>

          {/* REQUIRED (owner backlog item 35). The competitor is shown this sentence, so it is
              the difference between "you are out" and "you are out, and here is why". Left
              aligned inside a centred dialog because it is prose being typed, not a heading. */}
          <div className="mt-5 flex flex-col gap-2 text-left">
            <Label htmlFor="dq-reason">
              {t("disqualify.reasonLabel")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="dq-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("disqualify.reasonPlaceholder")}
            />
            <p className="text-muted-foreground text-xs">
              {t("disqualify.reasonHint")}
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("disqualify.cancel")}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDelete}
              // Blocked until a reason is typed. The backend refuses a blank one anyway; stopping
              // it here means the organizer is not told off after the fact.
              disabled={pending || !reason.trim()}
            >
              {pending ? (
                <Loader text={t("disqualify.pending")} />
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" /> {t("disqualify.confirmButton")}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
