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
import type { EditionDetail } from "@/lib/polls";

import "./kol.css";
import { KolProvider } from "./KolContext";
import { kolBody, kolSub } from "./fonts";
import { KolAward } from "./KolAward";
import { KolLanding } from "./KolLanding";
import { KolNominee } from "./KolNominee";
import { KolVoteSheet } from "./KolVoteSheet";

export type KolView =
  | { kind: "landing" }
  | { kind: "award"; award: string }
  | { kind: "nominee"; award: string; nominee: string };

export function KolEdition({ slug, initial, view }: { slug: string; initial: EditionDetail; view: KolView }) {
  return (
    <KolProvider slug={slug} initial={initial}>
      <div className={`kol ${kolSub.variable} ${kolBody.variable}`}>
        <main>
          {view.kind === "landing" && <KolLanding />}
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
