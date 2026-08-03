"use client";

/**
 * /a/rankings/scoring-config - the editable scoring rules.
 *
 * WHAT CHANGED AND WHY (owner 2026-08-03)
 *   "I want to be able to add new tiers and points or edit the name of the tiers or kill
 *    compression scale number and point, it should be freely editable."
 *
 *   The previous version of this page could only edit VALUES inside a fixed shape: three
 *   tournament tiers, ten placement positions, a hardcoded set of compression bands, three
 *   ranking cutoffs. It could not add a row, remove a row or rename anything, and worse, it
 *   mapped the server blob through a lossy local model, so every key it did not know about
 *   (the top-N tier sizes, the participation floors, the tier labels) was silently dropped
 *   on save.
 *
 *   This version holds the server's blob VERBATIM in state and edits it in place. Every list
 *   is structurally editable: add, remove, reorder, rename. Nothing is hardcoded that the API
 *   already describes: the group labels, help text, units and CURRENCIES all come from the
 *   `field_meta` map the backend serves, so a group added server-side renders correctly here
 *   without a frontend change.
 *
 * THE ONE THING THAT IS DELIBERATELY NOT FREE
 *   A tournament tier that events are already stored against cannot be DELETED, only retired.
 *   Deleting it would make every past event at that tier unscoreable (see the "retire, never
 *   delete" note in backend afc_rankings/scoring/tables.py). The delete button is therefore
 *   disabled for any tier that exists in the saved config and says why on hover; a tier the
 *   admin has just added, which no event can reference yet, deletes freely.
 *
 * HOW IT CONNECTS
 *   GET  /rankings/scoring-config/               the active blob + field_meta + versions + seasons
 *   GET  /rankings/scoring-config/defaults/      the factory reset payload
 *   GET  /rankings/scoring-config/versions/<n>/  one historical version, loadable into the editor
 *   POST /rankings/scoring-config/validate/      the debounced dry run behind the inline warnings
 *   POST /rankings/scoring-config/               the save (see ./_components/SaveConfigDialog.tsx)
 *   All through lib/rankingsAdmin.ts. Backend module: afc_rankings/admin_scoring_config.py.
 *   Row chrome and the blob types live in ./_components/editor-primitives.tsx.
 *
 * WHERE THE NUMBERS GO
 *   The saved blob is read by afc_rankings/aggregation.py (resolve_tables) and turned into a
 *   ScoringTables the scoring engine reads, so a change here moves every ranking and tier
 *   without a deploy. That is also why every save is versioned, reason-gated and audited.
 *
 * i18n: rankings namespace, admin.scoringConfig.* (messages/{en,fr,pt}/rankings.json). Group
 * labels and help text prefer a translated key and fall back to the server's English, so a NEW
 * group still renders. Validation messages come from the backend and are shown verbatim, the
 * same way every API error is in this app.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/PageHeader";
import { FullLoader } from "@/components/Loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { InfoTip } from "@/components/ui/info-tip";
import type { HelpId } from "@/lib/help-content";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import {
  IconAdjustmentsBolt, IconAlertTriangle, IconBrandInstagram, IconCoin, IconDeviceFloppy,
  IconFlag, IconHistory, IconInfinity, IconInfoCircle, IconPlus, IconRotateClockwise2,
  IconSkull, IconStack2, IconStairsUp, IconSwords, IconTargetArrow, IconTrophy, IconUser,
  IconUsersGroup,
} from "@tabler/icons-react";
import {
  Bracket, ConfigVersion, FieldMeta, Issue, IssueCount, IssueList, NumberBox, RowControls,
  ScoringBlob, SeasonScope, TextBox, ThresholdRow, TierRow, clone, countLeafDiffs,
  currencyPrefix, issuesAt, issuesUnder, move, removeAt, replaceAt, toIssues,
} from "./_components/editor-primitives";
import { SaveConfigDialog } from "./_components/SaveConfigDialog";

/* ───────────────────────────────────────────────── field_meta driven labels */

/**
 * A group's label / help / unit: the translated string when this build has one, otherwise the
 * server's own English.
 *
 * The fallback is the point. `field_meta` is authored in the backend, so a group added there
 * (or a reworded help string) reaches the admin immediately instead of rendering blank until
 * the frontend catches up. Known groups still read in the admin's own language.
 */
function useMetaText(meta: FieldMeta) {
  const t = useTranslations("rankings");
  return useCallback(
    (group: string, field: "label" | "help" | "unit"): string => {
      const key = `admin.scoringConfig.meta.${group}.${field}`;
      if (t.has(key)) return t(key);
      return (meta?.[group]?.[field] as string) ?? "";
    },
    [meta, t],
  );
}

