"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Admin Shop - Vendor Payouts ledger  (route: /a/shop/payouts)
//
// Purpose: the AFC admin surface for the marketplace payout LEDGER (Phase B3).
// Every VendorPayout row, regardless of rail (Paystack Transfers is the primary
// rail for African vendors; Stripe Connect is the fallback), lives in ONE table
// server-side, so this page shows them all together. A shop admin can:
//   • see every payout (vendor, order, amount, platform fee, rail, status,
//     transfer reference, created date) in one searchable, filterable table
//                                          ← marketplaceAdminApi.listPayouts
//   • release every OWED Stripe payout (vendors who finished Connect onboarding
//     after their orders completed)         ← marketplaceAdminApi.releaseOwedStripe
//   • retry every OWED Paystack payout (vendors who saved their bank after their
//     orders completed)                     ← marketplaceAdminApi.retryOwedPaystack
//
// The release/retry backend endpoints take ONE vendor_id per call (they release
// all of that vendor's owed rows), so the two header buttons loop over the
// distinct vendors that have owed rows on the matching rail and aggregate the
// results into one toast. Rows on the WRONG rail are never sent to an endpoint:
// each button only targets rows whose `provider` matches, so a vendor that has
// both rails configured is never paid down the rail they did not choose.
//
// AUTH: all three calls are require_admin server-side (Bearer token from the
// auth_token cookie, read inside lib/marketplaceAdmin.ts, never threaded here).
//
// CONNECTS TO:
//   • lib/marketplaceAdmin.ts  → the typed client wrapping
//     afc_shop/connect.py (admin_list_vendor_payouts / admin_release_owed_payouts)
//     and afc_shop/paystack_payout.py (admin_retry_owed_paystack_payouts).
//   • /a/shop                  → the Admin Shop dashboard's "Vendor Payouts" card
//     (Marketplace section) is the entry point here. The old standalone "Shop
//     Payouts" sidebar entry in constants/nav-links.ts was removed (owner request
//     2026-06-13: payouts live under the shop page). PageHeader `back` returns to
//     /a/shop; /a/shop/vendors is where the vendors being paid are managed.
//   • backend models: VendorPayout (the ledger row), Vendor.payout_provider (the
//     rail badge), Order (the order each payout settles).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { PageHeader } from "@/components/PageHeader";
import { Loader } from "@/components/Loader";
import { Search } from "lucide-react";
import { IconBrandStripe, IconCash } from "@tabler/icons-react";

import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatMoneyInput } from "@/lib/utils";
import { matchesSearch } from "@/lib/search";
import { ITEMS_PER_PAGE } from "@/constants";
import {
  AdminVendorPayout,
  PayoutProvider,
  PayoutSummary,
  marketplaceAdminApi,
} from "@/lib/marketplaceAdmin";

