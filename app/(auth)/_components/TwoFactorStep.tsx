"use client";

/**
 * TwoFactorStep - the SECOND step of signing in (owner 2026-08-06).
 *
 * WHAT IT IS: after a user with two-step sign-in enters the right password, POST /auth/login/
 * returns a CHALLENGE instead of a session token. This screen collects the 6 digit code that was
 * emailed to them (or a recovery code), exchanges it at POST /auth/two-factor/verify/, and hands
 * the resulting session token to the caller.
 *
 * WHY IT IS A SHARED COMPONENT: there are TWO places a user signs in - the /login page
 * (app/(auth)/_components/LoginForm.tsx) and the in-place modal that pops when a session expires
 * (components/AuthModal.tsx). Both must handle the second step identically, so both render this.
 * The caller owns what happens after success (navigate, or close the modal and stay put), which is
 * the only thing that genuinely differs between them.
 *
 * WHAT THE COPY DELIBERATELY DOES NOT SAY: every failure shows the same sentence. This screen runs
 * BEFORE a session exists, so a message that distinguished "no such account" from "wrong code"
 * would be a way to probe which accounts exist and which have 2FA on. The backend returns one
 * generic message for exactly the same reason; we render what it sends.
 *
 * HOW IT CONNECTS
 *   - Data: lib/twoFactor.ts (verifyTwoFactor, resendTwoFactorCode) -> /auth/two-factor/.
 *   - Session: the caller passes the token to AuthContext.login(), which is the same call a
 *     one-step login makes, so nothing downstream knows 2FA happened.
 *   - i18n: the `twoFactor` namespace (messages/en|fr|pt/twoFactor.json), step.* keys.
 * DESIGN: AFC constants - no em dashes, primary green accents, tap targets that work at 390px.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconMail, IconKey, IconArrowLeft } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/Loader";
import {
  resendTwoFactorCode,
  verifyTwoFactor,
  type LoginSuccess,
  type TwoFactorChallenge,
} from "@/lib/twoFactor";

interface TwoFactorStepProps {
  /** The challenge POST /auth/login/ returned. */
  challenge: TwoFactorChallenge;
  /** Called with the login body once the code checks out. The caller signs the user in. */
  onVerified: (data: LoginSuccess) => void | Promise<void>;
  /** "Back to sign in" - drops the challenge and returns to the password form. */
  onCancel: () => void;
}

