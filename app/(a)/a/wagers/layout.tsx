import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Manage Wagers",
  description:
    "Create, lock, void, and settle pari-mutuel wager markets across AFC events.",
  keywords: ["manage wagers", "admin wagers", "AFC betting"],
  url: "/a/wagers",
  noIndex: true,
});

export default function AdminWagersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
