"use client";

/**
 * TeamStatisticsTab
 * ----------------------------------------------------------------------------
 * The detailed "Statistics" tab body for a team's public detail page.
 *
 * This component replaces the old blurred "Coming Soon" placeholder. It is wired
 * entirely to the REAL data the backend now returns from POST /team/get-team-details/
 * (the team object). It invents NOTHING: every number traces to a field on `team`.
 *
 * Data sources (all live on the `team` object passed in):
 *   - aggregate scalars: total_wins, total_losses, win_rate, average_kills,
 *     average_placement, total_earnings, team_tier
 *   - tournament_performance[]: one row per event the team played, each carrying
 *     event_date (ISO|null) and prize_earned (decimal string) NEW fields.
 *   - recent_matches[]: per-match rows we group by event_name to power the
 *     expandable per-tournament breakdown.
 *   - tier_history[]: publish-gated season tier/rank history (often [] in this
 *     dataset -> we render a truthful empty state, never a fabricated timeline).
 *
 * Degraded-data honesty (per the backend contract):
 *   - per-event earnings (prize_earned) is real but currently "0.00" everywhere
 *     because EventPrizePayout has no rows. We show "0.00"/"-" where zero, never
 *     a made-up figure, and we HIDE the Earnings metric + the "Earnings by event"
 *     bars entirely when no event has a non-zero prize.
 *   - tier_history may be [] -> show current tier + a subtle "history coming soon"
 *     note rather than inventing tiers/ranks.
 *
 * Visual spec: tasks/team-stats-mockup.html (approved). AFC design constants apply
 * (gold accent, green primary headings, rounded-md cards, text-xs tables, pill segs).
 * No em/en dashes anywhere in user-facing copy.
 *
 * PRIVACY (added):
 *   Detailed team stats are visible ONLY to CURRENT MEMBERS of this team (and AFC
 *   admins). The backend (afc_team/views.py :: get_team_details) is the real
 *   boundary: it returns stats_visible=false and ZEROES the numbers for non-members.
 *
 *   The team page (teams/[id]/page.tsx, owned separately) fetches get-team-details
 *   WITHOUT a token, so its payload is the anonymous (zeroed) one for everyone. To
 *   let actual members see their real stats without editing that page, THIS tab
 *   re-fetches get-team-details ITSELF with the logged-in viewer's Bearer token and
 *   prefers that authoritative, server-gated copy. The page-passed `team` prop is the
 *   fallback (used before the authed fetch resolves, or when logged out). When the
 *   effective payload says stats_visible===false we render a "members only" message
 *   instead of the numbers. The team's public identity (name, tier, member count)
 *   lives on the page header outside this tab and stays visible regardless.
 */

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NothingFound } from "@/components/NothingFound";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import {
  IconChevronRight,
  IconTrendingUp,
  IconTrendingDown,
  IconTrophy,
  IconLock,
} from "@tabler/icons-react";

/* ── Types mirroring the get-team-details contract ────────────────────────── */
// Only the fields this tab actually consumes are typed; the page passes the full
// team object (typed `any` upstream) so unknown keys are simply ignored here.

type TournamentPerformance = {
  event_id: number;
  name: string;
  competition_type: string;
  event_status: string;
  team_status: string;
  best_placement: number | null;
  total_points: number;
  total_kills: number;
  matches_played: number;
  event_date: string | null; // NEW (ISO date) - may be null
  prize_earned: string; // NEW (decimal string, e.g. "0.00")
};

type RecentMatch = {
  event_name: string;
  match_number: number;
  match_map: string;
  placement: number;
  kills: number;
  total_points: number;
  match_date: string;
};

type TierHistoryEntry = {
  season_id: number;
  season_name: string;
  year: number;
  quarter: number;
  tier: number | null;
  tier_label: string | null;
  rank: number | null;
};

