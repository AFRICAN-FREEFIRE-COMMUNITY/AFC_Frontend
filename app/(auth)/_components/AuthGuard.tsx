"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { FullLoader } from "@/components/Loader";
import { useTranslations } from "next-intl";

function AuthGuardContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Root namespace (messages/en/root.json, common.* keys): the full-screen
  // loader/redirect labels shown while this guard checks the auth session and
  // bounces already-logged-in users away from the auth pages.
  const t = useTranslations("root");

  useEffect(() => {
    if (!loading && isAuthenticated) {
      const redirectUrl = searchParams.get("redirect");
      router.replace(redirectUrl || "/home");
    }
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
