"use client";

// Admin "History" page = the sitewide automatic audit log.
//
// Thin wrapper around the shared <AuditLogPanel/> (app/(a)/a/_components/AuditLogPanel.tsx), which
// is ALSO rendered as the "Admin Activities" tab on the admin Settings page so both surfaces stay
// identical. The panel fetches GET /auth/get-audit-log/ (afc_auth.views.get_audit_log), which is
// HEAD-ADMIN-ONLY, so this page mirrors that gate in the UI (head_admin / super_admin only).

import { PageHeader } from "@/components/PageHeader";
import { AuditLogPanel } from "@/app/(a)/a/_components/AuditLogPanel";
import { useAuth } from "@/contexts/AuthContext";

const Page = () => {
  const { user } = useAuth();
  const canSeeAudit = Boolean(
    user?.roles?.some((r) => {
      const n = String(r).toLowerCase().replace(/\s+/g, "_");
      return n === "head_admin" || n === "super_admin";
    }),
  );

  return (
    <div>
      <PageHeader title="History" back />
      {canSeeAudit ? (
        <AuditLogPanel />
      ) : (
        <p className="py-10 text-sm text-muted-foreground">
          The activity log is available to head admins only.
        </p>
      )}
    </div>
  );
};

export default Page;
