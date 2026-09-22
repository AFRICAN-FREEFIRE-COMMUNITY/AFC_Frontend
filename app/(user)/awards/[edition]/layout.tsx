/**
 * Server wrapper for one awards edition, so the page can carry JSON-LD (owner rule R23; the last
 * three entity pages the SEO checker was ledgering on 2026-09-22).
 *
 * Same reason as the poll layout beside it: `page.tsx` is a Client Component (the ballots update as
 * somebody votes), and a Client Component cannot emit server-side structured data. This layout
 * already receives the `edition` param, fetches the edition once and prints the markup.
 *
 * An edition is a SET of polls, so CollectionPage is the honest type, with each poll listed by its
 * own title and address. Everything claimed comes from `polls/editions/<slug>/`; a failed fetch
 * renders the page exactly as before, with no markup rather than a guess.
 */

import type { ReactNode } from "react";

import { jsonLd, generateBreadcrumbSchema, siteConfig } from "@/lib/seo";
import { env } from "@/lib/env";

type PollInEdition = { title?: string; slug?: string };
type EditionForSeo = {
  name?: string;
  title?: string;
  description?: string;
  slug?: string;
  year?: number | string;
  polls?: PollInEdition[];
};

async function fetchEdition(slug: string): Promise<EditionForSeo | null> {
  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/polls/editions/${encodeURIComponent(slug)}/`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as EditionForSeo;
  } catch {
    return null;
  }
}

export default async function AwardsEditionLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ edition: string }>;
}) {
  const { edition } = await params;
  const data = await fetchEdition(edition);
  const name = data?.name || data?.title || "";
  const path = `/awards/${edition}`;

  const schema = name
    ? {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name,
        ...(data?.description ? { description: data.description } : {}),
        url: `${siteConfig.url}${path}`,
        isPartOf: { "@type": "WebSite", name: siteConfig.name, url: siteConfig.url },
        ...(Array.isArray(data?.polls) && data.polls.length
          ? {
              hasPart: data.polls
                .filter((p) => p?.title && p?.slug)
                .map((p) => ({
                  "@type": "Quiz",
                  name: p.title,
                  url: `${siteConfig.url}/polls/${p.slug}`,
                })),
            }
          : {}),
      }
    : null;

  const breadcrumb = name
    ? generateBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Awards", path: "/awards" },
        { name, path },
      ])
    : null;

  return (
    <>
      {schema && <script {...jsonLd(schema)} />}
      {breadcrumb && <script {...jsonLd(breadcrumb)} />}
      {children}
    </>
  );
}
