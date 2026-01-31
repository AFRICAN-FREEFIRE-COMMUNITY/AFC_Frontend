"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { FullLoader } from "@/components/Loader";
import { adminNavLinks } from "@/constants/nav-links";

const PUBLIC_ROUTES = ["/news", "/about", "/contact", "/unauthorized"];

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export function ProtectedRoute({
  children,
  adminOnly = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, loading, user, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Helper to normalize "Head Admin" -> "head_admin"
  const normalizeRole = (role: string) =>
    role.toLowerCase().replace(/\s+/g, "_");

  const hasRequiredAdminRole = () => {
    if (!user || !isAdmin) return false;

    // 1. Get user roles normalized
    const userRoles = Array.isArray(user.roles)
      ? user.roles.map(normalizeRole)
      : [normalizeRole(user.role || "")];

    // 2. Head Admins/Super Admins can go anywhere
    if (userRoles.includes("head_admin") || userRoles.includes("super_admin"))
      return true;

    // 3. Find the current admin route's required roles from your constants
    // This automatically checks the allowedRoles for the current URL
    const currentConfig = adminNavLinks.find((link) =>
      pathname.startsWith(link.slug),
    );

    // If we found a config for this route and it has restricted roles
    if (currentConfig?.allowedRoles) {
      return userRoles.some((role) =>
        currentConfig.allowedRoles?.includes(role),
      );
    }

    // 4. Default to true if no specific role restriction is found for this admin path
    return true;
  };

  const hasAccess = adminOnly ? hasRequiredAdminRole() : isAuthenticated;

  useEffect(() => {
    if (!loading) {
      // 1. Not logged in -> Login
      if (!isAuthenticated && !isPublicRoute) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      // 2. Logged in but failed permission check -> Unauthorized
      if (
        isAuthenticated &&
        !isPublicRoute &&
        adminOnly &&
        !hasRequiredAdminRole()
      ) {
        router.replace("/unauthorized");
      }
    }
  }, [isAuthenticated, loading, pathname, adminOnly, isAdmin]);

  if (loading) {
    return <FullLoader text="Loading" />;
  }

  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Final check to prevent content flash while redirecting
  if (!hasAccess) {
    return <FullLoader text="Verifying Permissions..." />;
  }

  return <>{children}</>;
}
