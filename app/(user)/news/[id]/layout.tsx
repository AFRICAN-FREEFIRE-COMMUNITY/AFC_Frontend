import { Metadata } from "next";
import { generateDynamicMetadata, generateArticleSchema } from "@/lib/seo";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

async function getNewsData(newsId: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-news-detail/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ news_id: decodeURIComponent(newsId) }),
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.news;
  } catch (error) {
    return null;
  }
}

function extractPlainText(content: any): string {
  if (!content) return "";

  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content);
      return extractPlainText(parsed);
    } catch {
      return content.replace(/<[^>]*>/g, "").slice(0, 160);
    }
  }

  if (content.content && Array.isArray(content.content)) {
    return content.content
      .map((node: any) => {
        if (node.type === "text") return node.text || "";
        if (node.content) return extractPlainText(node);
        return "";
      })
      .join(" ")
      .slice(0, 160);
  }

  return "";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const news = await getNewsData(id);

  if (!news) {
    return generateDynamicMetadata({
      title: "News Article",
      description:
        "Read the latest news and updates from the African Freefire Community.",
      url: `/news/${id}`,
      type: "article",
    });
  }

  const contentPreview = extractPlainText(news.content);
  const description =
    contentPreview ||
    `${news.news_title} - Read the latest ${
      news.category || "news"
    } from the African Freefire Community.`;

  const categoryTags: Record<string, string[]> = {
    tournament: ["tournament", "esports", "competition"],
    general: ["news", "updates", "community"],
    bans: ["bans", "rules", "enforcement"],
  };

  const tags = [
    news.news_title,
    news.category,
    "AFC news",
    "Free Fire",
    ...(categoryTags[news.category] || []),
  ].filter(Boolean) as string[];

  return {
    ...generateDynamicMetadata({
      title: news.news_title,
      description: description.slice(0, 160),
      image: news.images_url || undefined,
      url: `/news/${id}`,
      type: "article",
      publishedTime: news.created_at,
      modifiedTime: news.updated_at || news.created_at,
      authors: news.author ? [news.author] : undefined,
      tags,
    }),
    other: {
      "script:ld+json": JSON.stringify(
        generateArticleSchema({
          title: news.news_title,
          description: description.slice(0, 160),
          image: news.images_url,
          url: `/news/${id}`,
          publishedTime: news.created_at,
          modifiedTime: news.updated_at,
          author: news.author || "AFC Team",
        })
      ),
    },
  };
}

export default function NewsDetailLayout({ children }: Props) {
  return <>{children}</>;
}
