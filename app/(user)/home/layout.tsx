import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Home",
  description:
    "Your hub for African Free Fire community stats, team rankings, quarterly tiers, latest news, and events. Stay updated with the AFC esports scene.",
  keywords: [
    "AFC dashboard",
    "Free Fire rankings",
    "team tiers",
    "esports stats",
    "Free Fire news",
  ],
  url: "/home",
});

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
