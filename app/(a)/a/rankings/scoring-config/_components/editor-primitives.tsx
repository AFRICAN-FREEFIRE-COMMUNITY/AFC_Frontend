"use client";

/**
 * Shared building blocks for the Scoring Config editor.
 *
 * WHY THIS FILE EXISTS
 *   The editor is one page made of eight structurally identical blocks: an ordered list of
 *   rows, where every row can be edited, moved, added and removed, and where the backend can
 *   attach a problem to one specific row. Rather than repeat that eight times, the row chrome
 *   (number cell, move/remove buttons, per-row problem messages) lives here and each block on
 *   page.tsx supplies only its own columns.
 *
 * HOW IT CONNECTS
 *   - Types mirror the JSON blob served by GET /rankings/scoring-config/ (backend
 *     afc_rankings/scoring/tables.py::config_from_tables). The editor holds that blob
 *     VERBATIM in state and posts it back unchanged apart from the admin's edits: the old
 *     editor mapped it through a lossy local model and silently dropped every key it did not
 *     know about, which is why tiers could not be added and the top-N sizes never survived.
 *   - `Issue` flattens the two lists the backend returns - `errors` (a save is refused) and
 *     `contradictions` (the save is allowed, the config just does not do what the author
 *     probably meant, see afc_rankings/scoring/validation.py) - into one list the UI can hang
 *     off individual rows by `path`.
 *   - Consumed only by ../page.tsx and ./SaveConfigDialog.tsx.
 *
 * i18n: this file renders NO literal English. Every label is passed in by the caller, which
 * reads it from the rankings namespace (messages/{en,fr,pt}/rankings.json, admin.scoringConfig).
 * Backend problem messages are shown verbatim, the same way every API error toast in this app is.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  IconAlertTriangle, IconChevronUp, IconChevronDown, IconTrash, IconCircleX,
} from "@tabler/icons-react";

/* ─────────────────────────────────────────────── the blob, exactly as served */

/** One band of a lookup scale. `max` null = the open top band (matches everything above). */
export type Bracket = { max: number | null; points: number };

/** One TOURNAMENT tier: the multiplier applied to an event's points, plus its flat win bonus. */
export type TierRow = {
  key: string;          // stored on Event.tournament_tier - permanent, never reused
  label: string;        // free text, renameable without touching a single event row
  multiplier: number;
  win_bonus: number;
  retired: boolean;     // hidden from new work, still resolvable for past events
};

/** One RANKING tier row: a score cutoff (score mode) and a ladder size (top-N mode). */
export type ThresholdRow = { min: number; tier: number; count: number | null };

export type ScoringBlob = {
  schema_version?: number;
  tiers: TierRow[];
  placement_points: Record<string, number>;
  kill_compression: Bracket[];
  placement_compression: Bracket[];
  finals_base: number;
  prize_money_points: Bracket[];
  social_media_points: Bracket[];
  tier_thresholds: {
    mode?: string;
    brackets: ThresholdRow[];
    default_tier: number;
    labels: Record<string, string>;
  };
  scrim: Record<string, number>;
  player_weights: Record<string, number>;
  participation_floors: Record<string, number>;
  // Anything the backend adds later rides along untouched instead of being dropped on save.
  [key: string]: any;
};

/** One entry of the `field_meta` map: what a group of numbers MEANS. */
export type FieldMetaEntry = {
  label: string;
  unit: string | null;
  currency: string | null;      // non-null = the thresholds are money IN THIS CURRENCY
  value_unit: string | null;
  help: string;
  // tier_thresholds only: the two ways the same tier rows can be read.
  modes?: { value: string; label: string; column: string; help: string }[];
};
export type FieldMeta = Record<string, FieldMetaEntry>;

/** A season row from the save-scope picker (admin_scoring_config._season_row). */
export type SeasonScope = {
  season_id: number;
  name: string;
  year: number;
  quarter: number;
  is_active: boolean;
  is_closed: boolean;
  is_frozen: boolean;
  rankings_published: boolean;
  tiers_published: boolean;
  config_version: number | null;
  config_pinned: boolean;
  in_default_scope: boolean;
};

/** A row of the version history list (admin_scoring_config._version_row). */
export type ConfigVersion = {
  id: number;
  version: number;
  is_active: boolean;
  note: string;
  created_by: string | null;
  created_at: string;
  seasons_bound: number;
};

/* ────────────────────────────────────────────────────── problems, by row */

