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

export default function OrganizerRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
