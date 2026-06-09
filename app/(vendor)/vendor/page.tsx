// ─────────────────────────────────────────────────────────────────────────────
// Vendor portal index (bare /vendor).
//
// /vendor itself has no content of its own — the portal's landing surface is the
// fulfilment queue at /vendor/orders. So this index immediately redirects there,
// which keeps a single canonical place for the queue while letting users (and any
// future "Vendor Dashboard" nav entry) link to the short /vendor URL.
//
// The redirect runs INSIDE the (vendor)/vendor layout, so the vendor gate (the
// my-orders 200-vs-403 check in app/(vendor)/vendor/layout.tsx) still applies before
// anything renders — a non-vendor who hits /vendor sees the "no vendor access" card,
// not the orders page.
// ─────────────────────────────────────────────────────────────────────────────

import { redirect } from "next/navigation";

export default function VendorIndexPage() {
  redirect("/vendor/orders");
}
