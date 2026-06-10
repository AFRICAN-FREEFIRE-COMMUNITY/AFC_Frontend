// ─────────────────────────────────────────────────────────────────────────────
// Vendor › Orders (the fulfilment QUEUE).
//
// The vendor's list of paid orders to fulfil. The data is NOT fetched here — the
// portal layout (app/(vendor)/vendor/layout.tsx) already loaded GET /shop/fulfilment/
// my-orders/ as the vendor gate and handed the results down through VendorContext;
// this page reads that list (useVendor().orders). Each row shows the buyer name, a
// one-line delivery summary, an items+qty summary, and a fulfilment_state badge, and
// links to the per-order page (orders/[id]) where the vendor drives the lifecycle.
//
// FILTERING (client-side, over the already-loaded list): a free-text search (matches
// the buyer name, the order id, or any item name) + a state dropdown (received /
// acknowledged / ship_scheduled / shipped / completed / all). No round-trip — the
// queue is small and lives entirely in context.
//
// Design mirrors the organizer events list (app/(organizer)/organizer/events/page.tsx):
// PageHeader, a single Card wrapping a Table, outline rounded-full state badges
// (text-xs) per AFC constants. Shapes come from lib/vendor.ts (VendorOrder).
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IconPackage, IconSearch } from "@tabler/icons-react";
import { formatDate } from "@/lib/utils";
import { matchesSearch } from "@/lib/search";
import { VendorOrder } from "@/lib/vendor";
import { useVendor } from "../_components/VendorContext";
import { StateBadge } from "../_components/StateBadge";

// The state options the filter dropdown offers. "all" is the default (no filter).
const STATE_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All states" },
  { value: "received", label: "Received" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "ship_scheduled", label: "Ship scheduled" },
  { value: "shipped", label: "Shipped" },
  { value: "completed", label: "Completed" },
];

// One-line delivery summary: "City, State" (postcode appended when present). Used in
// the queue row; the full address shows on the per-order page.
function deliverySummary(order: VendorOrder): string {
  const parts = [order.delivery.city, order.delivery.state].filter(Boolean);
  const base = parts.join(", ");
  return order.delivery.postcode ? `${base} ${order.delivery.postcode}` : base;
}

// Items summary: "2x Product A, 1x Product B" (variant appended when present).
function itemsSummary(order: VendorOrder): string {
  return order.items
    .map((it) => {
      const name = it.variant ? `${it.name} (${it.variant})` : it.name;
      return `${it.quantity}x ${name}`;
    })
    .join(", ");
}

export default function VendorOrdersPage() {
  // The queue comes from the layout via context (single source of truth).
  const { orders } = useVendor();

  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");

  // ── Client-side filter over the loaded queue ──
  const filtered = useMemo(() => {
    return orders.filter((order) => {
      // State filter.
      if (stateFilter !== "all" && order.fulfilment_state !== stateFilter)
        return false;
      // Text search across buyer name, order id, and item names. Uses the shared
      // matchesSearch() so the box is punctuation/space/accent/fancy-font insensitive
      // (e.g. typing "ve" finds "V-E"), consistent with every other AFC search box.
      return matchesSearch(
        [
          order.buyer_name,
          String(order.order_id),
          ...order.items.map((it) => it.name),
        ],
        search,
      );
    });
  }, [orders, search, stateFilter]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Orders"
        description="Paid orders for you to fulfil. Open one to move it through the lifecycle."
      />

      {/* Filters: search + state. */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by buyer, order number, or item"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Filter by state" />
          </SelectTrigger>
          <SelectContent>
            {STATE_FILTERS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Your Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            // ── Empty state ── no orders to fulfil yet. ──
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                <IconPackage className="size-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                You have no orders to fulfil yet. New paid orders will appear here.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            // ── No rows match the current search/filter. ──
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No orders match your search.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Deliver to</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((order) => (
                  <TableRow key={order.order_id}>
                    <TableCell className="font-medium">
                      #{order.order_id}
                      <div className="text-xs text-muted-foreground">
                        {order.created_at
                          ? formatDate(order.created_at)
                          : ""}
                      </div>
                    </TableCell>
                    <TableCell>{order.buyer_name || "-"}</TableCell>
                    <TableCell className="max-w-[14rem]">
                      <span className="line-clamp-2 text-muted-foreground">
                        {deliverySummary(order) || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[18rem]">
                      <span className="line-clamp-2">{itemsSummary(order)}</span>
                    </TableCell>
                    <TableCell>
                      <StateBadge state={order.fulfilment_state} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/vendor/orders/${order.order_id}`}>
                          Open
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
