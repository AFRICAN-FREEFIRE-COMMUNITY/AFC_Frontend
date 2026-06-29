"use client";

// CustomerDeliveryPanel = the SUPER-ADMIN-ONLY customer delivery-information table
// (search + date filters + pagination + per-row reveal of the full PII).
//
// Rendered by: app/(a)/a/shop/customers/page.tsx (which applies the super-admin gate
// in the UI, mirroring app/(a)/a/history/page.tsx). The shop landing
// app/(a)/a/shop/page.tsx links here from a "Customer Delivery Info" card that is
// itself only shown to head_admin / super_admin.
//
// Connects to two backend endpoints (both POST, both gated server-side by
// require_head_admin = head_admin / super_admin / superuser only):
//   - POST /shop/admin/delivery-info/         -> the masked LIST. The email + phone in
//       each row arrive ALREADY MASKED from the server; the panel just renders them.
//       Server-side filtering + pagination use the {results, total_count, has_more,
//       next_offset} envelope (the same house shape AuditLogPanel.tsx consumes).
//   - POST /shop/admin/delivery-info/reveal/  -> the FULL, unmasked record for one
//       order_id (full email, full phone, full address). Fired per row, on demand,
//       when an admin clicks "Reveal full details".
//
// Design mirrors app/(a)/a/_components/AuditLogPanel.tsx: the auth_token cookie ->
// Bearer header via authHeaders(), a search Input + filters, a compact shadcn Table
// (text-xs) with expandable rows, and a Prev/Next pagination footer driven by the
// envelope. This route group app/(a)/ is i18n-EXEMPT, so all copy here is plain
// English (no useTranslations).
//
// PII NOTE: every field here is customer personal data. Nothing is ever console.logged.

