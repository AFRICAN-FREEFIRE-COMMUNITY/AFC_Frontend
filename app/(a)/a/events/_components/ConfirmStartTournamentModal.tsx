"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useTransition } from "react";
// i18n: shared start-tournament confirm modal (admin + organizer event flows). Copy lives in the
// "evEditTabs" namespace (messages/{en,fr,pt}/evEditTabs.json).
import { useTranslations } from "next-intl";
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
  const t = useTranslations("evEditTabs");
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
          toast.success(res.data.message || t("confirmStart.toastStarted"));
        } else {
          const res = await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seed-solo-players-to-stage/`,
            { event_id: `${eventId}`, stage_id: `${stageId}` },
            { headers: { Authorization: `Bearer ${token}` } },
          );
          toast.success(res.data.message || t("confirmStart.toastStarted"));
        }

        setForceNotice(null);
        onClose?.();
        onSuccess?.();
      } catch (e: any) {
        const data = e.response?.data;
        if (e.response?.status === 400 && data?.requires_force) {
          // Keep the dialog open and show WHY, with an explicit Start-anyway path.
          setForceNotice(data.message || t("confirmStart.toastRegOpenFallback"));
        } else {
          toast.error(data?.message || t("confirmStart.toastFailed"));
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

          <DialogTitle className="text-xl">{t("confirmStart.title")}</DialogTitle>
          <DialogDescription className="mt-2 text-base">
            {/* t.rich embeds the bold event name inline so the sentence stays one translatable unit. */}
            {t.rich("confirmStart.body", {
              name: () => <b>&quot;{eventName}&quot;</b>,
            })}
          </DialogDescription>

          {isTeam && (
            <div className="flex items-center justify-between mt-4 p-3 rounded-lg bg-muted text-left">
              <div>
                <p className="text-sm font-medium">{t("confirmStart.clearExisting")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("confirmStart.clearExistingHelp")}
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
              <p className="text-sm font-medium text-amber-500">{t("confirmStart.regStillOpen")}</p>
              <p className="text-xs text-muted-foreground mt-1">{forceNotice}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("confirmStart.startAnywayHint")}
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
              {t("confirmStart.cancel")}
            </Button>
            <Button className="flex-1" onClick={() => handleStart(!!forceNotice)} disabled={pending}>
              {pending ? (
                <Loader text={t("confirmStart.starting")} />
              ) : (
                <>
                  <IconCheck className="h-4 w-4 mr-2" /> {t("confirmStart.startNow")}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
