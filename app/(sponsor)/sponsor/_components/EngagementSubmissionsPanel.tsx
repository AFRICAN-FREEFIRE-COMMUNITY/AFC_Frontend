"use client";

// ── EngagementSubmissionsPanel ────────────────────────────────────────────────
// The sponsor portal's PER-ENGAGEMENT submission tables + approval queue
// (sponsor-system redesign P3/P4, owner-approved mockup:
// public/_sponsor_system_preview.html view 1 -> "Dynasty Cup Nigeria" drill-down).
//
// WHAT IT RENDERS, top to bottom (mirrors the mockup exactly):
//   1. Header card: event name + status badge + a gold "requires your approval"
//      badge (when the sponsorship's approval gate is on) + the privacy line +
//      Export CSV (scoped to the active tab + status filter).
//   2. Pill tabs: one "All" tab + one tab per configured engagement entry
//      (label = the engagement's label, e.g. "ydpay UID", "WhatsApp group").
//      Pending-count chips ride on the tabs when requires_approval.
//   3. Toolbar: search input (client-side, over the loaded page) + status
//      filter Select (All / Pending / Approved / Rejected, server-side param).
//   4. The submissions table: Username | (Engagement, All tab only) | Value |
//      Status (light pill; rejected carries the reason as a title) | Actions.
//      Actions per approval_status:
//        pending      -> h-7 outline Confirm (approve) + Reject (reason dialog)
//        approved     -> "Confirmed by you" + Undo (when can_undo)
//        rejected     -> "Rejected: <full reason>" + Undo (when can_undo)
//        not_required -> value only (no decision surface)
//   5. Footer: "Showing x-y of z" + pagination (SERVER offset paging via the
//      endpoint's limit/offset params, same Pagination idiom as the legacy
//      sponsor dashboard).
//   6. Reject dialog: REQUIRED reason textarea (the reason rides in the
//      player's rejection email + in-app notification) + an extra "Also remove
//      from the event" checkbox that switches the action to reject_final
//      (frees the player's slot; button relabels to "Reject and remove" and
//      asks for an explicit confirm before firing).
//
// HOW IT CONNECTS:
//   - Rendered by ScopedSponsorDashboard.tsx (same folder) inside the event
//     drill-down, ONLY when the event's sponsorship has engagements configured
//     (engagements written by the P2 wizard builder). Events without
//     engagements keep the legacy submissions table in the parent.
//   - Data: sponsorsApi.engagementSubmissions / decideSubmission /
//     engagementSubmissionsCsv (lib/sponsors.ts -> afc_sponsors engagement
//     endpoints). The parent fetches page 1 (All tab, no status filter) and
//     hands it down as `initial` so this panel never double-fetches on mount.
//   - A rejected player resubmits via sponsorsApi.resubmitSubmission on their
//     side; the corrected row returns to THIS pending queue.
//
// Design parity: light pill badges (pending bg-yellow-100 / approved green /
// rejected red), h-7 outline action buttons, Card p-0 table, showing-x-of-y +
// Pagination footer - all lifted verbatim from the legacy sponsor dashboard
// per the owner's design-parity feedback.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ITEMS_PER_PAGE } from "@/constants";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import {
  sponsorsApi,
  type EngagementSubmissionRow,
  type SponsorEngagement,
  type SponsorEventRow,
  type SponsorRow,
} from "@/lib/sponsors";
import {
  IconArrowBackUp,
  IconCheck,
  IconDownload,
  IconLoader2,
  IconSearch,
  IconX,
} from "@tabler/icons-react";

// ── shared shapes + constants ─────────────────────────────────────────────────

// One page from GET sponsors/<id>/events/<event_id>/engagement-submissions/.
// Defined HERE (not in lib/sponsors.ts, which stays untouched) and imported by
// ScopedSponsorDashboard for its probe fetch, so both files agree on the shape.
export interface EngagementSubmissionsPayload {
  event: { event_id: number; event_name: string };
  engagements: SponsorEngagement[];
  requires_approval: boolean;
  results: EngagementSubmissionRow[];
  total_count: number;
  has_more: boolean;
  next_offset: number | null;
}

// Server page size. Exported so the parent's initial (page 1) fetch uses the
// exact same limit and the seed response lines up with this panel's paging.
export const ENGAGEMENT_PAGE_SIZE = ITEMS_PER_PAGE;

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type DecideAction = "approve" | "reject" | "reject_final" | "undo";

// ── small helpers ─────────────────────────────────────────────────────────────

