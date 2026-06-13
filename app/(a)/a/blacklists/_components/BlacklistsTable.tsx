"use client";

// ── BlacklistsTable - the shared AFC blacklist oversight surface ──────────────
// Extracted VERBATIM from app/(a)/a/blacklists/page.tsx (owner ask 2026-06-13:
// "add a blacklists tab and column under both teams & players page") so the SAME
// page header + stat cards + filter toolbar + table + pagination render in two
// places:
//   1. the standalone dashboard at /a/blacklists (that page now just returns this
//      component - behaviour and markup unchanged, including the FullLoader
//      swallowing the header on first load), and
//   2. the new "Blacklists" tab on the combined Teams & Players page
//      (app/(a)/a/teams/page.tsx). Carrying its own PageHeader matches how the
//      Teams and Players tabs each keep their own header.
//
// Lists EVERY organizer blacklist across ALL organizations - reasons included
// (admins see everything; organizers only ever get counts via the lookup on their
// own portal). Four stat cards (total / active / top org / most-blacklisted team),
// a filter toolbar (search + status + date window), and a compact text-xs table
// with server-side pagination.
//
// Data: GET /organizers/admin/blacklists/ (afc_organizers/views_blacklist_lookup.py
// :: admin_list_blacklists) via organizersApi.adminListBlacklists. The endpoint is
// platform-admin gated server-side (head_admin / organizer_admin); the sidebar entry
// in constants/nav-links.ts is gated to the same roles. Aggregates are computed over
// the FILTERED set, so the stat cards answer "in this window / for this search".
//
// Mirrors the sibling admin queue idiom (app/(a)/a/organizations/reports/page.tsx):
// Select filter, shadcn Table, the shared Pagination component, sonner toasts,
// FullLoader on first load only. StatCard mirrors app/(a)/a/rankings/page.tsx.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  IconBan,
  IconBuilding,
  IconFlag,
  IconUsersGroup,
} from "@tabler/icons-react";
import { ITEMS_PER_PAGE } from "@/constants";
import { cn, formatDate } from "@/lib/utils";
import { organizersApi } from "@/lib/organizers";

// ── Row + aggregate shapes (mirror admin_list_blacklists' serializer) ─────────
// lifted_by_username/lifted_at come from an APPROVED team-scope lift request when one
// exists; a direct organizer lift leaves no record, so they can be null even on a
// "lifted" row (the backend documents this) - the table then just shows the pill.
interface BlacklistRow {
  id: number;
  organization_name: string | null;
  organization_slug: string | null;
  team_name: string | null;
  team_id: number;
  reason: string;
  status: "active" | "expired" | "lifted" | string;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  lifted_by_username: string | null;
  lifted_at: string | null;
  player_snapshot_count: number;
}

interface Aggregates {
  total: number;
  active: number;
  by_organization: {
    organization_name: string | null;
    organization_slug: string | null;
    count: number;
  }[];
  most_blacklisted_teams: {
    team_name: string | null;
    team_id: number;
    count: number;
  }[];
}

// The three EFFECTIVE statuses the backend filter understands ("active" = blocking
// right now; "expired" includes lapsed rows no sweep has relabelled; see the view).
const STATUSES = ["active", "expired", "lifted"] as const;

// ── Status badge (same visual language as the organizer Blacklists page) ──────
// Outline rounded-full text-xs per AFC constants: green while the block is live,
// muted once it is over (expired or lifted).
function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2 py-0.5 text-xs capitalize",
        isActive
          ? "border-green-500 text-green-600"
          : "border-muted-foreground/40 text-muted-foreground",
      )}
    >
      {status}
    </Badge>
  );
}

