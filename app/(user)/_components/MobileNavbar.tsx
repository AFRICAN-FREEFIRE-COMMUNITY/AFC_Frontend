"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
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
import { IconLogout, IconMenu2 } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function MobileNavbar() {
  const [open, setOpen] = useState(false);
  const handleSignout = useSignout();
  const pathname = usePathname();

  const { user, isAdmin } = useAuth();

  const handleLinkClick = () => {
    setOpen(false);
  };

  const handleLogout = () => {
    setOpen(false);
    handleSignout();
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
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Navigation menu for AFC</SheetDescription>
        </SheetHeader>
        <ScrollArea className="overflow-y-auto">
          <div className="grid gap-1 container">
            {homeNavLinksMobile.map(
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
            )}
            {(user?.role === "moderator" ||
              user?.role === "super_admin" ||
              user?.role === "admin" ||
              isAdmin) && (
              <>
                <Separator />
                {adminNavLinks.map(
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
                )}
              </>
            )}
          </div>
        </ScrollArea>
        <SheetFooter>
          <Button variant="secondary" asChild onClick={handleLinkClick}>
            <Link href="/profile">My profile</Link>
          </Button>
          <Button onClick={handleLogout} type="submit">
            <IconLogout />
            Logout
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
