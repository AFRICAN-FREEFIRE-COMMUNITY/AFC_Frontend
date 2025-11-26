import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Teams",
  description:
    "Explore and join Free Fire esports teams in Africa. View team rosters, rankings, and tiers. Create your own team or apply to join existing teams on AFC.",
  keywords: [
    "Free Fire teams",
    "esports teams Africa",
    "join Free Fire team",
    "create team",
    "AFC teams",
    "Free Fire clan",
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
