/**
 * app/(user)/awards/[edition]/winners/page.tsx - the winners page of a themed (KOL Awards) edition.
 *
 * A literal folder, so it wins over the [award] segment (an award whose slug is "winners" would be
 * shadowed; none exists). 404 for any edition not drawn as the KOL Awards. The server render carries
 * the published winners that the edition read returns once winners are public.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { fetchEditionDetail, isKolTheme } from "@/lib/awardsEdition";
import { generateBreadcrumbSchema, jsonLd } from "@/lib/seo";

import { KolEdition } from "../../_kol/KolEdition";
import { kolMetadata } from "../../_kol/kolMetadata";

type Params = { params: Promise<{ edition: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { edition } = await params;
  const detail = await fetchEditionDetail(edition);
  const path = `/awards/${edition}/winners`;
  if (!isKolTheme(detail)) return kolMetadata({ title: "Awards", description: "Awards.", path, noIndex: true });
  return kolMetadata({
    title: `The winners | ${detail.edition.title}`,
    description: `The winners of ${detail.edition.title}.`,
    path,
  });
}

export default async function WinnersPage({ params }: Params) {
  const { edition } = await params;
  const detail = await fetchEditionDetail(edition);
  if (!isKolTheme(detail)) notFound();
  const crumbs = generateBreadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Awards", path: "/awards" },
    { name: detail.edition.title, path: `/awards/${edition}` },
    { name: "Winners", path: `/awards/${edition}/winners` },
  ]);
  return (
    <>
      <script {...jsonLd(crumbs)} />
      <KolEdition slug={edition} initial={detail} view={{ kind: "winners" }} />
    </>
  );
}
