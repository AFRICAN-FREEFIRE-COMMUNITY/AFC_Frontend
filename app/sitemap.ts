// app/sitemap.ts
//
// Generates /sitemap.xml for AFC via the Next.js MetadataRoute.Sitemap API.
//
// It lists the STATIC public routes plus the DYNAMIC entity pages, fetched
// server-side from the Django backend at request time. Each entity fetch is
// wrapped in its own try/catch and a hard cap, so:
//   - one failing endpoint degrades to "just the other routes" (never a 500 —
//     a sitemap that errors is worse for SEO than a partial one), and
//   - a huge collection can never blow up the response size.
//
// CONNECTS TO:
//   - lib/seo.ts        → siteConfig.url is the canonical origin for every <loc>.
//   - lib/env.ts        → NEXT_PUBLIC_BACKEND_API_URL is the API base we fetch.
//   - app/robots.ts     → points crawlers at this file (/sitemap.xml).
//   - The route slugs below MUST match the real app routes:
//       /tournaments/<event.slug>          app/(user)/tournaments/[slug]
//       /teams/<team.team_name>            app/(user)/teams/[id]  (id == team_name)
//       /organizations/<org.slug>          app/(user)/organizations/[slug]
//       /news/<article.slug>               app/(user)/news/[slug]
//       /shop/<product.id>                 app/(user)/shop/[id]
//
// PLAYERS ARE INTENTIONALLY SKIPPED: the only player-list endpoint
// (GET /player/get-all-players/) is the ADMIN list of ~6k users (every account,
// not a curated public set). Dumping 6k profile URLs would bloat the sitemap and
// list non-public users, so players are omitted here. Individual player pages are
// still crawlable (linked from teams/rankings) and carry their own JSON-LD + OG.
import { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo";
import { env } from "@/lib/env";

// API base for every dynamic fetch. Falls back to the prod API host if the env
// is somehow unset, so a build never hard-fails on a missing var.
const API =
  env.NEXT_PUBLIC_BACKEND_API_URL || "https://api.africanfreefirecommunity.com";

// Per-collection caps. Generous enough to cover the real data set today, low
// enough to guarantee a sane, fast sitemap even if a collection grows large.
const CAP_EVENTS = 1000;
const CAP_TEAMS = 2000; // ~567 teams today; headroom without risking a giant file
const CAP_ORGS = 1000;
const CAP_NEWS = 1000;
const CAP_PRODUCTS = 1000;

// Shared cached GET. revalidate keeps the sitemap fresh (hourly) without
// hammering the backend on every crawler hit. Returns parsed JSON or null.
async function getJson(path: string): Promise<any | null> {
  try {
    const res = await fetch(`${API}${path}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // Network/parse failure → caller falls back to no entries for this group.
    return null;
  }
}

// Coerce a backend date string into a Date for <lastmod>, falling back to "now"
// when the value is missing/invalid (an invalid Date would break the XML).
function toDate(value?: string | null): Date {
  if (!value) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const now = new Date();

  // ── STATIC public routes ───────────────────────────────────────────────────
  // The evergreen, always-indexable pages. Priority/changeFrequency reflect how
  // central + how often-updated each one is (home + the live listings rank top).
  const staticRoutes: {
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }[] = [
    { path: "/", changeFrequency: "daily", priority: 1.0 },
    { path: "/home", changeFrequency: "daily", priority: 0.9 },
    { path: "/teams", changeFrequency: "daily", priority: 0.9 },
    { path: "/tournaments", changeFrequency: "daily", priority: 0.9 },
    { path: "/rankings", changeFrequency: "daily", priority: 0.9 },
    { path: "/news", changeFrequency: "daily", priority: 0.9 },
    { path: "/awards", changeFrequency: "weekly", priority: 0.7 },
    { path: "/player-markets", changeFrequency: "weekly", priority: 0.7 },
    { path: "/shop", changeFrequency: "weekly", priority: 0.8 },
    { path: "/leaderboards", changeFrequency: "weekly", priority: 0.7 },
    { path: "/about", changeFrequency: "monthly", priority: 0.6 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
    { path: "/glossary", changeFrequency: "monthly", priority: 0.5 },
    { path: "/rules", changeFrequency: "monthly", priority: 0.5 },
    { path: "/privacy-policy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/terms-of-service", changeFrequency: "yearly", priority: 0.3 },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((r) => ({
    url: `${base}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // ── DYNAMIC entities (fetched in parallel; each independently safe) ─────────
  const [eventsData, teamsData, orgsData, newsData, productsData] =
    await Promise.all([
      getJson("/events/get-all-events/"),
      getJson("/team/get-all-teams/"),
      getJson("/organizers/get-organizations-public/"),
      getJson("/auth/get-all-news/"),
      getJson("/shop/view-active-products/"),
    ]);

  // Tournaments → /tournaments/<slug>. lastmod uses event_date (no updated_at
  // is exposed on this list endpoint). Only events that carry a slug are linked.
  const events: any[] = Array.isArray(eventsData?.events)
    ? eventsData.events
    : [];
  const eventEntries: MetadataRoute.Sitemap = events
    .filter((e) => e?.slug)
    .slice(0, CAP_EVENTS)
    .map((e) => ({
      url: `${base}/tournaments/${e.slug}`,
      lastModified: toDate(e.updated_at || e.event_date),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  // Teams → /teams/<team_name> (the [id] route segment is the team_name; the
  // detail page + links all use team_name). Encode the name for a safe URL.
  const teams: any[] = Array.isArray(teamsData?.teams) ? teamsData.teams : [];
  const teamEntries: MetadataRoute.Sitemap = teams
    .filter((t) => t?.team_name && !t?.is_banned)
    .slice(0, CAP_TEAMS)
    .map((t) => ({
      url: `${base}/teams/${encodeURIComponent(t.team_name)}`,
      lastModified: toDate(t.updated_at || t.creation_date),
      changeFrequency: "weekly",
      priority: 0.6,
    }));

  // Organizations → /organizations/<slug>.
  const orgs: any[] = Array.isArray(orgsData?.organizations)
    ? orgsData.organizations
    : [];
  const orgEntries: MetadataRoute.Sitemap = orgs
    .filter((o) => o?.slug)
    .slice(0, CAP_ORGS)
    .map((o) => ({
      url: `${base}/organizations/${o.slug}`,
      lastModified: toDate(o.updated_at),
      changeFrequency: "weekly",
      priority: 0.6,
    }));

  // News → /news/<slug>. lastmod prefers updated_at, falls back to created_at.
  const news: any[] = Array.isArray(newsData?.news) ? newsData.news : [];
  const newsEntries: MetadataRoute.Sitemap = news
    .filter((a) => a?.slug)
    .slice(0, CAP_NEWS)
    .map((a) => ({
      url: `${base}/news/${a.slug}`,
      lastModified: toDate(a.updated_at || a.created_at),
      changeFrequency: "monthly",
      priority: 0.7,
    }));

  // Shop products → /shop/<id>.
  const products: any[] = Array.isArray(productsData?.products)
    ? productsData.products
    : [];
  const productEntries: MetadataRoute.Sitemap = products
    .filter((p) => p?.id != null)
    .slice(0, CAP_PRODUCTS)
    .map((p) => ({
      url: `${base}/shop/${p.id}`,
      lastModified: toDate(p.updated_at || p.created_at),
      changeFrequency: "weekly",
      priority: 0.6,
    }));

  // Static first (highest priority), then each dynamic group.
  return [
    ...staticEntries,
    ...eventEntries,
    ...teamEntries,
    ...orgEntries,
    ...newsEntries,
    ...productEntries,
  ];
}
