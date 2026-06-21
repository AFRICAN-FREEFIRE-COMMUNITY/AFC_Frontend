// components/WatchTag.tsx
// ─────────────────────────────────────────────────────────────────────────────
// <WatchTag> (owner 2026-06-21)
//
// The small amber "Watch" badge shown next to a player/team NAME wherever admins +
// organizers see one (registered teams, rosters, leaderboard standings + results entry,
// team/player admin pages, the upload review), warning them the subject is on the shared
// advisory watchlist. Presentational only: the caller decides whether to render it (it
// already knows the subject is watched, e.g. from watchlistApi.tags). The `reason` shows
// on hover. Admin/organizer surfaces only — never public, never shown to the flagged user.
// ─────────────────────────────────────────────────────────────────────────────
import { IconEye } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface WatchTagProps {
  /** Optional reason, shown on hover (title). */
  reason?: string | null;
  /** Optional label override (default "Watch"). Pass a localized string on organizer surfaces. */
  label?: string;
  className?: string;
}

export function WatchTag({ reason, label = "Watch", className }: WatchTagProps) {
  return (
    <span
      title={reason || label}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-500/60 bg-amber-500/10",
        "px-2 py-0.5 text-[11px] font-medium leading-none text-amber-600 dark:text-amber-400",
        "align-middle",
        className,
      )}
    >
      <IconEye className="size-3" />
      {label}
    </span>
  );
}
