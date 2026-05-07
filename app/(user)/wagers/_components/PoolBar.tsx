"use client";

import { motion } from "framer-motion";

interface PoolBarProps {
  /** Option's cached pool in kobo. */
  pool_kobo: number;
  /** Total market pool in kobo. */
  total_pool_kobo: number;
  /** Optional label rendered above the bar. */
  label?: string;
  /** Optional badge value (e.g. "12 wagers") rendered above the bar on the right. */
  badge?: string;
  /** Tailwind color class applied to the fill (default primary). */
  colorClass?: string;
  /** Show pct text inside the bar */
  showPct?: boolean;
  /** When true, render with a thinner height for compact lists. */
  compact?: boolean;
}

export function PoolBar({
  pool_kobo,
  total_pool_kobo,
  label,
  badge,
  colorClass = "bg-primary",
  showPct = true,
  compact = false,
}: PoolBarProps) {
  const pct =
    total_pool_kobo > 0
      ? Math.max(2, Math.min(100, (pool_kobo / total_pool_kobo) * 100))
      : 0;

  return (
    <div className="flex flex-col gap-1" data-testid="pool-bar">
      {(label || badge) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="text-foreground">{label}</span>}
          {badge && <span className="text-muted-foreground">{badge}</span>}
        </div>
      )}
      <div
        className={`relative w-full overflow-hidden rounded-full bg-muted ${compact ? "h-1.5" : "h-2.5"}`}
      >
        <motion.div
          className={`h-full rounded-full ${colorClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          data-testid="pool-bar-fill"
        />
        {showPct && pct > 12 && !compact && (
          <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-medium text-primary-foreground/90">
            {pct.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}
