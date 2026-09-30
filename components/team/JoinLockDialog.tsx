// components/team/JoinLockDialog.tsx
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The warning a player gets BEFORE they commit to a team while the transfer window is shut (owner
// 2026-09-30, inbox #92): "People should be able to create and join teams even inside transfer
// windows, they just can't leave a team, and tell them when they are about to join a team that
// they won't be able to leave until the transfer window ends and when it is supposed to end."
//
// HOW A CALLER USES IT
//   const { confirmJoin, joinLockDialog } = useJoinLockConfirm();
//   ...
//   if (!(await confirmJoin("join", team.team_name))) return;   // before the POST
//   ...
//   {joinLockDialog}                                              // once, anywhere in the JSX
// confirmJoin resolves true straight away when the window is open (no dialog at all), and waits
// for the player's answer when it is shut. The kinds change only the wording:
//   join     POST team/join-team/          app/(user)/teams/[id]/page.tsx
//   request  POST team/send-join-request/  app/(user)/teams/page.tsx, app/(user)/teams/[id]/page.tsx
//   invite   POST team/respond-invite/     app/(root)/invite/_components/TeamInviteClient.tsx
//   create   POST team/create-team/        app/(user)/teams/create/page.tsx
//
// Nothing here is enforcement: the backend never locked joining and still does not. The lock on
// LEAVING lives in afc_team/views.py (exit_team, kick_team_member, disband_team, roster moves), and
// the date comes from lib/useTransferLock.ts, the same source as the OPEN / CLOSED banner.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconLock } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

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
import { formatLocalDateOnly } from "@/lib/i18n/time";
import { useTransferLock } from "@/lib/useTransferLock";

export type JoinKind = "join" | "request" | "invite" | "create";

// How long a click may wait for the season to arrive before deciding. The season request is one
// small GET that is normally back long before anybody clicks; this only covers a very fast click
// on a slow connection. Past it, the action goes ahead without a warning rather than hanging,
// because joining is allowed either way and the server still refuses the LEAVE.
const SEASON_WAIT_MS = 4000;

export function useJoinLockConfirm() {
  const t = useTranslations("transferWindow");
  const lock = useTransferLock();
  // A ref, so the promise returned by confirmJoin reads the latest lock after the season lands.
  const lockRef = useRef(lock);
  lockRef.current = lock;

  // `open` is separate from the wording so the dialog keeps its own words while it fades out,
  // instead of flipping to the default kind for the length of the closing animation.
  const [pending, setPending] = useState<{ kind: JoinKind; team: string; open: boolean } | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  // Never leave a caller waiting forever if the component unmounts with the dialog open.
  useEffect(() => () => resolverRef.current?.(false), []);

  const confirmJoin = useCallback(async (kind: JoinKind, team: string): Promise<boolean> => {
    const started = Date.now();
    while (!lockRef.current.loaded && Date.now() - started < SEASON_WAIT_MS) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!lockRef.current.locked) return true;
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPending({ kind, team, open: true });
    });
  }, []);

  const answer = (ok: boolean) => {
    resolverRef.current?.(ok);
    resolverRef.current = null;
    setPending((p) => (p ? { ...p, open: false } : p));
  };

  const date = lock.freeFrom ? formatLocalDateOnly(lock.freeFrom) || lock.freeFrom : null;
  const kind = pending?.kind ?? "join";
  const team = pending?.team ?? "";

  const joinLockDialog = (
    <AlertDialog open={!!pending?.open} onOpenChange={(open) => !open && answer(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {/* Icon above the title on a phone (the header is centred there), beside it from sm up. */}
          <AlertDialogTitle className="flex flex-col items-center gap-2 sm:flex-row">
            <IconLock className="size-5 shrink-0 text-destructive" aria-hidden />
            {t("joinWarning.title")}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>{t(`joinWarning.body.${kind}`, { team })}</p>
              <p className="font-medium text-foreground">
                {date ? t("joinWarning.until", { date }) : t("joinWarning.untilUnknown")}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => answer(false)}>{t("joinWarning.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => answer(true)}>{t(`joinWarning.confirm.${kind}`)}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirmJoin, joinLockDialog, lock };
}
