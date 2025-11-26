"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullLoader } from "@/components/Loader";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/home");
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return <FullLoader text="Loading" />;
  }

  if (isAuthenticated) {
    return <FullLoader text="Redirecting" />;
  }

  return <>{children}</>;
}
