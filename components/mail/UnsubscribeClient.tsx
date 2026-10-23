"use client";

// components/mail/UnsubscribeClient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The unsubscribe page's body (app/(root)/email/unsubscribe/[token]): shows the masked address it is
// about, unsubscribes on the button, offers "Subscribe again" after. A link that no longer works says
// so and points to account settings, where a signed-in player can change it.
// CALLS: GET/POST mail/unsubscribe/<token>/, POST mail/resubscribe/<token>/ (lib/mailApi.ts
// mailUnsubscribe; no session). i18n: emailPrefs (fr/pt by hand).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { mailUnsubscribe } from "@/lib/mailApi";

type State = { kind: "loading" } | { kind: "invalid" } | { kind: "ready"; email: string; subscribed: boolean } | { kind: "error" };

export function UnsubscribeClient({ token }: { token: string }) {
  const t = useTranslations("emailPrefs");
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mailUnsubscribe
      .state(token)
      .then((s) => setState({ kind: "ready", email: s.email, subscribed: s.subscribed }))
      .catch((err) => setState({ kind: err?.response?.status === 404 ? "invalid" : "error" }));
  }, [token]);

  const act = async (subscribe: boolean) => {
    if (state.kind !== "ready") return;
    setBusy(true);
    try {
      const res = subscribe ? await mailUnsubscribe.resubscribe(token) : await mailUnsubscribe.unsubscribe(token);
      setState({ ...state, subscribed: res.subscribed });
    } catch {
      setState({ kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container mx-auto flex min-h-[60vh] items-center justify-center py-10">
      <div className="w-full max-w-lg rounded-md bg-card p-6 text-center shadow-sm md:p-8">
        {state.kind === "loading" && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
        {state.kind === "invalid" && (
          <>
            <h1 className="text-2xl font-bold text-primary">{t("unInvalidTitle")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("unInvalidBody")}</p>
            <Button asChild className="mt-5">
              <Link href="/profile/security#email-news">{t("toSettings")}</Link>
            </Button>
          </>
        )}
        {state.kind === "error" && (
          <>
            <h1 className="text-2xl font-bold text-primary">{t("unErrorTitle")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("unErrorBody")}</p>
          </>
        )}
        {state.kind === "ready" &&
          (state.subscribed ? (
            <>
              <h1 className="text-2xl font-bold text-primary">{t("unTitle")}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t("unBody", { email: state.email })}</p>
              <Button className="mt-5" disabled={busy} onClick={() => void act(false)}>
                {t("unButton")}
              </Button>
              <p className="mt-4 text-xs text-muted-foreground">{t("unKeep")}</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-primary">{t("unDoneTitle")}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t("unDoneBody")}</p>
              <Button className="mt-5" variant="secondary" disabled={busy} onClick={() => void act(true)}>
                {t("unAgain")}
              </Button>
              <p className="mt-4 text-xs text-muted-foreground">{t("unKeep")}</p>
            </>
          ))}
      </div>
    </main>
  );
}
