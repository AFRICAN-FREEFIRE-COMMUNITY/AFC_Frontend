"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Public OBS overlay page — /overlay/leaderboard/<token>?...
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
//   - token   : Event.overlay_token (path segment) — the read capability.
//   - stage / group / design / size : which standings + design the feed resolves.
//   - cols    : comma-separated field_type subset to show (default = all design fields).
//   - anim    : fade | slide | flash | none      (default fade)
//   - reveal  : staggered | all                  (default staggered)
//   - interval: poll seconds (default 10; forced to 2 when live=1)
//   - live    : 1 => ask the feed for the in-round snapshot + poll fast.
//   - type / event : context only (the token already scopes to the event server-side).
//
// DATA
//   lib/overlay.fetchOverlayFeed() (raw fetch, no auth — precedent: EventDetailsWrapper's
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
  const cacheKey = `afc:overlay:feed:${token}|${stage ?? ""}|${group ?? ""}|${design ?? ""}|${sizeParam ?? ""}|${colsParam ?? ""}|${live ? 1 : 0}`;

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
        // Ignore intentional aborts; surface anything else quietly (broadcast graphic — no toasts).
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
  }, [token, stage, group, design, sizeParam, live, colsParam, intervalSec]);

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

// useSearchParams needs a Suspense boundary; the fallback is null (transparent) so OBS never flashes.
export default function OverlayLeaderboardPage() {
  return (
    <Suspense fallback={null}>
      <OverlayLeaderboardInner />
    </Suspense>
  );
}
