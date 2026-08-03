"use client";

/**
 * TournamentTierBadge.tsx
 * ───────────────────────
 * User-facing badge showing an EVENT's tournament tier (tier_1/2/3) so players know how an event
 * is ranked (owner 2026-06-29: "events ranked into tiers... badges so they KNOW the tier").
 *
 * Source: Event.tournament_tier (afc_tournament_and_scrims), returned by get_all_events /
 * get_all_events_paginated (card list) and get_event_details (detail header). Distinct from the
 * player/team RANKINGS tiers in components/rankings/TierBadge.tsx - this is the tournament tier.
 *
 * Style follows the AFC tier-badge idiom (outline, rounded-full, px-2 py-0.5 text-xs) with the same
 * tier accents already used for the organizer-directory tier badge (1 = gold/best, 2 = green,
 * 3 = blue). Labels are i18n'd via the `tournaments` namespace (tier.tier_1 ...). Renders nothing
 * when no tier is provided.
 *
 * Used by: app/(user)/tournaments/page.tsx (EventCard) + tournaments/[slug] EventDetailsWrapper header.
 */

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TIER_CLASS: Record<string, string> = {
  tier_1: "border-gold/55 text-gold",
  tier_2: "border-primary/50 text-primary",
  tier_3: "border-blue-500/50 text-blue-500",
};

export function TournamentTierBadge({
  tier,
  className,
}: {
  tier?: string | null;
  className?: string;
}) {
  const t = useTranslations("tournaments");
  if (!tier || !(tier in TIER_CLASS)) return null;
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full px-2 py-0.5 text-xs", TIER_CLASS[tier], className)}
    >
      {t(`tier.${tier}`)}
    </Badge>
  );
}