/** "cap_ratio" -> "Cap ratio". The last-resort label for a key no translation covers. */
function humanize(key: string): string {
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/* ─────────────────────────────────────────────────────── group container */

function GroupCard({
  icon, title, help, unit, helpId, issues, action, className, children,
}: {
  icon: React.ReactNode; title: string; help: string; unit?: string;
  helpId?: HelpId; issues: Issue[]; action?: React.ReactNode;
  className?: string; children: React.ReactNode;
}) {
  const t = useTranslations("rankings");
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;
  return (
    <Card className={className}>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <span className="text-primary">{icon}</span>
              {title}
              {helpId && <InfoTip id={helpId} />}
              <IssueCount
                issues={issues}
                errorLabel={t("admin.scoringConfig.errorCount", { count: errors })}
                warningLabel={t("admin.scoringConfig.warningCount", { count: warnings })}
              />
            </CardTitle>
            <p className="text-xs text-muted-foreground">{help}</p>
            {unit && (
              <p className="text-[11px] text-muted-foreground">
                {t("admin.scoringConfig.measuredIn", { unit })}
              </p>
            )}
          </div>
          {action}
        </div>
        <IssueList issues={issues} />
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** "Add row" button, one shape for every list on the page. */
function AddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" className="h-8" onClick={onClick}>
      <IconPlus className="mr-1 size-3.5" /> {label}
    </Button>
  );
}

/* ──────────────────────────────────────────────────── bracket (band) table */

/**
 * One lookup scale: kills, placement, prize money or followers.
 *
 * The engine reads these top down and takes the FIRST band the value fits, so both the order
 * and the open top band are load-bearing. Bands can be added, removed, reordered and flipped
 * open here; anything that makes the table unreadable is reported inline by the backend
 * against the offending row rather than silently corrected.
 */
function BracketTable({
  group, rows, baseRows, meta, issues, onChange,
}: {
  group: string; rows: Bracket[]; baseRows: Bracket[] | undefined;
  meta: FieldMeta; issues: Issue[];
  onChange: (rows: Bracket[]) => void;
}) {
  const t = useTranslations("rankings");
  const prefix = currencyPrefix(meta?.[group]?.currency);

  const addBand = () => {
    const openLast = rows.length > 0 && rows[rows.length - 1].max === null;
    // Seed the new bound just above the highest finite one, so a fresh band is reachable
    // instead of instantly triggering the "this band can never be selected" warning.
    const finite = rows.map((r) => r.max).filter((m): m is number => m !== null);
    const seed = finite.length ? Math.max(...finite) + 1 : 0;
    const band: Bracket = { max: seed, points: 0 };
    // A band added below the open top band could never be reached, so it goes above it.
    onChange(openLast ? [...rows.slice(0, -1), band, rows[rows.length - 1]] : [...rows, band]);
  };

  return (
    <div className="space-y-2">
      {/* The table scrolls inside its own container (components/ui/table.tsx wraps every table
          in overflow-x-auto), so a phone never scrolls the whole page sideways. */}
      <div className="rounded-md border">
        <Table className="min-w-[380px]">
          <TableHeader>
            <TableRow>
              <TableHead className="text-foreground">
                {t("admin.scoringConfig.colUpTo")}
                {prefix && <span className="ml-1 text-muted-foreground">({prefix})</span>}
              </TableHead>
              <TableHead className="w-[120px] text-foreground">
                {t("admin.scoringConfig.colPoints")}
              </TableHead>
              <TableHead className="w-[110px] text-right text-foreground">
                {t("admin.scoringConfig.colActions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const path = `${group}[${i}]`;
              const rowIssues = issuesUnder(issues, path);
              const base = baseRows?.[i];
              const open = row.max === null;
              return (
                <React.Fragment key={`${group}-${i}`}>
                  <TableRow className={cn(rowIssues.some((x) => x.severity === "error") && "bg-destructive/5")}>
                    <TableCell className="p-2">
                      <div className="flex items-center gap-1">
                        {open ? (
                          <span className="inline-flex h-8 flex-1 items-center gap-1 rounded-md border border-dashed px-2 text-[11px] text-muted-foreground">
                            <IconInfinity className="size-3.5" />
                            {t("admin.scoringConfig.noUpperLimit")}
                          </span>
                        ) : (
                          <NumberBox
                            className="flex-1"
                            value={row.max}
                            prefix={prefix}
                            dirty={base ? base.max !== row.max : true}
                            invalid={issuesUnder(issues, `${path}.max`).some((x) => x.severity === "error")}
                            ariaLabel={t("admin.scoringConfig.colUpTo")}
                            onChange={(v) => onChange(replaceAt(rows, i, { max: v ?? 0 }))}
                          />
                        )}
                        <Button
                          type="button" variant="ghost" size="icon" className="size-7 shrink-0"
                          title={open
                            ? t("admin.scoringConfig.setUpperLimit")
                            : t("admin.scoringConfig.makeOpenEnded")}
                          aria-label={open
                            ? t("admin.scoringConfig.setUpperLimit")
                            : t("admin.scoringConfig.makeOpenEnded")}
                          onClick={() => onChange(replaceAt(rows, i, {
                            max: open ? Math.max(0, ...rows.map((r) => r.max ?? 0)) + 1 : null,
                          }))}
                        >
                          <IconInfinity className={cn("size-3.5", open ? "text-primary" : "text-muted-foreground")} />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="p-2">
                      <NumberBox
                        value={row.points}
                        dirty={base ? base.points !== row.points : true}
                        invalid={issuesUnder(issues, `${path}.points`).some((x) => x.severity === "error")}
                        ariaLabel={t("admin.scoringConfig.colPoints")}
                        onChange={(v) => onChange(replaceAt(rows, i, { points: v ?? 0 }))}
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <RowControls
                        canUp={i > 0} canDown={i < rows.length - 1}
                        onUp={() => onChange(move(rows, i, -1))}
                        onDown={() => onChange(move(rows, i, 1))}
                        onRemove={() => onChange(removeAt(rows, i))}
                        removeDisabledReason={rows.length <= 1
                          ? t("admin.scoringConfig.cannotRemoveLastBand") : undefined}
                        upLabel={t("admin.scoringConfig.rowUp")}
                        downLabel={t("admin.scoringConfig.rowDown")}
                        removeLabel={t("admin.scoringConfig.rowRemove")}
                      />
                    </TableCell>
                  </TableRow>
                  {rowIssues.length > 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={3} className="px-2 pb-2 pt-0">
                        <IssueList issues={rowIssues} />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <AddRowButton label={t("admin.scoringConfig.addBand")} onClick={addBand} />
    </div>
  );
}

/* ──────────────────────────────────────────── scalar group (named numbers) */

/**
 * A group of named numbers with no list structure: the scrim rules, the player weights, the
 * participation floors.
 *
 * The fields are read off the OBJECT rather than a hardcoded list, so a key added backend-side
 * appears here on its own. Labels prefer a translation and fall back to the humanized key, so
 * a brand-new key is readable rather than blank.
 */
function ScalarGroup({
  group, values, baseValues, issues, onChange, columns = "sm:grid-cols-3",
}: {
  group: string; values: Record<string, number>; baseValues: Record<string, number> | undefined;
  issues: Issue[]; onChange: (values: Record<string, number>) => void; columns?: string;
}) {
  const t = useTranslations("rankings");
  return (
    <div className={cn("grid grid-cols-2 gap-3", columns)}>
      {Object.keys(values ?? {}).map((key) => {
        const path = `${group}.${key}`;
        const fieldIssues = issuesUnder(issues, path);
        const labelKey = `admin.scoringConfig.fields.${group}.${key}`;
        const label = t.has(labelKey) ? t(labelKey) : humanize(key);
        return (
          <div key={key} className="space-y-1">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {label}
              {baseValues?.[key] !== values[key] && (
                <span className="inline-block size-1.5 rounded-full bg-orange-500"
                  aria-label={t("admin.scoringConfig.changedDot")} />
              )}
            </Label>
            <NumberBox
              value={values[key]}
              step={Number.isInteger(values[key]) ? 1 : 0.1}
              dirty={baseValues?.[key] !== values[key]}
              invalid={fieldIssues.some((x) => x.severity === "error")}
              ariaLabel={label}
              onChange={(v) => onChange({ ...values, [key]: v ?? 0 })}
            />
            <IssueList issues={fieldIssues} />
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── page */

export default function ScoringConfigPage() {
  const t = useTranslations("rankings");

  // The server blob, edited in place. `baseline` is the last loaded/saved copy and is what the
  // orange "changed" highlighting measures against.
  const [cfg, setCfg] = useState<ScoringBlob | null>(null);
  const [baseline, setBaseline] = useState<ScoringBlob | null>(null);
  const [meta, setMeta] = useState<FieldMeta>({});
  const [seasons, setSeasons] = useState<SeasonScope[]>([]);
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [currentSeasonId, setCurrentSeasonId] = useState<number | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveOpen, setSaveOpen] = useState(false);
  const [activeVersion, setActiveVersion] = useState("-");
  const [lastEdited, setLastEdited] = useState("-");
  const [lastEditedBy, setLastEditedBy] = useState("-");

  const metaText = useMetaText(meta);

  // Tier keys that ALREADY EXIST in the saved config. A tier in here has events stored against
  // it, so it may be retired but never deleted (see the file header).
  const savedTierKeys = useMemo(
    () => new Set((baseline?.tiers ?? []).map((row) => row.key)),
    [baseline],
  );

  const dirtyCount = useMemo(
    () => (cfg && baseline ? countLeafDiffs(cfg, baseline) : 0),
    [cfg, baseline],
  );

  /* ── load ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rankingsAdminApi.scoringConfig();
      const blob = res?.config as ScoringBlob;
      setCfg(clone(blob));
      setBaseline(clone(blob));
      setMeta((res?.field_meta ?? {}) as FieldMeta);
      setVersions((res?.versions ?? []) as ConfigVersion[]);
      setSeasons((res?.seasons ?? []) as SeasonScope[]);
      setCurrentSeasonId(res?.current_season_id ?? null);
      setIssues(toIssues([], res?.contradictions));
      setActiveVersion(
        res?.is_default || res?.version == null
          ? t("admin.scoringConfig.defaultsLabel")
          : `v${res.version}`,
      );
      setLastEdited(res?.created_at ? String(res.created_at).slice(0, 10) : "-");
      setLastEditedBy(res?.created_by ?? (res?.is_default
        ? t("admin.scoringConfig.shippedDefaults") : "-"));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("admin.scoringConfig.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  /* ── the dry run behind the inline warnings ──
   * Debounced so typing a threshold does not fire a request per keystroke. It writes nothing;
   * it is the same check the save runs, which is what lets a problem appear against the row
   * that caused it instead of only at the moment of saving. */
  useEffect(() => {
    if (!cfg) return;
    const timer = setTimeout(async () => {
      try {
        const res = await rankingsAdminApi.validateScoringConfig({ config: cfg });
        setIssues(toIssues(res?.errors, res?.contradictions));
      } catch {
        // A failed check must not wipe the warnings already on screen: keep the last answer.
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [cfg]);

  /* ── mutation helper: clone, mutate, set ── */
  const update = useCallback((fn: (draft: ScoringBlob) => void) => {
    setCfg((prev) => {
      if (!prev) return prev;
      const next = clone(prev);
      fn(next);
      return next;
    });
  }, []);

  const resetDefaults = async () => {
    try {
      const res = await rankingsAdminApi.scoringDefaults();
      setCfg(clone(res?.config as ScoringBlob));
      setMeta((res?.field_meta ?? {}) as FieldMeta);
      toast.info(t("admin.scoringConfig.defaultsStaged"));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("admin.scoringConfig.defaultsFailed"));
    }
  };

  const loadVersion = async (version: number) => {
    try {
      const res = await rankingsAdminApi.scoringConfigVersion(version);
      setCfg(clone(res?.config as ScoringBlob));
      toast.info(t("admin.scoringConfig.versionStaged", { version }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("admin.scoringConfig.versionFailed"));
    }
  };

  const discard = () => { if (baseline) setCfg(clone(baseline)); };

  if (loading || !cfg) return <FullLoader text={t("admin.scoringConfig.loading")} />;

  /* ── ranking tiers: mode, live column, labels ── */
  const thresholds = cfg.tier_thresholds ?? { brackets: [], default_tier: 0, labels: {} };
  const modes = meta?.tier_thresholds?.modes ?? [];
  const activeMode = modes.find((m) => m.value === (thresholds.mode ?? modes[0]?.value))
    ?? modes[0]
    ?? { value: "threshold", label: "", column: "min", help: "" };
  const scoreColumnLive = activeMode.column === "min";

  const tierLabel = (tierInt: number) =>
    thresholds.labels?.[String(tierInt)] ?? t("admin.scoringConfig.unnamedTier", { tier: tierInt });

  // Every tier number the config knows about: the labelled ones, the cutoff rows, the default.
  const knownTierInts = Array.from(new Set([
    ...Object.keys(thresholds.labels ?? {}).map(Number),
    ...(thresholds.brackets ?? []).map((b) => b.tier),
    thresholds.default_tier,
  ].filter((n) => Number.isFinite(n)))).sort((a, b) => a - b);

  const setThresholds = (patch: Partial<ScoringBlob["tier_thresholds"]>) =>
    update((d) => { d.tier_thresholds = { ...d.tier_thresholds, ...patch }; });

  const setBrackets = (rows: ThresholdRow[]) => setThresholds({ brackets: rows });

  const addRankTier = () => {
    // A brand-new tier number, so it can never be confused with one already stored on results.
    const nextInt = (knownTierInts.length ? Math.max(...knownTierInts) : -1) + 1;
    const lowest = (thresholds.brackets ?? []).reduce(
      (min, b) => Math.min(min, Number(b.min) || 0), Number.POSITIVE_INFINITY);
    update((d) => {
      d.tier_thresholds.brackets = [
        ...(d.tier_thresholds.brackets ?? []),
        {
          min: Number.isFinite(lowest) ? Math.max(0, Math.floor(lowest / 2)) : 0,
          tier: nextInt,
          count: null,
        },
      ];
      // A cutoff whose tier has no name is refused by validation, so the name is created with it.
      d.tier_thresholds.labels = {
        ...(d.tier_thresholds.labels ?? {}),
        [String(nextInt)]: t("admin.scoringConfig.newTierName", { tier: nextInt + 1 }),
      };
    });
  };

  /* ── tournament tiers ── */
  const addTournamentTier = () => {
    // Keys are permanent identifiers stored on Event.tournament_tier, so a new one must not
    // collide with any key that has ever existed, retired ones included.
    const used = new Set((cfg.tiers ?? []).map((row) => row.key));
    let n = (cfg.tiers ?? []).length + 1;
    while (used.has(`tier_${n}`)) n += 1;
    update((d) => {
      d.tiers = [...(d.tiers ?? []), {
        key: `tier_${n}`,
        label: t("admin.scoringConfig.newTierName", { tier: n }),
        multiplier: 1,
        win_bonus: 0,
        retired: false,
      }];
    });
  };

  /* ── placement points ── */
  const placementRows = Object.keys(cfg.placement_points ?? {})
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  const setPlacementPoints = (position: number, points: number) =>
    update((d) => { d.placement_points = { ...d.placement_points, [String(position)]: points }; });

  const renamePlacementPosition = (from: number, to: number) => {
    if (!Number.isFinite(to) || to === from) return;
    if (Object.prototype.hasOwnProperty.call(cfg.placement_points ?? {}, String(to))) {
      toast.error(t("admin.scoringConfig.positionTaken", { position: to }));
      return;
    }
    update((d) => {
      const next: Record<string, number> = {};
      Object.entries(d.placement_points).forEach(([key, value]) => {
        next[key === String(from) ? String(to) : key] = value as number;
      });
      d.placement_points = next;
    });
  };

  const removePlacementPosition = (position: number) =>
    update((d) => {
      const next = { ...d.placement_points };
      delete next[String(position)];
      d.placement_points = next;
    });

  const addPlacementPosition = () => {
    const next = placementRows.length ? Math.max(...placementRows) + 1 : 1;
    setPlacementPoints(next, 0);
  };

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.length - errorCount;

  return (
    <div className="space-y-4">
      <PageHeader
        back
        title={
          <span data-tour="scoring-config-title" className="inline-flex items-center">
            {t("admin.scoringConfig.title")}
            <InfoTip id="rankings.scoring._page" className="ml-1.5" />
          </span>
        }
        description={t("admin.scoringConfig.description")}
        action={
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <div className="flex items-center gap-1">
              <Button data-tour="scoring-config-reset" variant="outline"
                className="w-full sm:w-auto" onClick={resetDefaults}>
                <IconRotateClockwise2 className="mr-1.5 size-4" />
                {t("admin.scoringConfig.resetDefaults")}
              </Button>
              <InfoTip id="rankings.scoring.reset_defaults" />
            </div>
            <div className="flex items-center gap-1">
              <Button data-tour="scoring-config-save" className="w-full sm:w-auto"
                onClick={() => setSaveOpen(true)} disabled={dirtyCount === 0}>
                <IconDeviceFloppy className="mr-1.5 size-4" />
                {t("admin.scoringConfig.saveChanges")}
                {dirtyCount > 0 && (
                  <Badge variant="outline"
                    className="ml-1 rounded-full border-background/40 bg-background/20 px-1.5 py-0 text-[10px] tabular-nums">
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
        <StatCard anchor="scoring-config-version" icon={<IconAdjustmentsBolt className="size-4" />}
          title={t("admin.scoringConfig.statVersion")} value={activeVersion}
          sub={t("admin.scoringConfig.statVersionSub")} tone="text-primary" />
        <StatCard icon={<IconHistory className="size-4" />}
          title={t("admin.scoringConfig.statLastEdited")} value={lastEdited}
          sub={t("admin.scoringConfig.statLastEditedBy", { user: lastEditedBy })} />
        <StatCard anchor="scoring-config-unsaved" icon={<IconAlertTriangle className="size-4" />}
          title={t("admin.scoringConfig.statUnsaved")} value={dirtyCount}
          sub={dirtyCount > 0
            ? t("admin.scoringConfig.statUnsavedSub")
            : t("admin.scoringConfig.statInSync")}
          tone={dirtyCount > 0 ? "text-orange-500" : "text-green-500"} />
        <StatCard icon={<IconStack2 className="size-4" />}
          title={t("admin.scoringConfig.statProblems")}
          value={errorCount + warningCount}
          sub={t("admin.scoringConfig.statProblemsSub", { errors: errorCount, warnings: warningCount })}
          tone={errorCount > 0 ? "text-destructive" : warningCount > 0 ? "text-orange-500" : "text-green-500"} />
      </div>

      {/* explainer */}
      <p className="flex items-start gap-2 rounded-md border border-blue-600/20 bg-blue-500/5 p-3 text-xs text-muted-foreground">
        <IconInfoCircle className="mt-0.5 size-4 shrink-0 text-blue-400" />
        <span>{t("admin.scoringConfig.explainer")}</span>
      </p>

      <div data-tour="scoring-config-scales" className="grid grid-cols-1 gap-4 xl:grid-cols-2">

        {/* ── tournament tiers: multiplier + win bonus per tier, renameable, retirable ── */}
        <GroupCard
          className="xl:col-span-2"
          icon={<IconTargetArrow className="size-4" />}
          title={metaText("tiers", "label")}
          help={metaText("tiers", "help")}
          helpId="rankings.scoring.tier_multipliers._section"
          issues={issuesAt(issues, "tiers")}
          action={<AddRowButton label={t("admin.scoringConfig.addTournamentTier")} onClick={addTournamentTier} />}
        >
          <div className="rounded-md border">
            <Table className="min-w-[680px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">{t("admin.scoringConfig.colTierName")}</TableHead>
                  <TableHead className="w-[140px] text-foreground">{t("admin.scoringConfig.colTierKey")}</TableHead>
                  <TableHead className="w-[110px] text-foreground">{t("admin.scoringConfig.colMultiplier")}</TableHead>
                  <TableHead className="w-[110px] text-foreground">{t("admin.scoringConfig.colWinBonus")}</TableHead>
                  <TableHead className="w-[130px] text-foreground">{t("admin.scoringConfig.colActive")}</TableHead>
                  <TableHead className="w-[110px] text-right text-foreground">{t("admin.scoringConfig.colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(cfg.tiers ?? []).map((row: TierRow, i: number) => {
                  const path = `tiers[${i}]`;
                  const rowIssues = issuesUnder(issues, path);
                  const base = baseline?.tiers?.[i];
                  const isSaved = savedTierKeys.has(row.key);
                  return (
                    <React.Fragment key={`tier-${i}`}>
                      <TableRow className={cn(row.retired && "opacity-60")}>
                        <TableCell className="p-2">
                          <TextBox
                            value={row.label}
                            dirty={base ? base.label !== row.label : true}
                            ariaLabel={t("admin.scoringConfig.colTierName")}
                            onChange={(v) => update((d) => { d.tiers = replaceAt(d.tiers, i, { label: v }); })}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          {/* The key is what every Event row stores. Renaming it would orphan
                              those events, so it is fixed once saved and only editable while
                              the tier is new. */}
                          <TextBox
                            mono
                            value={row.key}
                            disabled={isSaved}
                            dirty={base ? base.key !== row.key : true}
                            ariaLabel={t("admin.scoringConfig.colTierKey")}
                            onChange={(v) => update((d) => {
                              d.tiers = replaceAt(d.tiers, i, { key: v.trim().replace(/\s+/g, "_") });
                            })}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <NumberBox
                            value={row.multiplier} step={0.1} suffix="x"
                            dirty={base ? base.multiplier !== row.multiplier : true}
                            invalid={issuesUnder(issues, `${path}.multiplier`).some((x) => x.severity === "error")}
                            ariaLabel={t("admin.scoringConfig.colMultiplier")}
                            onChange={(v) => update((d) => { d.tiers = replaceAt(d.tiers, i, { multiplier: v ?? 0 }); })}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <NumberBox
                            value={row.win_bonus}
                            dirty={base ? base.win_bonus !== row.win_bonus : true}
                            invalid={issuesUnder(issues, `${path}.win_bonus`).some((x) => x.severity === "error")}
                            ariaLabel={t("admin.scoringConfig.colWinBonus")}
                            onChange={(v) => update((d) => { d.tiers = replaceAt(d.tiers, i, { win_bonus: v ?? 0 }); })}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={!row.retired}
                              aria-label={t("admin.scoringConfig.colActive")}
                              onCheckedChange={(on) => update((d) => {
                                d.tiers = replaceAt(d.tiers, i, { retired: !on });
                              })}
                            />
                            <span className="text-[11px] text-muted-foreground">
                              {row.retired
                                ? t("admin.scoringConfig.tierRetired")
                                : t("admin.scoringConfig.tierActive")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="p-2">
                          <RowControls
                            canUp={i > 0} canDown={i < (cfg.tiers?.length ?? 0) - 1}
                            onUp={() => update((d) => { d.tiers = move(d.tiers, i, -1); })}
                            onDown={() => update((d) => { d.tiers = move(d.tiers, i, 1); })}
                            onRemove={() => update((d) => { d.tiers = removeAt(d.tiers, i); })}
                            removeDisabledReason={isSaved
                              ? t("admin.scoringConfig.tierRetireNotDelete") : undefined}
                            upLabel={t("admin.scoringConfig.rowUp")}
                            downLabel={t("admin.scoringConfig.rowDown")}
                            removeLabel={t("admin.scoringConfig.rowRemove")}
                          />
                        </TableCell>
                      </TableRow>
                      {rowIssues.length > 0 && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={6} className="px-2 pb-2 pt-0">
                            <IssueList issues={rowIssues} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t("admin.scoringConfig.tiersFootnote")}
          </p>
        </GroupCard>

        {/* ── ranking tiers: the mode picker plus both columns ── */}
        <GroupCard
          className="xl:col-span-2"
          icon={<IconStack2 className="size-4" />}
          title={metaText("tier_thresholds", "label")}
          help={metaText("tier_thresholds", "help")}
          unit={metaText("tier_thresholds", "unit")}
          helpId="rankings.scoring.thresholds._section"
          issues={issuesAt(issues, "tier_thresholds")}
          action={<AddRowButton label={t("admin.scoringConfig.addRankingTier")} onClick={addRankTier} />}
        >
          {/* Mode picker, built from field_meta.tier_thresholds.modes: the frontend never
              hardcodes which modes exist or what they are called. */}
          {modes.length > 0 && (
            <div className="mb-3 flex flex-col gap-2 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <Label className="text-xs text-muted-foreground">
                  {t("admin.scoringConfig.tierModeLabel")}
                </Label>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t.has(`admin.scoringConfig.modes.${activeMode.value}.help`)
                    ? t(`admin.scoringConfig.modes.${activeMode.value}.help`)
                    : activeMode.help}
                </p>
              </div>
              <Select value={activeMode.value} onValueChange={(v) => setThresholds({ mode: v })}>
                <SelectTrigger className="h-9 w-full sm:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {modes.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {t.has(`admin.scoringConfig.modes.${m.value}.label`)
                        ? t(`admin.scoringConfig.modes.${m.value}.label`)
                        : m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="rounded-md border">
            <Table className="min-w-[660px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">{t("admin.scoringConfig.colTierName")}</TableHead>
                  <TableHead className="w-[110px] text-foreground">{t("admin.scoringConfig.colTierNumber")}</TableHead>
                  <TableHead className={cn("w-[150px]", scoreColumnLive ? "text-foreground" : "text-muted-foreground")}>
                    {t("admin.scoringConfig.colMinScore")}
                    {!scoreColumnLive && (
                      <span className="ml-1 text-[10px]">({t("admin.scoringConfig.dormant")})</span>
                    )}
                  </TableHead>
                  <TableHead className={cn("w-[150px]", scoreColumnLive ? "text-muted-foreground" : "text-foreground")}>
                    {t("admin.scoringConfig.colTopN")}
                    {scoreColumnLive && (
                      <span className="ml-1 text-[10px]">({t("admin.scoringConfig.dormant")})</span>
                    )}
                  </TableHead>
                  <TableHead className="w-[110px] text-right text-foreground">{t("admin.scoringConfig.colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(thresholds.brackets ?? []).map((row: ThresholdRow, i: number) => {
                  const path = `tier_thresholds.brackets[${i}]`;
                  const rowIssues = issuesUnder(issues, path);
                  const base = baseline?.tier_thresholds?.brackets?.[i];
                  return (
                    <React.Fragment key={`cut-${i}`}>
                      <TableRow>
                        <TableCell className="p-2">
                          <TextBox
                            value={thresholds.labels?.[String(row.tier)] ?? ""}
                            placeholder={t("admin.scoringConfig.unnamedTier", { tier: row.tier })}
                            dirty={baseline?.tier_thresholds?.labels?.[String(row.tier)]
                              !== thresholds.labels?.[String(row.tier)]}
                            ariaLabel={t("admin.scoringConfig.colTierName")}
                            onChange={(v) => update((d) => {
                              d.tier_thresholds.labels = {
                                ...(d.tier_thresholds.labels ?? {}), [String(row.tier)]: v,
                              };
                            })}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <NumberBox
                            value={row.tier}
                            dirty={base ? base.tier !== row.tier : true}
                            invalid={issuesUnder(issues, `${path}.tier`).some((x) => x.severity === "error")}
                            ariaLabel={t("admin.scoringConfig.colTierNumber")}
                            onChange={(v) => setBrackets(replaceAt(thresholds.brackets, i, { tier: v ?? 0 }))}
                          />
                        </TableCell>
                        {/* Both columns are ALWAYS rendered. The one the mode does not read is
                            greyed rather than hidden, because hiding it reads as data loss and
                            the numbers are in fact still saved. */}
                        <TableCell className="p-2">
                          <NumberBox
                            value={row.min}
                            dormant={!scoreColumnLive}
                            dirty={base ? base.min !== row.min : true}
                            invalid={issuesUnder(issues, `${path}.min`).some((x) => x.severity === "error")}
                            ariaLabel={t("admin.scoringConfig.colMinScore")}
                            onChange={(v) => setBrackets(replaceAt(thresholds.brackets, i, { min: v ?? 0 }))}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <NumberBox
                            value={row.count ?? null}
                            dormant={scoreColumnLive}
                            placeholder={t("admin.scoringConfig.notSet")}
                            dirty={base ? (base.count ?? null) !== (row.count ?? null) : true}
                            invalid={issuesUnder(issues, `${path}.count`).some((x) => x.severity === "error")}
                            ariaLabel={t("admin.scoringConfig.colTopN")}
                            onChange={(v) => setBrackets(replaceAt(thresholds.brackets, i, { count: v }))}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <RowControls
                            canUp={i > 0} canDown={i < (thresholds.brackets?.length ?? 0) - 1}
                            onUp={() => setBrackets(move(thresholds.brackets, i, -1))}
                            onDown={() => setBrackets(move(thresholds.brackets, i, 1))}
                            onRemove={() => setBrackets(removeAt(thresholds.brackets, i))}
                            removeDisabledReason={(thresholds.brackets?.length ?? 0) <= 1
                              ? t("admin.scoringConfig.cannotRemoveLastTier") : undefined}
                            upLabel={t("admin.scoringConfig.rowUp")}
                            downLabel={t("admin.scoringConfig.rowDown")}
                            removeLabel={t("admin.scoringConfig.rowRemove")}
                          />
                        </TableCell>
                      </TableRow>
                      {rowIssues.length > 0 && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={5} className="px-2 pb-2 pt-0">
                            <IssueList issues={rowIssues} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
                {/* the fall-through tier: everyone below every cutoff */}
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableCell className="p-2">
                    <TextBox
                      value={thresholds.labels?.[String(thresholds.default_tier)] ?? ""}
                      placeholder={t("admin.scoringConfig.unnamedTier", { tier: thresholds.default_tier })}
                      dirty={baseline?.tier_thresholds?.labels?.[String(thresholds.default_tier)]
                        !== thresholds.labels?.[String(thresholds.default_tier)]}
                      ariaLabel={t("admin.scoringConfig.colTierName")}
                      onChange={(v) => update((d) => {
                        d.tier_thresholds.labels = {
                          ...(d.tier_thresholds.labels ?? {}),
                          [String(d.tier_thresholds.default_tier)]: v,
                        };
                      })}
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <Select
                      value={String(thresholds.default_tier)}
                      onValueChange={(v) => setThresholds({ default_tier: Number(v) })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {knownTierInts.map((n) => (
                          <SelectItem key={n} value={String(n)}>{n} · {tierLabel(n)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell colSpan={3} className="p-2 text-[11px] text-muted-foreground">
                    {t("admin.scoringConfig.defaultTierHelp")}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <IssueList className="mt-2" issues={issuesUnder(issues, "tier_thresholds.default_tier")} />
        </GroupCard>

        {/* ── placement points ── */}
        <GroupCard
          icon={<IconStairsUp className="size-4" />}
          title={metaText("placement_points", "label")}
          help={metaText("placement_points", "help")}
          unit={metaText("placement_points", "unit")}
          helpId="rankings.scoring.placement_points._section"
          issues={issuesAt(issues, "placement_points")}
          action={<AddRowButton label={t("admin.scoringConfig.addPosition")} onClick={addPlacementPosition} />}
        >
          <div className="rounded-md border">
            <Table className="min-w-[340px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">{t("admin.scoringConfig.colPosition")}</TableHead>
                  <TableHead className="w-[120px] text-foreground">{t("admin.scoringConfig.colPoints")}</TableHead>
                  <TableHead className="w-[70px] text-right text-foreground">{t("admin.scoringConfig.colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {placementRows.map((position) => {
                  const path = `placement_points.${position}`;
                  const rowIssues = issuesUnder(issues, path);
                  const value = cfg.placement_points[String(position)];
                  const baseValue = baseline?.placement_points?.[String(position)];
                  return (
                    <React.Fragment key={`pos-${position}`}>
                      <TableRow>
                        <TableCell className="p-2">
                          <NumberBox
                            value={position} min={1}
                            dirty={baseValue === undefined}
                            invalid={rowIssues.some((x) => x.severity === "error")}
                            ariaLabel={t("admin.scoringConfig.colPosition")}
                            onChange={(v) => renamePlacementPosition(position, v ?? position)}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <NumberBox
                            value={value}
                            dirty={baseValue !== value}
                            ariaLabel={t("admin.scoringConfig.colPoints")}
                            onChange={(v) => setPlacementPoints(position, v ?? 0)}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <RowControls
                            canUp={false} canDown={false}
                            onRemove={() => removePlacementPosition(position)}
                            removeDisabledReason={placementRows.length <= 1
                              ? t("admin.scoringConfig.cannotRemoveLastPosition") : undefined}
                            upLabel={t("admin.scoringConfig.rowUp")}
                            downLabel={t("admin.scoringConfig.rowDown")}
                            removeLabel={t("admin.scoringConfig.rowRemove")}
                          />
                        </TableCell>
                      </TableRow>
                      {rowIssues.length > 0 && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={3} className="px-2 pb-2 pt-0">
                            <IssueList issues={rowIssues} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t("admin.scoringConfig.placementFootnote")}
          </p>
        </GroupCard>

        {/* ── finals base ── */}
        <GroupCard
          icon={<IconTrophy className="size-4" />}
          title={metaText("finals_base", "label")}
          help={metaText("finals_base", "help")}
          helpId="rankings.scoring.win_bonus._section"
          issues={issuesUnder(issues, "finals_base")}
        >
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{metaText("finals_base", "label")}</Label>
              <NumberBox
                value={cfg.finals_base}
                dirty={baseline?.finals_base !== cfg.finals_base}
                ariaLabel={metaText("finals_base", "label")}
                onChange={(v) => update((d) => { d.finals_base = v ?? 0; })}
              />
            </div>
            <p className="flex items-center gap-1.5 pb-2 text-[11px] text-muted-foreground">
              <IconFlag className="size-3.5 text-primary" />
              {t("admin.scoringConfig.finalsExample", {
                multiplier: cfg.tiers?.[0]?.multiplier ?? 1,
                tier: cfg.tiers?.[0]?.label ?? "",
                points: ((cfg.finals_base ?? 0) * (cfg.tiers?.[0]?.multiplier ?? 1)).toFixed(1),
              })}
            </p>
          </div>
        </GroupCard>

        {/* ── the four lookup scales ── */}
        <GroupCard
          icon={<IconSkull className="size-4" />}
          title={metaText("kill_compression", "label")}
          help={metaText("kill_compression", "help")}
          unit={metaText("kill_compression", "unit")}
          helpId="rankings.scoring.kill_scale._section"
          issues={issuesAt(issues, "kill_compression")}
        >
          <BracketTable group="kill_compression" rows={cfg.kill_compression}
            baseRows={baseline?.kill_compression} meta={meta} issues={issues}
            onChange={(rows) => update((d) => { d.kill_compression = rows; })} />
        </GroupCard>

        <GroupCard
          icon={<IconStairsUp className="size-4" />}
          title={metaText("placement_compression", "label")}
          help={metaText("placement_compression", "help")}
          unit={metaText("placement_compression", "unit")}
          helpId="rankings.scoring.placement_scale._section"
          issues={issuesAt(issues, "placement_compression")}
        >
          <BracketTable group="placement_compression" rows={cfg.placement_compression}
            baseRows={baseline?.placement_compression} meta={meta} issues={issues}
            onChange={(rows) => update((d) => { d.placement_compression = rows; })} />
        </GroupCard>

        <GroupCard
          icon={<IconCoin className="size-4" />}
          title={metaText("prize_money_points", "label")}
          help={metaText("prize_money_points", "help")}
          unit={metaText("prize_money_points", "unit")}
          helpId="rankings.scoring.prize_scale._section"
          issues={issuesAt(issues, "prize_money_points")}
        >
          <BracketTable group="prize_money_points" rows={cfg.prize_money_points}
            baseRows={baseline?.prize_money_points} meta={meta} issues={issues}
            onChange={(rows) => update((d) => { d.prize_money_points = rows; })} />
        </GroupCard>

        <GroupCard
          icon={<IconBrandInstagram className="size-4" />}
          title={metaText("social_media_points", "label")}
          help={metaText("social_media_points", "help")}
          unit={metaText("social_media_points", "unit")}
          helpId="rankings.scoring.social_scale._section"
          issues={issuesAt(issues, "social_media_points")}
        >
          <BracketTable group="social_media_points" rows={cfg.social_media_points}
            baseRows={baseline?.social_media_points} meta={meta} issues={issues}
            onChange={(rows) => update((d) => { d.social_media_points = rows; })} />
        </GroupCard>

        {/* ── the named-number groups ── */}
        <GroupCard
          icon={<IconSwords className="size-4" />}
          title={metaText("scrim", "label")}
          help={metaText("scrim", "help")}
          helpId="rankings.scoring.scrim._section"
          issues={issuesAt(issues, "scrim")}
        >
          <ScalarGroup group="scrim" values={cfg.scrim} baseValues={baseline?.scrim}
            issues={issues} onChange={(v) => update((d) => { d.scrim = v; })} />
        </GroupCard>

        <GroupCard
          icon={<IconUsersGroup className="size-4" />}
          title={metaText("participation_floors", "label")}
          help={metaText("participation_floors", "help")}
          unit={metaText("participation_floors", "unit")}
          issues={issuesAt(issues, "participation_floors")}
        >
          <ScalarGroup group="participation_floors" values={cfg.participation_floors}
            baseValues={baseline?.participation_floors} issues={issues}
            columns="sm:grid-cols-2"
            onChange={(v) => update((d) => { d.participation_floors = v; })} />
        </GroupCard>

        <GroupCard
          className="xl:col-span-2"
          icon={<IconUser className="size-4" />}
          title={metaText("player_weights", "label")}
          help={metaText("player_weights", "help")}
          helpId="rankings.scoring.player_weights._section"
          issues={issuesAt(issues, "player_weights")}
        >
          <ScalarGroup group="player_weights" values={cfg.player_weights}
            baseValues={baseline?.player_weights} issues={issues}
            columns="sm:grid-cols-3 lg:grid-cols-6"
            onChange={(v) => update((d) => { d.player_weights = v; })} />
        </GroupCard>

        {/* ── version history ── */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="text-primary"><IconHistory className="size-4" /></span>
              {t("admin.scoringConfig.historyTitle")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t("admin.scoringConfig.historyHelp")}</p>
          </CardHeader>
          <CardContent>
            {versions.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                {t("admin.scoringConfig.historyEmpty")}
              </p>
            ) : (
              <div className="rounded-md border">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[90px] text-foreground">{t("admin.scoringConfig.colVersion")}</TableHead>
                      <TableHead className="text-foreground">{t("admin.scoringConfig.colReason")}</TableHead>
                      <TableHead className="w-[140px] text-foreground">{t("admin.scoringConfig.colSavedBy")}</TableHead>
                      <TableHead className="w-[120px] text-foreground">{t("admin.scoringConfig.colSeasonsBound")}</TableHead>
                      <TableHead className="w-[90px] text-right text-foreground">{t("admin.scoringConfig.colActions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="p-2 font-medium tabular-nums">
                          v{v.version}
                          {v.is_active && (
                            <Badge variant="outline"
                              className="ml-1 rounded-full border-primary/50 px-1.5 py-0 text-[10px] text-primary">
                              {t("admin.scoringConfig.badgeActive")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="p-2 text-xs text-muted-foreground">{v.note}</TableCell>
                        <TableCell className="p-2 text-xs text-muted-foreground">
                          {v.created_by ?? "-"}
                          <span className="block text-[10px]">{v.created_at.slice(0, 10)}</span>
                        </TableCell>
                        <TableCell className="p-2 text-xs tabular-nums text-muted-foreground">
                          {t("admin.scoringConfig.seasonsBound", { count: v.seasons_bound })}
                        </TableCell>
                        <TableCell className="p-2 text-right">
                          <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]"
                            onClick={() => loadVersion(v.version)}>
                            {t("admin.scoringConfig.loadVersion")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* dirty footer */}
      {dirtyCount > 0 && (
        <div className="flex flex-col items-start justify-between gap-2 rounded-md border border-orange-500/30 bg-orange-500/5 p-3 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <IconAlertTriangle className="size-4 shrink-0 text-orange-500" />
            <span>{t("admin.scoringConfig.dirtyFooter", { count: dirtyCount, version: activeVersion })}</span>
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={discard}>
              <IconRotateClockwise2 className="mr-1.5 size-3.5" />
              {t("admin.scoringConfig.discard")}
            </Button>
            <Button size="sm" onClick={() => setSaveOpen(true)}>
              <IconDeviceFloppy className="mr-1.5 size-3.5" />
              {t("admin.scoringConfig.saveChanges")}
            </Button>
          </div>
        </div>
      )}

      <SaveConfigDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        config={cfg}
        seasons={seasons}
        currentSeasonId={currentSeasonId}
        activeVersion={activeVersion}
        dirtyCount={dirtyCount}
        onSaved={load}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────── status tile */

// `anchor` attaches the scoring-config tour's data-tour marker to the card root without an
// extra wrapper element (which would break the responsive grid).
function StatCard({ icon, title, value, sub, tone, anchor }: {
  icon: React.ReactNode; title: string; value: React.ReactNode; sub?: string;
  tone?: string; anchor?: string;
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
