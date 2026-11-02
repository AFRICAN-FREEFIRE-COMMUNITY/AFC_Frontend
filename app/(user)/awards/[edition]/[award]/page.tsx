/**
 * app/(user)/awards/[edition]/[award]/page.tsx - one award of a themed (KOL Awards) edition.
 *
 * Only themed editions have award pages; for any other edition (or an unknown award) this is a 404.
 * `award` is the PollQuestion slug. The server render carries the award's name, description and
 * nominee list in the HTML, plus an ItemList of the nominees and a breadcrumb as JSON-LD (R23).
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { fetchEditionDetail, isKolTheme } from "@/lib/awardsEdition";
import { buildEntityMetadata, generateBreadcrumbSchema, jsonLd, siteConfig } from "@/lib/seo";

import { KolEdition } from "../../_kol/KolEdition";
import { buildModel } from "../../_kol/model";

type Params = { params: Promise<{ edition: string; award: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { edition, award } = await params;
  const detail = await fetchEditionDetail(edition);
  const found = isKolTheme(detail) ? buildModel(detail).awards.find((a) => a.slug === award) : undefined;
  if (!found || !detail) {
    return buildEntityMetadata({ title: "Awards", description: "AFC awards.", path: `/awards/${edition}/${award}`, noIndex: true });
  }
  const title = `${found.question.prompt} | ${detail.edition.title}`;
  const description = (found.question.help_text || `${found.question.prompt}: ${found.nominees.length} nominees in ${detail.edition.title}.`).slice(0, 180);
  return buildEntityMetadata({ title, description, path: `/awards/${edition}/${award}` });
}

export default async function AwardPage({ params }: Params) {
  const { edition, award } = await params;
  const detail = await fetchEditionDetail(edition);
  if (!isKolTheme(detail)) notFound();
  const found = buildModel(detail).awards.find((a) => a.slug === award);
  if (!found) notFound();

  const path = `/awards/${edition}/${award}`;
  const list = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: found.question.prompt,
    url: `${siteConfig.url}${path}`,
    itemListElement: found.nominees.map((n, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: n.label,
      url: `${siteConfig.url}${path}/${n.slug}`,
    })),
  };
  const crumbs = generateBreadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Awards", path: "/awards" },
    { name: detail.edition.title, path: `/awards/${edition}` },
    { name: found.question.prompt, path },
  ]);

  return (
    <>
      <script {...jsonLd(list)} />
      <script {...jsonLd(crumbs)} />
      <KolEdition slug={edition} initial={detail} view={{ kind: "award", award }} />
    </>
  );
}
