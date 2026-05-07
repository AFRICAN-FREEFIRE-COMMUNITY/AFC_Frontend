"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import type { FxSnapshot, MarketOption } from "@/lib/mock-wager/types";

interface PoolBreakdownChartProps {
  options: MarketOption[];
  total_pool_kobo: number;
  fx: FxSnapshot;
}

const COLORS = [
  "#22c55e", // primary green
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#f43f5e", // rose
  "#a855f7", // violet
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#eab308", // yellow
];

interface Slice {
  name: string;
  value: number;
  fill: string;
  pct: number;
}

interface RechartsTooltipPayload {
  payload: Slice;
  name: string;
  value: number;
}

export function PoolBreakdownChart({
  options,
  total_pool_kobo,
  fx,
}: PoolBreakdownChartProps) {
  const data: Slice[] = options.map((opt, idx) => ({
    name: opt.label,
    value: opt.cached_pool_kobo,
    fill: COLORS[idx % COLORS.length],
    pct: total_pool_kobo > 0 ? (opt.cached_pool_kobo / total_pool_kobo) * 100 : 0,
  }));

  const totalText = formatMoney(total_pool_kobo, fx);

  return (
    <Card data-testid="pool-breakdown-chart">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Pool breakdown</CardTitle>
          <span className="text-xs text-muted-foreground tabular-nums">
            {totalText.coins} coins · {totalText.naira}
          </span>
        </div>

        {total_pool_kobo === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No coins in the pool yet.
          </p>
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  stroke="rgba(0,0,0,0)"
                >
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const slice = (payload[0] as unknown as RechartsTooltipPayload).payload;
                    const m = formatMoney(slice.value, fx);
                    return (
                      <div className="rounded-md border bg-background p-2 text-xs shadow-md">
                        <p className="font-medium">{slice.name}</p>
                        <p className="text-muted-foreground tabular-nums">
                          {slice.pct.toFixed(1)}%
                        </p>
                        <p className="tabular-nums">
                          {m.coins} coins · {m.naira} · {m.usd}
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {data.map((d) => (
            <div
              key={d.name}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: d.fill }}
                />
                <span className="truncate">{d.name}</span>
              </div>
              <span className="text-muted-foreground tabular-nums">
                {d.pct.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
