"use client";

// ── Admin · Winnings · Ledger tab ────────────────────────────────────────────────────────────
// Every ledger line: player lines (payouts, refunds, holds, adjustments) and house lines (rake,
// cancel fees, dust). Filter by kind, player, house only, or a reference (a wager or withdrawal
// token, a market slug). The `note` column is the English audit sentence written with the
// line. Reads GET /wagers/admin/ledger/.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { naira } from "@/lib/api/wagers";
import { listAdminLedger, type AdminLedgerRow } from "@/lib/api/wagersAdmin";

import { Pager, useAdminRefusal } from "../../wagers/_components/shared";

const LIMIT = 50;
const KINDS = ["ALL", "PAYOUT", "VOID_REFUND", "CANCEL_REFUND", "WITHDRAWAL_HOLD", "WITHDRAWAL_PAID", "WITHDRAWAL_RELEASED", "ADJUSTMENT_CREDIT", "ADJUSTMENT_DEBIT", "HOUSE_RAKE", "HOUSE_CANCEL_FEE", "HOUSE_DUST"] as const;

export function LedgerTab({ user: fixedUser }: { user?: string } = {}) {
  const t = useTranslations("wagersAdmin");
  const refuse = useAdminRefusal();
  const [rows, setRows] = useState<AdminLedgerRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [kind, setKind] = useState<string>("ALL");
  const [user, setUser] = useState(fixedUser ?? "");
  const [ref, setRef] = useState("");
  const [house, setHouse] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await listAdminLedger({
        kind: kind === "ALL" ? undefined : kind,
        user: user.trim() || undefined,
        ref: ref.trim() || undefined,
        house: house ? "1" : undefined,
        limit: LIMIT, offset,
      });
      setRows(page.results);
      setTotal(page.total_count);
    } catch (err) {
      refuse(err);
      setRows([]);
    }
  }, [kind, user, ref, house, offset]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setOffset(0); }, [kind, user, ref, house]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 md:grid-cols-4">
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger aria-label={t("ledger.kind")}><SelectValue /></SelectTrigger>
          <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{k === "ALL" ? t("ledger.allKinds") : t(`ledgerKind.${k}`)}</SelectItem>)}</SelectContent>
        </Select>
        {!fixedUser && <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder={t("ledger.user")} aria-label={t("ledger.user")} />}
        <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={t("ledger.ref")} aria-label={t("ledger.ref")} />
        {!fixedUser && <label className="flex items-center gap-2 text-sm"><Switch checked={house} onCheckedChange={setHouse} />{t("ledger.houseOnly")}</label>}
      </div>
      {rows === null ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">{t("ledger.empty")}</p>
      ) : (
        <div className="bg-card rounded-md p-2 shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("ledger.colWhen")}</TableHead>
                  <TableHead>{t("ledger.colAccount")}</TableHead>
                  <TableHead>{t("ledger.kind")}</TableHead>
                  <TableHead className="text-right">{t("ledger.colAmount")}</TableHead>
                  <TableHead className="text-right">{t("ledger.colHeld")}</TableHead>
                  <TableHead className="text-right">{t("ledger.colAfter")}</TableHead>
                  <TableHead>{t("ledger.colRef")}</TableHead>
                  <TableHead>{t("ledger.colNote")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e, i) => (
                  <TableRow key={e.id} className={i % 2 ? "bg-muted/40" : ""}>
                    <TableCell className="whitespace-nowrap"><LocalTime value={e.created_at} mode="datetime" /></TableCell>
                    <TableCell>{e.is_house ? <Badge variant="secondary">{t("ledger.house")}</Badge> : <Link href={`/a/winnings/players/${e.user}`} className="hover:underline">{e.user}</Link>}</TableCell>
                    <TableCell>{t(`ledgerKind.${e.kind}`)}</TableCell>
                    <TableCell className={`text-right font-semibold ${e.amount_kobo > 0 && !e.is_house ? "text-primary" : ""}`}>{e.amount_kobo ? naira(e.amount_kobo) : "-"}</TableCell>
                    <TableCell className="text-right">{e.held_delta_kobo ? `${e.held_delta_kobo > 0 ? "+" : "-"}${naira(Math.abs(e.held_delta_kobo))}` : "-"}</TableCell>
                    <TableCell className="text-right">{e.is_house ? "-" : naira(e.balance_after_kobo)}</TableCell>
                    <TableCell>
                      {e.ref_kind === "market" ? <Link href={`/a/wagers/${e.ref}`} className="hover:underline">{e.label || e.ref}</Link> : <>{e.label || ""}{e.label && e.ref ? " · " : ""}<code className="text-[11px]">{e.ref}</code></>}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs">{e.note}{e.created_by ? ` (${e.created_by})` : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      <Pager offset={offset} limit={LIMIT} total={total} onChange={setOffset} />
    </div>
  );
}
