"use client";

// ── Admin · Wagers · Markets tab ─────────────────────────────────────────────────────────────
// Every market, newest first, with status / event / pool / count / lock time, filtered by
// status and searched by title or event. A row leads to /a/wagers/[slug].
// Reads GET /wagers/admin/markets/ (listAdminMarkets).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconSearch, IconX } from "@tabler/icons-react";

import { LocalTime } from "@/components/LocalTime";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { naira } from "@/lib/api/wagers";
import { listAdminMarkets, type AdminMarketRow } from "@/lib/api/wagersAdmin";

import { MarketStatusBadge, Pager, useAdminRefusal } from "./shared";

const LIMIT = 25;
const STATUSES = ["ALL", "DRAFT", "OPEN", "LOCKED", "PENDING_SETTLEMENT", "SETTLED", "VOID"] as const;

export function MarketsTab() {
  const t = useTranslations("wagersAdmin");
  const refuse = useAdminRefusal();
  const [rows, setRows] = useState<AdminMarketRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<string>("ALL");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      const page = await listAdminMarkets({
        status: status === "ALL" ? undefined : status,
        q: q.trim() || undefined,
        limit: LIMIT,
        offset,
      });
      setRows(page.results);
      setTotal(page.total_count);
    } catch (err) {
      refuse(err);
      setRows([]);
    }
  }, [status, q, offset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setOffset(0); }, [status, q]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row">
        <div className="relative flex-1">
          <IconSearch className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("markets.search")} className="pl-9" aria-label={t("markets.search")} />
          {q && (
            <button type="button" className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2" onClick={() => setQ("")} aria-label={t("markets.clearSearch")}>
              <IconX className="size-4" />
            </button>
          )}
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-56" aria-label={t("markets.statusFilter")}><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s === "ALL" ? t("markets.allStatuses") : t(`marketStatus.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows === null ? (
        <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">{q || status !== "ALL" ? t("markets.emptyFiltered") : t("markets.empty")}</p>
      ) : (
        <div className="bg-card rounded-md p-2 shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("markets.colTitle")}</TableHead>
                  <TableHead>{t("markets.colEvent")}</TableHead>
                  <TableHead>{t("markets.colStatus")}</TableHead>
                  <TableHead className="text-right">{t("markets.colPool")}</TableHead>
                  <TableHead className="text-right">{t("markets.colWagers")}</TableHead>
                  <TableHead>{t("markets.colLock")}</TableHead>
                  <TableHead>{t("markets.colSuggested")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m, i) => (
                  <TableRow key={m.slug} className={i % 2 ? "bg-muted/40" : ""}>
                    <TableCell className="font-medium">
                      <Link href={`/a/wagers/${m.slug}`} className="hover:underline">{m.title}</Link>
                      {m.featured && <span className="text-primary ml-2 text-[10px] font-semibold uppercase">{t("markets.featured")}</span>}
                    </TableCell>
                    <TableCell>{m.event.name}</TableCell>
                    <TableCell><MarketStatusBadge status={m.status} /></TableCell>
                    <TableCell className="text-right">{naira(m.pool_kobo)}</TableCell>
                    <TableCell className="text-right">{m.wager_count}</TableCell>
                    <TableCell><LocalTime value={m.lock_at} mode="datetime" /></TableCell>
                    <TableCell>{m.settled_option ?? m.suggested_option ?? "-"}</TableCell>
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
