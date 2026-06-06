import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
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
