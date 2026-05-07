"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Loader2, CheckCircle2, X, Lock } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import {
  approveWithdrawal,
  listWithdrawals,
  rejectWithdrawal,
} from "@/lib/mock-wager/handlers/admin";
import { runSeed } from "@/lib/mock-wager/seed";
import { getDB } from "@/lib/mock-wager/store";
import { formatMoney } from "@/lib/utils";
import type {
  FxSnapshot,
  WithdrawalRequest,
} from "@/lib/mock-wager/types";

const fx: FxSnapshot = {
  id: "fx_admin",
  captured_at: new Date().toISOString(),
  ngn_per_usd: 1500,
  source: "admin",
};

const COSIGN_THRESHOLD_KOBO = 5_000_000_00;

const STATUS_CLASS: Record<WithdrawalRequest["status"], string> = {
  REQUESTED: "border-amber-500/40 text-amber-400",
  APPROVED: "border-blue-500/40 text-blue-400",
  SENT: "border-emerald-500/40 text-emerald-400",
  FAILED: "border-rose-500/40 text-rose-400",
  CANCELLED: "border-muted text-muted-foreground",
};

export default function WithdrawalsClient() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [rows, setRows] = useState<WithdrawalRequest[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const refresh = async () => {
    const list = await listWithdrawals({});
    setRows(list);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await runSeed();
      const db = await getDB();
      const us = await db.getAll("users");
      if (cancelled) return;
      setUsers(Object.fromEntries(us.map((u) => [u.id, u.username])));
      await refresh();
      setBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = statusFilter === "ALL"
    ? rows
    : rows.filter((r) => r.status === statusFilter);

  const onApprove = async (w: WithdrawalRequest) => {
    if (w.amount_kobo > COSIGN_THRESHOLD_KOBO) {
      toast.error(
        "Cosign required — head_admin must approve in /a/wallet/cosign-queue",
      );
      return;
    }
    if (!confirm(`Approve withdrawal of ${formatMoney(w.amount_kobo, fx).naira}?`))
      return;
    try {
      await approveWithdrawal({ id: w.id, admin_user_id: "head_admin_jay" });
      toast.success("Approved & sent");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onReject = async (w: WithdrawalRequest) => {
    const reason = prompt("Rejection reason?");
    if (!reason) return;
    try {
      await rejectWithdrawal({
        id: w.id,
        admin_user_id: "head_admin_jay",
        reason,
      });
      toast.success("Rejected. Funds reversed to user.");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!bootstrapped) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Withdrawals"
        description={`${rows.length} requests · ${rows.filter((r) => r.status === "REQUESTED").length} awaiting review`}
        back
      />

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="REQUESTED">Requested</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table className="text-xs" data-testid="withdrawals-table">
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="text-foreground p-2 text-xs">When</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">User</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Amount</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Rail</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Status</TableHead>
                  <TableHead className="text-foreground p-2 text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="p-4 text-center text-muted-foreground"
                    >
                      No withdrawals match.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((w) => {
                    const cosign = w.amount_kobo > COSIGN_THRESHOLD_KOBO;
                    return (
                      <TableRow
                        key={w.id}
                        className="hover:bg-muted/30"
                        data-testid="withdrawal-row"
                      >
                        <TableCell className="p-2 text-xs text-muted-foreground tabular-nums">
                          {new Date(w.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="p-2 text-xs">
                          @{users[w.user_id] ?? w.user_id}
                        </TableCell>
                        <TableCell className="p-2 text-xs tabular-nums font-medium">
                          {formatMoney(w.amount_kobo, fx).naira}
                          {cosign && (
                            <Badge
                              variant="outline"
                              className="ml-2 border-rose-500/40 text-rose-400"
                            >
                              <Lock className="size-3" />
                              Cosign
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="p-2 text-xs text-muted-foreground">
                          {w.rail.replace("_", " ").toLowerCase()}
                        </TableCell>
                        <TableCell className="p-2 text-xs">
                          <Badge variant="outline" className={STATUS_CLASS[w.status]}>
                            {w.status.toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="p-2 text-xs text-right">
                          {w.status === "REQUESTED" ? (
                            <div className="flex justify-end gap-1">
                              {cosign ? (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2"
                                >
                                  <Link href="/a/wallet/cosign-queue">
                                    To cosign
                                  </Link>
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-emerald-400"
                                  onClick={() => onApprove(w)}
                                  data-testid="approve-btn"
                                >
                                  <CheckCircle2 className="size-3" />
                                  Approve
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-rose-400"
                                onClick={() => onReject(w)}
                              >
                                <X className="size-3" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
