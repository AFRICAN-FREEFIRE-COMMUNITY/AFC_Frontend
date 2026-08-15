"use client";

// ── ApprovalQueuePanel ────────────────────────────────────────────────────────
// The CROSS-EVENT sponsor approval queue on /a/sponsor-dashboard (owner 2026-08-14).
//
// WHY IT EXISTS, in plain English: an event can be set to "the sponsor must approve
// registrations". Until now the only place those answers could be decided was inside the
// sponsor's own portal, so an event whose sponsor had nobody on AFC had a queue that literally
// nobody could clear, and AFC staff could not even see it. This panel is the staff-side view of
// the same queue: every answer the signed-in person is allowed to decide, across every event and
// every sponsor, pending first.
//
// WHAT IT RENDERS, top to bottom:
//   1. One line saying what the queue is, plus how many rows are waiting.
//   2. Toolbar: search (client-side, over the loaded page) + status / event / sponsor filters
//      (server-side params) + Export CSV of exactly what the filters select.
//   3. The table: Event | Sponsor | Player | Answer | Status | Actions, with the same light
//      pill badges and h-7 outline buttons as the sponsor portal, so the two read as one system.
//   4. "Showing x to y of z" + server offset pagination.
//   5. The reject dialog: reason REQUIRED (it reaches the player by email and in-app), plus an
//      "also remove them from the event" checkbox that switches the call to reject_final.
//
// HOW IT CONNECTS
//   - Data: lib/sponsors.ts sponsorsApi.queue / queueCsv -> backend
//     afc_sponsors/engagements.py admin_submission_queue. That endpoint scopes rows with the SAME
//     permission that guards deciding, so anything visible here is actionable here.
//   - Decisions: sponsorsApi.decideSubmission -> afc_sponsors decide_submission, the identical
//     endpoint the sponsor portal's EngagementSubmissionsPanel uses. Rejections notify the player
//     and (reject_final) free their slot; the backend owns all of that.
//   - Rendered by app/(a)/a/sponsor-dashboard/page.tsx inside the Approvals tab.
//   - Copy: messages/{en,fr,pt}/sponsorAdmin.json, namespace "sponsorAdmin".
//   - Times render through <LocalTime> so a viewer in Lagos and one in Lisbon each see their own
//     clock (the API speaks UTC).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { LocalTime } from "@/components/LocalTime";
import { IconCheck, IconDownload, IconLoader2, IconSearch, IconX } from "@tabler/icons-react";

import { matchesSearch } from "@/lib/search";
import {
  sponsorsApi,
  type QueuedSubmissionRow,
  type SponsorQueueFilters,
} from "@/lib/sponsors";
import { cn } from "@/lib/utils";

// Server page size. The queue is a work list, not a report, so a screenful at a time.
const QUEUE_PAGE_SIZE = 20;

type DecideAction = "approve" | "reject" | "reject_final" | "undo";
type StatusFilter = "all" | "pending" | "approved" | "rejected";

