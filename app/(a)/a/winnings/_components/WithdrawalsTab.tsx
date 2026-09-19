"use client";

// ── Admin · Winnings · Withdrawals tab ───────────────────────────────────────────────────────
// The payout queue. Approve sends the Paystack transfer (above the co-sign threshold the first
// approval only signs and a DIFFERENT admin has to approve again); reject needs a reason and
// releases the hold; mark paid is the head admin's hand override when the transfer webhook
// never arrived. Reads GET /wagers/admin/withdrawals/; writes .../{approve,reject,mark-paid}/.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { LocalTime } from "@/components/LocalTime";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { naira } from "@/lib/api/wagers";
import {
  approveWithdrawal, listWithdrawals, markWithdrawalPaid, rejectWithdrawal, type StaffWithdrawal,
} from "@/lib/api/wagersAdmin";

import { Pager, useAdminRefusal, useWagerRoles, WithdrawalStatusBadge } from "../../wagers/_components/shared";

const LIMIT = 25;
const FILTERS = ["OPEN", "REQUESTED", "PENDING_COSIGN", "APPROVED", "PAID", "FAILED", "REJECTED", "CANCELLED", "ALL"] as const;

export function WithdrawalsTab() {
  const t = useTranslations("wagersAdmin");
  const refuse = useAdminRefusal();
  const { isHead } = useWagerRoles();
  const [rows, setRows] = useState<StaffWithdrawal[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<string>("OPEN");
  const [rejecting, setRejecting] = useState<StaffWithdrawal | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const page = await listWithdrawals({ status: filter === "ALL" ? undefined : filter, limit: LIMIT, offset });
      setRows(page.results);
      setTotal(page.total_count);
      setSelected([]);
    } catch (err) {
      refuse(err);
      setRows([]);
    }
  }, [filter, offset]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setOffset(0); }, [filter]);

  const run = async (token: string, fn: () => Promise<{ message: string }>) => {
    setBusy(token);
    try {
      const out = await fn();
      toast.success(out.message);
      setRejecting(null);
      setReason("");
      await load();
    } catch (err) {
      refuse(err);
    } finally {
      setBusy(null);
    }
  };

  const canApprove = (w: StaffWithdrawal) => w.status === "REQUESTED" || w.status === "PENDING_COSIGN" || w.status === "FAILED";
  const approvable = (rows ?? []).filter((w) => selected.includes(w.token) && canApprove(w));
  // Batch approve: one call per withdrawal so each keeps its own audit line and its own answer
  // (a co-sign refusal on one does not stop the rest).
  const approveSelected = async () => {
    setBusy("batch");
    let ok = 0;
    for (const w of approvable) {
      try {
        await approveWithdrawal(w.token);
        ok += 1;
      } catch (err) {
        refuse(err);
      }
    }
    setBusy(null);
    toast.success(t("withdrawals.approvedN", { n: ok }));
    await load();
  };
  const canReject = (w: StaffWithdrawal) => w.status === "REQUESTED" || w.status === "PENDING_COSIGN" || w.status === "FAILED";
  const canMarkPaid = (w: StaffWithdrawal) => isHead && w.status === "APPROVED";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">{t("withdrawals.intro")}</p>
        <div className="flex flex-wrap items-center gap-2">
          {approvable.length > 0 && <Button size="sm" disabled={busy !== null} onClick={() => void approveSelected()}>{t("withdrawals.approveSelected", { n: approvable.length })}</Button>}
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-56" aria-label={t("withdrawals.filter")}><SelectValue /></SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => <SelectItem key={f} value={f}>{f === "OPEN" ? t("withdrawals.open") : f === "ALL" ? t("withdrawals.all") : t(`withdrawalStatus.${f}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        </div>
      </div>
      {rows === null ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">{t("withdrawals.empty")}</p>
      ) : (
        <div className="bg-card rounded-md p-2 shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox aria-label={t("form.selectAll")} checked={rows.filter(canApprove).length > 0 && selected.length === rows.filter(canApprove).length} onCheckedChange={(v) => setSelected(v ? rows.filter(canApprove).map((w) => w.token) : [])} />
                  </TableHead>
                  <TableHead>{t("players.colPlayer")}</TableHead>
                  <TableHead className="text-right">{t("withdrawals.colAmount")}</TableHead>
                  <TableHead>{t("withdrawals.colBank")}</TableHead>
                  <TableHead>{t("withdrawals.colStatus")}</TableHead>
                  <TableHead>{t("withdrawals.colRequested")}</TableHead>
                  <TableHead>{t("withdrawals.colReviewed")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((w, i) => (
                  <TableRow key={w.token} className={i % 2 ? "bg-muted/40" : ""}>
                    <TableCell>{canApprove(w) && <Checkbox aria-label={w.token} checked={selected.includes(w.token)} onCheckedChange={() => setSelected((s) => (s.includes(w.token) ? s.filter((x) => x !== w.token) : [...s, w.token]))} />}</TableCell>
                    <TableCell className="font-medium"><Link href={`/a/winnings/players/${w.user}`} className="hover:underline">{w.user}</Link></TableCell>
                    <TableCell className="text-right font-semibold">{naira(w.amount_kobo)}</TableCell>
                    <TableCell>
                      {w.bank.bank_name} {w.bank.account_number}
                      <p className="text-muted-foreground text-[11px]">{w.bank.account_name}</p>
                    </TableCell>
                    <TableCell>
                      <WithdrawalStatusBadge status={w.status} />
                      {w.reject_reason && <p className="text-muted-foreground mt-1 text-[11px]">{w.reject_reason}</p>}
                      {w.failure_reason && <p className="text-destructive mt-1 text-[11px]">{w.failure_reason}</p>}
                      {w.transfer_reference && <p className="text-muted-foreground mt-1 text-[11px]">{w.transfer_reference}</p>}
                    </TableCell>
                    <TableCell><LocalTime value={w.created_at} mode="datetime" /></TableCell>
                    <TableCell>
                      {w.reviewed_by ?? "-"}{w.cosigned_by ? ` + ${w.cosigned_by}` : ""}
                      {w.reviewed_at && <p className="text-muted-foreground text-[11px]"><LocalTime value={w.reviewed_at} mode="datetime" /></p>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        {canApprove(w) && <Button size="sm" disabled={busy === w.token} onClick={() => void run(w.token, () => approveWithdrawal(w.token))}>{w.status === "PENDING_COSIGN" ? t("withdrawals.cosign") : w.status === "FAILED" ? t("withdrawals.retry") : t("withdrawals.approve")}</Button>}
                        {canReject(w) && <Button size="sm" variant="secondary" disabled={busy === w.token} onClick={() => setRejecting(w)}>{t("withdrawals.reject")}</Button>}
                        {canMarkPaid(w) && <Button size="sm" variant="secondary" disabled={busy === w.token} onClick={() => void run(w.token, () => markWithdrawalPaid(w.token))}>{t("withdrawals.markPaid")}</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      <Pager offset={offset} limit={LIMIT} total={total} onChange={setOffset} />

      <Dialog open={rejecting !== null} onOpenChange={(v) => !busy && !v && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("withdrawals.rejectTitle")}</DialogTitle>
            <DialogDescription>{rejecting && t("withdrawals.rejectIntro", { amount: naira(rejecting.amount_kobo), user: rejecting.user })}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label>{t("withdrawals.rejectReason")}</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("withdrawals.rejectPlaceholder")} />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejecting(null)} disabled={!!busy}>{t("common.cancel")}</Button>
            <Button variant="destructive" disabled={!!busy || reason.trim().length < 3} onClick={() => rejecting && void run(rejecting.token, () => rejectWithdrawal(rejecting.token, reason.trim()))}>{t("withdrawals.reject")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
