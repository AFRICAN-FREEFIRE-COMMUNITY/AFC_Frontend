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
  // Per-overlay background behaviour (owner 2026-07-02): overrides the design's stored default.
  if (cfg.bg_behavior) qp.set("bg", String(cfg.bg_behavior));
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

// ── Booyah banner scene (owner 2026-07-02): fires when a team wins a map. ──
// NO auto-hide (owner 2026-07-02: "remove auto hide from all overlays"): the banner stays on until
// the operator hits Hide in the studio, or the next booyah trigger replaces it. shown_at keys the
// pop-in animation so a re-trigger animates again.
function BooyahView({ feed }: { feed: OverlayConfigFeed }) {
  const cfg = feed.config as {
    team_name?: string; team_logo?: string | null; match_map?: string; shown_at?: string;
  };
  if (!feed.active || !cfg?.team_name) return null;
  // Design template (owner 2026-07-02): the picked design's bg + colors set the look; the booyah
  // team's ROSTER (player esport images + names) rides below the team plaque.
  const design = feed.booyah?.design;
  const roster = feed.booyah?.roster ?? [];
  const text = design?.text_color || "#ffffff";
  const accent = design?.accent_color || "#34d27b";

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden">
      {design?.background && !design.transparent ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={design.background} alt="" className="absolute inset-0 size-full object-cover" />
      ) : null}
      <div
        key={cfg.shown_at || "booyah"}
        className="relative flex flex-col items-center gap-4"
        style={{ animation: "afc-booyah-in 700ms cubic-bezier(0.16,1,0.3,1) both" }}
      >
        <div
          className="font-black uppercase tracking-widest"
          style={{ color: accent, fontSize: "8rem", lineHeight: 1, textShadow: "0 6px 32px rgba(0,0,0,0.95)" }}
        >
          BOOYAH!
        </div>
        <div
          className="flex items-center gap-4 rounded-2xl border bg-black/75 px-10 py-4"
          style={{ borderColor: `${accent}80` }}
        >
          {cfg.team_logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cfg.team_logo} alt="" style={{ height: 72, width: 72, objectFit: "contain" }} />
          ) : null}
          <div>
            <p className="text-4xl font-bold" style={{ color: text, textShadow: "0 3px 16px rgba(0,0,0,0.9)" }}>
              {cfg.team_name}
            </p>
            {cfg.match_map ? (
              <p className="text-lg uppercase tracking-[0.2em] opacity-70" style={{ color: text }}>
                {cfg.match_map}
              </p>
            ) : null}
          </div>
        </div>
        {/* The booyah team's players: esport image + name per member (fixed-size cells). */}
        {roster.length > 0 ? (
          <div className="flex flex-wrap items-start justify-center gap-3">
            {roster.map((pl, i) => (
              <div
                key={`${pl.name}-${i}`}
                className="flex w-28 flex-col items-center gap-1.5 rounded-xl border bg-black/70 p-2.5"
                style={{ borderColor: `${accent}50` }}
              >
                {pl.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pl.image}
                    alt=""
                    className="rounded-md"
                    style={{ height: 72, width: 72, objectFit: "cover" }}
                  />
                ) : (
                  <div
                    className="flex items-center justify-center rounded-md text-3xl font-bold"
                    style={{ height: 72, width: 72, background: "#111", color: accent }}
                  >
                    {pl.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <p className="max-w-full truncate text-xs font-semibold" style={{ color: text }}>
                  {pl.name}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <style jsx global>{`
        @keyframes afc-booyah-in {
          from { opacity: 0; transform: scale(0.7); }
          60%  { opacity: 1; transform: scale(1.06); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ── Head-to-head scene (owner 2026-07-02, v1): 2-3 TEAM or PLAYER slots compared on their
// THIS-EVENT stats, styled by the picked design (bg + colors). The full "versus" design-editor
// type (placeable slots) is the next phase; this layout is the AFC house style.
const H2H_STAT_LABELS: Record<string, string> = {
  kills: "KILLS", damage: "DAMAGE", assists: "ASSISTS", deaths: "DEATHS",
  headshots: "HEADSHOTS", survival_seconds: "SURVIVAL (S)", matches: "MATCHES",
  points: "POINTS", booyahs: "BOOYAHS",
};

function H2HView({ feed }: { feed: OverlayConfigFeed }) {
  const h2h = feed.h2h;
  if (!feed.active || !h2h || h2h.competitors.length < 2) return null;
  const design = h2h.design;
  const text = design?.text_color || "#ffffff";
  const accent = design?.accent_color || "#34d27b";
  // Which stat rows show: the VERSUS design's picked stat_keys (order = display order,
  // owner 2026-07-02 "shows based off what is in the design selected"); when the design has
  // none configured, every stat present on the competitors, in the canonical order above.
  const picked = (design as any)?.stat_keys as string[] | undefined;
  const keys = (picked && picked.length
    ? picked.filter((k) => k in H2H_STAT_LABELS)
    : Object.keys(H2H_STAT_LABELS)
  ).filter((k) => h2h.competitors.some((c) => c.stats[k] !== undefined));

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden">
      {design?.background && !design.transparent ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={design.background} alt="" className="absolute inset-0 size-full object-cover" />
      ) : null}
      <div
        className="relative flex items-stretch gap-6"
        style={{ animation: "afc-h2h-in 700ms cubic-bezier(0.16,1,0.3,1) both" }}
      >
        {h2h.competitors.map((c, i) => (
          <div key={`${c.name}-${i}`} className="flex items-center gap-6">
            {i > 0 ? (
              <div
                className="self-center rounded-full border px-5 py-2 text-3xl font-black"
                style={{ color: accent, borderColor: accent, background: "rgba(0,0,0,0.75)" }}
              >
                VS
              </div>
            ) : null}
            <div
              className="flex w-72 flex-col items-center gap-3 rounded-2xl border bg-black/75 p-6"
              style={{ borderColor: `${accent}80` }}
            >
              {c.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.image}
                  alt=""
                  style={{ height: 120, width: 120, objectFit: "contain" }}
                  className="rounded-md"
                />
              ) : null}
              <p
                className="max-w-full truncate text-center text-2xl font-bold"
                style={{ color: text, textShadow: "0 3px 14px rgba(0,0,0,0.9)" }}
              >
                {c.name}
              </p>
              <div className="w-full space-y-1.5">
                {keys.map((k) => (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span className="uppercase tracking-wider opacity-70" style={{ color: text }}>
                      {H2H_STAT_LABELS[k]}
                    </span>
                    <span className="text-lg font-bold" style={{ color: accent }}>
                      {c.stats[k] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <style jsx global>{`
        @keyframes afc-h2h-in {
          from { opacity: 0; transform: translateY(30px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
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
  if (feed.kind === "booyah") {
    return <BooyahView feed={feed} />;
  }
  if (feed.kind === "h2h") {
    return <H2HView feed={feed} />;
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
