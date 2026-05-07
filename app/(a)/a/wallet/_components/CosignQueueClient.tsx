"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Lock, ShieldOff, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { runSeed } from "@/lib/mock-wager/seed";
import { getDB } from "@/lib/mock-wager/store";
import { credit, debit } from "@/lib/mock-wager/handlers/wallet";
import { approveWithdrawal, rejectWithdrawal } from "@/lib/mock-wager/handlers/admin";
import { writeAudit } from "@/lib/mock-wager/handlers/markets";
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

interface CosignAdjustment {
  id: string;
  admin_user_id: string;
  payload: {
    direction: "CREDIT" | "DEBIT";
    source_tag: "PURCHASED" | "WON" | "GIFT";
    amount_kobo: number;
    reason: string;
    idempotency_key: string;
  };
  target_id: string;
  created_at: string;
}

interface CosignWithdrawal {
  withdrawal: WithdrawalRequest;
}

export default function CosignQueueClient() {
  const { user } = useAuth();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [adjustments, setAdjustments] = useState<CosignAdjustment[]>([]);
  const [withdrawals, setWithdrawals] = useState<CosignWithdrawal[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});

  // Real backend gates this to head_admin via DB role; for the mock UI we
  // accept either: a logged-in head_admin (via AuthContext) OR the dev-mode
  // pass-through where useAuth returns nothing.
  const isHeadAdmin =
    !user ||
    user.role === "head_admin" ||
    user.roles?.includes("head_admin");

  const refresh = async () => {
    const db = await getDB();
    const allAudit = await db.getAll("audit_log");
    const pending = (allAudit as CosignAdjustment[]).filter(
      (e) => e.action_kind === "ADJUSTMENT_PENDING_COSIGN",
    );
    setAdjustments(pending);
    const wds = await db.getAll("withdrawal_requests");
    setWithdrawals(
      wds
        .filter((w) => w.cosign_status === "AWAITING" && w.status === "REQUESTED")
        .map((w) => ({ withdrawal: w })),
    );
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

  if (!bootstrapped) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isHeadAdmin) {
    return (
      <Card data-testid="cosign-403">
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <div className="flex size-12 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
            <ShieldOff className="size-6" />
          </div>
          <CardTitle>403 — head_admin only</CardTitle>
          <CardDescription>
            Cosign is gated to head_admin. Ask Jay or another head_admin to
            approve this batch.
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  const onApproveAdjustment = async (a: CosignAdjustment) => {
    if (!confirm(`Approve & execute adjustment of ${formatMoney(a.payload.amount_kobo, fx).naira}?`))
      return;
    try {
      if (a.payload.direction === "CREDIT") {
        await credit({
          user_id: a.target_id,
          amount_kobo: a.payload.amount_kobo,
          kind: "ADJUSTMENT",
          source_tag: a.payload.source_tag,
          ref_type: "manual_adjustment",
          ref_id: a.payload.idempotency_key,
          idempotency_key: a.payload.idempotency_key,
        });
      } else {
        await debit({
          user_id: a.target_id,
          amount_kobo: a.payload.amount_kobo,
          kind: "ADJUSTMENT",
          ref_type: "manual_adjustment",
          ref_id: a.payload.idempotency_key,
          idempotency_key: a.payload.idempotency_key,
        });
      }
      const db = await getDB();
      await db.delete("audit_log", a.id);
      await writeAudit({
        admin_user_id: "head_admin_jay",
        action_kind: "COSIGN_ADJUSTMENT_APPROVE",
        target_type: "wallet",
        target_id: a.target_id,
        payload: a.payload,
      });
      toast.success("Approved & executed");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onRejectAdjustment = async (a: CosignAdjustment) => {
    if (!confirm("Reject this adjustment?")) return;
    const db = await getDB();
    await db.delete("audit_log", a.id);
    await writeAudit({
      admin_user_id: "head_admin_jay",
      action_kind: "COSIGN_ADJUSTMENT_REJECT",
      target_type: "wallet",
      target_id: a.target_id,
      payload: a.payload,
    });
    toast.success("Rejected");
    refresh();
  };

  const onApproveWithdrawal = async (w: WithdrawalRequest) => {
    if (!confirm(`Approve withdrawal of ${formatMoney(w.amount_kobo, fx).naira}?`))
      return;
    try {
      const db = await getDB();
      const fresh = await db.get("withdrawal_requests", w.id);
      if (fresh) {
        fresh.cosign_status = "APPROVED";
        await db.put("withdrawal_requests", fresh);
      }
      await approveWithdrawal({ id: w.id, admin_user_id: "head_admin_jay" });
      toast.success("Approved & sent");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onRejectWithdrawal = async (w: WithdrawalRequest) => {
    const reason = prompt("Rejection reason?");
    if (!reason) return;
    try {
      await rejectWithdrawal({
        id: w.id,
        admin_user_id: "head_admin_jay",
        reason,
      });
      toast.success("Rejected & reversed");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const total = adjustments.length + withdrawals.length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Cosign queue · ${total} pending`}
        description="head_admin sign-off for adjustments and withdrawals over ₦5M. Two-key control prevents single-admin abuse."
        back
      />

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Lock className="size-3.5 text-rose-400" />
            <CardTitle className="text-sm">Pending withdrawals</CardTitle>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table className="text-xs" data-testid="cosign-withdrawals-table">
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="text-foreground p-2 text-xs">When</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">User</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Amount</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Rail</TableHead>
                  <TableHead className="text-foreground p-2 text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-4 text-center text-muted-foreground">
                      No withdrawals awaiting cosign.
                    </TableCell>
                  </TableRow>
                ) : (
                  withdrawals.map(({ withdrawal: w }) => (
                    <TableRow key={w.id} className="hover:bg-muted/30" data-testid="cosign-w-row">
                      <TableCell className="p-2 text-xs text-muted-foreground tabular-nums">
                        {new Date(w.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="p-2 text-xs">
                        @{users[w.user_id] ?? w.user_id}
                      </TableCell>
                      <TableCell className="p-2 text-xs tabular-nums font-medium text-rose-400">
                        {formatMoney(w.amount_kobo, fx).naira}
                      </TableCell>
                      <TableCell className="p-2 text-xs text-muted-foreground">
                        {w.rail.replace("_", " ").toLowerCase()}
                      </TableCell>
                      <TableCell className="p-2 text-xs text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-emerald-400"
                            onClick={() => onApproveWithdrawal(w)}
                          >
                            <CheckCircle2 className="size-3" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-rose-400"
                            onClick={() => onRejectWithdrawal(w)}
                          >
                            <X className="size-3" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Lock className="size-3.5 text-amber-400" />
            <CardTitle className="text-sm">Pending adjustments</CardTitle>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table className="text-xs" data-testid="cosign-adjustments-table">
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="text-foreground p-2 text-xs">When</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Submitted by</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Target</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Direction</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Amount</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Reason</TableHead>
                  <TableHead className="text-foreground p-2 text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="p-4 text-center text-muted-foreground">
                      No adjustments awaiting cosign.
                    </TableCell>
                  </TableRow>
                ) : (
                  adjustments.map((a) => (
                    <TableRow
                      key={a.id}
                      className="hover:bg-muted/30"
                      data-testid="cosign-a-row"
                    >
                      <TableCell className="p-2 text-xs text-muted-foreground tabular-nums">
                        {new Date(a.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="p-2 text-xs">
                        @{users[a.admin_user_id] ?? a.admin_user_id}
                      </TableCell>
                      <TableCell className="p-2 text-xs">
                        @{users[a.target_id] ?? a.target_id}
                      </TableCell>
                      <TableCell className="p-2 text-xs">
                        <Badge
                          variant="outline"
                          className={
                            a.payload.direction === "CREDIT"
                              ? "border-emerald-500/40 text-emerald-400"
                              : "border-rose-500/40 text-rose-400"
                          }
                        >
                          {a.payload.direction.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-2 text-xs tabular-nums font-medium">
                        {formatMoney(a.payload.amount_kobo, fx).naira}
                      </TableCell>
                      <TableCell className="p-2 text-xs text-muted-foreground max-w-[260px] truncate">
                        {a.payload.reason}
                      </TableCell>
                      <TableCell className="p-2 text-xs text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-emerald-400"
                            onClick={() => onApproveAdjustment(a)}
                          >
                            <CheckCircle2 className="size-3" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-rose-400"
                            onClick={() => onRejectAdjustment(a)}
                          >
                            <X className="size-3" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
