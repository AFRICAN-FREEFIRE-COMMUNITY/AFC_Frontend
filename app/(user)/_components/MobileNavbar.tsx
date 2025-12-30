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
import { adminNavLinks, homeNavLinksMobile } from "@/constants";
import { useAuth } from "@/contexts/AuthContext";
import { useSignout } from "@/hooks/use-signout";
import { IconLogout, IconMenu2, IconMoon, IconSun } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "next-themes";

export function MobileNavbar() {
  const [open, setOpen] = useState(false);
  const handleSignout = useSignout();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const { user, isAdmin } = useAuth();

  // 1. Helper function to check permissions
  // const canAccess = (linkAllowedRoles?: string[]) => {
  //   console.log(linkAllowedRoles);

  //   // If no roles are specified, all admins can see it
  //   if (!linkAllowedRoles) return true;

  //   // Check if current user's role is in the allowed list
  //   return user?.role || user?.roles.includes && linkAllowedRoles.includes(user.role);
  // };

  const canAccess = (linkAllowedRoles?: string[]) => {
    // 1. If the user is a top-level admin, bypass all checks
    if (
      user?.role === "super_admin" ||
      user?.role === "head_admin" ||
      isAdmin
    ) {
      return true;
    }

    // 2. If the link has no restrictions, any admin who reached this block can see it
    if (!linkAllowedRoles || linkAllowedRoles.length === 0) {
      return true;
    }

    // 3. Check for single role (user.role)
    if (user?.role && linkAllowedRoles.includes(user.role)) {
      return true;
    }

    // 4. Check for multiple roles (user.roles array)
    if (user?.roles && Array.isArray(user.roles)) {
      // Check if ANY of the user's roles exist in the link's allowed list
      return user.roles.some((role: string) => linkAllowedRoles.includes(role));
    }

    return false;
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
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
              ({ icon, slug, label, comingSoon, newLink, beta }, index) => {
                const Icon = icon;
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
                      {label} {newLink && <Badge>New</Badge>}{" "}
                      {beta && <Badge variant={"secondary"}>Beta</Badge>}
                    </Link>
                  </Button>
                );
              }
            )}
            {/* {(user?.role === "moderator" ||
              user?.role === "super_admin" ||
              user?.role === "admin" ||
              isAdmin) && (
              <> */}
            {(user?.roles?.length > 0 || isAdmin) && (
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
                    )
                  )}
                {/* {adminNavLinks
                  .filter((link) => canAccess(link.allowedRoles)) // Filter links based on role
                  .map(({ icon, slug, label, comingSoon }, index) => {
                    const Icon = icon;
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
                          {label}
                        </Link>
                      </Button>
                    );
                  })} */}
                {/* {adminNavLinks.map(
                  ({ icon, slug, label, comingSoon }, index) => {
                    const Icon = icon;
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
                          {label}
                        </Link>
                      </Button>
                    );
                  }
                )} */}
              </>
            )}
          </div>
        </ScrollArea>
        <SheetFooter className="mb-10">
          {user === null ? (
            <>
              <SheetClose asChild>
                <Button variant={"secondary"}>
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
