"use client";

// Admin sub-nav for the Rankings dashboard, mounted once by app/(a)/a/rankings/layout.tsx so
// every /a/rankings/* page shows it; order mirrors the admin workflow; role-gating is handled
// upstream by adminNavLinks (head_admin + metrics_admin) in constants/nav-links.ts.
//
// i18n: labels come from the rankings namespace (messages/{en,fr,pt}/rankings.json -> admin.nav.*).
// Client component, so it reads next-intl's useTranslations directly.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  IconLayoutDashboard, IconClipboardCheck, IconSettings, IconGhost2,
  IconBrandInstagram, IconCoin, IconAdjustments, IconHistory, IconCalculator,
  IconStack2, IconTrophy,
} from "@tabler/icons-react";

// `key` indexes into the admin.nav.* message block; the English value lives there, never here.
const ITEMS = [
  { href: "/a/rankings", key: "overview", icon: IconLayoutDashboard },
  // Ladders = the read-only preview of the team + player standings that publishing exposes
  // (owner 2026-08-03: an admin was asked to publish a ladder they had no way to look at).
  { href: "/a/rankings/ladders", key: "ladders", icon: IconTrophy },
  { href: "/a/rankings/scoring-config", key: "scoringConfig", icon: IconCalculator },
  { href: "/a/rankings/tournament-tiers", key: "tournamentTiers", icon: IconStack2 },
  { href: "/a/rankings/results", key: "resultMarkers", icon: IconClipboardCheck },
  { href: "/a/rankings/seasons", key: "seasons", icon: IconSettings },
  { href: "/a/rankings/ghost-teams", key: "ghostTeams", icon: IconGhost2 },
  { href: "/a/rankings/social", key: "social", icon: IconBrandInstagram },
  { href: "/a/rankings/prize", key: "prize", icon: IconCoin },
  { href: "/a/rankings/overrides", key: "overrides", icon: IconAdjustments },
  { href: "/a/rankings/audit", key: "audit", icon: IconHistory },
] as const;

export function RankingsSubNav() {
  const pathname = usePathname();
  const t = useTranslations("rankings.admin.nav");
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto pb-1">
      {ITEMS.map((it) => {
        const active = pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            <it.icon className="size-4" /> {t(it.key)}
          </Link>
        );
      })}
    </div>
  );
}
