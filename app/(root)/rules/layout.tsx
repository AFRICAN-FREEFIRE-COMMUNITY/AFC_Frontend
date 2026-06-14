import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteConfig } from "@/lib/seo";

// SEO metadata for the (client-component) Rules page. A "use client" page cannot export `metadata`,
// so a server layout supplies the title/description/canonical (audit 2026-06-14: the page had none,
// and it is now listed in app/sitemap.ts).
export const metadata: Metadata = {
  title: "Tournament Rules",
  description:
    "The official rules for African Freefire Community tournaments and scrims: eligibility, formats, scoring, and conduct.",
  alternates: { canonical: `${siteConfig.url}/rules` },
};

export default function RulesLayout({ children }: { children: ReactNode }) {
  return children;
}
