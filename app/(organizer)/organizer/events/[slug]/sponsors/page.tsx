// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Events › [slug] › Sponsors (sponsor-ID review).
//
// Organizer parity port (owner 2026-07-02) of the ADMIN sponsors page
// app/(a)/a/events/[slug]/sponsors/page.tsx: the same searchable / filterable /
// paginated table of every registrant's per-event sponsor ID, with per-row
// Confirm and Reject (reason optional) actions - scoped to THIS organizer's own
// event. The table markup, search + filter + pagination logic, and the reject
// dialog are ported 1:1 from the admin page; only the org-side wrapping differs.
//
// ── WHAT CHANGED vs THE ADMIN PAGE ──
//   • Ownership guard: the slug must resolve to one of THIS org's events
//     (GET /events/get-all-events/?organization_id=<id>, the same "notMine"
//     pattern as the sibling detail / groups / leaderboard pages) - an organizer
//     can never open another org's sponsor list here.
//   • Permission gate: membership.permissions.can_manage_registrations || isOwner,
//     the EXACT org permission the backend now enforces on all three endpoints
//     below (org_can_event(user, "can_manage_registrations", event)).
//   • i18n: the organizer portal is a user-facing surface (unlike /a/), so every
//     string comes from the "organizer" namespace (eventSponsors.*), en → fr/pt
//     via pnpm i18n:translate.
//   • The admin tour's data-tour anchors are dropped (they belong to the ADMIN
//     product tour; the organizer tour has its own steps).
//
// ── CONSUMES (backend, all org-allowed per the 2026-07-02 parity audit) ──
//   POST /events/get-event-details/                       { slug }      → event_id + sponsor_field_label
//   POST /events/get-all-competitors-and-their-sponsor-id/ { event_id } → the roster + sponsor ids
//   POST /events/confirm-player/                          { member_id } → status → confirmed
//   POST /events/reject-player/                           { member_id, reason? } → status → rejected
//
// Linked from the organizer event detail page's quick links
// (app/(organizer)/organizer/events/[slug]/page.tsx, "Sponsor Review" button).
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
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
import { IconCheck, IconLoader2, IconLock, IconSearch, IconX } from "@tabler/icons-react";
import axios from "axios";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useOrganizer } from "../../../_components/OrganizerContext";

// One row of get-all-competitors-and-their-sponsor-id (same shape the admin page reads).
interface Competitor {
  competitor_id: number;
  user_id: number;
  username: string;
  team_id: number | null;
  team_name: string | null;
  sponsor_id: string;
  status: "pending" | "confirmed" | "rejected";
}

type ActionType = "confirm" | "reject";
type StatusFilter = "all" | "pending" | "confirmed" | "rejected";

interface RejectDialogState {
  open: boolean;
  competitor_id: number | null;
  username: string;
  reason: string;
  loading: boolean;
}

