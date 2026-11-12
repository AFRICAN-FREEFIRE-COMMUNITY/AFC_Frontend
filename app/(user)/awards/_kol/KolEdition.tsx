"use client";

/**
 * app/(user)/awards/_kol/KolEdition.tsx - the shell every KOL Awards page renders inside.
 *
 * Mounts the data provider (seeded with the server-fetched edition), the fonts, the one vote sheet,
 * and picks the page by `view`. The three server pages under app/(user)/awards/[edition]/ differ only
 * in the `view` they pass, so the data, the sheet and the styling are shared and cannot drift apart.
 *
 * Related: KolContext.tsx (data + vote), KolLanding / KolAward / KolNominee (the pages),
 * KolVoteSheet.tsx, kol.css.
 */
import { useTranslations } from "next-intl";

import type { EditionDetail } from "@/lib/polls";

import "./kol.css";
import { KolProvider } from "./KolContext";
import { kolBody, kolSub } from "./fonts";
import { KolAward } from "./KolAward";
import { KolLanding } from "./KolLanding";
import { KolNominee } from "./KolNominee";
import { KolVoteSheet } from "./KolVoteSheet";
import { KolWinners } from "./KolWinners";

export type KolView =
  | { kind: "landing" }
  | { kind: "winners" }
  | { kind: "award"; award: string }
  | { kind: "nominee"; award: string; nominee: string };

export function KolEdition({ slug, initial, view }: { slug: string; initial: EditionDetail; view: KolView }) {
  const t = useTranslations("awardsKol");
  return (
    <KolProvider slug={slug} initial={initial} view={view}>
      <div className={`kol ${kolSub.variable} ${kolBody.variable}`}>
        {/* Hidden until release (#543): only an AFC poll admin can ever receive a hidden edition, so this bar is
            what tells them the page is not public yet. */}
        {initial.edition.hidden ? <div className="kol-preview-bar">{t("preview.bar")}</div> : null}
        <main>
          {view.kind === "landing" && <KolLanding />}
          {view.kind === "winners" && <KolWinners />}
          {view.kind === "award" && <KolAward awardSlug={view.award} />}
          {view.kind === "nominee" && <KolNominee awardSlug={view.award} nomineeSlug={view.nominee} />}
        </main>
        <KolVoteSheet />
        <Gap />
      </div>
    </KolProvider>
  );
}

/** Room under the last section so the fixed call-to-action bar never covers the site footer's links. */
function Gap() {
  return <div aria-hidden="true" style={{ height: 96 }} />;
}