export function TwoFactorStep({
  challenge,
  onVerified,
  onCancel,
}: TwoFactorStepProps) {
  const t = useTranslations("twoFactor");

  // The challenge token is STATE, not just a prop: resending issues a new code and therefore a NEW
  // challenge token (the old one is invalidated server-side). Holding the prop would leave the user
  // typing a fresh code against a dead challenge.
  const [challengeToken, setChallengeToken] = useState(challenge.challenge_token);
  const [destination, setDestination] = useState(challenge.destination);

  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  // Which input is showing. Someone who has lost their inbox needs the recovery path, and it has to
  // be reachable from here - there is nowhere else they can get in from.
  const [usingBackup, setUsingBackup] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  // Seconds until another code may be requested. Seeded from the backend's retry_after so the
  // button is already disabled if login reused a code it had just sent.
  const [cooldown, setCooldown] = useState(challenge.retry_after || 0);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  // True when the email genuinely failed to go out. The screen then says so and steers the user to
  // a recovery code, instead of telling them to watch an inbox nothing was sent to.
  const [deliveryFailed, setDeliveryFailed] = useState(!!challenge.delivery_failed);

  // Tick the resend cooldown down to zero. One interval, cleared on unmount.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const errMessage = useCallback(
    (err: unknown) => {
      const anyErr = err as {
        response?: { data?: { message?: string; attempts_left?: number }; status?: number };
      };
      if (typeof anyErr?.response?.data?.attempts_left === "number") {
        setAttemptsLeft(anyErr.response.data.attempts_left);
      }
      if (anyErr?.response?.status === 429) return t("step.lockedOut");
      return anyErr?.response?.data?.message || t("step.genericError");
    },
    [t],
  );

  async function submit() {
    setSubmitting(true);
    try {
      const data = await verifyTwoFactor({
        challengeToken,
        ...(usingBackup ? { backupCode: backupCode.trim() } : { code: code.trim() }),
      });
      await onVerified(data);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      const data = await resendTwoFactorCode(challengeToken);
      // Swap in the new challenge token before anything else (see the state note above).
      setChallengeToken(data.challenge_token);
      if (data.destination) setDestination(data.destination);
      setCooldown(data.retry_after || 60);
      setAttemptsLeft(null);
      setCode("");
      setDeliveryFailed(!!data.delivery_failed);
      if (data.delivery_failed) toast.error(t("step.deliveryFailed"));
      else
        toast.success(
          data.code_sent ? t("step.resendSent") : t("step.resendAlreadySent"),
        );
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setResending(false);
    }
  }

  const canSubmit = usingBackup
    ? backupCode.trim().length >= 8
    : code.trim().length === 6;

  return (
    <div className="space-y-5">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10">
          {usingBackup ? (
            <IconKey className="size-5 text-primary" />
          ) : (
            <IconMail className="size-5 text-primary" />
          )}
        </div>
        <h2 className="text-lg font-semibold">{t("step.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {destination
            ? t("step.description", { destination })
            : t("step.descriptionNoDestination")}
        </p>
      </div>

      {usingBackup ? (
        <div className="space-y-1.5">
          <Label htmlFor="tfa-backup">{t("step.backupLabel")}</Label>
          <Input
            id="tfa-backup"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            placeholder={t("step.backupPlaceholder")}
            className="bg-input border-border text-center tracking-widest"
            value={backupCode}
            onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit && !submitting) submit();
            }}
          />
          <p className="text-xs text-muted-foreground">{t("step.backupHelp")}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="tfa-code">{t("step.codeLabel")}</Label>
          <Input
            id="tfa-code"
            // inputMode numeric brings up the number pad on a phone, which is where most AFC
            // users are; autoComplete one-time-code lets iOS/Android offer the code from the
            // notification so it never has to be typed at all.
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            placeholder={t("step.codePlaceholder")}
            className="bg-input border-border text-center text-xl tracking-[0.5em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit && !submitting) submit();
            }}
          />
          <p className="text-xs text-muted-foreground">{t("step.spamNote")}</p>
        </div>
      )}

      {/* Mail actually failed to go out. Say so, and point at the way in that does not need it. */}
      {deliveryFailed && !usingBackup ? (
        <p className="rounded-md bg-gold/10 px-3 py-2 text-sm text-gold">
          {t("step.deliveryFailed")}
        </p>
      ) : null}

      {/* Only shown once a guess has been used, so a first-time visitor is not warned about a
          limit they have not touched. */}
      {attemptsLeft !== null && attemptsLeft > 0 ? (
        <p className="text-xs text-gold">
          {attemptsLeft === 1
            ? t("step.attemptsLeftOne")
            : t("step.attemptsLeft", { count: attemptsLeft })}
        </p>
      ) : null}

      <Button
        type="button"
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={!canSubmit || submitting}
        onClick={submit}
      >
        {submitting ? <Loader text={t("step.verifying")} /> : t("step.submit")}
      </Button>

      {/* Stacked on a phone so both controls stay full-width tap targets at 390px. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        {!usingBackup ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full sm:w-auto"
            disabled={resending || cooldown > 0}
            onClick={resend}
          >
            {resending
              ? t("step.resending")
              : cooldown > 0
                ? t("step.resendIn", { seconds: cooldown })
                : t("step.resend")}
          </Button>
        ) : (
          <span className="hidden sm:block" />
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => {
            setUsingBackup((v) => !v);
            setAttemptsLeft(null);
          }}
        >
          {usingBackup ? t("step.useEmailCode") : t("step.useBackupCode")}
        </Button>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground"
        onClick={onCancel}
      >
        <IconArrowLeft className="size-4" />
        {t("step.backToLogin")}
      </Button>
    </div>
  );
}
