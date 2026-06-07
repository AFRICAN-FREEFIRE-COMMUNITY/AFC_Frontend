"use client";

// ── Admin · Org Reports (review queue) ───────────────────────────────────────
// AFC's review queue for user-submitted reports AGAINST organizations (suspected
// rankings manipulation, fake results, unfair conduct, …). Lists EVERY report
// across all organizations (afc_organizers admin API), with a status filter +
// server-side pagination, and a per-row dialog to move a report through its
// lifecycle (open → reviewing → resolved/dismissed), attach resolution notes, and
// - the integrity action - optionally exclude the reported event from rankings.
//
// Mirrors the sibling Design Requests queue idiom
// (app/(a)/a/organizations/design-requests/page.tsx): PageHeader, a status Select
// filter, a shadcn Table, the shared Pagination component, a per-row Dialog, and
// sonner toasts. Paginates SERVER-side because adminListReports hands back
// { results, total_count, has_more }, exactly like adminListDesignRequests.
//
// Static segment under /a/organizations/ - Next.js matches this before the sibling
// [slug] dynamic route, so /a/organizations/reports lands here.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ITEMS_PER_PAGE } from "@/constants";
import { formatDate } from "@/lib/utils";
import { organizersApi } from "@/lib/organizers";
import { InfoTip } from "@/components/ui/info-tip";
import { OrgSubNav } from "../_components/OrgSubNav";

// ── Row shape (mirrors the admin OrganizationReport serializer) ──────────────
// organization_name / reporter_username / event_name are joined fields the admin
// list endpoint denormalises onto each row so this page never re-fetches the FKs.
// event_id is what drives the "exclude_event" toggle - null when the report isn't
// tied to a specific event (then exclusion isn't offered).
interface ReportRow {
  id: number;
  organization_id: number;
  organization_name: string;
  category: string;
  details: string | null;
  evidence: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  resolution_notes: string | null;
  reporter_username: string | null;
  event_id: number | null;
  event_name: string | null;
  created_at: string;
}

// The four lifecycle statuses. Kept as a const array so the filter Select and the
// update Select iterate the same source of truth (matches OrganizationReport.STATUS_CHOICES).
const STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;
type Status = (typeof STATUSES)[number];

