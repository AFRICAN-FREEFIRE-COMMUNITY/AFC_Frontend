import { Metadata } from "next";
import { ReactNode } from "react";
import { notFound } from "next/navigation";

import { env } from "@/lib/env";
import { fetchDetail } from "@/lib/detailFetch";
import { generateBreadcrumbSchema, generateDynamicMetadata, jsonLd } from "@/lib/seo";
import { formatMoney } from "@/lib/money";

// WHY THIS FILE EXISTS: the page beside it is a Client Component. A market page is public (R25)
// and named, so it gets server-rendered metadata from its own fields (R23): the title, a
// description built from the event and the pool terms, a canonical URL on the market's TRUE slug
// (an old slug answers {status: "moved"} and the client replaces the address), and a breadcrumb
// schema. A backend 404 is a real 404; a transient failure keeps generic metadata at 200.
//
// TALKS TO GET wagers/markets/<slug>/ (afc_wager/views_public.py market_detail).

type Props = { params: Promise<{ slug: string }>; children: ReactNode };

interface MarketMeta {
  slug: string;
  title: string;
  description: string;
  status: string;
  event: { slug: string; name: string };
  pool_kobo: number;
  rake_bps: number;
  min_stake_kobo: number;
  image: string | null;
}

async function getMarket(slug: string) {
  return fetchDetail<MarketMeta>(
    `${env.NEXT_PUBLIC_BACKEND_API_URL}/wagers/markets/${encodeURIComponent(slug)}/`,
    { next: { revalidate: 60 } },
    (j) => (j && j.title ? (j as MarketMeta) : j?.status === "moved" ? null : null),
  );
}

// Server side there is no viewer locale, so this renders the English form (R31: one money
// formatter, lib/money.ts, never a hand-rolled toLocaleString).
function naira(kobo: number) {
  return formatMoney((kobo || 0) / 100, "NGN");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getMarket(slug);
  if (result.status === "missing") notFound();
  const m = result.status === "ok" ? result.data : null;
  if (!m) {
    return generateDynamicMetadata({
      title: "Wager market",
      description: "A pool wager on an AFC Free Fire match.",
      url: `/wagers/${slug}`,
    });
  }
  const description = `${m.event.name}: ${m.title}. Pool ${naira(m.pool_kobo)}, minimum stake ${naira(m.min_stake_kobo)}, ${m.rake_bps / 100}% house rake. ${m.description || ""}`.trim();
  return generateDynamicMetadata({
    title: m.title,
    description: description.slice(0, 300),
    url: `/wagers/${m.slug || slug}`,
    image: m.image || undefined,
  });
}

export default async function Layout({ params, children }: Props) {
  const { slug } = await params;
  const result = await getMarket(slug);
  const m = result.status === "ok" ? result.data : null;
  const breadcrumb = m
    ? generateBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Wagers", path: "/wagers" },
        { name: m.title, path: `/wagers/${m.slug}` },
      ])
    : null;
  return (
    <>
      {breadcrumb && <script {...jsonLd(breadcrumb)} />}
      {children}
    </>
  );
}
