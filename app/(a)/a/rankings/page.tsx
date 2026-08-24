"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FullLoader } from "@/components/Loader";
import { TierBadge, tierMeta } from "@/components/rankings/TierBadge";
import { rankingsApi, TeamRow as ApiTeamRow, Season } from "@/lib/rankings";
// Calendar dates (no time component) must go through this, not the date-and-time formatter:
// a bare "2026-07-14" parsed as a Date is midnight UTC and renders as the 13th west of London.
import { formatLocalDateOnly, formatLocalTime } from "@/lib/i18n/time";
import { LocalTime } from "@/components/LocalTime";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";

// The public quarterly read carries the §7.4 activity-floor flag on the row; the base
// ApiTeamRow type doesn't declare it, so widen locally to read it (same idiom as overrides/).
type TeamRow = ApiTeamRow & { meets_participation_floor?: boolean };

// The season payload now also carries the Phase-2c publish flags + transfer-window state as
// runtime fields; the base Season type doesn't declare them, so widen locally to read them.
type AdminSeason = Season & {
  rankings_published?: boolean;
  tiers_published?: boolean;
  transfer_window_is_open?: boolean;
  transfer_window_close?: string | null;
};
import {
  IconCalendarStats, IconArrowsExchange, IconRefresh, IconGavel, IconSearch,
  IconClipboardCheck, IconGhost2, IconHistory, IconSettings, IconPlayerPlay, IconHash,
  IconAlertTriangle, IconUsers, IconUser, IconEye, IconWorld, IconLock, IconBroadcast,
  IconCheck, IconX, IconClock,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { matchesSearch } from "@/lib/search";
import { InfoTip } from "@/components/ui/info-tip";
import type { HelpId } from "@/lib/help-content";

const TIERS = [0, 1, 2, 3] as const;
const MIN_REASON = 10;

// Best-effort recalc/eval status shape returned by GET /rankings/admin/recalc-status/.
interface RecalcStatus {
  recalculating: boolean;
  last_evaluation: { run: boolean; at: string | null; by: string | null };
  frozen_at: string | null;
  note?: string;
}

// Summary dict returned by POST /rankings/seasons/<id>/run-evaluation/ (dry run or real run).
interface EvalSummary {
  ok: boolean;
  dry_run: boolean;
  force: boolean;
  season_id: number;
  teams_evaluated: number;
  players_evaluated: number;
  tier_distribution: Record<number, number>;
}

// last_evaluation.at is a UTC DateTimeField, and this value is interpolated into the
// "{when} · {by}" StatCard subtitle rather than rendered on its own, so it needs the
// STRING helper. It used to call toLocaleString(undefined, ...), which follows the
// BROWSER's language rather than the AFC UI language, so a French admin got English
// month names; formatLocalTime reads the active locale instead.
const fmtWhen = (iso: string | null | undefined, locale: string) =>
  iso ? formatLocalTime(iso, "datetime", locale) : null;

function StatCard({ icon, title, value, sub, tone }: any) {
  return (
    <Card className="gap-1 transition-shadow hover:shadow-lg">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className={cn("text-muted-foreground", tone)}>{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminRankingsPage() {
  const t = useTranslations("rankings.admin.overview");
  const locale = useLocale();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState<number | undefined>(undefined);
  const [season, setSeason] = useState<AdminSeason | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // live recalc/eval status (drives the Recalculation + Last Evaluation StatCards)
  const [recalc, setRecalc] = useState<RecalcStatus | null>(null);

  // dialog state for the wired action buttons
  const [evalOpen, setEvalOpen] = useState(false);
  const [recalcOpen, setRecalcOpen] = useState(false);
  // publish dialog: which surface is being toggled, and to what target state.
  const [publishTarget, setPublishTarget] = useState<{ kind: "rankings" | "tiers"; next: boolean } | null>(null);

  useEffect(() => {
    rankingsApi.seasons().then((r) => {
      setSeasons(r.results);
      const active = r.results.find((s) => s.is_active) ?? r.results[0];
      setSeasonId(active?.season_id);
      // When there are NO seasons (or none active) seasonId stays undefined, the
      // per-season effect below early-returns, and `loading` is never cleared, leaving
      // the page stuck on "Loading rankings admin" forever. Clear it here so the season
      // picker / empty state renders. Same on a seasons-fetch failure.
      if (!active) setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  // re-fetch the quarterly team scores for the active season (used after a real evaluation or
  // a publish toggle). The ADMIN draft read is ungated, so the computed data shows here even
  // before it's published to the public; it also carries the fresh publish flags on .season.
  const loadTeams = async (sid: number) => {
    const r = await rankingsAdminApi.adminTeamsQuarterly(sid);
    setTeams(r.results);
    setSeason(r.season ?? seasons.find((s) => s.season_id === sid) ?? null);
  };

  // read the best-effort recalc/eval status for the active season.
  const loadRecalcStatus = async (sid: number) => {
    try {
      const s = await rankingsAdminApi.recalcStatus(sid);
      setRecalc(s as RecalcStatus);
    } catch (err: any) {
      // status read is best-effort; a failure shouldn't blank the whole page.
      setRecalc(null);
    }
  };

  useEffect(() => {
    if (!seasonId) return;
    let active = true; setLoading(true);
    Promise.all([
      rankingsAdminApi.adminTeamsQuarterly(seasonId).then((r) => {
        if (!active) return;
        setTeams(r.results);
        setSeason(r.season ?? seasons.find((s) => s.season_id === seasonId) ?? null);
      }),
      loadRecalcStatus(seasonId),
    ]).catch((err: any) => {
      if (!active) return;
      toast.error(err?.response?.data?.message || t("loadFailed"));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId]);

  const dist = useMemo(() => {
    const d: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    teams.forEach((t) => { if (t.tier != null) d[t.tier]++; });
    return d;
  }, [teams]);
  const total = teams.length || 1;

  // Use the shared matchesSearch helper so the teams box is punctuation/font-insensitive (a team
  // literally named "V-E" is found by typing "ve", stylized in-game names fold too).
  const filtered = teams.filter((t) => matchesSearch(t.team_name, q));
  // The season payload carries the window state and both its dates, so read them instead of
  // asserting. This card used to say "Locked" unconditionally and print the SEASON's end date
  // (Oct 1) under "Transfer Window" when the window itself had closed on Jul 14, which is the
  // one number an admin comes to this card for. The public banner on /rankings has always had
  // this right; the two now agree because they read the same fields.
  const transferOpen = !!season?.transfer_window_is_open;
  // The headline word has FOUR states, not two. "Locked" is only honest once we have a
  // season AND the payload actually carried the flag: before the season loads we are still
  // checking, and if the field is absent we genuinely do not know, so neither case should
  // assert "Locked". transfer_window_open / _close are DateFields (bare calendar dates), so
  // they keep going through formatLocalDateOnly, never the datetime formatter.
  const transferState: "checking" | "unknown" | "open" | "locked" = !season
    ? "checking"
    : season.transfer_window_is_open === undefined
      ? "unknown"
      : season.transfer_window_is_open
        ? "open"
        : "locked";
  const transferWindowValue = t(
    transferState === "checking"
      ? "stats.transferChecking"
      : transferState === "unknown"
        ? "stats.transferUnknown"
        : transferState === "open"
          ? "stats.transferOpen"
          : "stats.transferLocked",
  );
  const transferWindowSub = !season
    ? ""
    : transferOpen
      ? season.transfer_window_close
        ? t("stats.transferClosesOn", { date: formatLocalDateOnly(season.transfer_window_close) })
        : t("stats.transferOpen")
      : season.transfer_window_open
        ? // A window that has not started yet is not "Opened", it is "Opens". Saying a future
          // date in the past tense made this card read "Locked, Opened Sep 1, closed Sep 14" on
          // a season whose window had not begun, while the public banner correctly said it opens
          // on Sep 1. Compared as calendar dates so a window opening today counts as open-ish
          // rather than flipping on a UTC boundary.
          new Date(`${season.transfer_window_open}T00:00:00`) > new Date()
          ? t("stats.transferOpensOn", {
              open: formatLocalDateOnly(season.transfer_window_open),
              close: formatLocalDateOnly(season.transfer_window_close),
            })
          : t("stats.transferOpenedClosed", {
              open: formatLocalDateOnly(season.transfer_window_open),
              close: formatLocalDateOnly(season.transfer_window_close),
            })
        : t("stats.transferNoWindow");
  const belowFloor = teams.filter((t) => !t.meets_participation_floor).length;

  // status-card derivations from the live recalc/eval status
  const recalculating = recalc?.recalculating ?? false;
  const lastEval = recalc?.last_evaluation;
  const lastEvalAt = fmtWhen(lastEval?.at, locale);

  // publish state for the two INDEPENDENT public surfaces (read off the loaded season).
  const rankingsPublished = !!season?.rankings_published;
  const tiersPublished = !!season?.tiers_published;

  if (loading && !teams.length) return <FullLoader text={t("loading")} />;

  return (
    <div className="space-y-4">
      <PageHeader
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        // data-tour anchor: rankings tour "the Rankings workspace" step (admin-tour-steps.ts
        // → ADMIN_TOUR_STEPS.rankings). It introduces the sub-nav row of detail pages above.
        title={
          <span data-tour="rankings-header" className="inline-flex flex-wrap items-center">
            {t("title")}
            <InfoTip id="rankings._page" className="ml-1.5" />
          </span>
        }
        description={t("description")}
        action={
          // ⓘ sits as a SIBLING of the season Select (not nested) so the tip explains the scope picker.
          // data-tour anchor: rankings tour "pick the season" step.
          <div data-tour="rankings-season" className="flex items-center gap-1">
          <Select value={seasonId ? String(seasonId) : undefined} onValueChange={(v) => setSeasonId(Number(v))}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder={t("seasonPlaceholder")} /></SelectTrigger>
            <SelectContent>
              {seasons.map((s) => (
                <SelectItem key={s.season_id} value={String(s.season_id)}>
                  {/* The season NAME is API data; only the "current" marker is translated. */}
                  {s.is_active ? t("seasonCurrent", { name: s.name }) : s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <InfoTip id="rankings.season_select" />
          </div>
        }
      />

      {/* status strip
          data-tour anchor: rankings tour "season status at a glance" step. */}
      <div
        data-tour="rankings-status"
        className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4"
      >
        <StatCard icon={<IconCalendarStats className="size-4" />} title={t("stats.currentSeason")}
          value={season?.name ?? t("stats.noSeason")} sub={season?.is_active ? t("stats.seasonActive") : t("stats.seasonClosed")} />
        <StatCard icon={<IconArrowsExchange className="size-4" />} title={t("stats.transferWindow")}
          value={transferWindowValue}
          sub={transferWindowSub}
          tone={transferOpen ? "text-green-500" : "text-orange-500"} />
        <StatCard icon={<IconRefresh className={cn("size-4", recalculating && "animate-spin")} />} title={t("stats.recalculation")}
          value={recalculating ? t("stats.recalcRunning") : t("stats.recalcIdle")}
          sub={recalculating ? t("stats.recalcRunningSub") : t("stats.recalcIdleSub")}
          tone={recalculating ? "text-blue-400" : "text-green-500"} />
        <StatCard icon={<IconGavel className="size-4" />} title={t("stats.lastEvaluation")}
          value={lastEval?.run ? t("stats.evalRun") : t("stats.evalNotRun")}
          sub={lastEval?.run
            // "who · when" is one translated line so the separator and order can move per language.
            ? (lastEval?.by
                ? t("stats.evalByLine", { when: lastEvalAt ?? t("stats.evalFallback"), by: lastEval.by })
                : (lastEvalAt ?? t("stats.evalFallback")))
            : t("stats.evalFallback")} />
      </div>

      {/* run evaluation + tier distribution */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* data-tour anchor: rankings tour "run the quarterly evaluation" step. */}
        <Card data-tour="rankings-evaluation" className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              {t("evaluation.cardTitle")}
              <InfoTip id="rankings.evaluation._section" className="ml-1.5" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("evaluation.blurb")}
            </p>
            {/* ⓘ sits beside each action button (sibling, not nested) - explains what the run/recalc actually does. */}
            <div className="flex items-center gap-1">
              <Button className="w-full" disabled={!seasonId} onClick={() => setEvalOpen(true)}>
                <IconPlayerPlay className="mr-1.5 size-4" /> {t("evaluation.runCta")}
              </Button>
              <InfoTip id="rankings.run_evaluation" />
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" className="w-full" disabled={!seasonId} onClick={() => setRecalcOpen(true)}>
                <IconRefresh className="mr-1.5 size-4" /> {t("evaluation.recalcCta")}
              </Button>
              <InfoTip id="rankings.recalc_entity" />
            </div>
          </CardContent>
        </Card>

        {/* data-tour anchor: rankings tour "tier distribution" step. */}
        <Card data-tour="rankings-distribution" className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center text-base">
              {t("distribution.cardTitle")}
              <InfoTip id="rankings.tier_distribution._section" className="ml-1.5" />
            </CardTitle>
            {belowFloor > 0 && (
              <Badge variant="outline" className="rounded-full text-[10px] text-muted-foreground">
                {t("distribution.belowFloor", { count: belowFloor })}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {TIERS.map((t) => (
              <div key={t} className="flex items-center gap-3">
                <div className="w-28"><TierBadge tier={t} /></div>
                <Progress value={(dist[t] / total) * 100} className="h-2 flex-1" />
                <span className="w-8 text-right text-sm font-semibold tabular-nums">{dist[t]}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* publish to public - rankings + tiers are toggled INDEPENDENTLY
          data-tour anchor: rankings tour "publish to the public" step. */}
      <Card data-tour="rankings-publish">
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center text-base">
              {t("publish.cardTitle")}
              <InfoTip id="rankings.publish._section" className="ml-1.5" />
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("publish.blurb")}
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* The CTA is a whole translated sentence per surface, not "Publish " + label.toLowerCase():
              lowercasing a translated noun and gluing it to a verb produces broken French and
              Portuguese (article and gender both change). */}
          <PublishRow
            label={t("publish.rankingsLabel")}
            desc={t("publish.rankingsDesc")}
            liveLabel={t("publish.live")}
            draftLabel={t("publish.draft")}
            publishCta={t("publish.publishRankings")}
            unpublishCta={t("publish.unpublishRankings")}
            published={rankingsPublished}
            disabled={!seasonId}
            helpId="rankings.publish_rankings"
            onToggle={() => setPublishTarget({ kind: "rankings", next: !rankingsPublished })}
          />
          <PublishRow
            label={t("publish.tiersLabel")}
            desc={t("publish.tiersDesc")}
            liveLabel={t("publish.live")}
            draftLabel={t("publish.draft")}
            publishCta={t("publish.publishTiers")}
            unpublishCta={t("publish.unpublishTiers")}
            published={tiersPublished}
            disabled={!seasonId}
            helpId="rankings.publish_tiers"
            onToggle={() => setPublishTarget({ kind: "tiers", next: !tiersPublished })}
          />
        </CardContent>
      </Card>

      {/* quick links
          data-tour anchor: rankings tour "jump to the detail pages" step. */}
      <div data-tour="rankings-quicklinks" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          { label: t("quickLinks.resultMarkers"), icon: IconClipboardCheck, desc: t("quickLinks.resultMarkersDesc"), href: "/a/rankings/results" },
          { label: t("quickLinks.seasons"), icon: IconSettings, desc: t("quickLinks.seasonsDesc"), href: "/a/rankings/seasons" },
          { label: t("quickLinks.ghostTeams"), icon: IconGhost2, desc: t("quickLinks.ghostTeamsDesc"), href: "/a/rankings/ghost-teams" },
          { label: t("quickLinks.audit"), icon: IconHistory, desc: t("quickLinks.auditDesc"), href: "/a/rankings/audit" },
        ].map((x) => (
          <Link key={x.href} href={x.href}
            className="flex items-center gap-3 rounded-md border bg-card p-3 text-left transition-colors hover:bg-muted/40">
            <x.icon className="size-5 text-primary" />
            <div>
              <p className="text-sm font-medium">{x.label}</p>
              <p className="text-xs text-muted-foreground">{x.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Claim requests queue: pending ghost-team + ghost-player claims awaiting admin review.
          Self-contained (fetches both pending lists, renders one combined table, approves/rejects
          with a mandatory reason). Sits above the team score table. */}
      <ClaimRequestsSection />

      {/* teams table + search
          data-tour anchor: rankings tour "the team score table" step. */}
      <Card data-tour="rankings-teams">
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center text-base">
            {t("teams.cardTitle", { season: season?.name ?? "" })}
            <InfoTip id="rankings.teams_table._section" className="ml-1.5" />
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("teams.search")} className="h-9 pl-8" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">{t("teams.colRank")}</TableHead>
                <TableHead>{t("teams.colTeam")}</TableHead>
                <TableHead>{t("teams.colTier")}</TableHead>
                <TableHead className="text-right">{t("teams.colTournaments")}</TableHead>
                <TableHead className="text-right">{t("teams.colKills")}</TableHead>
                <TableHead className="text-right">{t("teams.colScore")}</TableHead>
                <TableHead className="text-right">{t("teams.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  {q ? t("teams.noMatch", { q }) : t("teams.empty")}
                </TableCell></TableRow>
              ) : filtered.map((row) => (
                // The row parameter is `row`, NOT `t`: `t` is the next-intl translator for this
                // page, and naming the parameter `t` shadowed it inside this callback. The two
                // t("...") calls below then ran against a team object and the page crashed with
                // "t is not a function" for any admin whose team table had rows. Same reason the
                // sibling rankings/results/page.tsx renames its translator. Do not rename back.
                <TableRow key={row.team_id}>
                  <TableCell className="font-semibold text-muted-foreground">
                    <span className="inline-flex flex-wrap items-center"><IconHash className="size-3" />{row.rank}</span>
                  </TableCell>
                  {/* Ghost teams have no profile. The admin table already shows the name as
                      plain text (no TeamLink), and the backend prefixes it "[Ghost] ...", so we
                      only ADD a small outline Ghost badge to mark the row (no double-prefix). */}
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {row.team_name}
                      {row.is_ghost && (
                        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] text-muted-foreground">
                          {t("teams.ghost")}
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell><TierBadge tier={row.tier ?? null} /></TableCell>
                  <TableCell className="text-right tabular-nums">{row.tournaments_played ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.kills ?? 0}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-primary">{row.total_score.toFixed(0)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/a/rankings/results">{t("teams.editMarkers")}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* dialogs */}
      <RunEvaluationDialog
        open={evalOpen}
        onOpenChange={setEvalOpen}
        seasonId={seasonId}
        seasonName={season?.name}
        alreadyRun={!!lastEval?.run}
        onEvaluated={async () => {
          if (seasonId) {
            await loadTeams(seasonId);
            await loadRecalcStatus(seasonId);
          }
        }}
      />
      <RecalcEntityDialog
        open={recalcOpen}
        onOpenChange={setRecalcOpen}
        seasonId={seasonId}
      />
      <PublishStateDialog
        target={publishTarget}
        onOpenChange={(o) => { if (!o) setPublishTarget(null); }}
        seasonId={seasonId}
        seasonName={season?.name}
        onPublished={async () => {
          if (seasonId) {
            await loadTeams(seasonId);
            await loadRecalcStatus(seasonId);
          }
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Publish row - status badge + publish/unpublish button (per surface) */
/* ------------------------------------------------------------------ */
// Every visible string arrives already translated from the caller (which holds the
// translator), so this stays a dumb presentational row.
function PublishRow({
  label,
  desc,
  liveLabel,
  draftLabel,
  publishCta,
  unpublishCta,
  published,
  disabled,
  helpId,
  onToggle,
}: {
  label: string;
  desc: string;
  liveLabel: string;
  draftLabel: string;
  /** Full sentence, e.g. "Publish rankings" - never assembled from a verb + the label. */
  publishCta: string;
  unpublishCta: string;
  published: boolean;
  disabled?: boolean;
  helpId: HelpId; // centralized copy id for the per-surface publish ⓘ
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          {/* ⓘ sits beside the surface label so the publish/unpublish action is explained inline. */}
          <p className="flex items-center text-sm font-medium">
            {label}
            <InfoTip id={helpId} className="ml-1" />
          </p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs",
            published ? "border-green-500/50 text-green-500" : "border-orange-500/50 text-orange-500",
          )}
        >
          {published ? (
            <><IconWorld className="mr-1 size-3" /> {liveLabel}</>
          ) : (
            <><IconLock className="mr-1 size-3" /> {draftLabel}</>
          )}
        </Badge>
      </div>
      <Button
        size="sm"
        variant={published ? "outline" : "default"}
        className="w-full"
        disabled={disabled}
        onClick={onToggle}
      >
        {published ? (
          <><IconLock className="mr-1.5 size-4" /> {unpublishCta}</>
        ) : (
          <><IconBroadcast className="mr-1.5 size-4" /> {publishCta}</>
        )}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Publish / unpublish a single public surface - mandatory reason      */
/* ------------------------------------------------------------------ */
function PublishStateDialog({
  target,
  onOpenChange,
  seasonId,
  seasonName,
  onPublished,
}: {
  target: { kind: "rankings" | "tiers"; next: boolean } | null;
  onOpenChange: (o: boolean) => void;
  seasonId: number | undefined;
  seasonName?: string;
  onPublished: () => void | Promise<void>;
}) {
  const t = useTranslations("rankings.admin.overview");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const open = target !== null;

  React.useEffect(() => {
    if (open) {
      setReason("");
      setSaving(false);
    }
  }, [open]);

  const reasonOk = reason.trim().length >= MIN_REASON;
  const surface = target?.kind === "tiers" ? "tiers" : "rankings";
  const publishing = target?.next === true;
  // Copy is keyed by surface AND direction rather than assembled from a verb plus a noun,
  // because "Publish"/"Unpublish" + "rankings"/"tiers" does not compose in French or
  // Portuguese (article, gender and number all shift). One full sentence per combination.
  const copy = (field: string) =>
    t(`publishDialog.${surface}.${publishing ? "publish" : "unpublish"}.${field}` as never);

  const submit = async () => {
    if (!target || !seasonId || !reasonOk || saving) return;
    setSaving(true);
    try {
      // Only the surface being toggled goes in the body - rankings & tiers stay independent.
      const body: Record<string, any> =
        target.kind === "rankings"
          ? { rankings_published: target.next, reason: reason.trim() }
          : { tiers_published: target.next, reason: reason.trim() };
      await rankingsAdminApi.publishState(seasonId, body);
      toast.success(
        t(`publishDialog.${surface}.${target.next ? "publish" : "unpublish"}.success` as never, {
          season: seasonName ?? t("publishDialog.thisSeason"),
        }),
      );
      onOpenChange(false);
      await onPublished();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || copy("fail"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {publishing
              ? <IconBroadcast className="size-5 text-primary" />
              : <IconLock className="size-5 text-primary" />}
            {seasonName
              ? t("publishDialog.titleWithSeason", { action: copy("title"), season: seasonName })
              : copy("title")}
          </DialogTitle>
          <DialogDescription>{copy("desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="publish-reason">{t("publishDialog.reasonLabel")}</Label>
          <Textarea
            id="publish-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={copy("placeholder")}
          />
          <p className={cn("text-[11px]", reasonOk ? "text-muted-foreground" : "text-orange-500")}>
            {t("publishDialog.minChars", { count: reason.trim().length, min: MIN_REASON })}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t("publishDialog.cancel")}</Button>
          <Button
            variant={publishing ? "default" : "destructive"}
            onClick={submit}
            disabled={!reasonOk || saving}
          >
            {publishing
              ? <IconBroadcast className="mr-1.5 size-4" />
              : <IconLock className="mr-1.5 size-4" />}
            {saving ? t("publishDialog.working") : copy("cta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Run quarterly evaluation - preview (dry run) + confirm (force)      */
/* ------------------------------------------------------------------ */
function RunEvaluationDialog({
  open,
  onOpenChange,
  seasonId,
  seasonName,
  alreadyRun,
  onEvaluated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  seasonId: number | undefined;
  seasonName?: string;
  alreadyRun: boolean;
  onEvaluated: () => void | Promise<void>;
}) {
  const t = useTranslations("rankings.admin.overview");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<EvalSummary | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [running, setRunning] = useState(false);
  // when a real run is rejected because the season is already evaluated, surface force.
  const [needsForce, setNeedsForce] = useState(false);

  React.useEffect(() => {
    if (open) {
      setReason("");
      setPreview(null);
      setPreviewing(false);
      setRunning(false);
      setNeedsForce(false);
    }
  }, [open]);

  const reasonOk = reason.trim().length >= MIN_REASON;
  const busy = previewing || running;

  // Preview: dry run writes nothing and returns the would-be summary.
  const runPreview = async () => {
    if (!seasonId || !reasonOk || busy) return;
    setPreviewing(true);
    try {
      const summary = await rankingsAdminApi.runEvaluation(seasonId, { dry_run: true, reason: reason.trim() });
      setPreview(summary as EvalSummary);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("evalDialog.previewFailed"));
    } finally {
      setPreviewing(false);
    }
  };

  // Real run. The backend returns 409 (axios error) when already evaluated and force is off;
  // in that case we surface the message and flip to a force-confirm.
  const runReal = async (force: boolean) => {
    if (!seasonId || !reasonOk || busy) return;
    setRunning(true);
    try {
      const summary = (await rankingsAdminApi.runEvaluation(seasonId, { force, reason: reason.trim() })) as EvalSummary;
      // Two ICU plurals in one sentence, so each language picks its own forms rather
      // than relying on the English "add an s" trick.
      toast.success(
        t("evalDialog.success", {
          teams: summary.teams_evaluated,
          players: summary.players_evaluated,
          season: seasonName ?? t("publishDialog.thisSeason"),
        }),
      );
      onOpenChange(false);
      await onEvaluated();
    } catch (err: any) {
      const msg = err?.response?.data?.message || t("evalDialog.runFailed");
      const conflict = err?.response?.status === 409;
      if (conflict && !force) {
        // already evaluated - offer the force re-run.
        setNeedsForce(true);
        toast.error(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setRunning(false);
    }
  };

  const showForce = needsForce || alreadyRun;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconPlayerPlay className="size-5 text-primary" />{" "}
            {seasonName ? t("evalDialog.titleWithSeason", { season: seasonName }) : t("evalDialog.title")}
          </DialogTitle>
          <DialogDescription>{t("evalDialog.desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {showForce && (
            <div className="flex items-start gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-500">
              <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{t("evalDialog.alreadyRun")}</span>
            </div>
          )}

          {/* dry-run summary (only after a preview) */}
          {preview && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                <IconEye className="size-3.5" /> {t("evalDialog.previewHeading")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border bg-card p-3 text-center">
                  <p className="text-lg font-bold tabular-nums">{preview.teams_evaluated}</p>
                  <p className="text-[11px] text-muted-foreground">{t("evalDialog.teamsEvaluated")}</p>
                </div>
                <div className="rounded-md border bg-card p-3 text-center">
                  <p className="text-lg font-bold tabular-nums">{preview.players_evaluated}</p>
                  <p className="text-[11px] text-muted-foreground">{t("evalDialog.playersEvaluated")}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {TIERS.map((t) => (
                  <div key={t} className="flex items-center justify-between text-xs">
                    <TierBadge tier={t} />
                    <span className="font-semibold tabular-nums">{preview.tier_distribution?.[t] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="eval-reason">{t("evalDialog.reasonLabel")}</Label>
            <Textarea
              id="eval-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("evalDialog.reasonPlaceholder")}
            />
            <p className={cn("text-[11px]", reasonOk ? "text-muted-foreground" : "text-orange-500")}>
              {t("evalDialog.minChars", { count: reason.trim().length, min: MIN_REASON })}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{t("evalDialog.cancel")}</Button>
          <Button variant="outline" onClick={runPreview} disabled={!reasonOk || busy}>
            <IconEye className="mr-1.5 size-4" /> {previewing ? t("evalDialog.previewing") : t("evalDialog.preview")}
          </Button>
          {showForce ? (
            <Button variant="destructive" onClick={() => runReal(true)} disabled={!reasonOk || busy}>
              <IconPlayerPlay className="mr-1.5 size-4" /> {running ? t("evalDialog.running") : t("evalDialog.forceRerun")}
            </Button>
          ) : (
            <Button onClick={() => runReal(false)} disabled={!reasonOk || busy}>
              <IconPlayerPlay className="mr-1.5 size-4" /> {running ? t("evalDialog.running") : t("evalDialog.run")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Recalculate a single team / player                                  */
/* ------------------------------------------------------------------ */
function RecalcEntityDialog({
  open,
  onOpenChange,
  seasonId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  seasonId: number | undefined;
}) {
  const t = useTranslations("rankings.admin.overview");
  // The player list is admin-only as of 2026-08-11 (it used to answer anonymous callers with every
  // account on the site), so this dialog sends the viewer's token like every other admin fetch.
  const { token } = useAuth();
  const [entityType, setEntityType] = useState<"team" | "player">("team");
  // name picker - the text the admin types and the RESOLVED id (gate submit on this id).
  const [query, setQuery] = useState("");
  const [resolvedId, setResolvedId] = useState<number | null>(null);
  const [resolvedName, setResolvedName] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [reason, setReason] = useState("");
  const [queuing, setQueuing] = useState(false);

  // entity lists - fetched once when the dialog opens (same axios idiom as the admin pages).
  const [teamOptions, setTeamOptions] = useState<{ id: number; name: string }[]>([]);
  const [playerOptions, setPlayerOptions] = useState<{ id: number; name: string }[]>([]);

  React.useEffect(() => {
    if (open) {
      setEntityType("team");
      setQuery("");
      setResolvedId(null);
      setResolvedName("");
      setShowOptions(false);
      setReason("");
      setQueuing(false);
    }
  }, [open]);

  // fetch the team + player lists once when the dialog opens; names + ids drive the picker.
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    axios(`${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-all-teams/`)
      .then((res) => {
        if (!active) return;
        const list = (res.data?.teams ?? []).map((t: any) => ({ id: t.team_id, name: t.team_name }));
        setTeamOptions(list);
      })
      .catch((err: any) => {
        if (active) toast.error(err?.response?.data?.message || t("recalcDialog.loadTeamsFailed"));
      });
    axios(`${env.NEXT_PUBLIC_BACKEND_API_URL}/player/get-all-players/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!active) return;
        const list = (res.data?.users ?? []).map((u: any) => ({ id: u.user_id, name: u.name }));
        setPlayerOptions(list);
      })
      .catch((err: any) => {
        if (active) toast.error(err?.response?.data?.message || t("recalcDialog.loadPlayersFailed"));
      });
    return () => { active = false; };
    // `token` is a dependency now that both fetches carry it: a dialog opened before the session
    // resolved would otherwise keep an empty header and its 401 forever.
  }, [open, token]);

  // when the admin switches entity type, clear the in-flight selection.
  const selectType = (key: "team" | "player") => {
    setEntityType(key);
    setQuery("");
    setResolvedId(null);
    setResolvedName("");
    setShowOptions(false);
  };

  const source = entityType === "team" ? teamOptions : playerOptions;
  // Filter the already-loaded team/player list via the shared matchesSearch helper (punctuation +
  // fancy-font insensitive, matches the rest of the site), capped at ~8 matches. Empty query still
  // shows nothing in this typeahead, so we keep the explicit early-return before filtering.
  const matches = useMemo(() => {
    const term = query.trim();
    if (!term) return [];
    return source.filter((o) => matchesSearch(o.name, term)).slice(0, 8);
  }, [source, query]);

  // the input is "dirty" once it diverges from the resolved name - show the dropdown then.
  const dropdownOpen = showOptions && query.trim() !== "" && query !== resolvedName;

  const idOk = resolvedId != null;

  const pick = (o: { id: number; name: string }) => {
    setResolvedId(o.id);
    setResolvedName(o.name);
    setQuery(o.name);
    setShowOptions(false);
  };

  const submit = async () => {
    if (!idOk || queuing) return;
    setQueuing(true);
    try {
      const body: Record<string, any> = { entity_type: entityType, id: resolvedId };
      // season-scope the recalc so the quarterly score is recomputed too (not just the month).
      if (seasonId) body.season_id = seasonId;
      // reason is OPTIONAL for a recalc; pass it through when the admin entered one.
      if (reason.trim().length >= MIN_REASON) body.reason = reason.trim();
      await rankingsAdminApi.recalcEntity(body);
      // Separate keys per entity type: "for team X" / "for player X" needs a different
      // article and gender in French and Portuguese, so it cannot be one string plus a noun.
      toast.success(
        entityType === "team"
          ? t("recalcDialog.queuedTeam", { name: resolvedName })
          : t("recalcDialog.queuedPlayer", { name: resolvedName }),
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("recalcDialog.queueFailed"));
    } finally {
      setQueuing(false);
    }
  };

  const types: { key: "team" | "player"; label: string; icon: React.ReactNode }[] = [
    { key: "team", label: t("recalcDialog.team"), icon: <IconUsers className="size-4" /> },
    { key: "player", label: t("recalcDialog.player"), icon: <IconUser className="size-4" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconRefresh className="size-5 text-primary" /> {t("recalcDialog.title")}
          </DialogTitle>
          <DialogDescription>{t("recalcDialog.desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("recalcDialog.entityLabel")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {types.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  data-active={entityType === t.key}
                  onClick={() => selectType(t.key)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md border bg-card p-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40",
                    "data-[active=true]:border-primary/50 data-[active=true]:bg-primary/10 data-[active=true]:text-primary",
                  )}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recalc-entity">{entityType === "team" ? t("recalcDialog.team") : t("recalcDialog.player")}</Label>
            <div className="relative">
              <Input
                id="recalc-entity"
                value={query}
                autoComplete="off"
                onChange={(e) => {
                  setQuery(e.target.value);
                  // typing invalidates a prior selection - force a fresh pick.
                  setResolvedId(null);
                  setResolvedName("");
                  setShowOptions(true);
                }}
                onFocus={() => setShowOptions(true)}
                onBlur={() => setTimeout(() => setShowOptions(false), 120)}
                placeholder={entityType === "team" ? t("recalcDialog.searchTeam") : t("recalcDialog.searchPlayer")}
              />
              {dropdownOpen && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                  {matches.length === 0 ? (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("recalcDialog.noMatches")}</p>
                  ) : (
                    matches.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(o)}
                        className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                      >
                        <span className="truncate">{o.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {query.trim() !== "" && !idOk && !dropdownOpen && (
              <p className="text-xs text-orange-500">
                {entityType === "team" ? t("recalcDialog.pickTeam") : t("recalcDialog.pickPlayer")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recalc-reason">{t("recalcDialog.reasonLabel")} <span className="font-normal text-muted-foreground">{t("recalcDialog.reasonOptional")}</span></Label>
            <Textarea
              id="recalc-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("recalcDialog.reasonPlaceholder")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={queuing}>{t("recalcDialog.cancel")}</Button>
          <Button onClick={submit} disabled={!idOk || queuing}>
            <IconRefresh className="mr-1.5 size-4" /> {queuing ? t("recalcDialog.queuing") : t("recalcDialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Claim requests queue: pending ghost-team + ghost-player claims awaiting review
 *
 * WHAT IT IS
 *   The admin half of the ghost claim process. Users request to claim a ghost from the public
 *   rankings ladders (app/(user)/rankings → ClaimGhostDialog); each request sets the ghost
 *   "pending". This section lists ALL pending claims (teams + players) in one table and lets a
 *   head_admin / metrics_admin approve (re-attributes the ghost's history onto the real entity) or
 *   reject (sends it back to unclaimed).
 *
 * DATA IT TALKS TO (all in lib/rankingsAdmin.ts, Bearer-gated)
 *   - ghostTeamsPending()        → GET ghost-teams/?claim_status=pending
 *   - ghostPlayersPending()      → GET ghost-players/?claim_status=pending
 *   - approveGhostTeamClaim()    → POST ghost-teams/<uuid>/approve-claim/  { reason }
 *   - rejectGhostTeamClaim()     → POST ghost-teams/<uuid>/reject-claim/   { reason }
 *   - approveGhostPlayerClaim()  → POST ghost-players/<int>/approve-claim/ { reason }
 *   - rejectGhostPlayerClaim()   → POST ghost-players/<int>/reject-claim/  { reason }
 *   reason must be >= 10 chars (the backend 400s otherwise, mirrored by the reason prompt below).
 * ══════════════════════════════════════════════════════════════════════════ */

// One pending claim, normalised across the team + player lists so the table renders them uniformly.
interface ClaimRow {
  kind: "team" | "player";
  id: string;                 // ghost_team_id (uuid) for teams, String(id) for players
  name: string;               // ghost team_name / player ign
  requestedBy: number | null; // claim_requested_by (User id)
  // Who it would map onto. Kept as the RAW id plus a kind marker so the label can be
  // translated at render time; it used to be a pre-built English "Team #12" / "Unassigned".
  targetId: number | null;
  evidence: string;           // claim_note
  requestedAt: string;        // claim_requested_at (raw UTC instant, formatted at render)
}

// The action a reason prompt is gathering (approve vs reject) on a specific row.
type ClaimAction = { row: ClaimRow; mode: "approve" | "reject" } | null;

function ClaimRequestsSection() {
  const t = useTranslations("rankings.admin.overview");
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  // the row+mode a reason is being entered for (null = no prompt open).
  const [action, setAction] = useState<ClaimAction>(null);

  // Fetch BOTH pending lists in parallel and merge into one normalised list (teams first, then
  // players), newest request first within each kind.
  function load() {
    setLoading(true);
    Promise.all([
      rankingsAdminApi.ghostTeamsPending(),
      rankingsAdminApi.ghostPlayersPending(),
    ])
      .then(([teamsRes, playersRes]: [any, any]) => {
        const teamRows: ClaimRow[] = (teamsRes?.results ?? []).map((g: any) => ({
          kind: "team" as const,
          id: String(g.ghost_team_id),
          name: g.team_name,
          requestedBy: g.claim_requested_by ?? null,
          // claimed_by is the target afc_team.Team id (set by the request; confirmed on approve).
          targetId: g.claimed_by ?? null,
          evidence: g.claim_note ?? "",
          // Keep the full instant. It used to be sliced to the first 10 chars of the UTC
          // ISO string and printed raw, which is neither localized nor the viewer's day.
          requestedAt: g.claim_requested_at ? String(g.claim_requested_at) : "",
        }));
        const playerRows: ClaimRow[] = (playersRes?.results ?? []).map((p: any) => ({
          kind: "player" as const,
          id: String(p.id),
          name: p.ign,
          requestedBy: p.claim_requested_by ?? null,
          // a self-claim: claimed_by is the requesting User id.
          targetId: p.claimed_by ?? null,
          evidence: p.claim_note ?? "",
          requestedAt: p.claim_requested_at ? String(p.claim_requested_at) : "",
        }));
        setRows([...teamRows, ...playerRows]);
      })
      .catch((err: any) =>
        toast.error(err?.response?.data?.message || t("claims.loadFailed")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  // Run the approve/reject the reason prompt confirmed, routing to the right endpoint by kind+mode.
  async function runAction(reason: string) {
    if (!action) return;
    const { row, mode } = action;
    try {
      if (row.kind === "team") {
        if (mode === "approve") await rankingsAdminApi.approveGhostTeamClaim(row.id, { reason });
        else await rankingsAdminApi.rejectGhostTeamClaim(row.id, { reason });
      } else {
        const pid = Number(row.id);
        if (mode === "approve") await rankingsAdminApi.approveGhostPlayerClaim(pid, { reason });
        else await rankingsAdminApi.rejectGhostPlayerClaim(pid, { reason });
      }
      toast.success(
        mode === "approve"
          ? t("claims.approved", { name: row.name })
          : t("claims.rejected", { name: row.name }),
      );
      setAction(null);
      load(); // refetch the queue so the resolved row drops out
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          (mode === "approve" ? t("claims.approveFailed") : t("claims.rejectFailed")),
      );
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center text-base">
          <IconClipboardCheck className="mr-1.5 size-4 text-primary" /> {t("claims.cardTitle")}
          {rows.length > 0 && (
            <Badge
              variant="outline"
              className="ml-2 rounded-full px-2 py-0.5 text-[10px] border-orange-500/40 text-orange-400"
            >
              {t("claims.pending", { count: rows.length })}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("claims.colGhost")}</TableHead>
              <TableHead>{t("claims.colKind")}</TableHead>
              <TableHead>{t("claims.colRequestedBy")}</TableHead>
              <TableHead>{t("claims.colTarget")}</TableHead>
              <TableHead>{t("claims.colEvidence")}</TableHead>
              <TableHead>{t("claims.colRequested")}</TableHead>
              <TableHead className="text-right">{t("claims.colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <IconClock className="size-4 animate-pulse" /> {t("claims.loading")}
                  </span>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  {t("claims.empty")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={`${r.kind}-${r.id}`}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <IconGhost2 className="size-4 text-muted-foreground" />
                      {r.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    {/* outline rounded-full kind badge (green team / blue player), AFC tier-badge idiom */}
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px]",
                        r.kind === "team" ? "border-green-600/50 text-green-400" : "border-blue-500/50 text-blue-400",
                      )}
                    >
                      {r.kind === "team" ? (
                        <><IconUsers className="mr-1 size-3" /> {t("claims.team")}</>
                      ) : (
                        <><IconUser className="mr-1 size-3" /> {t("claims.player")}</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.requestedBy != null
                      ? t("claims.requestedByUser", { id: r.requestedBy })
                      : t("claims.unknownRequester")}
                  </TableCell>
                  {/* A team claim points at a Team id; a player claim is a self-claim, so a
                      missing id reads "Self" there but "Unassigned" for a team. */}
                  <TableCell className="text-muted-foreground">
                    {r.targetId != null
                      ? r.kind === "team"
                        ? t("claims.targetTeam", { id: r.targetId })
                        : t("claims.targetUser", { id: r.targetId })
                      : r.kind === "team"
                        ? t("claims.unassigned")
                        : t("claims.self")}
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate text-muted-foreground" title={r.evidence || undefined}>
                    {r.evidence || <span className="italic">{t("claims.noEvidence")}</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {r.requestedAt ? <LocalTime value={r.requestedAt} mode="date" /> : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => setAction({ row: r, mode: "approve" })}>
                        <IconCheck className="mr-1 size-3.5" /> {t("claims.approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setAction({ row: r, mode: "reject" })}
                      >
                        <IconX className="mr-1 size-3.5" /> {t("claims.reject")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* approve / reject reason prompt (mandatory >= 10 chars, mirrors the rest of admin rankings) */}
      <ClaimReasonDialog
        action={action}
        onOpenChange={(o) => { if (!o) setAction(null); }}
        onConfirm={runAction}
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Mandatory-reason prompt for an approve / reject claim action        */
/* Mirrors PublishStateDialog / RunEvaluationDialog reason gating.     */
/* ------------------------------------------------------------------ */
function ClaimReasonDialog({
  action,
  onOpenChange,
  onConfirm,
}: {
  action: ClaimAction;
  onOpenChange: (o: boolean) => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const t = useTranslations("rankings.admin.overview");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const open = action !== null;

  React.useEffect(() => {
    if (open) { setReason(""); setSubmitting(false); }
  }, [open]);

  const reasonOk = reason.trim().length >= MIN_REASON;
  const approving = action?.mode === "approve";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {approving
              ? <IconCheck className="size-5 text-primary" />
              : <IconX className="size-5 text-destructive" />}
            {action
              ? t("claimDialog.titleWithName", {
                  action: approving ? t("claimDialog.approveTitle") : t("claimDialog.rejectTitle"),
                  name: action.row.name,
                })
              : approving
                ? t("claimDialog.approveTitle")
                : t("claimDialog.rejectTitle")}
          </DialogTitle>
          <DialogDescription>
            {approving ? t("claimDialog.approveDesc") : t("claimDialog.rejectDesc")}
          </DialogDescription>
        </DialogHeader>

        {approving && (
          <div className="flex items-start gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-300">
            <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{t("claimDialog.warning")}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="claim-reason">
            {t("claimDialog.reasonLabel")} <span className="text-orange-400">{t("claimDialog.reasonRequired")}</span>
          </Label>
          <Textarea
            id="claim-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("claimDialog.reasonPlaceholder")}
            className="min-h-24"
          />
          <p className={cn("text-[11px]", reasonOk ? "text-muted-foreground" : "text-orange-500")}>
            {t("claimDialog.minChars", { count: reason.trim().length, min: MIN_REASON })}
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("claimDialog.goBack")}
          </Button>
          <Button
            variant={approving ? "default" : "destructive"}
            disabled={!reasonOk || submitting}
            onClick={async () => {
              setSubmitting(true);
              try { await onConfirm(reason.trim()); }
              finally { setSubmitting(false); }
            }}
          >
            {approving ? t("claimDialog.confirmApprove") : t("claimDialog.confirmReject")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
