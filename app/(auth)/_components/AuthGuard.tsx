"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { FullLoader } from "@/components/Loader";
import { useTranslations } from "next-intl";
import { needsSsoHandoff, withSsoHandoff } from "@/lib/ssoHandoff";

function AuthGuardContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Root namespace (messages/en/root.json, common.* keys): the full-screen
  // loader/redirect labels shown while this guard checks the auth session and
  // bounces already-logged-in users away from the auth pages.
  const t = useTranslations("root");

  useEffect(() => {
    if (loading || !isAuthenticated) return;

    const redirectUrl = searchParams.get("redirect");
    if (!redirectUrl) {
      router.replace("/home");
      return;
    }

    // ── "Sign in with AFC": hand the session across to the API host ──────────────────
    // THIS GUARD is what bounces an already-signed-in player off /login, and it is the
    // half of the loop that lives on our side (owner report 2026-08-30, V-ENT):
    //
    //   partner -> api.../sso/authorize/ -> here -> back to authorize -> here -> forever
    //
    // The OIDC authorize view identifies a player by the `auth_token` cookie, which
    // AuthContext sets with no `domain`. That makes it host-only to this origin, so it
    // never reaches api.africanfreefirecommunity.com. Authorize therefore saw an anonymous
    // visitor every single time and bounced straight back to us, and we sent them back.
    //
    // Local development hid it: both halves run on 127.0.0.1 with different ports, and
    // cookies ignore the port, so the cookie DOES arrive there.
    //
    // withSsoHandoff swaps this session for a single-use code and puts only that in the
    // URL; the backend exchanges it for a real session and strips it. On any failure it
    // returns the URL unchanged, which degrades to the old bounce rather than an error
    // page. See lib/ssoHandoff.ts and backend afc_sso/handoff.py.
    if (needsSsoHandoff(redirectUrl)) {
      let cancelled = false;
      void withSsoHandoff(redirectUrl).then((url) => {
        // window.location, NOT router.replace: this is a different ORIGIN and the Next
        // router is for in-app routes only.
        if (!cancelled) window.location.replace(url);
      });
      return () => {
        cancelled = true;
      };
    }

    router.replace(redirectUrl);
  }, [isAuthenticated, loading, router, searchParams]);

  if (loading) {
    return <FullLoader text={t("common.loading")} />;
  }

  if (isAuthenticated) {
    return <FullLoader text={t("common.redirecting")} />;
  }

  return <>{children}</>;
}

// Suspense fallback: useTranslations cannot run here (this is the boundary that
// renders before AuthGuardContent suspends), so we render the loader without a
// text label. The localized "Loading..." appears the moment the content mounts.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<FullLoader />}>
      <AuthGuardContent>{children}</AuthGuardContent>
    </Suspense>
  );
}
