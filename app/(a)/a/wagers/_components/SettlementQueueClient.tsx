"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Loader2, Inbox } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PendingMarketCard } from "./PendingMarketCard";
import {
  listPendingSettlements,
  type PendingSettlementRow,
} from "@/lib/mock-wager/handlers/admin";
import { runSeed } from "@/lib/mock-wager/seed";
import { getDB } from "@/lib/mock-wager/store";

export default function SettlementQueueClient() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [rows, setRows] = useState<PendingSettlementRow[]>([]);
  const [events, setEvents] = useState<Record<string, string>>({});

  const refresh = async () => {
    const list = await listPendingSettlements();
    setRows(list);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await runSeed();
      const db = await getDB();
      const evs = await db.getAll("events");
      if (cancelled) return;
      setEvents(Object.fromEntries(evs.map((e) => [e.id, e.name])));
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

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Settlement Queue · ${rows.length} pending`}
        description="Markets that locked and need a final ruling. Confirm the auto-suggestion, override with reason, or void if the match is disputed."
        back
      />

      {rows.length === 0 ? (
        <Card data-testid="settlement-queue-empty">
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Inbox className="size-6 text-muted-foreground" />
            </div>
            <CardTitle>Queue is clear</CardTitle>
            <CardDescription>
              No markets pending settlement. New ones will land here once they
              transition from LOCKED → PENDING_SETTLEMENT.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-3"
          data-testid="settlement-queue-grid"
        >
          {rows.map((r) => (
            <PendingMarketCard
              key={r.market.id}
              market={r.market}
              auto_suggested_option_id={r.auto_suggested_option_id}
              eventName={events[r.market.event_id]}
              onSettled={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
