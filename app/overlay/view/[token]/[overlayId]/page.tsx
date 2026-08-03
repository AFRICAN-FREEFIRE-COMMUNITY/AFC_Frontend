"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /overlay/view/<overlay_token>/<overlayId> - the STABLE link behind ONE saved overlay
// (owner 2026-07-02, studio v2: "per overlay/scene it should be the same link").
//
// This page never carries settings in its URL. It polls the PUBLIC config feed
// (events/overlay/config/?token=&overlay=, lib/overlay.overlayConfigApi) every 3s and renders
// whatever the overlay currently IS:
//   • kind "leaderboard" → an inner iframe of the existing battle-tested leaderboard overlay page
//     (/overlay/leaderboard/<token>?…params built from config: design, stage/group or
//     follow-broadcast, animations, page interval, and LIVE in-round mode when config.live is on - 
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
import {
  overlayConfigApi,
  type OverlayConfigFeed,
  type H2HBracketData,
  type H2HBracketMatch,
} from "@/lib/overlay";

// 1s poll (owner 2026-07-02: "when you trigger or load new options it should update in OBS as
// fast as possible") - the config feed is a light single-row read, so studio changes (trigger,
// design/team/bg swaps, live options) land on the OBS source within ~1s and play their entrance
// animation immediately. Was 3s.
const POLL_MS = 1000;

