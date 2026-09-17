import { Metadata } from "next";
import { ReactNode } from "react";

import { privatePageMetadata } from "@/lib/seo";

// WHY THIS FILE EXISTS: the page beside it is a Client Component and cannot export metadata.
// Shown once to the applicant with their new client id; must never be indexed.
// Owner rule R23: sitemap or noindex; scripts/check-seo.mjs fails a page that is neither.
export const metadata: Metadata = privatePageMetadata("Partner credentials");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
