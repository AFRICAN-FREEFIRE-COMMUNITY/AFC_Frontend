"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { FullLoader } from "@/components/Loader";
import { adminNavLinks } from "@/constants/nav-links";
import { useAdminHome } from "@/components/nav-main";

// "The admin dashboard" addresses: refused ones send the person to the first page their menu
// offers (useAdminHome) instead of /unauthorized (inbox #58).
const ADMIN_HOME_PATHS = ["/a", "/a/dashboard"];

const PUBLIC_ROUTES = ["/news", "/about", "/contact", "/unauthorized", "/rankings"];

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export function ProtectedRoute({
  children,
  adminOnly = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, loading, user, isAdmin } = useAuth();
  // Loader copy shown while auth resolves / permissions verify (namespace == home.json).
  const t = useTranslations("home");
  const router = useRouter();
  const pathname = usePathname();
  const adminHome = useAdminHome();

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Helper to normalize "Head Admin" -> "head_admin"
  const normalizeRole = (role: string) =>
    role.toLowerCase().replace(/\s+/g, "_");

  const hasRequiredAdminRole = () => {
    if (!user || !isAdmin) return false;

    // 1. Get user roles normalized (always include both user.role and user.roles)
    const userRoles = [
      ...( Array.isArray(user.roles) ? user.roles.map(normalizeRole) : [] ),
      normalizeRole(user.role || ""),
    ].filter(Boolean);

    // 2. Head Admins/Super Admins can go anywhere
    if (userRoles.includes("head_admin") || userRoles.includes("super_admin"))
      return true;

    // 3. Find the current admin route's required roles from your constants
    // This automatically checks the allowedRoles for the current URL
    // The LONGEST matching slug decides (inbox #54, 2026-09-26). The first match used to win, so
    // /a/ocr-model/keys was judged by /a/ocr-model's head-admin-only rule and organizer admins were
    // turned away from a page their menu offered them. Only whole path segments match.
    const currentConfig = adminNavLinks
      .filter((link) => pathname === link.slug || pathname.startsWith(`${link.slug}/`))
      .sort((a, b) => b.slug.length - a.slug.length)[0];

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
        const toHome = ADMIN_HOME_PATHS.includes(pathname) && adminHome && adminHome !== pathname;
        router.replace(toHome ? adminHome : "/unauthorized");
      }
    }
  }, [isAuthenticated, loading, pathname, adminOnly, isAdmin, adminHome]);

  if (loading) {
    return <FullLoader text={t("protectedRoute.loading")} />;
  }

  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Final check to prevent content flash while redirecting
  if (!hasAccess) {
    return <FullLoader text={t("protectedRoute.verifying")} />;
  }

  return <>{children}</>;
}
