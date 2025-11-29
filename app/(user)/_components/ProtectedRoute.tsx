"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { FullLoader } from "@/components/Loader";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/news", "/about", "/contact"];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  useEffect(() => {
    if (!loading && !isAuthenticated && !isPublicRoute) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, loading, router, pathname, isPublicRoute]);

  if (loading) {
    return <FullLoader text="Loading" />;
  }

  // Allow access to public routes without authentication
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // For protected routes, redirect if not authenticated
  if (!isAuthenticated) {
    return <FullLoader text="Redirecting" />;
  }

  return <>{children}</>;
}
