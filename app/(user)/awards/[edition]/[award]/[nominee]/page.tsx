/**
 * app/(user)/awards/[edition]/[award]/[nominee]/page.tsx - one nominee of a themed (KOL Awards) edition.
 *
 * `nominee` is the PollOption slug, unique inside its award (afc_polls.models.PollOption.ensure_slug).
 * 404 for any other edition theme or an unknown nominee. The server render carries the name, the
 * award and the photo; JSON-LD is a Person (name, image, address) with a breadcrumb. The page states
 * only what the edition has: no claims about the person beyond the nomination.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { fetchEditionDetail, isKolTheme, previewSlug } from "@/lib/awardsEdition";
import { generateBreadcrumbSchema, jsonLd, siteConfig } from "@/lib/seo";

import { KolEdition } from "../../../_kol/KolEdition";
import { KolPreviewGate } from "../../../_kol/KolPreviewGate";
import { kolMetadata } from "../../../_kol/kolMetadata";
import { buildModel, nomineePhoto } from "../../../_kol/model";

type Params = { params: Promise<{ edition: string; award: string; nominee: string }> };

async function resolve(p: { edition: string; award: string; nominee: string }) {
  const detail = await fetchEditionDetail(p.edition);
  if (!isKolTheme(detail)) return null;
  const award = buildModel(detail).awards.find((a) => a.slug === p.award);
  const nominee = award?.nominees.find((n) => n.slug === p.nominee);
  return award && nominee ? { detail, award, nominee } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await params;
  const hit = await resolve(p);
  const path = `/awards/${p.edition}/${p.award}/${p.nominee}`;
  if (!hit) return kolMetadata({ title: "Awards", description: "Awards.", path, noIndex: true });
  const { detail, award, nominee } = hit;
  return kolMetadata({
    title: `${nominee.label}, ${award.question.prompt}`,
    description: (nominee.description || `${nominee.label} is nominated for ${award.question.prompt} in ${detail.edition.title}.`).slice(0, 180),
    path,
    image: nomineePhoto(nominee) || undefined,
  });
}

export default async function NomineePage({ params }: Params) {
  const p = await params;
  const hit = await resolve(p);
  if (!hit) {
    // A hidden edition (#543): an admin previewing it reads it in the browser; everybody else gets the 404.
    if ((await previewSlug()) === p.edition)
      return <KolPreviewGate slug={p.edition} view={{ kind: "nominee", award: p.award, nominee: p.nominee }} />;
    notFound();
  }
  const { detail, award, nominee } = hit;
  const path = `/awards/${p.edition}/${p.award}/${p.nominee}`;

  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: nominee.label,
    url: `${siteConfig.url}${path}`,
    ...(nomineePhoto(nominee) ? { image: nomineePhoto(nominee) } : {}),
    ...(nominee.description ? { description: nominee.description } : {}),
  };
  const crumbs = generateBreadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Awards", path: "/awards" },
    { name: detail.edition.title, path: `/awards/${p.edition}` },
    { name: award.question.prompt, path: `/awards/${p.edition}/${p.award}` },
    { name: nominee.label, path },
  ]);

  return (
    <>
      <script {...jsonLd(person)} />
      <script {...jsonLd(crumbs)} />
      <KolEdition slug={p.edition} initial={detail} view={{ kind: "nominee", award: p.award, nominee: p.nominee }} />
    </>
  );
}
