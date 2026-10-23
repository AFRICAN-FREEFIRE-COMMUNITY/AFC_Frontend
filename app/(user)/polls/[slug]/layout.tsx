/**
 * Server wrapper for one public poll, so the page can carry JSON-LD (owner rule R23, the last three
 * entity pages the SEO checker was ledgering on 2026-09-22).
 *
 * WHY A LAYOUT AND NOT THE PAGE: `page.tsx` here is a Client Component - it is a live ballot with
 * branching that re-evaluates as somebody answers - and a Client Component cannot emit server-side
 * structured data. A layout beside it is a Server Component that already receives the same `slug`
 * param, so it fetches the poll once and prints the markup, without touching the ballot at all.
 *
 * WHAT IT CLAIMS: only fields the poll itself carries. The title, the question count and the two
 * dates come from `polls/<slug>/`; nothing is invented, and when the fetch fails the page renders
 * exactly as before with no markup rather than with a guess.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { buildEntityMetadata, jsonLd, generateBreadcrumbSchema, siteConfig } from "@/lib/seo";
import { env } from "@/lib/env";

type PollForSeo = {
  title?: string;
  description?: string;
  slug?: string;
  kind?: string;
  opens_at?: string | null;
  closes_at?: string | null;
  questions?: unknown[];
};

async function fetchPoll(slug: string): Promise<PollForSeo | null> {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_BACKEND_API_URL}/polls/${encodeURIComponent(slug)}/`, {
      // The ballot itself is live; this copy only feeds the markup, so a short cache is plenty.
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as PollForSeo;
  } catch {
    return null;
  }
}

// Each poll's own title, description and canonical (Search Console work, 2026-10-16). Without
// this every poll inherited app/(user)/polls/layout.tsx's metadata whole: the /polls title and a
// canonical pointing at /polls. Same cached fetch as the layout below.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const poll = await fetchPoll(slug);
  const title = poll?.title || "AFC Poll";
  const own = (poll?.description || "").replace(/\s+/g, " ").trim();
  const description = (own || `${title}: a community poll on AFC.`).slice(0, 180);
  return buildEntityMetadata({ title, description, path: `/polls/${slug}` });
}

export default async function PollLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const poll = await fetchPoll(slug);
  const path = `/polls/${slug}`;

  // schema.org/Quiz is the honest type for a ballot of questions; the awards editions use
  // CollectionPage because they are a set of polls rather than questions.
  const schema = poll?.title
    ? {
        "@context": "https://schema.org",
        "@type": "Quiz",
        name: poll.title,
        ...(poll.description ? { description: poll.description } : {}),
        url: `${siteConfig.url}${path}`,
        ...(Array.isArray(poll.questions) && poll.questions.length
          ? { numberOfQuestions: poll.questions.length }
          : {}),
        ...(poll.opens_at ? { datePublished: poll.opens_at } : {}),
        ...(poll.closes_at ? { expires: poll.closes_at } : {}),
        isAccessibleForFree: true,
        publisher: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
      }
    : null;

  const breadcrumb = poll?.title
    ? generateBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Polls", path: "/polls" },
        { name: poll.title, path },
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
