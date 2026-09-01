"use client";

import { useEffect, useState } from "react";
import { IconArrowsExchange, IconLock } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { rankingsApi, Season } from "@/lib/rankings";
import { useTranslations } from "next-intl";
// i18n date: render the transfer-window dates in the viewer's LANGUAGE (so months localize to
// fr/pt) via the shared helper, instead of a hardcoded en-US toLocaleDateString. String form (not
// <LocalTime/>) because the value is interpolated into the banner copy via t(.., { date }).
// formatLocalDateOnly, not formatLocalTime: these are calendar dates, see fmtDate below.
import { formatLocalDateOnly } from "@/lib/i18n/time";

/**
 * Prominent, self-contained OPEN / CLOSED transfer-window banner.
 *
 * Drop it near the top of any user-facing page (Rankings, Teams, Player Market). It
 * fetches the active ranking season and shows - impossible to miss - whether roster
 * moves are currently allowed. The window is the active season's
 * transfer_window_open..transfer_window_close range, toggled by admins; when it's CLOSED
 * the backend also freezes rosters - blocking leave (afc_team.exit_team), kick
 * (kick_team_member), and disband (disband_team). Joining a team stays allowed.
 *
 * BOTH DATES ARE ALWAYS NAMED (owner 2026-09-01: "people should be able to see the dates its set
 * to open in"). The open date was on the wire all along and simply never reached the screen in the
 * state most viewers actually see. The banner had three closed states, and the one that applies
 * once the close date has passed said only "the window closed on <date> and reopens next season",
 * so the one date a waiting player wanted was the one date it would not print. The window range is
 * now its own line, rendered in EVERY state, instead of being appended to whichever sentence the
 * current state happened to use.
 *
 * CONNECTS TO
 *   - GET rankings/seasons/current/ (rankingsApi.currentSeason) for the live window.
 *   - GET rankings/seasons/ (rankingsApi.seasons) ONLY to answer "when does the next one open",
 *     which the current season cannot answer once its own window is spent. See nextWindowOpen.
 *   - Rendered by app/(user)/rankings, app/(user)/teams, app/(user)/player-markets.
 *   - Mirrors the server-side roster lock in afc_team (exit_team / kick_team_member /
 *     disband_team), so the copy and the enforcement cannot drift apart.
 */

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  // Season.transfer_window_open / _close are Django DateFields, so these are bare "YYYY-MM-DD"
  // calendar dates with NO time component. formatLocalDateOnly renders them as the same calendar
  // date for every viewer, localized to the active language. It must NOT go through
  // formatLocalTime(.., "date"), which parses a date-only string as UTC midnight and therefore
  // shows the PREVIOUS day to anyone west of UTC (owner 2026-08-03, item 10).
  return formatLocalDateOnly(iso) || iso;
}

/** Today as a LOCAL calendar date string, comparable to the bare window dates.
 *
 *  toISOString() would give the UTC date, which flips a few hours early or late depending on the
 *  viewer and would mislabel the window on the boundary day. The window dates are floating
 *  calendar dates, so compare like with like. */
function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

export function TransferWindowBanner({ className }: { className?: string }) {
  // i18n namespace: "transferWindow" (messages/en|fr|pt/transferWindow.json).
  // Client component, so strings come from next-intl's useTranslations.
  const t = useTranslations("transferWindow");
  const [season, setSeason] = useState<Season | null>(null);
  // The open date of the NEXT window, when some future season already has one set. Null is the
  // ordinary case and renders nothing: a season is usually created when it starts, so for most of
  // the year there genuinely is no next window on record, and promising one would be inventing a
  // date nobody has agreed.
  const [nextWindowOpen, setNextWindowOpen] = useState<string | null>(null);

  useEffect(() => {
    rankingsApi.currentSeason().then((s) => setSeason(s)).catch(() => setSeason(null));
  }, []);

  useEffect(() => {
    // Only worth asking once the current window is SPENT. While it is open, or still ahead of us,
    // the range line below already carries the date the viewer came for, and a second request for
    // a line that would not be shown is a request for nothing.
    if (!season) return;
    const spent = !!season.transfer_window_close && season.transfer_window_close < todayIso();
    if (!spent) return;

    rankingsApi
      .seasons()
      .then((env) => {
        const today = todayIso();
        // The EARLIEST future opening across every season on record, not simply the newest row:
        // the list is not ordered by window date, and a season can be created out of order.
        const upcoming = (env.results || [])
          .map((s) => s.transfer_window_open)
          .filter((d): d is string => !!d && d > today)
          .sort();
        setNextWindowOpen(upcoming[0] ?? null);
      })
      .catch(() => setNextWindowOpen(null));
  }, [season]);

  if (!season) return null; // nothing to show until a season loads
  const open = !!season.transfer_window_is_open;

  // The window's own dates, shown in EVERY state and phrased WITHOUT tense, so one string serves a
  // window that has not opened yet, one that is open, and one that is finished.
  const hasRange = !!season.transfer_window_open && !!season.transfer_window_close;

  return (
    <div
      // Filled surface, no stroke: house rule bans building structure out of hairline borders. The
      // state is already carried by the fill, the icon and the chip, which is three signals.
      className={cn(
        "flex items-center gap-3 rounded-md p-4",
        open ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
        className,
      )}
    >
      {open ? <IconArrowsExchange className="size-6 shrink-0" /> : <IconLock className="size-6 shrink-0" />}
      <div className="flex-1">
        <p className="text-base font-bold">{open ? t("openTitle") : t("closedTitle")}</p>
        <p className="text-sm text-muted-foreground">{open ? t("openBody") : t("closedBody")}</p>
        {hasRange && (
          <p className="text-sm font-medium">
            {t("windowRange", {
              open: fmtDate(season.transfer_window_open),
              close: fmtDate(season.transfer_window_close),
            })}
          </p>
        )}
        {!open && nextWindowOpen && (
          <p className="text-sm font-medium">
            {t("nextWindowOpens", { date: fmtDate(nextWindowOpen) })}
          </p>
        )}
      </div>
      <span
        // Filled chip, never a ring. Same house rule as the surface above.
        className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0",
          open ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive",
        )}
      >
        {open ? t("openBadge") : t("closedBadge")}
      </span>
    </div>
  );
}
