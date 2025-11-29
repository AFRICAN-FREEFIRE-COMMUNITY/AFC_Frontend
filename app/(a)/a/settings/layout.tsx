import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Admin Settings",
  description: "Configure platform settings and preferences for the African Freefire Community.",
  keywords: ["admin settings", "AFC configuration"],
  url: "/a/settings",
  noIndex: true,
});

export default function AdminSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
