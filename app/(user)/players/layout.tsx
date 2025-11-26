import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Player Profile",
  description:
    "View Free Fire player profiles on the African Freefire Community. See player stats, team affiliations, roles, and achievements.",
  keywords: [
    "Free Fire player",
    "player profile",
    "AFC player",
    "esports player Africa",
    "Free Fire stats",
  ],
  url: "/players",
});

export default function PlayersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
