import { Metadata } from "next";
import { env } from "@/lib/env";
import { NewsClient } from "./_components/NewsClient";
// buildEntityMetadata: shared LARGE-card link-embed builder (lib/seo.ts).
// generateArticleSchema: JSON-LD NewsArticle for Google rich results.
// generateBreadcrumbSchema: Home > News > <headline> trail.
// jsonLd: render a schema object as a <script ld+json>.
import {
  buildEntityMetadata,
  generateArticleSchema,
  generateBreadcrumbSchema,
  jsonLd,
} from "@/lib/seo";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

type Props = {
  params: Promise<{ slug: string }>;
};

/**
 * Extract a clean, plain-text excerpt from a news body for the link-embed
 * description. The body (`news.content`) can be EITHER a Tiptap rich-text JSON
 * document (the admin editor's format: {type:"doc", content:[...]}) OR an HTML/
 * plain string. The previous code only stripped HTML tags, which left raw Tiptap
 * JSON in the og:description. This walks the Tiptap tree to pull out text nodes,
 * and falls back to tag-stripping for HTML/plain strings. Capped to `max` chars.
 */
function extractNewsExcerpt(content: unknown, max = 160): string {
  if (!content) return "";

  // Recursively collect text from a Tiptap node tree.
  const walk = (node: any): string => {
    if (!node) return "";
    if (node.type === "text" && typeof node.text === "string") return node.text;
    if (Array.isArray(node.content))
      return node.content.map(walk).join(" ");
    return "";
  };

  let text = "";
  if (typeof content === "string") {
    const trimmed = content.trim();
    // A stringified Tiptap doc → parse then walk; otherwise strip HTML tags.
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        text = walk(JSON.parse(trimmed));
      } catch {
        text = trimmed.replace(/<[^>]*>/g, " ");
      }
    } else {
      text = trimmed.replace(/<[^>]*>/g, " ");
    }
  } else {
    // Already a parsed Tiptap object.
    text = walk(content);
  }

  text = text.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

/**
 * Shared data fetcher to maintain consistency
 * and handle URL decoding in one place.
 * Now supports optional authentication via cookies.
 */
async function getNewsData(slug: string, token?: string) {
  try {
    const response = await fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-news-detail/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ slug }),
        // Choose caching strategy based on your needs:
        // - 'no-store': Always fetch fresh data (good for frequently updated content)
        // - 'force-cache': Use cached data when available (good for static content)
        // - { next: { revalidate: 60 } }: Revalidate every 60 seconds (ISR)
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error(
        "Failed to fetch news:",
        response.status,
        response.statusText,
      );
      return null;
    }

    const data = await response.json();
    return data.news;
  } catch (error) {
    console.error("Error fetching news for SEO/Render:", error);
    return null;
  }
}

// --- SEO GENERATION ---
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  // Read token from cookies for authenticated requests
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  const news = await getNewsData(slug, token);

  if (!news) {
    // Missing article → branded fallback embed (still large card, no broken image).
    return buildEntityMetadata({
      title: "News",
      description:
        "Read the latest Free Fire news and updates from the African Freefire Community.",
      path: `/news/${slug}`,
      type: "article",
    });
  }

  // Real article excerpt (handles Tiptap JSON or HTML, capped at 160 chars). Fall
  // back to the headline only when there is no body content. The previous version
  // both passed the title as the description AND left raw Tiptap JSON un-stripped.
  const excerpt = extractNewsExcerpt(news.content, 160);
  const description = excerpt || news.news_title;

  return buildEntityMetadata({
    title: news.news_title,
    description,
    path: `/news/${slug}`,
    // Article banner — resolveOgImage proxies backend /media/ images through our
    // own /api/og-image so crawlers can fetch them; null falls back to site default.
    image: news.images_url || null,
    type: "article",
    publishedTime: news.created_at,
    authors: [news.author || "AFC Admin"],
    tags: [news.news_title, news.category, "AFC news", "Free Fire"].filter(
      Boolean,
    ),
  });
}

// --- PAGE RENDER ---
export default async function Page({ params }: Props) {
  const { slug } = await params;

  // Read token from cookies for authenticated requests
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  const news = await getNewsData(slug, token);

  // If the news doesn't exist, trigger the Next.js 404 page
  if (!news) {
    notFound();
  }

  // Ensure image URL is absolute for schema
  const imageUrl = news.images_url?.startsWith("http")
    ? news.images_url
    : `${env.NEXT_PUBLIC_URL || ""}${news.images_url || "/default-news-image.jpg"}`;

  // Generate the JSON-LD Article Schema for Google Search rich results.
  // Uses the same Tiptap-aware excerpt helper so the schema description is clean
  // plain text (not raw editor JSON).
  const articleSchema = generateArticleSchema({
    title: news.news_title,
    description: extractNewsExcerpt(news.content, 160) || news.news_title,
    image: imageUrl,
    url: `/news/${slug}`,
    publishedTime: news.created_at,
    author: news.author || "AFC Admin",
  });

  // Breadcrumb trail (Home > News > <headline>) for rich-result navigation.
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "News", path: "/news" },
    { name: news.news_title, path: `/news/${slug}` },
  ]);

  return (
    <>
      {articleSchema && <script {...jsonLd(articleSchema)} />}
      {breadcrumbSchema && <script {...jsonLd(breadcrumbSchema)} />}
      {/* Pass the already fetched data to the client to prevent a double loader */}
      <NewsClient params={params} initialData={news} />
    </>
  );
}
