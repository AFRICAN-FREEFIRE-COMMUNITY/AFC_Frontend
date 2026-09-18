import { Metadata } from "next";
import { ReactNode } from "react";

import { generatePageMetadata } from "@/lib/seo";

// WHY THIS FILE EXISTS: the page beside it is a Client Component and cannot export metadata.
// /wagers is public (every market list is readable signed out, R25), so it is indexed and in
// the sitemap (app/sitemap.ts); the copy here is the English source of messages/en/wagers.json
// metaDescription, kept in step by hand.
export const metadata: Metadata = generatePageMetadata({
  title: "Wagers",
  description: "Pool wagers on AFC Free Fire matches: back a team or a player, paid in naira, settled from the official result.",
  url: "/wagers",
  keywords: ["AFC wagers", "Free Fire wagers", "AFC pool"],
});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
