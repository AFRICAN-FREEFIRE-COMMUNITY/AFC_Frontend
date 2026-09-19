"use client";

// ── Admin · Wagers · Markets tab ─────────────────────────────────────────────────────────────
// Every market, newest first, with status / event / pool / count / lock time, filtered by
// status, event and kind, searched by title. A row leads to /a/wagers/[slug]. Tick rows to lock
// or void several at once; export the current filter as CSV (up to 200 rows).
// Reads GET /wagers/admin/markets/ (listAdminMarkets); bulk writes go through lockMarket /
// voidMarket one market at a time, so each gets its own audit line.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconDownload, IconSearch, IconX } from "@tabler/icons-react";

import { LocalTime } from "@/components/LocalTime";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { naira } from "@/lib/api/wagers";
import {
  listAdminMarkets, listTemplates, lockMarket, pickerEvents, voidMarket,
  type AdminMarketRow, type MarketTemplate, type PickerEvent,
} from "@/lib/api/wagersAdmin";

import { downloadCsv, MarketStatusBadge, Pager, useAdminRefusal } from "./shared";

const LIMIT = 25;
const STATUSES = ["ALL", "DRAFT", "OPEN", "LOCKED", "PENDING_SETTLEMENT", "SETTLED", "VOID"] as const;

export function MarketsTab() {
  const t = useTranslations("wagersAdmin");
  const refuse = useAdminRefusal();
  const [rows, setRows] = useState<AdminMarketRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<string>("ALL");
  const [event, setEvent] = useState<string>("ALL");
  const [template, setTemplate] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [events, setEvents] = useState<PickerEvent[]>([]);
  const [templates, setTemplates] = useState<MarketTemplate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const params = useCallback((limit: number, off: number) => ({
    status: status === "ALL" ? undefined : status,
    event: event === "ALL" ? undefined : event,
    template: template === "ALL" ? undefined : template,
    q: q.trim() || undefined,
    limit, offset: off,
  }), [status, event, template, q]);

  const load = useCallback(async () => {
    try {
      const page = await listAdminMarkets(params(LIMIT, offset));
      setRows(page.results);
      setTotal(page.total_count);
      setSelected([]);
    } catch (err) {
      refuse(err);
      setRows([]);
    }
  }, [params, offset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setOffset(0); }, [status, event, template, q]);
  useEffect(() => {
    pickerEvents().then(setEvents).catch(() => setEvents([]));
    listTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  const toggle = (slug: string) => setSelected((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));
  const selectedRows = (rows ?? []).filter((m) => selected.includes(m.slug));
  const lockable = selectedRows.filter((m) => m.status === "OPEN");
  const voidable = selectedRows.filter((m) => m.status === "OPEN" || m.status === "LOCKED" || m.status === "PENDING_SETTLEMENT");

  const bulk = async (targets: AdminMarketRow[], fn: (slug: string) => Promise<{ message: string }>, done: string) => {
    setBusy(true);
    let ok = 0;
    for (const m of targets) {
      try {
        await fn(m.slug);
        ok += 1;
      } catch (err) {
        refuse(err);
      }
    }
    setBusy(false);
    setVoiding(false);
    setReason("");
    toast.success(t(done, { n: ok }));
    await load();
  };

  const exportCsv = async () => {
    try {
      const page = await listAdminMarkets(params(200, 0));
      downloadCsv(`wager-markets-${new Date().toISOString().slice(0, 10)}.csv`,
        ["slug", "title", "event", "status", "template", "pool_naira", "wagers", "lock_at", "settled_option", "created_by", "created_at"],
        page.results.map((m) => [m.slug, m.title, m.event.name, m.status, m.template, (m.pool_kobo / 100).toFixed(2), m.wager_count, m.lock_at, m.settled_option ?? "", m.created_by ?? "", m.created_at]));
    } catch (err) {
      refuse(err);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 md:grid-cols-4">
        <div className="relative md:col-span-1">
          <IconSearch className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("markets.search")} className="pl-9" aria-label={t("markets.search")} />
          {q && (
            <button type="button" className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2" onClick={() => setQ("")} aria-label={t("markets.clearSearch")}>
              <IconX className="size-4" />
            </button>
          )}
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label={t("markets.statusFilter")}><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s === "ALL" ? t("markets.allStatuses") : t(`marketStatus.${s}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={event} onValueChange={setEvent}>
          <SelectTrigger aria-label={t("markets.eventFilter")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("markets.allEvents")}</SelectItem>
            {events.map((e) => <SelectItem key={e.id} value={e.slug}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={template} onValueChange={setTemplate}>
          <SelectTrigger aria-label={t("markets.templateFilter")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("markets.allTemplates")}</SelectItem>
            {templates.map((x) => <SelectItem key={x.code} value={x.code}>{x.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {selected.length > 0 && (
            <>
              <Button size="sm" disabled={busy || lockable.length === 0} onClick={() => void bulk(lockable, lockMarket, "markets.bulkLocked")}>{t("markets.lockSelected", { n: lockable.length })}</Button>
              <Button size="sm" variant="destructive" disabled={busy || voidable.length === 0} onClick={() => setVoiding(true)}>{t("markets.voidSelected", { n: voidable.length })}</Button>
              <Button size="sm" variant="secondary" onClick={() => setSelected([])}>{t("form.selectNone")}</Button>
            </>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={() => void exportCsv()}><IconDownload />{t("common.exportCsv")}</Button>
      </div>

      {rows === null ? (
        <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">{q || status !== "ALL" || event !== "ALL" || template !== "ALL" ? t("markets.emptyFiltered") : t("markets.empty")}</p>
      ) : (
        <div className="bg-card rounded-md p-2 shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox aria-label={t("form.selectAll")} checked={selected.length === rows.length && rows.length > 0} onCheckedChange={(v) => setSelected(v ? rows.map((m) => m.slug) : [])} />
                  </TableHead>
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
                    <TableCell><Checkbox aria-label={m.title} checked={selected.includes(m.slug)} onCheckedChange={() => toggle(m.slug)} /></TableCell>
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

      <Dialog open={voiding} onOpenChange={(v) => !busy && setVoiding(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("markets.voidSelected", { n: voidable.length })}</DialogTitle>
            <DialogDescription>{t("markets.bulkVoidIntro")}</DialogDescription>
          </DialogHeader>
          <ul className="text-muted-foreground max-h-40 overflow-y-auto text-xs">{voidable.map((m) => <li key={m.slug}>{m.title} · {naira(m.pool_kobo)}</li>)}</ul>
          <div className="flex flex-col gap-1">
            <Label>{t("void.reason")}</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("void.reasonPlaceholder")} />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setVoiding(false)} disabled={busy}>{t("common.cancel")}</Button>
            <Button variant="destructive" disabled={busy || reason.trim().length < 3} onClick={() => void bulk(voidable, (slug) => voidMarket(slug, reason.trim()), "markets.bulkVoided")}>{t("void.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
