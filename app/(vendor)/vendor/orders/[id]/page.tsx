// ─────────────────────────────────────────────────────────────────────────────
// Vendor › Orders › [id] (the per-order FULFILMENT page).
//
// The page where a vendor drives ONE order through the lifecycle:
//   received → acknowledged → ship_scheduled → shipped → completed
// (the backend state machine, afc_shop/fulfilment.py). It shows the full order +
// delivery details, a STEPPER of the five stages, and — at the CURRENT stage — the
// single action that advances it:
//   • received       → "Acknowledge order"            → POST acknowledge
//   • acknowledged   → date picker + "Set ship date"  → POST set-ship-date
//   • ship_scheduled → photo/video upload + "Mark shipped" → POST mark-shipped (multipart)
//   • shipped        → "Mark completed"               → POST mark-completed
//   • completed      → a done state (no action)
//
// DATA SOURCE — there is NO per-order GET endpoint on the backend (afc_shop/urls.py
// only exposes the queue + the four transitions). So this page does NOT fetch its own
// order: it reads the matching order out of the SHARED queue the portal layout loaded
// (useVendor().orders, found by id). After every successful action it calls
// useVendor().refetch() to re-pull the queue, so the stepper + state badge advance.
// If the id isn't in the caller's queue (not their order, or a bad url), we show a
// "not found" notice — a vendor only ever sees their own orders.
//
// EVIDENCE — the mark-shipped response returns only an `evidence_saved` COUNT (the
// backend stores FulfillmentEvidence rows but exposes no read endpoint for them yet),
// so after a successful ship we surface "N evidence file(s) uploaded" as confirmation
// rather than rendering the media. Noted for the follow-up that adds an evidence GET.
//
// Design mirrors the organizer per-event page (the lock-card pattern, PageHeader with
// back, rounded-md cards, outline rounded-full badges) per AFC constants. Toasts on
// success/failure via sonner. NO em/en dashes in any copy. Shapes from lib/vendor.ts.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  IconCheck,
  IconChecks,
  IconCircleCheck,
  IconClipboardCheck,
  IconMapPin,
  IconPackage,
  IconPackageExport,
  IconTruck,
  IconUpload,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { vendorApi, FulfilmentState, VendorOrder } from "@/lib/vendor";
import { useVendor } from "../../_components/VendorContext";
import { StateBadge } from "../../_components/StateBadge";

type Params = { id: string };

// ── The lifecycle, in order ──
// Each step has the state it represents + a label + an icon for the stepper. The
// index of an order's current state in this array tells us which steps are DONE
// (before it), CURRENT (at it), and UPCOMING (after it).
const STEPS: { state: FulfilmentState; label: string; icon: any }[] = [
  { state: "received", label: "Received", icon: IconPackage },
  { state: "acknowledged", label: "Acknowledged", icon: IconClipboardCheck },
  { state: "ship_scheduled", label: "Ship scheduled", icon: IconPackageExport },
  { state: "shipped", label: "Shipped", icon: IconTruck },
  { state: "completed", label: "Completed", icon: IconCircleCheck },
];

