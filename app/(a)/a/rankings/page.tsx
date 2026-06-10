"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import axios from "axios";
import { env } from "@/lib/env";

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

const fmtWhen = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

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
      toast.error(err?.response?.data?.message || "Failed to load rankings admin");
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
  const transferOpen = false; // derived from window dates in Phase 2
  const belowFloor = teams.filter((t) => !t.meets_participation_floor).length;

  // status-card derivations from the live recalc/eval status
  const recalculating = recalc?.recalculating ?? false;
  const lastEval = recalc?.last_evaluation;
  const lastEvalAt = fmtWhen(lastEval?.at);

  // publish state for the two INDEPENDENT public surfaces (read off the loaded season).
  const rankingsPublished = !!season?.rankings_published;
  const tiersPublished = !!season?.tiers_published;

  if (loading && !teams.length) return <FullLoader text="Loading rankings admin" />;

  return (
    <div className="space-y-4">
      <PageHeader
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        // data-tour anchor: rankings tour "the Rankings workspace" step (admin-tour-steps.ts
        // → ADMIN_TOUR_STEPS.rankings). It introduces the sub-nav row of detail pages above.
        title={
          <span data-tour="rankings-header" className="inline-flex items-center">
            Rankings & Tiering
            <InfoTip id="rankings._page" className="ml-1.5" />
          </span>
        }
        description="Control the tournament data, evaluation, and seasons that drive the public rankings."
        action={
          // ⓘ sits as a SIBLING of the season Select (not nested) so the tip explains the scope picker.
          // data-tour anchor: rankings tour "pick the season" step.
          <div data-tour="rankings-season" className="flex items-center gap-1">
          <Select value={seasonId ? String(seasonId) : undefined} onValueChange={(v) => setSeasonId(Number(v))}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Season" /></SelectTrigger>
            <SelectContent>
              {seasons.map((s) => (
                <SelectItem key={s.season_id} value={String(s.season_id)}>
                  {s.name}{s.is_active ? " · current" : ""}
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
        <StatCard icon={<IconCalendarStats className="size-4" />} title="Current Season"
          value={season?.name ?? "None"} sub={season?.is_active ? "Active" : "Closed"} />
        <StatCard icon={<IconArrowsExchange className="size-4" />} title="Transfer Window"
          value={transferOpen ? "Open" : "Locked"}
          sub={season ? `Closes ${new Date(season.end_date).toLocaleDateString()}` : ""}
          tone={transferOpen ? "text-green-500" : "text-orange-500"} />
        <StatCard icon={<IconRefresh className={cn("size-4", recalculating && "animate-spin")} />} title="Recalculation"
          value={recalculating ? "Recalculating" : "Idle"}
          sub={recalculating ? "Scores updating now" : "Live on every result edit"}
          tone={recalculating ? "text-blue-400" : "text-green-500"} />
        <StatCard icon={<IconGavel className="size-4" />} title="Last Evaluation"
          value={lastEval?.run ? "Run" : "Not run"}
          sub={lastEval?.run
            ? `${lastEvalAt ?? "Quarterly tier lock"}${lastEval?.by ? ` · ${lastEval.by}` : ""}`
            : "Quarterly tier lock"} />
      </div>

      {/* run evaluation + tier distribution */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* data-tour anchor: rankings tour "run the quarterly evaluation" step. */}
        <Card data-tour="rankings-evaluation" className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              Quarterly Evaluation
              <InfoTip id="rankings.evaluation._section" className="ml-1.5" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Locks each team&apos;s tier for the next quarter from the current scores. Head Admin or Metrics Admin only.
            </p>
            {/* ⓘ sits beside each action button (sibling, not nested) - explains what the run/recalc actually does. */}
            <div className="flex items-center gap-1">
              <Button className="w-full" disabled={!seasonId} onClick={() => setEvalOpen(true)}>
                <IconPlayerPlay className="mr-1.5 size-4" /> Run Quarterly Evaluation
              </Button>
              <InfoTip id="rankings.run_evaluation" />
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" className="w-full" disabled={!seasonId} onClick={() => setRecalcOpen(true)}>
                <IconRefresh className="mr-1.5 size-4" /> Recalculate a Team / Player
              </Button>
              <InfoTip id="rankings.recalc_entity" />
            </div>
          </CardContent>
        </Card>

        {/* data-tour anchor: rankings tour "tier distribution" step. */}
        <Card data-tour="rankings-distribution" className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center text-base">
              Tier Distribution
              <InfoTip id="rankings.tier_distribution._section" className="ml-1.5" />
            </CardTitle>
            {belowFloor > 0 && (
              <Badge variant="outline" className="rounded-full text-[10px] text-muted-foreground">
                {belowFloor} below activity floor
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
              Publish to public
              <InfoTip id="rankings.publish._section" className="ml-1.5" />
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              The public rankings and tier badges stay hidden until you publish them. Each surface is
              controlled separately - publish one without the other.
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PublishRow
            label="Rankings"
            desc="The public team & player ladder."
            published={rankingsPublished}
            disabled={!seasonId}
            helpId="rankings.publish_rankings"
            onToggle={() => setPublishTarget({ kind: "rankings", next: !rankingsPublished })}
          />
          <PublishRow
            label="Tiers"
            desc="The locked tier badges (S / A / B / C)."
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
          { label: "Result Markers", icon: IconClipboardCheck, desc: "Winners, finals, MVP", href: "/a/rankings/results" },
          { label: "Seasons", icon: IconSettings, desc: "Dates, transfer window", href: "/a/rankings/seasons" },
          { label: "Ghost Teams", icon: IconGhost2, desc: "Create & claims", href: "/a/rankings/ghost-teams" },
          { label: "Audit Log", icon: IconHistory, desc: "Every edit, raw data", href: "/a/rankings/audit" },
        ].map((x) => (
          <Link key={x.label} href={x.href}
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
            Teams · {season?.name ?? ""}
            <InfoTip id="rankings.teams_table._section" className="ml-1.5" />
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teams" className="h-9 pl-8" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Rank</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Tournaments</TableHead>
                <TableHead className="text-right">Kills</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  {q ? `No teams match “${q}”.` : "No team scores for this season yet."}
                </TableCell></TableRow>
              ) : filtered.map((t) => (
                <TableRow key={t.team_id}>
                  <TableCell className="font-semibold text-muted-foreground">
                    <span className="inline-flex items-center"><IconHash className="size-3" />{t.rank}</span>
                  </TableCell>
                  {/* Ghost teams have no profile. The admin table already shows the name as
                      plain text (no TeamLink), and the backend prefixes it "[Ghost] ...", so we
                      only ADD a small outline Ghost badge to mark the row (no double-prefix). */}
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {t.team_name}
                      {t.is_ghost && (
                        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] text-muted-foreground">
                          Ghost
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell><TierBadge tier={t.tier ?? null} /></TableCell>
                  <TableCell className="text-right tabular-nums">{t.tournaments_played ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.kills ?? 0}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-primary">{t.total_score.toFixed(0)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/a/rankings/results">Edit markers</Link>
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
function PublishRow({
  label,
  desc,
  published,
  disabled,
  helpId,
  onToggle,
}: {
  label: string;
  desc: string;
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
            <><IconWorld className="mr-1 size-3" /> Live - public</>
          ) : (
            <><IconLock className="mr-1 size-3" /> Draft - not visible to public</>
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
          <><IconLock className="mr-1.5 size-4" /> Unpublish {label.toLowerCase()}</>
        ) : (
          <><IconBroadcast className="mr-1.5 size-4" /> Publish {label.toLowerCase()}</>
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
  const verb = publishing ? "Publish" : "Unpublish";

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
        `${surface === "tiers" ? "Tiers" : "Rankings"} ${target.next ? "published to" : "hidden from"} the public for ${seasonName ?? "this season"}.`,
      );
      onOpenChange(false);
      await onPublished();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to ${verb.toLowerCase()} ${surface}`);
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
            {verb} {surface}{seasonName ? ` · ${seasonName}` : ""}
          </DialogTitle>
          <DialogDescription>
            {publishing
              ? `Makes the ${surface} visible to the public for this season. This does not change the other surface.`
              : `Hides the ${surface} from the public again - the data is kept, just not shown. The other surface is unaffected.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="publish-reason">Reason</Label>
          <Textarea
            id="publish-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={`Why are you ${publishing ? "publishing" : "unpublishing"} the ${surface}? (logged to the audit trail, min 10 characters)`}
          />
          <p className={cn("text-[11px]", reasonOk ? "text-muted-foreground" : "text-orange-500")}>
            {reason.trim().length}/{MIN_REASON} characters minimum.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button
            variant={publishing ? "default" : "destructive"}
            onClick={submit}
            disabled={!reasonOk || saving}
          >
            {publishing
              ? <IconBroadcast className="mr-1.5 size-4" />
              : <IconLock className="mr-1.5 size-4" />}
            {saving ? `${verb}ing…` : `${verb} ${surface}`}
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
      toast.error(err?.response?.data?.message || "Failed to preview evaluation");
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
      toast.success(
        `Evaluation locked ${summary.teams_evaluated} team${summary.teams_evaluated === 1 ? "" : "s"} and ${summary.players_evaluated} player${summary.players_evaluated === 1 ? "" : "s"} for ${seasonName ?? "this season"}.`,
      );
      onOpenChange(false);
      await onEvaluated();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to run evaluation";
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
            <IconPlayerPlay className="size-5 text-primary" /> Run quarterly evaluation{seasonName ? `, ${seasonName}` : ""}
          </DialogTitle>
          <DialogDescription>
            Locks every team and player tier for the next quarter from the current scores.
            Preview the would-be result first (it writes nothing), then run to commit. Head Admin or Metrics Admin only.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {showForce && (
            <div className="flex items-start gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-500">
              <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Evaluation has already been run for this season. Re-running will overwrite the previously
                assigned tiers.
              </span>
            </div>
          )}

          {/* dry-run summary (only after a preview) */}
          {preview && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                <IconEye className="size-3.5" /> Preview · nothing was written
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border bg-card p-3 text-center">
                  <p className="text-lg font-bold tabular-nums">{preview.teams_evaluated}</p>
                  <p className="text-[11px] text-muted-foreground">Teams evaluated</p>
                </div>
                <div className="rounded-md border bg-card p-3 text-center">
                  <p className="text-lg font-bold tabular-nums">{preview.players_evaluated}</p>
                  <p className="text-[11px] text-muted-foreground">Players evaluated</p>
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
            <Label htmlFor="eval-reason">Reason</Label>
            <Textarea
              id="eval-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you running the evaluation now? (logged to the audit trail, min 10 characters)"
            />
            <p className={cn("text-[11px]", reasonOk ? "text-muted-foreground" : "text-orange-500")}>
              {reason.trim().length}/{MIN_REASON} characters minimum.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="outline" onClick={runPreview} disabled={!reasonOk || busy}>
            <IconEye className="mr-1.5 size-4" /> {previewing ? "Previewing…" : "Preview (dry run)"}
          </Button>
          {showForce ? (
            <Button variant="destructive" onClick={() => runReal(true)} disabled={!reasonOk || busy}>
              <IconPlayerPlay className="mr-1.5 size-4" /> {running ? "Running…" : "Force re-run"}
            </Button>
          ) : (
            <Button onClick={() => runReal(false)} disabled={!reasonOk || busy}>
              <IconPlayerPlay className="mr-1.5 size-4" /> {running ? "Running…" : "Run evaluation"}
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
        if (active) toast.error(err?.response?.data?.message || "Failed to load teams");
      });
    axios(`${env.NEXT_PUBLIC_BACKEND_API_URL}/player/get-all-players/`)
      .then((res) => {
        if (!active) return;
        const list = (res.data?.users ?? []).map((u: any) => ({ id: u.user_id, name: u.name }));
        setPlayerOptions(list);
      })
      .catch((err: any) => {
        if (active) toast.error(err?.response?.data?.message || "Failed to load players");
      });
    return () => { active = false; };
  }, [open]);

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
      toast.success(`Recalc queued for ${entityType} ${resolvedName}.`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to queue recalc");
    } finally {
      setQueuing(false);
    }
  };

  const types: { key: "team" | "player"; label: string; icon: React.ReactNode }[] = [
    { key: "team", label: "Team", icon: <IconUsers className="size-4" /> },
    { key: "player", label: "Player", icon: <IconUser className="size-4" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconRefresh className="size-5 text-primary" /> Recalculate a team / player
          </DialogTitle>
          <DialogDescription>
            Re-derive a single entity&apos;s score from the source data. The recalc is queued and runs through
            the same pipeline as live edits, never inline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Entity</Label>
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
            <Label htmlFor="recalc-entity">{entityType === "team" ? "Team" : "Player"}</Label>
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
                placeholder={entityType === "team" ? "Search by team name" : "Search by username"}
              />
              {dropdownOpen && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                  {matches.length === 0 ? (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">No matches</p>
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
                Pick a {entityType} from the list to continue.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recalc-reason">Reason <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="recalc-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional note for the audit log (min 10 characters if provided)."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={queuing}>Cancel</Button>
          <Button onClick={submit} disabled={!idOk || queuing}>
            <IconRefresh className="mr-1.5 size-4" /> {queuing ? "Queuing…" : "Queue recalc"}
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
  target: string;             // who it would map onto: "Team #<id>" / "User #<id>"
  evidence: string;           // claim_note
  requestedAt: string;        // claim_requested_at (date slice)
}

// The action a reason prompt is gathering (approve vs reject) on a specific row.
type ClaimAction = { row: ClaimRow; mode: "approve" | "reject" } | null;

function ClaimRequestsSection() {
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
          target: g.claimed_by != null ? `Team #${g.claimed_by}` : "Unassigned",
          evidence: g.claim_note ?? "",
          requestedAt: g.claim_requested_at ? String(g.claim_requested_at).slice(0, 10) : "",
        }));
        const playerRows: ClaimRow[] = (playersRes?.results ?? []).map((p: any) => ({
          kind: "player" as const,
          id: String(p.id),
          name: p.ign,
          requestedBy: p.claim_requested_by ?? null,
          // a self-claim: claimed_by is the requesting User id.
          target: p.claimed_by != null ? `User #${p.claimed_by}` : "Self",
          evidence: p.claim_note ?? "",
          requestedAt: p.claim_requested_at ? String(p.claim_requested_at).slice(0, 10) : "",
        }));
        setRows([...teamRows, ...playerRows]);
      })
      .catch((err: any) =>
        toast.error(err?.response?.data?.message || "Failed to load claim requests."))
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
          ? `Claim approved, "${row.name}" transferred. Scores recalculating.`
          : `Claim on "${row.name}" rejected. It is unclaimed again.`,
      );
      setAction(null);
      load(); // refetch the queue so the resolved row drops out
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to ${mode} the claim.`);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center text-base">
          <IconClipboardCheck className="mr-1.5 size-4 text-primary" /> Claim requests
          {rows.length > 0 && (
            <Badge
              variant="outline"
              className="ml-2 rounded-full px-2 py-0.5 text-[10px] border-orange-500/40 text-orange-400"
            >
              {rows.length} pending
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ghost</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Requested by</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Evidence</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <IconClock className="size-4 animate-pulse" /> Loading claim requests...
                  </span>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No claim requests awaiting review.
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
                        <><IconUsers className="mr-1 size-3" /> Team</>
                      ) : (
                        <><IconUser className="mr-1 size-3" /> Player</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.requestedBy != null ? `User #${r.requestedBy}` : "Unknown"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.target}</TableCell>
                  <TableCell className="max-w-[16rem] truncate text-muted-foreground" title={r.evidence || undefined}>
                    {r.evidence || <span className="italic">None provided</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{r.requestedAt}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => setAction({ row: r, mode: "approve" })}>
                        <IconCheck className="mr-1 size-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setAction({ row: r, mode: "reject" })}
                      >
                        <IconX className="mr-1 size-3.5" /> Reject
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
            {approving ? "Approve claim" : "Reject claim"}
            {action ? `, ${action.row.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            {approving
              ? "Approving transfers this ghost's historical results, stats, and prize money onto the claiming entity and recalculates the affected scores. This can only be undone with a revoke."
              : "Rejecting sends this request back to unclaimed. Nothing is transferred; the ghost can be claimed again."}
          </DialogDescription>
        </DialogHeader>

        {approving && (
          <div className="flex items-start gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-300">
            <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              History re-attribution is retroactive across every affected month and season. If the
              real entity already shares a leaderboard with this ghost, the approval is blocked and
              must be resolved manually.
            </span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="claim-reason">
            Reason <span className="text-orange-400">(required, logged)</span>
          </Label>
          <Textarea
            id="claim-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why, at least 10 characters. This is written to the audit log."
            className="min-h-24"
          />
          <p className={cn("text-[11px]", reasonOk ? "text-muted-foreground" : "text-orange-500")}>
            {reason.trim().length}/{MIN_REASON} characters minimum
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Go back
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
            {approving ? "Approve & transfer" : "Reject request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