/**
 * One problem the backend reported, flattened so the UI can hang it off a row.
 *
 * `error`   - the save is REFUSED. Something here would corrupt scoring.
 * `warning` - a contradiction. The config works, it just cannot do what it looks like it
 *             does (the owner's own example: a second tier rule that also reads "above X"
 *             can never fire). Reported, never blocking.
 */
export type Issue = {
  severity: "error" | "warning";
  path: string;
  message: string;
};

export function toIssues(errors: any[] | undefined, contradictions: any[] | undefined): Issue[] {
  return [
    ...(errors ?? []).map((e) => ({
      severity: "error" as const, path: String(e?.path ?? ""), message: String(e?.message ?? ""),
    })),
    ...(contradictions ?? []).map((c) => ({
      severity: "warning" as const, path: String(c?.path ?? ""), message: String(c?.message ?? ""),
    })),
  ];
}

/**
 * Problems belonging to `path` OR to anything inside it.
 *
 * The backend addresses a problem as precisely as it can: `kill_compression[3]` for the band,
 * `kill_compression[3].points` for the number inside it. A row asks for its own path and gets
 * both, so the message lands next to the offending row instead of in one banner at the top,
 * which is the thing the owner could not act on.
 */
export function issuesUnder(issues: Issue[], path: string): Issue[] {
  return issues.filter(
    (i) => i.path === path || i.path.startsWith(`${path}.`) || i.path.startsWith(`${path}[`),
  );
}

/** Problems reported against the GROUP itself, not against any one row inside it. */
export function issuesAt(issues: Issue[], path: string): Issue[] {
  return issues.filter((i) => i.path === path);
}

/**
 * The problem list for one row or one group.
 *
 * Errors are red, contradictions amber. Both quote the backend's own wording, which already
 * explains the consequence in plain language ("no team could ever leave the default tier"),
 * so there is nothing for the UI to add.
 */