// Tab label for one engagement entry. Falls back from the configured label to a
// type-derived name (the wizard's collect_id entries always carry a label, e.g.
// "ydpay UID"; join_group derives from its platform, e.g. "WhatsApp group").
function engagementTabLabel(e: SponsorEngagement): string {
  if (e.label) return e.label;
  switch (e.type) {
    case "collect_id":
      return "Collect id";
    case "follow_social":
      return e.platform ? `Follow ${e.platform}` : "Follow socials";
    case "create_account":
      return "Create account";
    case "join_group":
      if (e.platform === "whatsapp") return "WhatsApp group";
      if (e.platform === "discord") return "Discord group";
      return "Join group";
    default:
      return "Engagement";
  }
}

// Filename-safe slug for the CSV download (e.g. "ydpay UID" -> "ydpay-uid").
function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "all";
}

// Pull a useful message off an axios error without inventing backend shapes.
function errorMessage(err: unknown, fallback: string): string {
  const data = (err as any)?.response?.data;
  return data?.error || data?.detail || data?.message || fallback;
}

// The legacy dashboard's light pill StatusBadge, mapped onto approval_status.
// not_required rows show no pill (there is nothing to decide on them).
function ApprovalPill({ row }: { row: EngagementSubmissionRow }) {
  if (row.approval_status === "not_required") {
    return <span className="text-xs text-muted-foreground">-</span>;
  }
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span
      // Rejected pills carry the full reason as a hover title; the Actions
      // column also prints it in full (owner: never collapse to a bare state).
      title={row.approval_status === "rejected" && row.reason ? row.reason : undefined}
      className={cn(
        "px-2 py-0.5 rounded-full text-xs font-medium capitalize",
        map[row.approval_status],
      )}
    >
      {row.approval_status}
    </span>
  );
}

// ── reject dialog state ───────────────────────────────────────────────────────

interface RejectDialogState {
  open: boolean;
  row: EngagementSubmissionRow | null;
  reason: string;
  // true -> the decision fires as reject_final (also frees the player's slot)
  removeFromEvent: boolean;
  loading: boolean;
}

const CLOSED_REJECT_DIALOG: RejectDialogState = {
  open: false,
  row: null,
  reason: "",
  removeFromEvent: false,
  loading: false,
};

// ── panel ─────────────────────────────────────────────────────────────────────

