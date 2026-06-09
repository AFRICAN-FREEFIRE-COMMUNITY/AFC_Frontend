"use client";

// AuditLogPanel = the sitewide automatic admin audit log table (filters + pagination).
//
// Shared by BOTH surfaces so they stay identical:
//   - the standalone admin page  app/(a)/a/history/page.tsx
//   - the "History" tab on        app/(a)/a/settings/page.tsx   (rendered with embedded)
//
// Connects to: GET /auth/get-audit-log/ (afc_auth.views.get_audit_log), which reads the
// afc_auth.AuditLog rows written automatically by afc_auth.middleware.AuditLogMiddleware on every
// admin/staff mutation. The endpoint is admin-gated, so the Bearer token (auth_token cookie, via
// authHeaders() below) is required. Filtering + pagination are SERVER-SIDE using the
// {results, has_more, next_offset, total_count} envelope (the afc_partner_api house shape).

import { FullLoader } from "@/components/Loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
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
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { parseUserAgent } from "@/lib/user-agent";
import axios from "axios";
import Cookies from "js-cookie";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";
import { Fragment, type ReactNode, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// "registration_start_time" -> "Registration start time" for the details labels.
function prettyKey(k: string): string {
  return k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

// One label/value line inside the expandable details.
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="min-w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="break-all text-foreground">{children}</dd>
    </div>
  );
}

const PAGE_SIZE = 25;

// One audit row as returned by the endpoint (see get_audit_log's results[] shape).
type AuditRow = {
  id: number;
  actor_username: string;
  actor_role: string;
  summary: string; // human-readable short form, e.g. "Edited an event #163"
  action: string;
  method: string;
  path: string;
  view_name: string;
  target_type: string;
  target_id: string;
  status_code: number | null;
  ip_address: string;
  user_agent: string;
  metadata: Record<string, any>;
  timestamp: string;
};