type TeamStatisticsTabProps = {
  team: {
    // Used by this tab to re-fetch a token-gated copy of the stats (see below).
    team_name?: string;
    team_tier?: string;
    total_earnings?: string;
    total_wins?: number;
    total_losses?: number;
    win_rate?: number;
    average_kills?: number;
    average_placement?: number;
    tournament_performance?: TournamentPerformance[];
    recent_matches?: RecentMatch[];
    tier_history?: TierHistoryEntry[];
    // PRIVACY (backend afc_team/views.py :: get_team_details): true only when the
    // viewer is a CURRENT member of this team or an AFC admin. When false the
    // backend zeroes the detailed numbers and empties the lists, and we show a
    // "members only" message instead of the stats window. The team's public
    // identity (name, tier, member count) lives on the page header, not here, so
    // it stays visible regardless.
    stats_visible?: boolean;
  };
};

/* ── Small helpers ────────────────────────────────────────────────────────── */

// Parse a decimal string like "1200.00" into a number; null/blank -> 0.
const toMoney = (v: string | null | undefined): number => {
  const n = parseFloat(v ?? "0");
  return Number.isFinite(n) ? n : 0;
};

// "$12,450" style display for whole-dollar amounts.
const fmtMoney = (n: number): string =>
  "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

// Short month label for an ISO date, e.g. "Nov 2025". Falls back to "" when null.
const shortDate = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("default", { month: "short", year: "numeric" });
};

// Placement display: "1st", "2nd", "3rd", "4th"... null -> "-".
const ordinalPlacement = (p: number | null): string => {
  if (p == null) return "-";
  const mod100 = p % 100;
  const mod10 = p % 10;
  let suffix = "th";
  if (mod100 < 11 || mod100 > 13) {
    if (mod10 === 1) suffix = "st";
    else if (mod10 === 2) suffix = "nd";
    else if (mod10 === 3) suffix = "rd";
  }
  return `${p}${suffix}`;
};

// Range presets understood by the time-range filter.
type RangePreset = "3m" | "6m" | "12m" | "all" | "custom";

// The four metrics the performance curve can plot.
type Metric = "placement" | "kills" | "points" | "earnings";

// Tier label -> badge accent class. Mirrors the mockup's t1=gold / t2=green / t3=muted.
const tierChipClass = (tier: number | null, label: string | null): string => {
  // Prefer the numeric tier; fall back to parsing a "Tier N" label.
  const n =
    tier ?? (label ? parseInt(label.replace(/[^0-9]/g, ""), 10) : NaN);
  if (n === 1) return "text-gold border-gold/55";
  if (n === 2) return "text-primary border-primary/50";
  return "text-muted-foreground";
};

