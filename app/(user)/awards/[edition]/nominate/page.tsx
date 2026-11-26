/**
 * app/(user)/awards/[edition]/nominate/page.tsx - the KOL creators' nomination ballot (AFC inbox #633 / #634).
 *
 * Reached only from a creator's personal link (/awards/<edition>/nominate#KOL-XXXX-XXXX) or by typing a code here.
 * NOT INDEXED: a code-reached page is nobody's search result, and the KOL edition itself stays hidden until its
 * public release. So this route never fetches the edition and never 404s on a hidden one: the ballot, its dates and
 * its refusals all come from AFC-B polls/kol-nominations/<edition>/ (afc_polls/kol_nominations.py), read in the
 * browser by KolNominate.tsx with the creator's own cookie.
 *
 * The static "nominate" segment wins over the [award] route beside it; no award slug is "nominate".
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { KolNominate } from "../../_kol/KolNominate";
import { kolMetadata } from "../../_kol/kolMetadata";

type Params = { params: Promise<{ edition: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { edition } = await params;
  const t = await getTranslations("awardsKol");
  return kolMetadata({
    title: t("nominate.metaTitle"),
    description: t("nominate.metaDescription"),
    path: `/awards/${edition}/nominate`,
    noIndex: true,
  });
}

export default async function NominatePage({ params }: Params) {
  const { edition } = await params;
  return <KolNominate slug={edition} />;
}
