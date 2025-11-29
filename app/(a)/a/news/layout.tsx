import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Manage News",
  description: "Create, edit, and manage news articles and announcements for the African Freefire Community.",
  keywords: ["manage news", "admin news", "AFC content"],
  url: "/a/news",
  noIndex: true,
});

export default function AdminNewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
