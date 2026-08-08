/**
 * components/StatBox.tsx
 * ──────────────────────
 * The AFC headline-stat card: one label over one big number. This is the shape every
 * "career snapshot" grid on the site uses, so a stat tile looks the same whoever is
 * looking at it.
 *
 * WHY IT LIVES HERE: it existed twice, defined privately at the bottom of
 * app/(user)/players/[username]/_components/PlayerClient.tsx and again in
 * app/(user)/profile/_components/OwnStatsTab.tsx. The two copies had already drifted
 * (only PlayerClient's took a `sub` line), and the profile redesign needed a third.
 * Three private copies of one card is how a design system stops being one, so it was
 * lifted here and both call sites now import it.
 *
 * CONSUMED BY:
 *   • app/(user)/profile/_components/ProfileContent.tsx  - the owner's career snapshot
 *   • app/(user)/profile/_components/OwnStatsTab.tsx     - the owner's full stats tab
 *   • app/(user)/players/[username]/_components/PlayerClient.tsx - the public player page
 * All three feed it values from POST /player/get-public-player-stats/
 * (backend/afc_player/views.py :: get_public_player_stats).
 *
 * STYLING is the AFC card constant from CLAUDE.md: bg-card, rounded-md (never rounded-lg),
 * a border and shadow-sm. The value is text-2xl font-bold; `accent` tints it primary green
 * or gold, matching the design constants. Anything outside that trio stays foreground.
 *
 * NO em or en dashes in any copy passed to this component (AFC hard rule).
 */

export function StatBox({
  label,
  value,
  sub,
  accent,
  muted = false,
}: {
  label: string;
  /** Pre-formatted for display. Callers do their own toFixed / toLocaleString. */
  value: string | number;
  /** Optional second line under the number, e.g. "across 36 team matches". */
  sub?: string;
  accent?: "green" | "gold";
  /**
   * Renders the value as small muted text instead of a big number. For the honest
   * "no data yet" state: a rate computed from zero matches is not 0.00, it is unknown,
   * and printing 0.00 is the thing that made the old profile page look broken
   * (owner bug 2026-08-07). Callers pass muted with a phrase like "No matches yet".
   */
  muted?: boolean;
}) {
  const valueColor =
    accent === "green"
      ? "text-primary"
      : accent === "gold"
        ? "text-gold"
        : "text-foreground";

  return (
    <div className="bg-card rounded-md border py-4 px-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      {muted ? (
        <p className="mt-1 text-sm font-medium text-muted-foreground">{value}</p>
      ) : (
        <p className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</p>
      )}
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
