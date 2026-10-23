import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";
// The full translation catalog for this workspace (components/WorkspaceMessages.tsx): public pages
// only get the namespaces they can reach since 2026-10-16, these pages get all of them.
import { WorkspaceMessages } from "@/components/WorkspaceMessages";

export const metadata: Metadata = generatePageMetadata({
  title: "Admin Dashboard",
  description:
    "African Free Fire Community admin dashboard. Manage teams, news, players, and community settings.",
  keywords: ["AFC admin", "dashboard", "management"],
  url: "/a",
  noIndex: true,
});

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceMessages>{children}</WorkspaceMessages>;
}