export default function VendorOrderDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = use(params);
  const orderId = Number(id);
  const { orders, refetch } = useVendor();

  // The order this page is about, read out of the shared queue by id.
  const order: VendorOrder | undefined = useMemo(
    () => orders.find((o) => o.order_id === orderId),
    [orders, orderId],
  );

  // Action-in-flight flag so buttons disable + show progress while a POST runs.
  const [submitting, setSubmitting] = useState(false);

  // ── Set-ship-date form state (acknowledged step). ──
  const [shipDate, setShipDate] = useState("");

  // ── Mark-shipped form state (ship_scheduled step). ──
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  // After a successful ship, the backend tells us how many evidence files it stored
  // (it has no read endpoint for the media yet); we surface that count as confirmation.
  const [evidenceSaved, setEvidenceSaved] = useState<number | null>(null);

  // ── Order-not-in-queue guard ──
  // The id isn't one of the caller's orders (wrong url, or not their order). A vendor
  // only ever sees their own orders, so we show the same lock-style notice the
  // organizer portal uses for "not your event".
  if (!order) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Order" back />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <IconPackage className="size-6" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              We could not find this order in your queue. You can only fulfil your
              own orders.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/vendor/orders">Back to orders</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const state = order.fulfilment_state;
  // Where the current state sits in the lifecycle (drives the stepper's done/current).
  const currentIndex = STEPS.findIndex((s) => s.state === state);

  // ── Action handlers ──
  // Each wraps its vendorApi call with the in-flight flag, a success/failure toast,
  // and a refetch() so the shared queue (and this page's derived view) advances.

  const handleAcknowledge = async () => {
    setSubmitting(true);
    try {
      await vendorApi.acknowledge(order.order_id);
      toast.success("Order acknowledged.");
      await refetch();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Could not acknowledge the order.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetShipDate = async () => {
    if (!shipDate) {
      toast.error("Please pick a ship date.");
      return;
    }
    setSubmitting(true);
    try {
      await vendorApi.setShipDate(order.order_id, shipDate);
      toast.success("Ship date set.");
      await refetch();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Could not set the ship date.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkShipped = async () => {
    if (files.length === 0) {
      toast.error("Please attach at least one photo or video as proof of shipping.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await vendorApi.markShipped(order.order_id, files, note);
      setEvidenceSaved(res?.evidence_saved ?? files.length);
      toast.success("Order marked as shipped. The buyer has been emailed.");
      setFiles([]);
      setNote("");
      await refetch();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Could not mark the order as shipped.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkCompleted = async () => {
    setSubmitting(true);
    try {
      await vendorApi.markCompleted(order.order_id);
      toast.success("Order completed.");
      await refetch();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Could not complete the order.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back
        title={
          <span className="inline-flex items-center gap-2">
            Order #{order.order_id}
            <StateBadge state={state} />
          </span>
        }
        description={`Placed ${
          order.created_at ? formatDate(order.created_at) : ""
        }`}
      />

      {/* ── Order + delivery details ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Items */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <IconPackage className="size-4 text-primary" />
              Items
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items.</p>
            ) : (
              order.items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{it.name}</p>
                    {it.variant && (
                      <p className="text-xs text-muted-foreground">
                        {it.variant}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-muted-foreground">
                    Qty {it.quantity}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Buyer + delivery */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <IconMapPin className="size-4 text-primary" />
              Deliver to
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{order.buyer_name || "Buyer"}</p>
            {order.delivery.address && <p>{order.delivery.address}</p>}
            <p className="text-muted-foreground">
              {[order.delivery.city, order.delivery.state]
                .filter(Boolean)
                .join(", ")}
              {order.delivery.postcode ? ` ${order.delivery.postcode}` : ""}
            </p>
            {order.ship_date && (
              <>
                <Separator className="my-2" />
                <p className="text-muted-foreground">
                  Ship date:{" "}
                  <span className="text-foreground font-medium">
                    {formatDate(order.ship_date)}
                  </span>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Lifecycle stepper ── */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Fulfilment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* The stepper: each stage as a node, coloured done / current / upcoming. */}
          <ol className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-0">
            {STEPS.map((step, idx) => {
              const isDone = currentIndex > idx;
              const isCurrent = currentIndex === idx;
              const Icon = step.icon;
              return (
                <li
                  key={step.state}
                  className="flex sm:flex-col items-center sm:flex-1 gap-3 sm:gap-2 sm:text-center"
                >
                  <div className="flex items-center sm:flex-col sm:w-full gap-3 sm:gap-2">
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full border",
                        isDone &&
                          "border-primary bg-primary text-primary-foreground",
                        isCurrent &&
                          "border-primary text-primary bg-primary/10",
                        !isDone &&
                          !isCurrent &&
                          "border-border text-muted-foreground",
                      )}
                    >
                      {isDone ? (
                        <IconCheck className="size-4" />
                      ) : (
                        <Icon className="size-4" />
                      )}
                    </div>
                    {/* Connector line between nodes (horizontal on desktop). */}
                    {idx < STEPS.length - 1 && (
                      <div
                        className={cn(
                          "hidden sm:block h-0.5 w-full",
                          currentIndex > idx ? "bg-primary" : "bg-border",
                        )}
                      />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs",
                      isCurrent
                        ? "text-foreground font-medium"
                        : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>

          <Separator />

          {/* ── The action available at the CURRENT state ── */}

          {/* received → Acknowledge */}
          {state === "received" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Confirm you have seen this order and will fulfil it.
              </p>
              <Button
                onClick={handleAcknowledge}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                <IconClipboardCheck className="size-4" />
                {submitting ? "Acknowledging..." : "Acknowledge order"}
              </Button>
            </div>
          )}

          {/* acknowledged → Set ship date */}
          {state === "acknowledged" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Pick the date you plan to ship this order. The buyer sees it once
                you mark the order shipped.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ship-date">Ship date</Label>
                  <Input
                    id="ship-date"
                    type="date"
                    value={shipDate}
                    onChange={(e) => setShipDate(e.target.value)}
                    className="w-full sm:w-56"
                  />
                </div>
                <Button
                  onClick={handleSetShipDate}
                  disabled={submitting || !shipDate}
                  className="w-full sm:w-auto"
                >
                  <IconPackageExport className="size-4" />
                  {submitting ? "Saving..." : "Set ship date"}
                </Button>
              </div>
            </div>
          )}

          {/* ship_scheduled → Mark shipped (multipart evidence upload) */}
          {state === "ship_scheduled" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Upload a photo or short video of the package as proof of shipping,
                then mark the order shipped. The buyer is emailed automatically.
              </p>
              <div className="space-y-2">
                <Label htmlFor="evidence">Proof of shipping</Label>
                <Input
                  id="evidence"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) =>
                    setFiles(e.target.files ? Array.from(e.target.files) : [])
                  }
                />
                {files.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {files.length} file{files.length > 1 ? "s" : ""} selected:{" "}
                    {files.map((f) => f.name).join(", ")}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Textarea
                  id="note"
                  placeholder="Anything the buyer or AFC should know about this shipment."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </div>
              <Button
                onClick={handleMarkShipped}
                disabled={submitting || files.length === 0}
                className="w-full sm:w-auto"
              >
                <IconUpload className="size-4" />
                {submitting ? "Uploading..." : "Mark shipped"}
              </Button>
            </div>
          )}

          {/* shipped → Mark completed */}
          {state === "shipped" && (
            <div className="flex flex-col gap-3">
              {/* If we just shipped on this page, confirm the evidence count. */}
              {evidenceSaved !== null && (
                <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
                  <IconChecks className="size-4" />
                  {evidenceSaved} evidence file{evidenceSaved === 1 ? "" : "s"}{" "}
                  uploaded.
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Once the buyer has received this order, mark it completed.
              </p>
              <Button
                onClick={handleMarkCompleted}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                <IconCircleCheck className="size-4" />
                {submitting ? "Completing..." : "Mark completed"}
              </Button>
            </div>
          )}

          {/* completed → done state */}
          {state === "completed" && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <IconCircleCheck className="size-6" />
              </div>
              <p className="text-sm font-medium">This order is complete.</p>
              <p className="text-xs text-muted-foreground">
                Nothing more to do here. Thanks for fulfilling it.
              </p>
            </div>
          )}

          {/* cancelled → terminal, no action (no transition wires it yet). */}
          {state === "cancelled" && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                This order was cancelled.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
