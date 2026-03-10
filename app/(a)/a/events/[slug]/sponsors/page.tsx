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
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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

export default function SponsorsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { token, loading: authLoading } = useAuth();

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingActions, setPendingActions] = useState<Map<number, ActionType>>(
    new Map(),
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const [sponsorFieldLabel, setSponsorFieldLabel] = useState("Sponsor ID");

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
        toast.error("Failed to load sponsor registrations.");
      }
    },
    [token],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
          { slug },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const evId: number = res.data.event_details.event_id;
        setSponsorFieldLabel(
          res.data.event_details.sponsor_field_label ?? "Sponsor ID",
        );
        await fetchCompetitors(evId);
      } catch (err: any) {
        console.error("Sponsors page load error:", err?.response?.data ?? err);
        toast.error(
          err?.response?.data?.message ||
            err?.response?.data?.detail ||
            "Failed to load event.",
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug, token, authLoading, fetchCompetitors]);

  const filteredCompetitors = useMemo(() => {
    setPage(1);
    const q = search.toLowerCase().trim();
    return competitors.filter((c) => {
      const matchesSearch =
        !q ||
        c.username.toLowerCase().includes(q) ||
        c.sponsor_id.toLowerCase().includes(q) ||
        (c.team_name ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
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
      toast.success(`${username} confirmed.`);
    } catch {
      toast.error(`Failed to confirm ${username}.`);
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
      toast.success(`${rejectDialog.username} rejected.`);
      setRejectDialog((prev) => ({ ...prev, open: false }));
    } catch {
      toast.error(`Failed to reject ${rejectDialog.username}.`);
    } finally {
      setRejectDialog((prev) => ({ ...prev, loading: false }));
      setPendingActions((prev) => {
        const next = new Map(prev);
        next.delete(rejectDialog.competitor_id!);
        return next;
      });
    }
  };

  const statusBadge = (status: Competitor["status"]) => {
    const map = {
      pending: "bg-yellow-100 text-yellow-700",
      confirmed: "bg-green-100 text-green-700",
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
  };

  if (loading) return <FullLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back
        title="Sponsor Review"
        description={`${counts.all} registrant${counts.all !== 1 ? "s" : ""} · ${counts.pending} pending · ${counts.confirmed} confirmed · ${counts.rejected} rejected`}
      />

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by username, sponsor ID, or team..."
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
            <SelectItem value="confirmed">
              Confirmed ({counts.confirmed})
            </SelectItem>
            <SelectItem value="rejected">
              Rejected ({counts.rejected})
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filteredCompetitors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {competitors.length === 0
              ? "No registrations found."
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
                    <TableHead>{sponsorFieldLabel}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCompetitors.map((c) => {
                    const isActing = pendingActions.has(c.competitor_id);
                    return (
                      <TableRow key={c.competitor_id}>
                        <TableCell>{c.username}</TableCell>
                        <TableCell>{c.team_name ?? "—"}</TableCell>
                        <TableCell>{c.sponsor_id}</TableCell>
                        <TableCell>{statusBadge(c.status)}</TableCell>
                        <TableCell className="text-right">
                          {c.status === "pending" ? (
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-200 hover:bg-green-50 h-7 text-xs"
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
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs"
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
                {filteredCompetitors.length === 0
                  ? 0
                  : (page - 1) * ITEMS_PER_PAGE + 1}
                –{Math.min(page * ITEMS_PER_PAGE, filteredCompetitors.length)}{" "}
                of {filteredCompetitors.length}
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
