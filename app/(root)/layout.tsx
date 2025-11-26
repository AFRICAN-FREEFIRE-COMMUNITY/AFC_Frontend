import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Welcome to African Freefire Community",
  description:
    "Join the ultimate Free Fire competitive platform in Africa. Compete in tournaments, climb rankings, join teams, and prove you're the best player in the AFC community.",
  keywords: [
    "Free Fire Africa",
    "African esports",
    "Free Fire tournaments",
    "competitive gaming Africa",
    "Free Fire community",
  ],
  url: "/",
});

export default function RootPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
