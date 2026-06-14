// import { Metadata } from "next";
// import { env } from "./env";

// // Site configuration
// export const siteConfig = {
//   name: "African Freefire Community",
//   shortName: "AFC",
//   description:
//     "The official platform for African Free Fire esports. Join teams, compete in tournaments, track player stats, and stay updated with the latest Free Fire news across Africa.",
//   url: `${env.NEXT_PUBLIC_URL}`,
//   ogImage: `${env.NEXT_PUBLIC_URL}/logo.png`,
//   links: {
//     twitter: "https://twitter.com/afcdatabase",
//     instagram: "https://instagram.com/africanfreefirecommunity",
//     facebook: "https://facebook.com/share/1G4D9jDyyt/",
//     youtube: "https://youtube.com/@AFRICANFREEFIRECOMMUNITY1",
//     tiktok: "https://tiktok.com/@africanfreefirecommunity",
//     discord: "https://discord.gg/afc",
//   },
//   email: "info@africanfreefirecommunity.com",
//   creator: "African Freefire Community",
//   keywords: [
//     "Free Fire",
//     "Free Fire Africa",
//     "African esports",
//     "Free Fire esports",
//     "Free Fire tournament",
//     "Free Fire teams",
//     "Free Fire players",
//     "African Free Fire Community",
//     "AFC",
//     "Free Fire news",
//     "Free Fire stats",
//     "Garena Free Fire",
//     "Free Fire competitive",
//     "African gaming",
//     "esports Africa",
//     "Free Fire guild",
//     "Free Fire clan",
//     "Free Fire rankings",
//     "Tomiwa Adelae",
//     "Adelae",
//     "Tomiwa",
//   ],
// };

// // Default metadata for the entire site
// export const defaultMetadata: Metadata = {
//   metadataBase: new URL(siteConfig.url),
//   title: {
//     default: `${siteConfig.name} | Free Fire Esports Platform`,
//     template: `%s | ${siteConfig.shortName}`,
//   },
//   description: siteConfig.description,
//   keywords: siteConfig.keywords,
//   authors: [{ name: siteConfig.creator, url: siteConfig.url }],
//   creator: siteConfig.creator,
//   publisher: siteConfig.name,
//   robots: {
//     index: true,
//     follow: true,
//     googleBot: {
//       index: true,
//       follow: true,
//       "max-video-preview": -1,
//       "max-image-preview": "large",
//       "max-snippet": -1,
//     },
//   },
//   openGraph: {
//     type: "website",
//     locale: "en_US",
//     url: siteConfig.url,
//     siteName: siteConfig.name,
//     title: siteConfig.name,
//     description: siteConfig.description,
//     images: "/assets/opengraph.png",
//   },
//   twitter: {
//     card: "summary_large_image",
//     title: siteConfig.name,
//     description: siteConfig.description,
//     images: [siteConfig.ogImage],
//     creator: "@afcdatabase",
//     site: "@afcdatabase",
//   },
//   icons: {
//     icon: [
//       { url: "/favicon.ico", sizes: "any" },
//       { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
//       { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
//     ],
//     apple: [
//       { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
//     ],
//   },
//   manifest: "/site.webmanifest",
//   alternates: {
//     canonical: siteConfig.url,
//   },
//   verification: {
//     // Add your verification codes here when you have them
//     // google: "your-google-verification-code",
//     // yandex: "your-yandex-verification-code",
//   },
//   category: "esports",
// };

// // Helper function to generate page metadata
// export function generatePageMetadata({
//   title,
//   description,
//   keywords = [],
//   image,
//   url,
//   noIndex = false,
// }: {
//   title: string;
//   description: string;
//   keywords?: string[];
//   image?: string;
//   url?: string;
//   noIndex?: boolean;
// }): Metadata {
//   const pageUrl = url ? `${siteConfig.url}${url}` : siteConfig.url;
//   const pageImage = image || siteConfig.ogImage;
//   const allKeywords = [...siteConfig.keywords, ...keywords];

