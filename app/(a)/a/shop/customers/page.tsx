"use client";

// Admin "Customer Delivery Info" page (route: /a/shop/customers).
//
// SUPER-ADMIN-ONLY surface listing the delivery details customers submitted with their
// shop orders (name, email, phone, address, location). The two backing endpoints
// (POST /shop/admin/delivery-info/ + /shop/admin/delivery-info/reveal/) are gated
// server-side by require_head_admin (head_admin / super_admin / superuser), so this
// page MIRRORS that gate in the UI exactly the way app/(a)/a/history/page.tsx does:
// it reads useAuth().user.roles, normalizes each role, and only renders the panel for
// head_admin / super_admin; everyone else (e.g. a shop_admin) sees a denial line.
//
// The shop landing app/(a)/a/shop/page.tsx surfaces this page from a "Customer Delivery
// Info" card that uses the SAME role check, so non-super-admins never see the entry.
//
// This route group app/(a)/ is i18n-EXEMPT, so all copy is plain English.

import { PageHeader } from "@/components/PageHeader";
import { CustomerDeliveryPanel } from "@/app/(a)/a/shop/_components/CustomerDeliveryPanel";
import { useAuth } from "@/contexts/AuthContext";

const Page = () => {
  const { user } = useAuth();

  // Super-admin gate: same role-normalization helper history/page.tsx uses
  // (lowercase + spaces -> underscores, then match head_admin / super_admin).
  const canSeeDeliveryInfo = Boolean(
    user?.roles?.some((r) => {
      const n = String(r).toLowerCase().replace(/\s+/g, "_");
      return n === "head_admin" || n === "super_admin";
    }),
  );

  return (
    <div>
      <PageHeader title="Customer Delivery Info" back />
      {canSeeDeliveryInfo ? (
        <CustomerDeliveryPanel />
      ) : (
        <p className="py-10 text-sm text-muted-foreground">
          This page is available to super admins only.
        </p>
      )}
    </div>
  );
};

export default Page;