export function IssueList({ issues, className }: { issues: Issue[]; className?: string }) {
  if (!issues.length) return null;
  return (
    <div className={cn("space-y-1", className)}>
      {issues.map((issue, i) => (
        <p
          key={`${issue.path}-${i}`}
          className={cn(
            "flex items-start gap-1.5 rounded-md border px-2 py-1 text-[11px] leading-snug",
            issue.severity === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-orange-500/40 bg-orange-500/10 text-orange-300",
          )}
        >
          {issue.severity === "error"
            ? <IconCircleX className="mt-0.5 size-3.5 shrink-0" />
            : <IconAlertTriangle className="mt-0.5 size-3.5 shrink-0" />}
          <span>{issue.message}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Small count pills for a group header, so a problem is visible even before the reader looks
 * at the rows. The labels arrive already formatted (the caller owns the plural rules), so this
 * only decides which pills to show.
 */
export function IssueCount({ issues, errorLabel, warningLabel }: {
  issues: Issue[]; errorLabel: string; warningLabel: string;
}) {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;
  if (!issues.length) return null;
  return (
    <span className="inline-flex gap-1">
      {errors > 0 && (
        <Badge variant="outline" className="rounded-full border-destructive/50 px-2 py-0 text-[10px] text-destructive">
          {errorLabel}
        </Badge>
      )}
      {warnings > 0 && (
        <Badge variant="outline" className="rounded-full border-orange-500/50 px-2 py-0 text-[10px] text-orange-300">
          {warningLabel}
        </Badge>
      )}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────── inputs */

/**
 * A number input that says three things at once: its value, whether it differs from the saved
 * config (orange), and whether the backend has a problem with it (red).
 *
 * `dormant` greys it without disabling it. That is for the tier column the current mode does
 * NOT read: hiding it would look like the numbers had been deleted when the mode is switched,
 * and they have not been - both columns are always saved.
 */
export function NumberBox({
  value, onChange, dirty, invalid, dormant, prefix, suffix, step = 1, min = 0,
  placeholder, ariaLabel, className, disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  dirty?: boolean; invalid?: boolean; dormant?: boolean; disabled?: boolean;
  prefix?: string; suffix?: string; step?: number; min?: number;
  placeholder?: string; ariaLabel?: string; className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {prefix && (
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
          {prefix}
        </span>
      )}
      <Input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        aria-label={ariaLabel}
        placeholder={placeholder}
        disabled={disabled}
        value={value === null || Number.isNaN(value) ? "" : value}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={cn(
          "h-8 text-xs tabular-nums",
          prefix && "pl-6",
          suffix && "pr-8",
          dormant && "text-muted-foreground opacity-60",
          dirty && !invalid && "border-orange-500/60 bg-orange-500/5 text-orange-300",
          invalid && "border-destructive/70 bg-destructive/10",
        )}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

/** A free-text cell, used for tier names. Same dirty/invalid vocabulary as NumberBox. */
export function TextBox({
  value, onChange, dirty, invalid, placeholder, ariaLabel, className, disabled, mono,
}: {
  value: string; onChange: (v: string) => void;
  dirty?: boolean; invalid?: boolean; disabled?: boolean; mono?: boolean;
  placeholder?: string; ariaLabel?: string; className?: string;
}) {
  return (
    <Input
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 text-xs",
        mono && "font-mono",
        dirty && !invalid && "border-orange-500/60 bg-orange-500/5 text-orange-300",
        invalid && "border-destructive/70 bg-destructive/10",
        className,
      )}
    />
  );
}

/* ────────────────────────────────────────────────────── row controls */

/**
 * Move-up / move-down / remove for one row of an ordered list.
 *
 * Buttons rather than drag-and-drop on purpose: these tables scroll horizontally inside their
 * own container on a phone, and dragging a row inside a horizontally scrolling box fights the
 * scroll gesture. Two taps always work.
 *
 * `removeDisabledReason` is what turns "you cannot delete this" into something an admin can
 * act on: a tournament tier that events are already stored against must be RETIRED, not
 * removed, or those events become unscoreable (see scoring/tables.py "retire, never delete").
 */
export function RowControls({
  onUp, onDown, onRemove, canUp, canDown, removeDisabledReason,
  upLabel, downLabel, removeLabel,
}: {
  onUp?: () => void; onDown?: () => void; onRemove?: () => void;
  canUp: boolean; canDown: boolean;
  removeDisabledReason?: string;
  upLabel: string; downLabel: string; removeLabel: string;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      {onUp && (
        <Button type="button" variant="ghost" size="icon" className="size-7"
          disabled={!canUp} onClick={onUp} aria-label={upLabel} title={upLabel}>
          <IconChevronUp className="size-3.5" />
        </Button>
      )}
      {onDown && (
        <Button type="button" variant="ghost" size="icon" className="size-7"
          disabled={!canDown} onClick={onDown} aria-label={downLabel} title={downLabel}>
          <IconChevronDown className="size-3.5" />
        </Button>
      )}
      {onRemove && (
        <Button type="button" variant="ghost" size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          disabled={Boolean(removeDisabledReason)}
          onClick={onRemove}
          aria-label={removeLabel}
          title={removeDisabledReason || removeLabel}>
          <IconTrash className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────── list operations */

/** Immutably move `index` by `delta` places. Out-of-range moves return the list unchanged. */
export function move<T>(rows: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= rows.length) return rows;
  const next = rows.slice();
  const [row] = next.splice(index, 1);
  next.splice(target, 0, row);
  return next;
}

export function replaceAt<T>(rows: T[], index: number, patch: Partial<T>): T[] {
  return rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
}

export function removeAt<T>(rows: T[], index: number): T[] {
  return rows.filter((_, i) => i !== index);
}

/**
 * Count the individual VALUES that differ between the edited config and the saved one.
 *
 * Walks both trees rather than diffing a fixed field list, so adding a tier, deleting a band
 * or renaming a label all count - which is the whole point of this rebuild. A key present on
 * one side only counts as one change (an added band with a max and a points value counts as
 * the two numbers it is, which is what an admin sees on screen).
 */
export function countLeafDiffs(a: any, b: any): number {
  if (a === b) return 0;
  const aObj = a && typeof a === "object";
  const bObj = b && typeof b === "object";
  if (!aObj || !bObj) return 1;
  if (Array.isArray(a) !== Array.isArray(b)) return 1;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let n = 0;
  keys.forEach((k) => { n += countLeafDiffs(a[k], b[k]); });
  return n;
}

/** Structured deep clone, so an edit can never reach back into the loaded baseline. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * The symbol to put in front of a money threshold.
 *
 * Money thresholds in this system are authored in NAIRA while an event's prize pool is stored
 * in the event's own currency, and rendering one as a bare number is what mis-tiered a $400
 * event (see scoring/tables.py, "CURRENCY"). So the editor never shows a money field without
 * its currency: `field_meta[group].currency` decides, and an unmapped code falls back to
 * showing the code itself rather than nothing.
 */
export function currencyPrefix(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  return ({ NGN: "₦", USD: "$", EUR: "€", GBP: "£" } as Record<string, string>)[code] ?? code;
}
