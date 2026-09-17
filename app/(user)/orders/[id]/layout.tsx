import { Metadata } from "next";
import { ReactNode } from "react";

import { privatePageMetadata } from "@/lib/seo";

// WHY THIS FILE EXISTS: the page beside it is a Client Component and cannot export metadata.
// An order is the buyer's own, reached by its token; it must never be indexed, and without this it inherited the (user) layout's "Teams" title.
// Owner rule R23: sitemap or noindex; scripts/check-seo.mjs fails a page that is neither.
export const metadata: Metadata = privatePageMetadata("Order");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
