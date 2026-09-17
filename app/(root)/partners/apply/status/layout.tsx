import { Metadata } from "next";
import { ReactNode } from "react";

import { privatePageMetadata } from "@/lib/seo";

// WHY THIS FILE EXISTS: the page beside it is a Client Component and cannot export metadata.
// The applicant's own status page; not a public page.
// Owner rule R23: sitemap or noindex; scripts/check-seo.mjs fails a page that is neither.
export const metadata: Metadata = privatePageMetadata("Application status");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
