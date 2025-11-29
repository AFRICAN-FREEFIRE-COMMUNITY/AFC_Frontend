import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Admin Dashboard",
  description: "AFC admin dashboard - Overview of platform statistics and activity.",
  keywords: ["admin dashboard", "AFC management"],
  url: "/a/dashboard",
  noIndex: true,
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