export function EngagementSubmissionsPanel({
  sponsor,
  event,
  initial,
}: {
  sponsor: SponsorRow;
  event: SponsorEventRow;
  initial: EngagementSubmissionsPayload;
}) {
  // The engagement list never changes while the drill-down is open (config is
  // wizard-side), so the tabs render from the seed payload.
  const engagements = initial.engagements;
  const requiresApproval = initial.requires_approval;

  // "all" or the engagement index as a string (the endpoint's `engagement`
  // param is the entry's index in the sponsorship's engagements array, which
  // is also each row's engagement_index).
  const [activeTab, setActiveTab] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Current server page. Seeded with the parent's page-1 fetch (All tab, no
  // status filter, offset 0) so mount costs zero extra requests.
  const [data, setData] = useState<EngagementSubmissionsPayload>(initial);
  const [loading, setLoading] = useState(false);

  // Per-engagement pending counts for the tab chips (index-aligned with
  // `engagements`; the All chip is their sum). Only fetched when the approval
  // gate is on - without it nothing is ever pending.
  const [pendingCounts, setPendingCounts] = useState<number[]>([]);

  // In-flight decide actions, keyed by submission id (per-row spinner +
  // disable, same Map idiom as the legacy dashboard).
  const [acting, setActing] = useState<Map<number, DecideAction>>(new Map());

  const [rejectDialog, setRejectDialog] = useState<RejectDialogState>(CLOSED_REJECT_DIALOG);

  // ── data loading (server offset paging) ─────────────────────────────────────

  // Monotonic sequence guard: a stale response (user clicked tabs fast) must
  // never clobber a newer page.
  const fetchSeq = useRef(0);

  const loadPage = useCallback(
    async (tab: string, status: StatusFilter, pg: number) => {
      const mySeq = ++fetchSeq.current;
      setLoading(true);
      try {
        const res = await sponsorsApi.engagementSubmissions(sponsor.id, event.event_id, {
          ...(tab !== "all" ? { engagement: Number(tab) } : {}),
          ...(status !== "all" ? { status } : {}),
          limit: ENGAGEMENT_PAGE_SIZE,
          offset: (pg - 1) * ENGAGEMENT_PAGE_SIZE,
        });
        if (fetchSeq.current !== mySeq) return; // a newer fetch superseded this one
        setData(res);
        // Deciding the last row of a trailing page (e.g. approving the only
        // pending row on page 2 of the Pending filter) can leave us past the
        // end; step back one page and let the effect refetch.
        if (res.results.length === 0 && pg > 1 && res.total_count > 0) {
          setPage(pg - 1);
        }
      } catch (err) {
        if (fetchSeq.current === mySeq) {
          toast.error(errorMessage(err, "Failed to load submissions."));
        }
      } finally {
        if (fetchSeq.current === mySeq) setLoading(false);
      }
    },
    [sponsor.id, event.event_id],
  );

  // Refetch whenever the tab / status filter / page changes. The very first
  // run is skipped: the parent already fetched page 1 and seeded `data`.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    loadPage(activeTab, statusFilter, page);
  }, [activeTab, statusFilter, page, loadPage]);

  // ── pending-count chips ──────────────────────────────────────────────────────

  const refreshPendingCounts = useCallback(async () => {
    if (!requiresApproval || engagements.length === 0) return;
    try {
      // One limit-1 probe per engagement: total_count is all we need. Sponsor
      // configs carry a handful of engagements, so this stays cheap.
      const counts = await Promise.all(
        engagements.map((_, i) =>
          sponsorsApi
            .engagementSubmissions(sponsor.id, event.event_id, {
              engagement: i,
              status: "pending",
              limit: 1,
            })
            .then((r) => r.total_count),
        ),
      );
      setPendingCounts(counts);
    } catch {
      // Chips are decorative; a count failure must never block the table.
    }
  }, [requiresApproval, engagements, sponsor.id, event.event_id]);

  useEffect(() => {
    refreshPendingCounts();
  }, [refreshPendingCounts]);

  const totalPending = useMemo(
    () => pendingCounts.reduce((sum, n) => sum + n, 0),
    [pendingCounts],
  );

  // ── decisions (P4 approval queue) ────────────────────────────────────────────

  // Fire one decide call, toast the outcome, then refetch the current page +
  // the pending chips so the table always reflects the server's truth.
  // Returns true on success (the reject dialog closes only then).
  const decide = useCallback(
    async (row: EngagementSubmissionRow, action: DecideAction, reason?: string) => {
      setActing((prev) => new Map(prev).set(row.id, action));
      try {
        await sponsorsApi.decideSubmission(row.id, action, reason);
        if (action === "approve") {
          toast.success(`${row.username} confirmed.`);
        } else if (action === "reject") {
          toast.success(
            `${row.username} rejected. They get a notification with your reason and a prompt to re-enter the value.`,
          );
        } else if (action === "reject_final") {
          toast.success(`${row.username} rejected and removed from the event.`);
        } else {
          toast.success(`Decision undone for ${row.username}.`);
        }
        await loadPage(activeTab, statusFilter, page);
        refreshPendingCounts();
        return true;
      } catch (err) {
        toast.error(errorMessage(err, `Failed to update ${row.username}.`));
        return false;
      } finally {
        setActing((prev) => {
          const next = new Map(prev);
          next.delete(row.id);
          return next;
        });
      }
    },
    [activeTab, statusFilter, page, loadPage, refreshPendingCounts],
  );

  const openRejectDialog = (row: EngagementSubmissionRow) => {
    setRejectDialog({ open: true, row, reason: "", removeFromEvent: false, loading: false });
  };

  const handleRejectConfirm = async () => {
    const { row, reason, removeFromEvent } = rejectDialog;
    if (!row) return;
    // Reason is REQUIRED here (unlike the legacy dialog): it rides in the
    // player's rejection email + in-app notification.
    if (!reason.trim()) {
      toast.error("A reason is required. It is sent to the player.");
      return;
    }
    // reject_final frees the player's slot in the event; demand an explicit
    // confirm on top of the checkbox before firing it.
    if (
      removeFromEvent &&
      !window.confirm(
        `Reject and REMOVE ${row.username} from ${event.event_name}? This frees their slot in the event.`,
      )
    ) {
      return;
    }
    setRejectDialog((prev) => ({ ...prev, loading: true }));
    const ok = await decide(row, removeFromEvent ? "reject_final" : "reject", reason.trim());
    if (ok) {
      setRejectDialog(CLOSED_REJECT_DIALOG);
    } else {
      setRejectDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // ── CSV export (scoped to the active tab + status filter) ───────────────────

  const exportCsv = () => {
    const tabLabel =
      activeTab === "all" ? "all" : engagementTabLabel(engagements[Number(activeTab)]);
    const statusSuffix = statusFilter === "all" ? "" : `-${statusFilter}`;
    sponsorsApi
      .engagementSubmissionsCsv(
        sponsor.id,
        event.event_id,
        `${sponsor.slug}-${event.slug || event.event_id}-${slugify(tabLabel)}${statusSuffix}.csv`,
        {
          ...(activeTab !== "all" ? { engagement: Number(activeTab) } : {}),
          ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        },
      )
      .catch(() => toast.error("CSV export failed."));
  };

  // ── client-side search over the loaded page ─────────────────────────────────
  // The endpoint has no search param, so (like every list page) the shared
  // matchesSearch helper narrows the rows of the CURRENT server page only.
  const filtered = useMemo(() => {
    if (!search.trim()) return data.results;
    return data.results.filter((r) =>
      matchesSearch([r.username, r.value, r.engagement_label], search),
    );
  }, [data.results, search]);

  // ── paging numbers (server totals, mockup's "Showing x-y of z") ─────────────

  const totalPages = Math.max(1, Math.ceil(data.total_count / ENGAGEMENT_PAGE_SIZE));
  const showingStart = data.total_count === 0 ? 0 : (page - 1) * ENGAGEMENT_PAGE_SIZE + 1;
  const showingEnd = (page - 1) * ENGAGEMENT_PAGE_SIZE + data.results.length;

  // Tab / filter changes restart paging at 1 (offset 0).
  const changeTab = (tab: string) => {
    setActiveTab(tab);
    setPage(1);
  };
  const changeStatus = (v: string) => {
    setStatusFilter(v as StatusFilter);
    setPage(1);
  };

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      {/* Header card: event + badges + privacy line + scoped Export CSV (mockup). */}
      <Card className="py-4">
        <CardContent className="px-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold flex items-center gap-2 flex-wrap">
              {event.event_name}
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs capitalize text-blue-400 border-blue-400/50">
                {event.event_status}
              </Badge>
              {requiresApproval && (
                <Badge
                  variant="outline"
                  className="rounded-full border-gold px-2 py-0.5 text-xs"
                  style={{ color: "var(--gold)" }}
                >
                  requires your approval
                </Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              You see usernames + the values registrants gave {sponsor.name}. AFC never shares
              account emails or phone numbers.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <IconDownload className="size-4" /> Export CSV
          </Button>
        </CardContent>
      </Card>

      {/* Pill tabs: All + one per engagement entry, pending chips when gated. */}
      <Tabs value={activeTab} onValueChange={changeTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">
            All
            {requiresApproval && totalPending > 0 && (
              <span className="ml-1 rounded-full bg-yellow-100 text-yellow-700 px-1.5 text-[10px] font-semibold">
                {totalPending}
              </span>
            )}
          </TabsTrigger>
          {engagements.map((e, i) => (
            <TabsTrigger key={i} value={String(i)}>
              {engagementTabLabel(e)}
              {requiresApproval && (pendingCounts[i] ?? 0) > 0 && (
                <span className="ml-1 rounded-full bg-yellow-100 text-yellow-700 px-1.5 text-[10px] font-semibold">
                  {pendingCounts[i]}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Toolbar: search (current page) + server-side status filter. */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by username or submitted value..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <IconX className="size-4" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={changeStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table (Card p-0 idiom). Subsequent page loads dim instead of unmounting. */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {loading ? (
              <span className="inline-flex items-center gap-2 text-sm">
                <IconLoader2 className="size-5 animate-spin" /> Loading submissions...
              </span>
            ) : data.results.length === 0 ? (
              "No submissions here yet."
            ) : (
              "No results match your search on this page."
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="pt-2">
          <CardContent className={cn("p-0", loading && "opacity-60 pointer-events-none")}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    {/* The All tab mixes engagements, so name each row's source. */}
                    {activeTab === "all" && <TableHead>Engagement</TableHead>}
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const rowAction = acting.get(r.id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.username}</TableCell>
                        {activeTab === "all" && (
                          <TableCell className="text-xs text-muted-foreground">
                            {r.engagement_label}
                          </TableCell>
                        )}
                        <TableCell>
                          {r.value ? (
                            r.value
                          ) : (
                            <span className="text-muted-foreground italic text-xs">
                              Not provided
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ApprovalPill row={r} />
                        </TableCell>
                        <TableCell className="text-right">
                          {/* ── actions per approval_status (P4 queue) ── */}
                          {r.approval_status === "pending" ? (
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-200 hover:bg-green-50 h-7 text-xs"
                                disabled={!!rowAction}
                                onClick={() => decide(r, "approve")}
                              >
                                {rowAction === "approve" ? (
                                  <IconLoader2 className="size-3 animate-spin" />
                                ) : (
                                  <IconCheck className="size-3" />
                                )}
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs"
                                disabled={!!rowAction}
                                onClick={() => openRejectDialog(r)}
                              >
                                {rowAction === "reject" || rowAction === "reject_final" ? (
                                  <IconLoader2 className="size-3 animate-spin" />
                                ) : (
                                  <IconX className="size-3" />
                                )}
                                Reject
                              </Button>
                            </div>
                          ) : r.approval_status === "approved" ? (
                            // Owner feedback: decided rows show WHAT was decided.
                            <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                              <span>
                                <b className="text-foreground font-semibold">Confirmed</b> by you
                              </span>
                              {r.can_undo && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-muted-foreground hover:text-foreground h-7 text-xs"
                                  disabled={!!rowAction}
                                  onClick={() => decide(r, "undo")}
                                >
                                  {rowAction === "undo" ? (
                                    <IconLoader2 className="size-3 animate-spin" />
                                  ) : (
                                    <IconArrowBackUp className="size-3" />
                                  )}
                                  Undo
                                </Button>
                              )}
                            </div>
                          ) : r.approval_status === "rejected" ? (
                            <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                              <span className="max-w-[260px] text-right">
                                <b className="text-foreground font-semibold">Rejected:</b>{" "}
                                {r.reason || "no reason"}
                              </span>
                              {r.can_undo && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-muted-foreground hover:text-foreground h-7 text-xs"
                                  disabled={!!rowAction}
                                  onClick={() => decide(r, "undo")}
                                >
                                  {rowAction === "undo" ? (
                                    <IconLoader2 className="size-3 animate-spin" />
                                  ) : (
                                    <IconArrowBackUp className="size-3" />
                                  )}
                                  Undo
                                </Button>
                              )}
                            </div>
                          ) : (
                            // not_required: nothing to decide, the value stands.
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Footer: server totals + offset pagination (legacy idiom). */}
            <div className="px-4 py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {search.trim()
                  ? `${filtered.length} of ${data.results.length} on this page match your search`
                  : `Showing ${showingStart}-${showingEnd} of ${data.total_count}`}
              </p>
              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-disabled={page === 1}
                        className={
                          page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, idx) =>
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
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hint under the queue (mockup's note line), only when the gate is on. */}
      {requiresApproval && (
        <p className="text-xs text-muted-foreground border border-dashed rounded-md px-3 py-2">
          Rejecting requires a reason. The player gets an email + an in-app notification with
          your reason and a prompt to re-enter the correct value; their resubmission returns
          here as pending.
        </p>
      )}

      {/* ── Reject dialog: REQUIRED reason + optional reject_final ── */}
      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) =>
          !rejectDialog.loading &&
          setRejectDialog((prev) => (open ? { ...prev, open } : CLOSED_REJECT_DIALOG))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject {rejectDialog.row?.username}?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-muted-foreground">
                Reason <span className="text-xs">(required, sent to the player)</span>
              </label>
              <Textarea
                placeholder="e.g. This UID does not exist. Check the app and re-enter it."
                value={rejectDialog.reason}
                onChange={(e) =>
                  setRejectDialog((prev) => ({ ...prev, reason: e.target.value }))
                }
                rows={3}
                disabled={rejectDialog.loading}
              />
            </div>
            {/* reject_final option: frees the slot, so it is opt-in + confirmed. */}
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                className="mt-0.5"
                checked={rejectDialog.removeFromEvent}
                disabled={rejectDialog.loading}
                onCheckedChange={(v) =>
                  setRejectDialog((prev) => ({ ...prev, removeFromEvent: v === true }))
                }
              />
              <span>
                Also remove {rejectDialog.row?.username} from the event
                <span className="block text-xs text-muted-foreground">
                  Frees their slot so another player can register. They cannot resubmit.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={rejectDialog.loading}
              onClick={() => setRejectDialog(CLOSED_REJECT_DIALOG)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejectDialog.loading}
              onClick={handleRejectConfirm}
            >
              {rejectDialog.loading && <IconLoader2 className="size-4 animate-spin mr-2" />}
              {rejectDialog.removeFromEvent ? "Reject and remove" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
