import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

// Static link embed for the Rankings list page. The page itself is a client
// component ("use client"), so its metadata lives here in this server layout —
// same pattern as the other (user) list pages (tournaments/teams/players).
// generatePageMetadata already emits a LARGE Twitter card so the share renders
// as a big embed; the image is the site-default branded card.
export const metadata: Metadata = generatePageMetadata({
  title: "Team & Player Rankings",
  description:
    "Official African Freefire Community rankings and tiers. See where Free Fire teams and players stand across Africa each season, with tier placements and points.",
  keywords: [
    "Free Fire rankings",
    "Free Fire tiers",
    "AFC rankings",
    "Free Fire team rankings Africa",
    "Free Fire player rankings",
    "Nigeria Free Fire rankings",
  ],
  url: "/rankings",
});

export default function RankingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
