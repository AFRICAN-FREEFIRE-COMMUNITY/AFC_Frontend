"use client";

/**
 * TotpEnrolDialog - setting up an AUTHENTICATOR APP as the second factor (owner 2026-08-07).
 *
 * Rendered by TwoFactorSecurity.tsx (at /profile/security) when the user picks "Authenticator app".
 * It owns the whole enrolment and hands the finished status back; the parent stays the page.
 *
 * ── THE TWO STEPS, AND WHY THEY ARE TWO ─────────────────────────────────────────────────────────
 *  1. SCAN. POST /auth/two-factor/totp/setup/ mints a secret and returns it once. The user scans
 *     the QR, or types the secret if their camera will not cooperate or they are already on the
 *     phone the app is on. NOTHING about the account has changed at this point, so closing the
 *     dialog here costs them nothing.
 *  2. CONFIRM. The user types the code their app is now showing, plus proof of the account as it
 *     stands, and only then does the account switch over.
 *
 *  Splitting it this way is what stops the failure that matters: enabling an authenticator that
 *  does not actually work (wrong app, phone clock badly out, scan of a stale QR) and discovering
 *  it at the next sign-in, locked out.
 *
 * ── WHY IT ASKS FOR A SECOND CODE ("confirm it is you") ─────────────────────────────────────────
 *  The backend requires proof of the CURRENT state on top of the new app's code, and this dialog
 *  collects it:
 *    - two-step sign-in currently OFF -> a code emailed to the account address. Same cost as
 *      turning email 2FA on, and without it a stolen session alone could attach an attacker's
 *      authenticator and keep the account through a password reset.
 *    - currently ON  -> a code from the CURRENT factor (or a recovery code). Swapping the owner's
 *      factor for someone else's is a takeover, so it costs the same as turning 2FA off.
 *  Which one is needed comes from the setup response (proof_purpose / proof_method), so the rule
 *  lives on the server and this screen only renders it.
 *
 * HOW IT CONNECTS
 *  - Data: lib/twoFactor.ts setupTotp / sendTwoFactorProofCode / confirmTotp -> /auth/two-factor/.
 *  - QR: components/TotpQrCode.tsx (drawn client side from otpauth_uri; no image endpoint exists).
 *  - Recovery codes: a FIRST enable returns a set, which the parent shows in its save-your-codes
 *    dialog. A method SWITCH returns an empty list and keeps the codes the user already saved.
 *  - i18n: the `twoFactor` namespace, security.app.* keys.
 * DESIGN: AFC constants - rounded-md, primary green, no em dashes, controls that stack full width
 * and stay tappable at 390px.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconCopy, IconCheck, IconRefresh } from "@tabler/icons-react";

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
} from "@/components/ui/dialog";
import { Loader } from "@/components/Loader";
import { TotpQrCode } from "@/components/TotpQrCode";
import {
  confirmTotp,
  methodSendsCode,
  sendTwoFactorProofCode,
  setupTotp,
  type TotpSetup,
  type TwoFactorStatusWithCodes,
} from "@/lib/twoFactor";

interface TotpEnrolDialogProps {
  open: boolean;
  /** Session token from AuthContext. */
  token: string;
  /** Closes the dialog. Called on cancel and after a successful enrolment. */
  onClose: () => void;
  /** The finished status plus any newly minted recovery codes. The parent shows those. */
  onEnrolled: (data: TwoFactorStatusWithCodes) => void;
}

