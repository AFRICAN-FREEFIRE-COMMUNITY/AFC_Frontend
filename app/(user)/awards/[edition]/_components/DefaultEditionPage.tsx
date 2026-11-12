"use client";

/**
 * app/(user)/awards/[edition]/_components/DefaultEditionPage.tsx - ONE named awards season, drawn the
 * site own way. (This was page.tsx until inbox 419: page.tsx is now a server component that picks
 * this or the Detty Royale KOL Awards drawing from AwardsEdition.theme, see ../page.tsx.)
 *
 * WHY THIS ROUTE EXISTS SEPARATELY FROM /awards
 *   /awards always shows whichever season is leading, which is right for a visitor arriving from
 *   the menu and wrong for a link. An awards result is the most shared thing on the site, and a
 *   link that silently means "whatever is current" points at the wrong year the moment the next
 *   season opens. This route pins the year: /awards/nfca-2025 is the 2025 winners, permanently,
 *   and /awards/nfca-2025#best-esports-player is one category inside it (the anchor is
 *   PollQuestion.slug, rendered by AwardsExperience on both the ballot cards and the winner bands).
 *
 * The whole surface is AwardsExperience, the same component /awards renders. Only the edition it
 * is pointed at differs, so a season can never look like two different pages. The season picker is
 * shared too, so somebody who landed here on a shared link can move between years without going
 * back to /awards first.
 *
 * WHAT IT TALKS TO
 *   GET {BACKEND}/polls/editions/         -> the season list behind the picker
 *   GET {BACKEND}/polls/editions/<slug>/  -> the season itself, inside AwardsExperience
 *   A slug that does not exist answers 404, and the component renders its own "not found" card
 *   rather than an error wall.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconChevronLeft } from "@tabler/icons-react";

import { pollsApi, type AwardsEdition } from "@/lib/polls";

import { KolPreviewGate } from "../../_kol/KolPreviewGate";
import { AwardsExperience } from "../../_components/AwardsExperience";
import { SeasonPicker } from "../../_components/SeasonPicker";

export function DefaultEditionPage() {
  // Namespace "awards" (messages/{en,fr,pt}/awards.json), shared with /awards and the experience.
  const t = useTranslations("awards");
  const params = useParams<{ edition: string }>();
  // useParams gives string | string[]; this segment is never catch-all, but the guard keeps a
  // malformed URL from being handed to the API as "slug1,slug2".
  const slug = Array.isArray(params.edition) ? params.edition[0] : params.edition;

  // The season list feeds the picker only. A failure leaves the picker hidden rather than blocking
  // the season itself, which loads independently inside AwardsExperience.
  const [editions, setEditions] = useState<AwardsEdition[]>([]);
  useEffect(() => {
    let cancelled = false;
    pollsApi
      .listEditions()
      .then((res) => {
        if (!cancelled) setEditions(res.results || []);
      })
      .catch(() => {
        if (!cancelled) setEditions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A KOL edition only reaches this page when the signed-out server read could not see it, i.e. it is hidden until
  // release (#543) and the season list (read with the viewer's session) still has it: the viewer is a poll admin.
  // Draw it the way the public will see it once released, under the hidden bar.
  if (editions.some((e) => e.slug === slug && e.theme === "detty-royale")) {
    return <KolPreviewGate slug={slug} view={{ kind: "landing" }} />;
  }

  return (
    <div>
      {/* Back to the leading season. Present because somebody arriving on a shared link for an old
          year has no other way to discover that a current one exists. */}
      <Link
        href="/awards"
        className="inline-flex items-center text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <IconChevronLeft className="mr-1 h-3.5 w-3.5" aria-hidden />
        {t("index.backToAwards")}
      </Link>

      <SeasonPicker editions={editions} activeSlug={slug} />
      <AwardsExperience editionSlug={slug} />
    </div>
  );
}
