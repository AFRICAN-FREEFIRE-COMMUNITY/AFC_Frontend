// ─────────────────────────────────────────────────────────────────────────────
// (organizer) route-group root layout.
//
// Mirrors app/(sponsor)/layout.tsx exactly: a thin wrapper that drops the whole
// organizer portal behind <ProtectedRoute> (must be authenticated). The finer
// organizer-only gate (must be an organizer) lives one level down in
// app/(organizer)/organizer/layout.tsx, same split the sponsor portal uses.
// ─────────────────────────────────────────────────────────────────────────────

import { ReactNode } from "react";
import { ProtectedRoute } from "../(user)/_components/ProtectedRoute";
// The full translation catalog for this workspace (components/WorkspaceMessages.tsx): public pages
// only get the namespaces they can reach since 2026-10-16, these pages get all of them.
import { WorkspaceMessages } from "@/components/WorkspaceMessages";

export default function OrganizerRootLayout({
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
