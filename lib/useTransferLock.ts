// lib/useTransferLock.ts
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Is the transfer window shut right now, and from which date can a player leave a team again?
//
// ONE answer for every surface that talks about the roster lock, so the banner a player reads and
// the warning they get before joining a team can never quote different dates:
//   - components/rankings/TransferWindowBanner.tsx   the OPEN / CLOSED banner on /teams, /rankings,
//                                                    /player-markets
//   - components/team/JoinLockDialog.tsx             the "you won't be able to leave until <date>"
//                                                    warning before creating, joining, requesting
//                                                    or accepting an invite (owner 2026-09-30, #92)
//
// THE RULE IT MIRRORS (backend afc_team/views.py): while the active season's window is shut,
// exit_team, kick_team_member, disband_team and roster moves answer 403 "transfer_window_closed".
// Creating and joining a team are NOT locked (owner 2026-09-30: "People should be able to create and
// join teams even inside transfer windows, they just cant leave a team").
//
// WHEN CAN THEY LEAVE (freeFrom)
//   - the window is ahead of us this season           -> this season's transfer_window_open
//   - this season's window is spent                   -> the earliest future transfer_window_open on
//                                                        record (GET rankings/seasons/)
//   - neither is on record                            -> null: say "the next window", never invent
//                                                        a date nobody has set
// Dates are bare "YYYY-MM-DD" calendar dates (Django DateField) and are compared as strings against
// the viewer's LOCAL calendar date, never toISOString() (which is the UTC date and flips early).
// ─────────────────────────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState } from "react";

import { rankingsApi, Season } from "@/lib/rankings";

/** Today as a LOCAL calendar date string, comparable to the bare window dates. */
export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

export type TransferLock = {
  /** false until the season has been asked for; decide nothing while it is false. */
  loaded: boolean;
  season: Season | null;
  /** true when leaving a team is refused right now. No active season means no lock. */
  locked: boolean;
  /** The earliest date a player can leave again, or null when no window is on record. */
  freeFrom: string | null;
  /** The next window's open date once this season's window is spent (the banner's extra line). */
  nextWindowOpen: string | null;
};

export function useTransferLock(): TransferLock {
  const [loaded, setLoaded] = useState(false);
  const [season, setSeason] = useState<Season | null>(null);
  const [nextWindowOpen, setNextWindowOpen] = useState<string | null>(null);

  useEffect(() => {
    rankingsApi
      .currentSeason()
      .then((s) => setSeason(s))
      .catch(() => setSeason(null))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    // Only worth asking once the current window is SPENT: before that, this season's own open date
    // is the answer and a second request would be a request for nothing.
    if (!season) return;
    const spent = !!season.transfer_window_close && season.transfer_window_close < todayIso();
    if (!spent) return;
    rankingsApi
      .seasons()
      .then((env) => {
        const today = todayIso();
        // The EARLIEST future opening across every season on record, not the newest row: the list
        // is not ordered by window date, and a season can be created out of order.
        const upcoming = (env.results || [])
          .map((s) => s.transfer_window_open)
          .filter((d): d is string => !!d && d > today)
          .sort();
        setNextWindowOpen(upcoming[0] ?? null);
      })
      .catch(() => setNextWindowOpen(null));
  }, [season]);

  const locked = !!season && !season.transfer_window_is_open;
  let freeFrom: string | null = null;
  if (locked && season) {
    freeFrom =
      season.transfer_window_open && season.transfer_window_open > todayIso()
        ? season.transfer_window_open
        : nextWindowOpen;
  }
  return { loaded, season, locked, freeFrom, nextWindowOpen };
}