const TeamStatisticsTab = ({ team: teamProp }: TeamStatisticsTabProps) => {
  const { token } = useAuth();

  /* ── Token-aware stats payload (the privacy boundary) ──────────────────────
     The parent page fetches get-team-details WITHOUT a token, so its `teamProp`
     is the anonymous (zeroed) payload for everyone. We re-fetch the SAME endpoint
     here WITH the viewer's Bearer token; the backend then returns the real,
     member-gated numbers (stats_visible=true for members/admins). We keep teamProp
     as the immediate fallback so the tab renders instantly, then swap to the authed
     copy when it resolves. Logged-out viewers never fetch and just use teamProp
     (which is correctly the private/zeroed payload). */
  const [authedTeam, setAuthedTeam] = useState<
    TeamStatisticsTabProps["team"] | null
  >(null);
  // True while a logged-in viewer's authed re-fetch is in flight. We use this to
  // avoid flashing the "members only" message before we know the real verdict.
  const [resolvingStats, setResolvingStats] = useState(false);

  useEffect(() => {
    // No token (anonymous) or no team name to key off -> stick with the prop.
    const teamName = teamProp?.team_name;
    if (!token || !teamName) {
      setAuthedTeam(null);
      setResolvingStats(false);
      return;
    }

    let active = true;
    setResolvingStats(true);
    axios
      .post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
        { team_name: teamName },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .then((res) => {
        if (active) setAuthedTeam(res.data?.team ?? null);
      })
      .catch(() => {
        // Non-blocking: fall back to the page-passed prop on any failure.
        if (active) setAuthedTeam(null);
      })
      .finally(() => {
        if (active) setResolvingStats(false);
      });

    return () => {
      active = false;
    };
  }, [token, teamProp?.team_name]);

  // The effective payload everything below reads from: the authed (server-gated)
  // copy when available, otherwise the page-passed prop.
  const team = authedTeam ?? teamProp;

  /* ── Source arrays (defensive defaults) ───────────────────────────────── */
  const allPerf: TournamentPerformance[] = useMemo(
    () => team?.tournament_performance ?? [],
    [team?.tournament_performance],
  );
  const recentMatches: RecentMatch[] = useMemo(
    () => team?.recent_matches ?? [],
    [team?.recent_matches],
  );
  const tierHistory: TierHistoryEntry[] = useMemo(
    () => team?.tier_history ?? [],
    [team?.tier_history],
  );

  /* ── Time-range filter state ──────────────────────────────────────────── */
  const [range, setRange] = useState<RangePreset>("12m");
  // Custom From/To inputs (only used when range === "custom").
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  // The applied custom window (set on "Apply") so typing doesn't refilter live.
  const [appliedCustom, setAppliedCustom] = useState<{
    from: string;
    to: string;
  } | null>(null);

  /* ── Metric switcher state for the performance curve ───────────────────── */
  const [metric, setMetric] = useState<Metric>("placement");

  /* ── Expandable tournament rows ───────────────────────────────────────── */
  const [openRow, setOpenRow] = useState<number | null>(null);

  /* ── Earnings availability (degraded-data guard) ──────────────────────────
     Per-event earnings is genuinely derivable but returns "0.00" for every
     event with no payout row. If NOTHING has a non-zero prize we treat per-event
     earnings as unavailable: drop the Earnings metric + the by-event bars. */
  const hasPerEventEarnings = useMemo(
    () => allPerf.some((p) => toMoney(p.prize_earned) > 0),
    [allPerf],
  );

  /* ── Apply the active time range to the tournament list ────────────────────
     We sort by event_date ascending so the curve reads left (older) to right
     (newer). Rows with a null event_date can't be placed on the timeline, so
     they are kept for the cards/table but excluded from the curve window math. */
  const perfInRange = useMemo(() => {
    // Build [start, end] bounds in ms from the active range.
    let startMs = -Infinity;
    let endMs = Infinity;
    const now = Date.now();
    const monthsAgo = (m: number) => {
      const d = new Date();
      d.setMonth(d.getMonth() - m);
      return d.getTime();
    };

    if (range === "3m") startMs = monthsAgo(3);
    else if (range === "6m") startMs = monthsAgo(6);
    else if (range === "12m") startMs = monthsAgo(12);
    else if (range === "all") startMs = -Infinity;
    else if (range === "custom" && appliedCustom) {
      if (appliedCustom.from) startMs = new Date(appliedCustom.from).getTime();
      if (appliedCustom.to) {
        // Include the whole "to" day.
        endMs = new Date(appliedCustom.to).getTime() + 24 * 60 * 60 * 1000;
      }
    }
    // Guard against an absurd future endMs for non-custom ranges.
    if (range !== "custom") endMs = now + 24 * 60 * 60 * 1000;

    return allPerf
      .filter((p) => {
        // "all time" keeps everything, including events with no date.
        if (range === "all") return true;
        if (!p.event_date) return false; // can't range-filter an undated event
        const t = new Date(p.event_date).getTime();
        if (Number.isNaN(t)) return false;
        return t >= startMs && t <= endMs;
      })
      .sort((a, b) => {
        const ta = a.event_date ? new Date(a.event_date).getTime() : 0;
        const tb = b.event_date ? new Date(b.event_date).getTime() : 0;
        return ta - tb;
      });
  }, [allPerf, range, appliedCustom]);

  /* ── Headline aggregates (framed by the active range) ──────────────────────
     These reflect "in range" so the filter visibly drives the cards, exactly as
     the approved mockup frames them. Total earnings is the one exception: it is
     the lifetime team aggregate (team.total_earnings) and always shown in full. */
  const cardStats = useMemo(() => {
    const tournaments = perfInRange.length;
    const totalKills = perfInRange.reduce((s, p) => s + (p.total_kills || 0), 0);
    const placements = perfInRange
      .map((p) => p.best_placement)
      .filter((p): p is number => p != null);
    const wins = placements.filter((p) => p === 1).length;
    const avgPlacement =
      placements.length > 0
        ? placements.reduce((s, p) => s + p, 0) / placements.length
        : null;
    const winRate = tournaments > 0 ? (wins / tournaments) * 100 : 0;
    const rangeEarnings = perfInRange.reduce(
      (s, p) => s + toMoney(p.prize_earned),
      0,
    );
    return {
      tournaments,
      totalKills,
      wins,
      avgPlacement,
      winRate,
      rangeEarnings,
    };
  }, [perfInRange]);

  // Lifetime total earnings (team aggregate) is always available and shown in full.
  const lifetimeEarnings = toMoney(team?.total_earnings);

  // Current ranking comes from the most recent published tier_history row (if any).
  const latestRanked = useMemo(
    () => tierHistory.find((h) => h.rank != null) ?? null,
    [tierHistory],
  );

  /* ── Performance curve data (per tournament, over time) ───────────────────
     One point per event in range (must have a date to plot on the time axis).
     Placement is inverted (lower placement = better = higher on the chart) by
     using a reversed Y domain on the axis itself, so the line literally climbs
     as the team finishes higher. */
  const curveData = useMemo(() => {
    return perfInRange
      .filter((p) => p.event_date) // only datable events on the time axis
      .map((p) => ({
        label: shortDate(p.event_date),
        name: p.name,
        placement: p.best_placement, // may be null -> recharts skips the point
        kills: p.total_kills,
        points: p.total_points,
        earnings: toMoney(p.prize_earned),
      }));
  }, [perfInRange]);

  // Metric display config: axis label, value formatter, inversion flag, colour.
  const metricConfig: Record<
    Metric,
    {
      label: string;
      dataKey: Metric;
      invert: boolean;
      fmt: (v: number) => string;
    }
  > = {
    placement: {
      label: "Placement (lower is better)",
      dataKey: "placement",
      invert: true,
      fmt: (v) => `#${v}`,
    },
    kills: {
      label: "Kills",
      dataKey: "kills",
      invert: false,
      fmt: (v) => `${v}`,
    },
    points: {
      label: "Points",
      dataKey: "points",
      invert: false,
      fmt: (v) => `${v}`,
    },
    earnings: {
      label: "Earnings ($)",
      dataKey: "earnings",
      invert: false,
      fmt: (v) => fmtMoney(v),
    },
  };
  const mc = metricConfig[metric];

  // Trend direction: compare first vs last plotted value of the active metric.
  // For placement (inverted) a DROP in number is an improvement.
  const trend = useMemo(() => {
    const series = curveData
      .map((d) => d[mc.dataKey] as number | null)
      .filter((v): v is number => v != null);
    if (series.length < 2) return null;
    const first = series[0];
    const last = series[series.length - 1];
    if (first === last) return null;
    const numericallyUp = last > first;
    // improving = up for kills/points/earnings, down for placement
    const improving = mc.invert ? !numericallyUp : numericallyUp;
    return { improving };
  }, [curveData, mc]);

  /* ── Group recent matches by event name for the expandable breakdown ──────── */
  const matchesByEvent = useMemo(() => {
    const map = new Map<string, RecentMatch[]>();
    for (const m of recentMatches) {
      const list = map.get(m.event_name) ?? [];
      list.push(m);
      map.set(m.event_name, list);
    }
    return map;
  }, [recentMatches]);

  /* ── Earnings-by-event rows (only meaningful when prizes exist) ──────────── */
  const earningsRows = useMemo(() => {
    if (!hasPerEventEarnings) return [];
    return allPerf
      .map((p) => ({ name: p.name, amount: toMoney(p.prize_earned) }))
      .filter((e) => e.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [allPerf, hasPerEventEarnings]);
  const maxEarning = earningsRows.length
    ? Math.max(...earningsRows.map((e) => e.amount))
    : 0;

  // Label that tells the user exactly which window is in view.
  const rangeFlag = (() => {
    switch (range) {
      case "3m":
        return "Showing last 3 months";
      case "6m":
        return "Showing last 6 months";
      case "12m":
        return "Showing last 12 months";
      case "all":
        return "Showing all time";
      case "custom":
        return appliedCustom
          ? `Showing ${appliedCustom.from || "start"} to ${
              appliedCustom.to || "now"
            }`
          : "Showing custom range";
    }
  })();

  // Apply the typed custom dates (does nothing until both are usable).
  const applyCustom = () => {
    setRange("custom");
    setAppliedCustom({ from: customFrom, to: customTo });
  };

  // Segment-button styling shared by the range + metric switchers (pill style).
  const segBtn = (active: boolean) =>
    `px-3 h-7 rounded-sm text-xs font-semibold whitespace-nowrap transition-colors ${
      active
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    }`;

  /* ── PRIVACY GATE ──────────────────────────────────────────────────────────
     Detailed team stats are visible ONLY to current team members (and AFC admins).
     The backend signals this with team.stats_visible; when it is explicitly false
     it has already zeroed the numbers and emptied the lists, so we MUST NOT render
     the stats window (it would just show a wall of zeros). Instead show a clear
     "members only" message. We treat undefined as visible for backward-compat with
     any caller/older payload that doesn't send the flag. The team's public identity
     (name, tier, member count) is rendered by the page header outside this tab, so
     it remains visible. All hooks above run unconditionally, so this early return is
     safe (it does not change hook order).

     While a logged-in viewer's authed re-fetch is still in flight we show a small
     loader instead of the (possibly-false) prop verdict, so a member never sees the
     "members only" message flash before their real stats arrive. */
  const statsVisible = team?.stats_visible !== false;

  if (!statsVisible) {
    // Still resolving the authed verdict for a logged-in viewer -> wait, don't flash.
    if (resolvingStats) {
      return (
        <div className="rounded-md border bg-card px-6 py-12 text-center text-sm text-muted-foreground shadow-sm">
          Loading team stats...
        </div>
      );
    }
    return (
      <div className="rounded-md border bg-card px-6 py-12 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="mb-3 rounded-full bg-muted p-3">
          <IconLock className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          Team stats are visible to team members only.
        </p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Join this team to see its detailed performance, tournament history, and
          match breakdowns.
        </p>
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-7">
      {/* ── Time-range filter: drives BOTH the cards and the curve ─────────── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Performance over
        </span>
        <div className="flex flex-wrap items-center gap-3">
          {/* preset segment */}
          <div className="inline-flex gap-0.5 rounded-md bg-muted p-0.5">
            <button
              className={segBtn(range === "3m")}
              onClick={() => setRange("3m")}
            >
              3 months
            </button>
            <button
              className={segBtn(range === "6m")}
              onClick={() => setRange("6m")}
            >
              6 months
            </button>
            <button
              className={segBtn(range === "12m")}
              onClick={() => setRange("12m")}
            >
              12 months
            </button>
            <button
              className={segBtn(range === "all")}
              onClick={() => setRange("all")}
            >
              All time
            </button>
          </div>
          {/* custom From/To + Apply */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Label htmlFor="stat-from" className="text-xs">
              From
            </Label>
            <Input
              id="stat-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 w-[140px] text-xs [color-scheme:dark]"
            />
            <Label htmlFor="stat-to" className="text-xs">
              to
            </Label>
            <Input
              id="stat-to"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 w-[140px] text-xs [color-scheme:dark]"
            />
            <Button size="sm" className="h-8" onClick={applyCustom}>
              Apply
            </Button>
          </div>
        </div>
      </div>
      <p className="-mt-4 text-xs font-semibold text-primary">{rangeFlag}</p>

      {/* ── Headline stat cards (framed "in range") ───────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Tournaments"
          value={`${cardStats.tournaments}`}
          sub="in range"
        />
        <StatCard
          label="Total Kills"
          value={cardStats.totalKills.toLocaleString()}
          sub="in range"
          valueClass="text-primary"
        />
        <StatCard
          label="Wins (1st)"
          value={`${cardStats.wins}`}
          sub="1st-place finishes"
          valueClass="text-gold"
        />
        <StatCard
          label="Earnings"
          value={fmtMoney(lifetimeEarnings)}
          sub="total prize money"
        />
        <StatCard
          label="Avg Placement"
          value={
            cardStats.avgPlacement != null
              ? `#${cardStats.avgPlacement.toFixed(1)}`
              : "-"
          }
          sub="lower is better"
        />
        <StatCard
          label="Win Rate"
          value={`${cardStats.winRate.toFixed(0)}%`}
          sub="1st-place share"
        />
        <StatCard
          label="Current Tier"
          value={team?.team_tier || "Unranked"}
          sub="current grade"
          valueClass="text-gold"
        />
        <StatCard
          label="Ranking"
          value={latestRanked?.rank != null ? `#${latestRanked.rank}` : "Unranked"}
          sub={
            latestRanked?.season_name
              ? latestRanked.season_name
              : "not yet ranked"
          }
          valueClass={latestRanked?.rank != null ? "text-primary" : undefined}
        />
      </div>

      {/* ── Performance curve + Ranking/tier history side by side ──────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* Performance curve with metric switcher */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Performance curve</CardTitle>
              <div className="inline-flex gap-0.5 rounded-md bg-muted p-0.5">
                <button
                  className={segBtn(metric === "placement")}
                  onClick={() => setMetric("placement")}
                >
                  Placement
                </button>
                <button
                  className={segBtn(metric === "kills")}
                  onClick={() => setMetric("kills")}
                >
                  Kills
                </button>
                <button
                  className={segBtn(metric === "points")}
                  onClick={() => setMetric("points")}
                >
                  Points
                </button>
                {/* Earnings metric only offered when per-event prizes exist */}
                {hasPerEventEarnings && (
                  <button
                    className={segBtn(metric === "earnings")}
                    onClick={() => setMetric("earnings")}
                  >
                    Earnings
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {curveData.length < 2 ? (
              // Need at least two datable events to draw a meaningful line.
              <div className="flex h-[260px] items-center justify-center text-center text-sm text-muted-foreground">
                Not enough dated tournaments in this range to plot a curve.
              </div>
            ) : (
              <>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={curveData}
                      margin={{ top: 18, right: 16, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                      />
                      <YAxis
                        // Placement axis is reversed so #1 sits at the TOP.
                        reversed={mc.invert}
                        allowDecimals={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                        tickFormatter={(v) => mc.fmt(v as number)}
                        label={{
                          value: mc.label,
                          angle: -90,
                          position: "insideLeft",
                          style: {
                            fill: "var(--muted-foreground)",
                            fontSize: 11,
                            textAnchor: "middle",
                          },
                        }}
                        width={70}
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
                          mc.fmt(Number(value)),
                          mc.label,
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey={mc.dataKey}
                        stroke="var(--primary)"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "var(--primary)" }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      >
                        {/* Plotted value labels above each point. */}
                        <LabelList
                          dataKey={mc.dataKey}
                          position="top"
                          formatter={(v: any) =>
                            v == null ? "" : mc.fmt(Number(v))
                          }
                          style={{
                            fill: "var(--foreground)",
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {/* trend tag */}
                {trend && (
                  <div className="mt-3">
                    {trend.improving ? (
                      <Badge
                        variant="outline"
                        className="border-primary/40 text-primary"
                      >
                        <IconTrendingUp className="size-3" /> improving
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-red-500/40 text-red-400"
                      >
                        <IconTrendingDown className="size-3" /> declining
                      </Badge>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Ranking & tier history (timeline OR honest empty state) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ranking &amp; tier history</CardTitle>
          </CardHeader>
          <CardContent>
            {tierHistory.length === 0 ? (
              // Degraded: no published seasons. Show current tier + a calm note,
              // never a fabricated timeline.
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Current tier
                  </span>
                  <Badge
                    variant="outline"
                    className="border-gold/55 text-gold"
                  >
                    {team?.team_tier || "Unranked"}
                  </Badge>
                </div>
                <p className="text-xs italic text-muted-foreground">
                  Season by season ranking history is coming soon. It appears
                  here once seasonal tiers and rankings are published.
                </p>
              </div>
            ) : (
              <div>
                {tierHistory.map((h, i) => {
                  // Compute the up/down rank delta against the PREVIOUS season row.
                  // tier_history arrives newest first, so the "previous" season is
                  // the next index. A smaller rank number is an improvement.
                  const prev = tierHistory[i + 1];
                  let deltaNode: React.ReactNode = null;
                  if (h.rank != null && prev && prev.rank != null) {
                    const diff = prev.rank - h.rank; // positive = moved up
                    if (diff > 0)
                      deltaNode = (
                        <span className="font-bold text-primary">
                          (up {diff})
                        </span>
                      );
                    else if (diff < 0)
                      deltaNode = (
                        <span className="font-bold text-red-400">
                          (down {Math.abs(diff)})
                        </span>
                      );
                  } else if (h.rank != null && (!prev || prev.rank == null)) {
                    deltaNode = (
                      <span className="text-xs text-muted-foreground">
                        (new)
                      </span>
                    );
                  }
                  return (
                    <div
                      key={h.season_id}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-border/60 py-2.5 text-sm first:border-t-0"
                    >
                      <span className="text-xs text-muted-foreground">
                        {h.season_name}
                      </span>
                      <span>
                        <Badge
                          variant="outline"
                          className={tierChipClass(h.tier, h.tier_label)}
                        >
                          {h.tier_label || `Tier ${h.tier ?? "-"}`}
                        </Badge>
                      </span>
                      <span className="text-right text-sm font-semibold">
                        {h.rank != null ? `#${h.rank}` : "-"}{" "}
                        {deltaNode}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Earnings by event (only when real per-event prizes exist) ──────── */}
      {hasPerEventEarnings ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Earnings by event
            </span>
            <span className="text-sm text-muted-foreground">
              Total{" "}
              <b className="text-gold">{fmtMoney(lifetimeEarnings)}</b>
            </span>
          </div>
          <Card>
            <CardContent className="space-y-3">
              {earningsRows.map((e) => (
                <div key={e.name} className="flex items-center gap-3 text-sm">
                  <span className="w-32 shrink-0 truncate md:w-40">
                    {e.name}
                  </span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-gold"
                      style={{
                        width: `${Math.round((e.amount / maxEarning) * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="w-16 text-right font-bold">
                    {fmtMoney(e.amount)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        // Earnings still shows the lifetime total, but the by-event breakdown is
        // omitted truthfully because no event has a recorded payout yet.
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Earnings
            </span>
            <span className="text-sm text-muted-foreground">
              Total <b className="text-gold">{fmtMoney(lifetimeEarnings)}</b>
            </span>
          </div>
          <Card>
            <CardContent>
              <p className="text-xs italic text-muted-foreground">
                A per event prize breakdown appears here once event payouts are
                recorded.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── All tournaments table (expandable per-match breakdown) ─────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            All tournaments played (tap a row for details)
          </span>
          <span className="text-sm text-muted-foreground">
            {allPerf.length} {allPerf.length === 1 ? "event" : "events"}
          </span>
        </div>
        <Card className="overflow-hidden p-0">
          {allPerf.length === 0 ? (
            <div className="p-6">
              <NothingFound text="No tournaments played yet." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-10 w-8 p-2" />
                  <TableHead className="h-10 p-2 text-foreground">
                    Event
                  </TableHead>
                  <TableHead className="h-10 p-2 text-foreground">
                    Date
                  </TableHead>
                  <TableHead className="h-10 p-2 text-foreground">
                    Type
                  </TableHead>
                  <TableHead className="h-10 p-2 text-center text-foreground">
                    Placement
                  </TableHead>
                  <TableHead className="h-10 p-2 text-center text-foreground">
                    Kills
                  </TableHead>
                  <TableHead className="h-10 p-2 text-center text-foreground">
                    Points
                  </TableHead>
                  <TableHead className="h-10 p-2 text-right text-foreground">
                    Prize
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPerf.map((t) => {
                  const isOpen = openRow === t.event_id;
                  const isWin = t.best_placement === 1;
                  const prize = toMoney(t.prize_earned);
                  const matches = matchesByEvent.get(t.name) ?? [];
                  return (
                    <React.Fragment key={t.event_id}>
                      <TableRow
                        className="cursor-pointer text-xs"
                        onClick={() => setOpenRow(isOpen ? null : t.event_id)}
                      >
                        <TableCell className="p-2">
                          <IconChevronRight
                            className={`size-3.5 text-muted-foreground transition-transform ${
                              isOpen ? "rotate-90 text-primary" : ""
                            }`}
                          />
                        </TableCell>
                        <TableCell className="p-2 font-semibold">
                          {t.name}
                        </TableCell>
                        <TableCell className="p-2 text-muted-foreground">
                          {shortDate(t.event_date) || "-"}
                        </TableCell>
                        <TableCell className="p-2">
                          <Badge
                            variant="outline"
                            className="text-muted-foreground capitalize"
                          >
                            {t.competition_type}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`p-2 text-center font-bold ${
                            isWin ? "text-gold" : ""
                          }`}
                        >
                          {isWin && (
                            <IconTrophy className="mr-1 inline size-3.5" />
                          )}
                          {ordinalPlacement(t.best_placement)}
                        </TableCell>
                        <TableCell className="p-2 text-center">
                          {t.total_kills}
                        </TableCell>
                        <TableCell className="p-2 text-center">
                          {t.total_points}
                        </TableCell>
                        <TableCell className="p-2 text-right">
                          {prize > 0 ? fmtMoney(prize) : "-"}
                        </TableCell>
                      </TableRow>

                      {/* Expanded per-match breakdown row */}
                      {isOpen && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={8} className="bg-background p-0">
                            <div className="px-4 pb-4 pl-10 pt-1">
                              {/* summary boxes */}
                              <div className="mb-2 grid grid-cols-2 gap-2.5 md:grid-cols-4">
                                <SummaryBox
                                  label="Final placement"
                                  value={ordinalPlacement(t.best_placement)}
                                />
                                <SummaryBox
                                  label="Total kills"
                                  value={`${t.total_kills}`}
                                />
                                <SummaryBox
                                  label="Total points"
                                  value={`${t.total_points}`}
                                />
                                <SummaryBox
                                  label="Prize won"
                                  value={prize > 0 ? fmtMoney(prize) : "-"}
                                />
                              </div>
                              <h4 className="mb-2 mt-3 text-[0.68rem] uppercase tracking-wide text-muted-foreground">
                                Per-match breakdown
                              </h4>
                              {matches.length === 0 ? (
                                <p className="text-xs italic text-muted-foreground">
                                  No per-match records available for this event.
                                </p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="h-9 p-2 text-foreground">
                                        Match
                                      </TableHead>
                                      <TableHead className="h-9 p-2 text-foreground">
                                        Map
                                      </TableHead>
                                      <TableHead className="h-9 p-2 text-center text-foreground">
                                        Placement
                                      </TableHead>
                                      <TableHead className="h-9 p-2 text-center text-foreground">
                                        Kills
                                      </TableHead>
                                      <TableHead className="h-9 p-2 text-right text-foreground">
                                        Points
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {matches.map((m, mi) => (
                                      <TableRow
                                        key={`${t.event_id}-${m.match_number}-${mi}`}
                                        className="text-xs"
                                      >
                                        <TableCell className="p-2">
                                          {`Match ${m.match_number}`}
                                        </TableCell>
                                        <TableCell className="p-2">
                                          {m.match_map || "-"}
                                        </TableCell>
                                        <TableCell className="p-2 text-center">
                                          {`#${m.placement}`}
                                        </TableCell>
                                        <TableCell className="p-2 text-center">
                                          {m.kills}
                                        </TableCell>
                                        <TableCell className="p-2 text-right">
                                          {m.total_points}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
};

/* ── Small presentational helpers ─────────────────────────────────────────── */

// A single headline stat card. Matches the AFC card idiom (rounded-md, border).
const StatCard = ({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) => (
  <div className="rounded-md border bg-card px-4 py-4 shadow-sm">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`mt-1 text-2xl font-bold ${valueClass ?? ""}`}>{value}</p>
    <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
  </div>
);

// A small summary box inside the expanded tournament detail row.
const SummaryBox = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border bg-card px-3 py-2.5">
    <p className="text-[0.68rem] text-muted-foreground">{label}</p>
    <p className="mt-0.5 text-base font-bold">{value}</p>
  </div>
);

export default TeamStatisticsTab;
