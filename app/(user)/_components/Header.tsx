import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { homeNavLinks } from "@/constants";
import Link from "next/link";
import React from "react";
import { MobileNavbar } from "./MobileNavbar";
import { IconBell, IconShoppingCart } from "@tabler/icons-react";

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <Link href={"/home"} className="flex items-center space-x-2">
          <Logo size="small" />
          <span className="text-base md:text-xl font-bold bg-gradient-to-r from-primary to-[var(--gold)] bg-clip-text text-transparent line-clamp-1 hover:text-primary">
            Africa Freefire Community
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-2 font-medium text-muted-foreground text-sm">
          {homeNavLinks.map(({ slug, label }, index) => (
            <Button size={"sm"} key={index} asChild variant={"ghost"}>
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
          <Button variant={"ghost"} size={"icon"}>
            <IconBell />
          </Button>
          <Button variant={"ghost"} size={"icon"}>
            <IconShoppingCart />
          </Button>
          <MobileNavbar />
        </div>
      </div>
    </header>
  );
};
