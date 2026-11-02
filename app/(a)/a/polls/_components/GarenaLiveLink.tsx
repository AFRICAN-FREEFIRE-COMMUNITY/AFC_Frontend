"use client";

/**
 * app/(a)/a/polls/_components/GarenaLiveLink.tsx
 *
 * Garena's private live link for one awards edition (inbox #457, owner 2 Nov 2026: "Private link, no
 * sign-in"; deck Revision 9 promises Garena "votes per nominee, live, hidden from the public").
 *
 * The link opens /awards/live/<token> (app/(user)/awards/live/[token]): votes per nominee with
 * country and region, refreshed every minute, no voter names and no flags. Whoever holds the link
 * can open it without an account, so the card says so, and an admin can REPLACE it (the old address
 * stops at once) or TURN IT OFF. Both ask first.
 *
 * TALKS TO lib/polls.ts adminCreateLiveLink + adminTurnOffLiveLink, which hit afc_polls/views.py
 * admin_edition_live_link. The current token arrives with the edition's metrics
 * (admin_edition_metrics `live_view_token`). Mounted by AwardsMetrics.tsx SeasonBallots.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { NewBadge } from "@/components/NewBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pollsApi, VOTE_TRACKING_LIVE_SINCE } from "@/lib/polls";

export function GarenaLiveLink({ editionSlug, initialToken }: { editionSlug: string; initialToken: string }) {
  const t = useTranslations("adminPolls");
  const [token, setToken] = useState(initialToken || "");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"replace" | "off" | null>(null);

  useEffect(() => setToken(initialToken || ""), [initialToken]);

  const address = token && typeof window !== "undefined" ? `${window.location.origin}/awards/live/${token}` : "";

  const run = async (kind: "create" | "replace" | "off") => {
    setBusy(true);
    try {
      const result = kind === "off"
        ? await pollsApi.adminTurnOffLiveLink(editionSlug)
        : await pollsApi.adminCreateLiveLink(editionSlug);
      setToken(result.live_view_token || "");
      toast.success(t(`live.done.${kind}`));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("live.failed"));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success(t("live.copied"));
    } catch {
      toast.error(t("live.failed"));
    }
  };

  return (
    <Card className="bg-card rounded-md py-4 shadow-sm">
      <CardContent className="space-y-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
          {t("live.title")}
          <NewBadge since={VOTE_TRACKING_LIVE_SINCE} />
        </h3>
        <p className="text-xs text-muted-foreground">{t("live.intro")}</p>
        {token ? (
          <>
            <p className="break-all rounded-md bg-muted/40 p-3 font-mono text-xs text-foreground">{address}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={copy} disabled={busy}>
                {t("live.copy")}
              </Button>
              <Button size="sm" variant="secondary" asChild>
                <a href={address} target="_blank" rel="noopener noreferrer">
                  {t("live.open")}
                </a>
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirm("replace")} disabled={busy}>
                {t("live.replace")}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setConfirm("off")} disabled={busy}>
                {t("live.turnOff")}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-muted-foreground">{t("live.off")}</p>
            <Button size="sm" onClick={() => run("create")} disabled={busy}>
              {t("live.create")}
            </Button>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "off" ? t("live.offTitle") : t("live.replaceTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{confirm === "off" ? t("live.offBody") : t("live.replaceBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("live.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && run(confirm)} disabled={busy}>
              {t("live.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
