"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, ReactNode } from "react";
import { FullLoader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { IconLogout, IconStar } from "@tabler/icons-react";

function SponsorGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading, hasRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isSponsor = hasRole("sponsor");

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!isSponsor) {
      router.replace("/unauthorized");
    }
  }, [isAuthenticated, loading, isSponsor, pathname, router]);

  if (loading) return <FullLoader text="Loading" />;
  if (!isAuthenticated || !isSponsor)
    return <FullLoader text="Verifying Permissions..." />;

  return <>{children}</>;
}

export default function SponsorPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, logout } = useAuth();

  return (
    <SponsorGuard>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b bg-card sticky top-0 z-20">
          <div className="container flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <IconStar className="size-5 text-primary" />
              <span className="font-semibold text-sm">Sponsor Portal</span>
            </div>
            <div className="flex items-center gap-3">
              {user && (
                <span className="text-sm text-muted-foreground hidden sm:block">
                  {user.in_game_name}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground gap-1.5"
                onClick={logout}
              >
                <IconLogout className="size-4" />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 container py-8">{children}</main>
      </div>
    </SponsorGuard>
  );
}
