import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Manage Teams",
  description: "View and manage Free Fire esports teams on the African Freefire Community platform.",
  keywords: ["manage teams", "admin teams", "AFC teams"],
  url: "/a/teams",
  noIndex: true,
});

export default function AdminTeamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
