"use client";

// ─────────────────────────────────────────────────────────────────────────────
// KillOverlayFrame + useKillOverlayPoll: the shared shell of the two kill data broadcast overlays
// (inbox #398 kill stats overlay, #421b player duel overlay; mockups/duel-overlay/, mockups/kill-feed-tab/).
//
//   * KillOverlayFrame draws a fixed 1920x1080 canvas (what an OBS Browser Source is) and scales it to
//     fit the window, so the same page is also readable in a normal browser tab for a preview. The page
//     is transparent (html.overlay, see app/overlay/layout.tsx); only the panels paint.
//   * useKillOverlayPoll asks AFC-B GET events/kill-stats/ (lib/killStats.ts) every few seconds with no
//     reload. The server answers 403 kill_stats_off until the event's "Live overlays" kill stats switch
//     (Event.kill_feed_overlay) is on, so the overlay stays blank until then and starts drawing by itself
//     the moment an organizer turns it on.
// Used by app/overlay/kill-stats/[slug]/page.tsx and app/overlay/duel/[slug]/page.tsx. The links are built
// by components/overlay/LiveKillOverlaysCard.tsx on the event's overlay studio page.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { killStatsApi, type KillStats } from "@/lib/killStats";

/** How often the overlays ask for new kills (ms). A map's kills arrive when Capture or the debugger upload sends it. */
export const KILL_POLL_MS = 4000;

export type PollState<T> = { data: T | null; blocked: boolean };

/** Polls `read` every KILL_POLL_MS. `blocked` is true while the server refuses (switch off): draw nothing. */
export function useKillOverlayPoll<T>(read: () => Promise<T>, deps: unknown[]): PollState<T> {
  const [state, setState] = useState<PollState<T>>({ data: null, blocked: false });
  const reader = useRef(read);
  reader.current = read;
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const data = await reader.current();
        if (alive) setState({ data, blocked: false });
      } catch (e: any) {
        // 403 / 404: the switch is off or the event is unknown, so draw nothing. Any other failure
        // (network blip) keeps the last picture on air.
        const status = e?.response?.status;
        if (alive && (status === 403 || status === 404)) setState({ data: null, blocked: true });
      }
    };
    tick();
    const id = setInterval(tick, KILL_POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/** The event-wide answer (players, teams, head to head, who killed whom), optionally for one stage. */
export const readKillStats = (slug: string, stage: number | null) => (): Promise<KillStats> =>
  killStatsApi.get(slug, stage);

/** Ids that changed since the last answer, for one second: a changed row fills with colour once. */
export function useChanged(values: Record<string, string | number>): Set<string> {
  const prev = useRef<Record<string, string | number> | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const sig = JSON.stringify(values);
  useEffect(() => {
    const before = prev.current;
    prev.current = values;
    if (!before) return; // the first picture is not news
    const hit = Object.keys(values).filter((k) => before[k] !== values[k]);
    if (!hit.length) return;
    setChanged(new Set(hit));
    const id = setTimeout(() => setChanged(new Set()), 1200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return changed;
}

export function KillOverlayFrame({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div className="fixed inset-0 overflow-hidden">
      <div
        className="ko-canvas"
        style={{ width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: "0 0" }}
      >
        {children}
      </div>
      <style jsx global>{`
        /* The look comes from the event overlay family: dark filled panels, AFC green, DM Sans, flat fills. */
        .ko-canvas { position: relative; color: #f4f6f5; }
        .ko-panel { background: rgba(8, 10, 9, 0.84); border-radius: 20px; }
        .ko-soft { color: #a9b3ae; }
        .ko-a { color: #34d27b; }
        .ko-b { color: #f2c14e; }
        .ko-chip { border-radius: 999px; padding: 6px 18px; background: rgba(8, 10, 9, 0.84); font-weight: 700; letter-spacing: 0.08em; font-size: 22px; }
        .ko-rise { animation: ko-rise 450ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes ko-rise { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
        .ko-bump { animation: ko-bump 500ms cubic-bezier(0.2, 1.4, 0.4, 1); }
        @keyframes ko-bump { 0% { transform: scale(1); } 40% { transform: scale(1.28); } 100% { transform: scale(1); } }
        .ko-fill { transition: background-color 900ms ease-out; }
        .ko-fill.hit-a { background-color: rgba(52, 210, 123, 0.28); transition: none; }
        .ko-fill.hit-b { background-color: rgba(242, 193, 78, 0.28); transition: none; }
        @media (prefers-reduced-motion: reduce) {
          .ko-rise, .ko-bump { animation: none; }
          .ko-fill { transition: none; }
        }
      `}</style>
    </div>
  );
}