export function TotpEnrolDialog({
  open,
  token,
  onClose,
  onEnrolled,
}: TotpEnrolDialogProps) {
  const t = useTranslations("twoFactor");

  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // The code from the app that just scanned the QR.
  const [appCode, setAppCode] = useState("");
  // Proof of the account as it stands: an emailed / current-app code, or a recovery code.
  const [proofChallengeToken, setProofChallengeToken] = useState("");
  const [proofCode, setProofCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [proofRequested, setProofRequested] = useState(false);

  const errMessage = useCallback(
    (err: unknown) =>
      (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message || t("security.genericError"),
    [t],
  );

  // onClose is an inline arrow at the call site, so it is a NEW function on every parent render.
  // It is held in a ref instead of being a dependency below, because if the effect depended on it,
  // any parent re-render while this dialog is open would re-run setup and mint a FRESH secret -
  // silently invalidating the QR the user had already scanned, and then telling them their
  // perfectly correct code was wrong. The ref keeps the callback current without making the
  // effect fire again.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  /**
   * Start the enrolment. Runs when the dialog OPENS, and only then: a secret shown in a previous
   * session may have gone stale (the backend expires unconfirmed enrolments), and re-minting on
   * open is free and always correct, while re-minting mid-flow is exactly the bug described above.
   */
  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;

    setLoading(true);
    setSetup(null);
    setAppCode("");
    setProofCode("");
    setBackupCode("");
    setProofChallengeToken("");
    setProofRequested(false);

    (async () => {
      try {
        const data = await setupTotp(token);
        if (!cancelled) setSetup(data);
      } catch (err) {
        if (cancelled) return;
        toast.error(errMessage(err));
        onCloseRef.current();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Guards against a state update after the dialog has been closed mid-request.
    return () => {
      cancelled = true;
    };
  }, [open, token, errMessage]);

  /**
   * Ask for the proof code. For an email proof this actually sends one; for a "totp" proof (the
   * user is replacing one authenticator with another) nothing is sent and this only raises the
   * challenge the confirm call needs, which is why the button says something different in each
   * case and why success is not announced as "sent" unless it was.
   */
  async function requestProof() {
    if (!token || !setup) return;
    setBusy(true);
    try {
      const data = await sendTwoFactorProofCode(token, setup.proof_purpose);
      setProofChallengeToken(data.challenge_token);
      setProofRequested(true);
      if (data.delivery_failed) toast.error(t("step.deliveryFailed"));
      else if (data.code_sent) toast.success(t("security.app.proofSent"));
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!token) return;
    setBusy(true);
    try {
      const data = await confirmTotp(token, {
        code: appCode.trim(),
        ...(backupCode.trim()
          ? { backupCode: backupCode.trim() }
          : { proofChallengeToken, proofCode: proofCode.trim() }),
      });
      onEnrolled(data);
      onClose();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function copySecret() {
    if (!setup) return;
    navigator.clipboard.writeText(setup.secret).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error(t("security.genericError")),
    );
  }

  const proofSends = setup ? methodSendsCode(setup.proof_method) : true;
  // A recovery code is an accepted substitute for the proof code, so either one unlocks the button.
  const hasProof = backupCode.trim().length >= 8 || proofCode.trim().length === 6;
  const canConfirm = !!setup && appCode.trim().length === 6 && hasProof;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      {/* Tall content on a phone: the dialog scrolls inside itself rather than pushing the page. */}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("security.app.title")}</DialogTitle>
          <DialogDescription>{t("security.app.description")}</DialogDescription>
        </DialogHeader>

        {loading || !setup ? (
          <div className="py-8">
            <Loader text={t("security.app.preparing")} />
          </div>
        ) : (
          <div className="space-y-5">
            {/* ── Step 1: get the secret into an app ──────────────────────────────── */}
            <div className="space-y-3">
              <p className="text-sm font-medium">{t("security.app.step1Title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("security.app.step1Body")}
              </p>

              <TotpQrCode value={setup.otpauth_uri} />

              {/* Always shown, never behind a "can't scan?" toggle: on a phone there is no second
                  camera to point at the screen, and that is most AFC users. */}
              <div className="space-y-1.5">
                <Label htmlFor="totp-secret">{t("security.app.secretLabel")}</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="totp-secret"
                    readOnly
                    value={setup.secret}
                    onFocus={(e) => e.currentTarget.select()}
                    className="font-mono text-xs tracking-wider"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={copySecret}
                  >
                    {copied ? (
                      <IconCheck className="size-4" />
                    ) : (
                      <IconCopy className="size-4" />
                    )}
                    {copied ? t("security.codes.copied") : t("security.codes.copy")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("security.app.secretHelp")}
                </p>
              </div>
            </div>

            {/* ── Step 2: prove the app works ─────────────────────────────────────── */}
            <div className="space-y-1.5 border-t pt-4">
              <p className="text-sm font-medium">{t("security.app.step2Title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("security.app.step2Body")}
              </p>
              <Label htmlFor="totp-app-code" className="sr-only">
                {t("step.codeLabelApp")}
              </Label>
              <Input
                id="totp-app-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder={t("step.codePlaceholder")}
                className="text-center text-lg tracking-[0.4em]"
                value={appCode}
                onChange={(e) =>
                  setAppCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </div>

            {/* ── Step 3: prove it is really you ──────────────────────────────────── */}
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">{t("security.app.step3Title")}</p>
              <p className="text-sm text-muted-foreground">
                {proofSends
                  ? t("security.app.step3BodyEmail", {
                      destination: setup.proof_destination,
                    })
                  : t("security.app.step3BodyApp")}
              </p>

              {/* BOTH proof kinds need this press, because both need a fresh challenge token from
                  /send-code/ before a code can be checked against anything. Only the wording
                  differs: an email proof genuinely sends something, a current-authenticator proof
                  sends nothing and the button just means "I have my app open". Raising the
                  challenge on press rather than on open keeps it fresh: it expires in 10 minutes,
                  and a dialog can sit open far longer than that. */}
              {!proofRequested ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={busy}
                  onClick={requestProof}
                >
                  <IconRefresh className="size-4" />
                  {proofSends
                    ? t("security.app.sendProof")
                    : t("security.app.readyForProof")}
                </Button>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="totp-proof-code">
                    {proofSends ? t("step.codeLabel") : t("security.app.currentAppLabel")}
                  </Label>
                  <Input
                    id="totp-proof-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder={t("step.codePlaceholder")}
                    className="text-center text-lg tracking-[0.4em]"
                    value={proofCode}
                    onChange={(e) =>
                      setProofCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                  />
                  {/* The escape hatch for someone who has lost the current factor entirely. Only
                      offered when the account HAS 2FA on, because that is the only time recovery
                      codes exist. */}
                  {setup.proof_purpose === "disable" ? (
                    <div className="space-y-1.5 pt-2">
                      <Label htmlFor="totp-proof-backup">{t("step.backupLabel")}</Label>
                      <Input
                        id="totp-proof-backup"
                        autoCapitalize="characters"
                        placeholder={t("step.backupPlaceholder")}
                        value={backupCode}
                        onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            {t("security.cancel")}
          </Button>
          <Button type="button" disabled={!canConfirm || busy} onClick={confirm}>
            {busy ? t("security.app.confirming") : t("security.app.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
