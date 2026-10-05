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
//   The backend answers it: GET rankings/seasons/current/ carries next_window_opens, computed by
//   AFC-B afc_rankings.models.Season.next_window_opens, the ONE rule the refusal messages and the help
//   bot read too (inbox #150, owner 2026-10-05: "the next open date is the day after the last day of
//   the season"): this season's window if still ahead, else the day after the season's last day,
//   unless a later season on record starting by then opens its window later. This hook used to work
//   the date out itself from the whole seasons list, a second copy of the rule.
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

  useEffect(() => {
    rankingsApi
      .currentSeason()
      .then((s) => setSeason(s))
      .catch(() => setSeason(null))
      .finally(() => setLoaded(true));
  }, []);

  const locked = !!season && !season.transfer_window_is_open;
  const next = season?.next_window_opens ?? null;
  const freeFrom = locked ? next : null;
  // The banner's extra line is for a SPENT window; while this season's own window is ahead, its
  // range line already says when it opens.
  const spent = !!season?.transfer_window_close && season.transfer_window_close < todayIso();
  const nextWindowOpen = locked && spent ? next : null;
  return { loaded, season, locked, freeFrom, nextWindowOpen };
}
