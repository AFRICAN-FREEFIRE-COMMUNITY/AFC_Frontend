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

// Tiers can be added in the scoring config at any time (owner, 2026-10-01), so a tier code
// above 3 is legitimate: it is drawn as "Tier N" in a plain colour, because only the first four
// have a colour here. Inbox #108: a code tierMeta did not know used to crash the page
// (`tierMeta[4].cls` on undefined), taking down the admin rankings pages and the public Tiers tab.

/**
 * The label TierBadge draws, as plain TEXT, for places that need words rather than a pill (a stat
 * value, a select option, a page description). Code 0 -> "Tier 1"; null or undefined -> "Unranked".
 * Accepts the code as a number or a numeric string, since some endpoints send "3".
 *
 * Inbox #162 / #165 (owner 2026-10-05 "yes", 2026-10-08 "broadcasts and polls should use the
 * tiering everything else uses"): every tier on the site is the team's published RANKING tier,
 * `ranking_tier` on the team endpoints (AFC-B afc_rankings/public_tiers.py). The hand-set team_tier
 * ("3" for every team) is no longer sent. Never print a code without going through this or TierBadge.
 */
export function useTierLabel() {
  const t = useTranslations("rankings");
  return (tier: number | string | null | undefined): string =>
    tier === null || tier === undefined || tier === ""
      ? t("unranked")
      : t("tier", { tier: Number(tier) + 1 });
}

interface TierBadgeProps {
  // Any tier code the scoring config defines (0 = Tier 1). See the note above tierMeta's users.
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
