import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Admin Dashboard",
  description:
    "African Freefire Community admin dashboard. Manage teams, news, players, and community settings.",
  keywords: ["AFC admin", "dashboard", "management"],
  url: "/a",
  noIndex: true,
});

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
