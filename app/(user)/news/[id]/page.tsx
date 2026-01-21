// // // app/news/[id]/page.tsx
// // import { Metadata } from "next";
// // import axios from "axios";
// // import { env } from "@/lib/env";
// // import { NewsClient } from "./_components/NewsClient";
// // import { generateDynamicMetadata, generateArticleSchema } from "@/lib/seo"; // Your SEO helper

// // type Props = {
// //   params: Promise<{ id: string }>;
// // };

// // // --- SEO GENERATION ---
// // export async function generateMetadata({ params }: Props): Promise<Metadata> {
// //   const { id } = await params;
// //   const decodedId = decodeURIComponent(id);

// //   try {
// //     const res = await axios.post(
// //       `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-news-detail/`,
// //       {
// //         news_id: decodedId,
// //       }
// //     );
// //     const news = res.data.news;

// //     return generateDynamicMetadata({
// //       title: news.news_title,
// //       description: news.news_title, // Or a truncated version of content
// //       image: news.images_url,
// //       url: `/news/${id}`,
// //       type: "article",
// //       publishedTime: news.created_at,
// //       authors: [news.author || "AFC"],
// //     });
// //   } catch (error) {
// //     return { title: "News Not Found" };
// //   }
// // }

// // export default async function Page({ params }: Props) {
// //   const { id } = await params;
// //   const decodedId = decodeURIComponent(id);

// //   // Initial fetch for the schema and to pass to client if you want to avoid a second loader
// //   let initialData = null;
// //   try {
// //     const res = await axios.post(
// //       `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-news-detail/`,
// //       {
// //         news_id: decodedId,
// //       }
// //     );
// //     initialData = res.data.news;
// //   } catch (e) {
// //     console.error(e);
// //   }

// //   const articleSchema = initialData
// //     ? generateArticleSchema({
// //         title: initialData.news_title,
// //         description: initialData.news_title,
// //         image: initialData.images_url,
// //         url: `/news/${id}`,
// //         publishedTime: initialData.created_at,
// //         author: initialData.author || "AFC Admin",
// //       })
// //     : null;

// //   return (
// //     <>
// //       {articleSchema && (
// //         <script
// //           type="application/ld+json"
// //           dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
// //         />
// //       )}
// //       <NewsClient params={params} initialData={initialData} />
// //     </>
// //   );
// // }

// // app/news/[id]/page.tsx
// import { Metadata } from "next";
// import axios from "axios";
// import { env } from "@/lib/env";
// import { NewsClient } from "./_components/NewsClient";
// import { generateDynamicMetadata, generateArticleSchema } from "@/lib/seo";
// import { notFound } from "next/navigation";

// type Props = {
//   params: Promise<{ id: string }>;
// };

// /**
//  * Shared data fetcher to maintain consistency
//  * and handle URL decoding in one place.
//  */
// async function getNewsData(id: string) {
//   try {
//     const decodedId = decodeURIComponent(id);
//     const res = await axios.post(
//       `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-news-detail/`,
//       { news_id: decodedId }
//     );
//     return res.data.news;
//   } catch (error) {
//     console.error("Error fetching news for SEO/Render:", error);
//     return null;
//   }
// }

// // --- SEO GENERATION ---
// export async function generateMetadata({ params }: Props): Promise<Metadata> {
//   const { id } = await params;
//   const news = await getNewsData(id);

//   if (!news) {
//     return {
//       title: "News Not Found | AFC",
//       description: "The requested news article could not be found.",
//     };
//   }

//   // Ensure image URL is absolute for social crawlers
//   const imageUrl = news.images_url?.startsWith("http")
//     ? news.images_url
//     : `${env.NEXT_PUBLIC_URL}${news.images_url}`;

//   return generateDynamicMetadata({
//     title: news.news_title,
//     description: news.news_title, // Consider extracting a plain text snippet here
//     image: imageUrl,
//     url: `/news/${id}`,
//     type: "article",
//     publishedTime: news.created_at,
//     authors: [news.author || "AFC Admin"],
//   });
// }

// // --- PAGE RENDER ---
// export default async function Page({ params }: Props) {
//   const { id } = await params;
//   const news = await getNewsData(id);

//   // If the news doesn't exist, trigger the Next.js 404 page
//   if (!news) {
//     notFound();
//   }

//   // Generate the JSON-LD Article Schema for Google Search rich results
//   const articleSchema = generateArticleSchema({
//     title: news.news_title,
//     description: news.news_title,
//     image: news.images_url,
//     url: `/news/${id}`,
//     publishedTime: news.created_at,
//     author: news.author || "AFC Admin",
//   });

//   return (
//     <>
//       {articleSchema && (
//         <script
//           type="application/ld+json"
//           dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
//         />
//       )}
//       {/* Pass the already fetched data to the client to prevent a double loader */}
//       <NewsClient params={params} initialData={news} />
//     </>
//   );
// }

import { Metadata } from "next";
import { env } from "@/lib/env";
import { NewsClient } from "./_components/NewsClient";
import { generateDynamicMetadata, generateArticleSchema } from "@/lib/seo";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Shared data fetcher to maintain consistency
 * and handle URL decoding in one place.
 * Now supports optional authentication via cookies.
 */
async function getNewsData(id: string, token?: string) {
  try {
    const decodedId = decodeURIComponent(id);

    const response = await fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-news-detail/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ news_id: decodedId }),
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
  const { id } = await params;

  // Read token from cookies for authenticated requests
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  const news = await getNewsData(id, token);

  console.log(news);

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
    url: `/news/${id}`,
    type: "article",
    publishedTime: news.created_at,
    authors: [news.author || "AFC Admin"],
  });
}

// --- PAGE RENDER ---
export default async function Page({ params }: Props) {
  const { id } = await params;

  // Read token from cookies for authenticated requests
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  const news = await getNewsData(id, token);

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
    url: `/news/${id}`,
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
