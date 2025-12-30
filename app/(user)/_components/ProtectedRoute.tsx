// "use client";

// import { useAuth } from "@/contexts/AuthContext";
// import { useRouter, usePathname } from "next/navigation";
// import { useEffect } from "react";
// import { FullLoader } from "@/components/Loader";

// // Routes that don't require authentication
// const PUBLIC_ROUTES = ["/news", "/about", "/contact"];

// export function ProtectedRoute({ children }: { children: React.ReactNode }) {
//   const { isAuthenticated, loading } = useAuth();
//   const router = useRouter();
//   const pathname = usePathname();

//   const isPublicRoute = PUBLIC_ROUTES.some(
//     (route) => pathname === route || pathname.startsWith(`${route}/`)
//   );

//   useEffect(() => {
//     if (!loading && !isAuthenticated && !isPublicRoute) {
//       router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
//     }
//   }, [isAuthenticated, loading, router, pathname, isPublicRoute]);

//   if (loading) {
//     return <FullLoader text="Loading" />;
//   }

//   // Allow access to public routes without authentication
//   if (isPublicRoute) {
//     return <>{children}</>;
//   }

//   // For protected routes, redirect if not authenticated
//   if (!isAuthenticated) {
//     return <FullLoader text="Redirecting" />;
//   }

//   return <>{children}</>;
// }

"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { FullLoader } from "@/components/Loader";

const PUBLIC_ROUTES = ["/news", "/about", "/contact", "/unauthorized"];

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean; // Prop to specify if this route needs admin roles
}

export function ProtectedRoute({
  children,
  adminOnly = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, loading, isAdminByRoleOrRoles } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // useEffect(() => {
  //   if (!loading) {
  //     // 1. If not logged in and trying to access a private route
  //     if (!isAuthenticated && !isPublicRoute) {
  //       router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
  //       return;
  //     }

  //     // 2. If logged in but lacks admin privileges for an admin route
  //     if (isAuthenticated && adminOnly && !isAdminByRoleOrRoles) {
  //       // Redirect to a custom 'No Access' page or home
  //       router.replace("/home?error=unauthorized");
  //     }
  //   }
  // }, [
  //   isAuthenticated,
  //   loading,
  //   router,
  //   pathname,
  //   isPublicRoute,
  //   adminOnly,
  //   isAdminByRoleOrRoles,
  // ]);

  // app/(user)/_components/ProtectedRoute.tsx

  useEffect(() => {
    if (!loading) {
      // 1. If not logged in and trying to access a private route
      if (!isAuthenticated && !isPublicRoute) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      // 2. If logged in but lacks admin privileges for an admin route
      if (isAuthenticated && adminOnly && !isAdminByRoleOrRoles) {
        // CHANGE THIS LINE BELOW:
        router.replace("/unauthorized");
      }
    }
  }, [
    isAuthenticated,
    loading,
    router,
    pathname,
    isPublicRoute,
    adminOnly,
    isAdminByRoleOrRoles,
  ]);

  if (loading) {
    return <FullLoader text="Loading" />;
  }

  // Allow public routes
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Prevent flicker: if it's adminOnly and they aren't admin, show loader while the useEffect redirect fires
  if (adminOnly && !isAdminByRoleOrRoles) {
    return <FullLoader text="Verifying Permissions..." />;
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return <FullLoader text="Redirecting to Login..." />;
  }

  return <>{children}</>;
}
