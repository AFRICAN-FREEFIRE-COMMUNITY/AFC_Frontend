// ─────────────────────────────────────────────────────────────────────────────
// ApprovalBadge — the product approval-status pill for the vendor PRODUCTS section
// (products/page.tsx). Sibling to StateBadge (the fulfilment-state pill) so the two
// vendor surfaces read as one designer's work: same outline Badge, rounded-full,
// text-xs, coloured by state.
//
// The colour ramp tracks a product's path to going live:
//   draft (muted, not yet sent) → submitted (gold, awaiting AFC review) →
//   approved (green, can sell) ; rejected = red (needs a fix + re-submit).
//
// States come from lib/vendor.ts::ApprovalStatus (mirrors the backend
// Product.approval_status set in afc_shop/vendors.py cluster C).
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { Badge } from "@/components/ui/badge";
import { ApprovalStatus } from "@/lib/vendor";

// Per-status colour + a human label (no underscores, no em/en dashes).
const APPROVAL_META: Record<string, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "border-muted-foreground text-muted-foreground",
  },
  submitted: {
    label: "Submitted",
    className: "border-yellow-500 text-yellow-600",
  },
  approved: {
    label: "Approved",
    className: "border-green-500 text-green-600",
  },
  rejected: {
    label: "Rejected",
    className: "border-red-500 text-red-600",
  },
};

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const meta = APPROVAL_META[status] || {
    label: status || "Unknown",
    className: "border-muted-foreground text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={`rounded-full ${meta.className}`}>
      {meta.label}
    </Badge>
  );
}
