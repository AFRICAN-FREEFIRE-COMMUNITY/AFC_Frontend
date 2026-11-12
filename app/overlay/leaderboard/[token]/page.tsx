"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Public OBS overlay page - /overlay/leaderboard/<token>?...
// ----------------------------------------------------------------------------
// PURPOSE
//   The URL an organizer pastes into OBS as a Browser Source. It is BARE + PUBLIC:
//   no auth, no site chrome. It reads the overlay token from the path and the render
//   options from the query, self-polls the public feed, and paints <DesignBoard> on
//   a transparent page (app/overlay/layout.tsx marks <html class="overlay"> and
//   PageGradient renders nothing on /overlay).
//
// URL CONTRACT (built by components/overlay/CopyOverlayLinkDialog.tsx)
//   /overlay/leaderboard/<token>?type=event&event=&stage=&group=&design=&size=
//                                &anim=&reveal=&interval=&cols=&live=
//   - token   : Event.overlay_token (path segment) - the read capability.
//   - stage / group / design / size : which standings + design the feed resolves.
//   - cols    : comma-separated field_type subset to show (default = all design fields).
//   - anim    : fade | slide | flash | none      (default fade)
//   - reveal  : staggered | all                  (default staggered)
//   - interval: poll seconds (default 10; forced to 2 when live=1)
//   - live    : 1 => ask the feed for the in-round snapshot + poll fast.
//   - type / event : context only (the token already scopes to the event server-side).
//
// DATA
//   lib/overlay.fetchOverlayFeed() (raw fetch, no auth - precedent: EventDetailsWrapper's
//   get-event-details-not-logged-in). Returns { design, standings, board, size, live }.
//   Passed straight into DesignBoard (app/overlay/leaderboard/_components/DesignBoard.tsx).
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchOverlayFeed, type OverlayFeed, type OverlaySize } from "@/lib/overlay";
import {
  DesignBoard,
  type OverlayAnim,
  type OverlayReveal,
} from "../_components/DesignBoard";

// Narrow the raw query strings to the component's unions, with the documented defaults.
const asAnim = (v: string | null): OverlayAnim =>
  v === "slide" || v === "flash" || v === "none" ? v : "fade";
const asReveal = (v: string | null): OverlayReveal =>
  v === "all" ? "all" : "staggered";
const asSize = (v: string | null): OverlaySize | undefined =>
  v === "youtube" || v === "instagram" ? v : undefined;

