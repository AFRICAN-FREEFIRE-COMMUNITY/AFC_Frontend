"use client";

/**
 * DeleteAccountCard - "Delete my account", at the bottom of /profile/security.
 *
 * Owner 2026-09-14 (inbox #20): "let there be an option for AFC accounts to be deleted, users
 * can delete their accounts, of course its to be soft deleted, head admins should be able to
 * restore it back and a new user will be able to use some info from that account."
 *
 * WHAT THE PERSON SEES
 *   A plain card that says what deletion does (hidden, signed out, name and email released,
 *   restorable by a head admin) and one button. The dialog it opens reads the preflight first
 *   (lib/accountDeletion.getDeletionPreflight): if something must be settled first (a team, an
 *   organization, a ban, a staff role) it says so by code and the confirm button stays off, so
 *   nobody types a password to be told "leave your team first". Otherwise: the in-game name
 *   typed exactly, the password when the account has one (a Google or Discord signup does not),
 *   an optional reason, then Delete. On success every session is dead, so this signs out here
 *   too (AuthContext.logout) and lands on the home page with the toast.
 *
 * HOW IT CONNECTS
 *   POST /auth/delete-account/ (afc_auth/views_account_deletion.py). The refusal codes
 *   (confirm_mismatch, password_wrong, password_required, deletion_blocked + blocker codes) map
 *   to sentences in messages/<loc>/accountDeletion.json. Mounted by app/(user)/profile/security/
 *   page.tsx under TwoFactorSecurity.
 *
 * DESIGN: filled surfaces, no strokes; the destructive button is the only red on the page; NEW
 * tag beside the heading, self-expiring.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconUserMinus, IconAlertTriangle } from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { NewBadge } from "@/components/NewBadge";
import { useAuth } from "@/contexts/AuthContext";
import {
  deleteMyAccount, getDeletionPreflight, type DeletionPreflight,
} from "@/lib/accountDeletion";

// The blocker codes the backend can send (afc_auth/account_deletion.deletion_blockers). Anything
// newer falls back to the sentence the server sent.
const BLOCKER_KEYS = new Set([
  "account_suspended", "account_banned", "account_is_staff", "owns_team", "in_team",
  "owns_organization", "owns_sponsor", "owns_shop",
]);

export function DeleteAccountCard() {
  const t = useTranslations("accountDeletion");
  const router = useRouter();
  const { logout } = useAuth();

  const [open, setOpen] = useState(false);
  const [preflight, setPreflight] = useState<DeletionPreflight | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Read what stands in the way each time the dialog opens: the answer changes the moment the
  // person leaves their team in another tab.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPreflight(await getDeletionPreflight());
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("preflightFailed"));
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    setConfirm("");
    setPassword("");
    setReason("");
    load();
  }, [open, load]);

  const blockerText = (code: string, fallback: string) =>
    BLOCKER_KEYS.has(code) ? t(`blockers.${code}`) : fallback;

  const canSubmit = !!preflight?.can_delete
    && confirm.trim() === preflight.username
    && (!preflight.needs_password || password.length > 0)
    && !busy;

  const submit = async () => {
    if (!preflight || !canSubmit) return;
    setBusy(true);
    try {
      await deleteMyAccount({
        confirm_username: confirm.trim(),
        password: preflight.needs_password ? password : undefined,
        reason: reason.trim() || undefined,
      });
      setOpen(false);
      toast.success(t("deletedToast"));
      logout();
      router.replace("/");
    } catch (err: any) {
      const data = err?.response?.data;
      const code: string | undefined = data?.code;
      if (code === "deletion_blocked" && Array.isArray(data?.blockers)) {
        setPreflight((prev) => prev ? { ...prev, can_delete: false, blockers: data.blockers } : prev);
      }
      const known = code && ["confirm_mismatch", "password_wrong", "password_required"].includes(code)
        ? t(`errors.${code}`)
        : null;
      toast.error(known || data?.message || t("deleteFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto pb-6">
      <Card className="mt-4">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-destructive/10">
            <IconUserMinus className="size-5 text-destructive" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{t("card.title")}</h3>
              <NewBadge since="2026-09-17" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t("card.body")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("card.restore")}</p>
          </div>
          <Button type="button" variant="destructive" className="w-full sm:w-auto"
            onClick={() => setOpen(true)} data-testid="delete-account-open">
            {t("card.button")}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dialog.title")}</DialogTitle>
            <DialogDescription>{t("dialog.description")}</DialogDescription>
          </DialogHeader>

          {loading || !preflight ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("dialog.checking")}</p>
          ) : !preflight.can_delete ? (
            // Something must be settled first. Say what, by code, and offer nothing else.
            <div className="flex flex-col gap-2 rounded-md bg-muted p-3" data-testid="delete-blockers">
              <p className="flex items-center gap-2 text-sm font-medium">
                <IconAlertTriangle className="size-4 shrink-0 text-orange-500" />
                {t("dialog.blockedTitle")}
              </p>
              <ul className="space-y-1 pl-6 text-sm text-muted-foreground">
                {preflight.blockers.map((b) => (
                  <li key={b.code}>{blockerText(b.code, b.message)}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                <p>{t("dialog.keeps")}</p>
                <p className="mt-1">{t("dialog.releases")}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="delete-confirm">
                  {t("dialog.confirmLabel", { username: preflight.username })}
                </Label>
                <Input id="delete-confirm" autoComplete="off" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} placeholder={preflight.username} />
              </div>
              {preflight.needs_password && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="delete-password">{t("dialog.passwordLabel")}</Label>
                  <Input id="delete-password" type="password" autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="delete-reason">{t("dialog.reasonLabel")}</Label>
                <Textarea id="delete-reason" rows={2} maxLength={500} value={reason}
                  onChange={(e) => setReason(e.target.value)} placeholder={t("dialog.reasonPlaceholder")} />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {t("dialog.cancel")}
            </Button>
            {preflight?.can_delete && (
              <Button type="button" variant="destructive" onClick={submit} disabled={!canSubmit}
                data-testid="delete-account-confirm">
                {busy ? t("dialog.deleting") : t("dialog.confirm")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
