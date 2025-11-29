import { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo";

async function getTeams() {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-all-teams/`,
      { next: { revalidate: 3600 } }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.teams || [];
  } catch {
    return [];
  }
}

async function getNews() {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-all-news/`,
      { next: { revalidate: 3600 } }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.news || [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.url;

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/teams`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/news`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/awards`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/create-account`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];

  // Fetch dynamic pages
  const [teams, news] = await Promise.all([getTeams(), getNews()]);

  // Team pages
  const teamPages: MetadataRoute.Sitemap = teams.map((team: any) => ({
    url: `${baseUrl}/teams/${encodeURIComponent(team.team_name)}`,
    lastModified: team.updated_at ? new Date(team.updated_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // News article pages
  const newsPages: MetadataRoute.Sitemap = news.map((article: any) => ({
    url: `${baseUrl}/news/${article.news_id}`,
    lastModified: article.updated_at
      ? new Date(article.updated_at)
      : new Date(article.created_at),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...teamPages, ...newsPages];
}
