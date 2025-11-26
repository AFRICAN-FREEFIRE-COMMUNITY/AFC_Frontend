import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "My Profile",
  description:
    "View and manage your AFC player profile. Track your stats, achievements, team history, and performance in Free Fire tournaments.",
  keywords: [
    "player profile",
    "Free Fire stats",
    "player statistics",
    "AFC profile",
  ],
  url: "/profile",
  noIndex: true,
});

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
