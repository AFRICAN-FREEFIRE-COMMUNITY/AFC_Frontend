/**
 * lib/awardsEdition.ts - server-side read of one awards edition, shared by the themed (Detty Royale
 * KOL Awards) pages under app/(user)/awards/[edition]/.
 *
 * It calls the public endpoint GET polls/editions/<slug>/ (afc_polls.views.edition_detail) WITHOUT a
 * token, so the HTML a crawler or a slow phone receives already carries every award and nominee. The
 * browser re-reads the same endpoint with the viewer's token to add their own picks (KolContext).
 * Cached for five minutes, the same window as the edition layout's own fetch, so one request serves
 * the layout, the metadata and the page. A failure is `null`, never a throw: the page then 404s
 * rather than showing a guess.
 */
import { env } from "@/lib/env";
import type { EditionDetail } from "@/lib/polls";

export async function fetchEditionDetail(slug: string): Promise<EditionDetail | null> {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_BACKEND_API_URL}/polls/editions/${encodeURIComponent(slug)}/`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as EditionDetail;
  } catch {
    return null;
  }
}

/** The themed edition, or null when the slug is unknown or the edition uses the site's own drawing. */
export function isKolTheme(detail: EditionDetail | null): detail is EditionDetail {
  return !!detail && detail.edition.theme === "detty-royale";
}
