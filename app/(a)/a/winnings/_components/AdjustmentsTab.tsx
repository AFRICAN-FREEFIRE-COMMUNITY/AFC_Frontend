"use client";

// ── Admin · Winnings · Adjustments tab ───────────────────────────────────────────────────────
// Every credit or debit an admin made to a player's Winnings, with its reason, and the ones
// above the co-sign threshold waiting for a second, different admin. The adjustment itself is
// made from the player's page. Reads GET /wagers/admin/adjustments/; writes .../cosign/.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { naira } from "@/lib/api/wagers";
import { cosignAdjustment, listAdjustments, type Adjustment } from "@/lib/api/wagersAdmin";

import { Pager, useAdminRefusal, useWagerRoles } from "../../wagers/_components/shared";

const LIMIT = 25;

export function AdjustmentsTab() {
  const t = useTranslations("wagersAdmin");
  const refuse = useAdminRefusal();
  const { isHead } = useWagerRoles();
  const [rows, setRows] = useState<Adjustment[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<string>("ALL");
  const [rejecting, setRejecting] = useState<Adjustment | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const page = await listAdjustments({ status: filter === "ALL" ? undefined : filter, limit: LIMIT, offset });
      setRows(page.results);
      setTotal(page.total_count);
    } catch (err) {
      refuse(err);
      setRows([]);
    }
  }, [filter, offset]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setOffset(0); }, [filter]);

  const decide = async (adj: Adjustment, approve: boolean) => {
    setBusy(adj.id);
    try {
      const out = await cosignAdjustment(adj.id, approve, approve ? "" : reason.trim());
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">{t("adjustments.intro")}</p>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-56" aria-label={t("adjustments.filter")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("adjustments.all")}</SelectItem>
            <SelectItem value="PENDING_COSIGN">{t("adjustmentStatus.PENDING_COSIGN")}</SelectItem>
            <SelectItem value="EXECUTED">{t("adjustmentStatus.EXECUTED")}</SelectItem>
            <SelectItem value="REJECTED">{t("adjustmentStatus.REJECTED")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {rows === null ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">{t("adjustments.empty")}</p>
      ) : (
        <div className="bg-card rounded-md p-2 shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("players.colPlayer")}</TableHead>
                  <TableHead className="text-right">{t("adjustments.colAmount")}</TableHead>
                  <TableHead>{t("adjustments.colReason")}</TableHead>
                  <TableHead>{t("adjustments.colStatus")}</TableHead>
                  <TableHead>{t("adjustments.colBy")}</TableHead>
                  <TableHead>{t("adjustments.colWhen")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a, i) => (
                  <TableRow key={a.id} className={i % 2 ? "bg-muted/40" : ""}>
                    <TableCell className="font-medium"><Link href={`/a/winnings/players/${a.user}`} className="hover:underline">{a.user}</Link></TableCell>
                    <TableCell className={`text-right font-semibold ${a.direction === "CREDIT" ? "text-primary" : ""}`}>{a.direction === "CREDIT" ? "+" : "-"}{naira(a.amount_kobo)}</TableCell>
                    <TableCell className="max-w-xs">{a.reason}{a.reject_reason && <p className="text-muted-foreground text-[11px]">{t("adjustments.rejectedBecause", { reason: a.reject_reason })}</p>}</TableCell>
                    <TableCell><Badge variant={a.status === "EXECUTED" ? "default" : a.status === "REJECTED" ? "destructive" : "pending"}>{t(`adjustmentStatus.${a.status}`)}</Badge></TableCell>
                    <TableCell>{a.submitted_by ?? "-"}{a.cosigned_by ? ` + ${a.cosigned_by}` : ""}</TableCell>
                    <TableCell><LocalTime value={a.executed_at ?? a.created_at} mode="datetime" /></TableCell>
                    <TableCell>
                      {a.status === "PENDING_COSIGN" && isHead && (
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button size="sm" disabled={busy === a.id} onClick={() => void decide(a, true)}>{t("adjustments.cosign")}</Button>
                          <Button size="sm" variant="secondary" disabled={busy === a.id} onClick={() => setRejecting(a)}>{t("adjustments.reject")}</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      <Pager offset={offset} limit={LIMIT} total={total} onChange={setOffset} />

      <Dialog open={rejecting !== null} onOpenChange={(v) => busy === null && !v && setRejecting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("adjustments.rejectTitle")}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-1">
            <Label>{t("adjustments.colReason")}</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejecting(null)} disabled={busy !== null}>{t("common.cancel")}</Button>
            <Button variant="destructive" disabled={busy !== null || reason.trim().length < 3} onClick={() => rejecting && void decide(rejecting, false)}>{t("adjustments.reject")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
