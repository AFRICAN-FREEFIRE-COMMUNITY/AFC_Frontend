import { Metadata } from "next";
import { ReactNode } from "react";

import { privatePageMetadata } from "@/lib/seo";

// WHY THIS FILE EXISTS: the page beside it is a Client Component and cannot export metadata.
// Team settings, owner and managers only; the public team page is the one to index.
// Owner rule R23: sitemap or noindex; scripts/check-seo.mjs fails a page that is neither.
export const metadata: Metadata = privatePageMetadata("Edit team");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
