"use client";

// ── Admin · Event Payments (escrow) ──────────────────────────────────────────
// Staff view of every paid-event registration payment (Stripe). A paid event holds
// each registration fee in escrow; AFC staff either RELEASE the funds to the organizer
// or REFUND them to the player. This page lists those payments, shows the held/total
// summary, and exposes per-row Release / Refund actions (confirm-gated).
//
// Staff-gating: lives under app/(a)/a, whose layout wraps everything in
// <ProtectedRoute adminOnly> - same gate as every other admin page, so no extra check
// is needed here. The backend admin/event-payments endpoints are independently staff-only.
//
// Data sources (all REAL):
//   - the payments list + summary → eventPaymentsApi.adminListEventPayments({ event_id? })
//   - the event filter dropdown   → GET /events/get-all-events/ (same endpoint the public
//                                    tournaments page + admin events list already use)
//   - Release / Refund actions    → eventPaymentsApi.adminReleasePayment / adminRefundPayment
//
// Design idiom mirrors app/(a)/a/partners/page.tsx (PageHeader + Card/Table + FullLoader +
// sonner toasts + an outline StatusBadge) and the admin events list's summary Card grid.
// Reached from a "Payments" button on the admin events page header AND an "Event Payments"
// sidebar entry (constants/nav-links.ts).

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import axios from "axios";
import {
  IconCash,
  IconLock,
  IconReceipt,
  IconRefresh,
} from "@tabler/icons-react";
import {
  eventPaymentsApi,
  type AdminEventPayment,
  type AdminEventPaymentsSummary,
} from "@/lib/api/eventPayments";

// One option in the event filter dropdown (subset of the get-all-events shape).
interface EventOption {
  event_id: number | string;
  event_name: string;
  slug: string;
}

// Escrow release-status pill - outline badge whose colour tracks the state (held =
// amber/pending, released = green, refunded = neutral). Same idiom as the partners
// StatusBadge so the admin surfaces read identically.
function ReleaseStatusBadge({ status }: { status: string }) {
  if (status === "held")
    return (
      <Badge variant="outline" className="border-amber-500/50 text-amber-400">
        Held
      </Badge>
    );
  if (status === "released")
    return (
      <Badge variant="outline" className="border-green-600/60 text-green-400">
        Released
      </Badge>
    );
  if (status === "refunded")
    return (
      <Badge variant="outline" className="border-blue-500/50 text-blue-400">
        Refunded
      </Badge>
    );
  return (
    <Badge variant="outline" className="capitalize">
      {status || "-"}
    </Badge>
  );
}

