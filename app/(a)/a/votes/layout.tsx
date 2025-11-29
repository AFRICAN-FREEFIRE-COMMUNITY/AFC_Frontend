import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Manage Awards & Voting",
  description: "Manage NFCA awards categories, nominees, and voting for the African Freefire Community.",
  keywords: ["manage awards", "NFCA voting", "admin awards"],
  url: "/a/votes",
  noIndex: true,
});

export default function AdminVotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
