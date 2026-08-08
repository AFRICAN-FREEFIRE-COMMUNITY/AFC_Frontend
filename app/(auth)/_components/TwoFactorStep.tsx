"use client";

/**
 * TwoFactorStep - the SECOND step of signing in (owner 2026-08-06).
 *
 * WHAT IT IS: after a user with two-step sign-in enters the right password, POST /auth/login/
 * returns a CHALLENGE instead of a session token. This screen collects the 6 digit code (or a
 * recovery code), exchanges it at POST /auth/two-factor/verify/, and hands the resulting session
 * token to the caller.
 *
 * ONE SCREEN, TWO METHODS (authenticator app added 2026-08-07). `challenge.method` decides what is
 * rendered, and the DIFFERENCE IS NOT COSMETIC: an authenticator app generates the code itself, so
 * for method "totp" there is nothing to resend and nothing to wait out. Rendering a resend button
 * there would be a button that either lies or does nothing, and a cooldown counting down to an
 * action that has no meaning. So the whole resend control is absent, not disabled, and the copy
 * points at the phone rather than at an inbox. Everything else - the input, the recovery-code
 * escape hatch, the attempts warning, the verify call - is byte-identical for both, because the
 * backend endpoint is.
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
 * ── REMEMBER THIS DEVICE (owner 2026-08-08) ─────────────────────────────────────────────────────
 * The owner's complaint was that a code EVERY TIME is stressful, and this tick is the answer: on
 * success it stores a device token, and this browser is not challenged again for 30 days. Three
 * rules the control obeys, all visible below:
 *   • It is OFF by default and never pre-ticked. Trust has to be a decision.
 *   • The label says what it actually costs ("we will not ask on this browser for 30 days"), not a
 *     vague "trust this device". Someone on a shared or borrowed phone has to be able to tell.
 *   • It is shown on the recovery-code path too. Somebody using a recovery code is exactly the
 *     person who least wants to be back on this screen next week.
 *
 * HOW IT CONNECTS
 *   - Data: lib/twoFactor.ts (verifyTwoFactor, resendTwoFactorCode) -> /auth/two-factor/.
 *   - Session: the caller passes the token to AuthContext.login(), which is the same call a
 *     one-step login makes, so nothing downstream knows 2FA happened.
 *   - Device token: the CALLER stores it (lib/twoFactor.ts saveDeviceToken) alongside signing in,
 *     because the caller already owns "what happens after success" and this is part of that.
 *   - Revoking: app/(user)/profile/_components/TrustedDevices.tsx, on /profile/security.
 *   - i18n: the `twoFactor` namespace (messages/en|fr|pt/twoFactor.json), step.* keys.
 * DESIGN: AFC constants - no em dashes, primary green accents, tap targets that work at 390px.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  IconMail,
  IconKey,
  IconArrowLeft,
  IconDeviceMobile,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
// Shared, self-expiring NEW tag (owner rule: anything a returning user would not otherwise
// notice wears one for 5 days, then removes itself).
import { NewBadge } from "@/components/NewBadge";
import { Loader } from "@/components/Loader";
import {
  methodSendsCode,
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

  // Does this account's method SEND anything? False for an authenticator app, and that single
  // boolean is what removes the resend control, the cooldown timer, the spam-folder note and the
  // "check your inbox" wording - none of which mean anything when the code is already on the phone.
  const sendsCode = methodSendsCode(challenge.method);

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
  // "Remember this device". OFF by default and never seeded from anything: trust has to be a
  // decision somebody made, not a state they inherited.
  const [rememberDevice, setRememberDevice] = useState(false);

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
        // Only ever true because the user ticked the box on this screen.
        rememberDevice,
      });
      // The caller stores the device token, because the caller already owns everything that
      // happens after success (sign in, then navigate or close the modal).
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
          ) : sendsCode ? (
            <IconMail className="size-5 text-primary" />
          ) : (
            <IconDeviceMobile className="size-5 text-primary" />
          )}
        </div>
        <h2 className="text-lg font-semibold">{t("step.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {/* Three sentences, because "we sent a code to jo***@gmail.com" is simply untrue when
              nothing was sent. An authenticator user is told where to look instead. */}
          {!sendsCode
            ? t("step.descriptionApp")
            : destination
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
          <Label htmlFor="tfa-code">
            {sendsCode ? t("step.codeLabel") : t("step.codeLabelApp")}
          </Label>
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
          {/* The spam-folder hint only makes sense for a code that travelled. An authenticator
              user gets the thing they actually need to know: the code rolls over every 30s. */}
          <p className="text-xs text-muted-foreground">
            {sendsCode ? t("step.spamNote") : t("step.appRefreshNote")}
          </p>
        </div>
      )}

      {/* Mail actually failed to go out. Say so, and point at the way in that does not need it.
          Cannot fire for an authenticator account: nothing is sent, so nothing can fail to send. */}
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

      {/* ── Remember this device ──────────────────────────────────────────────────────────────
          Sits directly ABOVE the submit button, because it changes what that button does and a
          user has to see it before they commit, not after. Shown on the recovery-code path too.

          The whole row is a <label>, so the text is part of the tap target: a bare 16px checkbox
          is a miserable thing to hit on a 390px phone, which is where most AFC users are.

          The second line is not decoration. "Remember this device" alone does not tell somebody on
          a borrowed phone what they are agreeing to, so the consequence is spelled out with the
          real number of days. */}
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
        <Checkbox
          id="tfa-remember-device"
          checked={rememberDevice}
          onCheckedChange={(v) => setRememberDevice(v === true)}
          className="mt-0.5"
        />
        <span className="leading-relaxed">
          <span className="flex flex-wrap items-center gap-2 font-medium">
            {t("step.rememberDevice")}
            {/* Dated, self-expiring: gone by itself 5 days after 2026-08-08. */}
            <NewBadge since="2026-08-08" />
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {t("step.rememberDeviceHelp")}
          </span>
        </span>
      </label>

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
        {/* ABSENT, not disabled, for an authenticator account. A greyed-out "send a new code" would
            still tell the user a code exists to be sent, and it never will be. */}
        {!usingBackup && sendsCode ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full sm:w-auto"
            disabled={resending || cooldown > 0}
            onClick={resend}
          >
            {/* Two units on purpose. The normal cooldown is 60 seconds, but hitting the hourly
                send ceiling returns 3600, and "in 3597s" is not a number anyone can read. */}
            {resending
              ? t("step.resending")
              : cooldown >= 120
                ? t("step.resendInMinutes", { minutes: Math.ceil(cooldown / 60) })
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
          {usingBackup
            ? sendsCode
              ? t("step.useEmailCode")
              : t("step.useAppCode")
            : t("step.useBackupCode")}
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
