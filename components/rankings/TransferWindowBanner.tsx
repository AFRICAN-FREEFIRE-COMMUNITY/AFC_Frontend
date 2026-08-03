"use client";

import { useEffect, useState } from "react";
import { IconArrowsExchange, IconLock } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
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
 */

// The runtime season payload carries these Phase-2c fields; the base TS type may not declare them.
// transfer_window_open was on the wire already (afc_rankings/serializers.py `season()` emits all
// three) but was never declared here, which is why the CLOSED state could not name a reopen date.
type SeasonFlags = Season & {
  transfer_window_is_open?: boolean;
  transfer_window_open?: string;
  transfer_window_close?: string;
};

function fmtDate(iso?: string) {
  if (!iso) return "";
  // Season.transfer_window_open / _close are Django DateFields, so these are bare "YYYY-MM-DD"
  // calendar dates with NO time component. formatLocalDateOnly renders them as the same calendar
  // date for every viewer, localized to the active language. It must NOT go through
  // formatLocalTime(.., "date"), which parses a date-only string as UTC midnight and therefore
  // shows the PREVIOUS day to anyone west of UTC (owner 2026-08-03, item 10).
  return formatLocalDateOnly(iso) || iso;
}

// Rendered on /teams, /player-markets and /rankings; self-fetches rankingsApi.currentSeason();
// OPEN/CLOSED mirrors the backend roster lock (when CLOSED, afc_team exit_team/kick_team_member/
// disband_team are frozen server-side); single banner used app-wide.
export function TransferWindowBanner({ className }: { className?: string }) {
  // i18n namespace: "transferWindow" (messages/en|fr|pt/transferWindow.json).
  // Client component, so strings come from next-intl's useTranslations.
  const t = useTranslations("transferWindow");
  const [season, setSeason] = useState<SeasonFlags | null>(null);

  useEffect(() => {
    rankingsApi.currentSeason().then((s) => setSeason(s as SeasonFlags)).catch(() => setSeason(null));
  }, []);

  if (!season) return null; // nothing to show until a season loads
  const open = !!season.transfer_window_is_open;

  // ── Body copy: always name the real dates (owner 2026-08-03, backlog item 10) ────────────────
  // "Show the actual open/close date and time: when it will open, or if open, when it closes."
  // Previously the CLOSED state said only "roster moves are locked" with no date, so a player had
  // no idea when they could move again. Three cases, since a closed window is either BEFORE its
  // open date (we can promise a reopen date) or AFTER its close date (this season's window is
  // spent, so the honest thing is to say when it ended). Every branch degrades to the old
  // date-less copy when the season has no dates set.
  let body: string;
  if (open) {
    body = season.transfer_window_close
      ? t("openBodyWithDate", { date: fmtDate(season.transfer_window_close) })
      : t("openBody");
  } else {
    // Today as a LOCAL calendar date. toISOString() would give the UTC date, which flips a few
    // hours early or late depending on the viewer and would mislabel the window on the boundary
    // day. The window dates are floating calendar dates, so compare like with like.
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;
    const opensLater =
      !!season.transfer_window_open && season.transfer_window_open > todayIso;
    if (opensLater) {
      body = t("closedBodyWithOpenDate", {
        date: fmtDate(season.transfer_window_open),
      });
    } else if (season.transfer_window_close) {
      body = t("closedBodyAfterClose", {
        date: fmtDate(season.transfer_window_close),
      });
    } else {
      body = t("closedBody");
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border p-4",
        open
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-destructive/50 bg-destructive/10 text-destructive",
        className,
      )}
    >
      {open ? <IconArrowsExchange className="size-6 shrink-0" /> : <IconLock className="size-6 shrink-0" />}
      <div className="flex-1">
        <p className="text-base font-bold">
          {open ? t("openTitle") : t("closedTitle")}
        </p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <Badge
        variant="outline"
        className={cn(
          "rounded-full font-semibold",
          open ? "border-primary/60 text-primary" : "border-destructive/60 text-destructive",
        )}
      >
        {open ? t("openBadge") : t("closedBadge")}
      </Badge>
    </div>
  );
}
