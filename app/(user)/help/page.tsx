import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { NewBadge } from "@/components/NewBadge";
import { PageHeader } from "@/components/PageHeader";
import { HelpGuides } from "@/components/howto/HelpGuides";
import { HELP_PAGE_LIVE_SINCE } from "@/lib/howto-guides";
import { generatePageMetadata } from "@/lib/seo";

/**
 * app/(user)/help/page.tsx - the player Help Center (inbox #255, owner 2026-10-16: "i approve the
 * mock up, i have seen it", mockups/help-page/help-page-mockup.html).
 *
 * Short videos of the things people do most on AFC, recorded on the real site by howto/render.mjs,
 * each beside its written steps, searchable and filtered by topic. Public: no account needed to
 * learn how to make one (owner rule R25). Reached from the menu and the footer (constants/nav-links.ts
 * "/help", app/_components/Footer.tsx) and from the dialog behind each "Watch how" link
 * (components/howto/WatchHowTip.tsx). The organizer portal keeps its own Help Center
 * (/organizer/help); its results guide plays the same clip 4.
 *
 * Server Component: the title and the SEO metadata (indexable, own canonical, in app/sitemap.ts).
 * Everything interactive is components/howto/HelpGuides.tsx. Strings: helpPage (new) and howto
 * (the clips' captions), hand-written en/fr/pt.
 */

export const metadata: Metadata = generatePageMetadata({
  title: "Help Center",
  description:
    "Short videos of the things people do most on AFC: sign up and connect Discord, create a team, register for a tournament and enter results, each with every step written out.",
  keywords: ["AFC help", "AFC how to", "Free Fire tournament registration", "AFC guide"],
  url: "/help",
});

export default async function HelpPage() {
  const t = await getTranslations("helpPage");
  return (
    <div>
      <PageHeader
        title={
          // flex-wrap so the NEW pill drops under the title on a phone rather than widening it
          <span className="flex flex-wrap items-center gap-2">
            {t("page.title")}
            <NewBadge since={HELP_PAGE_LIVE_SINCE} />
          </span>
        }
        description={t("page.description")}
      />
      <HelpGuides />
    </div>
  );
}
