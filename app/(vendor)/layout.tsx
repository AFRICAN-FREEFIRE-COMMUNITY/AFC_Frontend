// ─────────────────────────────────────────────────────────────────────────────
// (vendor) route-group root layout.
//
// Mirrors app/(organizer)/layout.tsx exactly: a thin wrapper that drops the whole
// vendor portal behind <ProtectedRoute> (the caller must be AUTHENTICATED to reach
// any /vendor route). The finer VENDOR-only gate (the caller must actually have a
// Vendor account) lives one level down in app/(vendor)/vendor/layout.tsx - that gate
// is data-driven (it calls GET /shop/fulfilment/my-orders/ and branches on
// 200-vendor vs 403-not-a-vendor), since there is no "vendor" role on the User model
// to check against. Same auth split the organizer portal uses (route-group layout
// = "must be logged in", inner layout = "must be the right kind of user").
// ─────────────────────────────────────────────────────────────────────────────

import { ReactNode } from "react";
import { ProtectedRoute } from "../(user)/_components/ProtectedRoute";
// The full translation catalog for this workspace (components/WorkspaceMessages.tsx): public pages
// only get the namespaces they can reach since 2026-10-16, these pages get all of them.
import { WorkspaceMessages } from "@/components/WorkspaceMessages";

export default function VendorRootLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceMessages>
      <ProtectedRoute>{children}</ProtectedRoute>
    </WorkspaceMessages>
  );
}
