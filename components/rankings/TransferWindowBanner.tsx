"use client";

import { useEffect, useState } from "react";
import { IconArrowsExchange, IconLock } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { rankingsApi, Season } from "@/lib/rankings";

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
type SeasonFlags = Season & {
  transfer_window_is_open?: boolean;
  transfer_window_close?: string;
};

function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Rendered on /teams, /player-markets and /rankings; self-fetches rankingsApi.currentSeason();
// OPEN/CLOSED mirrors the backend roster lock (when CLOSED, afc_team exit_team/kick_team_member/
// disband_team are frozen server-side); single banner used app-wide.
export function TransferWindowBanner({ className }: { className?: string }) {
  const [season, setSeason] = useState<SeasonFlags | null>(null);

  useEffect(() => {
    rankingsApi.currentSeason().then((s) => setSeason(s as SeasonFlags)).catch(() => setSeason(null));
  }, []);

  if (!season) return null; // nothing to show until a season loads
  const open = !!season.transfer_window_is_open;

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
          {open ? "🟢 Transfer window is OPEN" : "🔴 Transfer window is CLOSED"}
        </p>
        <p className="text-sm text-muted-foreground">
          {open
            ? `Roster moves are allowed${season.transfer_window_close ? ` - closes ${fmtDate(season.transfer_window_close)}` : ""}.`
            : "Roster moves are locked - players cannot leave, be removed from, or disband teams until the window reopens."}
        </p>
      </div>
      <Badge
        variant="outline"
        className={cn(
          "rounded-full font-semibold",
          open ? "border-primary/60 text-primary" : "border-destructive/60 text-destructive",
        )}
      >
        {open ? "OPEN" : "CLOSED"}
      </Badge>
    </div>
  );
}
