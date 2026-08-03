"use client";

/**
 * PublishNotice - how the admin Ladders view tells PREVIEW apart from PUBLISHED.
 *
 * Why it exists: the public rankings page hides a season's standings until an admin flips
 * Season.rankings_published (backend afc_rankings.views._gated_monthly / _gated_quarterly), so the
 * Ladders view is the ONLY place those numbers can be read before publishing. Showing them without
 * a mark would be worse than hiding them, an admin could easily read a draft ladder as the live
 * public one. So every ladder carries two signals from this file:
 *
 *   <PublishBadge/>   a pill on the ladder card title, Preview (amber) or Public (green).
 *   <PublishNotice/>  a strip above the table: what the public sees, in words, plus the two
 *                     independent publish flags and a link to where publishing happens.
 *
 * Deliberately read-only: publishing itself stays on the Rankings overview (/a/rankings, the
 * "Publish to public" card -> PublishStateDialog), and the strip links there instead of repeating
 * the control. State comes from the `season` object on the ladder envelope
 * (afc_rankings.serializers.season -> rankings_published / tiers_published).
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconEyeOff, IconWorld, IconArrowRight } from "@tabler/icons-react";

/* ---------------------------------------------------------------- badge (ladder card title) */
export function PublishBadge({ published }: { published: boolean }) {
  const t = useTranslations("rankings.admin.ladders");
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
        published ? "border-green-600/60 text-green-400" : "border-amber-500/60 text-amber-400",
      )}
    >
      {published ? <IconWorld className="size-3" /> : <IconEyeOff className="size-3" />}
      {published ? t("badgePublic") : t("badgePreview")}
    </Badge>
  );
}

/* ---------------------------------------------------------------- one flag chip (Rankings / Tiers) */
// The two publish gates are INDEPENDENT server-side, so they get one chip each rather than a
// single combined state: a season can be published with its tier badges still hidden.
function StateChip({ label, on }: { label: string; on: boolean }) {
  const t = useTranslations("rankings.admin.ladders");
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <Badge
        variant="outline"
        className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-medium",
          on ? "border-green-600/60 text-green-400" : "border-amber-500/60 text-amber-400",
        )}
      >
        {on ? t("statePublished") : t("stateHidden")}
      </Badge>
    </span>
  );
}

/* ---------------------------------------------------------------- strip (above the table) */
interface PublishNoticeProps {
  /** Season.rankings_published for the period on screen: is this ladder live to the public. */
  published: boolean;
  /**
   * Season.tiers_published. Tiers publish INDEPENDENTLY of rankings, so a published ladder can
   * still be showing tier badges the public cannot see. There is no tier at the monthly level,
   * so the monthly ladders pass undefined and the tier chip / warning is skipped.
   */
  tiersPublished?: boolean;
  /** Display name of the season the period belongs to, e.g. "SEASON 3 2026". */
  seasonName: string;
}

export function PublishNotice({ published, tiersPublished, seasonName }: PublishNoticeProps) {
  const t = useTranslations("rankings.admin.ladders");
  // Tier warning only applies when the rankings themselves are public but the tiers are not; an
  // unpublished season already says "the public sees nothing", which covers the tiers too.
  const warnTiers = published && tiersPublished === false;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-md border p-3 text-xs sm:flex-row sm:items-start sm:justify-between",
        published ? "border-green-600/20 bg-green-600/5" : "border-amber-500/20 bg-amber-500/5",
      )}
    >
      <div className="flex items-start gap-2">
        {published ? (
          <IconWorld className="mt-0.5 size-4 shrink-0 text-green-500" />
        ) : (
          <IconEyeOff className="mt-0.5 size-4 shrink-0 text-amber-500" />
        )}
        <div className="space-y-2">
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">
              {published ? t("publicTitle") : t("previewTitle")}
            </span>{" "}
            {published
              ? t("publicBody", { season: seasonName })
              : t("previewBody", { season: seasonName })}
            {warnTiers && <span className="mt-1 block text-amber-400">{t("tiersHidden")}</span>}
          </p>
          {/* the raw flags, so the state is readable at a glance and not only from the prose */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <StateChip label={t("rankings")} on={published} />
            {tiersPublished !== undefined && (
              <StateChip label={t("tiers")} on={tiersPublished} />
            )}
          </div>
        </div>
      </div>

      {/* Publishing lives on the overview; link there, never duplicate the control. */}
      <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
        <Button size="sm" variant="outline" asChild>
          <Link href="/a/rankings">
            {t("publishLink")} <IconArrowRight className="ml-1 size-3.5" />
          </Link>
        </Button>
        <span className="text-[10px] text-muted-foreground">{t("publishHere")}</span>
      </div>
    </div>
  );
}
