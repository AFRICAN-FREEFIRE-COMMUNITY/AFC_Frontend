// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Metrics  (detailed analytics dashboard)
//
// The deep performance dashboard for the selected organization, aggregated across
// EVERY event the org owns. It is intentionally richer than the public team-stats and
// player-profile surfaces: headline scorecards, recharts visualizations (participation
// over time, event-type split, top players / top teams, prize distribution), and dense
// tables (per-event breakdown + the two leaderboards), all organised under shadcn pill
// Tabs once the surface gets large.
//
// DATA SOURCE (single round-trip):
//   organizersApi.getOrgMetrics(slug)  →  GET /organizers/metrics/<slug>/
//   (org_metrics in backend afc_organizers/views_reviews.py). One rich payload:
//     • flat back-compat keys: events_count / registered_teams / registered_players /
//       total_kills / average_rating / ratings_count
//     • totals{}:   by_status / by_type / by_mode / by_tier splits, unique teams + players,
//                   total matches / kills / prize money, avg participants per event,
//                   registration_fill_rate, completion_rate
//     • rating{}:   { average, count }
//     • monthly[]:  { month, events, participants, matches }  (the participation trend)
//     • top_teams[]:   { team_id, team_name, kills, wins }    (top 10, by kills)
//     • top_players[]: { user_id, username, kills }           (top 10, by kills)
//     • events[]:   capped per-event rows (newest first)      (the per-event table)
//   Each metric in that payload is computed by a single grouped DB query server-side
//   (no N+1), so this page only ever issues ONE request.
//
// GATING: identical to the rest of the portal (events → can_create_events, reviews →
// can_view_reviews). Here the gate is membership.permissions.can_view_metrics OR isOwner.
// A member without that permission gets the read-only lock notice and the metrics are
// never fetched.
//
// EMPTY STATE: when the org owns zero events the loader is cleared and a calm empty card
// is shown — never an infinite spinner (the bug we fixed elsewhere in the portal). The
// backend returns clean zeros + empty lists for a brand-new org, so this is data-driven.
//
// The selected slug is read from OrganizerContext (the portal layout owns "which org is
// selected" and re-mounts this subtree keyed on slug, so the fetch below re-runs on switch).
//
// DESIGN: AFC constants throughout (DM Sans, green-primary headings via PageHeader,
// rounded-md bordered Cards, text-xs dense tables with text-foreground headers, outline
// rounded-full badges, recharts themed off CSS vars exactly like TeamStatisticsTab, pill
// segment Tabs). No em/en dashes anywhere in user-facing copy.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconCalendarEvent,
  IconCalendarStats,
  IconCash,
  IconChartBar,
  IconChevronDown,
  IconChevronRight,
  IconCrosshair,
  IconEye,
  IconLock,
  IconPercentage,
  IconStarFilled,
  IconSwords,
  IconTrophy,
  IconUserCheck,
  IconUserX,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";
import { organizersApi } from "@/lib/organizers";
import { useOrganizer } from "../_components/OrganizerContext";

// ── Payload types (mirror org_metrics in views_reviews.py) ──────────────────────
// Only the fields this page consumes are typed. Everything is optional so the page
// renders sensibly even if a given backend build omits a block (defaults to 0 / []).

interface MetricTotals {
  events?: number;
  completed_events?: number;
  unique_teams?: number;
  unique_players?: number;
  registered_teams?: number;
  total_participants?: number;
  // registration completeness (complete = confirmed entrant; incomplete = any other status)
  complete_registrations?: number;
  incomplete_registrations?: number;
  total_matches?: number;
  total_kills?: number;
  total_prize_money?: number;
  // page-view headline numbers (in range), sourced from EventPageView server-side
  total_views?: number;
  unique_viewers?: number;
  avg_participants_per_event?: number;
  registration_fill_rate?: number | null;
  completion_rate?: number | null;
  by_status?: Record<string, number>;
  by_type?: Record<string, number>;
  by_mode?: Record<string, number>;
  by_tier?: Record<string, number>;
}

// The monthly trend now carries in-range activity counts (registrations / matches / page views)
// rather than event-start buckets, so it moves with the selected date range.
interface MonthlyPoint {
  month: string; // "YYYY-MM"
  registrations: number;
  matches: number;
  views: number;
}

interface TopTeam {
  team_id: number;
  team_name: string;
  kills: number;
  wins: number;
}

interface TopPlayer {
  user_id: number;
  username: string;
  kills: number;
}

