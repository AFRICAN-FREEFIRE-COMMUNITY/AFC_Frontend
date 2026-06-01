"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  IconLayoutDashboard, IconClipboardCheck, IconSettings, IconGhost2,
  IconBrandInstagram, IconCoin, IconAdjustments, IconHistory, IconCalculator,
  IconStack2,
} from "@tabler/icons-react";

const ITEMS = [
  { href: "/a/rankings", label: "Overview", icon: IconLayoutDashboard },
  { href: "/a/rankings/scoring-config", label: "Scoring Config", icon: IconCalculator },
  { href: "/a/rankings/tournament-tiers", label: "Tournament Tiers", icon: IconStack2 },
  { href: "/a/rankings/results", label: "Result Markers", icon: IconClipboardCheck },
  { href: "/a/rankings/seasons", label: "Seasons", icon: IconSettings },
  { href: "/a/rankings/ghost-teams", label: "Ghost Teams", icon: IconGhost2 },
  { href: "/a/rankings/social", label: "Social", icon: IconBrandInstagram },
  { href: "/a/rankings/prize", label: "Prize", icon: IconCoin },
  { href: "/a/rankings/overrides", label: "Overrides", icon: IconAdjustments },
  { href: "/a/rankings/audit", label: "Audit", icon: IconHistory },
];

export function RankingsSubNav() {
  const pathname = usePathname();
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
            <it.icon className="size-4" /> {it.label}
          </Link>
        );
      })}
    </div>
  );
}
