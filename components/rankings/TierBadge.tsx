"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
// i18n: tier label ("Tier N") + the "Unranked" fallback are localized via the
// dedicated rankings namespace (messages/{en,fr,pt}/rankings.json). Client component
// so it reads next-intl's useTranslations. Rendered across /rankings and the team /
// player surfaces (and the i18n-exempt admin rankings pages, which just fall back to en).
import { useTranslations } from "next-intl";

// Tier pill (outline Badge) mapping a 0-3 tier index to label and colour; single source for tier presentation across /rankings and the admin surfaces; min values mirror the scoring spec thresholds.

// spec §11 tiers 0-3. Labels renamed to Tier 1-4 (owner 2026-07-04: "change elite/entry etc to Tier
// 1 - Tier 4"). Index 0 (best) = "Tier 1" ... index 3 (entry level) = "Tier 4"; colours unchanged.
// The `label` here is the English source; the visible label is resolved from the rankings
// namespace via t("tier", { tier: index + 1 }) below so it localizes (fr/pt).
export const tierMeta: Record<number, { label: string; cls: string; min: number }> = {
  0: { label: "Tier 1", cls: "text-amber-400 border-amber-500/60", min: 150 },
  1: { label: "Tier 2", cls: "text-green-400 border-green-600/60", min: 90 },
  2: { label: "Tier 3", cls: "text-blue-400 border-blue-600/60", min: 40 },
  3: { label: "Tier 4", cls: "text-orange-400 border-orange-600/60", min: 0 },
};

interface TierBadgeProps {
  tier: 0 | 1 | 2 | 3 | null | undefined;
  className?: string;
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  const t = useTranslations("rankings");
  if (tier === null || tier === undefined) {
    return (
      <Badge variant="outline" className={cn("rounded-full text-muted-foreground", className)}>
        {t("unranked")}
      </Badge>
    );
  }
  const m = tierMeta[tier];
  return (
    <Badge variant="outline" className={cn("rounded-full font-semibold", m.cls, className)}>
      {t("tier", { tier: tier + 1 })}
    </Badge>
  );
}