interface EventRow {
  event_id: number;
  event_name: string;
  start_date: string | null;
  event_status: string;
  competition_type: string;
  participant_type: string;
  tournament_tier: string;
  participants: number;
  // per-event registration completeness (in range)
  complete_registrations: number;
  incomplete_registrations: number;
  capacity: number;
  // per-event page views (in range): raw views + de-duped unique viewers
  views: number;
  unique_viewers: number;
  matches: number;
  kills: number;
  prize_money: number;
  rating: number | null;
  ratings_count: number;
}

interface OrgMetrics {
  // window the server applied (null bounds == all-time)
  range?: { start: string | null; end: string | null };
  // flat back-compat keys (still consumed for the very top scorecards)
  events_count?: number;
  registered_teams?: number;
  registered_players?: number;
  total_kills?: number;
  average_rating?: number | null;
  ratings_count?: number;
  // rich blocks
  totals?: MetricTotals;
  registrations?: { complete: number; incomplete: number; total: number };
  page_views?: { total_views: number; unique_viewers: number };
  rating?: { average: number | null; count: number };
  monthly?: MonthlyPoint[];
  top_teams?: TopTeam[];
  top_players?: TopPlayer[];
  events?: EventRow[];
  events_returned?: number;
  events_truncated?: boolean;
}

// ── Date-range presets ──────────────────────────────────────────────────────────
// The quick-pick chips at the top of the page. "all" sends no start/end (all-time);
// each numbered preset sends start = today - N days, end = today. Custom start/end
// (the two date inputs) override the preset. All bounds are INCLUSIVE day boundaries
// (the backend applies them via __date__gte / __date__lte).
type RangePreset = "all" | "7" | "30" | "90" | "custom";

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "all", label: "All time" },
];

// Format a Date as "YYYY-MM-DD" (local), the wire format the backend's ?start/?end expect.
const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Resolve a numbered preset ("7"/"30"/"90") into a concrete { start, end } window ending today.
const presetWindow = (days: number): { start: string; end: string } => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1)); // inclusive of today => N-day window
  return { start: toISODate(start), end: toISODate(end) };
};

// ── Chart palette ───────────────────────────────────────────────────────────────
// We theme line/area/bar fills off the AFC CSS vars (primary green + gold), exactly
// like TeamStatisticsTab, so charts read as the same designer's work. The pie slices
// cycle a small fixed palette anchored on those two brand colours.
const C_PRIMARY = "var(--primary)";
const C_GOLD = "var(--gold)";
const PIE_COLORS = [
  "var(--primary)",
  "var(--gold)",
  "#60a5fa", // blue-400
  "#f97316", // orange-500
  "#a78bfa", // violet-400
];

// ── Formatters ──────────────────────────────────────────────────────────────────

// "$12,450" style for whole-dollar prize amounts (mirrors TeamStatisticsTab.fmtMoney).
const fmtMoney = (n: number): string =>
  "$" + (n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

// "1,234" thousands-separated integer.
const fmtInt = (n: number): string => (n || 0).toLocaleString();

// "YYYY-MM" → "Mon YY" e.g. "2026-06" → "Jun 26" for compact axis labels.
const fmtMonth = (key: string): string => {
  const [y, m] = (key || "").split("-");
  const monthIdx = parseInt(m, 10) - 1;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  if (Number.isNaN(monthIdx) || !months[monthIdx] || !y) return key;
  return `${months[monthIdx]} ${y.slice(2)}`;
};

// ISO date → "Jun 2026" for the per-event table (null → "-").
const fmtDate = (iso: string | null): string => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("default", { month: "short", year: "numeric" });
};

// Humanise a split key for chart labels: "physical(lan)" → "Physical(lan)",
// "tier_1" → "Tier 1", "tournament" → "Tournament".
const humanise = (key: string): string => {
  if (!key) return "Unknown";
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

// Turn a {key: count} split into the [{ name, value }] recharts rows pie/bar want.
const splitToRows = (
  split: Record<string, number> | undefined,
): { name: string; value: number }[] =>
  Object.entries(split ?? {})
    .map(([k, v]) => ({ name: humanise(k), value: v }))
    .sort((a, b) => b.value - a.value);

// Shared recharts Tooltip style (card bg, border, small text) used by every chart.
const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
} as const;

