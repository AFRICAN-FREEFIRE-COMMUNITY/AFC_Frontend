"use client";

/**
 * OwnStatsTab.tsx
 * ───────────────
 * The owner's OWN full stats window, shown on the logged-in user's /profile page
 * (the "Stats" tab in ProfileContent.tsx). Previously /profile only showed a basic
 * Overview (6 scalars); this surfaces the SAME rich stats window the public player
 * page (players/[username]/_components/PlayerClient.tsx) renders for a player:
 *   - headline cards (Total Matches, Kills, Wins, MVPs, Kills per Match, Win Rate, Avg Damage)
 *   - a performance curve over the player's events (kills / placement / points / kills per match)
 *   - a per-event breakdown table (kills, points, best placement, MVPs)
 *   - a recent-matches table (the player's last individual match lines)
 *
 * DATA: it consumes the `richProfile` object ProfileContent already fetches from
 * POST /player/get-public-player-stats/ (afc_player/views.py :: get_public_player_stats),
 * passed in as the `player` prop. Because ProfileContent now sends the owner's
 * Bearer token, the backend marks the viewer as the player (stats_visible=true) and
 * returns the full stat block, so the owner ALWAYS sees their own complete stats.
 *
 * This mirrors PlayerClient's presentation idiom (StatBox cards, recharts LineChart,
 * AFC pill-segment metric switcher, text-xs tables) so the two read as one designer's
 * work, but it is self-contained: it owns its own metric-switch state and does NOT
 * couple to PlayerClient's internals. With empty stat tables (this DB clone) the
 * cards read 0 and the tables show a truthful empty state, never fabricated numbers.
 *
 * NO em/en dashes in user-facing copy (AFC hard rule).
 */

import { useMemo, useState } from "react";
// i18n: user-visible copy (stat labels, table headers, empty states, chart axis
// labels) is sourced from the `profile` namespace (messages/en/profile.json).
import { useTranslations, useLocale } from "next-intl";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NothingFound } from "@/components/NothingFound";
// Shared AFC headline-stat card (label over a big number). Was defined privately at the
// bottom of this file and again in PlayerClient.tsx; now one definition for all three
// stat grids on the site. See components/StatBox.tsx.
import { StatBox } from "@/components/StatBox";
import { formatWord } from "@/lib/utils";
// LocalTime / formatLocalTime: render stored UTC timestamps in the VIEWER's own
// timezone + language (components/LocalTime.tsx, lib/i18n/time.ts). They replace
// formatDate(), which rendered in UTC with a hardcoded "en-US" locale. LocalTime is
// used for the per-event / recent-match table date cells (visible JSX); the string
// form formatLocalTime is used for the performance-curve x-axis tick (a plain string
// fed to recharts, not standalone JSX).
import { LocalTime } from "@/components/LocalTime";
import { formatLocalTime } from "@/lib/i18n/time";
import { IconMedal } from "@tabler/icons-react";

// ── Row types: a subset of the get-public-player-stats `player` payload. Only the
// fields this window reads are typed; the prop is loosely typed (the parent holds
// the full object as `any`), so unknown keys are simply ignored. ──
interface PerEventRow {
  event_id: number;
  event_name: string;
  competition_type: string;
  event_date: string | null;
  kills: number;
  damage: number;
  matches_played: number;
  mvps: number;
  best_placement: number | null;
  total_points: number;
}

interface RecentMatchRow {
  event_id: number;
  event_name: string;
  match_number: number | null;
  match_map: string | null;
  match_date: string | null;
  placement: number;
  team_points: number;
  kills: number;
  damage: number;
  assists: number;
  is_mvp: boolean;
}

// The shape we read off `richProfile`. Everything is optional/defensive because the
// object may still be loading or, defensively, missing fields on an older backend.
interface RichStats {
  total_matches?: number;
  total_kills?: number;
  total_wins?: number;
  total_mvps?: number;
  kdr?: number;
  avg_damage?: number;
  win_rate?: number;
  per_event?: PerEventRow[];
  recent_matches?: RecentMatchRow[];
}

// The metrics the performance curve can plot (mirrors PlayerClient's METRICS).
const METRICS = [
  { id: "kills", label: "Kills" },
  { id: "placement", label: "Placement" },
  { id: "points", label: "Points" },
  // See PlayerClient's METRICS: "kd" is the id only, the value is kills / matches_played.
  { id: "kd", label: "Kills per Match" },
] as const;
type MetricId = (typeof METRICS)[number]["id"];

