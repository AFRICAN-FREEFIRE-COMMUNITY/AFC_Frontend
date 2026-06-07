import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

// Static link embed for the Leaderboards list page. The page is a client
// component, so its metadata lives in this server layout (same pattern as the
// other (user) list pages). generatePageMetadata emits a LARGE Twitter card.
export const metadata: Metadata = generatePageMetadata({
  title: "Leaderboards",
  description:
    "Live Free Fire leaderboards on the African Freefire Community. Track top teams and players by kills, wins, and points across tournaments and scrims in Africa.",
  keywords: [
    "Free Fire leaderboard",
    "Free Fire top players",
    "AFC leaderboard",
    "Free Fire kills leaderboard",
    "Free Fire stats Africa",
    "Nigeria Free Fire leaderboard",
  ],
  url: "/leaderboards",
});

export default function LeaderboardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
