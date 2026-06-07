// app/robots.ts
//
// Generates /robots.txt for AFC via the Next.js MetadataRoute.Robots API.
//
// GOALS:
//   1. Let normal search crawlers (Googlebot, Bingbot, etc. — covered by the "*"
//      rule) index every PUBLIC page, while keeping private/admin/auth surfaces
//      out of the index.
//   2. EXPLICITLY welcome the major AI crawlers (GPTBot, ClaudeBot, PerplexityBot,
//      Google-Extended, …) so AFC is discoverable and CITABLE inside ChatGPT,
//      Claude, Gemini, Perplexity, etc. Several of these default to "do not crawl"
//      unless a site opts them in, so we give each its own allow rule. They get
//      the SAME private disallows as everyone else (we welcome citation of public
//      pages, not scraping of the admin panel).
//
// CONNECTS TO:
//   - lib/seo.ts → siteConfig.url is the canonical origin used for host + sitemap.
//   - app/sitemap.ts is referenced here so crawlers discover every public URL.
//   - The disallow list mirrors the private route groups in app/: (a)/a (admin),
//     (organizer), (sponsor), (auth), (onboarding), /unauthorized, and any
//     */edit sub-route.
import { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo";

// Private / non-indexable surfaces. Kept in one place so the "*" rule and every
// AI-crawler rule stay in lockstep (defined once, reused for all user-agents).
//   - /a/                → admin dashboard (route group (a))
//   - /organizer/        → organizer dashboard (route group (organizer))
//   - /sponsor/          → sponsor dashboard (route group (sponsor))
//   - auth flows         → login / create-account / password reset / verify
//   - /onboarding, /email-confirmation → onboarding flow
//   - /unauthorized      → access-denied page
//   - /*/edit            → any entity edit screen (teams/news/events/etc.)
//   - /api/              → Next route handlers (og-image proxy, etc.) — not pages
//   - /profile, /orders, /cart → authenticated, user-private surfaces
const DISALLOW: string[] = [
  "/a/",
  "/organizer/",
  "/sponsor/",
  "/login",
  "/create-account",
  "/reset-password",
  "/forgot-password",
  "/verify-token",
  "/onboarding",
  "/email-confirmation",
  "/unauthorized",
  "/*/edit", // wildcard: any nested .../edit route
  "/api/",
  "/profile",
  "/orders",
  "/shop/cart",
];

// The AI crawler user-agents we explicitly opt in for citation/discovery.
// Each gets `allow: "/"` plus the shared private disallows.
//   - OpenAI:     GPTBot (training), OAI-SearchBot (ChatGPT search), ChatGPT-User (browse)
//   - Anthropic:  ClaudeBot, Claude-Web, anthropic-ai
//   - Google:     Google-Extended (Gemini/Vertex grounding)
//   - Perplexity: PerplexityBot
//   - Common Crawl: CCBot (feeds many downstream LLM datasets)
//   - Apple:      Applebot-Extended (Apple Intelligence)
//   - ByteDance:  Bytespider
//   - Amazon:     Amazonbot
//   - Cohere:     cohere-ai
const AI_CRAWLERS: string[] = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "Google-Extended",
  "PerplexityBot",
  "CCBot",
  "Applebot-Extended",
  "Bytespider",
  "Amazonbot",
  "cohere-ai",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Baseline rule for every crawler not named below (Googlebot, Bingbot, …).
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW,
      },
      // One explicit allow rule per AI crawler so they may crawl + cite the
      // public site. Same private disallows as everyone else.
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: DISALLOW,
      })),
    ],
    // Canonical sitemap + host (absolute, from the single source of truth).
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
