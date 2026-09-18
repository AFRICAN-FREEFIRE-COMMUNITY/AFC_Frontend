import { Metadata } from "next";
import { ReactNode } from "react";

import { privatePageMetadata } from "@/lib/seo";

// WHY THIS FILE EXISTS: the page beside it is a Client Component and cannot export metadata.
// A person's own wagers are theirs alone: noindex (owner rule R23: sitemap or noindex).
export const metadata: Metadata = privatePageMetadata("My wagers");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
