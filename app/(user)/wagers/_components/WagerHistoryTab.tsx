"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { MarketCard } from "./MarketCard";
import { listMyWagers } from "@/lib/mock-wager/handlers/wagers";
import { getMarket } from "@/lib/mock-wager/handlers/markets";
import { getBalance } from "@/lib/mock-wager/handlers/wallet";
import { runSeed } from "@/lib/mock-wager/seed";
import { subscribe } from "@/lib/mock-wager/pubsub";
import type { FxSnapshot, Market, Wager } from "@/lib/mock-wager/types";

interface WagerHistoryTabProps {
  /** The user whose wagers to display. Defaults to the seeded current user. */
  userId: string;
  /** Optional title override. Default: "My wagers". */
  title?: string;
}

/**
 * Self-contained wager-history pane suitable for embedding inside another
 * client component (e.g. /profile in M13). Renders MarketCard with the
 * `my-wager` variant for each wager.
 */
export function WagerHistoryTab({ userId, title = "My wagers" }: WagerHistoryTabProps) {
  const [loading, setLoading] = useState(true);
  const [wagers, setWagers] = useState<Wager[]>([]);
  const [markets, setMarkets] = useState<Map<string, Market>>(new Map());
  const [fx, setFx] = useState<FxSnapshot | null>(null);

  const refresh = async () => {
    const ws = await listMyWagers({ user_id: userId });
    setWagers(ws);
    const map = new Map<string, Market>();
    for (const w of ws) {
      try {
        const m = await getMarket(w.market_id);
        map.set(w.market_id, m);
      } catch {
        // skip if market is missing
      }
    }
    setMarkets(map);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await runSeed();
      try {
        const b = await getBalance(userId);
        if (!cancelled) setFx(b.fx);
      } catch {
        if (!cancelled)
          setFx({
            id: "fx_default",
            captured_at: new Date().toISOString(),
            ngn_per_usd: 1500,
            source: "fallback",
          });
      }
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (loading) return;
    const off = subscribe("market:settled", () => refresh());
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, userId]);

  if (loading || !fx) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (wagers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            You haven't placed any wagers yet. Browse open markets on the Wagers
            page.
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="wager-history-tab">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {wagers.map((w) => {
          const m = markets.get(w.market_id);
          if (!m) return null;
          return (
            <MarketCard
              key={w.id}
              market={m}
              fx={fx}
              wager={w}
              variant="my-wager"
            />
          );
        })}
      </div>
    </div>
  );
}