//   return {
//     title,
//     description,
//     keywords: allKeywords,
//     robots: noIndex
//       ? { index: false, follow: false }
//       : { index: true, follow: true },
//     openGraph: {
//       title: `${title} | ${siteConfig.shortName}`,
//       description,
//       url: pageUrl,
//       siteName: siteConfig.name,
//       images: [
//         {
//           url: pageImage,
//           width: 1200,
//           height: 630,
//           alt: title,
//         },
//       ],
//       type: "website",
//     },
//     twitter: {
//       card: "summary_large_image",
//       title: `${title} | ${siteConfig.shortName}`,
//       description,
//       images: [pageImage],
//     },
//     alternates: {
//       canonical: pageUrl,
//     },
//   };
// }

// // Helper for dynamic pages (teams, players, news)
// export function generateDynamicMetadata({
//   title,
//   description,
//   image,
//   url,
//   type = "website",
//   publishedTime,
//   modifiedTime,
//   authors,
//   tags,
// }: {
//   title: string;
//   description: string;
//   image?: string;
//   url: string;
//   type?: "website" | "article" | "profile";
//   publishedTime?: string;
//   modifiedTime?: string;
//   authors?: string[];
//   tags?: string[];
// }): Metadata {
//   // const pageUrl = `${siteConfig.url}${url}`;
//   // const pageImage = image || siteConfig.ogImage;

//   const siteUrl = process.env.NEXT_PUBLIC_URL;
//   const pageImage = image || `${siteUrl}/default-og.png`; // Fallback to a default if news has no image

//   const metadata: Metadata = {
//     title,
//     description,
//     keywords: tags ? [...siteConfig.keywords, ...tags] : siteConfig.keywords,
//     openGraph: {
//       title: `${title} | ${siteConfig.shortName}`,
//       description,
//       url: pageUrl,
//       siteName: siteConfig.name,
//       images: [
//         {
//           url: pageImage,
//           width: 1200,
//           height: 630,
//           alt: title,
//         },
//       ],
//       type: type === "article" ? "article" : "website",
//       ...(type === "article" && {
//         publishedTime,
//         modifiedTime,
//         authors,
//         tags,
//       }),
//     },
//     twitter: {
//       card: "summary_large_image",
//       title: `${title} | ${siteConfig.shortName}`,
//       description,
//       images: [pageImage],
//     },
//     alternates: {
//       canonical: pageUrl,
//     },
//   };

//   return metadata;
// }

// // JSON-LD structured data helpers
// export function generateOrganizationSchema() {
//   return {
//     "@context": "https://schema.org",
//     "@type": "Organization",
//     name: siteConfig.name,
//     alternateName: siteConfig.shortName,
//     url: siteConfig.url,
//     logo: `${siteConfig.url}/logo.png`,
//     description: siteConfig.description,
//     email: siteConfig.email,
//     sameAs: [
//       siteConfig.links.twitter,
//       siteConfig.links.instagram,
//       siteConfig.links.facebook,
//       siteConfig.links.youtube,
//       siteConfig.links.tiktok,
//     ],
//     foundingDate: "2024",
//     areaServed: "Africa",
//     slogan: "Uniting African Free Fire Players",
//   };
// }

// export function generateWebsiteSchema() {
//   return {
//     "@context": "https://schema.org",
//     "@type": "WebSite",
//     name: siteConfig.name,
//     alternateName: siteConfig.shortName,
//     url: siteConfig.url,
//     description: siteConfig.description,
//     potentialAction: {
//       "@type": "SearchAction",
//       target: {
//         "@type": "EntryPoint",
//         urlTemplate: `${siteConfig.url}/teams?search={search_term_string}`,
//       },
//       "query-input": "required name=search_term_string",
//     },
//   };
// }

