"use client";

/**
 * components/OrgBadge.tsx
 * ───────────────────────
 * An organization's badge as a small chip: Community, Verified or AFC Partner (open organizations, owner
 * 16 Nov 2026, AFC inbox #582 to #601; approved mockup mockups/organizer-dashboard/).
 *
 * Badges are trust and reach only: no tool is gated by them. What they mean, on the server, lives in AFC-B
 * afc_organizers/badges.py (Verified and Partner results count for the AFC rankings; only Partner events email
 * players). This chip just says which one an organizer has, with a plain-words title for a hover or a screen reader.
 *
 * Where it is used: the public organization page, the organizer's name on an event page, the organizations list on
 * /tournaments, and the admin Organizations page. The data comes from the server as `badge` (organization payloads)
 * or `organization_badge` (event payloads, AFC-B event_contract.py). `null` (an AFC event) renders nothing.
 *
 * Design: a flat tint of its own text colour (the site's outline Badge, no stroke), DM Sans, rounded-full; green
 * for Verified, gold for AFC Partner, muted for Community. No glow.
 */
import { IconRosetteDiscountCheckFilled, IconStarFilled } from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { OrgBadgeKind } from "@/lib/organizers";
import { cn } from "@/lib/utils";

const TONE: Record<OrgBadgeKind, string> = {
  verified: "text-primary",
  partner: "text-gold",
  community: "text-muted-foreground",
};

export function OrgBadge({ badge, className }: { badge?: OrgBadgeKind | string | null; className?: string }) {
  const t = useTranslations("orgStart");
  if (badge !== "community" && badge !== "verified" && badge !== "partner") return null;
  return (
    <Badge
      variant="outline"
      title={t(`badge.${badge}Hint`)}
      className={cn("rounded-full px-2 py-0.5 text-xs gap-1 font-semibold", TONE[badge], className)}
    >
      {badge === "verified" && <IconRosetteDiscountCheckFilled className="size-3.5" aria-hidden />}
      {badge === "partner" && <IconStarFilled className="size-3.5" aria-hidden />}
      {t(`badge.${badge}`)}
    </Badge>
  );
}
