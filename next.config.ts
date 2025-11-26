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
    ],
  },
};

export default nextConfig;