// human labels for each status (snake_case → Title Case).
const STATUS_LABELS: Record<Status, string> = {
  open: "Open",
  reviewing: "Reviewing",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

// human labels for the report categories (matches OrganizationReport.CATEGORY_CHOICES).
// Falls back to the raw value for any category the backend adds later.
const CATEGORY_LABELS: Record<string, string> = {
  rankings_manipulation: "Rankings manipulation",
  fake_results: "Fake / falsified results",
  unfair_conduct: "Unfair conduct",
  other: "Other",
};

// ── Status badge ──────────────────────────────────────────────────────────────
// Outline badge per AFC constants, colour-coded per the brief: open=red/gold (it's
// an unhandled integrity report - make it loud), reviewing=blue, resolved=green,
// dismissed=muted.
function StatusBadge({ status }: { status: string }) {
  const colour: Record<string, string> = {
    open: "border-red-500/60 text-gold", // red border + gold text: an open, unhandled report
    reviewing: "border-blue-500/50 text-blue-400",
    resolved: "border-green-600/60 text-green-400",
    dismissed: "text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={colour[status] ?? ""}>
      {STATUS_LABELS[status as Status] ?? status}
    </Badge>
  );
}

export default function OrgReportsAdminPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // "all" = no status filter; otherwise one of STATUSES.
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  // ── Resolve dialog state ──────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<ReportRow | null>(null);
  const [editStatus, setEditStatus] = useState<Status>("open");
  const [editNotes, setEditNotes] = useState("");
  // excludeEvent → sends exclude_event:true on save (the integrity action that
  // unverifies the reported event for rankings). Only meaningful when the report
  // is tied to an event; reset to false every time the dialog opens.
  const [excludeEvent, setExcludeEvent] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Server-side fetch (status filter + limit/offset paging) ────────────────
  // page is 1-indexed; offset = (page - 1) * ITEMS_PER_PAGE. The endpoint returns
  // { results, total_count, has_more }, so we drive paging off total_count.
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await organizersApi.adminListReports({
        status: statusFilter !== "all" ? statusFilter : undefined,
        limit: ITEMS_PER_PAGE,
        offset: (page - 1) * ITEMS_PER_PAGE,
      });
      setRows(res?.results ?? []);
      setTotalCount(res?.total_count ?? 0);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Reset to page 1 when the filter changes so we don't land on an out-of-range offset.
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  // Open the resolve dialog seeded with the row's current status + notes. The
  // exclude-event checkbox always starts unchecked - it's an explicit per-resolution
  // action, never a remembered state.
  const openEdit = (row: ReportRow) => {
    setEditTarget(row);
    setEditStatus(row.status);
    setEditNotes(row.resolution_notes ?? "");
    setExcludeEvent(false);
  };

  // ── Save the status + resolution_notes (+ optional event exclusion). ──
  // Only send exclude_event:true when the box is checked AND the report actually has
  // an event - guards against sending the integrity flag for an eventless report.
  const handleSave = async () => {
    if (!editTarget || saving) return;
    setSaving(true);
    try {
      const body: Record<string, any> = {
        status: editStatus,
        resolution_notes: editNotes.trim(),
      };
      if (excludeEvent && editTarget.event_id) {
        body.exclude_event = true;
      }
      await organizersApi.adminUpdateReport(editTarget.id, body);
      toast.success("Report updated.");
      setEditTarget(null);
      fetchReports();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update report.");
    } finally {
      setSaving(false);
    }
  };

  // page-number list for the Pagination control (1 … current±1 … last).
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

  // first load only - keep the table on-screen during filter/page refetches.
  if (loading && rows.length === 0) return <FullLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        title={
          <span className="inline-flex items-center">
            Org Reports
            <InfoTip id="organizations.reports._page" className="ml-1.5" />
          </span>
        }
        description={`${totalCount} report${totalCount !== 1 ? "s" : ""}`}
      />

      {/* Organizations sub-nav: Organizations / Design Requests / Org Reports. */}
      <OrgSubNav />

      {/* Status filter - server refetch on change (matches the design-requests UX). */}
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {statusFilter !== "all"
              ? "No reports with this status."
              : "No reports yet."}
          </CardContent>
        </Card>
      ) : (
        <Card className="pt-2">
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.organization_name}
                      </TableCell>
                      {/* Category + the reporter's details inline (muted) so the gist
                          reads at a glance without opening the dialog. */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {CATEGORY_LABELS[row.category] ?? row.category}
                          {row.details && (
                            <span className="text-xs text-muted-foreground line-clamp-2">
                              {row.details}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.reporter_username || "-"}
                      </TableCell>
                      {/* Event - "-" when the report isn't tied to a specific event. */}
                      <TableCell className="text-muted-foreground">
                        {row.event_name || "-"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.created_at ? formatDate(row.created_at) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(row)}
                          >
                            Resolve
                          </Button>
                          {/* ⓘ explains the resolve lifecycle + optional event exclusion (sibling of the button). */}
                          <InfoTip id="organizations.reports.resolve" />
                        </div>
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

      {/* ── Resolve dialog - update status + resolution notes + event exclusion ── */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve report</DialogTitle>
            <DialogDescription>
              {editTarget
                ? `${editTarget.organization_name} - ${
                    CATEGORY_LABELS[editTarget.category] ?? editTarget.category
                  }`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Reporter + event context (read-only) so the reviewer has the facts. */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground">
                Reporter:{" "}
                <span className="text-foreground">
                  {editTarget?.reporter_username || "-"}
                </span>
              </span>
              <span className="text-muted-foreground">
                Event:{" "}
                <span className="text-foreground">
                  {editTarget?.event_name || "-"}
                </span>
              </span>
            </div>

            {/* The reporter's written details (read-only context for the reviewer). */}
            {editTarget?.details && (
              <div className="space-y-1">
                <Label>Details</Label>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {editTarget.details}
                </p>
              </div>
            )}

            {/* Evidence image (read-only) - shown when the reporter attached one. */}
            {editTarget?.evidence && (
              <div className="space-y-2">
                <Label>Evidence</Label>
                <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
                  {/* Reporter-supplied evidence comes from arbitrary upload hosts - plain <img>. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={editTarget.evidence}
                    alt="Report evidence"
                    className="size-full object-contain"
                  />
                </div>
              </div>
            )}

            {/* Status. */}
            <div className="space-y-2">
              <Label htmlFor="report-status">
                Status
                <InfoTip id="organizations.reports.status" className="ml-1" />
              </Label>
              <Select
                value={editStatus}
                onValueChange={(v) => setEditStatus(v as Status)}
              >
                <SelectTrigger id="report-status" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Resolution notes - the internal record of how the report was handled. */}
            <div className="space-y-2">
              <Label htmlFor="report-resolution">
                Resolution notes{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="report-resolution"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="What was found, and what action was taken..."
                rows={4}
              />
            </div>

            {/* Integrity action - exclude the reported event from rankings. Only enabled
                when the report is tied to an event; otherwise it's nothing to act on. */}
            <div className="flex items-start gap-2">
              <Checkbox
                id="report-exclude-event"
                checked={excludeEvent}
                onCheckedChange={(v) => setExcludeEvent(v === true)}
                disabled={!editTarget?.event_id}
              />
              <div className="grid gap-1 leading-none">
                <Label
                  htmlFor="report-exclude-event"
                  className={
                    !editTarget?.event_id ? "text-muted-foreground" : undefined
                  }
                >
                  Also exclude the reported event from rankings
                  <InfoTip id="organizations.reports.exclude_event" className="ml-1" />
                </Label>
                <p className="text-xs text-muted-foreground">
                  {editTarget?.event_id
                    ? "Unverifies the reported event so it no longer counts toward rankings."
                    : "This report isn't tied to a specific event."}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={handleSave}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
