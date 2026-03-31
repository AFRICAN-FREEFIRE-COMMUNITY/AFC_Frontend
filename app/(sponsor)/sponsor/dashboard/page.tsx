"use client";

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
import { IconCheck, IconLoader2, IconSearch, IconX } from "@tabler/icons-react";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";

// ── Types ──────────────────────────────────────────────────────────────────────

type Status = "pending" | "active" | "rejected";
type ActionType = "confirm" | "reject";
type StatusFilter = "all" | "pending" | "active" | "rejected";

interface Player {
  // derived unique key for the row
  id: number;
  event_id: number;
  event_name: string;
  username: string;
  team_name: string | null;
  user_id_from_sponsor: string | null;
  status: Status;
}

interface RejectDialogState {
  open: boolean;
  id: number | null;
  username: string;
  reason: string;
  loading: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    active: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full text-xs font-medium capitalize",
        map[status],
      )}
    >
      {status}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SponsorDashboardPage() {
  const { token, loading: authLoading, user } = useAuth();

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingActions, setPendingActions] = useState<Map<number, ActionType>>(
    new Map(),
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  console.log("timuwa");

  const [rejectDialog, setRejectDialog] = useState<RejectDialogState>({
    open: false,
    id: null,
    username: "",
    reason: "",
    loading: false,
  });

  useEffect(() => {
    if (authLoading || !token) return;

    const load = async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-list-of-players-in-sponsor-event/`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );

        const entries: any[] = res.data ?? [];

        const mapped: Player[] = entries.map((e) => ({
          // solo entries use player_id; team entries use member_id
          id: e.member_id ?? e.player_id,
          event_id: e.event_id,
          event_name: e.event_name,
          username: e.member_username ?? e.player_username,
          team_name: e.team_name ?? null,
          user_id_from_sponsor: e.user_id_from_sponsor,
          status: (e.status as string).trim().toLowerCase() as Status,
        }));

        console.log(mapped);

        setPlayers(mapped);
      } catch {
        toast.error("Failed to load your sponsored events.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [authLoading, token]);

  // ── Filtering ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    setPage(1);
    const q = search.toLowerCase().trim();
    return players.filter((p) => {
      const matchesSearch =
        !q ||
        p.username.toLowerCase().includes(q) ||
        (p.team_name ?? "").toLowerCase().includes(q) ||
        (p.user_id_from_sponsor ?? "").toLowerCase().includes(q) ||
        p.event_name.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [players, search, statusFilter]);

  const counts = useMemo(
    () => ({
      all: players.length,
      pending: players.filter((p) => p.status === "pending").length,
      active: players.filter((p) => p.status === "active").length,
      rejected: players.filter((p) => p.status === "rejected").length,
    }),
    [players],
  );

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  // ── Actions ──────────────────────────────────────────────────────────────────

  const updateStatus = (id: number, status: Status) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  };

  const handleConfirm = async (id: number, username: string) => {
    setPendingActions((prev) => new Map(prev).set(id, "confirm"));
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/confirm-player/`,
        { member_id: String(id) },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      updateStatus(id, "active");
      toast.success(`${username} active.`);
    } catch {
      toast.error(`Failed to confirm ${username}.`);
    } finally {
      setPendingActions((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const openRejectDialog = (id: number, username: string) => {
    setRejectDialog({ open: true, id, username, reason: "", loading: false });
  };

  const handleRejectConfirm = async () => {
    if (!rejectDialog.id) return;
    setRejectDialog((prev) => ({ ...prev, loading: true }));
    setPendingActions((prev) => new Map(prev).set(rejectDialog.id!, "reject"));
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/reject-player/`,
        {
          member_id: String(rejectDialog.id),
          ...(rejectDialog.reason.trim()
            ? { reason: rejectDialog.reason.trim() }
            : {}),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      updateStatus(rejectDialog.id, "rejected");
      toast.success(`${rejectDialog.username} rejected.`);
      setRejectDialog((prev) => ({ ...prev, open: false }));
    } catch {
      toast.error(`Failed to reject ${rejectDialog.username}.`);
    } finally {
      setRejectDialog((prev) => ({ ...prev, loading: false }));
      setPendingActions((prev) => {
        const next = new Map(prev);
        next.delete(rejectDialog.id!);
        return next;
      });
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground text-sm">
        <IconLoader2 className="size-5 animate-spin" />
        Loading your events...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 mx-auto">
      <PageHeader
        title={`Welcome, ${user?.full_name}` ? user?.full_name : ""}
        description={
          <>
            {counts.all} registrant{counts.all !== 1 ? "s" : ""} ·{" "}
            {counts.pending} pending · {counts.active} active ·{" "}
            {counts.rejected} rejected
          </>
        }
      />

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by username, event, team, or sponsor ID…"
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
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({counts.all})</SelectItem>
            <SelectItem value="pending">Pending ({counts.pending})</SelectItem>
            <SelectItem value="active">Active ({counts.active})</SelectItem>
            <SelectItem value="rejected">
              Rejected ({counts.rejected})
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {players.length === 0
              ? "No registrations found for your sponsored events."
              : "No results match your search or filter."}
          </CardContent>
        </Card>
      ) : (
        <Card className="pt-2">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Sponsor ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((p) => {
                    const isActing = pendingActions.has(p.id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{p.username}</TableCell>
                        <TableCell>{p.team_name ?? "—"}</TableCell>
                        <TableCell>
                          {p.user_id_from_sponsor ?? (
                            <span className="text-muted-foreground italic text-xs">
                              Not provided
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={p.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {p.status === "pending" ? (
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-200 hover:bg-green-50 h-7 text-xs"
                                disabled={isActing}
                                onClick={() => handleConfirm(p.id, p.username)}
                              >
                                {isActing &&
                                pendingActions.get(p.id) === "confirm" ? (
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
                                // disabled={isActing}
                                onClick={() =>
                                  openRejectDialog(p.id, p.username)
                                }
                              >
                                {isActing &&
                                pendingActions.get(p.id) === "reject" ? (
                                  <IconLoader2 className="size-3 animate-spin" />
                                ) : (
                                  <IconX className="size-3" />
                                )}
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
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
                Showing{" "}
                {filtered.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1}–
                {Math.min(page * ITEMS_PER_PAGE, filtered.length)} of{" "}
                {filtered.length}
              </p>
              {totalPages > 1 && (
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
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        (p) =>
                          p === 1 ||
                          p === totalPages ||
                          Math.abs(p - page) <= 1,
                      )
                      .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                          acc.push("ellipsis");
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
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reject dialog */}
      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) =>
          !rejectDialog.loading &&
          setRejectDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject {rejectDialog.username}?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <label className="text-sm text-muted-foreground">
              Reason <span className="text-xs">(optional)</span>
            </label>
            <Textarea
              placeholder="Enter a rejection reason..."
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
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejectDialog.loading}
              onClick={handleRejectConfirm}
            >
              {rejectDialog.loading && (
                <IconLoader2 className="size-4 animate-spin mr-2" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
