import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

// Static link embed for the Player Market list page. The page is a client
// component, so its metadata lives in this server layout (same pattern as the
// other (user) list pages). generatePageMetadata emits a LARGE Twitter card.
// NOTE: a child route, player-markets/[id]/page.tsx, owns its own per-listing
// generateMetadata, which overrides this default on that deeper segment.
export const metadata: Metadata = generatePageMetadata({
  title: "Player Market",
  description:
    "The African Freefire Community Player Market. Find Free Fire players looking for teams and teams recruiting players across Africa, with roles and availability.",
  keywords: [
    "Free Fire player market",
    "Free Fire recruitment",
    "Free Fire looking for team",
    "AFC player market",
    "Free Fire transfers Africa",
    "Free Fire team recruitment",
  ],
  url: "/player-markets",
});

export default function PlayerMarketsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