// Format a placement as "#3" (hash, per AFC design), or "-" when null.
const placeLabel = (p: number | null | undefined) => (p == null ? "-" : `#${p}`);

export function OwnStatsTab({ player }: { player: RichStats | null }) {
  const t = useTranslations("profile");
  // Active UI locale, passed to formatLocalTime so the curve x-axis month label
  // localizes ("Jun" / "juin" / "jun.") and skips the cookie read.
  const locale = useLocale();
  // Translated label for a metric id (used by the switcher, axis and tooltip).
  const metricLabel = (id: MetricId) => t(`ownStats.metric.${id}`);
  // Which metric the curve plots. Self-contained state (no coupling to the parent).
  const [metric, setMetric] = useState<MetricId>("kills");

  const perEvent = player?.per_event ?? [];
  const recentMatches = player?.recent_matches ?? [];

  // Curve series: one point per dated event, oldest -> newest (recharts needs
  // ascending time for a sensible line). y = the selected metric.
  const curveData = useMemo(() => {
    const rows = [...perEvent]
      .filter((e) => e.event_date)
      .sort(
        (a, b) =>
          new Date(a.event_date as string).getTime() -
          new Date(b.event_date as string).getTime(),
      );
    return rows.map((e) => {
      const kd = e.matches_played > 0 ? e.kills / e.matches_played : 0;
      // x-axis tick: the event date in the viewer's own timezone + language (was a
      // hardcoded "en-US" UTC toLocaleDateString). formatLocalTime is the string
      // form (recharts needs a plain string here, not a <LocalTime/> element).
      const label = formatLocalTime(e.event_date as string, "date", locale);
      return {
        label,
        event: e.event_name,
        kills: e.kills,
        placement: e.best_placement ?? null,
        points: e.total_points,
        kd: Number(kd.toFixed(2)),
      };
    });
  }, [perEvent, locale]);

  const activeMetric = METRICS.find((m) => m.id === metric)!;
  const yAxisLabel =
    metric === "placement"
      ? t("ownStats.axis.placement")
      : metric === "kd"
        ? t("ownStats.axis.kd")
        : metricLabel(activeMetric.id);

  // Have we any recorded data at all? Drives the honest empty-state note.
  const hasAnyStats =
    (player?.total_matches ?? 0) > 0 ||
    perEvent.length > 0 ||
    recentMatches.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Headline cards (all-time scalars straight from richProfile) ──────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox
          label={t("ownStats.totalMatches")}
          value={player?.total_matches ?? 0}
        />
        <StatBox
          label={t("ownStats.totalKills")}
          value={player?.total_kills ?? 0}
          accent="green"
        />
        <StatBox label={t("ownStats.wins")} value={player?.total_wins ?? 0} />
        <StatBox
          label={t("ownStats.mvpAwards")}
          value={player?.total_mvps ?? 0}
          accent="gold"
        />
        <StatBox label={t("ownStats.kdr")} value={(player?.kdr ?? 0).toFixed(2)} />
        <StatBox
          label={t("ownStats.winRate")}
          value={`${(player?.win_rate ?? 0).toFixed(1)}%`}
        />
        <StatBox
          label={t("ownStats.avgDamage")}
          value={Math.round(player?.avg_damage ?? 0)}
        />
        <StatBox label={t("ownStats.eventsPlayed")} value={perEvent.length} />
      </div>

      {!hasAnyStats && (
        <p className="text-xs text-muted-foreground">
          {t("ownStats.noRecordedMatches")}
        </p>
      )}

      {/* ── Performance curve with a metric switcher ─────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base">
              {t("ownStats.performanceCurve")}
            </CardTitle>
            {/* metric switcher (AFC pill segment) */}
            <div className="inline-flex flex-wrap gap-1 bg-muted rounded-lg p-[3px] w-fit">
              {METRICS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetric(m.id)}
                  className={`h-7 px-3 rounded-md text-xs font-medium transition-colors ${
                    metric === m.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {metricLabel(m.id)}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {curveData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={curveData}
                margin={{ top: 8, right: 16, bottom: 24, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickMargin={8}
                  label={{
                    value: t("ownStats.axis.eventDate"),
                    position: "insideBottom",
                    offset: -14,
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                  }}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  // placement reads "lower is better": invert so an improving
                  // (smaller) placement trends upward.
                  reversed={metric === "placement"}
                  allowDecimals={metric === "kd"}
                  label={{
                    value: yAxisLabel,
                    angle: -90,
                    position: "insideLeft",
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                    style: { textAnchor: "middle" },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "var(--foreground)" }}
                  formatter={(value: any) => [
                    metric === "placement" && value != null
                      ? `#${value}`
                      : value,
                    metricLabel(activeMetric.id),
                  ]}
                  labelFormatter={(_label, payload) =>
                    payload?.[0]?.payload?.event ?? _label
                  }
                />
                <Line
                  type="monotone"
                  dataKey={metric}
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--primary)" }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-10">
              <NothingFound text={t("ownStats.notEnoughEvents")} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Per-event breakdown table ────────────────────────────────────────── */}
      <div>
        <div className="mb-3 text-xs font-medium text-muted-foreground">
          {t("ownStats.eventsPlayedHeading")}
        </div>
        {perEvent.length === 0 ? (
          <NothingFound text={t("ownStats.noEventsPlayed")} />
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("ownStats.table.event")}</TableHead>
                  <TableHead>{t("ownStats.table.type")}</TableHead>
                  <TableHead>{t("ownStats.table.date")}</TableHead>
                  <TableHead className="text-center">
                    {t("ownStats.table.bestPlace")}
                  </TableHead>
                  <TableHead className="text-center">
                    {t("ownStats.table.myKills")}
                  </TableHead>
                  <TableHead className="text-center">
                    {t("ownStats.table.myPoints")}
                  </TableHead>
                  <TableHead className="text-center">
                    {t("ownStats.table.mvps")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perEvent.map((ev) => (
                  <TableRow key={ev.event_id} className="text-xs">
                    <TableCell className="font-medium">
                      {ev.event_name}
                    </TableCell>
                    <TableCell className="capitalize">
                      {formatWord(ev.competition_type)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {/* event date in the viewer's timezone + language. */}
                      {ev.event_date ? (
                        <LocalTime value={ev.event_date} mode="date" />
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-center font-semibold ${
                        ev.best_placement === 1 ? "text-gold" : ""
                      }`}
                    >
                      {placeLabel(ev.best_placement)}
                    </TableCell>
                    <TableCell className="text-center">{ev.kills}</TableCell>
                    <TableCell className="text-center">
                      {ev.total_points}
                    </TableCell>
                    <TableCell className="text-center">{ev.mvps}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Recent matches table (the player's last individual match lines) ──── */}
      <div>
        <div className="mb-3 text-xs font-medium text-muted-foreground">
          {t("ownStats.recentMatches")}
        </div>
        {recentMatches.length === 0 ? (
          <NothingFound text={t("ownStats.noRecentMatches")} />
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("ownStats.table.event")}</TableHead>
                  <TableHead>{t("ownStats.table.map")}</TableHead>
                  <TableHead>{t("ownStats.table.date")}</TableHead>
                  <TableHead className="text-center">
                    {t("ownStats.table.placement")}
                  </TableHead>
                  <TableHead className="text-center">
                    {t("ownStats.table.kills")}
                  </TableHead>
                  <TableHead className="text-center">
                    {t("ownStats.table.damage")}
                  </TableHead>
                  <TableHead className="text-center">
                    {t("ownStats.table.points")}
                  </TableHead>
                  <TableHead className="text-center">
                    {t("ownStats.table.mvp")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentMatches.map((m, i) => (
                  <TableRow
                    key={`${m.event_id}-${m.match_number}-${i}`}
                    className="text-xs"
                  >
                    <TableCell className="font-medium">
                      {m.event_name}
                    </TableCell>
                    <TableCell>{m.match_map ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {/* match date in the viewer's timezone + language. */}
                      {m.match_date ? (
                        <LocalTime value={m.match_date} mode="date" />
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-center font-semibold ${
                        m.placement === 1 ? "text-gold" : ""
                      }`}
                    >
                      {placeLabel(m.placement)}
                    </TableCell>
                    <TableCell className="text-center">{m.kills}</TableCell>
                    <TableCell className="text-center">{m.damage}</TableCell>
                    <TableCell className="text-center">
                      {m.team_points}
                    </TableCell>
                    <TableCell className="text-center">
                      {m.is_mvp ? (
                        <IconMedal className="h-4 w-4 text-gold inline" />
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

// StatBox moved to components/StatBox.tsx (imported at the top of this file). It was
// defined privately here AND in PlayerClient.tsx; the shared version is the same card
// plus an optional `sub` line and a `muted` no-data state.
