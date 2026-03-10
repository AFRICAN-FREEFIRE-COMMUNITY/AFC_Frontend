"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconLoader2,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
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

interface AssignedEvent {
  event_id: number;
  event_name: string;
  slug: string;
  sponsor_field_label: string;
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

function EventSection({
  event,
  token,
}: {
  event: AssignedEvent;
  token: string;
}) {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [pendingActions, setPendingActions] = useState<Map<number, ActionType>>(
    new Map(),
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [rejectDialog, setRejectDialog] = useState<RejectDialogState>({
    open: false,
    competitor_id: null,
    username: "",
    reason: "",
    loading: false,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-competitors-and-their-sponsor-id/`,
          { event_id: String(event.event_id) },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setCompetitors(res.data.competitors ?? []);
      } catch {
        toast.error(`Failed to load registrants for "${event.event_name}".`);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [event.event_id, token]);

  const filtered = useMemo(() => {
    setPage(1);
    const q = search.toLowerCase().trim();
    return competitors.filter((c) => {
      const matchesSearch =
        !q ||
        c.username.toLowerCase().includes(q) ||
        c.sponsor_id.toLowerCase().includes(q) ||
        (c.team_name ?? "").toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [competitors, search, statusFilter]);

  const counts = useMemo(
    () => ({
      all: competitors.length,
      pending: competitors.filter((c) => c.status === "pending").length,
      confirmed: competitors.filter((c) => c.status === "confirmed").length,
      rejected: competitors.filter((c) => c.status === "rejected").length,
    }),
    [competitors],
  );

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  const updateStatus = (id: number, status: Competitor["status"]) => {
    setCompetitors((prev) =>
      prev.map((c) => (c.competitor_id === id ? { ...c, status } : c)),
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
      updateStatus(competitor_id, "confirmed");
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
      updateStatus(rejectDialog.competitor_id, "rejected");
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

  return (
    <>
      <Card>
        {/* Event header */}
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setCollapsed((v) => !v)}
        >
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="text-base">{event.event_name}</CardTitle>
              {!loading && (
                <p className="text-xs text-muted-foreground">
                  {counts.all} registrant{counts.all !== 1 ? "s" : ""} ·{" "}
                  {counts.pending} pending · {counts.confirmed} confirmed ·{" "}
                  {counts.rejected} rejected
                </p>
              )}
            </div>
            <div className="text-muted-foreground">
              {collapsed ? (
                <IconChevronDown className="size-5" />
              ) : (
                <IconChevronUp className="size-5" />
              )}
            </div>
          </div>
        </CardHeader>

        {!collapsed && (
          <CardContent className="flex flex-col gap-4 pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
                <IconLoader2 className="size-4 animate-spin" />
                Loading registrants...
              </div>
            ) : competitors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No registrations yet for this event.
              </p>
            ) : (
              <>
                {/* Search + Filter */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by username, ID, or team..."
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
                    onValueChange={(v) =>
                      setStatusFilter(v as StatusFilter)
                    }
                  >
                    <SelectTrigger className="w-full sm:w-44">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All ({counts.all})</SelectItem>
                      <SelectItem value="pending">
                        Pending ({counts.pending})
                      </SelectItem>
                      <SelectItem value="confirmed">
                        Confirmed ({counts.confirmed})
                      </SelectItem>
                      <SelectItem value="rejected">
                        Rejected ({counts.rejected})
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No results match your search or filter.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Username</TableHead>
                            <TableHead>Team</TableHead>
                            <TableHead>{event.sponsor_field_label || "Sponsor ID"}</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginated.map((c) => {
                            const isActing = pendingActions.has(
                              c.competitor_id,
                            );
                            return (
                              <TableRow key={c.competitor_id}>
                                <TableCell>{c.username}</TableCell>
                                <TableCell>
                                  {c.team_name ?? "—"}
                                </TableCell>
                                <TableCell>{c.sponsor_id}</TableCell>
                                <TableCell>
                                  {statusBadge(c.status)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {c.status === "pending" ? (
                                    <div className="flex gap-2 justify-end">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-green-600 border-green-200 hover:bg-green-50 h-7 text-xs"
                                        disabled={isActing}
                                        onClick={() =>
                                          handleConfirm(
                                            c.competitor_id,
                                            c.username,
                                          )
                                        }
                                      >
                                        {isActing &&
                                        pendingActions.get(
                                          c.competitor_id,
                                        ) === "confirm" ? (
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
                                        disabled={isActing}
                                        onClick={() =>
                                          openRejectDialog(
                                            c.competitor_id,
                                            c.username,
                                          )
                                        }
                                      >
                                        {isActing &&
                                        pendingActions.get(
                                          c.competitor_id,
                                        ) === "reject" ? (
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

                    {totalPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          Showing {(page - 1) * ITEMS_PER_PAGE + 1}–
                          {Math.min(
                            page * ITEMS_PER_PAGE,
                            filtered.length,
                          )}{" "}
                          of {filtered.length}
                        </p>
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() =>
                                  setPage((p) => Math.max(1, p - 1))
                                }
                                aria-disabled={page === 1}
                                className={
                                  page === 1
                                    ? "pointer-events-none opacity-50"
                                    : "cursor-pointer"
                                }
                              />
                            </PaginationItem>
                            {Array.from(
                              { length: totalPages },
                              (_, i) => i + 1,
                            )
                              .filter(
                                (p) =>
                                  p === 1 ||
                                  p === totalPages ||
                                  Math.abs(p - page) <= 1,
                              )
                              .reduce<(number | "ellipsis")[]>(
                                (acc, p, idx, arr) => {
                                  if (
                                    idx > 0 &&
                                    p - (arr[idx - 1] as number) > 1
                                  )
                                    acc.push("ellipsis");
                                  acc.push(p);
                                  return acc;
                                },
                                [],
                              )
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
                                  setPage((p) =>
                                    Math.min(totalPages, p + 1),
                                  )
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
                  </>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>

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
    </>
  );
}

export default function SponsorDashboardPage() {
  const { token, loading: authLoading, user } = useAuth();
  const [events, setEvents] = useState<AssignedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !token) return;

    const load = async () => {
      try {
        // TODO: replace with actual endpoint once available
        // const res = await axios.get(
        //   `${env.NEXT_PUBLIC_BACKEND_API_URL}/sponsors/get-my-events/`,
        //   { headers: { Authorization: `Bearer ${token}` } },
        // );
        // setEvents(res.data.events ?? []);
        setEvents([]);
      } catch {
        toast.error("Failed to load your assigned events.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [authLoading, token]);

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground text-sm">
        <IconLoader2 className="size-5 animate-spin" />
        Loading your events...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-primary">
          Welcome{user?.full_name ? `, ${user.full_name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and manage registrants for your assigned events below.
        </p>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No events have been assigned to your account yet.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {events.map((e) => (
            <EventSection key={e.event_id} event={e} token={token!} />
          ))}
        </div>
      )}
    </div>
  );
}
