"use client";

// ── Admin · Winnings · Players tab ───────────────────────────────────────────────────────────
// Every Winnings account, largest balance first, searchable by username or email, with the
// frozen and with-balance filters. A row leads to /a/winnings/players/[username].
// Reads GET /wagers/admin/users/.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconSearch, IconX } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { naira } from "@/lib/api/wagers";
import { listAccounts, type AdminAccountRow } from "@/lib/api/wagersAdmin";

import { Pager, useAdminRefusal } from "../../wagers/_components/shared";

const LIMIT = 25;

export function PlayersTab() {
  const t = useTranslations("wagersAdmin");
  const refuse = useAdminRefusal();
  const [rows, setRows] = useState<AdminAccountRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "with_balance" | "frozen">("all");

  const load = useCallback(async () => {
    try {
      const page = await listAccounts({
        q: q.trim() || undefined,
        frozen: filter === "frozen" ? "1" : undefined,
        with_balance: filter === "with_balance" ? "1" : undefined,
        limit: LIMIT, offset,
      });
      setRows(page.results);
      setTotal(page.total_count);
    } catch (err) {
      refuse(err);
      setRows([]);
    }
  }, [q, filter, offset]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setOffset(0); }, [q, filter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row">
        <div className="relative flex-1">
          <IconSearch className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("players.search")} className="pl-9" aria-label={t("players.search")} />
          {q && <button type="button" className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2" onClick={() => setQ("")} aria-label={t("markets.clearSearch")}><IconX className="size-4" /></button>}
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="md:w-56" aria-label={t("players.filter")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("players.all")}</SelectItem>
            <SelectItem value="with_balance">{t("players.withBalance")}</SelectItem>
            <SelectItem value="frozen">{t("players.frozenOnly")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {rows === null ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">{t("players.empty")}</p>
      ) : (
        <div className="bg-card rounded-md p-2 shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("players.colPlayer")}</TableHead>
                  <TableHead className="text-right">{t("players.colBalance")}</TableHead>
                  <TableHead className="text-right">{t("players.colHeld")}</TableHead>
                  <TableHead>{t("players.colState")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a, i) => (
                  <TableRow key={a.username} className={i % 2 ? "bg-muted/40" : ""}>
                    <TableCell className="font-medium">
                      <Link href={`/a/winnings/players/${a.username}`} className="hover:underline">{a.username}</Link>
                      <p className="text-muted-foreground text-[11px] font-normal">{a.email}</p>
                    </TableCell>
                    <TableCell className="text-right">{naira(a.balance_kobo)}</TableCell>
                    <TableCell className="text-right">{naira(a.held_kobo)}</TableCell>
                    <TableCell>{a.frozen ? <Badge variant="destructive">{t("players.frozen")}</Badge> : <Badge variant="secondary">{t("players.ok")}</Badge>}</TableCell>
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
