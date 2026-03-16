import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Tournaments & Scrims",
  description:
    "Browse all Free Fire tournaments and scrims on the African Freefire Community platform. Register for upcoming events, view results, and compete for prizes across Africa.",
  keywords: [
    "Free Fire tournament",
    "Free Fire scrim",
    "Free Fire tournament Nigeria",
    "AFC tournament",
    "Free Fire clash cup",
    "Free Fire competition Africa",
    "Free Fire esports tournament",
    "Nigeria Free Fire tournament",
    "African Free Fire tournament",
  ],
  url: "/tournaments",
});

export default function TournamentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
