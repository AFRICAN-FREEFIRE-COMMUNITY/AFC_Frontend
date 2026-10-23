"use client";

/**
 * AdminDeleteAccountDialog - a head admin deletes a player's account FOR them (inbox #59, owner
 * 2026-09-27: admins "could ... help users delete their accounts"; approved mockup
 * mockups/account-and-2fa, screen 4).
 *
 * WHAT IT DOES
 *   The same soft delete as the player's own "Delete my account" (hidden, signed out, name, email,
 *   UID and WhatsApp released, restorable from Teams & Players > Deleted accounts), with what the
 *   mockup shows: no password (the admin is not the player); the admin says HOW the player asked
 *   (ticket, email, Discord, WhatsApp, in person) with an optional ticket number or link, and WHY;
 *   an "email them" tick, on by default; the player's in-game name typed to confirm. The same
 *   blockers as the player's own button (in a team, owns a team or an organization, banned, staff)
 *   are read first and shown instead of the form, so nobody fills it in to be refused.
 *
 * HOW IT CONNECTS
 *   GET/POST auth/admin/users/<user_id>/delete-account/ (backend afc_auth/views_account_deletion.py
 *   admin_delete_account; head admins only, the same gate the button itself is shown behind:
 *   useCanRepairIdentity). Rendered by app/(a)/a/players/[id]/page.tsx beside Ban. On success the
 *   page goes to the Deleted accounts tab, where the restore lives.
 *   i18n: accountDeletion.adminDelete.* (messages/<loc>/accountDeletion.json), fr/pt by hand.
 * DESIGN: filled surfaces, no outlines; the confirm is the only red control.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import axios from "axios";
import { toast } from "sonner";

import { env } from "@/lib/env";
import { authHeaders } from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader } from "@/components/Loader";
import { NewBadge } from "@/components/NewBadge";

// Mirrors ADMIN_DELETE_CHANNELS in afc_auth/views_account_deletion.py
const CHANNELS = ["ticket", "email", "discord", "whatsapp", "in_person"] as const;
// Blocker codes from afc_auth/account_deletion.deletion_blockers, worded for the admin
const BLOCKERS = new Set([
  "account_suspended", "account_banned", "account_is_staff", "owns_team", "in_team",
  "owns_organization", "owns_sponsor", "owns_shop",
]);
const ERRORS = new Set(["channel_invalid", "reason_required", "confirm_mismatch"]);

type Blocker = { code: string; message: string };

export function AdminDeleteAccountDialog({ userId, username }: { userId: number; username: string }) {
  const t = useTranslations("accountDeletion");
  const router = useRouter();
  const endpoint = `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/admin/users/${userId}/delete-account/`;

  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [blockers, setBlockers] = useState<Blocker[] | null>(null);
  const [channel, setChannel] = useState<string>("ticket");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const blockerText = (b: Blocker) =>
    BLOCKERS.has(b.code) ? t(`adminDelete.blockers.${b.code}`) : b.message;

  async function openDialog() {
    setOpen(true);
    setChecking(true);
    setBlockers(null);
    setReason("");
    setReference("");
    setConfirm("");
    setNotify(true);
    try {
      const res = await axios.get(endpoint, { headers: authHeaders() });
      setBlockers(res.data.blockers ?? []);
    } catch {
      toast.error(t("adminDelete.loadFailed"));
      setOpen(false);
    } finally {
      setChecking(false);
    }
  }

  async function submit() {
    setBusy(true);
    try {
      await axios.post(
        endpoint,
        { channel, reference: reference.trim(), reason: reason.trim(), notify, confirm_username: confirm.trim() },
        { headers: authHeaders() },
      );
      toast.success(t("adminDelete.success", { username }));
      setOpen(false);
      router.push("/a/teams?tab=deleted");
    } catch (err) {
      const data = (err as { response?: { data?: { code?: string; message?: string; blockers?: Blocker[] } } })
        ?.response?.data;
      if (data?.code === "deletion_blocked" && data.blockers) setBlockers(data.blockers);
      else if (data?.code && ERRORS.has(data.code)) toast.error(t(`adminDelete.errors.${data.code}`));
      else toast.error(data?.message || t("deleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  const blocked = !!blockers && blockers.length > 0;
  const ready = !blocked && !!reason.trim() && confirm.trim() === username;

  return (
    <>
      <Button type="button" variant="destructive" onClick={openDialog} className="gap-2">
        {t("adminDelete.button")}
        <NewBadge since="2026-09-27" className="border-0 bg-white/20 text-white" />
      </Button>

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("adminDelete.title", { username })}</DialogTitle>
            <DialogDescription>{t("adminDelete.description")}</DialogDescription>
          </DialogHeader>

          {checking ? (
            <Loader text={t("dialog.checking")} />
          ) : blocked ? (
            <div className="rounded-md bg-gold/10 px-4 py-3 text-sm">
              <p className="font-semibold text-gold">{t("dialog.blockedTitle")}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {blockers!.map((b) => (
                  <li key={b.code}>{blockerText(b)}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5 rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                <p>{t("adminDelete.keeps")}</p>
                <p>{t("adminDelete.releases")}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adm-del-channel">{t("adminDelete.howLabel")}</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger id="adm-del-channel" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`adminDelete.channels.${c}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adm-del-ref">{t("adminDelete.refLabel")}</Label>
                <Input id="adm-del-ref" value={reference} maxLength={120}
                  placeholder={t("adminDelete.refPlaceholder")} onChange={(e) => setReference(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adm-del-reason">{t("adminDelete.reasonLabel")}</Label>
                <Textarea id="adm-del-reason" rows={2} value={reason} maxLength={400}
                  placeholder={t("adminDelete.reasonPlaceholder")} onChange={(e) => setReason(e.target.value)} />
                <p className="text-xs text-muted-foreground">{t("adminDelete.reasonHelp")}</p>
              </div>

              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} className="mt-0.5" />
                <span>{t("adminDelete.notify")}</span>
              </label>

              <div className="space-y-1.5">
                {/* normal-case: the labels are drawn uppercase, and the name has to be typed exactly as it is */}
                <Label htmlFor="adm-del-confirm" className="normal-case">{t("adminDelete.confirmLabel", { username })}</Label>
                <Input id="adm-del-confirm" name="adm-del-confirm" autoComplete="off" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              {t("adminDelete.cancel")}
            </Button>
            <Button type="button" variant="destructive" disabled={!ready || busy || checking} onClick={submit}>
              {busy ? t("dialog.deleting") : t("adminDelete.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
