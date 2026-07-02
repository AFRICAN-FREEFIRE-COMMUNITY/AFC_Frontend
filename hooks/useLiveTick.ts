"use client";

// ── useLiveTick: the site-wide LIVE-REFRESH heartbeat (owner 2026-07-02) ────────
// "I don't want to refresh pages for things to reflect" - pages subscribe to this tick and re-run
// their read-only data fetches when it advances, so lists/details/tabs update by themselves.
//
// HOW IT TICKS:
//   • every `intervalMs` (default 15s - owner 2026-07-02: 30s felt too slow) WHILE the tab is visible (hidden tabs pause - no wasted
//     polling in background windows), and
//   • immediately when the user returns to the tab (focus / visibilitychange), so stale pages
//     catch up the moment they're looked at.
//
// HOW TO CONSUME (the convention every wired page follows):
//   const tick = useLiveTick();
//   useEffect(() => { load(tick > 0); }, [tick, ...]);   // tick 0 = the normal first load
// `load(background)` should SKIP its full-page loading spinner when background=true so live
// refreshes never flash the UI. Forms/editors must NOT subscribe (a background refetch would
// clobber what the user is typing) - only read-only display data.

import { useEffect, useState } from "react";

export function useLiveTick(intervalMs = 15000): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") setTick((t) => t + 1);
      }, intervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    // Catch-up tick on tab return; pause the interval while hidden.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setTick((t) => t + 1);
        start();
      } else {
        stop();
      }
    };
    const onFocus = () => setTick((t) => t + 1);

    start();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [intervalMs]);

  return tick;
}