// Format an amount + currency for display (e.g. "USD 5.00"). Kept simple/locale-aware
// without assuming the currency symbol, since the fee currency is configurable.
function formatAmount(amount: number, currency: string) {
  return `${currency} ${Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function EventPaymentsAdminPage() {
  const [payments, setPayments] = useState<AdminEventPayment[]>([]);
  const [summary, setSummary] = useState<AdminEventPaymentsSummary>({
    held_count: 0,
    total_payments: 0,
  });
  const [loading, setLoading] = useState(true);
  // "all" = every event; otherwise the chosen event_id (as a string for the Select).
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [events, setEvents] = useState<EventOption[]>([]);

  // The payment currently being acted on, plus which action - drives the confirm dialog.
  const [pendingAction, setPendingAction] = useState<{
    payment: AdminEventPayment;
    type: "release" | "refund";
  } | null>(null);
  // payment_id currently mid-request, so its row buttons show a busy/disabled state.
  const [actingId, setActingId] = useState<string | number | null>(null);

  // Load the event dropdown options once (same endpoint the public + admin event lists use).
  const fetchEvents = useCallback(async () => {
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
      );
      setEvents(res.data?.events ?? []);
    } catch {
      // Non-fatal - the filter just won't list events; the table still loads everything.
    }
  }, []);

  // Load the payments + summary, optionally filtered by the selected event.
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await eventPaymentsApi.adminListEventPayments(
        eventFilter !== "all" ? { event_id: eventFilter } : undefined,
      );
      setPayments(res?.payments ?? []);
      setSummary(
        res?.summary ?? { held_count: 0, total_payments: 0 },
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to load event payments.",
      );
    } finally {
      setLoading(false);
    }
  }, [eventFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Run the confirmed Release/Refund, toast the result, then refresh the list so the
  // row's release_status + the summary reflect the change.
  const runAction = useCallback(async () => {
    if (!pendingAction) return;
    const { payment, type } = pendingAction;
    setActingId(payment.payment_id);
    try {
      const res =
        type === "release"
          ? await eventPaymentsApi.adminReleasePayment(payment.payment_id)
          : await eventPaymentsApi.adminRefundPayment(payment.payment_id);
      toast.success(
        res?.message ||
          (type === "release"
            ? "Payment released to the organizer."
            : "Payment refunded to the player."),
      );
      setPendingAction(null);
      await fetchPayments();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          `Failed to ${type} the payment. Please try again.`,
      );
    } finally {
      setActingId(null);
    }
  }, [pendingAction, fetchPayments]);

  // first load only - keep the table on-screen during filter/refresh refetches
  if (loading && payments.length === 0) return <FullLoader />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        {/* data-tour anchor (payments-title): admin tour "Event payments escrow" step. */}
        <span data-tour="payments-title" className="inline-flex">
          <PageHeader
            back
            title="Event Payments"
            description="Registration fees held in escrow for paid events. Release to the organizer or refund the player."
          />
        </span>
        <Button
          variant="outline"
          className="w-full md:w-auto"
          onClick={() => fetchPayments()}
        >
          <IconRefresh className="size-4" />
          Refresh
        </Button>
      </div>

      {/* Summary cards: held vs total. Mirrors the admin events list's summary grid. */}
      {/* data-tour anchor (payments-summary): admin tour "Payment summary cards" step. */}
      <div data-tour="payments-summary" className="grid gap-2 grid-cols-1 md:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Payments
            </CardTitle>
            <IconReceipt className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_payments}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
              Across all paid events
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Held in Escrow</CardTitle>
            <IconLock className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.held_count}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
              Awaiting release or refund
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Showing</CardTitle>
            <IconCash className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payments.length}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
              {eventFilter === "all" ? "All events" : "Filtered event"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event filter */}
      {/* data-tour anchor (payments-filter): admin tour "Filter by event" step. */}
      <div data-tour="payments-filter" className="w-full md:max-w-xs">
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {events.map((e) => (
              <SelectItem key={e.event_id} value={String(e.event_id)}>
                {e.event_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* data-tour anchor (payments-table): admin tour "Payments table" step. Wraps BOTH
          the empty-state card and the populated table so the anchor is always present
          regardless of whether any payments exist. */}
      <div data-tour="payments-table">
      {payments.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {eventFilter === "all"
              ? "No event payments yet."
              : "No payments for this event."}
          </CardContent>
        </Card>
      ) : (
        <Card className="pt-2">
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Payer</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Escrow</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => {
                    // Only a PAID + HELD payment can be released or refunded.
                    const canAct =
                      p.status === "paid" && p.release_status === "held";
                    const isBusy = actingId === p.payment_id;
                    return (
                      <TableRow key={p.payment_id}>
                        <TableCell className="font-medium">
                          {p.event_name}
                        </TableCell>
                        <TableCell>{p.user}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.team || "-"}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatAmount(p.amount, p.currency)}
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">
                          {p.status}
                        </TableCell>
                        <TableCell>
                          <ReleaseStatusBadge status={p.release_status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.paid_at ? formatDate(p.paid_at) : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 justify-end">
                            {canAct ? (
                              <>
                                <Button
                                  size="sm"
                                  disabled={isBusy}
                                  onClick={() =>
                                    setPendingAction({
                                      payment: p,
                                      type: "release",
                                    })
                                  }
                                >
                                  Release
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isBusy}
                                  onClick={() =>
                                    setPendingAction({
                                      payment: p,
                                      type: "refund",
                                    })
                                  }
                                >
                                  Refund
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                No actions
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
      </div>

      {/* Confirm dialog - shared by Release + Refund; copy switches on the action type. */}
      <AlertDialog
        open={!!pendingAction}
        onOpenChange={(open) => !open && setPendingAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === "release"
                ? "Release this payment?"
                : "Refund this payment?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === "release" ? (
                <>
                  This releases{" "}
                  <span className="font-semibold">
                    {pendingAction
                      ? formatAmount(
                          pendingAction.payment.amount,
                          pendingAction.payment.currency,
                        )
                      : ""}
                  </span>{" "}
                  from <span className="font-semibold">{pendingAction?.payment.user}</span>{" "}
                  to the organizer of{" "}
                  <span className="font-semibold">
                    {pendingAction?.payment.event_name}
                  </span>
                  . This cannot be undone.
                </>
              ) : (
                <>
                  This refunds{" "}
                  <span className="font-semibold">
                    {pendingAction
                      ? formatAmount(
                          pendingAction.payment.amount,
                          pendingAction.payment.currency,
                        )
                      : ""}
                  </span>{" "}
                  back to{" "}
                  <span className="font-semibold">{pendingAction?.payment.user}</span>
                  . This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actingId != null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Keep the dialog mounted while the request runs (handle close in runAction).
                e.preventDefault();
                runAction();
              }}
              disabled={actingId != null}
            >
              {actingId != null
                ? "Working..."
                : pendingAction?.type === "release"
                  ? "Release"
                  : "Refund"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