// Bearer header from the auth_token cookie (the cookie AuthContext writes on login). Mirrors the
// authHeaders() helper used across lib/*.ts.
function authHeaders() {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token ?? ""}` };
}

// Status code -> badge style + tone (2xx ok, 4xx client warning, 5xx server error).
function statusBadge(code: number | null): {
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
} {
  if (code === null) return { variant: "outline", className: "" };
  if (code >= 500) return { variant: "destructive", className: "" };
  if (code >= 400) return { variant: "outline", className: "border-gold text-gold" };
  return { variant: "outline", className: "border-primary text-primary" }; // 2xx/3xx
}

/**
 * embedded: when true (the Settings "History" tab) the panel drops its own intro line so it sits
 * cleanly under the tab; the standalone /a/history page passes embedded={false} (default) to show
 * the "captured automatically" subtitle + InfoTip.
 */
export function AuditLogPanel({ embedded = false }: { embedded?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  // Which rows are expanded to show the full details (one row click toggles it).
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggleExpanded = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Filters (all server-side). Method "all" maps to no filter.
  const [q, setQ] = useState("");
  const [method, setMethod] = useState("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-audit-log/`, {
        headers: authHeaders(),
        params: {
          q: q || undefined,
          method: method !== "all" ? method : undefined,
          status: statusFilter || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          limit: PAGE_SIZE,
          offset,
        },
      });
      setRows(res.data?.results ?? []);
      setTotal(res.data?.total_count ?? 0);
      setHasMore(Boolean(res.data?.has_more));
    } catch (error) {
      toast.error("Could not load the audit log.");
    } finally {
      setLoading(false);
    }
  }, [q, method, statusFilter, dateFrom, dateTo, offset]);

  // Debounced refetch: typing in the text filters should not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchLog, 300);
    return () => clearTimeout(t);
  }, [fetchLog]);

  // Any filter change resets paging back to the first page.
  useEffect(() => {
    setOffset(0);
  }, [q, method, statusFilter, dateFrom, dateTo]);

  const from = total === 0 ? 0 : offset + 1;
  const to = offset + rows.length;

  return (
    <div>
      {/* Standalone page shows the explainer; embedded (Settings tab) keeps it compact. */}
      {!embedded && (
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <span>Every admin and staff action across the platform, captured automatically.</span>
          <InfoTip text="This log records every create, update and delete made by an admin or staff member, anywhere on the platform. It is captured automatically by the server, so new admin tools are covered the moment they ship. Sensitive values (passwords, tokens) are never stored." />
        </div>
      )}

      {/* Filter controls. All filtering happens server-side via query params. */}
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="relative md:col-span-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search admin, path or action..."
            className="w-full pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              <SelectItem value="POST">POST (create)</SelectItem>
              <SelectItem value="PATCH">PATCH (update)</SelectItem>
              <SelectItem value="PUT">PUT (update)</SelectItem>
              <SelectItem value="DELETE">DELETE (remove)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2">
          <Input
            type="number"
            placeholder="Status (e.g. 200)"
            className="w-full"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>

        <div className="relative md:col-span-2">
          <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="date"
            className="w-full pl-10"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="From date"
          />
        </div>

        <div className="relative md:col-span-2">
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
                <TableHead className="h-10 text-foreground">Admin</TableHead>
                <TableHead className="h-10 text-foreground">What happened</TableHead>
                <TableHead className="h-10 text-right text-foreground">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length > 0 ? (
                rows.map((r) => {
                  const sb = statusBadge(r.status_code);
                  const isOpen = expanded.has(r.id);
                  // The submitted request body (redacted server-side) = the "details" of the action.
                  const body: Record<string, any> = (r.metadata && r.metadata.body) || {};
                  const bodyEntries = Object.entries(body).filter(
                    ([, v]) => v !== null && v !== "" && typeof v !== "object",
                  );
                  return (
                    <Fragment key={r.id}>
                      {/* Short form: who + plain-English summary + when. Click to expand. */}
                      <TableRow className="cursor-pointer" onClick={() => toggleExpanded(r.id)}>
                        <TableCell className="p-2 align-top">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="p-2 align-top">
                          <div className="font-medium whitespace-nowrap">{r.actor_username}</div>
                          {r.actor_role && (
                            <div className="text-muted-foreground">{r.actor_role}</div>
                          )}
                        </TableCell>
                        <TableCell className="p-2 align-top">
                          <span className="font-medium">{r.summary || r.action}</span>
                        </TableCell>
                        <TableCell className="p-2 align-top text-right text-muted-foreground whitespace-nowrap">
                          {formatDate(r.timestamp)}
                        </TableCell>
                      </TableRow>

                      {/* Details: exactly what the admin did + full context (incl. device). */}
                      {isOpen && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell className="p-0" />
                          <TableCell colSpan={3} className="p-3 align-top">
                            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                              <Detail label="Status">
                                <Badge variant={sb.variant} className={sb.className}>
                                  {r.status_code ?? "n/a"}
                                </Badge>
                              </Detail>
                              <Detail label="Device">{parseUserAgent(r.user_agent)}</Detail>
                              <Detail label="IP address">{r.ip_address || "n/a"}</Detail>
                              <Detail label="When">
                                {new Date(r.timestamp).toLocaleString()}
                              </Detail>
                              <Detail label="Request">
                                <span className="font-mono">
                                  {r.method} {r.path}
                                </span>
                              </Detail>
                              <Detail label="Action key">{r.action}</Detail>
                            </dl>

                            {/* The redacted fields the admin submitted with this action. */}
                            {bodyEntries.length > 0 && (
                              <div className="mt-3">
                                <div className="mb-1 font-medium text-foreground">
                                  What was submitted
                                </div>
                                <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                                  {bodyEntries.map(([k, v]) => (
                                    <Detail key={k} label={prettyKey(k)}>
                                      {String(v)}
                                    </Detail>
                                  ))}
                                </dl>
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
                    colSpan={4}
                    className="h-24 text-center italic text-muted-foreground"
                  >
                    No matching audit entries.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination footer: range + Prev/Next driven by the envelope's has_more/offset. */}
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {from} to {to} of {total}
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
