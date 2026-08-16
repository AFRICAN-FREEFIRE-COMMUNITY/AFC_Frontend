"use client";

/**
 * app/(user)/awards/[edition]/page.tsx - ONE named awards season.
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
 * is pointed at differs, so a season can never look like two different pages.
 *
 * WHAT IT TALKS TO
 *   GET {BACKEND}/polls/editions/<slug>/ -> afc_polls.views.edition_detail, inside AwardsExperience.
 *   A slug that does not exist answers 404, and the component renders its own "not found" card
 *   rather than an error wall.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconChevronLeft } from "@tabler/icons-react";

import { AwardsExperience } from "../_components/AwardsExperience";

export default function AwardsEditionPage() {
  // Namespace "awards" (messages/{en,fr,pt}/awards.json), shared with /awards and the experience.
  const t = useTranslations("awards");
  const params = useParams<{ edition: string }>();
  // useParams gives string | string[]; this segment is never catch-all, but the guard keeps a
  // malformed URL from being handed to the API as "slug1,slug2".
  const slug = Array.isArray(params.edition) ? params.edition[0] : params.edition;

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

      <AwardsExperience editionSlug={slug} />
    </div>
  );
}