// ── StatCard ──────────────────────────────────────────────────────────────────
// The AFC headline-stat idiom (icon chip + big number + muted label), matching the
// organizer Overview StatTile and TeamStatisticsTab.StatCard. `sub` hangs a muted line
// under the value; `valueClass` lets a metric pop in gold/green where it earns it.
function StatCard({
  icon,
  label,
  value,
  sub,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className={`text-2xl font-bold ${valueClass ?? ""}`}>{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && (
            <p className="text-[11px] text-muted-foreground/80">{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────
// Outline badge (rounded-full, text-xs) per AFC constants; colour by event status,
// reusing the exact mapping the organizer Events list uses for visual continuity.
function StatusBadge({ status }: { status: string }) {
  const normalized = (status || "").toLowerCase();
  const colour =
    normalized === "ongoing"
      ? "border-green-500 text-green-600"
      : normalized === "completed"
        ? "border-blue-500 text-blue-600"
        : "border-yellow-500 text-yellow-600"; // upcoming / unknown
  return (
    <Badge variant="outline" className={`capitalize ${colour}`}>
      {status || "unknown"}
    </Badge>
  );
}

// ── DateRangeControl ────────────────────────────────────────────────────────────
// The timeframe picker that sits at the top of the page. Preset chips (Last 7 / 30 / 90
// days / All time) plus two optional custom date inputs (start + end). Picking a chip
// clears the custom inputs; editing a custom input switches the active preset to "custom".
// Changing anything re-fetches org_metrics with the new window (the page owns that effect).
// Styled with the repo's native <Input type="date"> date pattern (mirrors the rankings audit
// filter) and shadcn buttons, so it reads as the same designer's work.
function DateRangeControl({
  preset,
  setPreset,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
}: {
  preset: RangePreset;
  setPreset: (p: RangePreset) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Preset chips. The active chip gets a filled (default) button; the rest are outline. */}
        <div className="flex flex-wrap items-center gap-2">
          <IconCalendarStats className="size-4 text-muted-foreground" />
          <span className="mr-1 text-xs font-medium text-muted-foreground">
            Timeframe
          </span>
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              type="button"
              size="sm"
              variant={preset === p.key ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => {
                // Selecting a preset clears any custom dates so the window is unambiguous.
                setPreset(p.key);
                setCustomStart("");
                setCustomEnd("");
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {/* Custom range. Editing either input switches the active preset to "custom" so the
            two dates take over from the chips. Either side may be left blank (open-ended). */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Custom</span>
          <Input
            type="date"
            value={customStart}
            max={customEnd || undefined}
            onChange={(e) => {
              setCustomStart(e.target.value);
              setPreset("custom");
            }}
            className="h-8 w-[9.5rem] text-xs"
            aria-label="Custom start date"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={customEnd}
            min={customStart || undefined}
            onChange={(e) => {
              setCustomEnd(e.target.value);
              setPreset("custom");
            }}
            className="h-8 w-[9.5rem] text-xs"
            aria-label="Custom end date"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrganizerMetricsPage() {
  const { slug, membership, isOwner } = useOrganizer();

  // Same gate the rest of the portal uses, on the metrics permission.
  const canViewMetrics = membership.permissions.can_view_metrics || isOwner;

  const [metrics, setMetrics] = useState<OrgMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Date-range state ──────────────────────────────────────────────────────────
  // `preset` drives the quick-pick chips; `customStart`/`customEnd` back the two date
  // inputs. Default is "all" (all-time) so the page opens on the full picture. Picking a
  // numbered chip clears the custom inputs; typing in a custom input flips preset to
  // "custom". The effective { start, end } sent to the backend is derived in `range` below.
  const [preset, setPreset] = useState<RangePreset>("all");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  // Which per-event rows are expanded into their detailed drill-down (Events tab). Keyed by
  // event_id; a row toggles open/closed on click to reveal its full per-event metric panel.
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const toggleEvent = (id: number) =>
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Effective window actually sent to the API (memoised; recomputes when the controls change).
  //   - "all"            => no params (all-time)
  //   - "7"/"30"/"90"    => a today-anchored window
  //   - "custom"         => whatever the two date inputs hold (each side optional)
  const range = useMemo<{ start?: string; end?: string }>(() => {
    if (preset === "custom") {
      const r: { start?: string; end?: string } = {};
      if (customStart) r.start = customStart;
      if (customEnd) r.end = customEnd;
      return r;
    }
    if (preset === "7" || preset === "30" || preset === "90") {
      return presetWindow(Number(preset));
    }
    return {}; // "all"
  }, [preset, customStart, customEnd]);

  // ── Load this org's aggregate metrics. Only fetched when the caller is allowed to
  // see them (a gated member never triggers the request). Re-runs on org switch (the
  // layout re-mounts this subtree keyed on slug) AND whenever the date range changes,
  // so every card/chart/table reflects the selected window. ──
  useEffect(() => {
    // Gated members see the lock notice, not the stats — skip the fetch entirely.
    if (!canViewMetrics) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        // Pass the effective window; an empty object means all-time (no ?start/?end).
        const res = await organizersApi.getOrgMetrics(slug, range);
        setMetrics(res ?? null);
      } catch (err: any) {
        toast.error(err?.response?.data?.message || "Failed to load metrics.");
      } finally {
        // Always clear the loader — including on error — so the page never spins forever.
        setLoading(false);
      }
    };

    load();
  }, [slug, canViewMetrics, range]);

  // ── Derive the view-model from the payload (memoised; recomputes on new data). ──
  const totals = metrics?.totals ?? {};
  const monthly = useMemo(() => metrics?.monthly ?? [], [metrics?.monthly]);
  const topTeams = useMemo(() => metrics?.top_teams ?? [], [metrics?.top_teams]);
  const topPlayers = useMemo(
    () => metrics?.top_players ?? [],
    [metrics?.top_players],
  );
  const eventRows = useMemo(() => metrics?.events ?? [], [metrics?.events]);

  // Headline numbers (prefer the rich totals block; fall back to the flat keys).
  const eventsCount = totals.events ?? metrics?.events_count ?? 0;
  const uniquePlayers =
    totals.unique_players ?? metrics?.registered_players ?? 0;
  const uniqueTeams = totals.unique_teams ?? 0;
  const totalMatches = totals.total_matches ?? 0;
  const totalKills = totals.total_kills ?? metrics?.total_kills ?? 0;
  const totalPrize = totals.total_prize_money ?? 0;
  const avgParticipants = totals.avg_participants_per_event ?? 0;
  const fillRate = totals.registration_fill_rate ?? null;
  const completionRate = totals.completion_rate ?? null;
  // Page-view headline numbers (in range) — sourced from EventPageView server-side.
  const totalViews =
    metrics?.page_views?.total_views ?? totals.total_views ?? 0;
  const uniqueViewers =
    metrics?.page_views?.unique_viewers ?? totals.unique_viewers ?? 0;
  // Registration completeness (in range): confirmed entrants vs everything else.
  const completeRegs =
    metrics?.registrations?.complete ?? totals.complete_registrations ?? 0;
  const incompleteRegs =
    metrics?.registrations?.incomplete ?? totals.incomplete_registrations ?? 0;
  const ratingsCount = metrics?.rating?.count ?? metrics?.ratings_count ?? 0;
  const avgRatingRaw = metrics?.rating?.average ?? metrics?.average_rating ?? null;
  // Average rating: one decimal, or "-" with no ratings (never a misleading "0.0").
  const averageRating =
    ratingsCount > 0 && avgRatingRaw != null ? avgRatingRaw.toFixed(1) : "-";

  // Chart rows derived from the splits.
  const typeRows = useMemo(() => splitToRows(totals.by_type), [totals.by_type]);
  const statusRows = useMemo(
    () => splitToRows(totals.by_status),
    [totals.by_status],
  );
  const modeRows = useMemo(() => splitToRows(totals.by_mode), [totals.by_mode]);

  // Prize-by-event rows (only events that actually paid out), for the prize bar chart.
  const prizeRows = useMemo(
    () =>
      eventRows
        .filter((e) => (e.prize_money || 0) > 0)
        .map((e) => ({ name: e.event_name, prize: e.prize_money }))
        .sort((a, b) => b.prize - a.prize)
        .slice(0, 10),
    [eventRows],
  );

  // Human label for the active window (shown under the header), e.g. "Last 30 days" or
  // "Dec 1, 2025 to Dec 31, 2025". Reads the server-echoed range when present so the label
  // matches exactly what the data reflects.
  const rangeLabel = useMemo(() => {
    if (preset === "7") return "Last 7 days";
    if (preset === "30") return "Last 30 days";
    if (preset === "90") return "Last 90 days";
    if (preset === "all") return "All time";
    // custom: describe whichever bounds are set (either side may be open).
    const s = metrics?.range?.start ?? customStart;
    const e = metrics?.range?.end ?? customEnd;
    const f = (iso: string) => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString("default", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
    };
    if (s && e) return `${f(s)} to ${f(e)}`;
    if (s) return `From ${f(s)}`;
    if (e) return `Up to ${f(e)}`;
    return "All time";
  }, [preset, customStart, customEnd, metrics?.range]);

  // The shared timeframe control, rendered in every non-locked state so the user can always
  // change the window (even when the current window has no data).
  const dateControl = (
    <DateRangeControl
      preset={preset}
      setPreset={setPreset}
      customStart={customStart}
      setCustomStart={setCustomStart}
      customEnd={customEnd}
      setCustomEnd={setCustomEnd}
    />
  );

  // Whether the selected window actually contains any activity. Drives the "no data in this
  // range" empty state (distinct from the "org has zero events at all" empty state).
  const hasDataInRange =
    totalViews > 0 ||
    (totals.total_participants ?? 0) > 0 ||
    totalMatches > 0 ||
    totalKills > 0 ||
    ratingsCount > 0;

  // ── Non-permitted member: read-only lock notice (mirrors the Reviews / Design pages). ──
  if (!canViewMetrics) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Metrics"
          description="A performance dashboard for your organization."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IconLock className="size-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              You don&apos;t have permission to view this organization&apos;s
              metrics.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── First load: no payload yet. Show a calm loading line (the header + control appear as
  // soon as the first payload lands). Subsequent range changes keep the UI up with an inline
  // "updating..." hint instead of blanking the page. ──
  if (loading && metrics === null) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Metrics"
          description="A performance dashboard for your organization, across all of its events."
        />
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          Loading metrics...
        </div>
      </div>
    );
  }

  // ── Empty state: org owns zero events (roster is empty, regardless of window). The date
  // control is hidden here since there is nothing to scope. Never a spinner. ──
  // NB: this uses the roster-based eventsCount (NOT date-filtered), so it only fires for a
  // genuinely brand-new org, not merely an empty date window (that case is handled below).
  if (!loading && eventsCount === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Metrics"
          description="A performance dashboard for your organization, across all of its events."
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconChartBar className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              Your organization hasn&apos;t run any events yet. Metrics appear
              here once you have created and run your first event.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Metrics"
        description="A performance dashboard for your organization, across all of its events."
      />

      {/* ── Timeframe picker: scopes every card / chart / table below. ───────── */}
      {dateControl}

      {/* Active-window line + a subtle inline loading hint while the range re-fetches. */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          Showing: <span className="font-medium text-foreground">{rangeLabel}</span>
        </span>
        {loading && <span className="text-muted-foreground/70">updating...</span>}
      </div>

      {/* ── Empty state for THIS window: the org has events, but none of them have any
            activity inside the selected range. Calm card + the control stays above so the
            user can widen the window. Suppressed while loading so it never flashes. ── */}
      {!loading && !hasDataInRange ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconCalendarStats className="size-6" />
            </div>
            <p className="max-w-md text-sm text-muted-foreground">
              No activity in this timeframe. Try a wider range (or All time) to
              see registrations, views, matches, and ratings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
      {/* ── Headline scorecards ─────────────────────────────────────────────── */}
      {/* The at-a-glance strip: the numbers an organizer checks first. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          icon={<IconCalendarEvent className="size-5" />}
          label="Events run"
          value={fmtInt(eventsCount)}
          sub={`${fmtInt(totals.completed_events ?? 0)} completed`}
        />
        {/* Event views: total event-detail page loads in the selected window (from
            EventPageView server-side), with de-duped unique-viewer count underneath. */}
        <StatCard
          icon={<IconEye className="size-5" />}
          label="Event views"
          value={fmtInt(totalViews)}
          sub={`${fmtInt(uniqueViewers)} unique viewer${uniqueViewers !== 1 ? "s" : ""}`}
          valueClass="text-primary"
        />
        <StatCard
          icon={<IconUsers className="size-5" />}
          label="Unique players"
          value={fmtInt(uniquePlayers)}
          sub="registered in range"
        />
        <StatCard
          icon={<IconUsersGroup className="size-5" />}
          label="Unique teams"
          value={fmtInt(uniqueTeams)}
          sub="registered in range"
        />
        {/* Registrations: confirmed entrants vs incomplete (pending/rejected/etc). The big
            number is confirmed; the sub spells out the incomplete tail. */}
        <StatCard
          icon={<IconUserCheck className="size-5" />}
          label="Confirmed registrations"
          value={fmtInt(completeRegs)}
          sub={`${fmtInt(incompleteRegs)} incomplete`}
        />
        <StatCard
          icon={<IconSwords className="size-5" />}
          label="Matches played"
          value={fmtInt(totalMatches)}
          sub="total across events"
        />
        <StatCard
          icon={<IconCrosshair className="size-5" />}
          label="Total kills"
          value={fmtInt(totalKills)}
          sub="tallied in all matches"
        />
        <StatCard
          icon={<IconCash className="size-5" />}
          label="Prize money"
          value={fmtMoney(totalPrize)}
          sub="awarded to date"
          valueClass="text-gold"
        />
        <StatCard
          icon={<IconUsers className="size-5" />}
          label="Avg participants"
          value={avgParticipants}
          sub="per event"
        />
        <StatCard
          icon={<IconStarFilled className="size-5" />}
          label="Average rating"
          value={averageRating}
          sub={`from ${fmtInt(ratingsCount)} rating${ratingsCount !== 1 ? "s" : ""}`}
          valueClass={ratingsCount > 0 ? "text-gold" : undefined}
        />
        <StatCard
          icon={<IconPercentage className="size-5" />}
          label="Fill rate"
          value={fillRate != null ? `${fillRate}%` : "-"}
          sub="of registration capacity"
        />
        <StatCard
          icon={<IconTrophy className="size-5" />}
          label="Completion rate"
          value={completionRate != null ? `${completionRate}%` : "-"}
          sub="events completed"
          valueClass="text-primary"
        />
      </div>

      {/* ── Detail under pill Tabs (keeps the surface scannable as it grows). ── */}
      <Tabs defaultValue="trends" className="w-full">
        <TabsList className="h-9">
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        {/* ════════ TAB 1 — Trends: activity over time + prize distribution ════════ */}
        <TabsContent value="trends" className="mt-4 flex flex-col gap-4">
          {/* Activity over time: registrations + page views + matches per month (area chart).
              Built from the IN-RANGE activity timestamps, so it tracks the selected window. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity over time</CardTitle>
            </CardHeader>
            <CardContent>
              {monthly.length < 2 ? (
                <div className="flex h-[280px] items-center justify-center text-center text-sm text-muted-foreground">
                  Not enough activity in this timeframe to plot a trend. This
                  chart fills in once there is activity across two or more
                  months. Try a wider range.
                </div>
              ) : (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={monthly}
                      margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
                    >
                      <defs>
                        {/* Gradient fills under each area, themed off the brand vars. */}
                        <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C_PRIMARY} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={C_PRIMARY} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gRegs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C_GOLD} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={C_GOLD} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gMatches" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="month"
                        tickFormatter={fmtMonth}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                        width={36}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: "var(--foreground)" }}
                        labelFormatter={(l) => fmtMonth(String(l))}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area
                        type="monotone"
                        dataKey="views"
                        name="Page views"
                        stroke={C_PRIMARY}
                        strokeWidth={2.5}
                        fill="url(#gViews)"
                      />
                      <Area
                        type="monotone"
                        dataKey="registrations"
                        name="Registrations"
                        stroke={C_GOLD}
                        strokeWidth={2.5}
                        fill="url(#gRegs)"
                      />
                      <Area
                        type="monotone"
                        dataKey="matches"
                        name="Matches"
                        stroke="#60a5fa"
                        strokeWidth={2.5}
                        fill="url(#gMatches)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prize distribution by event (only when at least one event paid out). */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prize money by event</CardTitle>
            </CardHeader>
            <CardContent>
              {prizeRows.length === 0 ? (
                <div className="flex h-[220px] items-center justify-center text-center text-sm text-muted-foreground">
                  No prize payouts recorded yet. This chart fills in once event
                  payouts are entered.
                </div>
              ) : (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={prizeRows}
                      layout="vertical"
                      margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                        tickFormatter={(v) => fmtMoney(Number(v))}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: any) => [fmtMoney(Number(v)), "Prize"]}
                      />
                      <Bar dataKey="prize" fill={C_GOLD} radius={[0, 4, 4, 0]}>
                        <LabelList
                          dataKey="prize"
                          position="right"
                          formatter={(v: any) => fmtMoney(Number(v))}
                          style={{ fill: "var(--foreground)", fontSize: 10, fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════ TAB 2 — Breakdown: event-type / status / mode splits ════════ */}
        <TabsContent value="breakdown" className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Event type split (tournament vs scrims) as a donut. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Events by type</CardTitle>
            </CardHeader>
            <CardContent>
              {typeRows.length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={typeRows}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {typeRows.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Event status split (upcoming / ongoing / completed) as a donut. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Events by status</CardTitle>
            </CardHeader>
            <CardContent>
              {statusRows.length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusRows}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {statusRows.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Event mode split (online / LAN / hybrid) as a horizontal bar. */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Events by mode</CardTitle>
            </CardHeader>
            <CardContent>
              {modeRows.length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={modeRows}
                      margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                        width={36}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: any) => [fmtInt(Number(v)), "Events"]}
                      />
                      <Bar dataKey="value" name="Events" fill={C_PRIMARY} radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="value"
                          position="top"
                          style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════ TAB 3 — Leaderboards: top teams + top players (by kills) ════════ */}
        <TabsContent value="leaderboards" className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Top teams: bar chart + ranked table side rows. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top teams by kills</CardTitle>
            </CardHeader>
            <CardContent>
              {topTeams.length === 0 ? (
                <EmptyChart label="No team match stats recorded yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-10 w-10 p-2 text-foreground">#</TableHead>
                      <TableHead className="h-10 p-2 text-foreground">Team</TableHead>
                      <TableHead className="h-10 p-2 text-center text-foreground">Wins</TableHead>
                      <TableHead className="h-10 p-2 text-right text-foreground">Kills</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topTeams.map((t, i) => (
                      <TableRow key={t.team_id} className="text-xs">
                        <TableCell className="p-2 font-bold text-muted-foreground">
                          #{i + 1}
                        </TableCell>
                        <TableCell className="p-2 font-semibold">
                          {t.team_name}
                        </TableCell>
                        <TableCell className="p-2 text-center">
                          {t.wins > 0 ? (
                            <span className="inline-flex items-center gap-1 text-gold">
                              <IconTrophy className="size-3.5" />
                              {t.wins}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="p-2 text-right font-bold text-primary">
                          {fmtInt(t.kills)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Top players: ranked table by kills. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top players by kills</CardTitle>
            </CardHeader>
            <CardContent>
              {topPlayers.length === 0 ? (
                <EmptyChart label="No player match stats recorded yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-10 w-10 p-2 text-foreground">#</TableHead>
                      <TableHead className="h-10 p-2 text-foreground">Player</TableHead>
                      <TableHead className="h-10 p-2 text-right text-foreground">Kills</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topPlayers.map((p, i) => (
                      <TableRow key={p.user_id} className="text-xs">
                        <TableCell className="p-2 font-bold text-muted-foreground">
                          #{i + 1}
                        </TableCell>
                        <TableCell className="p-2 font-semibold">
                          {p.username}
                        </TableCell>
                        <TableCell className="p-2 text-right font-bold text-primary">
                          {fmtInt(p.kills)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════ TAB 4 — Events: per-event breakdown, each row expands into detail ════════ */}
        {/* The summary table mirrors the org headline at the per-event grain (in range). Click
            any row (or its chevron) to expand a DETAILED drill-down panel for that event:
            registration completeness, page views + unique viewers, matches, kills, prize, and
            rating. All values respect the selected timeframe (sourced from the events[] rows). */}
        <TabsContent value="events" className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Per event breakdown
            </span>
            <span className="text-sm text-muted-foreground">
              {fmtInt(eventRows.length)}{" "}
              {eventRows.length === 1 ? "event" : "events"}
              {metrics?.events_truncated ? " (most recent shown)" : ""}
            </span>
          </div>
          <Card className="overflow-hidden p-0">
            {eventRows.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No events with activity in this timeframe. Try a wider range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {/* chevron / expand affordance */}
                      <TableHead className="h-10 w-8 p-2" />
                      <TableHead className="h-10 p-2 text-foreground">Event</TableHead>
                      <TableHead className="h-10 p-2 text-foreground">Date</TableHead>
                      <TableHead className="h-10 p-2 text-foreground">Status</TableHead>
                      <TableHead className="h-10 p-2 text-center text-foreground">Participants</TableHead>
                      <TableHead className="h-10 p-2 text-center text-foreground">Views</TableHead>
                      <TableHead className="h-10 p-2 text-center text-foreground">Matches</TableHead>
                      <TableHead className="h-10 p-2 text-center text-foreground">Kills</TableHead>
                      <TableHead className="h-10 p-2 text-right text-foreground">Prize</TableHead>
                      <TableHead className="h-10 p-2 text-center text-foreground">Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventRows.map((e) => {
                      const open = expandedEvents.has(e.event_id);
                      return (
                        <Fragment key={e.event_id}>
                          {/* ── summary row (click anywhere to toggle the detail panel) ── */}
                          <TableRow
                            className="cursor-pointer text-xs hover:bg-muted/40"
                            onClick={() => toggleEvent(e.event_id)}
                          >
                            <TableCell className="p-2 text-muted-foreground">
                              {open ? (
                                <IconChevronDown className="size-4" />
                              ) : (
                                <IconChevronRight className="size-4" />
                              )}
                            </TableCell>
                            <TableCell className="p-2 font-semibold">
                              {e.event_name}
                            </TableCell>
                            <TableCell className="p-2 text-muted-foreground">
                              {fmtDate(e.start_date)}
                            </TableCell>
                            <TableCell className="p-2">
                              <StatusBadge status={e.event_status} />
                            </TableCell>
                            <TableCell className="p-2 text-center">
                              {/* participants vs capacity, so fill is legible at a glance. */}
                              {fmtInt(e.participants)}
                              {e.capacity > 0 && (
                                <span className="text-muted-foreground">
                                  {" "}/ {fmtInt(e.capacity)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="p-2 text-center font-semibold text-primary">
                              {fmtInt(e.views)}
                            </TableCell>
                            <TableCell className="p-2 text-center">
                              {fmtInt(e.matches)}
                            </TableCell>
                            <TableCell className="p-2 text-center">
                              {fmtInt(e.kills)}
                            </TableCell>
                            <TableCell className="p-2 text-right">
                              {e.prize_money > 0 ? (
                                <span className="font-semibold text-gold">
                                  {fmtMoney(e.prize_money)}
                                </span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="p-2 text-center">
                              {e.rating != null ? (
                                <span className="inline-flex items-center gap-1 text-gold">
                                  <IconStarFilled className="size-3" />
                                  {e.rating.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>

                          {/* ── detail drill-down panel (only when this row is expanded) ── */}
                          {open && (
                            <TableRow className="bg-muted/20">
                              <TableCell colSpan={10} className="p-0">
                                <EventDetailPanel e={e} />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
        </>
      )}
    </div>
  );
}

// ── EventDetailPanel ──────────────────────────────────────────────────────────
// The expanded per-event drill-down (Events tab). Lays out every metric the backend's
// enriched events[] row carries for ONE event, all scoped to the page's selected timeframe:
//   • Registrations: confirmed (complete) vs incomplete, plus capacity + fill.
//   • Audience: page views + unique viewers (from EventPageView, in range).
//   • Competition: matches + kills (from match stats, in range).
//   • Outcome: prize money awarded + rating (average over N ratings, in range).
// "Complete" = a confirmed entrant (team "active" or solo "registered"/"approved");
// "incomplete" = any other registration status (pending/rejected/withdrawn/left/disqualified).
function EventDetailPanel({ e }: { e: EventRow }) {
  // fill-rate for this event = confirmed-or-total participants over capacity (when known).
  const fill =
    e.capacity > 0 ? Math.round((e.participants / e.capacity) * 100) : null;
  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Registrations */}
      <DetailGroup title="Registrations">
        <DetailRow
          icon={<IconUserCheck className="size-3.5 text-primary" />}
          label="Confirmed"
          value={fmtInt(e.complete_registrations)}
        />
        <DetailRow
          icon={<IconUserX className="size-3.5 text-muted-foreground" />}
          label="Incomplete"
          value={fmtInt(e.incomplete_registrations)}
        />
        <DetailRow
          icon={<IconUsers className="size-3.5 text-muted-foreground" />}
          label="Total / capacity"
          value={
            e.capacity > 0
              ? `${fmtInt(e.participants)} / ${fmtInt(e.capacity)}${fill != null ? ` (${fill}%)` : ""}`
              : fmtInt(e.participants)
          }
        />
      </DetailGroup>

      {/* Audience (page views) */}
      <DetailGroup title="Audience">
        <DetailRow
          icon={<IconEye className="size-3.5 text-primary" />}
          label="Page views"
          value={fmtInt(e.views)}
        />
        <DetailRow
          icon={<IconUsers className="size-3.5 text-muted-foreground" />}
          label="Unique viewers"
          value={fmtInt(e.unique_viewers)}
        />
      </DetailGroup>

      {/* Competition (matches + kills) */}
      <DetailGroup title="Competition">
        <DetailRow
          icon={<IconSwords className="size-3.5 text-muted-foreground" />}
          label="Matches"
          value={fmtInt(e.matches)}
        />
        <DetailRow
          icon={<IconCrosshair className="size-3.5 text-muted-foreground" />}
          label="Kills"
          value={fmtInt(e.kills)}
        />
      </DetailGroup>

      {/* Outcome (prize + rating) */}
      <DetailGroup title="Outcome">
        <DetailRow
          icon={<IconCash className="size-3.5 text-gold" />}
          label="Prize money"
          value={e.prize_money > 0 ? fmtMoney(e.prize_money) : "-"}
        />
        <DetailRow
          icon={<IconStarFilled className="size-3.5 text-gold" />}
          label="Rating"
          value={
            e.rating != null
              ? `${e.rating.toFixed(1)} (${fmtInt(e.ratings_count)})`
              : "No ratings"
          }
        />
      </DetailGroup>
    </div>
  );
}

// A titled cluster of detail rows inside the expanded per-event panel.
function DetailGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

// One labelled metric line (icon + label on the left, value on the right) in a detail group.
function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

// ── Empty chart placeholder ─────────────────────────────────────────────────────
// A calm, fixed-height empty state used inside chart cards when a split/leaderboard has
// no rows yet (so the card keeps its shape instead of collapsing to nothing).
function EmptyChart({ label }: { label?: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center text-center text-sm text-muted-foreground">
      {label || "No data to chart yet."}
    </div>
  );
}
