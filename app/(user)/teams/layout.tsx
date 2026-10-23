import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  // Teams & Players (inbox #161): the page now lists players too (the Players tab).
  title: "Teams & Players",
  description:
    "Explore Free Fire esports teams and players in Africa. View team rosters, tiers and player profiles. Create your own team or apply to join one on AFC.",
  keywords: [
    "Free Fire teams",
    "esports teams Africa",
    "join Free Fire team",
    "create team",
    "AFC teams",
    "Free Fire clan",
    "Free Fire players Africa",
  ],
  url: "/teams",
});

export default function TeamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
