"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Coins, Trophy } from "lucide-react";
import Link from "next/link";
import { PoolBar } from "./PoolBar";
import { LockCountdown } from "./LockCountdown";
import { formatMoney } from "@/lib/utils";
import type {
  FxSnapshot,
  Market,
  MarketStatus,
  Wager,
} from "@/lib/mock-wager/types";

export type MarketCardVariant = "open" | "locked" | "settled" | "my-wager" | "draft";

interface MarketCardProps {
  market: Market;
  fx: FxSnapshot;
  /**
   * Override the visual variant. If omitted, the variant is derived from
   * market.status. When `wager` is set, "my-wager" overlay is enabled
   * regardless of the underlying status.
   */
  variant?: MarketCardVariant;
  wager?: Wager | null;
  /** Optional event-name label rendered as a small tag at the top. */
  eventLabel?: string;
}

function deriveVariant(status: MarketStatus, hasMyWager: boolean): MarketCardVariant {
  if (hasMyWager) return "my-wager";
  if (status === "OPEN") return "open";
  if (status === "LOCKED" || status === "PENDING_SETTLEMENT") return "locked";
  if (status === "SETTLED" || status === "VOIDED") return "settled";
  return "draft";
}

const STATUS_BADGE: Record<MarketCardVariant, { label: string; className: string }> = {
  open: { label: "Open", className: "border-emerald-500/40 text-emerald-400" },
  locked: { label: "Locked", className: "border-orange-500/40 text-orange-400" },
  settled: { label: "Settled", className: "border-muted text-muted-foreground" },
  draft: { label: "Draft", className: "border-muted text-muted-foreground" },
  "my-wager": {
    label: "My Wager",
    className: "border-primary/50 text-primary",
  },
};

const OPTION_COLORS = [
  "bg-primary",
  "bg-amber-500",
  "bg-blue-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-emerald-500",
];

export function MarketCard({
  market,
  fx,
  variant: variantProp,
  wager,
  eventLabel,
}: MarketCardProps) {
  const variant = variantProp ?? deriveVariant(market.status, !!wager);
  const status = STATUS_BADGE[variant];

  const totalPool = formatMoney(market.total_pool_kobo, fx);
  const top = [...market.options]
    .sort((a, b) => b.cached_pool_kobo - a.cached_pool_kobo)
    .slice(0, 3);

  const myStake = wager
    ? formatMoney(wager.total_stake_kobo, fx)
    : null;

  const ctaLabel =
    variant === "open"
      ? "Place Wager"
      : variant === "locked"
        ? "View Pool"
        : variant === "my-wager"
          ? "View Wager"
          : "View Result";

  return (
    <Card
      className={`group relative overflow-hidden transition-shadow hover:shadow-md hover:border-primary/30 ${variant === "my-wager" ? "border-primary/40" : ""}`}
      data-testid="market-card"
      data-variant={variant}
    >
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            {eventLabel && (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {eventLabel}
              </span>
            )}
            <h3 className="text-sm md:text-base font-semibold leading-tight line-clamp-2">
              {market.title}
            </h3>
          </div>
          <Badge variant="outline" className={status.className}>
            {status.label}
          </Badge>
        </div>

        {variant === "open" || variant === "my-wager" ? (
          <LockCountdown lockAt={market.lock_at} compact />
        ) : null}

        {top.length > 0 && market.total_pool_kobo > 0 ? (
          <div className="flex flex-col gap-1.5">
            {top.map((opt, idx) => (
              <PoolBar
                key={opt.id}
                pool_kobo={opt.cached_pool_kobo}
                total_pool_kobo={market.total_pool_kobo}
                label={opt.label}
                badge={`${opt.cached_wager_count} wagers`}
                colorClass={OPTION_COLORS[idx % OPTION_COLORS.length]}
                showPct
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            No wagers placed yet — be the first.
          </p>
        )}

        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-1.5 text-xs">
            <Coins className="size-3.5 text-muted-foreground" />
            <span className="tabular-nums font-medium">
              {totalPool.coins} coins
            </span>
            <span className="text-muted-foreground tabular-nums">
              · {totalPool.naira}
            </span>
          </div>
          {myStake && (
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <Trophy className="size-3.5" />
              <span className="tabular-nums">{myStake.coins} staked</span>
            </div>
          )}
        </div>

        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/wagers/${market.id}`}>
            {ctaLabel}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
