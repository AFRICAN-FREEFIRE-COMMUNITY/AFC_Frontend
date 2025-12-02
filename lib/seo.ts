import { Metadata } from "next";

// Site configuration
export const siteConfig = {
  name: "African Freefire Community",
  shortName: "AFC",
  description:
    "The official platform for African Free Fire esports. Join teams, compete in tournaments, track player stats, and stay updated with the latest Free Fire news across Africa.",
  url: "https://africanfreefirecommunity.com",
  ogImage: "https://africanfreefirecommunity.com/logo.png",
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
    "Free Fire esports",
    "Free Fire tournament",
    "Free Fire teams",
    "Free Fire players",
    "African Free Fire Community",
    "AFC",
    "Free Fire news",
    "Free Fire stats",
    "Garena Free Fire",
    "Free Fire competitive",
    "African gaming",
    "esports Africa",
    "Free Fire guild",
    "Free Fire clan",
    "Free Fire rankings",
    "Tomiwa Adelae",
    "Adelae",
    "Tomiwa",
  ],
};

// Default metadata for the entire site
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
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} - Free Fire Esports Platform`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: "@afcdatabase",
    site: "@afcdatabase",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  alternates: {
    canonical: siteConfig.url,
  },
  verification: {
    // Add your verification codes here when you have them
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
  },
  category: "esports",
};

// Helper function to generate page metadata
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
  const allKeywords = [...siteConfig.keywords, ...keywords];

  return {
    title,
    description,
    keywords: allKeywords,
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
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
      type: "website",
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

// Helper for dynamic pages (teams, players, news)
export function generateDynamicMetadata({
  title,
  description,
  image,
  url,
  type = "website",
  publishedTime,
  modifiedTime,
  authors,
  tags,
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

  const metadata: Metadata = {
    title,
    description,
    keywords: tags ? [...siteConfig.keywords, ...tags] : siteConfig.keywords,
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

  return metadata;
}

// JSON-LD structured data helpers
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
    sameAs: [
      siteConfig.links.twitter,
      siteConfig.links.instagram,
      siteConfig.links.facebook,
      siteConfig.links.youtube,
      siteConfig.links.tiktok,
    ],
    foundingDate: "2024",
    areaServed: "Africa",
    slogan: "Uniting African Free Fire Players",
  };
}

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

export function generateArticleSchema({
  title,
  description,
  image,
  url,
  publishedTime,
  modifiedTime,
  author,
}: {
  title: string;
  description: string;
  image?: string;
  url: string;
  publishedTime: string;
  modifiedTime?: string;
  author: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    description,
    image: image || siteConfig.ogImage,
    url: `${siteConfig.url}${url}`,
    datePublished: publishedTime,
    dateModified: modifiedTime || publishedTime,
    author: {
      "@type": "Person",
      name: author,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: {
        "@type": "ImageObject",
        url: `${siteConfig.url}/logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteConfig.url}${url}`,
    },
  };
}

export function generateTeamSchema({
  name,
  description,
  image,
  url,
  memberCount,
  country,
}: {
  name: string;
  description?: string;
  image?: string;
  url: string;
  memberCount?: number;
  country?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name,
    description: description || `${name} - Free Fire esports team on AFC`,
    image: image || siteConfig.ogImage,
    url: `${siteConfig.url}${url}`,
    sport: "Esports",
    memberOf: {
      "@type": "SportsOrganization",
      name: siteConfig.name,
    },
    ...(memberCount && { numberOfEmployees: memberCount }),
    ...(country && {
      location: {
        "@type": "Place",
        name: country,
      },
    }),
  };
}

export function generatePlayerSchema({
  name,
  description,
  image,
  url,
  team,
  country,
}: {
  name: string;
  description?: string;
  image?: string;
  url: string;
  team?: string;
  country?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    description: description || `${name} - Free Fire player on AFC`,
    image: image || siteConfig.ogImage,
    url: `${siteConfig.url}${url}`,
    jobTitle: "Professional Gamer",
    ...(team && {
      memberOf: {
        "@type": "SportsTeam",
        name: team,
      },
    }),
    ...(country && {
      nationality: {
        "@type": "Country",
        name: country,
      },
    }),
  };
}
