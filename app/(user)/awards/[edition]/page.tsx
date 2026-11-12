/**
 * app/(user)/awards/[edition]/page.tsx - ONE named awards season (server component).
 *
 * Picks the drawing from AwardsEdition.theme (inbox #419): "detty-royale" renders the KOL Awards
 * landing page; any other edition renders the site's own awards surface exactly as before. Same
 * edition, same polls, same votes: only the component that draws it differs, so a themed season is
 * not a second awards system. The edition is read on the server so the page ships with its awards and
 * nominees in the HTML; metadata and JSON-LD stay in ./layout.tsx.
 */
import { fetchEditionDetail, isKolTheme, previewSlug } from "@/lib/awardsEdition";

import { KolEdition } from "../_kol/KolEdition";
import { KolPreviewGate } from "../_kol/KolPreviewGate";
import { DefaultEditionPage } from "./_components/DefaultEditionPage";

export default async function AwardsEditionPage({ params }: { params: Promise<{ edition: string }> }) {
  const { edition } = await params;
  const detail = await fetchEditionDetail(edition);
  if (isKolTheme(detail)) return <KolEdition slug={edition} initial={detail} view={{ kind: "landing" }} />;
  // A hidden edition (#543) is a 404 to this signed-out read; an admin previewing it reads it in the browser.
  if (!detail && (await previewSlug()) === edition) return <KolPreviewGate slug={edition} view={{ kind: "landing" }} />;
  return <DefaultEditionPage />;
}
