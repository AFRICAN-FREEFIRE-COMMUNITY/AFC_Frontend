// ─────────────────────────────────────────────────────────────────────────────
// VendorContext — shares the caller-vendor's fulfilment QUEUE across the vendor
// portal pages (the orders list + every per-order page).
//
// WHY a context (mirrors app/(organizer)/.../OrganizerContext.tsx): the portal
// layout (app/(vendor)/vendor/layout.tsx) ALREADY calls GET /shop/fulfilment/my-orders/
// once — that call is the VENDOR GATE (200 ⇒ vendor, render the portal; 403 ⇒
// "no vendor access" card). Rather than have each page re-fetch the same list, the
// layout hands the loaded orders down through this context, plus a `refetch()` the
// pages call after any lifecycle action (acknowledge / set-ship-date / mark-shipped /
// mark-completed) to pull fresh state.
//
// IMPORTANT — there is NO per-order GET endpoint on the backend (afc_shop/urls.py
// only exposes the queue + the four transitions). So the per-order page
// (orders/[id]) does NOT fetch its own detail: it reads the matching order out of
// THIS shared list by id. `refetch()` is how it stays current after an action.
//
// Shapes come from lib/vendor.ts (VendorOrder / VendorOrdersResponse), which mirror
// the PII-firewalled vendor_my_orders payload in afc_shop/fulfilment.py.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { createContext, useContext, ReactNode } from "react";
import { VendorOrder } from "@/lib/vendor";

interface VendorContextValue {
  // The caller-vendor's orders (the whole fulfilment queue), loaded by the layout.
  orders: VendorOrder[];
  // Re-pull GET /shop/fulfilment/my-orders/. Pages call this after a transition so
  // the list (and any per-order view derived from it) reflects the new state.
  refetch: () => Promise<void>;
}

const VendorContext = createContext<VendorContextValue | undefined>(undefined);

export function VendorProvider({
  value,
  children,
}: {
  value: VendorContextValue;
  children: ReactNode;
}) {
  return (
    <VendorContext.Provider value={value}>{children}</VendorContext.Provider>
  );
}

// Hook the portal pages call to read the queue + trigger a refetch.
export function useVendor() {
  const ctx = useContext(VendorContext);
  if (!ctx)
    throw new Error("useVendor must be used within a VendorProvider");
  return ctx;
}
