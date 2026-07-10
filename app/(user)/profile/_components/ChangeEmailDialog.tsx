"use client";

/**
 * ChangeEmailDialog - self-serve "fix my email" flow (owner 2026-07-09, bug #1).
 *
 * WHY IT EXISTS: early users signed up with a wrong/forgotten email. Email used to be freely editable
 * on the profile form with NO re-auth (an account-takeover hole), so it is now read-only there and can
 * change ONLY through this verified two-step dialog:
 *   Step 1 (request): the user re-confirms identity with their CURRENT password + the OLD email on
 *     file, and enters a NEW email  ->  POST /auth/request-email-change/  ->  a 6-digit code is emailed
 *     to the NEW address (proof of ownership, so a typo can't re-lock them out).
 *   Step 2 (confirm): the user enters that code  ->  POST /auth/confirm-email-change/  ->  the account
 *     email switches and both the old + new addresses get a confirmation.
 *
 * HOW IT CONNECTS: rendered on the profile edit page (app/(user)/profile/edit/page.tsx) beside the now
 * read-only email field. Uses the same axios + Bearer-token pattern as that page's save, and calls
 * AuthContext.login(token) on success so the displayed email refreshes immediately (get-user-profile).
 * Locked-out users who can't log in at all are recovered separately by an admin (admin_set_user_email,
 * surfaced on the admin player-detail page). i18n: `profile` namespace, edit.changeEmail.* keys.
 */
import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ChangeEmailDialog() {
  const t = useTranslations("profile");
  const { token, login } = useAuth();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [submitting, setSubmitting] = useState(false);

  // Step 1 fields
  const [oldEmail, setOldEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  // Step 2 field
  const [code, setCode] = useState("");

  const reset = () => {
    setStep("request");
    setSubmitting(false);
    setOldEmail("");
    setNewEmail("");
    setPassword("");
    setCode("");
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const errMessage = (err: any) =>
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    t("edit.changeEmail.genericError");

  // Step 1 -> request a code to the NEW address.
  const requestChange = async () => {
    setSubmitting(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/request-email-change/`,
        { old_email: oldEmail, new_email: newEmail, current_password: password },
        authHeaders,
      );
      toast.success(t("edit.changeEmail.successRequest"));
      setStep("confirm");
    } catch (err: any) {
      toast.error(errMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2 -> confirm the code, then refresh the session so the new email shows immediately.
  const confirmChange = async () => {
    setSubmitting(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/confirm-email-change/`,
        { token: code },
        authHeaders,
      );
      toast.success(t("edit.changeEmail.successConfirm"));
      const storedToken =
        typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
      if (storedToken) await login(storedToken);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(errMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const canRequest = !!(oldEmail.trim() && newEmail.trim() && password);
  const canConfirm = code.trim().length >= 4;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {t("edit.changeEmail.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {step === "request" ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("edit.changeEmail.title")}</DialogTitle>
              <DialogDescription>
                {t("edit.changeEmail.step1Description")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ce-old">
                  {t("edit.changeEmail.oldEmailLabel")}
                </Label>
                <Input
                  id="ce-old"
                  type="email"
                  autoComplete="off"
                  placeholder={t("edit.changeEmail.oldEmailPlaceholder")}
                  value={oldEmail}
                  onChange={(e) => setOldEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ce-new">
                  {t("edit.changeEmail.newEmailLabel")}
                </Label>
                <Input
                  id="ce-new"
                  type="email"
                  autoComplete="off"
                  placeholder={t("edit.changeEmail.newEmailPlaceholder")}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ce-pw">
                  {t("edit.changeEmail.passwordLabel")}
                </Label>
                <Input
                  id="ce-pw"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("edit.changeEmail.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                {t("edit.changeEmail.cancel")}
              </Button>
              <Button
                type="button"
                onClick={requestChange}
                disabled={!canRequest || submitting}
              >
                {submitting
                  ? t("edit.changeEmail.sending")
                  : t("edit.changeEmail.sendCode")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("edit.changeEmail.step2Title")}</DialogTitle>
              <DialogDescription>
                {t("edit.changeEmail.step2Description", { email: newEmail })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="ce-code">
                {t("edit.changeEmail.codeLabel")}
              </Label>
              <Input
                id="ce-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t("edit.changeEmail.codePlaceholder")}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("request")}
                disabled={submitting}
              >
                {t("edit.changeEmail.back")}
              </Button>
              <Button
                type="button"
                onClick={confirmChange}
                disabled={!canConfirm || submitting}
              >
                {submitting
                  ? t("edit.changeEmail.confirming")
                  : t("edit.changeEmail.confirm")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
