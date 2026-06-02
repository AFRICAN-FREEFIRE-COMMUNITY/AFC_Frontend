"use client";

// ── Admin · Design Requests (review queue) ───────────────────────────────────
// AFC's review queue for organizer leaderboard-design requests. Lists EVERY
// request across all organizations (afc_organizers admin API), with a status
// filter + server-side pagination, and a per-row dialog to move a request
// through its lifecycle (open → in_progress → applied/rejected) and attach
// resolution notes the organizer then sees on their Design page.
//
// Mirrors the admin Organizations list idiom (app/(a)/a/organizations/page.tsx):
// PageHeader, a status Select filter, a shadcn Table, the shared Pagination
// component, and sonner toasts. Paginates SERVER-side because the endpoint hands
// back { results, total_count, has_more }, exactly like adminListOrganizations.
//
// Static segment under /a/organizations/ — Next.js matches this before the
// sibling [slug] dynamic route, so /a/organizations/design-requests lands here.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

// ── Row shape (mirrors the admin design-request serializer) ───────────────────
interface DesignRequestRow {
  id: number;
  organization_id: number;
  organization_name: string;
  title: string;
  notes: string | null;
  reference_image: string | null;
  status: "open" | "in_progress" | "applied" | "rejected";
  resolution_notes: string | null;
  submitted_by_username: string | null;
  handled_by_username: string | null;
  created_at: string;
}

// The four lifecycle statuses. Kept as a const array so the filter Select and the
// update Select iterate the same source of truth.
const STATUSES = ["open", "in_progress", "applied", "rejected"] as const;
type Status = (typeof STATUSES)[number];

// human labels for each status (snake_case → Title Case).
const STATUS_LABELS: Record<Status, string> = {
  open: "Open",
  in_progress: "In progress",
  applied: "Applied",
  rejected: "Rejected",
};

// ── Status badge ──────────────────────────────────────────────────────────────
// Outline badge per AFC constants, colour-coded per the brief: open=muted,
// in_progress=gold, applied=green, rejected=red. (Same mapping as the organizer
// Design page's DesignStatusBadge — kept local here so the admin page has no
// cross-route import into the (organizer) group.)
function StatusBadge({ status }: { status: string }) {
  const colour: Record<string, string> = {
    open: "text-muted-foreground",
    in_progress: "border-yellow-500 text-yellow-600",
    applied: "border-green-600/60 text-green-400",
    rejected: "border-red-500/50 text-red-400",
  };
  return (
    <Badge variant="outline" className={colour[status] ?? ""}>
      {STATUS_LABELS[status as Status] ?? status}
    </Badge>
  );
}

export default function DesignRequestsAdminPage() {
  const [rows, setRows] = useState<DesignRequestRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // "all" = no status filter; otherwise one of STATUSES.
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  // ── Update dialog state ───────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<DesignRequestRow | null>(null);
  const [editStatus, setEditStatus] = useState<Status>("open");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Server-side fetch (status filter + limit/offset paging) ────────────────
  // page is 1-indexed; offset = (page - 1) * ITEMS_PER_PAGE. The endpoint returns
  // { results, total_count, has_more }, so we drive paging off total_count.
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await organizersApi.adminListDesignRequests({
        status: statusFilter !== "all" ? statusFilter : undefined,
        limit: ITEMS_PER_PAGE,
        offset: (page - 1) * ITEMS_PER_PAGE,
      });
      setRows(res?.results ?? []);
      setTotalCount(res?.total_count ?? 0);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to load design requests.",
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Reset to page 1 when the filter changes so we don't land on an out-of-range offset.
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  // Open the update dialog seeded with the row's current status + notes.
  const openEdit = (row: DesignRequestRow) => {
    setEditTarget(row);
    setEditStatus(row.status);
    setEditNotes(row.resolution_notes ?? "");
  };

  // ── Save the status + resolution_notes change. ──
  const handleSave = async () => {
    if (!editTarget || saving) return;
    setSaving(true);
    try {
      await organizersApi.adminUpdateDesignRequest(editTarget.id, {
        status: editStatus,
        resolution_notes: editNotes.trim(),
      });
      toast.success("Design request updated.");
      setEditTarget(null);
      fetchRequests();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to update design request.",
      );
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

  // first load only — keep the table on-screen during filter/page refetches.
  if (loading && rows.length === 0) return <FullLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Design Requests"
        description={`${totalCount} request${totalCount !== 1 ? "s" : ""}`}
      />

      {/* Status filter — server refetch on change (matches the orgs search UX). */}
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
              ? "No design requests with this status."
              : "No design requests yet."}
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
                    <TableHead>Title</TableHead>
                    <TableHead>Submitted by</TableHead>
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
                      {/* Title + the organizer's notes inline (muted) so the brief
                          reads at a glance without opening the dialog. */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {row.title}
                          {row.notes && (
                            <span className="text-xs text-muted-foreground line-clamp-2">
                              {row.notes}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.submitted_by_username || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.created_at ? formatDate(row.created_at) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(row)}
                        >
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * ITEMS_PER_PAGE + 1}–
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

      {/* ── Manage dialog — update status + resolution notes ── */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage design request</DialogTitle>
            <DialogDescription>
              {editTarget
                ? `${editTarget.organization_name} — ${editTarget.title}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Reference image (read-only) — shown when the organizer attached one. */}
            {editTarget?.reference_image && (
              <div className="space-y-2">
                <Label>Reference image</Label>
                <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
                  {/* Org-supplied refs come from arbitrary upload hosts — plain <img>. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={editTarget.reference_image}
                    alt="Organizer reference"
                    className="size-full object-contain"
                  />
                </div>
              </div>
            )}

            {/* Organizer's notes (read-only context for the reviewer). */}
            {editTarget?.notes && (
              <div className="space-y-1">
                <Label>Organizer notes</Label>
                <p className="text-sm text-muted-foreground">
                  {editTarget.notes}
                </p>
              </div>
            )}

            {/* Status. */}
            <div className="space-y-2">
              <Label htmlFor="design-status">Status</Label>
              <Select
                value={editStatus}
                onValueChange={(v) => setEditStatus(v as Status)}
              >
                <SelectTrigger id="design-status" className="w-full">
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

            {/* Resolution notes — the message the organizer sees on their Design page. */}
            <div className="space-y-2">
              <Label htmlFor="design-resolution">
                Resolution notes{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="design-resolution"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="What was done, or why it was rejected..."
                rows={4}
              />
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
