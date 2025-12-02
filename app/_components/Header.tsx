"use client";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { homeNavLinks } from "@/constants";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

export const Header = () => {
  const pathname = usePathname();

  const isActive = (slug: string) =>
    pathname === slug || pathname.startsWith(`${slug}/`);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href={"/"} className="flex items-center space-x-2">
          <Logo size="small" />
          <span className="text-base md:text-xl font-bold bg-gradient-to-r from-primary to-[var(--gold)] bg-clip-text text-transparent line-clamp-1 hover:text-primary">
            Africa Freefire Community
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
        {/* <nav className="hidden md:flex items-center font-medium gap-2">
          <Button disabled size={"sm"} variant={"ghost"}>
            Tournaments
          </Button>
          <Button disabled size={"sm"} variant={"ghost"}>
            Rankings
          </Button>
          <Button
            size={"sm"}
            asChild
            className={isActive("teams") ? "text-primary" : ""}
            variant={isActive("teams") ? "secondary" : "ghost"}
          >
            <Link
              href="/teams"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              Teams
            </Link>
          </Button>
          <Button
            size={"sm"}
            asChild
            className={isActive("news") ? "text-primary" : ""}
            variant={isActive("news") ? "secondary" : "ghost"}
          >
            <Link
              href="/news"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              News
            </Link>
          </Button>
        </nav> */}

        <div className="flex items-center space-x-3">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost" size="md" className="hidden md:block">
              Sign In
            </Button>
          </Link>
          <Link href="/create-account">
            <Button size="md" variant={"gradient"}>
              Join Now
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};