// export function generateArticleSchema({
//   title,
//   description,
//   image,
//   url,
//   publishedTime,
//   modifiedTime,
//   author,
// }: {
//   title: string;
//   description: string;
//   image?: string;
//   url: string;
//   publishedTime: string;
//   modifiedTime?: string;
//   author: string;
// }) {
//   return {
//     "@context": "https://schema.org",
//     "@type": "NewsArticle",
//     headline: title,
//     description,
//     image: image || siteConfig.ogImage,
//     url: `${siteConfig.url}${url}`,
//     datePublished: publishedTime,
//     dateModified: modifiedTime || publishedTime,
//     author: {
//       "@type": "Person",
//       name: author,
//     },
//     publisher: {
//       "@type": "Organization",
//       name: siteConfig.name,
//       logo: {
//         "@type": "ImageObject",
//         url: `${siteConfig.url}/logo.png`,
//       },
//     },
//     mainEntityOfPage: {
//       "@type": "WebPage",
//       "@id": `${siteConfig.url}${url}`,
//     },
//   };
// }

// export function generateTeamSchema({
//   name,
//   description,
//   image,
//   url,
//   memberCount,
//   country,
// }: {
//   name: string;
//   description?: string;
//   image?: string;
//   url: string;
//   memberCount?: number;
//   country?: string;
// }) {
//   return {
//     "@context": "https://schema.org",
//     "@type": "SportsTeam",
//     name,
//     description: description || `${name} - Free Fire esports team on AFC`,
//     image: image || siteConfig.ogImage,
//     url: `${siteConfig.url}${url}`,
//     sport: "Esports",
//     memberOf: {
//       "@type": "SportsOrganization",
//       name: siteConfig.name,
//     },
//     ...(memberCount && { numberOfEmployees: memberCount }),
//     ...(country && {
//       location: {
//         "@type": "Place",
//         name: country,
//       },
//     }),
//   };
// }

// export function generatePlayerSchema({
//   name,
//   description,
//   image,
//   url,
//   team,
//   country,
// }: {
//   name: string;
//   description?: string;
//   image?: string;
//   url: string;
//   team?: string;
//   country?: string;
// }) {
//   return {
//     "@context": "https://schema.org",
//     "@type": "Person",
//     name,
//     description: description || `${name} - Free Fire player on AFC`,
//     image: image || siteConfig.ogImage,
//     url: `${siteConfig.url}${url}`,
//     jobTitle: "Professional Gamer",
//     ...(team && {
//       memberOf: {
//         "@type": "SportsTeam",
//         name: team,
//       },
//     }),
//     ...(country && {
//       nationality: {
//         "@type": "Country",
//         name: country,
//       },
//     }),
//   };
// }

import { Metadata } from "next";
import { env } from "./env";

// 1. Centralized Site Configuration
export const siteConfig = {
  name: "African Freefire Community",
  shortName: "AFC",
  description:
    "The official platform for African Free Fire esports. Join teams, compete in tournaments, track player stats, and stay updated with the latest news across Africa.",
  url: env.NEXT_PUBLIC_URL || "https://africanfreefirecommunity.com",
  // Site-wide SOCIAL CARD fallback (og:image + twitter:image) used whenever a page
  // has no entity image of its own. This MUST be the wide 1200x630 branded card,
  // NOT the square logo: a summary_large_image Twitter card / Discord embed
  // letterboxes or crops a square image badly. (audit 2026-06-14: twitter was
  // falling back to /logo.png while OG used /assets/opengraph.png, so X showed the
  // square logo. Pointing both at the wide card fixes that mismatch in one place,
  // since defaultMetadata, generatePageMetadata, and generateDynamicMetadata all
  // fall back to siteConfig.ogImage.) The square /logo.png is still used directly as
  // the schema.org Organization `logo` (a brand mark, which SHOULD be square).
  ogImage: `${env.NEXT_PUBLIC_URL || "https://africanfreefirecommunity.com"}/assets/opengraph.png`,
  links: {
    twitter: "https://twitter.com/afcdatabase",
    instagram: "https://instagram.com/africanfreefirecommunity",
    facebook: "https://facebook.com/share/1G4D9jDyyt/",
    youtube: "https://youtube.com/@AFRICANFREEFIRECOMMUNITY1",
    tiktok: "https://tiktok.com/@africanfreefirecommunity",
    discord: "https://discord.gg/afc",
  },
  email: "info@africanfreefirecommunity.com",
  creator: "African Freefire Community",
  keywords: [
    "Free Fire",
    "Free Fire Africa",
    "African esports",
    "Free Fire tournament",
    "AFC",
    "Free Fire stats",
    "esports Africa",
    "Free Fire rankings",
    "Free Fire Nigeria",
    "Nigeria Free Fire tournament",
    "Free Fire clash cup Nigeria",
    "African Freefire Community",
    "Free Fire West Africa",
    "Free Fire Ghana",
    "Free Fire Kenya",
    "Garena Free Fire Africa",
    "Free Fire competitive Nigeria",
  ],
};

