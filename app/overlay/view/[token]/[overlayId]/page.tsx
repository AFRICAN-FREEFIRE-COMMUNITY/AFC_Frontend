"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /overlay/view/<overlay_token>/<overlayId> — the STABLE link behind ONE saved overlay
// (owner 2026-07-02, studio v2: "per overlay/scene it should be the same link").
//
// This page never carries settings in its URL. It polls the PUBLIC config feed
// (events/overlay/config/?token=&overlay=, lib/overlay.overlayConfigApi) every 3s and renders
// whatever the overlay currently IS:
//   • kind "leaderboard" → an inner iframe of the existing battle-tested leaderboard overlay page
//     (/overlay/leaderboard/<token>?…params built from config: design, stage/group or
//     follow-broadcast, animations, page interval, and LIVE in-round mode when config.live is on —
//     the capture client's 2s Redis snapshot keeps the board updating mid-round). The iframe is
//     re-mounted ONLY when the config actually changes, so an edit in the studio (new design, new
//     group…) animates in on the same OBS source with no re-copy.
//   • kind "timer" → the countdown scene (drift-corrected against server_time; transparent while
//     inactive, so triggering/hiding never touches OBS).
// Deleted overlay → the feed 404s → renders nothing (blank source).
// Add ONCE as a 1920x1080 Browser Source. Managed from app/(a)/a/overlays/[eventId] (the studio).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { env } from "@/lib/env";
import { overlayConfigApi, type OverlayConfigFeed } from "@/lib/overlay";

const POLL_MS = 3000;

// ── Build the inner leaderboard URL from a saved config (mirrors CopyOverlayLinkDialog). ──
function leaderboardUrl(token: string, eventId: number, cfg: Record<string, any>): string {
  const qp = new URLSearchParams();
  qp.set("type", "event");
  qp.set("event", String(eventId));
  // follow-broadcast omits stage+group so the board tracks the BroadcastControl selection.
  if (!cfg.follow) {
    if (cfg.stage_id) qp.set("stage", String(cfg.stage_id));
    if (cfg.group_id) qp.set("group", String(cfg.group_id));
  }
  if (cfg.design_id) qp.set("design", String(cfg.design_id));
  qp.set("size", "youtube");
  qp.set("anim", String(cfg.anim || "fade"));
  qp.set("reveal", String(cfg.reveal || "staggered"));
  qp.set("interval", String(cfg.interval || 10));
  if (cfg.live) qp.set("live", "1"); // in-round Tier-2 snapshot from the capture client (2s poll)
  return `/overlay/leaderboard/${token}?${qp.toString()}`;
}

// ── Timer scene view (moved from the old /overlay/timer route; same behaviour). ──
function TimerView({ feed, offset }: { feed: OverlayConfigFeed; offset: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const p = feed.config as { end_at?: string; label?: string };
  const endAt = p?.end_at ? new Date(p.end_at).getTime() : null;
  if (!feed.active || endAt == null) return null;

  const remainMs = Math.max(0, endAt - (now + offset));
  const totalSec = Math.floor(remainMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  const digits = h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
  const urgent = totalSec <= 10;

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div
        className="flex flex-col items-center gap-3"
        style={{ animation: "afc-timer-in 600ms ease-out both" }}
      >
        {p?.label ? (
          <div
            className="text-primary rounded-full border border-primary/50 bg-black/70 px-6 py-1.5 text-xl font-bold uppercase tracking-[0.25em]"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.9)" }}
          >
            {p.label}
          </div>
        ) : null}
        <div
          className={`rounded-2xl border bg-black/70 px-12 py-4 font-bold tabular-nums ${
            urgent ? "border-red-500/60 text-red-500" : "border-primary/50 text-white"
          }`}
          style={{
            fontSize: "9rem",
            lineHeight: 1.05,
            textShadow: "0 4px 24px rgba(0,0,0,0.9)",
            animation: urgent ? "afc-timer-pulse 1s ease-in-out infinite" : undefined,
          }}
        >
          {digits}
        </div>
      </div>
      <style jsx global>{`
        @keyframes afc-timer-in {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes afc-timer-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
}

export default function OverlayViewPage() {
  const params = useParams<{ token: string; overlayId: string }>();
  const token = params?.token ?? "";
  const overlayId = params?.overlayId ?? "";

  const [feed, setFeed] = useState<OverlayConfigFeed | null>(null);
  const [gone, setGone] = useState(false);
  const offsetRef = useRef(0); // server minus client clock, for the timer

  useEffect(() => {
    if (!token || !overlayId) return;
    let stop = false;
    const poll = async () => {
      try {
        const f = await overlayConfigApi(token, overlayId);
        if (stop) return;
        offsetRef.current = new Date(f.server_time).getTime() - Date.now();
        setFeed(f);
        setGone(false);
      } catch (err: any) {
        if (stop) return;
        // Deleted overlay (404) -> blank the source; transient errors keep the last state.
        if (err?.response?.status === 404) {
          setGone(true);
          setFeed(null);
        }
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [token, overlayId]);

  if (gone || !feed) return null;

  if (feed.kind === "timer") {
    return <TimerView feed={feed} offset={offsetRef.current} />;
  }

  // Leaderboard: render the existing overlay page inside a full-viewport iframe. Keyed by the
  // config JSON so ONLY a real change re-mounts it (fresh animate-in); poll ticks with an unchanged
  // config leave it alone — the inner page keeps its own feed polling + page cycling.
  const inner = leaderboardUrl(token, feed.event_id, feed.config as Record<string, any>);
  return (
    <iframe
      key={inner}
      src={inner}
      title={feed.name}
      className="h-screen w-screen border-0"
      style={{ background: "transparent" }}
      allowTransparency
    />
  );
}
