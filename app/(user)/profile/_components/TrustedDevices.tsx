"use client";

/**
 * TrustedDevices - "where am I signed in, and what skips my code?" (owner 2026-08-08).
 *
 * Rendered on /profile/security, directly under TwoFactorSecurity, because it only means anything
 * once two-step sign-in is on. When it is off this component renders NOTHING: a list of devices
 * that can skip a step that does not exist would be a puzzle, not a feature.
 *
 * ── WHY IT EXISTS ───────────────────────────────────────────────────────────────────────────────
 * The owner's objection to two-step sign-in was not the channel, it was the frequency: "logging in
 * each time with a code is stressful". The answer is the "Remember this device" tick on the code
 * screen (app/(auth)/_components/TwoFactorStep.tsx), which stops that browser being challenged for
 * 30 days. But a remembered device IS a credential, so it cannot be a thing users create and then
 * cannot see. This page is the other half of that bargain: every remembered browser is listed, and
 * any of them can be removed, immediately.
 *
 * ── THE ONE DISTINCTION THE WHOLE PAGE HANGS ON, and why there are two cards ────────────────────
 *   A TRUSTED DEVICE skips the second step for 30 days. It is NOT being signed in. Removing one
 *   means that browser is asked for a code again, next time.
 *   A SESSION is being signed in RIGHT NOW, and lapses after 3 hours of inactivity. Ending one
 *   signs that browser out immediately.
 * Someone who lent a friend their phone needs the first. Someone who left themselves signed in at a
 * cybercafe needs the second. Folding them into one control would leave one of those two people
 * with no way to fix their problem, so they are two cards and each says plainly what it does.
 *
 * HOW IT CONNECTS
 *   - Data: lib/twoFactor.ts (listTrustedDevices, revokeTrustedDevice, revokeAllTrustedDevices,
 *     listSessions, signOutOtherSessions) -> /auth/devices/ (backend afc_auth/views_devices.py).
 *   - Rendered by: app/(user)/profile/security/page.tsx, below <TwoFactorSecurity />.
 *   - Session token from AuthContext, same Bearer pattern as ConnectedApps.tsx.
 *   - Confirm dialogs follow the ConnectedApps idiom exactly, including keeping the pending item
 *     during the close animation (clearing it mid-animation blanks the name out and can leave
 *     Radix's pointer-events lock on <body>).
 *   - Dates render through <LocalTime> so they show in the VIEWER's timezone, not the server's UTC.
 *   - NEW tag: components/NewBadge.tsx, dated, self-expiring (CLAUDE.md hard rule).
 *   - i18n: the `twoFactor` namespace, devices.* keys.
 * DESIGN: AFC constants - Card `rounded-md`, outline pill badges, primary green, no em dashes,
 * controls that stack full-width at 390px.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  IconDeviceDesktop,
  IconDeviceMobile,
  IconLogout,
  IconShieldLock,
  IconTrash,
} from "@tabler/icons-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { NewBadge } from "@/components/NewBadge";
import { LocalTime } from "@/components/LocalTime";
import { useAuth } from "@/contexts/AuthContext";
import {
  clearDeviceToken,
  listSessions,
  listTrustedDevices,
  revokeAllTrustedDevices,
  revokeTrustedDevice,
  signOutOtherSessions,
  type TrustedDevice,
} from "@/lib/twoFactor";

/** Which confirm dialog is open. One dialog per destructive action, never a bare button. */
type Confirm = null | { kind: "one"; device: TrustedDevice } | { kind: "all" } | { kind: "signout" };

interface TrustedDevicesProps {
  /**
   * Whether two-step sign-in is on, owned by the parent so both cards react to the same state
   * without a second status fetch. The device card is hidden when it is off; the SESSION card is
   * not, because being signed in on four browsers is worth knowing about either way.
   */
  twoFactorEnabled: boolean;
}