function OverlayLeaderboardInner() {
  // Token from the dynamic path segment; render options from the query string.
  const params = useParams<{ token: string }>();
  const token = String(params?.token ?? "");
  const sp = useSearchParams();

  const stage = sp.get("stage");
  const group = sp.get("group");
  // Per-overlay COMBINE (owner 2026-07-05, complaint C): ?groups=<csv>&stages=<csv> merge the listed
  // groups + whole stages into one cumulative board. When present they supersede stage/group on the
  // feed. Passed straight through to fetchOverlayFeed (backend _parse_overlay_combine expands them).
  const groups = sp.get("groups");
  const stages = sp.get("stages");
  const design = sp.get("design");
  const sizeParam = asSize(sp.get("size"));
  const anim = asAnim(sp.get("anim"));
  // Per-overlay bg behaviour override (owner 2026-07-02): ?bg=persistent|animate beats the design's
  // stored background_behavior (which stays as the default for plain links).
  const bgParam = sp.get("bg");
  const bgBehavior = bgParam === "animate" || bgParam === "persistent" ? bgParam : null;
  const reveal = asReveal(sp.get("reveal"));
  const colsParam = sp.get("cols");
  const live = sp.get("live") === "1";
  // interval is in seconds; live mode overrides to the snappy 2s cadence (spec §5.2 / §11.2).
  const intervalSec = live ? 2 : Math.max(2, Number(sp.get("interval")) || 10);

  // Persist the last feed per overlay URL so a page RELOAD (OBS "refresh browser source") repaints the
  // BACKGROUND + last standings INSTANTLY from cache instead of flashing dark while the first poll is
  // in flight; the fresh feed replaces it within one poll (owner 2026-07-01: "backgrounds always on,
  // screen shouldn't go dark when reloading"). Keyed by the exact render target.
  const cacheKey = `afc:overlay:feed:${token}|${stage ?? ""}|${group ?? ""}|${groups ?? ""}|${stages ?? ""}|${design ?? ""}|${sizeParam ?? ""}|${colsParam ?? ""}|${live ? 1 : 0}`;

  const [feed, setFeed] = useState<OverlayFeed | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const cached = localStorage.getItem(cacheKey);
      return cached ? (JSON.parse(cached) as OverlayFeed) : null;
    } catch {
      return null;
    }
  });
  const [error, setError] = useState<string | null>(null);
  // Keep the latest abort controller so a slow poll is cancelled when the next fires / on unmount.
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing overlay token.");
      return;
    }
    let cancelled = false;

    const poll = async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const data = await fetchOverlayFeed(
          {
            token,
            stage,
            group,
            groups: groups ?? undefined,
            stages: stages ?? undefined,
            design,
            size: sizeParam,
            live,
            cols: colsParam ?? undefined,
          },
          ctrl.signal,
        );
        if (!cancelled) {
          setFeed(data);
          setError(null);
          // Cache the freshest feed so the next reload repaints instantly (see cacheKey above).
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
          } catch {
            /* quota / disabled storage -> skip; the overlay still works, just re-fetches on reload */
          }
        }
      } catch (err: any) {
        // Ignore intentional aborts; surface anything else quietly (broadcast graphic - no toasts).
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
        if (!cancelled) setError("Waiting for the leaderboard feed...");
      }
    };

    poll();
    const id = setInterval(poll, intervalSec * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
      abortRef.current?.abort();
    };
    // Re-subscribe whenever the token / target / cadence changes.
  }, [token, stage, group, groups, stages, design, sizeParam, live, colsParam, intervalSec]);

  // Before the first successful feed: render nothing (transparent) except a tiny status hint if
  // something is wrong, so OBS shows a clean empty source rather than a spinner.
  if (!feed) {
    return error ? (
      <div className="fixed left-3 top-3 rounded bg-black/40 px-2 py-1 text-xs text-white/80">
        {error}
      </div>
    ) : null;
  }

  // Split the cols allow-list into a field_type array (empty => DesignBoard shows all fields).
  const cols = colsParam
    ? colsParam.split(",").map((c) => c.trim()).filter(Boolean)
    : undefined;

  // No design in the event's library: the feed answers design null (AFC-B overlay_feed). DesignBoard needs a
  // design, so this used to crash the whole overlay into the site's error page (found 11 Nov 2026 on a walk
  // copy of event 373). A plain built-in board shows the same standings instead.
  if (!feed.design) {
    return <PlainBoard standings={feed.standings ?? []} title={feed.board?.title} subtitle={feed.board?.subtitle} live={!!feed.live} />;
  }

  return (
    <DesignBoard
      bgBehaviorOverride={bgBehavior}
      design={feed.design}
      standings={feed.standings}
      size={sizeParam ?? feed.size}
      cols={cols}
      anim={anim}
      reveal={reveal}
      title={feed.board?.title}
      subtitle={feed.board?.subtitle}
      // The feed reports live:true only when a Tier-2 in-round Redis snapshot was returned; drives the
      // subtle "LIVE" badge in DesignBoard. (The 2s poll cadence is already handled above via `live`.)
      live={feed.live}
    />
  );
}

// The built-in board for an event with no leaderboard design: rank, team, kills, points, and the map in
// progress (live_points) when the feed folds one in. Plain readable type on a dark panel, nothing animated.
function PlainBoard({
  standings,
  title,
  subtitle,
  live,
}: {
  standings: Array<Record<string, any>>;
  title?: string;
  subtitle?: string;
  live: boolean;
}) {
  return (
    <div className="flex min-h-screen items-start justify-center p-6">
      <div className="w-full max-w-2xl rounded-xl bg-black/80 p-5 text-white">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div>
            <p className="text-2xl font-bold">{title}</p>
            {subtitle ? <p className="text-sm text-white/70">{subtitle}</p> : null}
          </div>
          {live ? <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold">LIVE</span> : null}
        </div>
        <table className="w-full text-lg">
          <tbody>
            {standings.map((r, i) => (
              <tr key={`${r.pos}-${r.team_name}`} className={i % 2 ? "bg-white/5" : ""}>
                <td className="w-12 p-2 font-bold">#{r.pos}</td>
                <td className="p-2">{r.team_name}</td>
                <td className="p-2 text-right tabular-nums">{r.kills}</td>
                <td className="p-2 text-right font-bold tabular-nums">
                  {r.total_points}
                  {r.in_live_map && r.live_points ? <span className="ml-1 text-sm text-green-400">+{r.live_points}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary; the fallback is null (transparent) so OBS never flashes.
export default function OverlayLeaderboardPage() {
  return (
    <Suspense fallback={null}>
      <OverlayLeaderboardInner />
    </Suspense>
  );
}
