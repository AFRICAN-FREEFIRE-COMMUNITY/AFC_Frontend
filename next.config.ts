import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  // Routing-level redirects (run before any page renders).
  async redirects() {
    return [
      // The Players admin page was merged into the combined Teams & Players page
      // at /a/teams (owner request 2026-06-09). This exact-path redirect keeps old
      // /a/players links/bookmarks working by sending them to that page's Players
      // tab. It matches ONLY /a/players, so the player detail route /a/players/[id]
      // is unaffected. Done at the config level (proper 307) instead of a redirect
      // page component, which avoids a dev-only React profiler warning.
      {
        source: "/a/players",
        destination: "/a/teams?tab=players",
        permanent: false,
      },
      // The Leaderboards admin page was merged into the combined Events & Leaderboards
      // page at /a/events (owner request 2026-06-09). Same exact-path redirect so old
      // /a/leaderboards links/bookmarks land on that page's Leaderboards tab. It matches
      // ONLY /a/leaderboards, so the leaderboard detail/create routes
      // (/a/leaderboards/[id], /a/leaderboards/[id]/edit, /a/leaderboards/create) are
      // unaffected.
      {
        source: "/a/leaderboards",
        destination: "/a/events?tab=leaderboards",
        permanent: false,
      },
      // ── SEO: retire dead legacy URLs Google still has indexed (audit 2026-06-14) ──
      // News used to be served by numeric DB id (/news/19); it now lives at a text
      // slug (/news/[slug]). Google still crawls ~12 old id URLs (/news/9,11,14-24)
      // and gets a 404. A permanent (301) redirect to the news index drops those
      // 404s and passes the link signal to a live page. The :id(\\d+) constraint
      // matches ONLY all-numeric paths, so real (textual) article slugs are never
      // caught by this rule.
      {
        source: "/news/:id(\\d+)",
        destination: "/news",
        permanent: true,
      },
      // The privacy page lives at /privacy-policy; Google still has the old /privacy
      // path indexed (404). 301 it to the real page so the URL consolidates instead
      // of 404-ing. (Only /privacy was flagged; /terms-of-service has no stale alias.)
      {
        source: "/privacy",
        destination: "/privacy-policy",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "hebbkx1anhila5yf.public.blob.vercel-storage.com",
        port: "",
      },
      {
        protocol: "https",
        hostname: "api.africanfreefirecommunity.com",
        port: "",
      },
      // Local dev: the backend serves /media (news/profile/banner images) from
      // localhost:8000. next/image rejects any host not listed here, which crashes
      // pages that render prod media locally. Prod still uses the https host above.
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8000",
      },
    ],
  },
};

export default nextConfig;
