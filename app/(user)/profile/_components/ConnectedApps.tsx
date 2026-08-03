"use client";

// ConnectedApps (owner 2026-08-03)
// ──────────────────────────────────────────────────────────────────────────────────────────────
// The player's control panel for "Sign in with AFC". Rendered at /profile/connected-apps
// (app/(user)/profile/connected-apps/page.tsx wraps this in ProtectedRoute, the same idiom as
// SavedAddresses).
//
// WHY IT EXISTS: AFC is now an OpenID Connect provider, so partner organisations can offer a
// "Sign in with AFC" button. The consent screen a player approves
// (backend/afc_sso/templates/afc_sso/authorize.html) promises "You can remove this at any time
// from Connected apps in your AFC profile". This is that page. Without it the site makes a
// promise it cannot keep.
//
// Each card names the org, lists in plain language exactly what it can read, and offers a
// Disconnect button behind an AlertDialog confirm (deliberate: disconnecting signs people out of
// the partner site, so it should not be a single stray tap).
//
// DATA: lib/connectedApps.ts (axios + Bearer session token from AuthContext), hitting
// /sso/me/connected-apps/. The permission lines are generated BACKEND side from the same
// describe_scopes() the consent screen uses, so the promise and this receipt cannot drift apart.
//
// i18n: the `connectedApps` namespace (messages/en|fr|pt/connectedApps.json) via
// useTranslations("connectedApps"). Dates render through <LocalTime>, so they show in the
// viewer's own timezone rather than the server's UTC.
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
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
import { PageHeader } from "@/components/PageHeader";
import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { IconPlugConnected, IconExternalLink, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  listConnectedApps,
  revokeConnectedApp,
  type ConnectedApp,
} from "@/lib/connectedApps";

export function ConnectedApps() {
  const t = useTranslations("connectedApps");
  const { token } = useAuth();

  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // The app the confirm dialog is asking about, and whether it is open, kept as TWO
  // pieces of state on purpose. Driving `open` off "pendingRevoke !== null" and clearing
  // it on confirm blanks the name out while the dialog is still animating closed, so the
  // player sees "Disconnect ?" for a beat, and unmounting mid-animation leaves Radix's
  // pointer-events lock on <body>, which freezes the whole page.
  const [pendingRevoke, setPendingRevoke] = useState<ConnectedApp | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Disables just the one card's button while its request is in flight, rather than
  // locking the whole list.
  const [revokingId, setRevokingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setFailed(false);
    try {
      setApps(await listConnectedApps(token));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRevoke(app: ConnectedApp) {
    if (!token) return;
    // Close first, then do the work. The dialog keeps its copy of `app` for the exit
    // animation because pendingRevoke is deliberately NOT cleared here.
    setConfirmOpen(false);
    setRevokingId(app.application_id);
    try {
      await revokeConnectedApp(token, app.application_id);
      // Drop it locally rather than refetching: the backend call is idempotent and
      // authoritative, and this keeps the list from flickering on a slow connection.
      setApps((prev) => prev.filter((a) => a.application_id !== app.application_id));
      toast.success(t("toast.revoked", { name: app.name }));
    } catch {
      toast.error(t("toast.revokeFailed", { name: app.name }));
    } finally {
      setRevokingId(null);
    }
  }

  if (loading) return <FullLoader />;

  return (
    <div className="container mx-auto py-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {failed ? (
        <Card className="mt-4">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">{t("loadError")}</p>
            <Button variant="outline" onClick={load}>
              {t("retry")}
            </Button>
          </CardContent>
        </Card>
      ) : apps.length === 0 ? (
        // The common case by far: most players have never used AFC to sign in elsewhere.
        <Card className="mt-4">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IconPlugConnected className="size-10 text-muted-foreground" />
            <h3 className="text-base font-semibold">{t("empty.title")}</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              {t("empty.description")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {apps.map((app) => (
            <Card key={app.application_id}>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  {app.logo_url ? (
                    <Image
                      src={app.logo_url}
                      alt=""
                      width={40}
                      height={40}
                      className="size-10 shrink-0 rounded-md object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                      <IconPlugConnected className="size-5 text-muted-foreground" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold">{app.name}</h3>
                    {/* Label and date are separate nodes rather than a t.rich placeholder.
                        t.rich returns an ARRAY when a value placeholder sits mid-string, and
                        React then wants a key on each part, which is a warning nobody can act
                        on from the outside. The date still has to be a <LocalTime> element
                        (not a formatted string) so it renders in the VIEWER's timezone and
                        does not mismatch during hydration. Every locale here puts the date
                        last, so a trailing date reads correctly in en, fr and pt. */}
                    {app.granted_at ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t("card.connectedOn")}{" "}
                        <LocalTime value={app.granted_at} mode="date" />
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {app.last_used_at ? (
                        <>
                          {t("card.lastUsed")}{" "}
                          <LocalTime value={app.last_used_at} mode="date" />
                        </>
                      ) : (
                        t("card.neverUsed")
                      )}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium">{t("card.canSee")}</p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                    {app.scopes.map((line, i) => (
                      <li key={app.scope_codes[i] ?? line}>{line}</li>
                    ))}
                  </ul>
                </div>

                {/* Stacked on a phone, inline from sm up: two full-width buttons side by side
                    are unreadable at 390px. */}
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  {app.homepage_url ? (
                    <Button variant="outline" className="w-full sm:w-auto" asChild>
                      <a href={app.homepage_url} target="_blank" rel="noopener noreferrer">
                        <IconExternalLink className="size-4" />
                        {t("card.visitSite")}
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    variant="destructive"
                    className="w-full sm:w-auto"
                    disabled={revokingId === app.application_id}
                    onClick={() => {
                      setPendingRevoke(app);
                      setConfirmOpen(true);
                    }}
                  >
                    <IconTrash className="size-4" />
                    {t("card.disconnect")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* One dialog for the whole list, driven by pendingRevoke, rather than one per card. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("confirm.title", { name: pendingRevoke?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirm.description", { name: pendingRevoke?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingRevoke && handleRevoke(pendingRevoke)}
            >
              {t("confirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
