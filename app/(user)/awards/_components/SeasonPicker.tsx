"use client";

/**
 * app/(user)/awards/_components/SeasonPicker.tsx - pick which awards season you are looking at.
 *
 * WHY IT SHOWS EVEN WITH ONE SEASON (owner, 2026-08-16: "there's supposed to be like a filter for
 * seasons also")
 *   The first version listed OTHER years only, under the winners, and only once a second season
 *   existed. With one season it rendered nothing at all, so there was no sign the page was showing
 *   a particular season rather than everything AFC has ever awarded, and no hint that more seasons
 *   were coming. A control that appears only after the data grows is a control nobody discovers.
 *   This renders whenever there is at least one season, with the current one marked.
 *
 * WHY LINKS AND NOT A DROPDOWN
 *   Each season keeps its own URL (/awards/<edition>), so a season can be shared, bookmarked and
 *   linked from a news post. A client-side switcher would put every season behind one address and
 *   lose that. Links also mean the browser Back button does what a reader expects.
 *
 * WHERE IT SITS
 *   ABOVE the marquee on both /awards and /awards/<edition>. A filter under the content is a filter
 *   found after scrolling past everything it filters.
 *
 * Data: AwardsEdition rows from GET /polls/editions/ (afc_polls.views.list_editions), already
 * ordered by the backend (order, then newest year first), so the leading season is first here too.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { AwardsEdition } from "@/lib/polls";

export function SeasonPicker({
  editions,
  activeSlug,
}: {
  editions: AwardsEdition[];
  /** The season being shown, so its chip reads as selected rather than as another link. */
  activeSlug: string;
}) {
  // Namespace "awards" (messages/{en,fr,pt}/awards.json).
  const t = useTranslations("awards");

  if (editions.length === 0) return null;

  return (
    <nav className="flex flex-wrap items-center gap-2 pt-6" aria-label={t("index.seasonLabel")}>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {t("index.seasonLabel")}
      </span>
      {editions.map((edition) => {
        const active = edition.slug === activeSlug;
        return (
          <Link
            key={edition.slug}
            href={`/awards/${edition.slug}`}
            // aria-current is what tells a screen reader which season is showing; the colour
            // change alone would say it to sighted readers only.
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              active
                ? "border-gold/60 bg-gold/10 font-medium text-gold"
                : "border-input text-muted-foreground hover:border-primary/50 hover:text-primary",
            )}
          >
            {edition.title}
          </Link>
        );
      })}
    </nav>
  );
}
