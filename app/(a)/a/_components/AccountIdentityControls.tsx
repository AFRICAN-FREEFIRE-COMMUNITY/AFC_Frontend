"use client";

// ── Admin identity repair controls (owner 2026-08-07) ────────────────────────────────────────────
// Two dialogs a HEAD ADMIN / SUPER ADMIN uses on the player-detail page to fix what a player cannot
// fix themselves:
//   • EditUidDialog   -> POST /auth/admin/set-user-uid/     edit or clear the Free Fire UID
//   • EditEmailDialog -> POST /auth/admin/set-user-email/   move a locked-out account to a live address
// Both read their opening state from GET /auth/admin/user-identity/<user_id>/ via the
// useAccountIdentity hook below, so the dialogs show the CURRENT UID/email, whether the account has
// two-factor on, whether the player is mid-event, and how many sessions a change would end.
//
// Backend: afc_auth/views_admin_identity.py. Every endpoint there is gated by require_head_admin, so
// the role check in this file is a UI courtesy, NOT the security boundary: a support or moderator
// account that reaches these controls some other way is still refused a 403 by the server.
//
// Both writes demand a typed REASON, which is what lets the admin History page (AuditLog) answer
// "who changed this person's email, and why". The reason box is therefore not optional here either.
//
// i18n: namespace `adminIdentity` (messages/en|fr|pt/adminIdentity.json).
// Consumed by: app/(a)/a/players/[id]/page.tsx.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState, useTransition } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AlertTriangle, Fingerprint, Mail, ShieldAlert, Trash2 } from "lucide-react";

import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/Loader";
import { Textarea } from "@/components/ui/textarea";

// The shape GET /auth/admin/user-identity/<user_id>/ returns. Mirrors the response documented on
// afc_auth/views_admin_identity.py::admin_user_identity.
export interface AccountIdentity {
  user_id: number;
  username: string;
  email: string;
  uid: string;
  /** Canonical country name as stored on the account, "" when never set. */
  country: string;
  /** MASKED ("+234 ***** 4567"), never the dialable number. The endpoint never sends the raw one. */
  whatsapp_number: string;
  /** Whether a number is on file at all, so a dialog can offer Remove without unmasking anything. */
  has_whatsapp_number: boolean;
  is_active: boolean;
  two_factor_enabled: boolean;
  active_sessions: number;
  identity_locked: boolean;
  is_super_admin: boolean;
}

/**
 * True only for a head admin or super admin - the two roles the backend gate
 * (views.require_head_admin) allows. Anything else must not even see the controls, so the page
 * renders nothing rather than a button that would 403.
 */
export const useCanRepairIdentity = () => {
  const { hasAnyRole } = useAuth();
  return hasAnyRole(["head_admin", "super_admin"]);
};

/**
 * Loads the identity state the dialogs open onto, and hands back a refetch so a successful write
 * refreshes it (a stale two_factor_enabled or session count would make the next dialog lie).
 * Skipped entirely when the viewer is not allowed, so no 403 is ever fired at the server.
 */
