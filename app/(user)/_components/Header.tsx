"use client";

import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { homeNavLinks } from "@/constants";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { MobileNavbar } from "./MobileNavbar";
import { IconShoppingCart } from "@tabler/icons-react";
import { useCart } from "@/contexts/CartContext";
import { CartSheet } from "@/components/CartSheet";
import { Badge } from "@/components/ui/badge";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationDropdown } from "./NotificationDropdown";
import axios from "axios";
import { env } from "@/lib/env";

export const Header = () => {
  const pathname = usePathname();

  const { getItemCount, setIsCartOpen } = useCart();
  const itemCount = getItemCount();

  const { user, token } = useAuth();

  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!user || !token) return;

    const fetchNotifications = async () => {
      const res = await axios(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-notifications/`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setNotifications(res.data.notifications);
    };
    fetchNotifications();
  }, [user, token]);

  const isActive = (slug: string) =>
    pathname === slug || pathname.startsWith(`${slug}/`);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
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

          <div className="flex items-center gap-3">
            <NotificationDropdown notifications={notifications} />
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
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
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
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild size="md" variant={"gradient"}>
                  <Link href="/create-account">Join Now</Link>
                </Button>
              </>
            )}
            <MobileNavbar />
          </div>
        </div>
      </header>
      <CartSheet />
    </>
  );
};
