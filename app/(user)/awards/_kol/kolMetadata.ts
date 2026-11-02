/**
 * app/(user)/awards/_kol/kolMetadata.ts - page metadata for the themed (KOL Awards) edition pages.
 *
 * The event is Garena's; the site only hosts it (owner, 2 Nov 2026). So a share card for these pages
 * carries the KOL Awards / Detty Royale art and words only: the image is /kol/og.jpg (the Detty Royale
 * logo on its purple ground, made from the same art as the page), or the nominee's own photo, and the
 * Open Graph and Twitter titles are the plain page title with no site suffix and no site name. Wraps
 * buildEntityMetadata (lib/seo.ts) so canonical, description, robots and keywords stay the site's.
 */
import type { Metadata } from "next";

import { buildEntityMetadata, siteConfig } from "@/lib/seo";

export function kolMetadata(o: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  noIndex?: boolean;
}): Metadata {
  const base = buildEntityMetadata({ ...o, image: o.image || `${siteConfig.url}/kol/og.jpg` });
  return {
    ...base,
    openGraph: { ...base.openGraph, title: o.title, siteName: "KOL Awards" },
    twitter: { ...base.twitter, title: o.title },
  };
}