// ── StatCard (mirrors app/(a)/a/rankings/page.tsx) ────────────────────────────
function StatCard({
  icon,
  title,
  value,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card className="gap-1">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="truncate text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function BlacklistsTable() {
  const [rows, setRows] = useState<BlacklistRow[]>([]);
  const [aggregates, setAggregates] = useState<Aggregates | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // ── Filters: search (debounced), effective status, and a date window ──────
  const [search, setSearch] = useState("");
  // debouncedSearch is what actually hits the server; `search` tracks keystrokes.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState(""); // "" = open-ended window
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  // 300ms debounce on the search box so we do not refetch per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Server-side fetch (filters + limit/offset paging) ──────────────────────
  // page is 1-indexed; offset = (page - 1) * ITEMS_PER_PAGE. The endpoint returns
  // { results, total_count, has_more, aggregates }; aggregates follow the filters,
  // so the stat cards update with the toolbar.
  const fetchBlacklists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await organizersApi.adminListBlacklists({
        search: debouncedSearch || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        start: startDate || undefined,
        end: endDate || undefined,
        limit: ITEMS_PER_PAGE,
        offset: (page - 1) * ITEMS_PER_PAGE,
      });
      setRows(res?.results ?? []);
      setTotalCount(res?.total_count ?? 0);
      setAggregates(res?.aggregates ?? null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load blacklists.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, startDate, endDate, page]);

  useEffect(() => {
    fetchBlacklists();
  }, [fetchBlacklists]);

  // Reset to page 1 whenever a filter changes (avoids landing on a stale offset).
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  // Top entries for the two "leader" stat cards (may be absent while loading).
  const topOrg = aggregates?.by_organization?.[0];
  const topTeam = aggregates?.most_blacklisted_teams?.[0];

  // page-number list for the Pagination control (1 ... current±1 ... last) -
  // same reducer the org-reports admin page uses.
  const pageNumbers = useMemo(
    () =>
      Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
        .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
          if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
          acc.push(p);
          return acc;
        }, []),
    [totalPages, page],
  );

  // First load only - keep everything on-screen during filter/page refetches.
  if (loading && rows.length === 0 && !aggregates) return <FullLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Blacklists"
        description="Every organizer blacklist across all organizations: how many times, by whom, and why."
      />

      {/* ── Stat cards (follow the active filters; aggregates are filtered server-side). ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<IconBan className="size-4" />}
          title="Total blacklists"
          value={aggregates?.total ?? 0}
        />
        <StatCard
          icon={<IconFlag className="size-4" />}
          title="Active now"
          value={aggregates?.active ?? 0}
          sub="Currently blocking registrations"
        />
        <StatCard
          icon={<IconBuilding className="size-4" />}
          title="Top organization"
          value={topOrg?.organization_name ?? "-"}
          sub={topOrg ? `${topOrg.count} blacklist${topOrg.count === 1 ? "" : "s"} issued` : undefined}
        />
        <StatCard
          icon={<IconUsersGroup className="size-4" />}
          title="Most blacklisted team"
          value={topTeam?.team_name ?? "-"}
          sub={topTeam ? `${topTeam.count} time${topTeam.count === 1 ? "" : "s"}` : undefined}
        />
      </div>

      {/* ── Filter toolbar: search + status + date window. ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="bl-search">Search</Label>
          <Input
            id="bl-search"
            placeholder="Search by team or organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Date window on each blacklist's START date; either side optional. */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="bl-from">From</Label>
          <Input
            id="bl-from"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bl-to">To</Label>
          <Input
            id="bl-to"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* ── Table + pagination. ── */}
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {debouncedSearch || statusFilter !== "all" || startDate || endDate
              ? "No blacklists match these filters."
              : "No organizer blacklists yet."}
          </CardContent>
        </Card>
      ) : (
        <Card className="pt-2">
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-foreground">Organization</TableHead>
                    <TableHead className="text-foreground">Team</TableHead>
                    <TableHead className="text-foreground">Reason</TableHead>
                    <TableHead className="text-foreground">Status</TableHead>
                    <TableHead className="text-foreground">Start</TableHead>
                    <TableHead className="text-foreground">End</TableHead>
                    <TableHead className="text-foreground">Lifted</TableHead>
                    <TableHead className="text-right text-foreground">Players</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs font-medium">
                        {row.organization_name ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.team_name ?? `Team #${row.team_id}`}
                      </TableCell>
                      {/* The "why" - admins see it in full (organizers never do). */}
                      <TableCell className="max-w-[18rem] text-xs text-muted-foreground">
                        <span className="line-clamp-2">{row.reason || "-"}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.start_date ? formatDate(row.start_date) : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.end_date ? formatDate(row.end_date) : "-"}
                      </TableCell>
                      {/* Lift provenance: who approved the lift + when, when a lift
                          request exists; a direct organizer lift shows just the pill. */}
                      <TableCell className="text-xs text-muted-foreground">
                        {row.status === "lifted"
                          ? row.lifted_by_username
                            ? `${row.lifted_by_username}${row.lifted_at ? ` on ${formatDate(row.lifted_at)}` : ""}`
                            : "By organizer"
                          : "-"}
                      </TableCell>
                      {/* Snapshot size: how many players this blacklist binds. */}
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {row.player_snapshot_count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * ITEMS_PER_PAGE + 1}-
                  {Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount}
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-disabled={page === 1}
                        className={
                          page === 1
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                    {pageNumbers.map((p, idx) =>
                      p === "ellipsis" ? (
                        <PaginationItem key={`ellipsis-${idx}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={p}>
                          <PaginationLink
                            isActive={page === p}
                            onClick={() => setPage(p as number)}
                            className="cursor-pointer"
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        aria-disabled={page === totalPages}
                        className={
                          page === totalPages
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
