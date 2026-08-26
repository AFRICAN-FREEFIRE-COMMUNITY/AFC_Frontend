"use client";

// ConnectedAccounts (owner 2026-08-26)
// ──────────────────────────────────────────────────────────────────────────────────────────────
// The TOP section of /profile/connected-apps: the outside accounts a player has linked to their
// AFC account (Discord, Google, v-ent.co), with Connect and Disconnect.
//
// The BOTTOM section of the same page is <ConnectedApps />, the opposite direction: partner orgs
// that use "Sign in with AFC". Two directions of the same idea, one page, because a player looking
// for "what is my AFC account attached to" should not have to know which direction they mean.
//
// DATA: lib/connections.ts -> /auth/connections/ (backend afc_auth/connections/views.py). The
// provider list comes from the BACKEND registry, so a provider with no credentials configured
// (v-ent.co today) never renders here and there is no frontend list to keep in sync.
//
// CONNECTING IS TWO STEPS, on purpose: ask the backend for the provider's consent URL with the
// session token in a HEADER, then navigate to the URL it returns. Pointing a link straight at the
// backend would send no Authorization header, and the old workaround (putting the session token in
// the query string) is the exact defect this feature removes.
//
// i18n: the `connectedApps.accounts` namespace. Dates render through <LocalTime>, in the viewer's
// timezone, never the server's UTC.
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import {
  type Connection,
  disconnectProvider,
  listConnections,
  startConnection,
} from "@/lib/connections";

/** The day this surface went live. NewBadge removes itself 5 days later, with nothing to clean up. */
const SHIPPED_ON = "2026-08-26";

export function ConnectedAccountsHeading() {
  const t = useTranslations("connectedApps.accounts");
  return (
    <div className="mb-4">
      <h2 className="flex items-center gap-2 text-xl font-bold text-primary">
        {t("title")}
        <NewBadge since={SHIPPED_ON} />
      </h2>
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
    </div>
  );
}

export function ConnectedAccounts() {
  const t = useTranslations("connectedApps.accounts");
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Separate state for the dialog's OPEN flag and the row it is about. Driving `open` off the same
  // state that supplies the title flashes "Disconnect ?" with a blank name while the dialog
  // animates out. The sibling ConnectedApps component carries the same split for the same reason;
  // it was a real bug there, found by watching the page rather than by a test.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState<Connection | null>(null);

  const labelFor = useCallback(
    (row: { provider: string; label: string }) => {
      // An unknown slug (a provider added to the backend before this file learns its name) falls
      // back to the backend's own English label rather than rendering a raw key on screen.
      const key = `provider.${row.provider}`;
      const translated = t(key as never);
      return translated === key ? row.label : translated;
    },
    [t],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setFailed(false);
    try {
      setRows(await listConnections(token));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // The oauth2 flow returns as a full page load carrying ?connected= or ?connect_error=. Report it
  // once, then strip the parameter so a refresh does not repeat the toast.
  useEffect(() => {
    const connected = searchParams.get("connected");
    const failure = searchParams.get("connect_error");
    if (!connected && !failure) return;

    const slug = connected || "";
    const name = slug ? labelFor({ provider: slug, label: slug }) : "";
    if (connected) {
      toast.success(t("toast.connected", { provider: name }));
    } else if (failure === "expired") {
      toast.error(t("toast.errorExpired"));
    } else if (failure === "cancelled") {
      toast.message(t("toast.errorCancelled"));
    } else if (failure === "already_linked") {
      toast.error(t("toast.errorAlreadyLinked", { provider: name }));
    } else {
      toast.error(t("toast.errorProvider", { provider: name }));
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete("connected");
    next.delete("connect_error");
    const query = next.toString();
    router.replace(`/profile/connected-apps${query ? `?${query}` : ""}`);
    void load();
  }, [searchParams, router, t, load, labelFor]);

  const onConnect = async (row: Connection) => {
    if (!token) return;
    setBusy(row.provider);
    try {
      const authorizeUrl = await startConnection(
        token,
        row.provider,
        "/profile/connected-apps",
      );
      window.location.href = authorizeUrl;
    } catch {
      toast.error(t("toast.connectFailed", { provider: labelFor(row) }));
      setBusy(null);
    }
  };

  const onDisconnect = async () => {
    if (!token || !pending) return;
    const label = labelFor(pending);
    setBusy(pending.provider);
    setConfirmOpen(false);
    try {
      setRows(await disconnectProvider(token, pending.provider));
      toast.success(t("toast.disconnected", { provider: label }));
    } catch {
      toast.error(t("toast.disconnectFailed", { provider: label }));
    } finally {
      setBusy(null);
      setPending(null);
    }
  };

  if (loading) {
    // A real skeleton, not a spinner: the row count is known and the shape does not jump when the
    // data lands.
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-20 rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (failed) {
    return (
      <div className="rounded-md bg-muted p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("loadError")}</p>
        <Button variant="secondary" className="mt-3" onClick={() => void load()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const label = labelFor(row);
        return (
          // border-0 is deliberate and must stay: shadcn's Card ships a 1px border, and the house
          // rule bans building structure out of hairlines. The row is separated from the page by a
          // FILLED surface one step off the background plus spacing, never by a stroke.
          <Card key={row.provider} className="bg-card rounded-md border-0 shadow-sm">
            <CardContent className="flex flex-wrap items-center gap-4 p-4">
              {row.avatar_url ? (
                <Image
                  src={row.avatar_url}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {label.slice(0, 1)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="font-semibold">{label}</p>
                {row.connected ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {row.username}
                    {row.connected_at ? (
                      <>
                        {" "}
                        {t("connectedOn")} <LocalTime value={row.connected_at} />
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("notConnected")}</p>
                )}
              </div>

              {row.connected ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy === row.provider}
                  onClick={() => {
                    // Disabled WITH A REASON rather than failing on tap: this player has no
                    // password and no second provider, so removing this link would lock them out
                    // permanently. The backend refuses it too, with 409 last_credential.
                    if (!row.can_disconnect) {
                      toast.error(t("lastCredential.description", { provider: label }));
                      return;
                    }
                    setPending(row);
                    setConfirmOpen(true);
                  }}
                >
                  {t("disconnect")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={busy === row.provider}
                  onClick={() => void onConnect(row)}
                >
                  {t("connect")}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("confirm.title", { provider: pending ? labelFor(pending) : "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirm.description", { provider: pending ? labelFor(pending) : "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onDisconnect()}>
              {t("confirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
