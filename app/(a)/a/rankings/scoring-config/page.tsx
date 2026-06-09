"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { FullLoader } from "@/components/Loader";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { TierBadge } from "@/components/rankings/TierBadge";
import {
  IconAdjustmentsBolt, IconHistory, IconAlertTriangle, IconStack2,
  IconDeviceFloppy, IconRotateClockwise2, IconTargetArrow, IconSkull,
  IconTrophy, IconFlag, IconCoin, IconBrandInstagram, IconSwords,
  IconUser, IconStairsUp, IconInfoCircle, IconCheck, IconPercentage,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";
import type { HelpId } from "@/lib/help-content";

/**
 * Scoring Configuration - wired to the Phase-2 rankings admin write API.
 *
 * These knobs are the single source of truth for every ranking + tier
 * calculation. The active config (or the constants.py defaults snapshot) loads
 * via `rankingsAdminApi.scoringConfig()`; saving drafts a new immutable version
 * via `rankingsAdminApi.saveScoringConfig({ config, reason })`, and "Reset to
 * spec defaults" pulls `rankingsAdminApi.scoringDefaults()`. The local
 * `ScoringConfig` shape below is the editor view; `fromBackend` / `toBackend`
 * round-trip it against the backend JSON snapshot (see
 * `afc_rankings/admin_scoring_config.py::_defaults_snapshot`).
 */

const MIN_REASON = 10;
const ngn = (n: number) => "₦" + n.toLocaleString();

// ── seeded spec defaults (mirror backend/afc_rankings/scoring/constants.py) ──
type Bracket = { id: number; max: number | null; pts: number };
let _bid = 0;
const bracket = (max: number | null, pts: number): Bracket => ({ id: _bid++, max, pts });

type ScoringConfig = {
  // §4 tier multipliers (placement / kill / finals only)
  tierMult: { tier_1: number; tier_2: number; tier_3: number };
  // §4.1 placement points per match, finish 1..10 (11+ = 0)
  placement: number[]; // index 0 => finish 1
  // §4.2 kill compression
  killScale: Bracket[];
  // §4.3 placement compression
  placementScale: Bracket[];
  // §4.4 win bonuses (flat)
  winBonus: { tier_1: number; tier_2: number; tier_3: number };
  // §4.5 finals appearance base
  finalsBase: number;
  // §7.2 prize money points
  prizeScale: Bracket[];
  // §7.3 social media points (teams only, cap 10)
  socialScale: Bracket[];
  // §11 tier thresholds (min score inclusive)
  thresholds: { elite: number; competitive: number; rising: number };
  // §6 / §12 scrim rules
  scrim: {
    weight: number; winFlat: number; capRatio: number; dailyCap: number; monthlyCap: number;
  };
  // §7 player flat weights
  player: {
    mvp: number; finals: number; teamWin: number; participation: number;
    scrimWin: number; scrimKillWeight: number;
  };
};

function seedDefaults(): ScoringConfig {
  _bid = 0;
  return {
    tierMult: { tier_1: 2.0, tier_2: 1.5, tier_3: 1.0 },
    placement: [12, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    killScale: [
      bracket(50, 3), bracket(100, 7), bracket(200, 12), bracket(300, 17),
      bracket(500, 23), bracket(750, 28), bracket(1000, 33), bracket(1500, 38),
      bracket(2000, 43), bracket(3000, 50), bracket(5000, 58), bracket(null, 65),
    ],
    placementScale: [
      bracket(50, 5), bracket(100, 10), bracket(200, 17), bracket(300, 24),
      bracket(500, 31), bracket(750, 38), bracket(1000, 44), bracket(1500, 50),
      bracket(2000, 56), bracket(3000, 62), bracket(null, 70),
    ],
    winBonus: { tier_1: 30, tier_2: 20, tier_3: 12 },
    finalsBase: 5,
    prizeScale: [
      bracket(100_000, 5), bracket(300_000, 10), bracket(500_000, 15),
      bracket(750_000, 20), bracket(1_000_000, 25), bracket(1_500_000, 30),
      bracket(2_000_000, 35), bracket(2_500_000, 40), bracket(3_000_000, 45),
      bracket(3_500_000, 50), bracket(4_000_000, 55), bracket(4_500_000, 60),
      bracket(null, 65),
    ],
    socialScale: [
      bracket(1_000, 1), bracket(5_000, 3), bracket(10_000, 5),
      bracket(25_000, 7), bracket(50_000, 9), bracket(null, 10),
    ],
    thresholds: { elite: 150, competitive: 90, rising: 40 },
    scrim: { weight: 0.5, winFlat: 3, capRatio: 0.3, dailyCap: 4, monthlyCap: 60 },
    player: { mvp: 5, finals: 3, teamWin: 5, participation: 1, scrimWin: 1, scrimKillWeight: 0.5 },
  };
}

/* ─────────────────────────── backend <-> editor mapping ─────────────────────
 * Backend JSON snapshot shape (see admin_scoring_config.py::_defaults_snapshot):
 *   tier_multiplier:   { tier_1, tier_2, tier_3 }
 *   placement_points:  { "1": n, ... "10": n }   (string keys)
 *   kill_compression / placement_compression / prize_money_points /
 *     social_media_points:  [{ max: int|null, points: int }]   (open top => max:null)
 *   win_bonus:         { tier_1, tier_2, tier_3 }
 *   finals_base:       number
 *   tier_thresholds:   { brackets: [{ min, tier }], default_tier, labels }
 *   scrim:             { weight, win_flat, cap_ratio, daily_cap, monthly_cap }
 *   player_weights:    { mvp_pts, finals_pts, team_win_pts, participation_pts,
 *                        scrim_win_pts, scrim_kill_weight }
 */
type BackendBracket = { max: number | null; points: number };
type BackendConfig = {
  tier_multiplier: { tier_1: number; tier_2: number; tier_3: number };
  placement_points: Record<string, number>;
  kill_compression: BackendBracket[];
  placement_compression: BackendBracket[];
  win_bonus: { tier_1: number; tier_2: number; tier_3: number };
  finals_base: number;
  prize_money_points: BackendBracket[];
  social_media_points: BackendBracket[];
  tier_thresholds: {
    brackets: { min: number; tier: number }[];
    default_tier?: number;
    labels?: Record<string, string>;
  };
  scrim: {
    weight: number; win_flat: number; cap_ratio: number;
    daily_cap: number; monthly_cap: number;
  };
  player_weights: {
    mvp_pts: number; finals_pts: number; team_win_pts: number;
    participation_pts: number; scrim_win_pts: number; scrim_kill_weight: number;
  };
};

/** Backend bracket list → editor Bracket[] (fresh, stable ids per import). */
function toBrackets(rows: BackendBracket[]): Bracket[] {
  return (rows ?? []).map((r) => bracket(r.max ?? null, r.points));
}

/** Map a backend config snapshot → the editor's local ScoringConfig. */
function fromBackend(b: BackendConfig): ScoringConfig {
  _bid = 0;
  // placement_points keys are strings ("1".."10"); rebuild index 0 => finish 1.
  const placement: number[] = [];
  for (let i = 1; i <= 10; i++) placement.push(Number(b.placement_points?.[String(i)] ?? 0));
  // tier_thresholds: pull the min-score for each tier int from the bracket list.
  const minFor = (tier: number) =>
    Number(b.tier_thresholds?.brackets?.find((x) => x.tier === tier)?.min ?? 0);
  return {
    tierMult: {
      tier_1: Number(b.tier_multiplier?.tier_1 ?? 0),
      tier_2: Number(b.tier_multiplier?.tier_2 ?? 0),
      tier_3: Number(b.tier_multiplier?.tier_3 ?? 0),
    },
    placement,
    killScale: toBrackets(b.kill_compression),
    placementScale: toBrackets(b.placement_compression),
    winBonus: {
      tier_1: Number(b.win_bonus?.tier_1 ?? 0),
      tier_2: Number(b.win_bonus?.tier_2 ?? 0),
      tier_3: Number(b.win_bonus?.tier_3 ?? 0),
    },
    finalsBase: Number(b.finals_base ?? 0),
    prizeScale: toBrackets(b.prize_money_points),
    socialScale: toBrackets(b.social_media_points),
    thresholds: {
      elite: minFor(0),
      competitive: minFor(1),
      rising: minFor(2),
    },
    scrim: {
      weight: Number(b.scrim?.weight ?? 0),
      winFlat: Number(b.scrim?.win_flat ?? 0),
      capRatio: Number(b.scrim?.cap_ratio ?? 0),
      dailyCap: Number(b.scrim?.daily_cap ?? 0),
      monthlyCap: Number(b.scrim?.monthly_cap ?? 0),
    },
    player: {
      mvp: Number(b.player_weights?.mvp_pts ?? 0),
      finals: Number(b.player_weights?.finals_pts ?? 0),
      teamWin: Number(b.player_weights?.team_win_pts ?? 0),
      participation: Number(b.player_weights?.participation_pts ?? 0),
      scrimWin: Number(b.player_weights?.scrim_win_pts ?? 0),
      scrimKillWeight: Number(b.player_weights?.scrim_kill_weight ?? 0),
    },
  };
}

/** Editor Bracket[] → backend bracket list (preserve open-ended max:null). */
function fromBrackets(rows: Bracket[]): BackendBracket[] {
  return rows.map((r) => ({ max: r.max, points: r.pts }));
}

/**
 * Map the editor's ScoringConfig → the FULL backend snapshot for save.
 * `raw` is the last-loaded backend config: we re-emit fields the editor does not
 * expose (tier_thresholds.default_tier / labels, the tier-3/Entry floor) so the
 * saved version is a complete, lossless snapshot.
 */
function toBackend(c: ScoringConfig, raw: BackendConfig | null): BackendConfig {
  const placement_points: Record<string, number> = {};
  c.placement.forEach((pts, i) => { placement_points[String(i + 1)] = pts; });
  return {
    tier_multiplier: { ...c.tierMult },
    placement_points,
    kill_compression: fromBrackets(c.killScale),
    placement_compression: fromBrackets(c.placementScale),
    win_bonus: { ...c.winBonus },
    finals_base: c.finalsBase,
    prize_money_points: fromBrackets(c.prizeScale),
    social_media_points: fromBrackets(c.socialScale),
    tier_thresholds: {
      brackets: [
        { min: c.thresholds.elite, tier: 0 },
        { min: c.thresholds.competitive, tier: 1 },
        { min: c.thresholds.rising, tier: 2 },
      ],
      default_tier: raw?.tier_thresholds?.default_tier ?? 3,
      labels: raw?.tier_thresholds?.labels ?? {
        "0": "Elite", "1": "Competitive", "2": "Rising", "3": "Entry",
      },
    },
    scrim: {
      weight: c.scrim.weight,
      win_flat: c.scrim.winFlat,
      cap_ratio: c.scrim.capRatio,
      daily_cap: c.scrim.dailyCap,
      monthly_cap: c.scrim.monthlyCap,
    },
    player_weights: {
      mvp_pts: c.player.mvp,
      finals_pts: c.player.finals,
      team_win_pts: c.player.teamWin,
      participation_pts: c.player.participation,
      scrim_win_pts: c.player.scrimWin,
      scrim_kill_weight: c.player.scrimKillWeight,
    },
  };
}

/** Count how many individual fields differ from the saved baseline config. */
function countDirty(c: ScoringConfig, base: ScoringConfig): number {
  let n = 0;
  const cmp = (a: number, b: number) => { if (a !== b) n++; };
  cmp(c.tierMult.tier_1, base.tierMult.tier_1);
  cmp(c.tierMult.tier_2, base.tierMult.tier_2);
  cmp(c.tierMult.tier_3, base.tierMult.tier_3);
  c.placement.forEach((p, i) => cmp(p, base.placement[i]));
  c.killScale.forEach((b, i) => cmp(b.pts, base.killScale[i]?.pts));
  c.placementScale.forEach((b, i) => cmp(b.pts, base.placementScale[i]?.pts));
  cmp(c.winBonus.tier_1, base.winBonus.tier_1);
  cmp(c.winBonus.tier_2, base.winBonus.tier_2);
  cmp(c.winBonus.tier_3, base.winBonus.tier_3);
  cmp(c.finalsBase, base.finalsBase);
  c.prizeScale.forEach((b, i) => cmp(b.pts, base.prizeScale[i]?.pts));
  c.socialScale.forEach((b, i) => cmp(b.pts, base.socialScale[i]?.pts));
  cmp(c.thresholds.elite, base.thresholds.elite);
  cmp(c.thresholds.competitive, base.thresholds.competitive);
  cmp(c.thresholds.rising, base.thresholds.rising);
  cmp(c.scrim.weight, base.scrim.weight);
  cmp(c.scrim.winFlat, base.scrim.winFlat);
  cmp(c.scrim.capRatio, base.scrim.capRatio);
  cmp(c.scrim.dailyCap, base.scrim.dailyCap);
  cmp(c.scrim.monthlyCap, base.scrim.monthlyCap);
  cmp(c.player.mvp, base.player.mvp);
  cmp(c.player.finals, base.player.finals);
  cmp(c.player.teamWin, base.player.teamWin);
  cmp(c.player.participation, base.player.participation);
  cmp(c.player.scrimWin, base.player.scrimWin);
  cmp(c.player.scrimKillWeight, base.player.scrimKillWeight);
  return n;
}

/* ───────────────────────────────────────────────────── small building blocks */

// `anchor` (optional) attaches a data-tour anchor to the card root so the scoring-config
// tour can target individual status tiles (active version / unsaved changes) without
// wrapping them in an extra element that would break the responsive grid.
function StatCard({ icon, title, value, sub, tone, anchor }: {
  icon: React.ReactNode; title: string; value: React.ReactNode; sub?: string; tone?: string;
  anchor?: string;
}) {
  return (
    <Card data-tour={anchor} className="gap-1 transition-shadow hover:shadow-lg">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className={cn("text-muted-foreground", tone)}>{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

/** A scalar number input that highlights when it differs from its default. */
function NumField({
  label, value, def, onChange, step = 1, min = 0, suffix, prefix, className,
}: {
  label?: string; value: number; def: number; onChange: (v: number) => void;
  step?: number; min?: number; suffix?: string; prefix?: string; className?: string;
}) {
  const dirty = value !== def;
  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {label}
          {dirty && (
            <span className="inline-block size-1.5 rounded-full bg-orange-500" aria-label="changed" />
          )}
        </Label>
      )}
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          type="number" min={min} step={step} inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          className={cn(
            "h-8 text-xs tabular-nums",
            prefix && "pl-5",
            suffix && "pr-7",
            dirty && "border-orange-500/60 bg-orange-500/5 text-orange-300",
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/** A lookup-scale table: "Up to" (read-only bound) / editable "Points". */
function ScaleTable({
  rows, defaults, fmtBound, onPoints,
}: {
  rows: Bracket[]; defaults: Bracket[];
  fmtBound: (n: number) => string;
  onPoints: (id: number, pts: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-foreground">Up to</TableHead>
            <TableHead className="w-[110px] text-right text-foreground">Points</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b, i) => {
            const dirty = b.pts !== defaults[i].pts;
            const open = b.max === null;
            return (
              <TableRow key={b.id} className={cn(dirty && "bg-orange-500/5")}>
                <TableCell className="text-xs tabular-nums">
                  {open ? (
                    <span className="inline-flex items-center gap-1 font-medium text-foreground">
                      Above <span className="text-muted-foreground">(∞)</span>
                    </span>
                  ) : (
                    fmtBound(b.max as number)
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number" min={0}
                    value={b.pts}
                    onChange={(e) => onPoints(b.id, e.target.value === "" ? 0 : Number(e.target.value))}
                    className={cn(
                      "ml-auto h-8 w-20 text-right text-xs tabular-nums",
                      dirty && "border-orange-500/60 bg-orange-500/5 text-orange-300",
                    )}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** Section header inside a card: title + spec ref + helper line (+ optional ⓘ). */
function GroupHead({ icon, title, spec, helper, helpId }: {
  icon: React.ReactNode; title: string; spec: string; helper: string;
  helpId?: HelpId; // centralized copy id for the section ⓘ next to the spec badge
}) {
  return (
    <div className="space-y-1">
      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
        <span className="text-primary">{icon}</span>
        {title}
        <Badge variant="outline" className="rounded-full border-blue-600/60 text-[10px] font-normal text-blue-400">
          {spec}
        </Badge>
        {helpId && <InfoTip id={helpId} />}
      </CardTitle>
      <p className="text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────── page */

export default function ScoringConfigPage() {
  const [cfg, setCfg] = useState<ScoringConfig>(() => seedDefaults());
  // baseline = last-saved (or loaded) config; dirty-tracking + orange highlights
  // measure the editor against THIS, not the spec defaults.
  const [baseline, setBaseline] = useState<ScoringConfig>(() => seedDefaults());
  // last-loaded raw backend snapshot - re-emitted on save so the saved version is lossless.
  const [rawConfig, setRawConfig] = useState<BackendConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [reason, setReason] = useState("");

  // versioned config metadata (read from the active config row, or "defaults").
  const [activeVersion, setActiveVersion] = useState<string>("-");
  const [lastEdited, setLastEdited] = useState<string>("-");
  const [lastEditedBy, setLastEditedBy] = useState<string>("-");

  const dirtyCount = useMemo(() => countDirty(cfg, baseline), [cfg, baseline]);
  const reasonValid = reason.trim().length >= MIN_REASON;

  // ── load the active scoring config (or the constants.py defaults snapshot) ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rankingsAdminApi.scoringConfig();
      const raw = res?.config as BackendConfig;
      const mapped = fromBackend(raw);
      setRawConfig(raw);
      setCfg(mapped);
      setBaseline(fromBackend(raw)); // fresh clone so editor edits don't mutate baseline
      setActiveVersion(
        res?.is_default || res?.version == null ? "defaults" : `v${res.version}`,
      );
      setLastEdited(res?.created_at ? String(res.created_at).slice(0, 10) : "-");
      setLastEditedBy(res?.created_by ?? (res?.is_default ? "spec defaults" : "-"));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load scoring config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── mutators (all local state) ── */
  const patch = (fn: (c: ScoringConfig) => ScoringConfig) => setCfg((c) => fn(c));

  const setTierMult = (k: keyof ScoringConfig["tierMult"], v: number) =>
    patch((c) => ({ ...c, tierMult: { ...c.tierMult, [k]: v } }));
  const setWinBonus = (k: keyof ScoringConfig["winBonus"], v: number) =>
    patch((c) => ({ ...c, winBonus: { ...c.winBonus, [k]: v } }));
  const setPlacement = (i: number, v: number) =>
    patch((c) => ({ ...c, placement: c.placement.map((p, idx) => (idx === i ? v : p)) }));
  const setKillPts = (id: number, v: number) =>
    patch((c) => ({ ...c, killScale: c.killScale.map((b) => (b.id === id ? { ...b, pts: v } : b)) }));
  const setPlacePts = (id: number, v: number) =>
    patch((c) => ({ ...c, placementScale: c.placementScale.map((b) => (b.id === id ? { ...b, pts: v } : b)) }));
  const setPrizePts = (id: number, v: number) =>
    patch((c) => ({ ...c, prizeScale: c.prizeScale.map((b) => (b.id === id ? { ...b, pts: v } : b)) }));
  const setSocialPts = (id: number, v: number) =>
    patch((c) => ({ ...c, socialScale: c.socialScale.map((b) => (b.id === id ? { ...b, pts: v } : b)) }));
  const setThreshold = (k: keyof ScoringConfig["thresholds"], v: number) =>
    patch((c) => ({ ...c, thresholds: { ...c.thresholds, [k]: v } }));
  const setScrim = (k: keyof ScoringConfig["scrim"], v: number) =>
    patch((c) => ({ ...c, scrim: { ...c.scrim, [k]: v } }));
  const setPlayer = (k: keyof ScoringConfig["player"], v: number) =>
    patch((c) => ({ ...c, player: { ...c.player, [k]: v } }));

  // "Reset to spec defaults" pulls the constants.py snapshot and loads it into
  // the editor (staged - not persisted until the user Saves).
  const resetDefaults = async () => {
    try {
      const res = await rankingsAdminApi.scoringDefaults();
      const raw = res?.config as BackendConfig;
      setRawConfig(raw);
      setCfg(fromBackend(raw));
      toast.info("Loaded spec defaults. Save to persist them as a new version.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load spec defaults");
    }
  };

  const openSave = () => {
    if (dirtyCount === 0) {
      toast.info("No changes to save.");
      return;
    }
    setReason("");
    setSaveOpen(true);
  };

  const confirmSave = async () => {
    if (!reasonValid || saving) return;
    setSaving(true);
    try {
      const config = toBackend(cfg, rawConfig);
      await rankingsAdminApi.saveScoringConfig({ config, reason: reason.trim() });
      toast.success("Scoring config saved; new version drafted");
      setSaveOpen(false);
      setReason("");
      // re-fetch so the version metadata + baseline match the server (dirty resets).
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save scoring config");
    } finally {
      setSaving(false);
    }
  };

  const kfmt = (n: number) => n.toLocaleString();

  if (loading) return <FullLoader text="Loading scoring configuration" />;

  return (
    <div className="space-y-4">
      <PageHeader
        back
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        // data-tour anchor: scoring-config tour "Scoring Configuration page" step.
        title={
          <span data-tour="scoring-config-title" className="inline-flex items-center">
            Scoring Configuration
            <InfoTip id="rankings.scoring._page" className="ml-1.5" />
          </span>
        }
        description="The weights, brackets and thresholds that drive every ranking and tier calculation. Changes are versioned and recalculate scores across the season."
        action={
          // Each action ⓘ is a SIBLING of its button (not nested) - Reset stages defaults, Save drafts a version.
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <div className="flex items-center gap-1">
              {/* data-tour anchor: scoring-config tour "Reset to spec defaults" step. */}
              <Button data-tour="scoring-config-reset" variant="outline" className="w-full sm:w-auto" onClick={resetDefaults}>
                <IconRotateClockwise2 className="mr-1.5 size-4" /> Reset to spec defaults
              </Button>
              <InfoTip id="rankings.scoring.reset_defaults" />
            </div>
            <div className="flex items-center gap-1">
              {/* data-tour anchor: scoring-config tour "Save changes" step. */}
              <Button data-tour="scoring-config-save" className="w-full sm:w-auto" onClick={openSave} disabled={dirtyCount === 0}>
                <IconDeviceFloppy className="mr-1.5 size-4" /> Save changes
                {dirtyCount > 0 && (
                  <Badge variant="outline" className="ml-1 rounded-full border-background/40 bg-background/20 px-1.5 py-0 text-[10px] tabular-nums">
                    {dirtyCount}
                  </Badge>
                )}
              </Button>
              <InfoTip id="rankings.scoring.save" />
            </div>
          </div>
        }
      />

      {/* status strip */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4">
        {/* data-tour anchor: scoring-config tour "Active config version" step. */}
        <StatCard
          anchor="scoring-config-version"
          icon={<IconAdjustmentsBolt className="size-4" />}
          title="Active config version" value={activeVersion}
          sub="Applied to the current season" tone="text-primary"
        />
        <StatCard
          icon={<IconHistory className="size-4" />}
          title="Last edited" value={lastEdited}
          sub={`by ${lastEditedBy}`}
        />
        {/* data-tour anchor: scoring-config tour "Unsaved changes" step. */}
        <StatCard
          anchor="scoring-config-unsaved"
          icon={<IconAlertTriangle className="size-4" />}
          title="Unsaved changes" value={dirtyCount}
          sub={dirtyCount > 0 ? "fields differ from saved" : "in sync with saved version"}
          tone={dirtyCount > 0 ? "text-orange-500" : "text-green-500"}
        />
        <StatCard
          icon={<IconStack2 className="size-4" />}
          title="Tiers" value={4}
          sub="Elite · Competitive · Rising · Entry"
        />
      </div>

      {/* explainer banner */}
      <p className="flex items-start gap-2 rounded-md border border-blue-600/20 bg-blue-500/5 p-3 text-xs text-muted-foreground">
        <IconInfoCircle className="mt-0.5 size-4 shrink-0 text-blue-400" />
        <span>
          <span className="font-semibold text-foreground">Edits are staged locally.</span> Changing any
          field marks it as unsaved (orange). Saving drafts a new immutable config version and queues a
          full recalculation for every ranked team and player. Values seed from
          <span className="font-mono"> afc_rankings/scoring/constants.py</span>.
        </span>
      </p>

      {/* two-column responsive grid of groups
          data-tour anchor: scoring-config tour "Scoring brackets" step (the editable
          compression scales for kills / placement / prize money / social media live here). */}
      <div data-tour="scoring-config-scales" className="grid grid-cols-1 gap-4 xl:grid-cols-2">

        {/* §4 Tier multipliers */}
        <Card>
          <CardHeader>
            <GroupHead
              icon={<IconTargetArrow className="size-4" />}
              title="Tier multipliers" spec="§4" helpId="rankings.scoring.tier_multipliers._section"
              helper="Applied to placement, kill and finals points only - never to win bonus, scrim, prize or social."
            />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Tier 1" suffix="×" step={0.1}
                value={cfg.tierMult.tier_1} def={baseline.tierMult.tier_1}
                onChange={(v) => setTierMult("tier_1", v)} />
              <NumField label="Tier 2" suffix="×" step={0.1}
                value={cfg.tierMult.tier_2} def={baseline.tierMult.tier_2}
                onChange={(v) => setTierMult("tier_2", v)} />
              <NumField label="Tier 3" suffix="×" step={0.1}
                value={cfg.tierMult.tier_3} def={baseline.tierMult.tier_3}
                onChange={(v) => setTierMult("tier_3", v)} />
            </div>
          </CardContent>
        </Card>

        {/* §4.4 Win bonuses + §4.5 Finals base */}
        <Card>
          <CardHeader>
            <GroupHead
              icon={<IconTrophy className="size-4" />}
              title="Win bonus & finals base" spec="§4.4 / §4.5" helpId="rankings.scoring.win_bonus._section"
              helper="Win bonus is flat per tier (not compressed, not multiplied). Finals bonus = base × tier multiplier."
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Win bonus (flat)</p>
              <div className="grid grid-cols-3 gap-3">
                <NumField label="Tier 1"
                  value={cfg.winBonus.tier_1} def={baseline.winBonus.tier_1}
                  onChange={(v) => setWinBonus("tier_1", v)} />
                <NumField label="Tier 2"
                  value={cfg.winBonus.tier_2} def={baseline.winBonus.tier_2}
                  onChange={(v) => setWinBonus("tier_2", v)} />
                <NumField label="Tier 3"
                  value={cfg.winBonus.tier_3} def={baseline.winBonus.tier_3}
                  onChange={(v) => setWinBonus("tier_3", v)} />
              </div>
            </div>
            <div className="grid grid-cols-2 items-end gap-3">
              <NumField label="Finals appearance base"
                value={cfg.finalsBase} def={baseline.finalsBase}
                onChange={(v) => patch((c) => ({ ...c, finalsBase: v }))} />
              <p className="flex items-center gap-1.5 pb-2 text-[11px] text-muted-foreground">
                <IconFlag className="size-3.5 text-primary" />
                ×{cfg.tierMult.tier_1} → {(cfg.finalsBase * cfg.tierMult.tier_1).toFixed(1)} pts at Tier 1
              </p>
            </div>
          </CardContent>
        </Card>

        {/* §4.1 Placement points per match */}
        <Card>
          <CardHeader>
            <GroupHead
              icon={<IconStairsUp className="size-4" />}
              title="Placement points per match" spec="§4.1" helpId="rankings.scoring.placement_points._section"
              helper="Points awarded by finishing position each match. 11th and beyond award 0."
            />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {cfg.placement.map((pts, i) => {
                const dirty = pts !== baseline.placement[i];
                return (
                  <div key={i} className={cn(
                    "flex items-center gap-2 rounded-md border p-2",
                    dirty && "border-orange-500/60 bg-orange-500/5",
                  )}>
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <Input
                      type="number" min={0}
                      value={pts}
                      onChange={(e) => setPlacement(i, e.target.value === "" ? 0 : Number(e.target.value))}
                      className={cn(
                        "h-8 text-center text-xs tabular-nums",
                        dirty && "border-orange-500/60 bg-orange-500/5 text-orange-300",
                      )}
                      aria-label={`Finish ${i + 1} points`}
                    />
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Finish position → points. 11th+ implicitly award 0.
            </p>
          </CardContent>
        </Card>

        {/* §11 Tier thresholds */}
        <Card>
          <CardHeader>
            <GroupHead
              icon={<IconStack2 className="size-4" />}
              title="Tier thresholds" spec="§11" helpId="rankings.scoring.thresholds._section"
              helper="Minimum total score (inclusive) to reach each tier. Entry is the default floor below the lowest cut-off."
            />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-foreground">Tier</TableHead>
                    <TableHead className="text-foreground">Min score (≥)</TableHead>
                    <TableHead className="text-right text-foreground">Range</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className={cn(cfg.thresholds.elite !== baseline.thresholds.elite && "bg-orange-500/5")}>
                    <TableCell><TierBadge tier={0} /></TableCell>
                    <TableCell className="w-[120px]">
                      <NumField value={cfg.thresholds.elite} def={baseline.thresholds.elite}
                        onChange={(v) => setThreshold("elite", v)} />
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      {cfg.thresholds.elite}+
                    </TableCell>
                  </TableRow>
                  <TableRow className={cn(cfg.thresholds.competitive !== baseline.thresholds.competitive && "bg-orange-500/5")}>
                    <TableCell><TierBadge tier={1} /></TableCell>
                    <TableCell>
                      <NumField value={cfg.thresholds.competitive} def={baseline.thresholds.competitive}
                        onChange={(v) => setThreshold("competitive", v)} />
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      {cfg.thresholds.competitive}-{cfg.thresholds.elite - 1}
                    </TableCell>
                  </TableRow>
                  <TableRow className={cn(cfg.thresholds.rising !== baseline.thresholds.rising && "bg-orange-500/5")}>
                    <TableCell><TierBadge tier={2} /></TableCell>
                    <TableCell>
                      <NumField value={cfg.thresholds.rising} def={baseline.thresholds.rising}
                        onChange={(v) => setThreshold("rising", v)} />
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      {cfg.thresholds.rising}-{cfg.thresholds.competitive - 1}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><TierBadge tier={3} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">default floor</TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      &lt;{cfg.thresholds.rising}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* §4.2 Kill compression */}
        <Card>
          <CardHeader>
            <GroupHead
              icon={<IconSkull className="size-4" />}
              title="Kill compression scale" spec="§4.2" helpId="rankings.scoring.kill_scale._section"
              helper="Cumulative raw kills compress to bounded points. Upper bound is inclusive; the last row is open-ended."
            />
          </CardHeader>
          <CardContent>
            <ScaleTable rows={cfg.killScale} defaults={baseline.killScale}
              fmtBound={kfmt} onPoints={setKillPts} />
          </CardContent>
        </Card>

        {/* §4.3 Placement compression */}
        <Card>
          <CardHeader>
            <GroupHead
              icon={<IconStairsUp className="size-4" />}
              title="Placement compression scale" spec="§4.3" helpId="rankings.scoring.placement_scale._section"
              helper="Cumulative raw placement points compress to bounded points. Upper bound inclusive; last row open-ended."
            />
          </CardHeader>
          <CardContent>
            <ScaleTable rows={cfg.placementScale} defaults={baseline.placementScale}
              fmtBound={kfmt} onPoints={setPlacePts} />
          </CardContent>
        </Card>

        {/* §7.2 Prize money points */}
        <Card>
          <CardHeader>
            <GroupHead
              icon={<IconCoin className="size-4" />}
              title="Prize money points" spec="§7.2" helpId="rankings.scoring.prize_scale._section"
              helper="Quarterly team tiering only. Total quarterly prize money (₦) maps to bounded points."
            />
          </CardHeader>
          <CardContent>
            <ScaleTable rows={cfg.prizeScale} defaults={baseline.prizeScale}
              fmtBound={ngn} onPoints={setPrizePts} />
          </CardContent>
        </Card>

        {/* §7.3 Social media points */}
        <Card>
          <CardHeader>
            <GroupHead
              icon={<IconBrandInstagram className="size-4" />}
              title="Social media points" spec="§7.3" helpId="rankings.scoring.social_scale._section"
              helper="Teams only, capped at 10. Combined Instagram + TikTok followers map to bounded points."
            />
          </CardHeader>
          <CardContent>
            <ScaleTable rows={cfg.socialScale} defaults={baseline.socialScale}
              fmtBound={kfmt} onPoints={setSocialPts} />
          </CardContent>
        </Card>

        {/* §6 / §12 Scrim rules */}
        <Card>
          <CardHeader>
            <GroupHead
              icon={<IconSwords className="size-4" />}
              title="Scrim rules" spec="§6 / §12" helpId="rankings.scoring.scrim._section"
              helper="Scrims contribute at reduced weight and are capped relative to tournament output, then by day and month."
            />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumField label="Scrim weight" suffix="×" step={0.1}
                value={cfg.scrim.weight} def={baseline.scrim.weight}
                onChange={(v) => setScrim("weight", v)} />
              <NumField label="Win flat pts"
                value={cfg.scrim.winFlat} def={baseline.scrim.winFlat}
                onChange={(v) => setScrim("winFlat", v)} />
              <div className="space-y-1">
                <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Cap ratio
                  {cfg.scrim.capRatio !== baseline.scrim.capRatio && (
                    <span className="inline-block size-1.5 rounded-full bg-orange-500" />
                  )}
                </Label>
                <div className="relative">
                  <Input
                    type="number" min={0} max={1} step={0.05}
                    value={cfg.scrim.capRatio}
                    onChange={(e) => setScrim("capRatio", e.target.value === "" ? 0 : Number(e.target.value))}
                    className={cn(
                      "h-8 pr-12 text-xs tabular-nums",
                      cfg.scrim.capRatio !== baseline.scrim.capRatio && "border-orange-500/60 bg-orange-500/5 text-orange-300",
                    )}
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 text-[11px] text-muted-foreground tabular-nums">
                    {Math.round(cfg.scrim.capRatio * 100)}<IconPercentage className="size-3" />
                  </span>
                </div>
              </div>
              <NumField label="Daily cap"
                value={cfg.scrim.dailyCap} def={baseline.scrim.dailyCap}
                onChange={(v) => setScrim("dailyCap", v)} />
              <NumField label="Monthly cap"
                value={cfg.scrim.monthlyCap} def={baseline.scrim.monthlyCap}
                onChange={(v) => setScrim("monthlyCap", v)} />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Max scrim contribution = {Math.round(cfg.scrim.capRatio * 100)}% of the team&apos;s tournament total.
            </p>
          </CardContent>
        </Card>

        {/* §7 Player flat weights */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <GroupHead
              icon={<IconUser className="size-4" />}
              title="Player flat weights" spec="§7" helpId="rankings.scoring.player_weights._section"
              helper="Per-event flat points that build an individual player's quarterly score."
            />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <NumField label="MVP award"
                value={cfg.player.mvp} def={baseline.player.mvp}
                onChange={(v) => setPlayer("mvp", v)} />
              <NumField label="Finals appearance"
                value={cfg.player.finals} def={baseline.player.finals}
                onChange={(v) => setPlayer("finals", v)} />
              <NumField label="Team win"
                value={cfg.player.teamWin} def={baseline.player.teamWin}
                onChange={(v) => setPlayer("teamWin", v)} />
              <NumField label="Participation"
                value={cfg.player.participation} def={baseline.player.participation}
                onChange={(v) => setPlayer("participation", v)} />
              <NumField label="Scrim win"
                value={cfg.player.scrimWin} def={baseline.player.scrimWin}
                onChange={(v) => setPlayer("scrimWin", v)} />
              <NumField label="Scrim kill weight" suffix="×" step={0.1}
                value={cfg.player.scrimKillWeight} def={baseline.player.scrimKillWeight}
                onChange={(v) => setPlayer("scrimKillWeight", v)} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* sticky-ish footer summary when dirty */}
      {dirtyCount > 0 && (
        <div className="flex flex-col items-start justify-between gap-2 rounded-md border border-orange-500/30 bg-orange-500/5 p-3 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <IconAlertTriangle className="size-4 shrink-0 text-orange-500" />
            <span>
              <span className="font-semibold text-foreground tabular-nums">{dirtyCount}</span> field
              {dirtyCount > 1 ? "s" : ""} changed from the saved {activeVersion} config.
            </span>
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={resetDefaults}>
              <IconRotateClockwise2 className="mr-1.5 size-3.5" /> Reset
            </Button>
            <Button size="sm" onClick={openSave}>
              <IconDeviceFloppy className="mr-1.5 size-3.5" /> Save changes
            </Button>
          </div>
        </div>
      )}

      {/* mandatory-reason save dialog */}
      <Dialog open={saveOpen} onOpenChange={(o) => { if (!o) { setSaveOpen(false); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconDeviceFloppy className="size-5 text-primary" /> Save scoring config
            </DialogTitle>
            <DialogDescription>
              Saving drafts a new immutable config version from {activeVersion} and queues a full
              ranking recalculation for every team and player. A reason is required for the audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Fields changed</span>
              <span className="font-semibold text-orange-400 tabular-nums">{dirtyCount}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>Current version</span>
              <span className="font-medium text-foreground">{activeVersion}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>New version</span>
              <span className="font-medium text-foreground">draft</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cfg-reason">Reason <span className="text-destructive">*</span></Label>
            <Textarea
              id="cfg-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Lowered Tier 1 win bonus from 30 to 25 to compress the gap between top tiers (council vote 2026-05)."
              className="min-h-24"
            />
            <p className="text-[11px] text-muted-foreground">
              {reason.trim().length < MIN_REASON
                ? `${reason.trim().length}/${MIN_REASON} characters minimum.`
                : "Logged to the ranking config audit trail."}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => { setSaveOpen(false); setReason(""); }}>
              Cancel
            </Button>
            <Button disabled={!reasonValid || saving} onClick={confirmSave}>
              <IconCheck className="mr-1.5 size-4" /> {saving ? "Saving…" : "Save & draft version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
