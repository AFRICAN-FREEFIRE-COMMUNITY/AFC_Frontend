"use client";

/**
 * PlayerClient.tsx
 * ────────────────
 * PUBLIC player profile (route param = username / in-game-name).
 *
 * Mirrors the chrome of the user's own profile (app/(user)/profile) and the admin
 * player-detail card (app/(a)/a/players/[id]): a green PageHeader title + an identity
 * card (Avatar + full name + @handle + UID + role badges) followed by the AFC pill
 * tab set. "Edit Profile" / "Disconnect" only show when the logged-in viewer is
 * looking at THEIR OWN profile (user.in_game_name === route username); every other
 * viewer gets the public/generic read-only view.
 *
 * DATA: the public, no-auth endpoint POST /player/get-public-player-stats/
 *   request:  { player_ign }
 *   response: { player: { ...identity, ...stat scalars, per_event[], recent_matches[], tier_history[] } }
 * Stats are sourced from real tables. In this DB clone the stat tables are empty, so
 * scalars come back 0 and the lists come back []. We render those zeros/empty states
 * truthfully and NEVER fabricate numbers. With populated data the same UI fills in.
 *
 * Player-level prize EARNINGS are now part of this contract (feature "Prizepool auto-links
 * to event winners' history/stats", 2026-06-15). When an admin records a team prize, the
 * backend (afc_rankings.admin_prize.prize_create) splits it equally across the active roster
 * and writes one PlayerWinning row per player; get_public_player_stats reads them back as
 * total_earnings_ngn + tournament_winnings[] (gated behind the same stats_visible flag). The
 * "Tournament Winnings" card below renders the lifetime total + a per-event table from those
 * rows, or a subtle empty state when the player has none.
 */

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { FullLoader, Loader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { NothingFound } from "@/components/NothingFound";
import { DEFAULT_PROFILE_PICTURE } from "@/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatWord } from "@/lib/utils";
// Per-player flag: player.country is now the IP-derived location (afc_auth.views.set_ip_country,
// owner 2026-06-29), so the flag shown here matches where the player actually is.
import { CountryFlag } from "@/lib/countryFlag";
// LocalTime renders a stored UTC timestamp in the viewer's own timezone + language;
// the i18n/time helpers cover the chart axis label (a string, not JSX).
import { LocalTime } from "@/components/LocalTime";
import { getActiveLocale, getBrowserTimeZone } from "@/lib/i18n/time";
import {
  IconChevronRight,
  IconAward,
  IconMedal,
  IconShieldCheck,
  IconLock,
  IconFlag,
} from "@tabler/icons-react";
// Report dialog (owner 2026-06-20). Generic player/team reporter; here used for a
// player. Shown to logged-in viewers on someone else's profile; posts to /auth/report-player/.
import { ReportDialog } from "@/components/player/ReportDialog";
// Public fan/hater reactions (owner 2026-06-20): counts visible to all, tap to react.
import { FanHater } from "@/components/profile/FanHater";

// ──────────────────────────────────────────────────────────────────────────────
// Types: mirror the public endpoint response exactly (do not add fields the
// backend does not send; missing data degrades truthfully).
// ──────────────────────────────────────────────────────────────────────────────
interface PerEventRow {
  event_id: number;
  event_name: string;
  competition_type: string;
  event_date: string | null;
  tournament_tier: string;
  tournament_tier_label: string | null;
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
  competition_type: string;
  // Stage + group of this match (owner 2026-07-02): a multi-stage event has separate leaderboards, so
  // the per-match drilldown is sub-grouped by them. Optional for a legacy match with no group.
  stage_name?: string | null;
  group_name?: string | null;
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

interface TierHistoryRow {
  season_id: number;
  season_name: string;
  year: number;
  quarter: number;
  tier: number | null;
  tier_label: string | null;
  rank: number | null;
}

// One row of the player's tournament prize history. Written backend-side by
// afc_rankings.admin_prize.prize_create (_distribute_payout): a team prize is split equally
// across the active roster and a PlayerWinning row saved per player. Surfaced here via
// POST /player/get-public-player-stats/ (response.player.tournament_winnings).
interface TournamentWinningRow {
  event_id: number;
  event_name: string | null;
  amount: string; // NGN, this player's share (string keeps full Decimal precision)
  tournament_team_name: string | null; // null for solo prizes
  created_at: string | null;
}

// One event the player is CURRENTLY registered for (upcoming/ongoing). PUBLIC: the backend
// (afc_player.aggregation.compute_registered_events) returns these OUTSIDE the stats_visible
// privacy gate, so this list is populated for every viewer. event_slug deep-links to the
// public /tournaments/<slug> page; participant_type marks how the player entered (solo/squad).
interface RegisteredEventRow {
  event_id: number;
  event_slug: string | null;
  event_name: string;
  event_status: "upcoming" | "ongoing";
  event_date: string | null;
  participant_type: "solo" | "squad";
}

interface PublicPlayer {
  user_id: number;
  username: string;
  country: string;
  uid: string | null;
  discord_username: string | null;
  profile_picture: string | null;
  // Present ONLY when the viewer is an AFC admin (backend gate in get_public_player_stats):
  // the player's esport image (broadcast-media asset), owner 2026-07-02.
  esport_image?: string | null;
  esports_picture: string | null;
  in_game_role: string | null;
  management_role: string | null;
  join_date: string | null;
  team: {
    team_id: number;
    team_name: string;
    team_tag: string | null;
    team_logo: string | null;
  } | null;
  total_matches: number;
  total_kills: number;
  total_wins: number;
  total_mvps: number;
  kdr: number;
  avg_damage: number;
  win_rate: number;
  scrims_kills: number;
  tournaments_kills: number;
  scrims_wins: number;
  tournaments_wins: number;
  scrim_booyah: number;
  tournament_booyah: number;
  per_event: PerEventRow[];
  recent_matches: RecentMatchRow[];
  tier_history: TierHistoryRow[];
  // Events the player is CURRENTLY registered for (upcoming/ongoing), solo + squad. PUBLIC:
  // returned by get-public-player-stats for every viewer (NOT behind stats_visible). Optional
  // so an older backend that omits it degrades to "no upcoming registered events".
  registered_events?: RegisteredEventRow[];
  // Tournament prize winnings (lifetime total + per-event rows, newest first). Populated by
  // afc_rankings.admin_prize.prize_create and gated behind the same stats_visible flag below.
  // Optional so an older backend (pre-2026-06-15) that omits them degrades to "no winnings".
  total_earnings_ngn?: string;
  tournament_winnings?: TournamentWinningRow[];
  // PRIVACY (backend afc_player/views.py :: get_public_player_stats):
  // true only when the viewer is the player, an AFC admin, or a current teammate.
  // When false the backend ZEROES every sensitive number + empties the breakdown
  // lists, and we render a "stats are private" state instead of the stat windows.
  // Identity (name/team/country/roles) + tier_history stay populated either way.
  stats_visible: boolean;
}

// The time-range presets that drive the headline cards + the performance curve.
// "all" / custom (From/To) are handled separately. Mirrors the mockup's seg control.
const RANGE_PRESETS = [
  { id: "3m", label: "3 months", months: 3 },
  { id: "6m", label: "6 months", months: 6 },
  { id: "12m", label: "12 months", months: 12 },
  { id: "all", label: "All time", months: null as number | null },
] as const;
type RangeId = (typeof RANGE_PRESETS)[number]["id"] | "custom";

// The metric the performance curve plots. Each maps a per-event row to a y-value.
// Placement is "lower is better" so we note that on the axis label.
const METRICS = [
  { id: "kills", label: "Kills" },
  { id: "placement", label: "Placement" },
  { id: "points", label: "Points" },
  { id: "kd", label: "K-D" },
] as const;
type MetricId = (typeof METRICS)[number]["id"];

// Small helper: format a placement as "#3" (hash, per AFC design), or "-" when null.
const placeLabel = (p: number | null | undefined) =>
  p == null ? "-" : `#${p}`;

// Format an NGN amount (a decimal string from the backend) as "NGN 2,500,000". No em/en
// dashes per AFC copy rules; whole-naira display with thousands separators. Blank/invalid
// inputs fall back to "NGN 0" so the total never renders as NaN.
const fmtNgn = (raw: string | null | undefined): string => {
  const n = parseFloat(raw ?? "0");
  const safe = Number.isFinite(n) ? n : 0;
  return "NGN " + safe.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

export function PlayerClient({ username }: { username: string }) {
  // i18n: public player profile copy (messages/en/teamsplayers.json -> "player").
  const t = useTranslations("teamsplayers");
  // Report-dialog copy (separate namespace, messages/en/playerReports.json).
  const tReport = useTranslations("playerReports");
  // route username may be URL-encoded (spaces in IGNs); decode once for both the
  // request body and the own-profile comparison.
  const ign = useMemo(() => decodeURIComponent(username), [username]);

  const { user, token } = useAuth();

  const [player, setPlayer] = useState<PublicPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Discord disconnect is an own-profile-only action (mirrors ProfileContent).
  const [discordPending, setDiscordPending] = useState(false);
  const [discordConnected, setDiscordConnected] = useState(false);
  // Player-to-player report dialog open state (non-owner, logged-in viewers).
  const [reportOpen, setReportOpen] = useState(false);

  // ── filter + chart controls ──
  const [range, setRange] = useState<RangeId>("12m");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [metric, setMetric] = useState<MetricId>("kills");

  // which events-played rows are expanded (per-match drill-down)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // Is the logged-in viewer looking at their OWN profile? Drives the owner-only
  // Edit Profile / Disconnect actions. Case-insensitive guard on the IGN.
  const isOwnProfile =
    !!user?.in_game_name &&
    user.in_game_name.toLowerCase() === ign.toLowerCase();

  // ── Fetch the profile ───────────────────────────────────────────────────────
  // The endpoint is public, but it now reads an OPTIONAL Bearer token to identify
  // the viewer for the PRIVACY gate (backend get_public_player_stats). We send the
  // logged-in viewer's token when present so the backend can tell whether they are
  // the player / an admin / a teammate and therefore allowed to see the detailed
  // stats (response.stats_visible). Anonymous viewers send no token and get the
  // identity-only payload. We re-fetch when the token changes (e.g. login) so the
  // private window appears immediately once a teammate authenticates.
  useEffect(() => {
    if (!ign) return;
    let active = true;

    setLoading(true);
    setNotFound(false);

    axios
      .post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player/get-public-player-stats/`,
        { player_ign: ign },
        token
          ? { headers: { Authorization: `Bearer ${token}` } }
          : undefined,
      )
      .then((res) => {
        if (!active) return;
        setPlayer(res.data.player as PublicPlayer);
      })
      .catch((error: any) => {
        if (!active) return;
        // 404 → player genuinely doesn't exist; show the not-found state. Anything
        // else is a transient/server error → toast and show not-found shell.
        if (error?.response?.status === 404) {
          setNotFound(true);
        } else {
          toast.error(
            error?.response?.data?.message || t("player.loadFailed"),
          );
          setNotFound(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ign, token]);

  // ── Own-profile only: check Discord connection so we can show Disconnect ──
  useEffect(() => {
    if (!isOwnProfile || !token) return;
    axios
      .get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/is-discord-account-connected/`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .then((res) => setDiscordConnected(!!res.data.connected))
      .catch(() => {
        /* non-blocking; just leave the button hidden */
      });
  }, [isOwnProfile, token]);

  const handleDiscordDisconnect = async () => {
    if (!token) return;
    setDiscordPending(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/disconnect-discord-account/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setDiscordConnected(false);
      toast.success(t("player.discordDisconnected"));
    } catch {
      toast.error(t("player.discordDisconnectFailed"));
    } finally {
      setDiscordPending(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Derived data: all computed from the REAL per_event[] list. The date-range
  // filter slices per_event by event_date; the cards + curve recompute from the
  // filtered slice. With an empty per_event[] everything reads as zeros/empty.
  // ──────────────────────────────────────────────────────────────────────────

  // resolve the active [from, to] window (ms epoch) from the preset / custom inputs.
  const window = useMemo<{ from: number | null; to: number | null }>(() => {
    if (range === "custom") {
      return {
        from: customFrom ? new Date(customFrom).getTime() : null,
        to: customTo ? new Date(customTo + "T23:59:59").getTime() : null,
      };
    }
    const preset = RANGE_PRESETS.find((r) => r.id === range);
    if (!preset || preset.months == null) return { from: null, to: null }; // all time
    const to = Date.now();
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - preset.months);
    return { from: fromDate.getTime(), to };
  }, [range, customFrom, customTo]);

  // per_event rows that fall inside the active window (events with no date are kept
  // for "all time" only, so a missing date never silently vanishes from the totals).
  const filteredEvents = useMemo<PerEventRow[]>(() => {
    const rows = player?.per_event ?? [];
    if (window.from == null && window.to == null) return rows; // all time
    return rows.filter((e) => {
      if (!e.event_date) return false;
      const t = new Date(e.event_date).getTime();
      if (window.from != null && t < window.from) return false;
      if (window.to != null && t > window.to) return false;
      return true;
    });
  }, [player?.per_event, window]);

  // Headline career cards, computed from the filtered slice (real numbers only).
  const headline = useMemo(() => {
    const evs = filteredEvents;
    const tournaments = evs.length;
    const kills = evs.reduce((a, e) => a + e.kills, 0);
    const matches = evs.reduce((a, e) => a + e.matches_played, 0);
    const mvps = evs.reduce((a, e) => a + e.mvps, 0);
    const points = evs.reduce((a, e) => a + e.total_points, 0);
    // wins = events where the team's best placement was 1st
    const wins = evs.filter((e) => e.best_placement === 1).length;
    // avg placement across events that recorded one (lower is better)
    const placed = evs.filter((e) => e.best_placement != null);
    const avgPlacement = placed.length
      ? placed.reduce((a, e) => a + (e.best_placement as number), 0) /
        placed.length
      : null;
    const killsPerMatch = matches > 0 ? kills / matches : 0;
    const winRate = tournaments > 0 ? (wins / tournaments) * 100 : 0;
    return {
      tournaments,
      kills,
      matches,
      mvps,
      points,
      wins,
      avgPlacement,
      killsPerMatch,
      winRate,
    };
  }, [filteredEvents]);

  // Current tier comes from the most recent published tier_history row (if any).
  const currentTier = useMemo(() => {
    const rows = player?.tier_history ?? [];
    // tier_history is ordered oldest→newest by the backend; take the last with a tier.
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].tier != null) return rows[i];
    }
    return null;
  }, [player?.tier_history]);

  // Performance curve series: one point per event in the window, oldest→newest,
  // y = the selected metric. Recharts needs ascending-time data for a sensible line.
  const curveData = useMemo(() => {
    const rows = [...filteredEvents]
      .filter((e) => e.event_date) // a point needs a date to sit on the time axis
      .sort(
        (a, b) =>
          new Date(a.event_date as string).getTime() -
          new Date(b.event_date as string).getTime(),
      );
    return rows.map((e) => {
      const kd = e.matches_played > 0 ? e.kills / e.matches_played : 0;
      // Chart axis label is a string fed to recharts (not JSX), so it can't use
      // <LocalTime>; format in the viewer's locale + timezone instead of the old
      // hardcoded "en-US" / UTC. Server-safe ("en"/"UTC" during SSR).
      const label = new Intl.DateTimeFormat(getActiveLocale(), {
        month: "short",
        year: "2-digit",
        timeZone: getBrowserTimeZone(),
      }).format(new Date(e.event_date as string));
      return {
        label,
        event: e.event_name,
        kills: e.kills,
        placement: e.best_placement ?? null,
        points: e.total_points,
        kd: Number(kd.toFixed(2)),
      };
    });
  }, [filteredEvents]);

  const activeMetric = METRICS.find((m) => m.id === metric)!;

  // Localized label for a metric id (the METRICS array holds English data labels
  // used as switcher buttons + chart legends; map them to translation keys here).
  const metricLabel = (id: MetricId) =>
    id === "kills"
      ? t("player.metricKills")
      : id === "placement"
        ? t("player.metricPlacement")
        : id === "points"
          ? t("player.metricPoints")
          : t("player.metricKd");

  // Y-axis label per metric (placement is inverted-meaning, flag it for the reader).
  const yAxisLabel =
    metric === "placement"
      ? t("player.placementLowerBetter")
      : metric === "kd"
        ? t("player.kdRatio")
        : metricLabel(activeMetric.id);

  // Solo-vs-team split, straight from the real scalar fields (no math invented).
  const split = player
    ? {
        soloKills: player.scrims_kills, // scrims surface as the "solo / scrim" line
        teamKills: player.tournaments_kills,
        soloWins: player.scrims_wins,
        teamWins: player.tournaments_wins,
        soloBooyah: player.scrim_booyah,
        teamBooyah: player.tournament_booyah,
      }
    : null;

  const toggleRow = (id: number) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // ── render guards ──
  if (loading) return <FullLoader />;

  if (notFound || !player) {
    return (
      <div>
        <PageHeader back title={t("player.notFoundTitle")} />
        <Card>
          <CardContent className="py-10">
            <NothingFound text={t("player.notFoundBody")} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const avatarSrc =
    player.profile_picture || player.esports_picture || DEFAULT_PROFILE_PICTURE;
  const hasAnyStats =
    player.total_matches > 0 ||
    player.per_event.length > 0 ||
    player.recent_matches.length > 0;

  // PRIVACY: when the backend says the viewer may NOT see this player's detailed
  // stats (not the player, not an admin, not a teammate), every sensitive number
  // came back zeroed and the breakdown lists empty. We then REPLACE the stat
  // windows (career snapshot, statistics cards/curve/split, events, recent
  // matches) with a clear private-state message, while keeping the identity facts,
  // team, and tier history visible. `stats_visible` defaults to false defensively
  // if an older backend omitted the flag.
  const statsVisible = player.stats_visible === true;

  return (
    <div>
      {/* Green PageHeader title (AFC design constant) */}
      <PageHeader back title={player.username} />

      {/* Player report dialog (controlled). Mounted once; opened by the Report
          button in the identity card for logged-in, non-owner viewers. */}
      <ReportDialog
        subjectType="player"
        subjectName={player.username}
        subjectId={player.user_id}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />

      {/* ── IDENTITY CARD (mirrors own-profile + admin player card) ─────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* identity: avatar + name + @handle + UID + role/team/tier badges */}
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20 border-4 border-primary">
                <AvatarImage
                  src={avatarSrc}
                  alt={player.username}
                  className="object-cover"
                />
                <AvatarFallback className="text-2xl">
                  {player.username?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {/* Esport image (ADMIN viewers only - the backend simply omits it for everyone
                  else, so this renders for admins alone). Click opens full size. */}
              {player.esport_image ? (
                <a
                  href={player.esport_image}
                  target="_blank"
                  rel="noreferrer"
                  title={t("playerProfile.esportImage")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={player.esport_image}
                    alt=""
                    className="size-16 rounded-md border object-cover"
                  />
                </a>
              ) : null}
              <div>
                <CardTitle className="text-2xl md:text-3xl">
                  {player.username}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  @{player.username}
                  {player.uid ? (
                    <>
                      {" "}
                      <span className="mx-1">·</span> {t("player.uidPrefix", { uid: player.uid })}
                    </>
                  ) : null}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {player.in_game_role && (
                    <Badge variant="secondary" className="capitalize">
                      {formatWord(player.in_game_role)}
                    </Badge>
                  )}
                  {player.management_role &&
                    player.management_role !== "member" && (
                      <Badge variant="secondary" className="capitalize">
                        {formatWord(player.management_role)}
                      </Badge>
                    )}
                  {/* Team badge (outline, links to team page) */}
                  {player.team && (
                    <Badge
                      variant="outline"
                      className="border-primary/50 text-primary"
                      asChild
                    >
                      <Link href={`/teams/${player.team.team_name}`}>
                        {player.team.team_name}
                      </Link>
                    </Badge>
                  )}
                  {/* Current tier (gold outline) only when a published tier exists */}
                  {currentTier?.tier_label && (
                    <Badge
                      variant="outline"
                      className="border-gold/60 text-gold"
                    >
                      {currentTier.tier_label}
                    </Badge>
                  )}
                </div>
                {/* Public fan/hater reactions (owner 2026-06-20): counts shown to all;
                    tapping requires login. Hidden on the owner's own profile (you can't
                    react to yourself - backend also blocks it). */}
                {!isOwnProfile && (
                  <FanHater
                    subjectType="player"
                    targetId={player.user_id}
                    className="mt-3"
                  />
                )}
              </div>
            </div>

            {/* owner-only actions: Edit Profile + Disconnect (hidden for public viewers) */}
            {isOwnProfile && (
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <Button className="w-full sm:w-auto" asChild>
                  <Link href="/profile/edit">{t("player.editProfile")}</Link>
                </Button>
                {discordConnected && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="w-full sm:w-auto"
                        disabled={discordPending}
                      >
                        {discordPending ? (
                          <Loader text={t("player.disconnecting")} />
                        ) : (
                          t("player.disconnect")
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("player.disconnectConfirmTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("player.disconnectConfirmBody")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("player.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDiscordDisconnect}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          {t("player.disconnect")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}

            {/* Report action: shown to LOGGED-IN viewers looking at SOMEONE ELSE's
                profile (owner 2026-06-20). Hidden for the owner (they have the edit
                actions above) and for logged-out visitors (reporting needs a session).
                Opens ReportDialog (subjectType="player"), POST /auth/report-player/. */}
            {!isOwnProfile && !!token && (
              <div className="w-full md:w-auto">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto text-red-500 border-red-500/40 hover:bg-red-500/10 hover:text-red-500"
                  onClick={() => setReportOpen(true)}
                >
                  <IconFlag className="h-4 w-4 mr-1" />
                  {tReport("report.trigger")}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* ── AFC PILL TABS ──────────────────────────────────────────────── */}
          <Tabs defaultValue="overview">
            <ScrollArea>
              <TabsList className="w-full mb-4">
                <TabsTrigger value="overview">{t("player.tabOverview")}</TabsTrigger>
                {/* Individual player STATS tabs are hidden entirely unless the viewer may see this
                    player's stats (owner 2026-06-24: own profile or an AFC admin only - NOT teammates,
                    organizers, sponsors, or other players). statsVisible mirrors the backend
                    get-public-player-stats gate (_can_view_player_stats), so the tab list matches what
                    the server would actually return. Overview + Team stay (identity/roster, not stats). */}
                {statsVisible && (
                  <>
                    <TabsTrigger value="statistics">{t("player.tabStatistics")}</TabsTrigger>
                    <TabsTrigger value="events">{t("player.tabEvents")}</TabsTrigger>
                    <TabsTrigger value="performance">
                      {t("player.tabPerformance")}
                    </TabsTrigger>
                  </>
                )}
                <TabsTrigger value="team">{t("player.tabTeam")}</TabsTrigger>
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
            <TabsContent value="overview">
              {/* identity facts grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5">
                <div>
                  <p className="text-xs text-muted-foreground">{t("player.country")}</p>
                  <p className="text-sm mt-0.5 inline-flex items-center gap-1.5">
                    {player.country ? (
                      <>
                        <CountryFlag country={player.country} />
                        {player.country}
                      </>
                    ) : (
                      "-"
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("player.uid")}</p>
                  <p className="text-sm mt-0.5">{player.uid ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("player.inGameRole")}</p>
                  <p className="text-sm mt-0.5 capitalize">
                    {player.in_game_role
                      ? formatWord(player.in_game_role)
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("player.team")}</p>
                  <p className="text-sm mt-0.5">
                    {player.team ? (
                      <Link
                        href={`/teams/${player.team.team_name}`}
                        className="text-primary hover:underline"
                      >
                        {player.team.team_name}
                      </Link>
                    ) : (
                      t("player.freeAgent")
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("player.joinedTeam")}</p>
                  <p className="text-sm mt-0.5">
                    {/* Joined-team date in the viewer's timezone + language. */}
                    {player.join_date ? (
                      <LocalTime value={player.join_date} mode="date" />
                    ) : (
                      "-"
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("player.discord")}</p>
                  <p className="text-sm mt-0.5">
                    {player.discord_username ?? "-"}
                  </p>
                </div>
              </div>

              {/* career snapshot (all-time scalars straight from the endpoint) */}
              <div className="mt-6 mb-3 text-xs font-medium text-muted-foreground">
                {t("player.careerSnapshot")}
              </div>
              {statsVisible ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatBox
                      label={t("player.totalMatches")}
                      value={player.total_matches}
                    />
                    <StatBox
                      label={t("player.totalKills")}
                      value={player.total_kills}
                      accent="green"
                    />
                    <StatBox label={t("player.wins")} value={player.total_wins} />
                    <StatBox
                      label={t("player.mvpAwards")}
                      value={player.total_mvps}
                      accent="gold"
                    />
                    <StatBox label={t("player.kdr")} value={player.kdr.toFixed(2)} />
                    <StatBox
                      label={t("player.winRate")}
                      value={`${player.win_rate.toFixed(1)}%`}
                    />
                    <StatBox
                      label={t("player.avgDamage")}
                      value={Math.round(player.avg_damage)}
                    />
                    <StatBox
                      label={t("player.currentTier")}
                      value={currentTier?.tier_label ?? t("player.unranked")}
                    />
                  </div>

                  {!hasAnyStats && (
                    <p className="text-xs text-muted-foreground mt-4">
                      {t("player.noMatchesYet")}
                    </p>
                  )}
                </>
              ) : (
                // Private: the viewer is not the player, an admin, or a teammate.
                <PrivateStats />
              )}

              {/* ── Registered Events (PUBLIC) ──────────────────────────────────
                  The upcoming/ongoing events this player is CURRENTLY registered for
                  (solo + squad). Data: player.registered_events from
                  /player/get-public-player-stats/ (afc_player.aggregation
                  .compute_registered_events), returned for EVERY viewer — it sits
                  OUTSIDE the stats privacy gate, so it shows even when the detailed
                  stats are hidden. (The Statistics / Events / Performance tabs only
                  render for permitted viewers, so the always-visible Overview tab is
                  the right home for this public schedule.) Each row deep-links to
                  /tournaments/<event_slug> and renders its date in the viewer's
                  timezone via LocalTime. Empty -> a muted line. Mirrors the team
                  page's "Registered Events" card. */}
              <div className="mt-6 mb-3 text-xs font-medium text-muted-foreground">
                {t("player.registeredEventsTitle")}
              </div>
              {(player.registered_events?.length ?? 0) === 0 ? (
                <p className="text-sm italic text-muted-foreground">
                  {t("player.noRegisteredEvents")}
                </p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("player.event")}</TableHead>
                        <TableHead>{t("player.date")}</TableHead>
                        <TableHead>{t("player.eventStatus")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {player.registered_events!.map((ev) => (
                        <TableRow key={ev.event_id}>
                          <TableCell className="font-medium">
                            {/* Slug-based deep link to the public event page; plain text
                                when an event has no slug yet (never links to a 404). */}
                            {ev.event_slug ? (
                              <Link
                                href={`/tournaments/${ev.event_slug}`}
                                className="text-primary hover:underline"
                              >
                                {ev.event_name}
                              </Link>
                            ) : (
                              ev.event_name
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {ev.event_date ? (
                              <LocalTime value={ev.event_date} mode="date" />
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="rounded-full text-xs">
                              {ev.event_status === "ongoing"
                                ? t("player.eventStatusOngoing")
                                : t("player.eventStatusUpcoming")}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* ── STATISTICS TAB (range filter + cards + curve + tier history) ──
                PRIVACY: the performance numbers (cards, curve, solo/team split)
                are gated. When the viewer may not see them we show the private
                message but STILL render the Ranking & tier history card below,
                since tier/rank are public ranking data, not private stats. */}
            <TabsContent value="statistics">
              {!statsVisible ? (
                <div className="space-y-6">
                  <PrivateStats />

                  {/* Tier history stays visible even when stats are private. */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {t("player.rankingTierHistory")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {player.tier_history.length === 0 ? (
                        <NothingFound text={t("player.noTierHistory")} />
                      ) : (
                        <div className="space-y-3">
                          {[...player.tier_history].reverse().map((h) => (
                            <div
                              key={h.season_id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <div>
                                <p className="font-medium">{h.season_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {t("player.quarterYear", { quarter: h.quarter, year: h.year })}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {h.tier_label && (
                                  <Badge
                                    variant="outline"
                                    className="border-gold/60 text-gold"
                                  >
                                    {h.tier_label}
                                  </Badge>
                                )}
                                {h.rank != null && (
                                  <span className="font-semibold text-primary">
                                    #{h.rank}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <>
              {/* date-range filter (presets + custom From/To) */}
              <RangeFilter
                range={range}
                setRange={setRange}
                customFrom={customFrom}
                setCustomFrom={setCustomFrom}
                customTo={customTo}
                setCustomTo={setCustomTo}
              />

              {/* headline career cards (recompute from the filtered slice) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatBox
                  label={t("player.tournaments")}
                  value={headline.tournaments}
                  sub={t("player.inRange")}
                />
                <StatBox
                  label={t("player.kills")}
                  value={headline.kills}
                  sub={t("player.inRange")}
                  accent="green"
                />
                <StatBox
                  label={t("player.killsPerMatch")}
                  value={headline.killsPerMatch.toFixed(1)}
                />
                <StatBox
                  label={t("player.mvpAwards")}
                  value={headline.mvps}
                  accent="gold"
                />
                <StatBox
                  label={t("player.avgPlacement")}
                  value={
                    headline.avgPlacement != null
                      ? `#${headline.avgPlacement.toFixed(1)}`
                      : "-"
                  }
                  sub={t("player.lowerIsBetter")}
                />
                <StatBox
                  label={t("player.wins")}
                  value={headline.wins}
                  sub={t("player.firstPlaceFinishes")}
                />
                <StatBox
                  label={t("player.winRate")}
                  value={`${headline.winRate.toFixed(0)}%`}
                  sub={t("player.firstPlaceShare")}
                />
                <StatBox
                  label={t("player.totalPoints")}
                  value={headline.points}
                  sub={t("player.inRange")}
                />
              </div>

              {/* performance curve + ranking/tier history side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
                {/* curve (2/3 width on desktop) */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <CardTitle className="text-base">
                        {t("player.performanceCurve")}
                      </CardTitle>
                      {/* metric switcher (pill segment) */}
                      <div className="inline-flex gap-1 bg-muted rounded-lg p-[3px] w-fit">
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
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="var(--border)"
                          />
                          <XAxis
                            dataKey="label"
                            stroke="var(--muted-foreground)"
                            fontSize={11}
                            tickMargin={8}
                            label={{
                              value: t("player.eventDate"),
                              position: "insideBottom",
                              offset: -14,
                              fill: "var(--muted-foreground)",
                              fontSize: 11,
                            }}
                          />
                          <YAxis
                            stroke="var(--muted-foreground)"
                            fontSize={11}
                            // placement reads "lower is better": invert the axis so
                            // an improving (smaller) placement still trends upward.
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
                        <NothingFound text={t("player.notEnoughCurve")} />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* ranking & tier history (1/3 width) */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {t("player.rankingTierHistory")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {player.tier_history.length === 0 ? (
                      <NothingFound text={t("player.noTierHistory")} />
                    ) : (
                      <div className="space-y-3">
                        {[...player.tier_history]
                          .reverse()
                          .map((h) => (
                            <div
                              key={h.season_id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <div>
                                <p className="font-medium">{h.season_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {t("player.quarterYear", { quarter: h.quarter, year: h.year })}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {h.tier_label && (
                                  <Badge
                                    variant="outline"
                                    className="border-gold/60 text-gold"
                                  >
                                    {h.tier_label}
                                  </Badge>
                                )}
                                {h.rank != null && (
                                  <span className="font-semibold text-primary">
                                    #{h.rank}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* solo-vs-team split + earnings (earnings degraded truthfully) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                {/* solo (scrims) vs team (tournaments) split */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {t("player.soloVsTeamSplit")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {split && (
                      <div className="grid grid-cols-3 gap-y-3 text-sm items-center">
                        <span className="text-muted-foreground text-xs" />
                        <span className="text-center text-xs font-medium text-muted-foreground">
                          {t("player.scrimsLabel")}
                        </span>
                        <span className="text-center text-xs font-medium text-muted-foreground">
                          {t("player.tournamentsLabel")}
                        </span>

                        <span className="text-muted-foreground">{t("player.kills")}</span>
                        <span className="text-center font-semibold">
                          {split.soloKills}
                        </span>
                        <span className="text-center font-semibold">
                          {split.teamKills}
                        </span>

                        <span className="text-muted-foreground">{t("player.wins")}</span>
                        <span className="text-center font-semibold">
                          {split.soloWins}
                        </span>
                        <span className="text-center font-semibold">
                          {split.teamWins}
                        </span>

                        <span className="text-muted-foreground">{t("player.booyahs")}</span>
                        <span className="text-center font-semibold">
                          {split.soloBooyah}
                        </span>
                        <span className="text-center font-semibold">
                          {split.teamBooyah}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Tournament Winnings: the player's REAL per-event prize shares, written by
                    afc_rankings.admin_prize.prize_create (a team prize split equally across the
                    active roster) and read back via /player/get-public-player-stats/
                    (tournament_winnings). Shows a lifetime total + a compact per-event table, or a
                    subtle empty state when the player has no recorded winnings. */}
                <TournamentWinningsCard
                  total={player.total_earnings_ngn}
                  winnings={player.tournament_winnings}
                />
              </div>
                </>
              )}
            </TabsContent>

            {/* ── EVENTS PLAYED TAB (per-event list + per-match drilldown) ─────
                PRIVACY: the per-event list is sensitive, so it is gated. When the
                viewer may not see the stats the list comes back empty AND we show
                the private message. */}
            <TabsContent value="events">
              {!statsVisible ? (
                <PrivateStats />
              ) : (
                <>
              <div className="mb-3 text-xs font-medium text-muted-foreground">
                {t("player.eventsCount", { count: player.per_event.length })}
              </div>
              {player.per_event.length === 0 ? (
                <NothingFound text={t("player.noEventsPlayed")} />
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>{t("player.event")}</TableHead>
                        <TableHead>{t("player.type")}</TableHead>
                        <TableHead>{t("player.date")}</TableHead>
                        <TableHead className="text-center">{t("player.bestPlace")}</TableHead>
                        <TableHead className="text-center">{t("player.myKills")}</TableHead>
                        <TableHead className="text-center">{t("player.myPoints")}</TableHead>
                        <TableHead className="text-center">{t("player.mvps")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {player.per_event.map((ev) => {
                        const isOpen = !!expanded[ev.event_id];
                        // the player's individual match lines for this event
                        const matches = player.recent_matches.filter(
                          (m) => m.event_id === ev.event_id,
                        );
                        return (
                          <PerEventRowGroup
                            key={ev.event_id}
                            ev={ev}
                            isOpen={isOpen}
                            matches={matches}
                            onToggle={() => toggleRow(ev.event_id)}
                          />
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
                </>
              )}
            </TabsContent>

            {/* ── PERFORMANCE HISTORY TAB (full-width curve + recent matches) ──
                PRIVACY: the curve + recent matches are sensitive, so the whole tab
                body is gated. */}
            <TabsContent value="performance">
              {!statsVisible ? (
                <PrivateStats />
              ) : (
                <>
              <RangeFilter
                range={range}
                setRange={setRange}
                customFrom={customFrom}
                setCustomFrom={setCustomFrom}
                customTo={customTo}
                setCustomTo={setCustomTo}
              />
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <CardTitle className="text-base">
                      {t("player.performanceOverTime")}
                    </CardTitle>
                    <div className="inline-flex gap-1 bg-muted rounded-lg p-[3px] w-fit">
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
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart
                        data={curveData}
                        margin={{ top: 8, right: 16, bottom: 24, left: 8 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                        />
                        <XAxis
                          dataKey="label"
                          stroke="var(--muted-foreground)"
                          fontSize={11}
                          tickMargin={8}
                          label={{
                            value: "Event date",
                            position: "insideBottom",
                            offset: -14,
                            fill: "var(--muted-foreground)",
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          stroke="var(--muted-foreground)"
                          fontSize={11}
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
                            activeMetric.label,
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
                      <NothingFound text="Not enough events in this range to plot a curve." />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* recent matches list (the player's last 25 individual lines) */}
              <div className="mt-6 mb-3 text-xs font-medium text-muted-foreground">
                {t("player.recentMatches")}
              </div>
              {player.recent_matches.length === 0 ? (
                <NothingFound text={t("player.noRecentMatches")} />
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("player.event")}</TableHead>
                        <TableHead>{t("player.map")}</TableHead>
                        <TableHead>{t("player.date")}</TableHead>
                        <TableHead className="text-center">{t("player.placement")}</TableHead>
                        <TableHead className="text-center">{t("player.kills")}</TableHead>
                        <TableHead className="text-center">{t("player.damage")}</TableHead>
                        <TableHead className="text-center">{t("player.points")}</TableHead>
                        <TableHead className="text-center">{t("player.mvp")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {player.recent_matches.map((m, i) => (
                        <TableRow key={`${m.event_id}-${m.match_number}-${i}`}>
                          <TableCell className="font-medium">
                            {m.event_name}
                          </TableCell>
                          <TableCell>{m.match_map ?? "-"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {/* Match date in the viewer's timezone + language. */}
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
                          <TableCell className="text-center">
                            {m.kills}
                          </TableCell>
                          <TableCell className="text-center">
                            {m.damage}
                          </TableCell>
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
                </>
              )}
            </TabsContent>

            {/* ── TEAM HISTORY TAB ──────────────────────────────────────────── */}
            <TabsContent value="team">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("player.team")}</TableHead>
                    <TableHead>{t("player.role")}</TableHead>
                    <TableHead>{t("player.from")}</TableHead>
                    <TableHead>{t("player.to")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {player.team ? (
                    <TableRow>
                      <TableCell className="font-medium">
                        <Link
                          href={`/teams/${player.team.team_name}`}
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <IconShieldCheck className="h-4 w-4" />
                          {player.team.team_name}
                        </Link>
                      </TableCell>
                      <TableCell className="capitalize">
                        {player.in_game_role
                          ? formatWord(player.in_game_role)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {/* Join date in the viewer's timezone + language. */}
                        {player.join_date ? (
                          <LocalTime value={player.join_date} mode="date" />
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{t("player.present")}</TableCell>
                    </TableRow>
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-8"
                      >
                        {t("player.notOnTeam")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-3">
                {t("player.teamHistoryNote")}
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// PrivateStats: the locked-state panel shown when the viewer is NOT allowed to see
// this player's detailed stats (not the player, not an admin, not a teammate). The
// backend (get_public_player_stats) zeroes/empties every sensitive value and sets
// stats_visible=false; we render this in place of the stat windows. Identity, team,
// and tier history remain visible elsewhere on the page. AFC card idiom + lock icon.
// ──────────────────────────────────────────────────────────────────────────────
function PrivateStats() {
  const t = useTranslations("teamsplayers");
  return (
    <div className="bg-card rounded-md border py-10 px-6 shadow-sm flex flex-col items-center justify-center text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <IconLock className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground">
        {t("player.privateTitle")}
      </p>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
        {t("player.privateBody")}
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TournamentWinningsCard: the player's REAL tournament prize earnings. Data comes from
// backend afc_player.views.get_public_player_stats (total_earnings_ngn + tournament_winnings),
// which reads PlayerWinning rows written by afc_rankings.admin_prize.prize_create (a team prize
// split equally across the active roster, one row per player). Renders a lifetime total headline
// plus a compact text-xs per-event table (event, team, amount, date), matching the AFC stat-card
// density + green primary aesthetic. Shows a subtle empty state when there are no winnings.
// ──────────────────────────────────────────────────────────────────────────────
function TournamentWinningsCard({
  total,
  winnings,
}: {
  total: string | undefined;
  winnings: TournamentWinningRow[] | undefined;
}) {
  const t = useTranslations("teamsplayers");
  const rows = winnings ?? [];
  const hasWinnings = rows.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("player.tournamentWinnings")}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasWinnings ? (
          // Truthful empty state (no fabricated figures).
          <div className="flex flex-col items-center justify-center text-center py-6 text-muted-foreground">
            <IconAward className="h-8 w-8 opacity-40 mb-2" />
            <p className="text-sm font-medium">{t("player.noWinningsTitle")}</p>
            <p className="text-xs mt-1">
              {t("player.noWinningsBody")}
            </p>
          </div>
        ) : (
          <>
            {/* lifetime total headline (green primary, per AFC design) */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground">{t("player.lifetimePrize")}</p>
              <p className="text-2xl font-bold mt-1 text-primary">
                {fmtNgn(total)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("player.inTournamentPrizes")}
              </p>
            </div>

            {/* compact per-event winnings table (text-xs density) */}
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("player.event")}</TableHead>
                    <TableHead>{t("player.team")}</TableHead>
                    <TableHead className="text-right">{t("player.amount")}</TableHead>
                    <TableHead>{t("player.date")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((w, i) => (
                    <TableRow key={`${w.event_id}-${i}`}>
                      <TableCell className="font-medium">
                        {w.event_name ?? "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {/* null team => solo prize */}
                        {w.tournament_team_name ?? t("player.solo")}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {fmtNgn(w.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {/* Winning date in the viewer's timezone + language. */}
                        {w.created_at ? (
                          <LocalTime value={w.created_at} mode="date" />
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// StatBox: a single headline/career card. Matches the mockup's .stat block and
// the AFC card idiom (bg-card, rounded-md, border). Accent tints the value green
// (primary) or gold to match the design constants.
// ──────────────────────────────────────────────────────────────────────────────
function StatBox({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "green" | "gold";
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
      <p className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// RangeFilter: the time-range control (presets + custom From/To). Drives the
// headline cards and the performance curve. Pill-segment style per AFC tabs.
// ──────────────────────────────────────────────────────────────────────────────
function RangeFilter({
  range,
  setRange,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
}: {
  range: RangeId;
  setRange: (r: RangeId) => void;
  customFrom: string;
  setCustomFrom: (v: string) => void;
  customTo: string;
  setCustomTo: (v: string) => void;
}) {
  // Local namespace handle for the range filter chrome (teamsplayers -> "player").
  const t = useTranslations("teamsplayers");
  // Localized preset label (RANGE_PRESETS holds English data labels).
  const presetLabel = (id: (typeof RANGE_PRESETS)[number]["id"]) =>
    id === "3m"
      ? t("player.range3m")
      : id === "6m"
        ? t("player.range6m")
        : id === "12m"
          ? t("player.range12m")
          : t("player.rangeAll");
  return (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      {/* preset segment */}
      <div className="inline-flex gap-1 bg-muted rounded-lg p-[3px]">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setRange(p.id)}
            className={`h-8 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              range === p.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {presetLabel(p.id)}
          </button>
        ))}
      </div>

      {/* custom From / To */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{t("player.rangeFrom")}</span>
        <Input
          type="date"
          value={customFrom}
          onChange={(e) => {
            setCustomFrom(e.target.value);
            setRange("custom");
          }}
          className="h-8 w-auto text-xs"
        />
        <span>{t("player.rangeTo")}</span>
        <Input
          type="date"
          value={customTo}
          onChange={(e) => {
            setCustomTo(e.target.value);
            setRange("custom");
          }}
          className="h-8 w-auto text-xs"
        />
      </div>

      {range === "custom" && (customFrom || customTo) && (
        <span className="text-xs text-primary font-medium">
          {t("player.showingCustomRange")}
        </span>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Group an event's per-match rows by (stage, group) so a multi-stage event shows each leaderboard on
// its own, preserving first-seen order (owner 2026-07-02). Rows with no stage/group collapse into one
// unlabelled section.
function groupPlayerMatchesByStageGroup(matches: RecentMatchRow[]) {
  const order: string[] = [];
  const byKey = new Map<
    string,
    { stage: string | null; group: string | null; rows: RecentMatchRow[] }
  >();
  for (const m of matches) {
    const key = `${m.stage_name ?? ""}||${m.group_name ?? ""}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        stage: m.stage_name ?? null,
        group: m.group_name ?? null,
        rows: [],
      });
      order.push(key);
    }
    byKey.get(key)!.rows.push(m);
  }
  return order.map((k) => byKey.get(k)!);
}

// PerEventRowGroup: one Events-Played row plus its expandable per-match detail.
// The drilldown shows the player's OWN line per match (placement / kills / damage
// / points / MVP), straight from recent_matches filtered to this event.
// ──────────────────────────────────────────────────────────────────────────────
function PerEventRowGroup({
  ev,
  isOpen,
  matches,
  onToggle,
}: {
  ev: PerEventRow;
  isOpen: boolean;
  matches: RecentMatchRow[];
  onToggle: () => void;
}) {
  const t = useTranslations("teamsplayers");
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-primary/5"
        onClick={onToggle}
      >
        <TableCell>
          <IconChevronRight
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              isOpen ? "rotate-90 text-primary" : ""
            }`}
          />
        </TableCell>
        <TableCell className="font-medium">{ev.event_name}</TableCell>
        <TableCell className="capitalize">
          {formatWord(ev.competition_type)}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {/* Event date in the viewer's timezone + language. */}
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
        <TableCell className="text-center">{ev.total_points}</TableCell>
        <TableCell className="text-center">{ev.mvps}</TableCell>
      </TableRow>

      {isOpen && (
        <TableRow className="bg-background hover:bg-background">
          <TableCell colSpan={8} className="p-0">
            <div className="px-4 py-4 pl-10">
              {/* event summary boxes */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <MiniBox label={t("player.myKills")} value={ev.kills} />
                <MiniBox label={t("player.myPoints")} value={ev.total_points} />
                <MiniBox
                  label={t("player.bestPlacement")}
                  value={placeLabel(ev.best_placement)}
                />
                <MiniBox label={t("player.matches")} value={ev.matches_played} />
              </div>

              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                {t("player.myPerMatchStats")}
              </p>
              {matches.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">
                  {t("player.noPerMatchBreakdown")}
                </p>
              ) : (
                // Break the event's matches down by stage/group (owner 2026-07-02): a multi-stage
                // event keeps each leaderboard separate; the event totals are in the boxes above.
                <div className="space-y-3">
                  {groupPlayerMatchesByStageGroup(matches).map((grp, gi) => {
                    const gKills = grp.rows.reduce((s, m) => s + (m.kills || 0), 0);
                    const label = [grp.stage, grp.group].filter(Boolean).join(" · ");
                    return (
                      <div key={`${label}-${gi}`}>
                        {label ? (
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-primary">
                              {label}
                            </span>
                            <span className="text-[0.68rem] text-muted-foreground">
                              {t("player.kills")}: {gKills}
                            </span>
                          </div>
                        ) : null}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("player.match")}</TableHead>
                              <TableHead>{t("player.map")}</TableHead>
                              <TableHead className="text-center">{t("player.placement")}</TableHead>
                              <TableHead className="text-center">{t("player.kills")}</TableHead>
                              <TableHead className="text-center">{t("player.damage")}</TableHead>
                              <TableHead className="text-center">{t("player.assists")}</TableHead>
                              <TableHead className="text-center">{t("player.mvp")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {grp.rows.map((m, i) => (
                              <TableRow key={`${label}-${m.match_number}-${i}`}>
                                <TableCell>
                                  {m.match_number != null
                                    ? t("player.matchNumber", { number: m.match_number })
                                    : "-"}
                                </TableCell>
                                <TableCell>{m.match_map ?? "-"}</TableCell>
                                <TableCell
                                  className={`text-center font-semibold ${
                                    m.placement === 1 ? "text-gold" : ""
                                  }`}
                                >
                                  {placeLabel(m.placement)}
                                </TableCell>
                                <TableCell className="text-center">{m.kills}</TableCell>
                                <TableCell className="text-center">{m.damage}</TableCell>
                                <TableCell className="text-center">{m.assists}</TableCell>
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
                    );
                  })}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// MiniBox: small summary stat inside the event drilldown.
function MiniBox({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-card rounded-md border px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-bold mt-0.5">{value}</p>
    </div>
  );
}
