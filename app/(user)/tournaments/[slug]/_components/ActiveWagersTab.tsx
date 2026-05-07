"use client";

// Active Wagers section embedded on the tournament detail page (M13.1).
// Pulls OPEN markets for the given event from the wager mock and
// renders them as a MarketCard grid, mirroring the /wagers list style.
//
// AFC tournament slugs (from the real backend) are not 1:1 with wager-mock
// event_ids. We accept either the resolved event_id directly, or a slug
// that we look up against the seeded events table. If neither matches,
// we render the empty state ("no active wagers for this event yet").

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { MarketCard } from "@/app/(user)/wagers/_components/MarketCard";
import { listMarkets } from "@/lib/mock-wager/handlers/markets";
import { getBalance } from "@/lib/mock-wager/handlers/wallet";
import { getCurrentUser } from "@/lib/mock-wager/handlers/auth";
import { runSeed } from "@/lib/mock-wager/seed";
import { getDB } from "@/lib/mock-wager/store";
import { subscribe } from "@/lib/mock-wager/pubsub";
import type { FxSnapshot, Market } from "@/lib/mock-wager/types";

interface ActiveWagersTabProps {
  /**
   * The event_id matching the wager mock (e.g. "e_champs_finals") OR
   * the AFC slug ("afc-champs-finals") which we resolve against the
   * seeded events table. If neither resolves, the empty state shows.
   */
  eventIdOrSlug: string;
}

export function ActiveWagersTab({ eventIdOrSlug }: ActiveWagersTabProps) {
  const [loading, setLoading] = useState(true);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [fx, setFx] = useState<FxSnapshot | null>(null);
  const [resolvedEventId, setResolvedEventId] = useState<string | null>(null);

  const resolveEventId = async (input: string): Promise<string | null> => {
    const db = await getDB();
    const direct = await db.get("events", input);
    if (direct) return direct.id;
    const all = await db.getAll("events");
    const bySlug = all.find((e) => e.slug === input);
    return bySlug?.id ?? null;
  };

  const refresh = async (eid: string) => {
    const list = await listMarkets({ event_id: eid, status: "OPEN" });
    setMarkets(list);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await runSeed();
      const cur = await getCurrentUser();
      try {
        const userId = cur?.id ?? "player_1";
        const b = await getBalance(userId);
        if (!cancelled) setFx(b.fx);
      } catch {
        if (!cancelled) {
          setFx({
            id: "fx_default",
            captured_at: new Date().toISOString(),
            ngn_per_usd: 1500,
            source: "fallback",
          });
        }
      }
      const eid = await resolveEventId(eventIdOrSlug);
      if (cancelled) return;
      setResolvedEventId(eid);
      if (eid) await refresh(eid);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIdOrSlug]);

  useEffect(() => {
    if (loading || !resolvedEventId) return;
    const eid = resolvedEventId;
    const off1 = subscribe("pool:updated", () => refresh(eid));
    const off2 = subscribe("market:locked", () => refresh(eid));
    const off3 = subscribe("market:settled", () => refresh(eid));
    return () => {
      off1();
      off2();
      off3();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, resolvedEventId]);

  return (
    <Card className="gap-0" data-testid="active-wagers-tab">
      <CardHeader>
        <CardTitle className="text-xl mb-3">Active Wagers</CardTitle>
      </CardHeader>
      <CardContent>
        {loading || !fx ? (
          <div className="flex min-h-[120px] items-center justify-center">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : markets.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No active wagers for this event yet.
          </p>
        ) : (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
            data-testid="active-wagers-grid"
          >
            {markets.map((m) => (
              <MarketCard key={m.id} market={m} fx={fx} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