export const useAccountIdentity = (userId: number | string, enabled: boolean) => {
  const { token } = useAuth();
  const [identity, setIdentity] = useState<AccountIdentity | null>(null);
  const t = useTranslations("adminIdentity");

  const refresh = useCallback(async () => {
    if (!enabled || !token) return;
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/admin/user-identity/${userId}/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setIdentity(res.data);
    } catch {
      // Non-fatal: the rest of the player page still works, the dialogs just stay closed.
      toast.error(t("loadFailed"));
    }
  }, [enabled, token, userId, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { identity, refresh };
};

// A short "what this does" bullet inside a dialog. Same muted list treatment the other admin
// dialogs use for consequences. Exported for AccountIdentityMore.tsx (the name / country /
// WhatsApp dialogs), so all five controls state their consequences in one voice.
export const Consequence = ({ children }: { children: React.ReactNode }) => (
  <li className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
    <span aria-hidden className="text-primary">
      &bull;
    </span>
    <span>{children}</span>
  </li>
);

// The mandatory reason field, shared by every dialog (here and in AccountIdentityMore.tsx) so the
// copy and the rule stay identical: no repair on this gate happens without a typed reason.
export const ReasonField = ({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) => {
  const t = useTranslations("adminIdentity");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{t("reason.label")}</Label>
      <Textarea
        id={id}
        rows={2}
        className="min-h-16"
        placeholder={t("reason.placeholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">{t("reason.hint")}</p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Free Fire UID: edit or remove
// ─────────────────────────────────────────────────────────────────────────────────────────────────
export const EditUidDialog = ({
  playerName,
  identity,
  onSuccess,
}: {
  playerName: string;
  identity: AccountIdentity;
  onSuccess: () => void;
}) => {
  const t = useTranslations("adminIdentity");
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [uid, setUid] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  // Seed the input with the UID on file each time the dialog opens, so the admin edits the real
  // value instead of typing one from memory.
  useEffect(() => {
    if (open) {
      setUid(identity.uid || "");
      setReason("");
      setConfirmingRemove(false);
    }
  }, [open, identity.uid]);

  // `remove` sends an EMPTY uid, which is how the endpoint distinguishes "clear it" from "change
  // it". The key is always present: the backend refuses an absent uid rather than guessing.
  const submit = (remove: boolean) => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/admin/set-user-uid/`,
          {
            user_id: identity.user_id,
            uid: remove ? "" : uid.trim(),
            reason: reason.trim(),
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success(res.data.message);
        setOpen(false);
        onSuccess();
      } catch (e: any) {
        toast.error(
          e.response?.data?.message || e.response?.data?.error || t("uid.failed"),
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Fingerprint className="h-4 w-4 mr-2" /> {t("uid.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px] max-h-[85vh] overflow-y-auto">
        <DialogTitle className="text-lg">{t("uid.title")}</DialogTitle>
        <DialogDescription className="mt-1">
          {t("uid.description", { name: playerName })}
        </DialogDescription>

        {/* Mid-event warning. The player's own edits are frozen here (the identity lock); an admin
            is the escape hatch, so this explains the cost rather than blocking. */}
        {identity.identity_locked && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {t("uid.lockedTitle")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("uid.lockedBody")}</p>
          </div>
        )}

        {confirmingRemove ? (
          // Removal is destructive and frees a unique value, so it gets its own confirm step
          // spelling out what the player loses.
          <div className="space-y-3">
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
              <p className="text-xs font-medium text-destructive">{t("uid.removeTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("uid.removeBody", { name: playerName, uid: identity.uid || "-" })}
              </p>
            </div>
            <ReasonField id="uid-remove-reason" value={reason} onChange={setReason} />
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() => setConfirmingRemove(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={pending || !reason.trim()}
                onClick={() => submit(true)}
              >
                {pending ? <Loader text={t("uid.removing")} /> : t("uid.removeConfirm")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("uid.current")}</Label>
              <p className="text-sm">{identity.uid || t("uid.none")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-new-uid">{t("uid.new")}</Label>
              <Input
                id="admin-new-uid"
                // inputMode numeric so a phone opens the number pad; the backend is the real check.
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={15}
                placeholder={t("uid.placeholder")}
                value={uid}
                onChange={(e) => setUid(e.target.value.replace(/\D/g, ""))}
              />
              <p className="text-xs text-muted-foreground">{t("uid.hint")}</p>
            </div>
            <ReasonField id="uid-reason" value={reason} onChange={setReason} />
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              {identity.uid ? (
                <Button
                  variant="outline"
                  className="flex-1 text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={() => setConfirmingRemove(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> {t("uid.remove")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                >
                  {t("cancel")}
                </Button>
              )}
              <Button
                className="flex-1"
                disabled={pending || !uid.trim() || !reason.trim()}
                onClick={() => submit(false)}
              >
                {pending ? <Loader text={t("uid.saving")} /> : t("uid.save")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Account email: the takeover primitive, so the dialog states the cost before it lets you save
// ─────────────────────────────────────────────────────────────────────────────────────────────────
export const EditEmailDialog = ({
  playerName,
  identity,
  onSuccess,
}: {
  playerName: string;
  identity: AccountIdentity;
  onSuccess: () => void;
}) => {
  const t = useTranslations("adminIdentity");
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [reason, setReason] = useState("");
  // Mirrors the backend's disable_two_factor flag. The server refuses with 409 without it when the
  // account has 2FA on, so this checkbox is the admin consciously taking the factor down.
  const [ackTwoFactor, setAckTwoFactor] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setNewEmail("");
      setReason("");
      setAckTwoFactor(false);
    }
  }, [open]);

  const submit = () => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/admin/set-user-email/`,
          {
            user_id: identity.user_id,
            new_email: newEmail.trim(),
            reason: reason.trim(),
            disable_two_factor: ackTwoFactor,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success(res.data.message);
        setOpen(false);
        onSuccess();
      } catch (e: any) {
        toast.error(
          e.response?.data?.message || e.response?.data?.error || t("email.failed"),
        );
      }
    });
  };

  const blocked =
    pending || !newEmail.trim() || !reason.trim() ||
    (identity.two_factor_enabled && !ackTwoFactor);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail className="h-4 w-4 mr-2" /> {t("email.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px] max-h-[85vh] overflow-y-auto">
        <DialogTitle className="text-lg">{t("email.title")}</DialogTitle>
        <DialogDescription className="mt-1">
          {t("email.description", { name: playerName })}
        </DialogDescription>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("email.current")}</Label>
            <p className="text-sm break-all">{identity.email || "-"}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-new-email">{t("email.new")}</Label>
            <Input
              id="admin-new-email"
              type="email"
              placeholder={t("email.placeholder")}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>

          {/* Everything this change does, said before it happens. The session count is live from
              the identity endpoint, so it is a real number and not a generic warning. */}
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-xs font-medium">{t("email.consequencesTitle")}</p>
            <ul className="mt-1.5 space-y-1">
              <Consequence>{t("email.consequenceSignIn")}</Consequence>
              <Consequence>
                {t("email.consequenceSessions", { count: identity.active_sessions })}
              </Consequence>
              {!identity.is_active && (
                <Consequence>{t("email.consequenceReactivate")}</Consequence>
              )}
              <Consequence>{t("email.consequenceNotice")}</Consequence>
            </ul>
          </div>

          {/* 2FA acknowledgement. Only rendered when the account really has it on; without the tick
              the backend answers 409 and nothing is written. */}
          {identity.two_factor_enabled && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {t("email.twoFactorTitle")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t("email.twoFactorBody")}</p>
              <label className="mt-2.5 flex items-start gap-2 cursor-pointer">
                <Checkbox
                  id="admin-2fa-ack"
                  className="mt-0.5"
                  checked={ackTwoFactor}
                  onCheckedChange={(v) => setAckTwoFactor(v === true)}
                />
                <span className="text-xs font-medium">{t("email.twoFactorConfirm")}</span>
              </label>
            </div>
          )}

          <ReasonField id="email-reason" value={reason} onChange={setReason} />

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button className="flex-1" onClick={submit} disabled={blocked}>
              {pending ? <Loader text={t("email.saving")} /> : t("email.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
