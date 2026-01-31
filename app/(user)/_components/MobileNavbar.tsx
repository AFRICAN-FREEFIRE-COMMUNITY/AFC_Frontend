"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useSignout } from "@/hooks/use-signout";
import { IconLogout, IconMenu2, IconMoon, IconSun } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "next-themes";
import { adminNavLinks, homeNavLinksMobile } from "@/constants/nav-links";

export function MobileNavbar() {
  const [open, setOpen] = useState(false);
  const handleSignout = useSignout();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const { user, isAdmin } = useAuth();

  const normalizeRole = (role: string) =>
    role.toLowerCase().replace(/\s+/g, "_");

  const canAccess = (linkAllowedRoles?: string[]) => {
    if (!user || !isAdmin) return false;

    // Normalize user's roles
    const userRoles = Array.isArray(user.roles)
      ? user.roles.map(normalizeRole)
      : [normalizeRole(user.role || "")];

    // 1. Super Admin / Head Admin Bypass
    if (userRoles.includes("super_admin") || userRoles.includes("head_admin")) {
      return true;
    }

    // 2. Open access links (for any admin)
    if (!linkAllowedRoles || linkAllowedRoles.length === 0) {
      return true;
    }

    // 3. Match specific roles
    return userRoles.some((role) => linkAllowedRoles.includes(role));
  };

  const handleLinkClick = () => {
    setOpen(false);
  };

  const handleLogout = () => {
    setOpen(false);
    handleSignout();
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const isActive = (slug: string) =>
    pathname === slug || pathname.startsWith(`${slug}/`);

  const isNewLink = (addedAt?: string) => {
    if (!addedAt) return false;

    const dateAdded = new Date(addedAt);
    const today = new Date();

    // Calculate difference in milliseconds
    const diffInTime = today.getTime() - dateAdded.getTime();

    // Convert to days
    const diffInDays = diffInTime / (1000 * 3600 * 24);

    // Return true if it's between 0 and 5 days old
    return diffInDays >= 0 && diffInDays <= 5;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <style jsx global>{`
        @keyframes glow-pulse {
          0%,
          100% {
            box-shadow:
              0 0 5px rgba(34, 197, 94, 0.5),
              0 0 10px rgba(34, 197, 94, 0.3),
              0 0 15px rgba(34, 197, 94, 0.2);
            transform: scale(1);
          }
          50% {
            box-shadow:
              0 0 10px rgba(34, 197, 94, 0.8),
              0 0 20px rgba(34, 197, 94, 0.5),
              0 0 30px rgba(34, 197, 94, 0.3);
            transform: scale(1.05);
          }
        }

        .glow-new-badge {
          animation: glow-pulse 2s ease-in-out infinite;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          font-weight: 600;
          border: 1px solid rgba(34, 197, 94, 0.5);
        }
      `}</style>
      <SheetTrigger asChild>
        <Button size={"icon"} variant="ghost">
          <IconMenu2 />
        </Button>
      </SheetTrigger>
      <SheetContent className="h-screen">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Menu</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9"
            >
              <IconSun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <IconMoon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </SheetTitle>
          <SheetDescription>Navigation menu for AFC</SheetDescription>
        </SheetHeader>
        <ScrollArea className="overflow-y-auto">
          <div className="grid gap-1 container">
            {homeNavLinksMobile.map(
              ({ icon, slug, label, comingSoon, newLink, addedAt }, index) => {
                const Icon = icon;
                const showNewBadge = isNewLink(addedAt);
                return comingSoon ? (
                  <Button
                    className="justify-start"
                    key={index}
                    variant="ghost"
                    disabled
                  >
                    <Icon />
                    {label}
                    <Badge variant={"secondary"}>Soon</Badge>
                  </Button>
                ) : (
                  <Button
                    className="justify-start"
                    key={index}
                    asChild
                    variant={isActive(slug) ? "default" : "ghost"}
                    onClick={handleLinkClick}
                  >
                    <Link href={slug}>
                      <Icon />
                      {label}{" "}
                      {showNewBadge && (
                        <Badge
                          variant="default"
                          className="glow-new-badge text-xs text-white"
                        >
                          New
                        </Badge>
                      )}{" "}
                    </Link>
                  </Button>
                );
              },
            )}
            {/* {(user?.role === "moderator" ||
              user?.role === "super_admin" ||
              user?.role === "admin" ||
              isAdmin) && (
              <> */}
            {isAdmin && (
              <>
                <Separator />
                {adminNavLinks
                  .filter((link) => canAccess(link.allowedRoles)) // Core filtering logic
                  .map(({ icon: Icon, slug, label, comingSoon }, index) =>
                    comingSoon ? (
                      <Button
                        key={index}
                        className="justify-start"
                        variant="ghost"
                        disabled
                      >
                        <Icon size={18} className="mr-2" />
                        {label}
                        <Badge variant={"secondary"} className="ml-auto">
                          Soon
                        </Badge>
                      </Button>
                    ) : (
                      <Button
                        key={index}
                        className="justify-start"
                        asChild
                        variant={isActive(slug) ? "default" : "ghost"}
                        onClick={handleLinkClick}
                      >
                        <Link href={slug}>
                          <Icon size={18} className="mr-2" />
                          {label}
                        </Link>
                      </Button>
                    ),
                  )}
              </>
            )}
          </div>
        </ScrollArea>
        <SheetFooter className="mb-10">
          {user === null ? (
            <>
              <SheetClose asChild>
                <Button asChild variant={"secondary"}>
                  <Link href="/login">Log in</Link>
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button variant={"gradient"} asChild>
                  <Link href={"/create-account"}>Join now</Link>
                </Button>
              </SheetClose>
            </>
          ) : (
            <>
              <Button variant="secondary" asChild onClick={handleLinkClick}>
                <Link href="/profile">My profile</Link>
              </Button>
              <Button onClick={handleLogout} type="submit">
                <IconLogout />
                Logout
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
