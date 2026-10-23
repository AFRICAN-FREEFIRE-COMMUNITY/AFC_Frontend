import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

import { privatePageMetadata } from "@/lib/seo";

/**
 * app/(user)/contact/page.tsx - the old Contact Us address (inbox #71, 2026-09-28).
 *
 * The contact form now lives on the Support page, beside the player's own tickets
 * (app/(user)/support/page.tsx). This address stays, because about ten pages, older emails and
 * search results point at it: it sends everyone there with a permanent redirect (308), so a
 * bookmark or a search engine learns the new address instead of keeping two copies of one page.
 * Nothing renders here, so it is marked not to index; /support is the page in the sitemap.
 */
export const metadata: Metadata = privatePageMetadata("Contact");

export default function ContactPage() {
  permanentRedirect("/support");
}
