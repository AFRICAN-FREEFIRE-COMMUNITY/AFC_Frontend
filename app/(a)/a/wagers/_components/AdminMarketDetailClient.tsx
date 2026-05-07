"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { Loader2, Lock, Ban, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { LockCountdown } from "@/app/(user)/wagers/_components/LockCountdown";
import {
  getMarket,
  lockMarket,
  voidMarket,
} from "@/lib/mock-wager/handlers/markets";
import { runSeed } from "@/lib/mock-wager/seed";
import { getDB } from "@/lib/mock-wager/store";
import { formatMoney } from "@/lib/utils";
import type { FxSnapshot, Market, MarketStatus } from "@/lib/mock-wager/types";

const STATUS_BADGE: Record<MarketStatus, string> = {
  DRAFT: "border-muted text-muted-foreground",
  OPEN: "border-emerald-500/40 text-emerald-400",
  LOCKED: "border-orange-500/40 text-orange-400",
  PENDING_SETTLEMENT: "border-blue-500/40 text-blue-400",
  SETTLED: "border-muted text-muted-foreground",
  VOIDED: "border-rose-500/40 text-rose-400",
};

const fx: FxSnapshot = {
  id: "fx_admin",
  captured_at: new Date().toISOString(),
  ngn_per_usd: 1500,
  source: "admin",
};

export default function AdminMarketDetailClient({ marketId }: { marketId: string }) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [market, setMarket] = useState<Market | null>(null);
  const [eventName, setEventName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const m = await getMarket(marketId);
      setMarket(m);
      const db = await getDB();
      const ev = await db.get("events", m.event_id);
      setEventName(ev?.name ?? "");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await runSeed();
      if (cancelled) return;
      await refresh();
      setBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId]);

  const onLock = async () => {
    if (!market) return;
    if (!confirm(`Lock "${market.title}" now?`)) return;
    try {
      await lockMarket({ market_id: market.id, admin_user_id: "head_admin_jay" });
      toast.success("Locked");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onVoid = async () => {
    if (!market) return;
    const reason = prompt(`Void "${market.title}" — reason?`);
    if (!reason) return;
    try {
      await voidMarket({
        market_id: market.id,
        reason,
        admin_user_id: "head_admin_jay",
      });
      toast.success("Voided. All wagers refunded.");
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

  if (error || !market) {
    return (
      <Card>
        <CardContent>
          <CardTitle>Market not found</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardContent>
      </Card>
    );
  }

  const totalPool = formatMoney(market.total_pool_kobo, fx);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={market.title}
        description={`${eventName} · ${market.template_code}`}
        back
        action={
          <Badge variant="outline" className={STATUS_BADGE[market.status]}>
            {market.status.replace("_", " ").toLowerCase()}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="admin-market-detail">
        <Card className="md:col-span-2">
          <CardContent className="flex flex-col gap-2">
            <CardTitle>Description</CardTitle>
            <CardDescription>{market.description}</CardDescription>
            {market.status === "OPEN" && (
              <div className="mt-2">
                <LockCountdown lockAt={market.lock_at} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <CardTitle>Pool</CardTitle>
            <div className="flex flex-col gap-0.5 tabular-nums">
              <span className="text-2xl font-bold text-primary">
                {totalPool.coins}
              </span>
              <span className="text-xs text-muted-foreground">
                {totalPool.naira} · {totalPool.usd}
              </span>
              <span className="text-xs text-muted-foreground">
                {market.total_lines} lines
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <CardTitle>Options</CardTitle>
          <div className="rounded-md border overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="text-foreground p-2 text-xs">Label</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Pool</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Wagers</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">% of pool</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {market.options.map((o) => {
                  const pct =
                    market.total_pool_kobo > 0
                      ? (o.cached_pool_kobo / market.total_pool_kobo) * 100
                      : 0;
                  return (
                    <TableRow key={o.id} className="hover:bg-muted/30">
                      <TableCell className="p-2 text-xs font-medium">
                        {o.label}
                        {market.winning_option_id === o.id && (
                          <Badge
                            variant="outline"
                            className="ml-2 border-emerald-500/40 text-emerald-400"
                          >
                            Winner
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="p-2 text-xs tabular-nums">
                        {formatMoney(o.cached_pool_kobo, fx).coins}
                      </TableCell>
                      <TableCell className="p-2 text-xs tabular-nums">
                        {o.cached_wager_count}
                      </TableCell>
                      <TableCell className="p-2 text-xs tabular-nums">
                        {pct.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap gap-2">
            {market.status === "OPEN" && (
              <>
                <Button size="sm" onClick={onLock}>
                  <Lock className="size-3.5" />
                  Lock now
                </Button>
                <Button size="sm" variant="outline" className="text-rose-400" onClick={onVoid}>
                  <Ban className="size-3.5" />
                  Void
                </Button>
              </>
            )}
            {market.status === "LOCKED" && (
              <Button size="sm" variant="outline" className="text-rose-400" onClick={onVoid}>
                <Ban className="size-3.5" />
                Void
              </Button>
            )}
            {market.status === "PENDING_SETTLEMENT" && (
              <Button asChild size="sm">
                <Link href="/a/wagers/settlement-queue">
                  <CheckCircle2 className="size-3.5" />
                  Open settlement queue
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
