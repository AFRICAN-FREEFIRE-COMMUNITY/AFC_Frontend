"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Lock,
  Ban,
  CheckCircle2,
  Eye,
  Pencil,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { listMarkets, lockMarket, voidMarket } from "@/lib/mock-wager/handlers/markets";
import { runSeed } from "@/lib/mock-wager/seed";
import { getDB } from "@/lib/mock-wager/store";
import { formatMoney } from "@/lib/utils";
import type { Market, MarketStatus } from "@/lib/mock-wager/types";

const STATUS_OPTIONS: (MarketStatus | "ALL")[] = [
  "ALL",
  "DRAFT",
  "OPEN",
  "LOCKED",
  "PENDING_SETTLEMENT",
  "SETTLED",
  "VOIDED",
];

const STATUS_BADGE: Record<MarketStatus, string> = {
  DRAFT: "border-muted text-muted-foreground",
  OPEN: "border-emerald-500/40 text-emerald-400",
  LOCKED: "border-orange-500/40 text-orange-400",
  PENDING_SETTLEMENT: "border-blue-500/40 text-blue-400",
  SETTLED: "border-muted text-muted-foreground",
  VOIDED: "border-rose-500/40 text-rose-400",
};

export default function AdminWagersClient() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [statusFilter, setStatusFilter] = useState<MarketStatus | "ALL">("ALL");
  const [eventFilter, setEventFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const refresh = async () => {
    const all = await listMarkets({});
    setMarkets(all);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await runSeed();
      const db = await getDB();
      const evs = await db.getAll("events");
      if (cancelled) return;
      setEvents(evs.map((e) => ({ id: e.id, name: e.name })));
      await refresh();
      setBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    let out = markets;
    if (statusFilter !== "ALL") out = out.filter((m) => m.status === statusFilter);
    if (eventFilter !== "ALL") out = out.filter((m) => m.event_id === eventFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q),
      );
    }
    return out.sort(
      (a, b) => new Date(b.opens_at).getTime() - new Date(a.opens_at).getTime(),
    );
  }, [markets, statusFilter, eventFilter, search]);

  const eventName = (id: string) => events.find((e) => e.id === id)?.name ?? "";

  const onLock = async (m: Market) => {
    if (!confirm(`Lock "${m.title}" now? No new wagers can be placed after this.`)) return;
    try {
      await lockMarket({ market_id: m.id, admin_user_id: "head_admin_jay" });
      toast.success("Market locked");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onVoid = async (m: Market) => {
    const reason = prompt(`Void "${m.title}" — reason?`);
    if (!reason) return;
    try {
      await voidMarket({
        market_id: m.id,
        reason,
        admin_user_id: "head_admin_jay",
      });
      toast.success("Market voided. All wagers refunded.");
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

  const fx = markets[0]?.options ? null : null; // for table money fmt — pull from txns
  const defaultFx = {
    id: "fx_admin",
    captured_at: new Date().toISOString(),
    ngn_per_usd: 1500,
    source: "admin",
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Wager Markets"
        description="Create, publish, lock, void, and settle pari-mutuel markets across all AFC events."
        action={
          <Button asChild size="sm">
            <Link href="/a/wagers/new">
              <Plus className="size-4" />
              New Market
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search title or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as MarketStatus | "ALL")}
            >
              <SelectTrigger className="w-full md:w-[180px]" data-testid="status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "ALL" ? "All statuses" : s.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All events</SelectItem>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table className="text-xs" data-testid="markets-table">
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="text-foreground p-2 text-xs">Title</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Event</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Status</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Pool</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Lines</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Lock at</TableHead>
                  <TableHead className="text-foreground p-2 text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="p-4 text-center text-muted-foreground"
                    >
                      No markets match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((m) => (
                    <TableRow key={m.id} className="hover:bg-muted/30" data-testid="market-row">
                      <TableCell className="p-2 text-xs">
                        <Link
                          href={`/a/wagers/${m.id}`}
                          className="font-medium hover:underline"
                        >
                          {m.title}
                        </Link>
                      </TableCell>
                      <TableCell className="p-2 text-xs text-muted-foreground">
                        {eventName(m.event_id)}
                      </TableCell>
                      <TableCell className="p-2 text-xs">
                        <Badge
                          variant="outline"
                          className={STATUS_BADGE[m.status]}
                        >
                          {m.status.replace("_", " ").toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-2 text-xs tabular-nums">
                        {formatMoney(m.total_pool_kobo, defaultFx).coins}
                      </TableCell>
                      <TableCell className="p-2 text-xs tabular-nums">
                        {m.total_lines}
                      </TableCell>
                      <TableCell className="p-2 text-xs text-muted-foreground tabular-nums">
                        {new Date(m.lock_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="p-2 text-xs text-right">
                        <RowActions
                          market={m}
                          onLock={() => onLock(m)}
                          onVoid={() => onVoid(m)}
                        />
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

function RowActions({
  market,
  onLock,
  onVoid,
}: {
  market: Market;
  onLock: () => void;
  onVoid: () => void;
}) {
  const s = market.status;
  return (
    <div className="flex justify-end gap-1">
      {s === "DRAFT" && (
        <>
          <Button asChild size="sm" variant="ghost" className="h-7 px-2">
            <Link href={`/a/wagers/${market.id}`}>
              <Pencil className="size-3" />
              Edit
            </Link>
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2">
            Publish
          </Button>
        </>
      )}
      {s === "OPEN" && (
        <>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onLock}>
            <Lock className="size-3" />
            Lock
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-400" onClick={onVoid}>
            <Ban className="size-3" />
            Void
          </Button>
        </>
      )}
      {s === "LOCKED" && (
        <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-400" onClick={onVoid}>
          <Ban className="size-3" />
          Void
        </Button>
      )}
      {s === "PENDING_SETTLEMENT" && (
        <Button asChild size="sm" variant="default" className="h-7 px-2">
          <Link href={`/a/wagers/settlement-queue`}>
            <CheckCircle2 className="size-3" />
            Settle
          </Link>
        </Button>
      )}
      {s === "SETTLED" && (
        <Button asChild size="sm" variant="ghost" className="h-7 px-2">
          <Link href={`/a/wagers/${market.id}`}>
            <Eye className="size-3" />
            View Payout
          </Link>
        </Button>
      )}
    </div>
  );
}
