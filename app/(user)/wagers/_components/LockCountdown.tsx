"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Timer } from "lucide-react";
import { mockNow } from "@/lib/mock-wager/clock";

interface LockCountdownProps {
  /** ISO string for lock_at. */
  lockAt: string;
  /** Fired exactly once when the countdown crosses 0. */
  onLocked?: () => void;
  /** Compact size for use inside cards. */
  compact?: boolean;
}

/**
 * Self-contained countdown that ticks every ~1s via requestAnimationFrame.
 * Below 60s, switches to red accent and a pulse ring. At 0, calls onLocked
 * once and renders "Awaiting Result".
 */
export function LockCountdown({ lockAt, onLocked, compact }: LockCountdownProps) {
  const [now, setNow] = useState<number>(() => mockNow());
  const lockMs = new Date(lockAt).getTime();
  const remaining = lockMs - now;
  const firedRef = useRef<boolean>(false);

  useEffect(() => {
    let raf = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      setNow(mockNow());
      raf = requestAnimationFrame(() => {
        // Throttle to ~1s
        setTimeout(tick, 1000);
      });
    };
    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      onLocked?.();
    }
  }, [remaining, onLocked]);

  if (remaining <= 0) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-muted bg-muted/40 px-3 py-1 ${compact ? "text-[11px]" : "text-xs"} text-muted-foreground`}
        data-testid="lock-countdown"
        data-status="locked"
      >
        <Lock className="size-3" />
        Awaiting Result
      </div>
    );
  }

  const totalSec = Math.floor(remaining / 1000);
  const days = Math.floor(totalSec / (3600 * 24));
  const hrs = Math.floor((totalSec % (3600 * 24)) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  let text: string;
  if (days > 0) text = `${days}d ${hrs}h ${mins}m`;
  else if (hrs > 0) text = `${hrs}h ${mins}m ${secs.toString().padStart(2, "0")}s`;
  else text = `${mins}:${secs.toString().padStart(2, "0")}`;

  const hot = totalSec < 60;

  return (
    <motion.div
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${compact ? "text-[11px]" : "text-xs"} ${hot ? "border-rose-500/50 bg-rose-500/10 text-rose-400" : "border-primary/30 bg-primary/5 text-primary"}`}
      animate={
        hot
          ? {
              boxShadow: [
                "0 0 0 0 rgba(244,63,94,0.0)",
                "0 0 0 4px rgba(244,63,94,0.15)",
                "0 0 0 0 rgba(244,63,94,0.0)",
              ],
            }
          : {}
      }
      transition={{ duration: 1, repeat: hot ? Infinity : 0 }}
      data-testid="lock-countdown"
      data-status={hot ? "hot" : "open"}
    >
      <Timer className="size-3" />
      <span className="tabular-nums" data-testid="lock-countdown-text">
        {text}
      </span>
    </motion.div>
  );
}
