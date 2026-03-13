"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, ReactNode } from "react";
import { FullLoader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { IconLogout, IconStar } from "@tabler/icons-react";
import { Logo } from "@/components/Logo";
import Link from "next/link";

function SponsorGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading, hasRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isSponsor = hasRole("sponsor_admin");

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
      <div>
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/50 backdrop-blur-sm">
          <div className="container mx-auto h-20 flex items-center justify-between">
            <Link href={"/home"} className="flex items-center space-x-2">
              <Logo size="small" />
              <span className="text-base md:text-xl font-bold bg-gradient-to-r from-primary to-[var(--gold)] bg-clip-text text-transparent line-clamp-1 hover:text-primary">
                African Freefire Community
              </span>
            </Link>
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