interface RejectDialogState {
  open: boolean;
  row: QueuedSubmissionRow | null;
  reason: string;
  // true -> fires reject_final, which also frees the player's slot in the event
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

// Pull a useful message off an axios error without inventing backend shapes.
function errorMessage(err: unknown, fallback: string): string {
  const data = (err as any)?.response?.data;
  return data?.error || data?.detail || data?.message || fallback;
}

// The light pill the sponsor portal uses, so a status means the same thing in both places.
function ApprovalPill({
  row,
  t,
}: {
  row: QueuedSubmissionRow;
  t: ReturnType<typeof useTranslations>;
}) {
  if (row.approval_status === "not_required") {
    return <span className="text-xs text-muted-foreground">{t("statusNotRequired")}</span>;
  }
  const tone: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  const labelKey: Record<string, string> = {
    pending: "statusPending",
    approved: "statusApproved",
    rejected: "statusRejected",
  };
  return (
    <span
      // A rejected pill carries the full reason on hover; the Actions column prints it too.
      title={row.approval_status === "rejected" && row.reason ? row.reason : undefined}
      className={cn("px-2 py-0.5 rounded-full text-xs font-medium", tone[row.approval_status])}
    >
      {t(labelKey[row.approval_status])}
    </span>
  );
}

export function ApprovalQueuePanel() {
  const t = useTranslations("sponsorAdmin");

  const [rows, setRows] = useState<QueuedSubmissionRow[]>([]);
  const [filters, setFilters] = useState<SponsorQueueFilters>({ events: [], sponsors: [] });
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [sponsorFilter, setSponsorFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [acting, setActing] = useState<Map<number, DecideAction>>(new Map());
  const [rejectDialog, setRejectDialog] = useState<RejectDialogState>(CLOSED_REJECT_DIALOG);

  // Monotonic guard: a slow response for an older filter must never overwrite a newer one.
  const fetchSeq = useRef(0);

  const load = useCallback(
    async (status: StatusFilter, event: string, sponsor: string, pg: number) => {
      const mySeq = ++fetchSeq.current;
      setLoading(true);
      try {
        const res = await sponsorsApi.queue({
          ...(status !== "all" ? { status } : {}),
          ...(event !== "all" ? { event: Number(event) } : {}),
          ...(sponsor !== "all" ? { sponsor: Number(sponsor) } : {}),
          limit: QUEUE_PAGE_SIZE,
          offset: (pg - 1) * QUEUE_PAGE_SIZE,
        });
        if (fetchSeq.current !== mySeq) return;
        setRows(res.results);
        setFilters(res.filters);
        setTotalCount(res.total_count);
        // Deciding the last row of a trailing page can leave us past the end; step back.
        if (res.results.length === 0 && pg > 1 && res.total_count > 0) setPage(pg - 1);
      } catch (err) {
        if (fetchSeq.current === mySeq) toast.error(errorMessage(err, t("toastLoadFailed")));
      } finally {
        if (fetchSeq.current === mySeq) setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    load(statusFilter, eventFilter, sponsorFilter, page);
  }, [load, statusFilter, eventFilter, sponsorFilter, page]);

  // Any filter change restarts at page 1; without this a narrow filter can land on an empty page.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, eventFilter, sponsorFilter]);

  // Search is client-side over the loaded page, matching the rest of the admin surfaces. The
  // shared helper folds punctuation, accents and stylized fonts, so "ve" still finds "V-E".
  const visible = useMemo(() => {
    if (!search.trim()) return rows;
    return rows.filter((r) =>
      matchesSearch(
        [r.username, r.sponsor_name, r.event_name, r.engagement_label, r.value],
        search,
      ),
    );
  }, [rows, search]);

  const pendingWaiting = useMemo(
    () => rows.filter((r) => r.approval_status === "pending").length,
    [rows],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / QUEUE_PAGE_SIZE));
  const firstShown = totalCount === 0 ? 0 : (page - 1) * QUEUE_PAGE_SIZE + 1;
  const lastShown = Math.min(page * QUEUE_PAGE_SIZE, totalCount);

  // ── decisions ───────────────────────────────────────────────────────────────
  // One decide call, then a refetch, so the table always shows the server's truth rather than an
  // optimistic guess (a rejection can cascade: reject_final also releases the player's slot).
  const decide = useCallback(
    async (row: QueuedSubmissionRow, action: DecideAction, reason?: string) => {
      setActing((prev) => new Map(prev).set(row.id, action));
      try {
        await sponsorsApi.decideSubmission(row.id, action, reason);
        const toasts: Record<DecideAction, string> = {
          approve: t("toastConfirmed", { username: row.username }),
          reject: t("toastRejected", { username: row.username }),
          reject_final: t("toastRejectedRemoved", { username: row.username }),
          undo: t("toastUndone", { username: row.username }),
        };
        toast.success(toasts[action]);
        await load(statusFilter, eventFilter, sponsorFilter, page);
        return true;
      } catch (err) {
        toast.error(errorMessage(err, t("toastUpdateFailed", { username: row.username })));
        return false;
      } finally {
        setActing((prev) => {
          const next = new Map(prev);
          next.delete(row.id);
          return next;
        });
      }
    },
    [load, statusFilter, eventFilter, sponsorFilter, page, t],
  );

  const handleRejectConfirm = async () => {
    const { row, reason, removeFromEvent } = rejectDialog;
    if (!row) return;
    // The reason is not optional here: it is what the player is told to fix.
    if (!reason.trim()) {
      toast.error(t("toastReasonRequired"));
      return;
    }
    if (
      removeFromEvent &&
      !window.confirm(t("confirmRemove", { username: row.username, event: row.event_name }))
    ) {
      return;
    }
    setRejectDialog((prev) => ({ ...prev, loading: true }));
    const ok = await decide(row, removeFromEvent ? "reject_final" : "reject", reason.trim());
    setRejectDialog(ok ? CLOSED_REJECT_DIALOG : { ...rejectDialog, loading: false });
  };

  const handleExport = async () => {
    try {
      await sponsorsApi.queueCsv(
        `sponsor-approvals-${new Date().toISOString().slice(0, 10)}.csv`,
        {
          ...(statusFilter !== "all" ? { status: statusFilter } : {}),
          ...(eventFilter !== "all" ? { event: Number(eventFilter) } : {}),
          ...(sponsorFilter !== "all" ? { sponsor: Number(sponsorFilter) } : {}),
        },
      );
    } catch (err) {
      toast.error(errorMessage(err, t("toastExportFailed")));
    }
  };

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{t("approvalsIntro")}</p>
        <p className="text-sm font-medium shrink-0">
          {t("pendingSummary", { count: pendingWaiting })}
        </p>
      </div>

      {/* Toolbar: search + the three server-side filters + CSV */}
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
              aria-label={t("cancel")}
            >
              <IconX className="size-4" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-auto">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-full lg:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterAllStatuses")}</SelectItem>
              <SelectItem value="pending">{t("statusPending")}</SelectItem>
              <SelectItem value="approved">{t("statusApproved")}</SelectItem>
              <SelectItem value="rejected">{t("statusRejected")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-full lg:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterAllEvents")}</SelectItem>
              {filters.events.map((e) => (
                <SelectItem key={e.event_id} value={String(e.event_id)}>
                  {e.event_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sponsorFilter} onValueChange={setSponsorFilter}>
            <SelectTrigger className="w-full lg:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterAllSponsors")}</SelectItem>
              {filters.sponsors.map((s) => (
                <SelectItem key={s.sponsor_id} value={String(s.sponsor_id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={totalCount === 0}
          className="shrink-0"
        >
          <IconDownload className="size-4 mr-1" />
          {t("exportCsv")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <IconLoader2 className="size-5 animate-spin" />
          {t("loading")}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {totalCount === 0 ? t("empty") : t("emptyFiltered")}
          </CardContent>
        </Card>
      ) : (
        <Card className="pt-2">
          <CardContent className="p-0">
            {/* The table scrolls inside its own box, so a phone never scrolls the whole page.
                min-w is what makes that real: without it the six columns squeeze into 350px and
                Status and Actions get clipped instead of coming into reach by scrolling.
                (Same idiom as the rankings scoring-config tables.) */}
            <div className="overflow-x-auto">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colEvent")}</TableHead>
                    <TableHead>{t("colSponsor")}</TableHead>
                    <TableHead>{t("colPlayer")}</TableHead>
                    <TableHead>{t("colAnswer")}</TableHead>
                    <TableHead>{t("colStatus")}</TableHead>
                    <TableHead className="text-right">{t("colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((row) => {
                    const busy = acting.has(row.id);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="max-w-[14rem] truncate" title={row.event_name}>
                          {row.event_name}
                        </TableCell>
                        <TableCell>{row.sponsor_name}</TableCell>
                        <TableCell className="font-medium">{row.username}</TableCell>
                        <TableCell className="max-w-[16rem]">
                          <span className="block text-xs text-muted-foreground">
                            {row.engagement_label}
                          </span>
                          <span className="block truncate" title={row.value}>
                            {row.value || "-"}
                          </span>
                          {row.updated_at && (
                            <LocalTime
                              value={row.updated_at}
                              mode="date"
                              className="block text-xs text-muted-foreground"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <ApprovalPill row={row} t={t} />
                          {row.approval_status === "rejected" && row.reason && (
                            <span className="mt-1 block max-w-[14rem] text-xs text-muted-foreground">
                              {t("rejectedReason", { reason: row.reason })}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {row.approval_status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 border-green-200 text-xs text-green-600 hover:bg-green-50"
                                  disabled={busy}
                                  onClick={() => decide(row, "approve")}
                                >
                                  {busy && acting.get(row.id) === "approve" ? (
                                    <IconLoader2 className="size-3 animate-spin" />
                                  ) : (
                                    <IconCheck className="size-3" />
                                  )}
                                  {t("confirm")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 border-red-200 text-xs text-red-600 hover:bg-red-50"
                                  disabled={busy}
                                  onClick={() =>
                                    setRejectDialog({
                                      open: true,
                                      row,
                                      reason: "",
                                      removeFromEvent: false,
                                      loading: false,
                                    })
                                  }
                                >
                                  <IconX className="size-3" />
                                  {t("reject")}
                                </Button>
                              </>
                            )}
                            {row.approval_status !== "pending" && row.can_undo && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={busy}
                                onClick={() => decide(row, "undo")}
                              >
                                {busy && acting.get(row.id) === "undo" && (
                                  <IconLoader2 className="size-3 animate-spin" />
                                )}
                                {t("undo")}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
              <p className="hidden text-sm text-muted-foreground md:block">
                {t("showing", { from: firstShown, to: lastShown, total: totalCount })}
              </p>
              {totalPages > 1 && (
                <Pagination className="mx-0 w-full md:w-auto">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-disabled={page === 1}
                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
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
                          page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
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

      {/* Reject dialog: the reason reaches the player, so it is required. */}
      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) =>
          !rejectDialog.loading && setRejectDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("rejectTitle", { username: rejectDialog.row?.username ?? "" })}
            </DialogTitle>
            {/* Radix wants every dialog described, and this is the sentence that matters: what
                the reason is for. It also removes the "Missing Description" console warning. */}
            <DialogDescription>{t("rejectReasonHelp")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("rejectReasonLabel")}</label>
              <Textarea
                rows={3}
                placeholder={t("rejectReasonPlaceholder")}
                value={rejectDialog.reason}
                onChange={(e) =>
                  setRejectDialog((prev) => ({ ...prev, reason: e.target.value }))
                }
                disabled={rejectDialog.loading}
              />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="queue-remove-from-event"
                checked={rejectDialog.removeFromEvent}
                onCheckedChange={(v) =>
                  setRejectDialog((prev) => ({ ...prev, removeFromEvent: v === true }))
                }
                disabled={rejectDialog.loading}
              />
              <div className="grid gap-1">
                <label htmlFor="queue-remove-from-event" className="text-sm leading-none">
                  {t("rejectRemove")}
                </label>
                <p className="text-xs text-muted-foreground">{t("rejectRemoveHelp")}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={rejectDialog.loading}
              onClick={() => setRejectDialog(CLOSED_REJECT_DIALOG)}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={rejectDialog.loading}
              onClick={handleRejectConfirm}
            >
              {rejectDialog.loading && <IconLoader2 className="size-4 animate-spin mr-2" />}
              {rejectDialog.removeFromEvent ? t("rejectAndRemove") : t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