// ── Build the inner leaderboard URL from a saved config (mirrors CopyOverlayLinkDialog). ──
function leaderboardUrl(token: string, eventId: number, cfg: Record<string, any>): string {
  const qp = new URLSearchParams();
  qp.set("type", "event");
  qp.set("event", String(eventId));
  // follow-broadcast omits stage+group+groups+stages so the board tracks the BroadcastControl
  // selection. Otherwise the saved config's standings scope decides what this ONE stable link renders:
  //   • scope "combine" -> ?groups=<csv>&stages=<csv> (owner 2026-07-05, complaint C): merge the
  //     chosen groups + whole stages into one cumulative board;
  //   • single (default / legacy, no scope) -> the single ?stage=/?group=.
  // Editing the card re-saves config, so the SAME link re-renders the new scope with no re-copy.
  if (!cfg.follow) {
    if (cfg.scope === "combine") {
      const groupIds = Array.isArray(cfg.group_ids) ? cfg.group_ids : [];
      const stageIds = Array.isArray(cfg.stage_ids) ? cfg.stage_ids : [];
      if (groupIds.length) qp.set("groups", groupIds.join(","));
      if (stageIds.length) qp.set("stages", stageIds.join(","));
    } else {
      if (cfg.stage_id) qp.set("stage", String(cfg.stage_id));
      if (cfg.group_id) qp.set("group", String(cfg.group_id));
    }
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

// ── Clash Squad bracket overlay (P1#6, owner 2026-07-13) ─────────────────────
// A pure CS event has no BR stats to compare, so its h2h overlay renders the STAGE BRACKET the
// backend resolved (H2HBracketData, same shape the public bracket GET returns). Read-only, drawn
// over the picked design's look (bg + accent). Winners rounds render as left-to-right columns; a
// double-elim losers bracket renders as a second labelled row; a league/round-robin format shows a
// standings table (it has no tree). Matches the AFC house look of the other scene renderers.
function H2HBracketOverlay({
  bracket,
  design,
}: {
  bracket: H2HBracketData;
  design: NonNullable<OverlayConfigFeed["h2h"]>["design"];
}) {
  const text = design?.text_color || "#ffffff";
  const accent = design?.accent_color || "#34d27b";
  const isLeague = (bracket.rounds.league?.length ?? 0) > 0;

  // One match card: two team rows with scores; the winner's row is accent-highlighted. Byes render
  // the single present team as auto-advanced.
  const MatchCard = ({ m }: { m: H2HBracketMatch }) => {
    const row = (slot: "a" | "b") => {
      const team = slot === "a" ? m.team_a : m.team_b;
      const score = slot === "a" ? m.score_a : m.score_b;
      const isWinner =
        m.winner_id != null && team != null && team.tournament_team_id === m.winner_id;
      return (
        <div
          className="flex items-center justify-between gap-2 px-2 py-1"
          style={{
            background: isWinner ? `${accent}22` : "transparent",
            borderLeft: `3px solid ${isWinner ? accent : "transparent"}`,
          }}
        >
          <span
            className="truncate text-sm font-semibold"
            style={{ color: text, opacity: team ? 1 : 0.4 }}
          >
            {team ? team.team_name : m.is_bye ? "Bye" : "TBD"}
          </span>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: isWinner ? accent : text }}
          >
            {score ?? "-"}
          </span>
        </div>
      );
    };
    return (
      <div
        className="w-52 overflow-hidden rounded-lg border bg-black/75"
        style={{ borderColor: `${accent}55` }}
      >
        {row("a")}
        <div className="h-px" style={{ background: `${accent}33` }} />
        {row("b")}
      </div>
    );
  };

  // A labelled vertical column of the match cards for one round.
  const RoundColumn = ({
    label,
    matches,
  }: {
    label: string;
    matches: H2HBracketMatch[];
  }) => (
    <div className="flex flex-col justify-center gap-4">
      <p
        className="text-center text-xs font-bold uppercase tracking-widest"
        style={{ color: accent }}
      >
        {label}
      </p>
      <div className="flex flex-col justify-around gap-4" style={{ flex: 1 }}>
        {matches.map((m) => (
          <MatchCard key={m.h2h_match_id} m={m} />
        ))}
      </div>
    </div>
  );

  // Round label: the last winners round is the Final, the one before it the Semifinal.
  const roundLabel = (side: "winners" | "losers", idx: number, total: number) => {
    if (side === "losers") return `Lower R${idx + 1}`;
    const fromEnd = total - 1 - idx;
    if (fromEnd === 0) return "Final";
    if (fromEnd === 1) return "Semifinal";
    if (fromEnd === 2) return "Quarterfinal";
    return `Round ${idx + 1}`;
  };

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden">
      {design?.background && !design.transparent ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={design.background}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}

      <div
        className="relative flex flex-col items-center gap-6 rounded-2xl border bg-black/60 px-10 py-8"
        style={{
          borderColor: `${accent}66`,
          animation: "afc-h2h-in 700ms cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        <p
          className="text-2xl font-black uppercase tracking-wide"
          style={{ color: text, textShadow: "0 3px 14px rgba(0,0,0,0.9)" }}
        >
          {bracket.stage_name}
        </p>

        {isLeague ? (
          // League / round-robin: a standings table (no tree).
          <table className="border-separate" style={{ borderSpacing: "0 4px" }}>
            <thead>
              <tr style={{ color: accent }}>
                <th className="px-3 text-left text-xs uppercase tracking-wider">#</th>
                <th className="px-3 text-left text-xs uppercase tracking-wider">Team</th>
                <th className="px-3 text-right text-xs uppercase tracking-wider">W</th>
                <th className="px-3 text-right text-xs uppercase tracking-wider">L</th>
              </tr>
            </thead>
            <tbody>
              {bracket.standings.map((s, i) => (
                <tr key={s.tournament_team_id} className="bg-black/70">
                  <td className="px-3 py-1 text-sm font-bold" style={{ color: accent }}>
                    {s.placement ?? i + 1}
                  </td>
                  <td className="px-3 py-1 text-sm font-semibold" style={{ color: text }}>
                    {s.team_name}
                  </td>
                  <td className="px-3 py-1 text-right text-sm tabular-nums" style={{ color: text }}>
                    {s.wins}
                  </td>
                  <td className="px-3 py-1 text-right text-sm tabular-nums" style={{ color: text }}>
                    {s.losses}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Winners bracket: columns left-to-right, one per round, ending in the Final. */}
            <div className="flex items-stretch gap-8">
              {bracket.rounds.winners.map((r, idx) => (
                <RoundColumn
                  key={`w-${r.round}`}
                  label={roundLabel("winners", idx, bracket.rounds.winners.length)}
                  matches={r.matches}
                />
              ))}
            </div>

            {/* Lower bracket (double elimination only). */}
            {bracket.rounds.losers.length > 0 ? (
              <div className="border-t pt-4" style={{ borderColor: `${accent}33` }}>
                <p
                  className="mb-3 text-center text-xs font-bold uppercase tracking-widest"
                  style={{ color: text, opacity: 0.8 }}
                >
                  Lower Bracket
                </p>
                <div className="flex items-stretch gap-8">
                  {bracket.rounds.losers.map((r, idx) => (
                    <RoundColumn
                      key={`l-${r.round}`}
                      label={roundLabel("losers", idx, bracket.rounds.losers.length)}
                      matches={r.matches}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes afc-h2h-in {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.94);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

function H2HView({ feed }: { feed: OverlayConfigFeed }) {
  const h2h = feed.h2h;
  if (!feed.active || !h2h) return null;
  // Clash Squad bracket mode (P1#6): render the stage bracket instead of the versus cards.
  if (h2h.mode === "bracket") {
    if (!h2h.bracket || !h2h.bracket.generated) return null;
    return <H2HBracketOverlay bracket={h2h.bracket} design={h2h.design} />;
  }
  if (h2h.competitors.length < 2) return null;
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

  // Placeable slots (owner 2026-07-02): when the versus design placed slot positions, each
  // competitor card is ABSOLUTELY positioned at its slot centre; otherwise the default centered
  // row (with VS plaques) renders as before.
  const slots = (design as any)?.slots as { x_pct: number; y_pct: number }[] | undefined;
  const placed = !!(slots && slots.length >= 2);

  const CompetitorCard = ({ c }: { c: (typeof h2h.competitors)[number] }) => (
    <div
      className="flex w-72 flex-col items-center gap-3 rounded-2xl border bg-black/75 p-6"
      style={{ borderColor: `${accent}80` }}
    >
      {c.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.image} alt="" style={{ height: 120, width: 120, objectFit: "contain" }} className="rounded-md" />
      ) : null}
      <p className="max-w-full truncate text-center text-2xl font-bold" style={{ color: text, textShadow: "0 3px 14px rgba(0,0,0,0.9)" }}>
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
  );

  if (placed) {
    return (
      <div className="relative h-screen w-screen overflow-hidden">
        {design?.background && !design.transparent ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={design.background} alt="" className="absolute inset-0 size-full object-cover" />
        ) : null}
        {h2h.competitors.slice(0, slots!.length).map((c, i) => (
          <div
            key={`${c.name}-${i}`}
            className="absolute"
            style={{
              left: `${slots![i].x_pct}%`,
              top: `${slots![i].y_pct}%`,
              transform: "translate(-50%, -50%)",
              animation: "afc-h2h-in 700ms cubic-bezier(0.16,1,0.3,1) both",
            }}
          >
            <CompetitorCard c={c} />
          </div>
        ))}
        <style jsx global>{`
          @keyframes afc-h2h-in {
            from { opacity: 0; transform: translate(-50%, -44%) scale(0.94); }
            to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          }
        `}</style>
      </div>
    );
  }

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

// ── MVP (G) + Top Killers (H) player board (owner 2026-07-05) ────────────────
// Two PLAYER-driven boards that REUSE the leaderboard combine/render idea: the config poll bundles the
// resolved ranked PLAYER ROWS + the bound design's LOOK (background + colors + transparent), exactly like
// _h2h_payload / _booyah_payload. Each row is keyed by the design player FIELD_CHOICES field types
// (pos / player_name / team_name / team_country / esports_image / kills / damage / assists / mvp_count /
// matches - build_player_design_rows), and esports_image is a URL drawn as an <img>. ONE renderer serves
// both kinds (they share the payload shape): the only difference is the HEADLINE stat - the MVP board
// leads with mvp_count (map MVPs won), the Top Killers board with kills. Rows are already ordered by pos.
// Always render (no trigger), so it renders whenever the overlay is active. Styled in the AFC house look
// like BooyahView / H2HView (the design LOOK sets bg + colors); the full field-placement render is the
// through-a-design PNG export path (events/<id>/player-board-graphic/).
function PlayerBoardView({ feed }: { feed: OverlayConfigFeed }) {
  const isMvp = feed.kind === "mvp";
  const payload = isMvp ? feed.mvp : feed.top_killers;
  if (!feed.active || !payload || !payload.players?.length) return null;

  const design = payload.design;
  const text = design?.text_color || "#ffffff";
  const accent = design?.accent_color || "#34d27b";
  const title = isMvp ? "MVP STANDINGS" : "TOP KILLERS";
  const headlineLabel = isMvp ? "MVPs" : "KILLS";
  // The board's headline stat per row: map MVPs won for the MVP board, kills for Top Killers.
  const headline = (p: (typeof payload.players)[number]) =>
    isMvp ? p.mvp_count : p.kills;
  // Fit a broadcast frame: show the top 10 (rows are pre-ordered by pos).
  const rows = payload.players.slice(0, 10);

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden">
      {design?.background && !design.transparent ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={design.background} alt="" className="absolute inset-0 size-full object-cover" />
      ) : null}
      <div
        className="relative flex w-[860px] flex-col gap-3"
        style={{ animation: "afc-pb-in 600ms cubic-bezier(0.16,1,0.3,1) both" }}
      >
        <div
          className="text-center font-black uppercase tracking-[0.2em]"
          style={{ color: accent, fontSize: "3.2rem", textShadow: "0 4px 20px rgba(0,0,0,0.9)" }}
        >
          {title}
        </div>
        <div className="flex flex-col gap-2">
          {rows.map((p, i) => (
            <div
              key={`${p.pos}-${p.player_name}-${i}`}
              className="flex items-center gap-4 rounded-2xl border bg-black/70 px-5 py-3"
              style={{
                borderColor: i === 0 ? accent : `${accent}55`,
                animation: `afc-pb-row 500ms ease-out both`,
                animationDelay: `${i * 60}ms`,
              }}
            >
              {/* Rank */}
              <span
                className="w-12 shrink-0 text-center font-black tabular-nums"
                style={{ color: i === 0 ? accent : text, fontSize: "2rem" }}
              >
                {p.pos}
              </span>
              {/* Player PHOTO (esports_image) drawn as an <img>; letter fallback when missing. */}
              {p.esports_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.esports_image}
                  alt=""
                  className="rounded-lg"
                  style={{ height: 64, width: 64, objectFit: "cover" }}
                />
              ) : (
                <div
                  className="flex items-center justify-center rounded-lg text-2xl font-bold"
                  style={{ height: 64, width: 64, background: "#111", color: accent }}
                >
                  {(p.player_name || "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              {/* Name + team */}
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-2xl font-bold"
                  style={{ color: text, textShadow: "0 2px 10px rgba(0,0,0,0.9)" }}
                >
                  {p.player_name}
                </p>
                {p.team_name ? (
                  <p className="truncate text-sm uppercase tracking-wider opacity-70" style={{ color: text }}>
                    {p.team_name}
                  </p>
                ) : null}
              </div>
              {/* Secondary stats: on the MVP board show kills (the headline is map MVPs); on the
                  Top Killers board show damage (the headline is kills). */}
              <div className="shrink-0 text-right opacity-75" style={{ color: text }}>
                <span className="text-lg font-semibold tabular-nums">
                  {isMvp ? p.kills : p.damage}
                </span>
                <span className="block text-[0.55rem] uppercase tracking-widest opacity-70">
                  {isMvp ? "KILLS" : "DAMAGE"}
                </span>
              </div>
              {/* Headline stat */}
              <div className="shrink-0 text-right">
                <span
                  className="font-black tabular-nums"
                  style={{ color: accent, fontSize: "2.4rem", lineHeight: 1 }}
                >
                  {headline(p)}
                </span>
                <span className="block text-[0.6rem] uppercase tracking-widest opacity-70" style={{ color: text }}>
                  {headlineLabel}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style jsx global>{`
        @keyframes afc-pb-in {
          from { opacity: 0; transform: translateY(26px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes afc-pb-row {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
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
  // MVP (G) + Top Killers (H): ranked player rows drawn through the bound design (owner 2026-07-05).
  if (feed.kind === "mvp" || feed.kind === "top_killers") {
    return <PlayerBoardView feed={feed} />;
  }

  // Leaderboard: render the existing overlay page inside a full-viewport iframe. Keyed by the
  // config JSON so ONLY a real change re-mounts it (fresh animate-in); poll ticks with an unchanged
  // config leave it alone - the inner page keeps its own feed polling + page cycling.
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
