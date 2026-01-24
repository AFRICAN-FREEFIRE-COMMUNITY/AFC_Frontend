import { Metadata } from "next";
import { env } from "@/lib/env";
import { NewsClient } from "./_components/NewsClient";
import { generateDynamicMetadata, generateArticleSchema } from "@/lib/seo";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

type Props = {
  params: Promise<{ slug: string }>;
};

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
    return {
      title: "News Not Found | AFC",
      description: "The requested news article could not be found.",
    };
  }

  // Ensure image URL is absolute for social crawlers
  const imageUrl = news.images_url?.startsWith("http")
    ? news.images_url
    : `${env.NEXT_PUBLIC_URL || ""}${news.images_url || "/default-news-image.jpg"}`;

  // Extract plain text description (first 160 chars of content or use title)
  const description = news.content
    ? news.content.replace(/<[^>]*>/g, "").substring(0, 160) + "..."
    : news.news_title;

  return generateDynamicMetadata({
    title: news.news_title,
    description: news.news_title,
    image: imageUrl,
    url: `/news/${slug}`,
    type: "article",
    publishedTime: news.created_at,
    authors: [news.author || "AFC Admin"],
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

  // Generate the JSON-LD Article Schema for Google Search rich results
  const articleSchema = generateArticleSchema({
    title: news.news_title,
    description: news.content
      ? news.content.replace(/<[^>]*>/g, "").substring(0, 160)
      : news.news_title,
    image: imageUrl,
    url: `/news/${slug}`,
    publishedTime: news.created_at,
    author: news.author || "AFC Admin",
  });

  return (
    <>
      {articleSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
        />
      )}
      {/* Pass the already fetched data to the client to prevent a double loader */}
      <NewsClient params={params} initialData={news} />
    </>
  );
}
