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
//   4. The submissions table: [select] | Username | (Engagement, All tab only) |
//      Value | Status (light pill; rejected carries the reason as a title) |
//      Actions. Pending rows carry a checkbox and the header checkbox ticks
//      every pending row on the page (owner 2026-09-11: "there should be a way
//      to bulk approve or reject"). Only shown when the approval gate is on.
//      Actions per approval_status:
//        pending      -> h-7 outline Confirm (approve) + Reject (reason dialog)
//        approved     -> "Confirmed by you" + Undo (when can_undo)
//        rejected     -> "Rejected: <full reason>" + Undo (when can_undo)
//        not_required -> value only (no decision surface)
//   5. Footer: "Showing x-y of z" + pagination (SERVER offset paging via the
//      endpoint's limit/offset params, same Pagination idiom as the legacy
//      sponsor dashboard).
//   6. Bulk bar: appears while anything is ticked, sticks to the bottom of the
//      viewport: Confirm selected (n) / Reject selected (n) / Clear. One
//      request for the batch (sponsorsApi.decideSubmissions).
//   7. Reject dialog: REQUIRED reason textarea (the reason rides in the
//      player's rejection email + in-app notification) + an extra "Also remove
//      from the event" checkbox that switches the action to reject_final
//      (frees the player's slot; button relabels to "Reject and remove" and
//      asks for an explicit confirm before firing). Serves one row or the
//      whole selection; a batch shares one reason.
//
// NO RELOAD AFTER A DECISION (owner 2026-09-11: "the pages shouldn't reload
// each time you confirm or reject"): every decision, single or bulk, patches
// the affected rows IN PLACE from the submission shape the backend returns.
// The table never unmounts and the scroll position holds. The page is re-read
// only on a tab / filter / page change or through the Refresh button; the
// pending chips on the tabs still re-count in the background (cheap limit-1
// probes that touch nothing on screen but the numbers).
//
// HOW IT CONNECTS:
//   - Rendered by ScopedSponsorDashboard.tsx (same folder) inside the event
//     drill-down, ONLY when the event's sponsorship has engagements configured
//     (engagements written by the P2 wizard builder). Events without
//     engagements keep the legacy submissions table in the parent.
//   - Data: sponsorsApi.engagementSubmissions / decideSubmission /
//     decideSubmissions (bulk) / engagementSubmissionsCsv (lib/sponsors.ts ->
//     afc_sponsors engagement endpoints). The parent fetches page 1 (All tab,
//     no status filter) and hands it down as `initial` so this panel never
//     double-fetches on mount.
//   - A rejected player resubmits via sponsorsApi.resubmitSubmission on their
//     side; the corrected row returns to THIS pending queue.
//
// Design parity: light pill badges (pending bg-yellow-100 / approved green /
// rejected red), h-7 outline action buttons, Card p-0 table, showing-x-of-y +
// Pagination footer - all lifted verbatim from the legacy sponsor dashboard
// per the owner's design-parity feedback.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
import { NewBadge } from "@/components/NewBadge";
import { ITEMS_PER_PAGE } from "@/constants";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import {
  sponsorsApi,
  type DecidedSubmission,
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
  IconRefresh,
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

// The day the checkboxes and the bulk bar went live (NEW badge, 5 days, self-expiring).
const BULK_SINCE = "2026-09-11";

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type DecideAction = "approve" | "reject" | "reject_final" | "undo";
type BulkAction = Exclude<DecideAction, "undo">;

// ── small helpers ─────────────────────────────────────────────────────────────

// Tab label for one engagement entry. Falls back from the configured label to a
// type-derived name (the wizard's collect_id entries always carry a label, e.g.
// "ydpay UID"; join_group derives from its platform, e.g. "WhatsApp group").
// `t` is the sponsorSubmissions translator, passed in because this helper lives
// outside the component (same ReturnType<typeof useTranslations> idiom the repo
// uses for MediaAuditCard's helpers). Configured labels (e.label) are backend
// data and stay verbatim; only the type-derived fallbacks are translated.
function engagementTabLabel(
  e: SponsorEngagement,
  t: ReturnType<typeof useTranslations>,
): string {
  if (e.label) return e.label;
  switch (e.type) {
    case "collect_id":
      return t("engagementCollectId");
    case "follow_social":
      return e.platform
        ? t("engagementFollowPlatform", { platform: e.platform })
        : t("engagementFollowSocials");
    case "create_account":
      return t("engagementCreateAccount");
    case "join_group":
      if (e.platform === "whatsapp") return t("engagementWhatsappGroup");
      if (e.platform === "discord") return t("engagementDiscordGroup");
      return t("engagementJoinGroup");
    default:
      return t("engagementDefault");
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
function ApprovalPill({
  row,
  t,
}: {
  row: EngagementSubmissionRow;
  t: ReturnType<typeof useTranslations>;
}) {
  if (row.approval_status === "not_required") {
    return <span className="text-xs text-muted-foreground">-</span>;
  }
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  // Map the backend approval_status enum onto its translated pill label.
  const labelKey: Record<string, string> = {
    pending: "statusPending",
    approved: "statusApproved",
    rejected: "statusRejected",
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
      {t(labelKey[row.approval_status])}
    </span>
  );
}

// ── reject dialog state ───────────────────────────────────────────────────────

interface RejectDialogState {
  open: boolean;
  // one row from its own Reject button, or every selected row from the bulk bar
  rows: EngagementSubmissionRow[];
  reason: string;
  // true -> the decision fires as reject_final (also frees the player's slot)
  removeFromEvent: boolean;
  loading: boolean;
}

const CLOSED_REJECT_DIALOG: RejectDialogState = {
  open: false,
  rows: [],
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

  // sponsorSubmissions namespace (messages/en/sponsorSubmissions.json). Client
  // component, so useTranslations; passed down to the ApprovalPill and the
  // engagementTabLabel helper which sit outside this function.
  const t = useTranslations("sponsorSubmissions");

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

  // Ids ticked for a bulk decision. Only pending rows are ever in here: a decided
  // row's checkbox is not rendered, and a page load prunes anything that stopped
  // being pending.
  const [selected, setSelected] = useState<Set<number>>(new Set());

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
        // Keep a tick only on rows that came back still pending.
        setSelected((prev) => {
          const next = new Set<number>();
          for (const r of res.results) if (r.approval_status === "pending" && prev.has(r.id)) next.add(r.id);
          return next;
        });
        // Deciding the last row of a trailing page (e.g. approving the only
        // pending row on page 2 of the Pending filter) can leave us past the
        // end; step back one page and let the effect refetch.
        if (res.results.length === 0 && pg > 1 && res.total_count > 0) {
          setPage(pg - 1);
        }
      } catch (err) {
        if (fetchSeq.current === mySeq) {
          toast.error(errorMessage(err, t("toastLoadFailed")));
        }
      } finally {
        if (fetchSeq.current === mySeq) setLoading(false);
      }
    },
    [sponsor.id, event.event_id, t],
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

  // The backend answers every decision with the row's new state (id,
  // approval_status, reason, can_undo). That is written straight into the
  // current page, so nothing refetches and nothing scrolls: the row changes
  // under your finger and offers Undo. The pending chips re-count in the
  // background because a decision moves a row between them.
  const patchRows = useCallback((decided: DecidedSubmission[]) => {
    if (decided.length === 0) return;
    const byId = new Map(decided.map((d) => [d.id, d]));
    setData((prev) => ({
      ...prev,
      results: prev.results.map((r) => {
        const d = byId.get(r.id);
        return d ? { ...r, ...d, updated_at: new Date().toISOString() } : r;
      }),
    }));
    // A decided row leaves the selection; an undone row is not re-ticked.
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      for (const d of decided) next.delete(d.id);
      return next;
    });
  }, []);

  const markActing = useCallback((ids: number[], action: DecideAction | null) => {
    setActing((prev) => {
      const next = new Map(prev);
      for (const id of ids) {
        if (action) next.set(id, action);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  // One row, one call. Stays on the single endpoint so undo (never bulk) and
  // the per-username toasts are exactly as they were. Returns true on success
  // (the reject dialog closes only then).
  const decide = useCallback(
    async (row: EngagementSubmissionRow, action: DecideAction, reason?: string) => {
      markActing([row.id], action);
      try {
        const res = await sponsorsApi.decideSubmission(row.id, action, reason);
        patchRows([res.submission]);
        if (action === "approve") {
          toast.success(t("toastConfirmed", { username: row.username }));
        } else if (action === "reject") {
          toast.success(t("toastRejected", { username: row.username }));
        } else if (action === "reject_final") {
          toast.success(t("toastRejectedRemoved", { username: row.username }));
        } else {
          toast.success(t("toastUndone", { username: row.username }));
        }
        refreshPendingCounts();
        return true;
      } catch (err) {
        toast.error(errorMessage(err, t("toastUpdateFailed", { username: row.username })));
        return false;
      } finally {
        markActing([row.id], null);
      }
    },
    [markActing, patchRows, refreshPendingCounts, t],
  );

  // Many rows, one call (decide_submissions). Every row is judged on its own
  // server-side; a refused row stays pending and ticked, and the toast says
  // how many and why.
  const decideMany = useCallback(
    async (targets: EngagementSubmissionRow[], action: BulkAction, reason?: string) => {
      const ids = targets.map((r) => r.id);
      markActing(ids, action);
      try {
        const res = await sponsorsApi.decideSubmissions(ids, action, reason);
        patchRows(res.results.flatMap((r) => (r.ok && r.submission ? [r.submission] : [])));
        if (res.applied > 0) toast.success(t("toastBulkApplied", { count: res.applied }));
        if (res.refused > 0) {
          const first = res.results.find((r) => !r.ok);
          toast.error(t("toastBulkRefused", { count: res.refused, message: first?.message ?? "" }));
        }
        refreshPendingCounts();
        return res.refused === 0;
      } catch (err) {
        toast.error(errorMessage(err, t("toastBulkFailed")));
        return false;
      } finally {
        markActing(ids, null);
      }
    },
    [markActing, patchRows, refreshPendingCounts, t],
  );

  // The rows a bulk action targets: ticked AND still pending on this page.
  const selectedRows = useMemo(
    () => data.results.filter((r) => selected.has(r.id) && r.approval_status === "pending"),
    [data.results, selected],
  );

  const openRejectDialog = (rows: EngagementSubmissionRow[]) => {
    setRejectDialog({ open: true, rows, reason: "", removeFromEvent: false, loading: false });
  };

  const handleRejectConfirm = async () => {
    const { rows: targets, reason, removeFromEvent } = rejectDialog;
    if (targets.length === 0) return;
    // Reason is REQUIRED here (unlike the legacy dialog): it rides in the
    // player's rejection email + in-app notification.
    if (!reason.trim()) {
      toast.error(t("toastReasonRequired"));
      return;
    }
    // reject_final frees the player's slot in the event; demand an explicit
    // confirm on top of the checkbox before firing it.
    if (removeFromEvent) {
      const question =
        targets.length === 1
          ? t("confirmRemove", { username: targets[0].username, event: event.event_name })
          : t("confirmRemoveMany", { count: targets.length, event: event.event_name });
      if (!window.confirm(question)) return;
    }
    setRejectDialog((prev) => ({ ...prev, loading: true }));
    const action: BulkAction = removeFromEvent ? "reject_final" : "reject";
    const ok =
      targets.length === 1
        ? await decide(targets[0], action, reason.trim())
        : await decideMany(targets, action, reason.trim());
    if (ok) {
      setRejectDialog(CLOSED_REJECT_DIALOG);
    } else {
      setRejectDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // ── CSV export (scoped to the active tab + status filter) ───────────────────

  const exportCsv = () => {
    const tabLabel =
      activeTab === "all" ? "all" : engagementTabLabel(engagements[Number(activeTab)], t);
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
      .catch(() => toast.error(t("toastCsvFailed")));
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

  // ── selection (bulk decisions) ──────────────────────────────────────────────
  // The header checkbox works on the rows the person can SEE: this page after
  // the search box. Only offered when the approval gate is on; without it no
  // row is ever pending.
  const visiblePending = useMemo(
    () => filtered.filter((r) => r.approval_status === "pending"),
    [filtered],
  );
  const visiblePendingSelected = visiblePending.filter((r) => selected.has(r.id)).length;
  const headerChecked: boolean | "indeterminate" =
    visiblePending.length > 0 && visiblePendingSelected === visiblePending.length
      ? true
      : visiblePendingSelected > 0
        ? "indeterminate"
        : false;

  const toggleRow = (id: number, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleVisiblePending = (on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of visiblePending) {
        if (on) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });

  const bulkBusy = selectedRows.some((r) => acting.has(r.id));

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
                  {t("requiresApproval")}
                </Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("privacyLine", { name: sponsor.name })}
            </p>
          </div>
          <div className="flex gap-2">
            {/* Refresh is the only way this page re-reads the server outside a
                tab / filter / page change, now that decisions patch rows in
                place. Loading dims the table instead of unmounting it. */}
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => {
                loadPage(activeTab, statusFilter, page);
                refreshPendingCounts();
              }}
            >
              <IconRefresh className={cn("size-4", loading && "animate-spin")} /> {t("refresh")}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <IconDownload className="size-4" /> {t("exportCsv")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pill tabs: All + one per engagement entry, pending chips when gated. */}
      <Tabs value={activeTab} onValueChange={changeTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">
            {t("all")}
            {requiresApproval && totalPending > 0 && (
              <span className="ml-1 rounded-full bg-yellow-100 text-yellow-700 px-1.5 text-[10px] font-semibold">
                {totalPending}
              </span>
            )}
          </TabsTrigger>
          {engagements.map((e, i) => (
            <TabsTrigger key={i} value={String(i)}>
              {engagementTabLabel(e, t)}
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
            placeholder={t("searchPlaceholder")}
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
            <SelectValue placeholder={t("filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all")}</SelectItem>
            <SelectItem value="pending">{t("statusPending")}</SelectItem>
            <SelectItem value="approved">{t("statusApproved")}</SelectItem>
            <SelectItem value="rejected">{t("statusRejected")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table (Card p-0 idiom). Subsequent page loads dim instead of unmounting. */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {loading ? (
              <span className="inline-flex items-center gap-2 text-sm">
                <IconLoader2 className="size-5 animate-spin" /> {t("loadingSubmissions")}
              </span>
            ) : data.results.length === 0 ? (
              t("noSubmissions")
            ) : (
              t("noSearchResults")
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
                    {requiresApproval && (
                      <TableHead className="w-10">
                        {/* Ticks every pending row on this page; indeterminate when only some are. */}
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            checked={headerChecked}
                            disabled={visiblePending.length === 0}
                            onCheckedChange={(v) => toggleVisiblePending(v === true)}
                            aria-label={t("selectAllPending")}
                          />
                          <NewBadge since={BULK_SINCE} />
                        </div>
                      </TableHead>
                    )}
                    <TableHead>{t("colUsername")}</TableHead>
                    {/* The All tab mixes engagements, so name each row's source. */}
                    {activeTab === "all" && <TableHead>{t("colEngagement")}</TableHead>}
                    <TableHead>{t("colValue")}</TableHead>
                    <TableHead>{t("colStatus")}</TableHead>
                    <TableHead className="text-right">{t("colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const rowAction = acting.get(r.id);
                    return (
                      <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                        {requiresApproval && (
                          <TableCell>
                            {r.approval_status === "pending" && (
                              <Checkbox
                                checked={selected.has(r.id)}
                                disabled={!!rowAction}
                                onCheckedChange={(v) => toggleRow(r.id, v === true)}
                                aria-label={t("selectRow", { username: r.username })}
                              />
                            )}
                          </TableCell>
                        )}
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
                              {t("notProvided")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ApprovalPill row={r} t={t} />
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
                                {t("confirm")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs"
                                disabled={!!rowAction}
                                onClick={() => openRejectDialog([r])}
                              >
                                {rowAction === "reject" || rowAction === "reject_final" ? (
                                  <IconLoader2 className="size-3 animate-spin" />
                                ) : (
                                  <IconX className="size-3" />
                                )}
                                {t("reject")}
                              </Button>
                            </div>
                          ) : r.approval_status === "approved" ? (
                            // Owner feedback: decided rows show WHAT was decided.
                            <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                              <span>
                                {/* "<b>Confirmed</b> by you" - t.rich keeps the bold
                                    on the verb only while staying localizable. */}
                                {t.rich("confirmedByYou", {
                                  b: (chunks) => (
                                    <b className="text-foreground font-semibold">{chunks}</b>
                                  ),
                                })}
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
                                  {t("undo")}
                                </Button>
                              )}
                            </div>
                          ) : r.approval_status === "rejected" ? (
                            <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                              <span className="max-w-[260px] text-right">
                                <b className="text-foreground font-semibold">{t("rejectedLabel")}</b>{" "}
                                {r.reason || t("noReason")}
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
                                  {t("undo")}
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
                  ? t("searchMatchCount", {
                      count: filtered.length,
                      total: data.results.length,
                    })
                  : t("showingRange", {
                      start: showingStart,
                      end: showingEnd,
                      total: data.total_count,
                    })}
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
          {t("queueHint")}
        </p>
      )}

      {/* Bulk bar: only while something is ticked. Sticky to the bottom of the
          viewport while the list runs past it, in flow once the end is on
          screen. Filled surface, neutral shadow, no outline (design rule). */}
      {selectedRows.length > 0 && (
        <div
          className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-md bg-card px-3 py-2 shadow-md"
          role="region"
          aria-label={t("bulkBarLabel")}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            {t("selectedCount", { count: selectedRows.length })}
            <NewBadge since={BULK_SINCE} />
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            disabled={bulkBusy}
            onClick={() => setSelected(new Set())}
          >
            {t("clearSelection")}
          </Button>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              className="h-8 bg-green-600 text-white hover:bg-green-700"
              disabled={bulkBusy}
              onClick={() => decideMany(selectedRows, "approve")}
            >
              {bulkBusy ? (
                <IconLoader2 className="size-3 animate-spin" />
              ) : (
                <IconCheck className="size-3" />
              )}
              {t("bulkConfirm", { count: selectedRows.length })}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8"
              disabled={bulkBusy}
              onClick={() => openRejectDialog(selectedRows)}
            >
              <IconX className="size-3" />
              {t("bulkReject", { count: selectedRows.length })}
            </Button>
          </div>
        </div>
      )}

      {/* ── Reject dialog: REQUIRED reason + optional reject_final. One row or the selection. ── */}
      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) =>
          !rejectDialog.loading &&
          setRejectDialog((prev) => (open ? { ...prev, open } : CLOSED_REJECT_DIALOG))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {rejectDialog.rows.length > 1
                ? t("rejectManyTitle", { count: rejectDialog.rows.length })
                : t("rejectDialogTitle", { username: rejectDialog.rows[0]?.username ?? "" })}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-muted-foreground">
                {t("reasonLabel")} <span className="text-xs">{t("reasonRequiredNote")}</span>
              </label>
              <Textarea
                placeholder={t("reasonPlaceholder")}
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
                {rejectDialog.rows.length > 1
                  ? t("alsoRemoveMany", { count: rejectDialog.rows.length })
                  : t("alsoRemove", { username: rejectDialog.rows[0]?.username ?? "" })}
                <span className="block text-xs text-muted-foreground">
                  {t("alsoRemoveNote")}
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
