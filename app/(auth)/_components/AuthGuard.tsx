"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { FullLoader } from "@/components/Loader";

function AuthGuardContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      const redirectUrl = searchParams.get("redirect");
      router.replace(redirectUrl || "/home");
    }
  }, [isAuthenticated, loading, router, searchParams]);

  if (loading) {
    return <FullLoader text="Loading" />;
  }

  if (isAuthenticated) {
    return <FullLoader text="Redirecting" />;
  }

  return <>{children}</>;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<FullLoader text="Loading" />}>
      <AuthGuardContent>{children}</AuthGuardContent>
    </Suspense>
  );
}
