// ─────────────────────────────────────────────────────────────────────────────
// StateBadge — the fulfilment-state pill, shared by the vendor orders QUEUE
// (orders/page.tsx) and the per-order page (orders/[id]/page.tsx) so a given state
// always reads the same colour + label across the portal.
//
// AFC constants: outline Badge, rounded-full, text-xs, coloured by state. The colour
// ramp tracks the lifecycle progressing toward "done":
//   received (gold, just in) → acknowledged (blue) → ship_scheduled (blue) →
//   shipped (green, in transit) → completed (green, done). cancelled = red.
//
// States come from lib/vendor.ts::FulfilmentState (mirrors the backend
// VALID_TRANSITIONS in afc_shop/fulfilment.py).
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { Badge } from "@/components/ui/badge";
import { FulfilmentState } from "@/lib/vendor";

// Per-state colour + a human label (no underscores, no em/en dashes).
const STATE_META: Record<
  string,
  { label: string; className: string }
> = {
  received: { label: "Received", className: "border-yellow-500 text-yellow-600" },
  acknowledged: {
    label: "Acknowledged",
    className: "border-blue-500 text-blue-600",
  },
  ship_scheduled: {
    label: "Ship scheduled",
    className: "border-blue-500 text-blue-600",
  },
  shipped: { label: "Shipped", className: "border-green-500 text-green-600" },
  completed: { label: "Completed", className: "border-green-500 text-green-600" },
  cancelled: { label: "Cancelled", className: "border-red-500 text-red-600" },
};

export function StateBadge({ state }: { state: FulfilmentState | null }) {
  // A null state should not occur for a vendor order in the queue (the lifecycle
  // starts at "received" on payment), but guard so the badge never crashes a row.
  const meta =
    (state && STATE_META[state]) || {
      label: state || "Unknown",
      className: "border-muted-foreground text-muted-foreground",
    };
  return (
    <Badge variant="outline" className={`rounded-full ${meta.className}`}>
      {meta.label}
    </Badge>
  );
}
