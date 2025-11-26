import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "News & Updates",
  description:
    "Stay updated with the latest Free Fire esports news, tournament announcements, community updates, and player highlights from the African Free Fire Community.",
  keywords: [
    "Free Fire news",
    "esports news Africa",
    "tournament announcements",
    "AFC updates",
    "Free Fire community news",
  ],
  url: "/news",
});

export default function NewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
