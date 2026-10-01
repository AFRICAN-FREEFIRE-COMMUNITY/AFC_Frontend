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

// The tier codes the whole system understands, 0 (Tier 1) to 3 (Tier 4). The backend's
// afc_rankings/scoring/constants.TIER_CODES is the same list, and the scoring-config editor
// offers exactly these. Inbox #108 (2026-10-01): a config saved with codes 1..4 put code 4 on
// most teams, and `tierMeta[4].cls` crashed the admin rankings pages and the public Tiers tab.
export const TIER_CODES = [0, 1, 2, 3] as const;

interface TierBadgeProps {
  // Typed as the four codes, but the value comes off the API: anything else is drawn as a plain
  // grey "Tier N" rather than crashing the page (see TIER_CODES).
  tier: number | null | undefined;
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
    <Badge variant="outline"
      className={cn("rounded-full font-semibold", m ? m.cls : "text-muted-foreground", className)}>
      {t("tier", { tier: tier + 1 })}
    </Badge>
  );
}
