import { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/a/", // Admin pages
          "/api/", // API routes
          "/profile/edit", // Private user pages
          "/teams/create", // Authenticated pages
          "/email-confirmation", // Onboarding pages
          "/verify-token",
          "/reset-password",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/a/", "/api/"],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