import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
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
import { env } from "@/lib/env";
import axios from "axios";
import Cookies from "js-cookie";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
} from "lucide-react";
import { Fragment, type ReactNode, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 25;

// One row from POST /shop/admin/delivery-info/ (the LIST). email + phone_number are
// the MASKED values the backend already returns; the panel renders them verbatim.
type DeliveryRow = {
  order_id: number;
  user_id: number | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null; // masked, as returned by the server
  phone_number: string | null; // masked, as returned by the server
  city: string | null;
  state: string | null;
  status: string | null;
  total: string | null;
  saved_profile_id: number | null;
  created_at: string;
};

// The FULL record from POST /shop/admin/delivery-info/reveal/ for one order_id. Carries
// the unmasked email, phone and the full address (which the LIST never includes).
type RevealRecord = {
  order_id: number;
  user_id: number | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null; // FULL, unmasked
  phone_number: string | null; // FULL, unmasked
  address: string | null; // FULL
  city: string | null;
  state: string | null;
  postcode: string | null;
  status: string | null;
  total: string | null;
  saved_profile_id: number | null;
  created_at: string;
};

// Bearer header from the auth_token cookie (the cookie AuthContext writes on login).
// Same helper idiom AuditLogPanel.tsx and lib/*.ts use across the admin app.
function authHeaders() {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token ?? ""}` };
}

// One label/value line inside the expandable reveal block. Mirrors AuditLogPanel's Detail.
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="min-w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="break-all text-foreground">{children}</dd>
    </div>
  );
}

// Order status -> outline badge tone. Greens for the happy path, gold for pending,
// destructive for failure states; mirrors the /a/shop order-status colour intent.
function statusBadge(status: string | null): {
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
} {
  const s = (status ?? "").toLowerCase();
  if (s === "paid" || s === "fulfilled") {
    return { variant: "outline", className: "border-primary text-primary" };
  }
  if (s === "pending") return { variant: "outline", className: "border-gold text-gold" };
  if (s === "declined" || s === "failed" || s === "cancelled" || s === "refunded") {
    return { variant: "destructive", className: "" };
  }
  return { variant: "outline", className: "" };
}

export function CustomerDeliveryPanel() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Per-row reveal state. expanded = which order rows are open; reveals = the loaded
  // full record keyed by order_id; revealing = order_ids with an in-flight reveal call.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [reveals, setReveals] = useState<Record<number, RevealRecord>>({});
  const [revealing, setRevealing] = useState<Set<number>>(new Set());

  // Filters (all server-side). q = free text; date_from / date_to = created-at window.
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Fetch the masked LIST page for the current filters + offset.
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/admin/delivery-info/`,
        {
          q: q || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          limit: PAGE_SIZE,
          offset,
        },
        { headers: authHeaders() },
      );
      setRows(res.data?.results ?? []);
      setTotal(res.data?.total_count ?? 0);
      setHasMore(Boolean(res.data?.has_more));
    } catch (error) {
      // No PII in the toast or anywhere else.
      toast.error("Could not load customer delivery information.");
    } finally {
      setLoading(false);
    }
  }, [q, dateFrom, dateTo, offset]);

  // Debounced refetch so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchList, 300);
    return () => clearTimeout(t);
  }, [fetchList]);

  // Any filter change resets paging back to the first page.
  useEffect(() => {
    setOffset(0);
  }, [q, dateFrom, dateTo]);

  // Toggle a row open/closed. On first open, lazily POST the reveal to load the full
  // (unmasked) record for that order; cached afterwards so re-opening is instant.
  const toggleRow = async (orderId: number) => {
    const isOpen = expanded.has(orderId);
    setExpanded((prev) => {
      const next = new Set(prev);
      isOpen ? next.delete(orderId) : next.add(orderId);
      return next;
    });
    if (isOpen || reveals[orderId] || revealing.has(orderId)) return;

    setRevealing((prev) => new Set(prev).add(orderId));
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/admin/delivery-info/reveal/`,
        { order_id: orderId },
        { headers: authHeaders() },
      );
      const record: RevealRecord | undefined = res.data?.record;
      if (record) {
        setReveals((prev) => ({ ...prev, [orderId]: record }));
      } else {
        toast.error("Could not reveal the full details for this order.");
      }
    } catch (error) {
      toast.error("Could not reveal the full details for this order.");
    } finally {
      setRevealing((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const from = total === 0 ? 0 : offset + 1;
  const to = offset + rows.length;

  // "First Last", trimmed; falls back to a dash when both are blank.
  const fullName = (r: { first_name: string | null; last_name: string | null }) =>
    [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || "-";

  // "City, State", trimmed; falls back to a dash when both are blank.
  const location = (r: { city: string | null; state: string | null }) =>
    [r.city, r.state].filter(Boolean).join(", ").trim() || "-";

  return (
    <div>
      {/* Filter controls. All filtering happens server-side via the request body. */}
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="relative md:col-span-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, username, email, city or state..."
            className="w-full pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="relative md:col-span-3">
          <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="date"
            className="w-full pl-10"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="From date"
          />
        </div>

        <div className="relative md:col-span-3">
          <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="date"
            className="w-full pl-10"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="To date"
          />
        </div>
      </div>

      {loading ? (
        <FullLoader />
      ) : (
        <>
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="h-10 w-8 text-foreground" />
                <TableHead className="h-10 text-foreground">Order #</TableHead>
                <TableHead className="h-10 text-foreground">User</TableHead>
                <TableHead className="h-10 text-foreground">Name</TableHead>
                <TableHead className="h-10 text-foreground">Email</TableHead>
                <TableHead className="h-10 text-foreground">Phone</TableHead>
                <TableHead className="h-10 text-foreground">Location</TableHead>
                <TableHead className="h-10 text-foreground">Saved</TableHead>
                <TableHead className="h-10 text-right text-foreground">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length > 0 ? (
                rows.map((r) => {
                  const isOpen = expanded.has(r.order_id);
                  const isRevealing = revealing.has(r.order_id);
                  const record = reveals[r.order_id];
                  const sb = statusBadge(r.status);
                  return (
                    <Fragment key={r.order_id}>
                      {/* Masked summary row. Click anywhere to expand + reveal the full PII. */}
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => toggleRow(r.order_id)}
                      >
                        <TableCell className="p-2 align-top">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="p-2 align-top font-medium whitespace-nowrap">
                          #{r.order_id}
                        </TableCell>
                        <TableCell className="p-2 align-top whitespace-nowrap">
                          {r.username ?? "-"}
                        </TableCell>
                        <TableCell className="p-2 align-top whitespace-nowrap">
                          {fullName(r)}
                        </TableCell>
                        <TableCell className="p-2 align-top break-all">
                          {r.email ?? "-"}
                        </TableCell>
                        <TableCell className="p-2 align-top whitespace-nowrap">
                          {r.phone_number ?? "-"}
                        </TableCell>
                        <TableCell className="p-2 align-top">{location(r)}</TableCell>
                        <TableCell className="p-2 align-top">
                          {r.saved_profile_id ? (
                            <Badge
                              variant="outline"
                              className="border-primary text-primary"
                            >
                              Saved
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="p-2 align-top text-right text-muted-foreground whitespace-nowrap">
                          <LocalTime value={r.created_at} mode="date" />
                        </TableCell>
                      </TableRow>

                      {/* Reveal block: full email, phone, and address, loaded on demand. */}
                      {isOpen && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell className="p-0" />
                          <TableCell colSpan={8} className="p-3 align-top">
                            {isRevealing ? (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Revealing full details...
                              </div>
                            ) : record ? (
                              <>
                                <div className="mb-1 font-medium text-foreground">
                                  Full delivery details
                                </div>
                                <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                                  <Detail label="Full name">
                                    {fullName(record)}
                                  </Detail>
                                  <Detail label="Status">
                                    <Badge variant={sb.variant} className={sb.className}>
                                      {record.status ?? "n/a"}
                                    </Badge>
                                  </Detail>
                                  <Detail label="Email">{record.email ?? "-"}</Detail>
                                  <Detail label="Phone">
                                    {record.phone_number ?? "-"}
                                  </Detail>
                                  <Detail label="Address">
                                    {record.address ?? "-"}
                                  </Detail>
                                  <Detail label="City">{record.city ?? "-"}</Detail>
                                  <Detail label="State">{record.state ?? "-"}</Detail>
                                  <Detail label="Postcode">
                                    {record.postcode ?? "-"}
                                  </Detail>
                                  <Detail label="Total">{record.total ?? "-"}</Detail>
                                  <Detail label="Saved profile">
                                    {record.saved_profile_id
                                      ? `#${record.saved_profile_id}`
                                      : "Not saved"}
                                  </Detail>
                                  <Detail label="Placed">
                                    <LocalTime value={record.created_at} />
                                  </Detail>
                                </dl>
                              </>
                            ) : (
                              <div className="text-muted-foreground">
                                Full details are not available for this order.
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-24 text-center italic text-muted-foreground"
                  >
                    No matching delivery records.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination footer: range + Prev/Next driven by the envelope's has_more/offset. */}
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {from} to {to} of {total}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasMore}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
