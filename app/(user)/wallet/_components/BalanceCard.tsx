"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import { Coins, Gift, Lock, ShoppingBag, Trophy } from "lucide-react";
import type { Balance } from "@/lib/mock-wager/types";

interface BalanceCardProps {
  balance: Balance;
}

interface BucketProps {
  label: string;
  amount_kobo: number;
  fx: Balance["fx"];
  icon: React.ReactNode;
  accent?: "muted" | "primary" | "gold" | "blue" | "orange";
}

const accentClasses: Record<NonNullable<BucketProps["accent"]>, string> = {
  muted: "bg-muted text-muted-foreground",
  primary: "bg-primary/15 text-primary",
  gold: "bg-amber-500/15 text-amber-500",
  blue: "bg-blue-500/15 text-blue-400",
  orange: "bg-orange-500/15 text-orange-400",
};

function Bucket({ label, amount_kobo, fx, icon, accent = "muted" }: BucketProps) {
  const m = formatMoney(amount_kobo, fx);
  return (
    <div className="flex items-start gap-3 rounded-md border bg-background/40 p-3">
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${accentClasses[accent]}`}
      >
        {icon}
      </div>
      <div className="flex min-w-0 flex-col">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold tabular-nums">{m.coins} coins</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {m.naira} <span className="text-[10px]">/ {m.usd}</span>
        </p>
      </div>
    </div>
  );
}

export function BalanceCard({ balance }: BalanceCardProps) {
  const total = formatMoney(balance.total_kobo, balance.fx);
  return (
    <Card className="bg-card" data-testid="balance-card">
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Coins className="size-4" />
            </div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Total balance
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <p
              className="text-3xl md:text-4xl font-bold tabular-nums text-primary"
              data-testid="balance-total-coins"
            >
              {total.coins}{" "}
              <span className="text-base text-muted-foreground">coins</span>
            </p>
            <p className="text-sm text-muted-foreground tabular-nums">
              {total.naira}{" "}
              <span className="text-xs">approx {total.usd}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Bucket
            label="Purchased"
            amount_kobo={balance.purchased_kobo}
            fx={balance.fx}
            icon={<ShoppingBag className="size-4" />}
            accent="blue"
          />
          <Bucket
            label="Won"
            amount_kobo={balance.won_kobo}
            fx={balance.fx}
            icon={<Trophy className="size-4" />}
            accent="gold"
          />
          <Bucket
            label="Gift"
            amount_kobo={balance.gift_kobo}
            fx={balance.fx}
            icon={<Gift className="size-4" />}
            accent="primary"
          />
          <Bucket
            label="Locked in wagers"
            amount_kobo={balance.locked_kobo}
            fx={balance.fx}
            icon={<Lock className="size-4" />}
            accent="orange"
          />
        </div>
      </CardContent>
    </Card>
  );
}
