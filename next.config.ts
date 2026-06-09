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
