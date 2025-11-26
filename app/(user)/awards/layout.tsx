import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "NFCA 2025 Awards",
  description:
    "Vote for your favorite Free Fire content creators and esports players in the Nigerian Freefire Community Awards (NFCA) 2025. Cast your vote and celebrate African gaming excellence.",
  keywords: [
    "NFCA 2025",
    "Free Fire awards",
    "African gaming awards",
    "Free Fire content creator awards",
    "esports awards Africa",
    "Nigerian Free Fire awards",
    "vote Free Fire",
  ],
  url: "/awards",
});

export default function AwardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
