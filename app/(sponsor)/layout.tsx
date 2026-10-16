import { ReactNode } from "react";
import { ProtectedRoute } from "../(user)/_components/ProtectedRoute";
// The full translation catalog for this workspace (components/WorkspaceMessages.tsx): public pages
// only get the namespaces they can reach since 2026-10-16, these pages get all of them.
import { WorkspaceMessages } from "@/components/WorkspaceMessages";

export default function SponsorRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <WorkspaceMessages>
      <ProtectedRoute>{children}</ProtectedRoute>
    </WorkspaceMessages>
  );
}
