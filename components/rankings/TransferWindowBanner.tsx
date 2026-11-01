"use client";

import { useId, useState } from "react";
import { IconArrowsExchange, IconLock } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useTransferLock } from "@/lib/useTransferLock";
import { useTranslations } from "next-intl";
// i18n date: render the transfer-window dates in the viewer's LANGUAGE (so months localize to
// fr/pt) via the shared helper, instead of a hardcoded en-US toLocaleDateString. String form (not
// <LocalTime/>) because the value is interpolated into the banner copy via t(.., { date }).
// formatLocalDateOnly, not formatLocalTime: these are calendar dates, see fmtDate below.
import { formatLocalDateOnly } from "@/lib/i18n/time";

/**
 * Self-contained OPEN / CLOSED transfer-window status line.
 *
 * Drop it near the top of any user-facing page (Rankings, Teams, Player Market). It
 * fetches the active ranking season and says, in one line, whether roster moves are
 * currently allowed and the date that changes.
 *
 * A STATUS, NOT AN ALARM (Apple design fix 6, owner approved the mockup 24 Oct 2026, inbox #381).
 * The closed window is the normal state for most of a season, and it used to be a large red card
 * with CLOSED twice, which reads as an error. It is now one calm line on a muted surface, "closed,
 * opens again on <date>", with the rules and this season's dates one tap away under Details. Open
 * looks the same with a green icon. The window is the active season's
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


export function TransferWindowBanner({ className }: { className?: string }) {
  // i18n namespace: "transferWindow" (messages/en|fr|pt/transferWindow.json).
  // Client component, so strings come from next-intl's useTranslations.
  const t = useTranslations("transferWindow");
  // Season + next-window date come from the shared hook, which the join warning
  // (components/team/JoinLockDialog.tsx) reads too, so the two can never quote different dates.
  const { season, nextWindowOpen } = useTransferLock();
  // Details (the rules + this season's window) stay folded until asked for.
  const [showDetails, setShowDetails] = useState(false);
  const detailsId = useId();
  if (!season) return null; // nothing to show until a season loads
  const open = !!season.transfer_window_is_open;

  // The window's own dates, shown in EVERY state and phrased WITHOUT tense, so one string serves a
  // window that has not opened yet, one that is open, and one that is finished.
  const hasRange = !!season.transfer_window_open && !!season.transfer_window_close;

  // The one line: what the window is now and the date that changes it.
  const line = open
    ? season.transfer_window_close
      ? t("openLine", { date: fmtDate(season.transfer_window_close) })
      : t("openLineNoDate")
    : nextWindowOpen
      ? t("closedLine", { date: fmtDate(nextWindowOpen) })
      : t("closedLineNoDate");

  return (
    <div
      // Filled muted surface, no stroke (house rule), the same in both states: the state is in the words
      // and the icon colour, never in a red or green card.
      className={cn("flex items-start gap-3 rounded-xl bg-muted px-3.5 py-3 text-sm", className)}
      role="status"
    >
      {open ? (
        <IconArrowsExchange className="mt-0.5 size-[18px] shrink-0 text-primary" aria-hidden />
      ) : (
        <IconLock className="mt-0.5 size-[18px] shrink-0 text-muted-foreground" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="leading-snug">{line}</p>
        {showDetails && (
          <div id={detailsId} className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <p>{open ? t("openBody") : t("closedBody")}</p>
            {hasRange && (
              <p>
                {t("windowRange", {
                  open: fmtDate(season.transfer_window_open),
                  close: fmtDate(season.transfer_window_close),
                })}
              </p>
            )}
          </div>
        )}
        <button
          type="button"
          className="hit-44 mt-1.5 text-xs font-semibold text-primary"
          aria-expanded={showDetails}
          aria-controls={detailsId}
          onClick={() => setShowDetails((v) => !v)}
        >
          {showDetails ? t("hideDetails") : t("details")}
        </button>
      </div>
    </div>
  );
}