// The status filter Select's options. "all" shows the whole ledger; the rest map
// 1:1 onto VendorPayout.status values (owed/released/paid).
const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "owed", label: "Owed" },
  { value: "released", label: "Released" },
  { value: "paid", label: "Paid" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

// A payout still waiting on a transfer. "released" is the backend's transient seam
// between owed and paid; both release endpoints treat it like owed, so the header
// buttons (and the owed counts that drive them) do too.
const OWED_STATUSES = ["owed", "released"];

export default function VendorPayoutsPage() {
  const { token } = useAuth();

  // ── Ledger state (one fetch backs the table, the summary cards, and the
  //    owed-row maps the two release buttons act on) ──
  const [payouts, setPayouts] = useState<AdminVendorPayout[]>([]);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [currency, setCurrency] = useState("NGN");
  const [isLoading, setIsLoading] = useState(true);

  // ── Table controls: search box + status Select + client-side pagination ──
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // ── Release confirm dialog: which rail is being confirmed (null = closed) ──
  const [confirmRail, setConfirmRail] = useState<PayoutProvider | null>(null);
  const [releasing, setReleasing] = useState(false);

  // Fetch the whole ledger. marketplaceAdminApi reads the Bearer token from the
  // auth_token cookie itself, so we only gate on having a token at all (same
  // pattern as /a/shop/vendors).
  const fetchPayouts = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await marketplaceAdminApi.listPayouts();
      setPayouts(data.payouts ?? []);
      setSummary(data.summary ?? null);
      setCurrency(data.currency || "NGN");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load payouts.");
      setPayouts([]);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) fetchPayouts();
  }, [token, fetchPayouts]);

  // Distinct vendors that still have OWED rows, per rail. These drive the two
  // header buttons: each release call is per-vendor on the backend, so we collect
  // the vendor ids whose owed rows sit on that rail and call once per vendor.
  const owedVendorIdsByRail = useMemo(() => {
    const byRail: Record<PayoutProvider, Set<number>> = {
      paystack: new Set<number>(),
      stripe: new Set<number>(),
    };
    for (const p of payouts) {
      if (OWED_STATUSES.includes(p.status)) byRail[p.provider]?.add(p.vendor_id);
    }
    return byRail;
  }, [payouts]);

  // Owed ROW counts per rail, for the confirm dialog copy + disabling the buttons
  // when there is nothing to release on that rail.
  const owedRowCountByRail = useMemo(() => {
    const counts: Record<PayoutProvider, number> = { paystack: 0, stripe: 0 };
    for (const p of payouts) {
      if (OWED_STATUSES.includes(p.status)) counts[p.provider] += 1;
    }
    return counts;
  }, [payouts]);

  // ── Release / retry every owed payout on one rail ──
  // Loops the distinct owed vendors of that rail, calls the matching endpoint per
  // vendor (the backend releases ALL of that vendor's owed rows per call), and
  // aggregates the released / still-owed totals into one toast. A vendor that is
  // still not ready (no Stripe account / no saved bank) simply stays owed; that is
  // reported, not treated as an error. Refetches afterwards so the table, summary
  // cards, and button states all reflect the new ledger.
  const handleRelease = async (rail: PayoutProvider) => {
    const vendorIds = Array.from(owedVendorIdsByRail[rail]);
    if (vendorIds.length === 0) return;

    let released = 0;
    let stillOwed = 0;
    let failedCalls = 0;
    try {
      setReleasing(true);
      for (const vendorId of vendorIds) {
        try {
          const res =
            rail === "stripe"
              ? await marketplaceAdminApi.releaseOwedStripe(vendorId)
              : await marketplaceAdminApi.retryOwedPaystack(vendorId);
          released += res.released;
          stillOwed += res.still_owed;
        } catch {
          // One vendor's call failing (network, 500) must not abort the rest of
          // the batch; count it and keep releasing the other vendors.
          failedCalls += 1;
        }
      }

      const railLabel = rail === "stripe" ? "Stripe" : "Paystack";
      if (released > 0) {
        toast.success(
          `Released ${released} payout${released === 1 ? "" : "s"} via ${railLabel}.`,
        );
      }
      if (stillOwed > 0) {
        toast.info(
          `${stillOwed} payout${stillOwed === 1 ? " is" : "s are"} still owed (vendor not ready or transfer failed).`,
        );
      }
      if (failedCalls > 0) {
        toast.error(
          `Could not reach the server for ${failedCalls} vendor${failedCalls === 1 ? "" : "s"}. Try again.`,
        );
      }
      if (released === 0 && stillOwed === 0 && failedCalls === 0) {
        toast.info("Nothing to release on this rail.");
      }

      setConfirmRail(null);
      fetchPayouts();
    } finally {
      setReleasing(false);
    }
  };

  // ── Search + status filter (client-side, the ledger arrives in one fetch) ──
  // Shared matchesSearch() so vendor / order / reference search is punctuation-
  // and font-insensitive, same as every other admin list page.
  const filteredPayouts = payouts.filter((p) => {
    const matchesText = matchesSearch(
      [
        p.vendor_name,
        String(p.order_id),
        String(p.id),
        p.stripe_transfer_id,
        p.provider,
        p.status,
      ],
      searchQuery,
    );
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesText && matchesStatus;
  });

  const totalPages = Math.ceil(filteredPayouts.length / ITEMS_PER_PAGE);
  const paginatedPayouts = filteredPayouts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Changing the search or the status filter resets to page 1 (a deep page of a
  // previous filter would otherwise show an empty slice).
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Status pill: outline Badge with the same colour language as the vendors page
  // (green = settled, orange = needs attention, blue = transient/in-flight).
  const statusBadgeClass = (status: AdminVendorPayout["status"]) => {
    switch (status) {
      case "paid":
        return "rounded-full border-green-500 text-green-600";
      case "released":
        return "rounded-full border-blue-500 text-blue-600";
      default: // owed
        return "rounded-full border-orange-500 text-orange-600";
    }
  };

  // Rail pill: sky for Paystack (the primary rail), violet for Stripe Connect.
  const providerBadgeClass = (provider: PayoutProvider) =>
    provider === "stripe"
      ? "rounded-full border-violet-500 text-violet-600"
      : "rounded-full border-sky-500 text-sky-600";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        back
        title="Vendor Payouts"
        description="The marketplace payout ledger: every vendor payout across both rails (Paystack Transfers and Stripe Connect), with one-click release of the owed ones."
        action={
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Release owed STRIPE payouts (connect.admin_release_owed_payouts) */}
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={releasing || owedRowCountByRail.stripe === 0}
              onClick={() => setConfirmRail("stripe")}
            >
              <IconBrandStripe className="mr-2 h-4 w-4" />
              Release owed (Stripe)
            </Button>
            {/* Retry owed PAYSTACK payouts (admin_retry_owed_paystack_payouts) */}
            <Button
              className="w-full sm:w-auto"
              disabled={releasing || owedRowCountByRail.paystack === 0}
              onClick={() => setConfirmRail("paystack")}
            >
              <IconCash className="mr-2 h-4 w-4" />
              Retry owed (Paystack)
            </Button>
          </div>
        }
      />

      {/* ── Summary cards: the owed vs paid totals from the same list response ── */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-muted-foreground">
                Owed to vendors
              </p>
              <p className="text-2xl font-bold text-orange-600">
                {formatMoneyInput(summary.owed_amount)} {currency}
              </p>
              <p className="text-xs text-muted-foreground">
                {summary.owed_count} payout{summary.owed_count === 1 ? "" : "s"}{" "}
                waiting on a transfer
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-muted-foreground">
                Paid out
              </p>
              <p className="text-2xl font-bold text-green-600">
                {formatMoneyInput(summary.paid_amount)} {currency}
              </p>
              <p className="text-xs text-muted-foreground">
                {summary.paid_count} payout{summary.paid_count === 1 ? "" : "s"}{" "}
                settled
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Search + status filter row ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vendor, order id, or transfer reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── The ledger table ── */}
      <Card>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader text="Loading payouts..." />
            </div>
          ) : payouts.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No payouts yet. A row appears here each time a marketplace order
              reaches completed.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">Vendor</TableHead>
                  <TableHead className="text-foreground">Order</TableHead>
                  <TableHead className="text-foreground">Amount</TableHead>
                  <TableHead className="text-foreground">Platform fee</TableHead>
                  <TableHead className="text-foreground">Provider</TableHead>
                  <TableHead className="text-foreground">Status</TableHead>
                  <TableHead className="text-foreground">Transfer ref</TableHead>
                  <TableHead className="text-foreground">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {paginatedPayouts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No payouts match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPayouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="font-medium">
                        {payout.vendor_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        #{payout.order_id}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatMoneyInput(payout.amount)} {currency}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatMoneyInput(payout.platform_fee)} {currency}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={providerBadgeClass(payout.provider)}
                        >
                          {payout.provider === "stripe" ? "Stripe" : "Paystack"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(payout.status)}
                        >
                          {payout.status.charAt(0).toUpperCase() +
                            payout.status.slice(1)}
                        </Badge>
                      </TableCell>
                      {/* The shared transfer reference column: a Stripe tr_... id or a
                          Paystack TRF_... code; blank while the row is still owed. */}
                      <TableCell className="font-mono text-muted-foreground max-w-[140px] truncate">
                        {payout.stripe_transfer_id || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(payout.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Pagination (same idiom as /a/shop/orders) ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="hidden md:block text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredPayouts.length)} of{" "}
            {filteredPayouts.length}
          </p>
          <Pagination className="w-full md:w-auto mx-0">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={
                    currentPage === 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (page) =>
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1,
                )
                .map((page, idx, arr) => (
                  <React.Fragment key={page}>
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    <PaginationItem>
                      <PaginationLink
                        isActive={currentPage === page}
                        onClick={() => setCurrentPage(page)}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  </React.Fragment>
                ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  className={
                    currentPage === totalPages
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* ── Confirm dialog for the release/retry buttons (controlled: confirmRail
          says which rail is being confirmed; null = closed). Money moves on
          confirm, so this is deliberately not a one-click action. ── */}
      <Dialog
        open={confirmRail !== null}
        onOpenChange={(o) => {
          if (!o && !releasing) setConfirmRail(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmRail === "stripe"
                ? "Release owed Stripe payouts?"
                : "Retry owed Paystack payouts?"}
            </DialogTitle>
            <DialogDescription>
              {confirmRail === "stripe"
                ? `This re-attempts the Stripe transfer for ${owedRowCountByRail.stripe} owed payout${owedRowCountByRail.stripe === 1 ? "" : "s"}. Vendors who finished Connect onboarding get paid now; vendors who have not stay owed.`
                : `This re-attempts the Paystack transfer for ${owedRowCountByRail.paystack} owed payout${owedRowCountByRail.paystack === 1 ? "" : "s"}. Vendors who saved their bank get paid now; vendors who have not stay owed.`}{" "}
              Real money moves for every transfer that succeeds.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmRail(null)}
              disabled={releasing}
            >
              Cancel
            </Button>
            <Button
              onClick={() => confirmRail && handleRelease(confirmRail)}
              disabled={releasing}
            >
              {releasing ? (
                <Loader text="Releasing..." />
              ) : confirmRail === "stripe" ? (
                "Release payouts"
              ) : (
                "Retry payouts"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
