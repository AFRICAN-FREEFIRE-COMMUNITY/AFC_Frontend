import { Metadata } from "next";
import { ReactNode } from "react";

import { privatePageMetadata } from "@/lib/seo";

// WHY THIS FILE EXISTS: the page beside it is a Client Component and cannot export metadata.
// The roster page is a team manager's tool (remove a member, change who plays), like the
// applications and permissions pages beside it, so it asks not to be indexed. Without this it
// inherited the team page's metadata whole, canonical included (scripts/check-seo.mjs
// CANONICAL-INHERITED, Search Console work 2026-10-16).
export const metadata: Metadata = privatePageMetadata("Team roster");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