// 2. Default Site Metadata
export const defaultMetadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} | Free Fire Esports Platform`,
    template: `%s | ${siteConfig.shortName}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [{ name: siteConfig.creator, url: siteConfig.url }],
  creator: siteConfig.creator,
  publisher: siteConfig.name,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    images: [{ url: "/assets/opengraph.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: "@afcdatabase",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  alternates: {
    canonical: siteConfig.url,
  },
  category: "esports",
};

/**
 * Helper to generate static page metadata
 */
export function generatePageMetadata({
  title,
  description,
  keywords = [],
  image,
  url,
  noIndex = false,
}: {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  url?: string;
  noIndex?: boolean;
}): Metadata {
  const pageUrl = url ? `${siteConfig.url}${url}` : siteConfig.url;
  const pageImage = image || siteConfig.ogImage;

  return {
    title,
    description,
    keywords: [...siteConfig.keywords, ...keywords],
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: `${title} | ${siteConfig.shortName}`,
      description,
      url: pageUrl,
      // siteName so the embed shows the AFC label (Next does NOT deep-merge a
      // page's openGraph onto the root default, so we set it here too).
      siteName: siteConfig.name,
      images: [{ url: pageImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteConfig.shortName}`,
      description,
      images: [pageImage],
    },
    alternates: { canonical: pageUrl },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared link-embed (Open Graph + Twitter Card) plumbing
//
// These three helpers are the single source of truth for turning a backend
// entity (event / player / team / org / news / product) into a rich, page-
// specific social embed. Every per-route `generateMetadata` (and every route
// `layout.tsx` that owns metadata for a client page) builds on them so the
// embeds stay consistent: large image, absolute URLs, AFC site name.
//
// Who calls these:
//   - app/(user)/tournaments/[slug]/page.tsx      (event)
//   - app/(user)/players/[username]/page.tsx      (player)
//   - app/(user)/teams/[id]/layout.tsx            (team - page is "use client")
//   - app/(user)/organizations/[slug]/layout.tsx  (org   - page is "use client")
//   - app/(user)/news/[slug]/page.tsx             (news article)
//   - app/(user)/shop/[id]/page.tsx               (shop product)
//
// They depend on env (NEXT_PUBLIC_URL for our origin, NEXT_PUBLIC_BACKEND_API_URL
// for the media origin) and on the /api/og-image proxy route, which re-serves a
// backend /media/ image from OUR domain so social crawlers (Discord, X, etc.)
// can always fetch it even when the backend host blocks bots or sets odd headers.
// ─────────────────────────────────────────────────────────────────────────────

// The backend origin (scheme + host[:port]) that serves /media/ uploads. Derived
// from the same env the app uses for every API call, so it is correct in BOTH
// local dev (http://localhost:8000) and production (https://api.african...com).
// Falls back to the known prod API host if the env is somehow unset.
const BACKEND_ORIGIN = (() => {
  try {
    return new URL(
      env.NEXT_PUBLIC_BACKEND_API_URL ||
        "https://api.africanfreefirecommunity.com",
    ).origin;
  } catch {
    return "https://api.africanfreefirecommunity.com";
  }
})();

/**
 * Resolve a raw image reference from the backend into an ABSOLUTE, crawler-safe
 * URL suitable for og:image / twitter:image.
 *
 * Rules, in order:
 *   1. Empty / missing            -> the site-wide default OG image (logo card).
 *   2. A backend /media/ image    -> route it through OUR /api/og-image proxy so
 *      (absolute or relative)        the crawler fetches it from our own origin.
 *   3. Any other absolute http(s) -> returned untouched (already crawler-safe,
 *      URL (e.g. a CDN avatar)        e.g. the DEFAULT_PROFILE_PICTURE fallback).
 *   4. A bare relative path that   -> joined onto our own front-end origin.
 *      is not /media/ (a /public asset)
 *
 * Always returns an absolute URL string. Never throws.
 */
export function resolveOgImage(raw?: string | null): string {
  // 1. Nothing usable -> site default (an absolute 1200x630 branded card).
  if (!raw || typeof raw !== "string" || raw.trim() === "") {
    return `${siteConfig.url}/assets/opengraph.png`;
  }

  const value = raw.trim();

  // Build the absolute form first so we can test whether it points at /media/.
  // A relative "/media/x.png" becomes "<backend-origin>/media/x.png"; an already
  // absolute URL is left as-is for the test.
  const absolute = value.startsWith("http")
    ? value
    : `${BACKEND_ORIGIN}/${value.replace(/^\//, "")}`;

  // 2. Backend media -> proxy through our own domain (the og-image route only
  // re-serves images whose origin matches the backend, so crawlers get a clean
  // same-origin fetch with sane cache headers).
  if (absolute.startsWith(`${BACKEND_ORIGIN}/media/`)) {
    return `${siteConfig.url}/api/og-image?url=${encodeURIComponent(absolute)}`;
  }

  // 3. Some other absolute URL (CDN avatar, external fallback) -> use directly.
  if (value.startsWith("http")) {
    return value;
  }

  // 4. A bare relative path that is a front-end /public asset (e.g. "/logo.png").
  return `${siteConfig.url}/${value.replace(/^\//, "")}`;
}

/**
 * Format a raw team_tier value into a clean human label for copy/badges.
 * The backend stores tier as a bare code: "3", "tier_3", or sometimes a ready
 * label like "Tier 3". This normalizes all of them to "Tier 3"; an already-nice
 * label is returned as-is, and an empty value yields null (so callers can omit it).
 * Used by the team layout description and the team OG card.
 */
export function formatTier(raw?: string | number | null): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim();
  // Bare number ("3") or "tier_3"/"tier-3" → "Tier 3".
  const m = s.match(/(?:tier[_\s-]*)?(\d+)/i);
  if (m) return `Tier ${m[1]}`;
  // Already a friendly label (e.g. "Pro", "Tier 1") → leave it.
  return s;
}

/**
 * Build a complete, rich link-embed Metadata object for a single ENTITY page.
 *
 * This is the dynamic-page counterpart to generatePageMetadata (static pages).
 * It always emits a LARGE Twitter card (summary_large_image) so shares render as
 * a big detailed embed, resolves the image to an absolute crawler-safe URL via
 * resolveOgImage, and keeps og:url / canonical / og:image absolute.
 *
 * @param title        the entity name (event / player / team / org / product / headline)
 * @param description  one-line, info-rich summary (already trimmed by the caller)
 * @param path         the page path beginning with "/" (e.g. "/players/Xyz")
 * @param image        raw backend image ref (relative /media/, absolute, or null)
 * @param type         OG type: "website" (default), "article", or "profile"
 * @param tags         extra keywords merged onto the site keyword set
 * @param publishedTime/authors  article-only fields (news)
 */
export function buildEntityMetadata({
  title,
  description,
  path,
  image,
  type = "website",
  tags = [],
  publishedTime,
  authors,
  omitImage = false,
}: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: "website" | "article" | "profile";
  tags?: string[];
  publishedTime?: string;
  authors?: string[];
  // When true, emit NO og:image / twitter:image here. Used by routes that own a
  // sibling opengraph-image.tsx (player, team) so the generated branded card is
  // the single image and we don't emit a second, competing tag. The Twitter card
  // type stays "summary_large_image" so the generated image still renders LARGE.
  omitImage?: boolean;
}): Metadata {
  const pageUrl = `${siteConfig.url}${path}`;
  const fullTitle = `${title} | ${siteConfig.shortName}`;
  // Only resolve an image when we are actually emitting one.
  const ogImage = omitImage ? null : resolveOgImage(image);

  return {
    title,
    description,
    keywords: [...siteConfig.keywords, ...tags.filter(Boolean)],
    openGraph: {
      title: fullTitle,
      description,
      url: pageUrl,
      siteName: siteConfig.name,
      ...(ogImage
        ? { images: [{ url: ogImage, width: 1200, height: 630, alt: title }] }
        : {}),
      type: type === "article" ? "article" : "website",
      ...(type === "article" && publishedTime
        ? { publishedTime, authors }
        : {}),
    },
    twitter: {
      // Always LARGE so the share renders as a big detailed embed, never a thumbnail.
      card: "summary_large_image",
      title: fullTitle,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    alternates: { canonical: pageUrl },
  };
}

/**
 * Helper for dynamic items (News, Teams, Players)
 * Correctly maps the provided image to OG and Twitter tags
 */
export function generateDynamicMetadata({
  title,
  description,
  image,
  url,
  type = "website",
  publishedTime,
  modifiedTime,
  authors,
  tags = [],
}: {
  title: string;
  description: string;
  image?: string;
  url: string;
  type?: "website" | "article" | "profile";
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  tags?: string[];
}): Metadata {
  const pageUrl = `${siteConfig.url}${url}`;
  const pageImage = image || siteConfig.ogImage;

  return {
    title,
    description,
    keywords: [...siteConfig.keywords, ...tags],
    openGraph: {
      title: `${title} | ${siteConfig.shortName}`,
      description,
      url: pageUrl,
      siteName: siteConfig.name,
      images: [
        {
          url: pageImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      type: type === "article" ? "article" : "website",
      ...(type === "article" && {
        publishedTime,
        modifiedTime,
        authors,
        tags,
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteConfig.shortName}`,
      description,
      images: [pageImage],
    },
    alternates: {
      canonical: pageUrl,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON-LD STRUCTURED DATA (schema.org)
//
// These helpers turn a backend entity into a schema.org object that we embed as
// a <script type="application/ld+json"> in the INITIAL server-rendered HTML of
// each key page. This is what makes AFC pages eligible for Google rich results
// AND lets AI crawlers (GPTBot, ClaudeBot, Google-Extended, PerplexityBot, etc.)
// read clean, structured facts about an entity instead of scraping the DOM.
//
// HOW THEY CONNECT:
//   - jsonLd(obj)                  → the single render helper. Every server
//     page/layout passes a schema object through it and spreads the result onto
//     a <script> element, so the markup is identical everywhere and always lands
//     in the initial HTML (crawler-visible, not client-injected).
//   - generateOrganizationSchema / generateWebsiteSchema → app/layout.tsx (root).
//   - generateEventSchema          → app/(user)/tournaments/[slug]/page.tsx.
//   - generateTeamSchema           → app/(user)/teams/[id]/layout.tsx.
//   - generatePlayerSchema         → app/(user)/players/[username]/page.tsx.
//   - generatePublicOrgSchema      → app/(user)/organizations/[slug]/layout.tsx.
//   - generateArticleSchema        → app/(user)/news/[slug]/page.tsx.
//   - generateProductSchema        → app/(user)/shop/[id]/page.tsx.
//   - generateBreadcrumbSchema     → the same detail pages, for the Home > … trail.
//
// They consume the SAME entity object the route already fetched for its
// generateMetadata (no second fetch), and fall back gracefully (the caller omits
// the <script> when the entity fetch fails). All URLs are absolute (siteConfig.url).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render helper: turn any schema.org object into the props for a JSON-LD
 * <script> tag. Usage in a server component:
 *
 *   <script {...jsonLd(generateEventSchema(...))} />
 *
 * Returns the exact props React needs (type + dangerouslySetInnerHTML) so every
 * call site is one line and consistent. The JSON is stringified here so callers
 * never hand-roll JSON.stringify (and never forget the `type`).
 */
export function jsonLd(schema: object): {
  type: "application/ld+json";
  dangerouslySetInnerHTML: { __html: string };
} {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(schema) },
  };
}

// --- JSON-LD SCHEMA HELPERS ---

// Root-layout Organization schema: identifies the AFC brand itself (name, logo,
// social profiles). Embedded once in app/layout.tsx so it appears site-wide.
export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    alternateName: siteConfig.shortName,
    url: siteConfig.url,
    logo: `${siteConfig.url}/logo.png`,
    description: siteConfig.description,
    email: siteConfig.email,
    // Social profiles let search/AI engines tie the brand to its known accounts.
    sameAs: Object.values(siteConfig.links),
  };
}

export function generateArticleSchema({
  title,
  description,
  image,
  url,
  publishedTime,
  author,
}: {
  title: string;
  description: string;
  image?: string;
  url: string;
  publishedTime: string;
  author: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    description,
    image: image || siteConfig.ogImage,
    datePublished: publishedTime,
    author: { "@type": "Person", name: author },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: { "@type": "ImageObject", url: `${siteConfig.url}/logo.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${siteConfig.url}${url}` },
  };
}

export function generateTeamSchema({
  name,
  description,
  image,
  url,
  country,
}: {
  name: string;
  description?: string;
  image?: string;
  url: string;
  country?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name,
    description: description || `${name} Free Fire team on AFC`,
    image: image || siteConfig.ogImage,
    url: `${siteConfig.url}${url}`,
    location: country ? { "@type": "Place", name: country } : undefined,
  };
}

// Make sure it is exported and named correctly!
export function generateWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    alternateName: siteConfig.shortName,
    url: siteConfig.url,
    description: siteConfig.description,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteConfig.url}/teams?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity JSON-LD generators (event / player / public-org / product / breadcrumb)
//
// Each takes ALREADY-FETCHED backend fields (no fetching here) and returns a
// schema.org object. Optional fields are only included when present, so the
// markup never asserts data we do not have (truth rule: no fabricated values).
// Consumed by the matching server page/layout via the jsonLd() render helper.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SportsEvent for a tournament detail page.
 * Source page: app/(user)/tournaments/[slug]/page.tsx (reuses the event it
 * already fetched from POST /events/get-event-details-not-logged-in/).
 *
 * Maps AFC event fields → schema: name, start/end date, the organizing AFC sub-
 * organization, banner image, location (esports events are ONLINE so we emit a
 * VirtualLocation), and an offers/prize hint when a prize pool exists. All inputs
 * are optional except name+url; missing fields are simply omitted.
 */
export function generateEventSchema({
  name,
  url,
  startDate,
  endDate,
  image,
  organizerName,
  organizerSlug,
  prizeText,
}: {
  name: string;
  url: string; // absolute
  startDate?: string | null;
  endDate?: string | null;
  image?: string | null; // already absolute/crawler-safe
  organizerName?: string | null;
  organizerSlug?: string | null;
  prizeText?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name,
    url,
    sport: "Esports",
    ...(startDate ? { startDate } : {}),
    // schema requires endDate >= startDate; default it to startDate when unknown.
    ...(endDate || startDate ? { endDate: endDate || startDate } : {}),
    ...(image ? { image } : {}),
    // Free Fire tournaments are played online → VirtualLocation with the watch URL.
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: {
      "@type": "VirtualLocation",
      url,
    },
    // The organizer is an AFC sub-organization (the org running the tournament).
    ...(organizerName
      ? {
          organizer: {
            "@type": "Organization",
            name: organizerName,
            ...(organizerSlug
              ? { url: `${siteConfig.url}/organizations/${organizerSlug}` }
              : {}),
          },
        }
      : {}),
    // The platform that publishes/hosts the listing is AFC itself.
    superEvent: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    // Prize pools are stored as free text ("1750.0 WORTH OF PRIZES") — surface it
    // as an offers description rather than a fake numeric price.
    ...(prizeText
      ? {
          offers: {
            "@type": "Offer",
            description: `Prize pool: ${prizeText}`,
            url,
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };
}

/**
 * Person + ProfilePage hint for a player profile.
 * Source page: app/(user)/players/[username]/page.tsx (reuses the player it
 * already fetched from POST /player/get-public-player-stats/).
 *
 * Emits a Person (the athlete) wrapped as the mainEntity of a ProfilePage, with
 * team membership and the public aggregate stats expressed as
 * interactionStatistic-style notes. Only real, present stats are included.
 */
export function generatePlayerSchema({
  name,
  url,
  image,
  teamName,
  country,
  stats,
}: {
  name: string;
  url: string; // absolute
  image?: string | null; // already absolute/crawler-safe
  teamName?: string | null;
  country?: string | null;
  // Free-form, already-formatted stat bits (e.g. "120 kills", "8 wins") — only
  // the ones the page actually has. Joined into the Person description.
  stats?: string[];
}) {
  const statLine =
    stats && stats.length > 0 ? ` Career: ${stats.join(", ")}.` : "";
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name,
      url,
      jobTitle: "Professional Free Fire Player",
      description:
        `${name} is a competitive Free Fire esports athlete on ${siteConfig.name}.${statLine}`.trim(),
      ...(image ? { image } : {}),
      ...(teamName
        ? { memberOf: { "@type": "SportsTeam", name: teamName } }
        : {}),
      ...(country
        ? { nationality: { "@type": "Country", name: country } }
        : {}),
    },
  };
}

/**
 * Organization schema for a PUBLIC organizer page (a tournament organizer that
 * runs events on AFC — NOT the AFC brand itself).
 * Source: app/(user)/organizations/[slug]/layout.tsx (reuses the org it fetched
 * from GET /organizers/get-organization-public/<slug>/).
 */
export function generatePublicOrgSchema({
  name,
  url,
  logo,
  description,
}: {
  name: string;
  url: string; // absolute
  logo?: string | null; // already absolute/crawler-safe
  description?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    ...(logo ? { logo } : {}),
    description:
      (description || "").trim() ||
      `${name} is a Free Fire tournament organizer on ${siteConfig.name}.`,
    // It operates within the AFC platform.
    parentOrganization: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
  };
}

/**
 * Product schema for a shop product detail page.
 * Source: app/(user)/shop/[id]/page.tsx (reuses the product it fetched from
 * GET /shop/view-product-details/?product_id=<id>).
 *
 * Prices come from the cheapest active variant. AFC shop prices are in NGN
 * (Paystack). Only emits an offer when a usable price exists.
 */
export function generateProductSchema({
  name,
  url,
  image,
  description,
  price,
  currency = "NGN",
  inStock = true,
}: {
  name: string;
  url: string; // absolute
  image?: string | null; // already absolute/crawler-safe
  description?: string | null;
  price?: number | null;
  currency?: string;
  inStock?: boolean;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    url,
    ...(image ? { image } : {}),
    ...(description ? { description } : {}),
    brand: { "@type": "Brand", name: siteConfig.name },
    ...(price != null && !Number.isNaN(price)
      ? {
          offers: {
            "@type": "Offer",
            price: String(price),
            priceCurrency: currency,
            url,
            availability: inStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            seller: { "@type": "Organization", name: siteConfig.name },
          },
        }
      : {}),
  };
}

/**
 * BreadcrumbList for any detail page with a clear hierarchy, e.g.
 *   Home > Tournaments > <event name>
 *
 * Pass the trail as ordered { name, path } items (path begins with "/"; the last
 * item is the current page). URLs are made absolute here. Used by the tournament,
 * team, player, organization, news, and shop detail pages.
 */
export function generateBreadcrumbSchema(
  items: { name: string; path: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteConfig.url}${item.path}`,
    })),
  };
}
