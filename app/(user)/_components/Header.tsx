"use client";

import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import React, { useEffect, useState, useCallback } from "react";
import { MobileNavbar } from "./MobileNavbar";
// One-time "your new dashboard lives HERE" callout pointing at the menu button below.
import { DashboardIntroCoachmark } from "./DashboardIntroCoachmark";
import { IconShoppingCart, IconSparkles } from "@tabler/icons-react";
// Force-opens the first-time welcome tour, ignoring the seen flags (replay).
import { openWelcomeTour } from "./WelcomeTour";
import { useCart } from "@/contexts/CartContext";
import { CartSheet } from "@/components/CartSheet";
import { Badge } from "@/components/ui/badge";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationDropdown } from "./NotificationDropdown";
import axios from "axios";
import { env } from "@/lib/env";
import { homeNavLinks } from "@/constants/nav-links";

export const Header = () => {
  const pathname = usePathname();

  const { getItemCount, setIsCartOpen } = useCart();

  // This will now pull from the context state updated by your API calls
  const itemCount = getItemCount();

  const { user, token } = useAuth();

  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = useCallback(async () => {
    if (!user || !token) return;

    try {
      const res = await axios(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-notifications/`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      setNotifications(res.data.notifications);
    } catch (error) {}
  }, [user, token]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Calculate unread notification count
  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  const isActive = (slug: string) =>
    pathname === slug || pathname.startsWith(`${slug}/`);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/50 backdrop-blur-sm">
        <div className="container mx-auto h-20 flex items-center justify-between">
          <Link href={"/home"} className="flex items-center space-x-2">
            <Logo size="small" />
            <span className="text-base md:text-xl font-bold bg-gradient-to-r from-primary to-[var(--gold)] bg-clip-text text-transparent line-clamp-1 hover:text-primary">
              African Freefire Community
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-2 font-medium text-muted-foreground text-sm">
            {homeNavLinks.map(({ slug, label }, index) => (
              <Button
                size={"sm"}
                key={index}
                asChild
                className={isActive(slug) ? "text-primary" : ""}
                variant={isActive(slug) ? "secondary" : "ghost"}
              >
                <Link
                  href={slug}
                  className="hover:text-primary transition-colors"
                >
                  {label}
                </Link>
              </Button>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            <NotificationDropdown
              notifications={notifications}
              unreadCount={unreadCount}
              onNotificationUpdate={fetchNotifications}
            />
            {/* Replay the first-time welcome tour. Always available; force-opens the
                animated tour (mounted in (user)/layout.tsx) regardless of the seen flags.
                Same ghost icon-button style as the ThemeToggle next to it. */}
            <Button
              variant="ghost"
              size="icon"
              onClick={openWelcomeTour}
              aria-label="Replay welcome tour"
              title="Replay welcome tour"
            >
              <IconSparkles className="h-[1.2rem] w-[1.2rem]" />
              <span className="sr-only">Replay welcome tour</span>
            </Button>
            <ThemeToggle />
            {user ? (
              <>
                <Button
                  variant={"ghost"}
                  size={"icon"}
                  className="relative"
                  onClick={() => setIsCartOpen(true)}
                >
                  <IconShoppingCart />
                  {itemCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] font-bold"
                    >
                      {itemCount > 99 ? "99+" : itemCount}
                    </Badge>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  asChild
                  variant="ghost"
                  size="md"
                  className="hidden md:flex"
                >
                  <Link href="/login">Log in</Link>
                </Button>
                <Button
                  className="hidden md:flex"
                  asChild
                  size="md"
                  variant={"gradient"}
                >
                  <Link href="/create-account">Join Now</Link>
                </Button>
                <Button
                  asChild
                  className="md:hidden"
                  size="md"
                  variant={"gradient"}
                >
                  <Link href="/login">Login</Link>
                </Button>
              </>
            )}
            <MobileNavbar />
          </div>
        </div>
      </header>
      {/* One-time dashboard intro callout: anchors visually under the MobileNavbar hamburger
          (top right), shows only on the first login after a dashboard was granted. */}
      <DashboardIntroCoachmark />
      <CartSheet />
    </>
  );
};