export default function OrganizerSponsorsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { token, loading: authLoading } = useAuth();
  const { membership, isOwner } = useOrganizer();
  // i18n: organizer-facing surface, namespace "organizer" (eventSponsors.*);
  // English values live in messages/en/organizer.json -> fr/pt via pnpm i18n:translate.
  const t = useTranslations("organizer");

  // Same org permission the backend enforces on all three sponsor-review endpoints
  // (org_can_event(user, "can_manage_registrations", event)).
  const canManageRegistrations =
    membership.permissions.can_manage_registrations || isOwner;
  const organizationId = membership.organization.organization_id;

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  // notMine: the slug is not one of THIS org's events (or resolution failed).
  const [notMine, setNotMine] = useState(false);
  const [pendingActions, setPendingActions] = useState<Map<number, ActionType>>(
    new Map(),
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  // The event-configured label for the sponsor-ID column (e.g. "Player UUID");
  // falls back to the translated default when the event never set one.
  const [sponsorFieldLabel, setSponsorFieldLabel] = useState<string>("");

  const [rejectDialog, setRejectDialog] = useState<RejectDialogState>({
    open: false,
    competitor_id: null,
    username: "",
    reason: "",
    loading: false,
  });

  const fetchCompetitors = useCallback(
    async (evId: number) => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-competitors-and-their-sponsor-id/`,
          { event_id: String(evId) },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setCompetitors(res.data.competitors ?? []);
      } catch {
        toast.error(t("eventSponsors.loadError"));
      }
    },
    [token, t],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!token || !canManageRegistrations) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        // 1. Ownership guard (mirrors the sibling detail/groups/leaderboard pages):
        //    the slug must be one of THIS org's events, else show the notMine card.
        const mine = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
          { ...config, params: { organization_id: organizationId } },
        );
        const owned = (mine.data?.events ?? []).some(
          (e: any) => e.slug === slug,
        );
        if (!owned) {
          setNotMine(true);
          return;
        }
        // 2. Event details for the numeric event_id + the sponsor-ID column label
        //    (same call the admin sponsors page makes).
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
          { slug },
          config,
        );
        const evId: number = res.data.event_details.event_id;
        setSponsorFieldLabel(res.data.event_details.sponsor_field_label ?? "");
        await fetchCompetitors(evId);
      } catch (err: any) {
        console.error("Sponsors page load error:", err?.response?.data ?? err);
        toast.error(
          err?.response?.data?.message ||
            err?.response?.data?.detail ||
            t("eventSponsors.loadEventError"),
        );
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, token, authLoading, organizationId, canManageRegistrations, fetchCompetitors]);

  const filteredCompetitors = useMemo(() => {
    setPage(1);
    return competitors.filter((c) => {
      // Text search uses the shared matchesSearch helper (punctuation, space, and
      // font-insensitive) so stylized in-game names match a plain-keyboard query.
      // Ported 1:1 from the admin sponsors page.
      const textMatch = matchesSearch(
        [c.username, c.sponsor_id, c.team_name],
        search,
      );
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      return textMatch && matchesStatus;
    });
  }, [competitors, search, statusFilter]);

  const totalPages = Math.ceil(filteredCompetitors.length / ITEMS_PER_PAGE);
  const paginatedCompetitors = filteredCompetitors.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  const counts = useMemo(
    () => ({
      all: competitors.length,
      pending: competitors.filter((c) => c.status === "pending").length,
      confirmed: competitors.filter((c) => c.status === "confirmed").length,
      rejected: competitors.filter((c) => c.status === "rejected").length,
    }),
    [competitors],
  );

  const updateCompetitorStatus = (
    competitor_id: number,
    status: Competitor["status"],
  ) => {
    setCompetitors((prev) =>
      prev.map((c) =>
        c.competitor_id === competitor_id ? { ...c, status } : c,
      ),
    );
  };

  const handleConfirm = async (competitor_id: number, username: string) => {
    setPendingActions((prev) => new Map(prev).set(competitor_id, "confirm"));
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/confirm-player/`,
        { member_id: String(competitor_id) },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      updateCompetitorStatus(competitor_id, "confirmed");
      toast.success(t("eventSponsors.confirmSuccess", { username }));
    } catch {
      toast.error(t("eventSponsors.confirmError", { username }));
    } finally {
      setPendingActions((prev) => {
        const next = new Map(prev);
        next.delete(competitor_id);
        return next;
      });
    }
  };

  const openRejectDialog = (competitor_id: number, username: string) => {
    setRejectDialog({
      open: true,
      competitor_id,
      username,
      reason: "",
      loading: false,
    });
  };

  const handleRejectConfirm = async () => {
    if (!rejectDialog.competitor_id) return;
    setRejectDialog((prev) => ({ ...prev, loading: true }));
    setPendingActions((prev) =>
      new Map(prev).set(rejectDialog.competitor_id!, "reject"),
    );
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/reject-player/`,
        {
          member_id: String(rejectDialog.competitor_id),
          ...(rejectDialog.reason.trim()
            ? { reason: rejectDialog.reason.trim() }
            : {}),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      updateCompetitorStatus(rejectDialog.competitor_id, "rejected");
      toast.success(
        t("eventSponsors.rejectSuccess", { username: rejectDialog.username }),
      );
      setRejectDialog((prev) => ({ ...prev, open: false }));
    } catch {
      toast.error(
        t("eventSponsors.rejectError", { username: rejectDialog.username }),
      );
    } finally {
      setRejectDialog((prev) => ({ ...prev, loading: false }));
      setPendingActions((prev) => {
        const next = new Map(prev);
        next.delete(rejectDialog.competitor_id!);
        return next;
      });
    }
  };

  // Status pill (same colors as the admin page); label is translated.
  const statusBadge = (status: Competitor["status"]) => {
    const map = {
      pending: "bg-yellow-100 text-yellow-700",
      confirmed: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
    };
    return (
      <span
        className={cn(
          "px-2 py-0.5 rounded-full text-xs font-medium",
          map[status],
        )}
      >
        {t(`eventSponsors.status.${status}`)}
      </span>
    );
  };

  // ── permission lock (mirrors the sibling detail/groups/leaderboard pages) ──
  if (!authLoading && !canManageRegistrations) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader back title={t("eventSponsors.title")} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IconLock className="size-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("eventSponsors.noPermission")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) return <FullLoader />;

  // The slug didn't resolve to one of THIS org's events.
  if (notMine) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader back title={t("eventSponsors.title")} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("eventSponsors.notMine")}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/organizer/events">
                {t("eventSponsors.backToEvents")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back
        title={t("eventSponsors.title")}
        description={t("eventSponsors.counts", {
          all: counts.all,
          pending: counts.pending,
          confirmed: counts.confirmed,
          rejected: counts.rejected,
        })}
      />

      {/* Search + Filter (ported 1:1 from the admin page) */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t("eventSponsors.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              className="absolute right-1 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <IconX className="size-4" />
            </button>
          )}
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={t("eventSponsors.filterPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("eventSponsors.filterAll", { count: counts.all })}
            </SelectItem>
            <SelectItem value="pending">
              {t("eventSponsors.filterPending", { count: counts.pending })}
            </SelectItem>
            <SelectItem value="confirmed">
              {t("eventSponsors.filterConfirmed", { count: counts.confirmed })}
            </SelectItem>
            <SelectItem value="rejected">
              {t("eventSponsors.filterRejected", { count: counts.rejected })}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filteredCompetitors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {competitors.length === 0
              ? t("eventSponsors.emptyNone")
              : t("eventSponsors.emptyFiltered")}
          </CardContent>
        </Card>
      ) : (
        <Card className="pt-2">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("eventSponsors.table.username")}</TableHead>
                    <TableHead>{t("eventSponsors.table.team")}</TableHead>
                    {/* Event-configured column label (falls back to the translated default). */}
                    <TableHead>
                      {sponsorFieldLabel || t("eventSponsors.sponsorIdDefault")}
                    </TableHead>
                    <TableHead>{t("eventSponsors.table.status")}</TableHead>
                    <TableHead className="text-right">
                      {t("eventSponsors.table.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCompetitors.map((c) => {
                    const isActing = pendingActions.has(c.competitor_id);
                    return (
                      <TableRow key={c.competitor_id}>
                        <TableCell>{c.username}</TableCell>
                        <TableCell>{c.team_name ?? "-"}</TableCell>
                        <TableCell>{c.sponsor_id}</TableCell>
                        <TableCell>{statusBadge(c.status)}</TableCell>
                        <TableCell className="text-right">
                          {c.status === "pending" ? (
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-200 hover:bg-green-50 h-9 text-xs"
                                disabled={isActing}
                                onClick={() =>
                                  handleConfirm(c.competitor_id, c.username)
                                }
                              >
                                {isActing &&
                                pendingActions.get(c.competitor_id) ===
                                  "confirm" ? (
                                  <IconLoader2 className="size-3 animate-spin" />
                                ) : (
                                  <IconCheck />
                                )}
                                {t("eventSponsors.confirm")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50 h-9 text-xs"
                                disabled={isActing}
                                onClick={() =>
                                  openRejectDialog(c.competitor_id, c.username)
                                }
                              >
                                {isActing &&
                                pendingActions.get(c.competitor_id) ===
                                  "reject" ? (
                                  <IconLoader2 className="size-3 animate-spin" />
                                ) : (
                                  <IconX />
                                )}
                                {t("eventSponsors.reject")}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              -
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {t("eventSponsors.showing", {
                  from:
                    filteredCompetitors.length === 0
                      ? 0
                      : (page - 1) * ITEMS_PER_PAGE + 1,
                  to: Math.min(
                    page * ITEMS_PER_PAGE,
                    filteredCompetitors.length,
                  ),
                  total: filteredCompetitors.length,
                })}
              </p>
              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-disabled={page === 1}
                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        (p) =>
                          p === 1 ||
                          p === totalPages ||
                          Math.abs(p - page) <= 1,
                      )
                      .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                          acc.push("ellipsis");
                        }
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
                              onClick={() => setPage(p)}
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
                        className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reject dialog (ported 1:1 from the admin page) */}
      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) =>
          !rejectDialog.loading &&
          setRejectDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("eventSponsors.rejectDialogTitle", {
                username: rejectDialog.username,
              })}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <label className="text-sm text-muted-foreground">
              {t("eventSponsors.reasonLabel")}{" "}
              <span className="text-xs">{t("eventSponsors.reasonOptional")}</span>
            </label>
            <Textarea
              placeholder={t("eventSponsors.reasonPlaceholder")}
              value={rejectDialog.reason}
              onChange={(e) =>
                setRejectDialog((prev) => ({
                  ...prev,
                  reason: e.target.value,
                }))
              }
              rows={3}
              disabled={rejectDialog.loading}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={rejectDialog.loading}
              onClick={() =>
                setRejectDialog((prev) => ({ ...prev, open: false }))
              }
            >
              {t("eventSponsors.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={rejectDialog.loading}
              onClick={handleRejectConfirm}
            >
              {rejectDialog.loading && (
                <IconLoader2 className="size-4 animate-spin mr-2" />
              )}
              {t("eventSponsors.reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