export function TrustedDevices({ twoFactorEnabled }: TrustedDevicesProps) {
  const t = useTranslations("twoFactor");
  const { token } = useAuth();

  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [trustDays, setTrustDays] = useState(30);
  const [otherSessions, setOtherSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Disables only the row being worked on, rather than locking the whole list.
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Both in one pass: the two cards are read together and a partial page here would be worse
      // than a slightly later one. Promise.all rather than sequential awaits so it is one round
      // trip's worth of waiting on a phone connection.
      const [deviceList, sessionList] = await Promise.all([
        listTrustedDevices(token),
        listSessions(token),
      ]);
      setDevices(deviceList.devices);
      setTrustDays(deviceList.trust_days);
      setOtherSessions(sessionList.others);
    } catch {
      // Deliberately quiet. This sits under the 2FA card on a page that already reports its own
      // load failure; a second red toast for a secondary panel is noise, and the empty state below
      // reads correctly either way.
      setDevices([]);
      setOtherSessions(0);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRevokeOne(device: TrustedDevice) {
    if (!token) return;
    setConfirmOpen(false);
    setBusyId(device.id);
    try {
      await revokeTrustedDevice(token, device.id);
      // Drop it locally rather than refetching: the backend call is authoritative and idempotent,
      // and this keeps the list from flickering on a slow connection. Same choice ConnectedApps
      // makes after a revoke, and for the same reason.
      setDevices((prev) => prev.filter((d) => d.id !== device.id));
      toast.success(t("devices.toast.revoked"));
    } catch {
      toast.error(t("devices.toast.revokeFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevokeAll() {
    if (!token) return;
    setConfirmOpen(false);
    setBusy(true);
    try {
      await revokeAllTrustedDevices(token);
      setDevices([]);
      // THIS browser's token is among the ones just deleted, so the cookie is now pointing at a row
      // that no longer exists. Clearing it is housekeeping, not security (a dead token is refused
      // either way); it stops us sending a token that cannot work on every future sign-in.
      clearDeviceToken();
      toast.success(t("devices.toast.revokedAll"));
    } catch {
      toast.error(t("devices.toast.revokeFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOutOthers() {
    if (!token) return;
    setConfirmOpen(false);
    setBusy(true);
    try {
      const res = await signOutOtherSessions(token);
      setOtherSessions(0);
      // Separate singular key rather than an ICU plural: this catalog does it that way throughout
      // (step.attemptsLeft / step.attemptsLeftOne), and a hand-written fr/pt plural rule is exactly
      // the kind of thing that broke the message files once already.
      toast.success(
        res.signed_out === 1
          ? t("devices.toast.signedOutOne")
          : t("devices.toast.signedOut", { count: res.signed_out }),
      );
    } catch {
      toast.error(t("devices.toast.signOutFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <>
      {/* ── Card 1: what may skip the second step. Only meaningful while 2FA is on. ─────────── */}
      {twoFactorEnabled ? (
        <Card className="mt-4">
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                <IconShieldLock className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">{t("devices.title")}</h3>
                  {/* Dated, self-expiring 5 days after 2026-08-08. Nothing to remove later. */}
                  <NewBadge since="2026-08-08" />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("devices.subtitle", { days: trustDays })}
                </p>
              </div>
            </div>

            {devices.length === 0 ? (
              // The common case, and the copy says how to get here rather than just "none":
              // somebody reading this card is usually looking for the feature, not its absence.
              <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {t("devices.empty")}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {devices.map((device) => {
                  // A rough phone/computer split, from the stored label. Wrong on an oddity, and
                  // that costs nothing: the label beside it is what actually identifies the device.
                  const isPhone = /android|iphone|ipad/i.test(device.label);
                  return (
                    <div
                      key={device.id}
                      // Stacks on a phone so the remove button stays a full-width tap target.
                      className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        {isPhone ? (
                          <IconDeviceMobile className="size-4.5 text-muted-foreground" />
                        ) : (
                          <IconDeviceDesktop className="size-4.5 text-muted-foreground" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{device.label}</p>
                        {/* Label and date are separate nodes rather than one interpolated string:
                            the date has to be a <LocalTime> ELEMENT so it renders in the viewer's
                            timezone without a hydration mismatch. Every locale here puts the date
                            last, so a trailing date reads correctly in en, fr and pt. */}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t("devices.lastUsed")}{" "}
                          <LocalTime value={device.last_used_at} mode="datetime" />
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("devices.trustedUntil")}{" "}
                          <LocalTime value={device.expires_at} mode="date" />
                          {device.last_ip ? ` (${device.last_ip})` : ""}
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={busyId === device.id}
                        onClick={() => {
                          setConfirm({ kind: "one", device });
                          setConfirmOpen(true);
                        }}
                      >
                        <IconTrash className="size-4" />
                        {t("devices.remove")}
                      </Button>
                    </div>
                  );
                })}

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={busy}
                    onClick={() => {
                      setConfirm({ kind: "all" });
                      setConfirmOpen(true);
                    }}
                  >
                    {t("devices.removeAll")}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* ── Card 2: where the account is signed in right now. Shown whether or not 2FA is on,
             because being signed in on four browsers is worth knowing either way. ───────────── */}
      <Card className="mt-4">
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
              <IconLogout className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold">{t("devices.sessions.title")}</h3>
                <NewBadge since="2026-08-08" />
                {otherSessions > 0 ? (
                  <Badge
                    variant="outline"
                    className="rounded-full border-primary/60 px-2 py-0.5 text-xs text-primary"
                  >
                    {otherSessions === 1
                      ? t("devices.sessions.elsewhereOne")
                      : t("devices.sessions.elsewhere", { count: otherSessions })}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {otherSessions > 0
                  ? t("devices.sessions.subtitle")
                  : t("devices.sessions.onlyHere")}
              </p>
            </div>
          </div>

          {/* States the difference between the two cards out loud. It is the one thing a user can
              genuinely get wrong here, so it is not left to be inferred from the button labels. */}
          <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {t("devices.sessions.explainer")}
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={busy || otherSessions === 0}
              onClick={() => {
                setConfirm({ kind: "signout" });
                setConfirmOpen(true);
              }}
            >
              <IconLogout className="size-4" />
              {t("devices.sessions.signOutOthers")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* One dialog for all three destructive actions. `confirm` is deliberately NOT cleared when
          the dialog closes: Radix keeps it mounted through the exit animation, and blanking the
          copy mid-animation shows the user an empty sentence for a beat. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "signout"
                ? t("devices.confirm.signOutTitle")
                : confirm?.kind === "all"
                  ? t("devices.confirm.allTitle")
                  : t("devices.confirm.oneTitle", {
                      label: confirm?.kind === "one" ? confirm.device.label : "",
                    })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "signout"
                ? t("devices.confirm.signOutDescription")
                : confirm?.kind === "all"
                  ? t("devices.confirm.allDescription")
                  : t("devices.confirm.oneDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("security.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm?.kind === "one") handleRevokeOne(confirm.device);
                else if (confirm?.kind === "all") handleRevokeAll();
                else if (confirm?.kind === "signout") handleSignOutOthers();
              }}
            >
              {confirm?.kind === "signout"
                ? t("devices.sessions.signOutOthers")
                : t("devices.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
