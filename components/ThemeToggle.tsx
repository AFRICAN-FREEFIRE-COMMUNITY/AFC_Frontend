"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
// Shared-chrome theme strings live in messages/en/common.json under "common".
import { useTranslations } from "next-intl";

export function ThemeToggle({ hide = true }: { hide?: boolean }) {
  const { setTheme } = useTheme();
  const t = useTranslations("common");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={hide ? "hidden md:flex" : "flex"} asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">{t("theme.toggle")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="text-xs font-medium"
          onClick={() => setTheme("light")}
        >
          {t("theme.light")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-xs font-medium"
          onClick={() => setTheme("dark")}
        >
          {t("theme.dark")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-xs font-medium"
          onClick={() => setTheme("system")}
        >
          {t("theme.system")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
