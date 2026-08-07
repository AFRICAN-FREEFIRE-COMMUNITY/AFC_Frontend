"use client";

/**
 * TwoFactorSecurity - the player's own control panel for TWO-STEP SIGN-IN (owner 2026-08-06).
 *
 * Rendered at /profile/security (app/(user)/profile/security/page.tsx wraps it in ProtectedRoute,
 * the same idiom as /profile/connected-apps and /profile/addresses).
 *
 * WHAT IT DOES
 *   - Shows whether two-step sign-in is on, which method, and how many recovery codes are left.
 *   - Turns it ON: sends a code, makes the user enter it, and only then flips the switch. Proving
 *     the email actually reaches them BEFORE enabling is what stops someone locking themselves out
 *     of their own account with a mailbox they cannot open.
 *   - Shows the recovery codes ONCE, with copy and download, and will not let the dialog close
 *     until the user ticks that they saved them. Only hashes are stored, so there is no second
 *     chance and the UI has to treat that moment as important.
 *   - Turns it OFF and regenerates recovery codes, both behind a fresh emailed code, because a
 *     live session alone should not be enough to strip the second factor off an account.
 *
 * WHY EMAIL: every AFC account has a verified email; WhatsApp reaches roughly 90 of ~6,790 users.
 * The backend is written behind a method interface (afc_auth/two_factor.py), so when the approved
 * WhatsApp template or an authenticator app is added, this page picks it up through
 * status.available_methods without being rewritten.
 *
 * HOW IT CONNECTS
 *   - Data: lib/twoFactor.ts -> /auth/two-factor/ (afc_auth/views_two_factor.py).
 *   - Session token from AuthContext, same Bearer pattern as ConnectedApps.tsx.
 *   - Dates render through <LocalTime> so "turned on" shows in the VIEWER's timezone, not UTC.
 *   - i18n: the `twoFactor` namespace, security.* keys.
 * DESIGN: AFC constants - Card `rounded-md`, PageHeader, primary green, no em dashes, controls
 * that stack full-width on a phone.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  IconShieldCheck,
  IconShieldOff,
  IconCopy,
  IconDownload,
  IconRefresh,
  IconKey,
} from "@tabler/icons-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
// Shared, self-expiring NEW tag (owner rule: any new page wears one for 5 days).
import { NewBadge } from "@/components/NewBadge";
import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { useAuth } from "@/contexts/AuthContext";
import {
  disableTwoFactor,
  enableTwoFactor,
  getTwoFactorStatus,
  regenerateBackupCodes,
  sendTwoFactorProofCode,
  type TwoFactorStatus,
} from "@/lib/twoFactor";

// How many recovery codes a full set holds. Mirrors BACKUP_CODE_COUNT in
// backend/afc_auth/two_factor.py; used only for the "x of y unused" line.
const BACKUP_CODE_TOTAL = 10;
// Below this we start telling the user to generate a new set, before they are stuck.
const LOW_BACKUP_THRESHOLD = 3;

/** Which multi-step dialog is open, if any. */
type Flow = null | "enable" | "disable" | "regenerate";

