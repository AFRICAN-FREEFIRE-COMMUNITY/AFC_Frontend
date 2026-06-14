import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteConfig } from "@/lib/seo";

// SEO metadata for the (client-component) Glossary page. A page marked "use client" cannot export
// `metadata`, so a server layout supplies the title/description/canonical (audit 2026-06-14: the
// page had none, and it is now listed in app/sitemap.ts).
export const metadata: Metadata = {
  title: "Free Fire Glossary",
  description:
    "Free Fire esports terms explained: tournament formats, scoring, roles, and the lingo used across the African Freefire Community.",
  alternates: { canonical: `${siteConfig.url}/glossary` },
};

export default function GlossaryLayout({ children }: { children: ReactNode }) {
  return children;
}