export function TwoFactorSecurity() {
  const t = useTranslations("twoFactor");
  const { token } = useAuth();

  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [flow, setFlow] = useState<Flow>(null);
  // Inside a flow: "send" is asking for the code to go out, "code" is collecting it.
  const [flowStep, setFlowStep] = useState<"send" | "code">("send");
  const [challengeToken, setChallengeToken] = useState("");
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [busy, setBusy] = useState(false);

  // The one-time plaintext codes, held only until the user confirms they saved them.
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setFailed(false);
    try {
      setStatus(await getTwoFactorStatus(token));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const errMessage = (err: unknown) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    t("security.genericError");

  function closeFlow() {
    setFlow(null);
    setFlowStep("send");
    setChallengeToken("");
    setCode("");
    setBackupCode("");
    setBusy(false);
  }

  // Step one of every flow: ask the backend to email a proof code. Enabling uses purpose "enable"
  // (prove the method reaches you); disabling and regenerating use "disable" (prove it is you).
  async function sendProofCode(purpose: "enable" | "disable") {
    if (!token) return;
    setBusy(true);
    try {
      const data = await sendTwoFactorProofCode(token, purpose);
      setChallengeToken(data.challenge_token);
      setFlowStep("code");
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    if (!token) return;
    setBusy(true);
    try {
      const data = await enableTwoFactor(token, { challengeToken, code: code.trim() });
      setStatus(data);
      // Hand straight to the save-your-codes dialog: this is the only time they exist in plaintext.
      setNewCodes(data.backup_codes);
      setSavedConfirmed(false);
      closeFlow();
      toast.success(t("security.enable.success"));
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisable() {
    if (!token) return;
    setBusy(true);
    try {
      const data = await disableTwoFactor(
        token,
        backupCode.trim()
          ? { backupCode: backupCode.trim() }
          : { challengeToken, code: code.trim() },
      );
      setStatus(data);
      closeFlow();
      toast.success(t("security.disable.success"));
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRegenerate() {
    if (!token) return;
    setBusy(true);
    try {
      const data = await regenerateBackupCodes(token, { challengeToken, code: code.trim() });
      setStatus(data);
      setNewCodes(data.backup_codes);
      setSavedConfirmed(false);
      closeFlow();
      toast.success(t("security.regenerated"));
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function copyCodes() {
    if (!newCodes) return;
    navigator.clipboard.writeText(newCodes.join("\n")).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error(t("security.genericError")),
    );
  }

  // Plain text file rather than a PDF: it opens on any phone, and the point is that this survives
  // somewhere outside the mailbox the codes exist to replace.
  function downloadCodes() {
    if (!newCodes) return;
    const blob = new Blob(
      [`AFC recovery codes\n\n${newCodes.join("\n")}\n\nEach code works once.\n`],
      { type: "text/plain" },
    );
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "afc-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(href);
  }

  if (loading) return <FullLoader />;

  const enabled = !!status?.enabled;
  const remaining = status?.backup_codes_remaining ?? 0;

  return (
    <div className="container mx-auto py-6">
      {/* NEW tag: the whole Sign-in security page shipped 2026-08-06. flex-wrap so on a
          phone the pill drops below the heading instead of widening the page. */}
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t("security.title")}
            <NewBadge since="2026-08-06" />
          </span>
        }
        description={t("security.subtitle")}
      />

      {failed ? (
        <Card className="mt-4">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">{t("security.loadError")}</p>
            <Button variant="outline" onClick={load}>
              {t("security.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── State + the on/off switch ─────────────────────────────────────────── */}
          <Card className="mt-4">
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-md ${
                    enabled ? "bg-primary/10" : "bg-muted"
                  }`}
                >
                  {enabled ? (
                    <IconShieldCheck className="size-5 text-primary" />
                  ) : (
                    <IconShieldOff className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{t("security.methodEmail")}</h3>
                    <Badge
                      variant="outline"
                      className={
                        enabled
                          ? "rounded-full border-primary/60 px-2 py-0.5 text-xs text-primary"
                          : "rounded-full px-2 py-0.5 text-xs text-muted-foreground"
                      }
                    >
                      {enabled ? t("security.statusOn") : t("security.statusOff")}
                    </Badge>
                  </div>
                  {status?.destination ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("security.sendsTo", { destination: status.destination })}
                    </p>
                  ) : null}
                  {enabled && status?.enabled_at ? (
                    <p className="text-xs text-muted-foreground">
                      {t("security.enabledOn")}{" "}
                      <LocalTime value={status.enabled_at} mode="date" />
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-md bg-muted/40 px-3 py-2">
                <p className="text-sm font-medium">{t("security.explainerTitle")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("security.explainerBody")}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                {enabled ? (
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setFlow("disable");
                      setFlowStep("send");
                    }}
                  >
                    {t("security.turnOff")}
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
                    onClick={() => {
                      setFlow("enable");
                      setFlowStep("send");
                    }}
                  >
                    <IconShieldCheck className="size-4" />
                    {t("security.turnOn")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Recovery codes. Only meaningful while 2FA is on. ──────────────────── */}
          {enabled ? (
            <Card className="mt-4">
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                    <IconKey className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold">{t("security.backupTitle")}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("security.backupRemaining", {
                        count: remaining,
                        total: BACKUP_CODE_TOTAL,
                      })}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  {t("security.backupExplainer")}
                </p>

                {/* Warn BEFORE the last code is gone, not after. */}
                {remaining === 0 ? (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {t("security.backupNone")}
                  </p>
                ) : remaining <= LOW_BACKUP_THRESHOLD ? (
                  <p className="rounded-md bg-gold/10 px-3 py-2 text-sm text-gold">
                    {t("security.backupLow", { count: remaining })}
                  </p>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setFlow("regenerate");
                      setFlowStep("send");
                    }}
                  >
                    <IconRefresh className="size-4" />
                    {t("security.regenerate")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {/* ── The enable / disable / regenerate dialog. One dialog, three flows: they differ only
             in their copy and in which confirm call fires, so three near-identical dialogs would
             be three places for the same bug to hide. ──────────────────────────────────────── */}
      <Dialog open={flow !== null} onOpenChange={(open) => !open && closeFlow()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {flow === "enable"
                ? t("security.enable.title")
                : flow === "disable"
                  ? t("security.disable.title")
                  : t("security.regenerate")}
            </DialogTitle>
            <DialogDescription>
              {flowStep === "send"
                ? flow === "enable"
                  ? t("security.enable.step1Description", {
                      destination: status?.destination ?? "",
                    })
                  : t("security.disable.step1Description", {
                      destination: status?.destination ?? "",
                    })
                : flow === "enable"
                  ? t("security.enable.step2Description", {
                      destination: status?.destination ?? "",
                    })
                  : t("security.disable.step2Description", {
                      destination: status?.destination ?? "",
                    })}
            </DialogDescription>
          </DialogHeader>

          {flow === "disable" && flowStep === "send" ? (
            <p className="rounded-md bg-gold/10 px-3 py-2 text-sm text-gold">
              {t("security.disable.warning")}
            </p>
          ) : null}

          {flowStep === "code" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="tfa-settings-code">{t("step.codeLabel")}</Label>
                <Input
                  id="tfa-settings-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder={t("step.codePlaceholder")}
                  className="text-center text-lg tracking-[0.4em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
              {/* Disabling also accepts a recovery code, because someone who has lost their inbox
                  needs a way to switch the factor off, not only a way to sign in. */}
              {flow === "disable" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="tfa-settings-backup">{t("step.backupLabel")}</Label>
                  <Input
                    id="tfa-settings-backup"
                    autoCapitalize="characters"
                    placeholder={t("step.backupPlaceholder")}
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={closeFlow} disabled={busy}>
              {t("security.cancel")}
            </Button>
            {flowStep === "send" ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => sendProofCode(flow === "enable" ? "enable" : "disable")}
              >
                {busy ? t("security.enable.sending") : t("security.enable.sendCode")}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={
                  busy ||
                  (flow === "disable"
                    ? code.trim().length !== 6 && backupCode.trim().length < 8
                    : code.trim().length !== 6)
                }
                onClick={
                  flow === "enable"
                    ? confirmEnable
                    : flow === "disable"
                      ? confirmDisable
                      : confirmRegenerate
                }
              >
                {flow === "enable"
                  ? busy
                    ? t("security.enable.confirming")
                    : t("security.enable.confirm")
                  : flow === "disable"
                    ? busy
                      ? t("security.disable.confirming")
                      : t("security.disable.confirm")
                    : t("security.regenerate")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Save-your-codes dialog. Shown once, after enable or regenerate. Deliberately NOT
             dismissible by clicking outside or pressing Escape: closing it loses the codes for
             good, so the only way out is the confirmation tick. ──────────────────────────── */}
      <Dialog open={newCodes !== null} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>{t("security.codes.title")}</DialogTitle>
            <DialogDescription>{t("security.codes.description")}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 p-3 font-mono text-sm">
            {(newCodes ?? []).map((c) => (
              <span key={c} className="tracking-wider">
                {c}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={copyCodes}
            >
              <IconCopy className="size-4" />
              {copied ? t("security.codes.copied") : t("security.codes.copy")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={downloadCodes}
            >
              <IconDownload className="size-4" />
              {t("security.codes.download")}
            </Button>
          </div>

          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={savedConfirmed}
              onCheckedChange={(v) => setSavedConfirmed(v === true)}
            />
            <span className="leading-relaxed">{t("security.codes.confirmSaved")}</span>
          </label>

          <DialogFooter>
            <Button
              type="button"
              className="w-full"
              disabled={!savedConfirmed}
              onClick={() => {
                setNewCodes(null);
                setSavedConfirmed(false);
                // Re-read from the server rather than trusting local state: the "x of y unused"
                // count must come from the database, not from what we think we just did.
                load();
              }}
            >
              {t("security.codes.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
