"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DndContext, KeyboardSensor, MouseSensor, TouchSensor,
  closestCenter, useSensor, useSensors,
  type DragEndEvent, type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
// i18n: every visible string on this page comes from messages/{en,fr,pt}/rankings.json under
// rankings.admin.tournamentTiers. The shared "Tier N" label lives one level up (rankings.tier)
// because components/rankings/TierBadge already renders it there, so both surfaces agree.
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/PageHeader";
// The self-expiring NEW tag on the scrims switch: dated, so it disappears on its own five days
// after the split went live rather than waiting for somebody to remember to delete it.
import { NewBadge } from "@/components/NewBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  IconStack2, IconGripVertical, IconPlus, IconX, IconTrash, IconArrowRight,
  IconDeviceFloppy, IconInfoCircle, IconFlask, IconRestore, IconAlertTriangle, IconCopy,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FullLoader } from "@/components/Loader";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import { InfoTip } from "@/components/ui/info-tip";
// Currency on a prize threshold (owner 2026-08-07). AFC_CURRENCIES is the platform's ONE currency
// menu - the same list the prize-pool and registration-fee forms offer, kept identical to its
// backend twin afc_auth/currencies.py by a test. Never hand-roll a currency array here.
import { AFC_CURRENCIES } from "@/lib/currencies";
import { useCurrency } from "@/contexts/CurrencyContext";
import { convertMoney } from "@/lib/money";
// Backend-reported problems are rendered with the SAME primitives the Scoring Config editor
// uses (orange pill in the header, orange message row under it). Both pages report the output
// of the same checker - afc_rankings/scoring/validation.py - so they must not grow two
// different ways of saying "the server thinks this config does not do what it looks like".
import {
  IssueCount, IssueList, issuesAt, issuesUnder, toIssues, type Issue,
} from "../scoring-config/_components/editor-primitives";

/**
 * Tournament Tiers - wired to the Phase-2 admin API (afc_rankings/admin_tournament_tiers.py).
 * Admins build a prioritised, drag-to-reorder list of classification rules.
 * A tournament is evaluated top-down; the FIRST rule it matches sets its tier.
 * Tier drives the scoring multiplier (Tier 1 = 2.0×, Tier 2 = 1.5×, Tier 3 = 1.0×).
 *
 * Data layer:
 *   • Load     - rankingsAdminApi.tierRules() → { results: [serialize_tier_rule], pagination, default_tier }
 *   • Classify - rankingsAdminApi.classifyTournament({prize,teams,players,format}) → { tier, matched_rule_id }
 *   • Save     - diffs local rules vs the loaded server snapshot, then dispatches the real
 *                create / update / delete / reorder / default-tier writes (each reason-gated),
 *                and re-fetches. The dialog reason (>= 10 chars) is the audit reason for the batch.
 *
 * Server rule.id is an integer; we keep a local string id for DnD/React keys and carry the
 * server id alongside (serverId). Conditions come back as {field, op, value} with no id - we
 * mint a local numeric id per condition for stable React keys / edit targeting.
 *
 * Contradictions: the list response AND every write response carry a `contradictions` array
 * (see the CONTRADICTIONS note in admin_tournament_tiers.py). They are advisory - the backend
 * saves either way - so they surface as a banner plus a per-rule marker, never as a blocker.
 *
 * Currency (owner 2026-08-07): a PRIZE threshold carries the currency it is written in, but the
 * comparison always happens in naira - the backend converts both the rule's threshold and the
 * event's pool before comparing (afc_rankings/scoring/currency.py). Two things follow for this
 * page, and both are deliberate:
 *   • a threshold in any currency other than naira shows its naira equivalent underneath, because
 *     a list of bars in mixed currencies is otherwise impossible to read in priority order;
 *   • that equivalent is labelled as today's rate and carries the drift warning, because the
 *     conversion happens at CLASSIFICATION time, so the same rule can match a different set of
 *     events next month with nobody having edited it. A naira threshold is fixed and says so by
 *     showing no rate line at all.
 * Rates come from CurrencyContext (GET /auth/fx-rates/), which is served out of the same FxRate
 * table the backend classifier reads, so the preview and the real comparison agree.
 */

type Tier = 1 | 2 | 3;

/**
 * The two rule sets (owner 2026-08-16: "there should be a place we control rules for scrims like we
 * do for tournaments"). A scrim and a tournament are not the same competition, so one list of rules
 * could only ever be right for one of them. Matches EventTierRule.COMPETITION_CHOICES on the
 * backend; "tournament" is the default at BOTH ends, which is what keeps every rule written before
 * the split meaning exactly what it always did.
 */
type Competition = "tournament" | "scrims";
const COMPETITIONS: Competition[] = ["tournament", "scrims"];
// "How the room was set up" fields (owner 2026-08-16). Each is a yes/no read from the room
// settings saved against the event, so they share one pair of operators.
type RoomFlagField = "weapon_skins" | "blue_zone" | "unlimited_ammo";
type Field = "prize" | "teams" | "players" | "format" | RoomFlagField;
type Op = "gte" | "lte" | "is_lan" | "is_virtual" | "is_on" | "is_off";
type Condition = {
  id: number;
  field: Field;
  op: Op;
  value: number;
  /** ISO code the threshold is WRITTEN in. Prize only; always set for prize (the server
   *  normalizes an omitted currency to NGN, which is what a legacy rule already meant). */
  currency: string;
  /** The server's own naira figure for this threshold at the rate it last read. Used only as the
   *  fallback while CurrencyContext is still fetching, so the rate line never renders blank. */
  valueNgn: number | null;
};
type Rule = {
  id: string;            // local id for DnD / React keys (server id stringified, or "new-…" for unsaved)
  serverId: number | null; // backing EventTierRule.id, or null if not yet persisted
  match: "all" | "any";
  conditions: Condition[];
  tier: Tier;
  enabled: boolean;
};

// Tier presentation. The visible LABEL is deliberately NOT stored here: it is resolved at render
// from the shared rankings namespace via t("tier", { tier }) - the same key components/rankings/
// TierBadge uses - so "Tier 1" becomes "Niveau 1" / "Nível 1" from a single source.
const TIER_META: Record<Tier, { mult: string; cls: string }> = {
  1: { mult: "2.0×", cls: "text-amber-400 border-amber-500/60" },
  2: { mult: "1.5×", cls: "text-green-400 border-green-600/60" },
  3: { mult: "1.0×", cls: "text-blue-400 border-blue-600/60" },
};

// Condition builder vocabulary. These are module-level (they never change), so they carry a
// message KEY rather than an English string; SortableRule resolves each one through its own
// translator. English source values live in messages/en/rankings.json.
const FIELDS: { value: Field; labelKey: string; numeric: boolean }[] = [
  { value: "prize", labelKey: "fields.prize", numeric: true },
  { value: "teams", labelKey: "fields.teams", numeric: true },
  { value: "players", labelKey: "fields.players", numeric: true },
  { value: "format", labelKey: "fields.format", numeric: false },
  // Read from the room settings saved on the event. A rule using one of these does NOT fire for an
  // event whose room was never filled in, which is why they sit below the always-known fields.
  { value: "weapon_skins", labelKey: "fields.weaponSkins", numeric: false },
  { value: "blue_zone", labelKey: "fields.blueZone", numeric: false },
  { value: "unlimited_ammo", labelKey: "fields.unlimitedAmmo", numeric: false },
];
const ROOM_FLAG_FIELDS: Field[] = ["weapon_skins", "blue_zone", "unlimited_ammo"];
const isRoomFlag = (f: Field) => ROOM_FLAG_FIELDS.includes(f);
const NUMERIC_OPS: { value: Op; labelKey: string }[] = [
  { value: "gte", labelKey: "ops.gte" },
  { value: "lte", labelKey: "ops.lte" },
];
const FORMAT_OPS: { value: Op; labelKey: string }[] = [
  { value: "is_lan", labelKey: "ops.isLan" },
  { value: "is_virtual", labelKey: "ops.isVirtual" },
];
const ROOM_FLAG_OPS: { value: Op; labelKey: string }[] = [
  { value: "is_on", labelKey: "ops.isOn" },
  { value: "is_off", labelKey: "ops.isOff" },
];
const isNumeric = (f: Field) => f !== "format" && !isRoomFlag(f);
const ngn = (n: number) => "₦" + Math.round(n).toLocaleString();

// The currency every prize threshold is COMPARED in, whatever it was authored in. Mirrors
// afc_rankings/scoring/currency.BASE_CURRENCY; the list response echoes it as `base_currency`.
const BASE_CURRENCY = "NGN";
// A brand new prize condition starts in naira, so adding a condition never silently changes the
// currency an admin was last working in and never depends on FX data to mean something.
const DEFAULT_PRIZE_CURRENCY = BASE_CURRENCY;

/**
 * A prize threshold restated in naira, or null when it cannot be worked out.
 *
 * Prefers the LIVE client rates so the figure tracks the amount as the admin types. Falls back to
 * the server's own `value_ngn` for a saved condition while CurrencyContext is still fetching.
 * Returns null when neither is available (no rate for that currency), which the caller renders as
 * a warning rather than a number - a threshold the backend cannot convert matches nothing at all.
 */
function thresholdInNgn(c: Condition, rates: Record<string, number>): number | null {
  const cur = (c.currency || BASE_CURRENCY).toUpperCase();
  if (cur === BASE_CURRENCY) return c.value;
  if (rates?.[cur] && rates?.[BASE_CURRENCY]) {
    return convertMoney(c.value, cur, BASE_CURRENCY, rates);
  }
  return c.valueNgn;
}

/**
 * One prize threshold written the way the admin authored it: "₦100,000" in naira, "1,000 USD" in
 * anything else.
 *
 * The naira form keeps the sign used everywhere else on this page and the site. A non-naira bar
 * prints the ISO code AFTER the number so it reads exactly like the row that produced it (amount
 * box, then currency picker) and can never be mistaken for naira. This matters because the summary
 * that uses it sits next to naira figures: printing a fixed ₦ in front of every threshold, which is
 * what this page did while naira was the only option, becomes a plain lie the moment a threshold can
 * be authored in dollars.
 *
 * Deliberately NOT lib/money.formatMoney: that renders two decimal places for a display amount,
 * while a threshold is a whole number the backend validates as an int.
 */
function thresholdText(c: Condition): string {
  const cur = (c.currency || BASE_CURRENCY).toUpperCase();
  return cur === BASE_CURRENCY ? ngn(c.value) : `${c.value.toLocaleString()} ${cur}`;
}

// Where the backend hangs a tier-rule contradiction. afc_rankings/scoring/validation.py
// addresses a problem either at the whole list ("event_tier_rules", used for a prize range no
// rule covers) or at ONE rule ("event_tier_rules[<EventTierRule.id>]", used for a rule that can
// never fire and for a rule still awarding a retired tier). Those two strings are the contract
// this page reads, so they are written once here rather than inline at each render site.
const ISSUES_ROOT = "event_tier_rules";
const rulePath = (serverId: number) => `${ISSUES_ROOT}[${serverId}]`;

let CID = 100;
const cid = () => ++CID;

// Default reason used for the batch save when nothing more specific is provided.
// NOT translated on purpose: this is never rendered here, it is a value POSTed to the audit
// endpoints and stored on the audit row, so keeping it English keeps the audit trail uniform
// and searchable no matter which language the admin who saved was using.
const DEFAULT_REASON = "Updated tournament tier classification rules via admin console.";

/** Map a server-serialized rule (serialize_tier_rule) into local Rule state. */
function fromServerRule(r: any): Rule {
  const conditions: Condition[] = Array.isArray(r.conditions)
    ? r.conditions.map((c: any) => ({
        id: cid(),
        field: c.field as Field,
        op: c.op as Op,
        value: typeof c.value === "number" ? c.value : 0,
        // The server always spells the currency out on a prize condition (it normalizes a legacy
        // rule's missing key to NGN on the way out), so the fallback here is belt and braces
        // rather than the back-compatibility path - that lives in the backend, one place.
        currency: c.field === "prize"
          ? String(c.currency || BASE_CURRENCY).toUpperCase()
          : BASE_CURRENCY,
        valueNgn: typeof c.value_ngn === "number" ? c.value_ngn : null,
      }))
    : [];
  return {
    id: String(r.id),
    serverId: r.id,
    match: r.match === "any" ? "any" : "all",
    conditions,
    tier: ([1, 2, 3].includes(r.tier) ? r.tier : 2) as Tier,
    enabled: !!r.enabled,
  };
}

/** Strip a local Rule down to the write payload the backend validates ({match, conditions, tier, enabled}).
 *
 * `currency` is sent for a PRIZE condition only. The backend refuses one on a teams/players count
 * (a count is not money), so sending it there would 400 the whole save. It is also what makes a
 * currency-only edit count as a change: ruleSignature is built from this payload, so switching a
 * threshold from naira to dollars without touching the number still dispatches an update.
 */
function toWritePayload(rule: Rule) {
  return {
    match: rule.match,
    tier: rule.tier,
    enabled: rule.enabled,
    conditions: rule.conditions.map((c) =>
      c.field === "format"
        ? { field: "format", op: c.op, value: null }
        : c.field === "prize"
          ? { field: c.field, op: c.op, value: c.value, currency: c.currency }
          : { field: c.field, op: c.op, value: c.value },
    ),
  };
}

/** Stable signature of a rule's editable content - used to detect which rules actually changed. */
function ruleSignature(rule: Rule) {
  return JSON.stringify(toWritePayload(rule));
}

function TierPill({ tier }: { tier: Tier }) {
  const m = TIER_META[tier];
  // Shared "Tier N" label (rankings namespace), identical to TierBadge everywhere else.
  const tTier = useTranslations("rankings");
  return (
    <Badge variant="outline" className={cn("rounded-full font-semibold", m.cls)}>
      {tTier("tier", { tier })} · {m.mult}
    </Badge>
  );
}

// human-readable one-liner for a condition (used in the test result + collapsed view).
// The translator is passed in rather than read from a hook because this runs inside a .map()
// in the page body (same idiom as components/h2h-bracket.tsx fmtLabel). Only the field name
// and the format phrases are words; ≥ / ≤ and the value are symbols/numbers, so they stay put.
function condText(c: Condition, t: (key: string) => string) {
  if (c.field === "format") return c.op === "is_lan" ? t("cond.lan") : t("cond.virtual");
  if (isRoomFlag(c.field)) {
    return t(`cond.${c.field === "weapon_skins" ? "weaponSkins"
      : c.field === "blue_zone" ? "blueZone" : "unlimitedAmmo"}${c.op === "is_on" ? "On" : "Off"}`);
  }
  const f = c.field === "prize" ? t("cond.prize") : c.field === "teams" ? t("cond.teams") : t("cond.players");
  // A prize threshold prints in ITS OWN currency (thresholdText), not a blanket naira sign: this
  // line explains which rule matched, so quoting "₦1,000" for a $1,000 bar would misdescribe the
  // very rule it is reporting.
  const v = c.field === "prize" ? thresholdText(c) : c.value;
  return `${f} ${c.op === "gte" ? "≥" : "≤"} ${v}`;
}

// `anchor` (optional) attaches a data-tour anchor to the card root so the tournament-tiers
// tour can target the "Active rules" status tile without an extra wrapper that would break
// the responsive grid.
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
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------- one sortable rule card */
function SortableRule({
  rule, index, matchedInTest, issues, onChange, onDelete,
}: {
  rule: Rule; index: number; matchedInTest: boolean;
  // The backend's warnings about THIS rule. Passed down already filtered so the card does not
  // need to know how a contradiction path is spelled.
  issues: Issue[];
  onChange: (next: Rule) => void; onDelete: () => void;
}) {
  const t = useTranslations("rankings.admin.tournamentTiers");
  const tTier = useTranslations("rankings");
  // Live FX, from the same table the backend classifier reads. Only used to restate a non-naira
  // threshold in naira for the admin; nothing here is sent to the server.
  const { rates } = useCurrency();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: rule.id });

  const patchCond = (cidv: number, patch: Partial<Condition>) =>
    onChange({ ...rule, conditions: rule.conditions.map((c) => (c.id === cidv ? { ...c, ...patch } : c)) });

  const setField = (cidv: number, field: Field) => {
    // switching numeric <-> format needs a compatible operator
    const op: Op = isNumeric(field) ? "gte" : isRoomFlag(field) ? "is_on" : "is_lan";
    const value = field === "prize" ? 100_000 : 0;
    // Reset to naira when a condition BECOMES a prize threshold: the number is being replaced too,
    // so carrying a currency over from whatever this row used to be would be meaningless.
    patchCond(cidv, { field, op, value, currency: DEFAULT_PRIZE_CURRENCY, valueNgn: null });
  };

  const addCond = () =>
    onChange({
      ...rule,
      conditions: [...rule.conditions, {
        id: cid(), field: "prize", op: "gte", value: 100_000,
        currency: DEFAULT_PRIZE_CURRENCY, valueNgn: null,
      }],
    });
  const removeCond = (cidv: number) =>
    onChange({ ...rule, conditions: rule.conditions.length <= 1 ? rule.conditions : rule.conditions.filter((c) => c.id !== cidv) });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-md border bg-card",
        isDragging && "z-10 opacity-80 shadow-lg",
        matchedInTest && "ring-1 ring-primary/60",
        // The whole card is tinted, not just the pill: a flagged rule has to be findable while
        // scrolling a long list, which is the part a banner alone cannot do.
        issues.length > 0 && "border-orange-500/40",
        !rule.enabled && "opacity-60",
      )}
    >
      {/* header row
          flex-wrap (2026-08-16): the row holds a drag handle, the rule number, two ⓘ, the ALL/ANY
          toggle and a warning pill before `ml-auto` pushes the enable switch and delete button
          right. On a 390px phone that added up past the viewport and put BOTH controls off-screen
          with no way to scroll to them - the page has no horizontal scroll, so they were simply
          unreachable. Wrapping drops the actions onto their own line, still right-aligned. */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <button
          {...attributes} {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label={t("a11y.dragToReorder")}
        >
          <IconGripVertical className="size-4" />
        </button>
        <Badge variant="outline" className="rounded-full text-[11px] tabular-nums">{t("ruleBadge", { n: index + 1 })}</Badge>
        {/* ⓘ on the rule index explains drag-to-prioritise + first-match-wins (sibling of the drag handle, not nested). */}
        <InfoTip id="rankings.tiers.rule_priority" />

        {/* match all / any */}
        <div className="inline-flex h-7 items-center rounded-md bg-muted p-[3px] text-xs">
          {(["all", "any"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onChange({ ...rule, match: m })}
              className={cn(
                "rounded px-2 py-0.5 font-medium transition-colors",
                rule.match === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "all" ? t("match.all") : t("match.any")}
            </button>
          ))}
        </div>
        {/* ⓘ next to the ALL/ANY switch (sibling of the toggle buttons). */}
        <InfoTip id="rankings.tiers.match_mode" />

        {matchedInTest && (
          <Badge variant="outline" className="rounded-full border-primary/50 text-[10px] text-primary">
            {t("matchesTest")}
          </Badge>
        )}

        {/* Warning pill, identical to the Scoring Config group headers. `errorLabel` is empty
            because no error can reach this page: the tier endpoints only ever return
            contradictions, so IssueCount's error branch never renders here. */}
        <IssueCount
          issues={issues}
          errorLabel=""
          warningLabel={t("issues.warningCount", { count: issues.length })}
        />

        <div className="ml-auto flex items-center gap-2">
          <Switch checked={rule.enabled} onCheckedChange={(v) => onChange({ ...rule, enabled: v })} aria-label={t("a11y.ruleEnabled")} />
          <Button
            variant="outline" size="icon"
            className="size-7 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete} aria-label={t("a11y.deleteRule")}
          >
            <IconTrash className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* conditions + result */}
      <div className="space-y-2 px-3 py-3">
        {/* The backend's own sentence, verbatim - it already names the rule that shadows this
            one, which is the only thing the admin needs in order to act. Renders nothing when
            the rule is clean. */}
        <IssueList issues={issues} />

        {rule.conditions.map((c, ci) => {
          // Naira equivalent of a non-naira bar, so a list of thresholds in mixed currencies can
          // still be read top to bottom. null = no rate for that currency, which is not cosmetic:
          // the backend fails such a condition closed, so the rule currently matches nothing.
          const inNgn = c.field === "prize" && c.currency !== BASE_CURRENCY
            ? thresholdInNgn(c, rates)
            : null;
          const unconvertible = c.field === "prize" && c.currency !== BASE_CURRENCY && inNgn === null;
          return (
          <div key={c.id} className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-10 text-[11px] uppercase text-muted-foreground">
              {ci === 0 ? t("conn.if") : rule.match === "all" ? t("conn.and") : t("conn.or")}
            </span>
            <Select value={c.field} onValueChange={(v) => setField(c.id, v as Field)}>
              <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELDS.map((f) => <SelectItem key={f.value} value={f.value}>{t(f.labelKey)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={c.op} onValueChange={(v) => patchCond(c.id, { op: v as Op })}>
              <SelectTrigger className="h-8 w-[210px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(isNumeric(c.field)
                  ? NUMERIC_OPS
                  : isRoomFlag(c.field)
                    ? ROOM_FLAG_OPS
                    : FORMAT_OPS).map((o) => (
                  <SelectItem key={o.value} value={o.value}>{t(o.labelKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isNumeric(c.field) && (
              <Input
                type="number" min={0} value={c.value}
                onChange={(e) => patchCond(c.id, { value: Math.max(0, parseInt(e.target.value || "0", 10)) })}
                className="h-8 w-32 text-xs tabular-nums"
              />
            )}
            {/* Currency sits immediately after the amount so the pair reads as one figure
                ("1000 USD"). Prize only: teams and players are counts, and the backend refuses a
                currency on either. The old fixed ₦ inside the input was removed with this - it
                would now be a lie whenever the picker says anything else. */}
            {c.field === "prize" && (
              <Select
                value={c.currency}
                onValueChange={(v) => patchCond(c.id, { currency: v, valueNgn: null })}
              >
                <SelectTrigger className="h-8 w-[104px] text-xs" aria-label={t("a11y.thresholdCurrency")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AFC_CURRENCIES.map((cur) => (
                    <SelectItem key={cur.code} value={cur.code} className="text-xs">
                      {cur.code} · {cur.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="ghost" size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              disabled={rule.conditions.length <= 1}
              onClick={() => removeCond(c.id)} aria-label={t("a11y.removeCondition")}
            >
              <IconX className="size-3.5" />
            </Button>
          </div>
          {/* Rate line. Shown ONLY for a non-naira threshold, so a naira rule visibly carries no
              exchange-rate risk rather than the admin having to infer it. */}
          {c.field === "prize" && c.currency !== BASE_CURRENCY && (
            <p className={cn(
              "pl-12 text-[11px]",
              unconvertible ? "text-orange-400" : "text-muted-foreground",
            )}>
              {unconvertible
                ? t("currency.noRate", { currency: c.currency })
                : t("currency.approxNgn", { ngn: ngn(inNgn as number) })}
            </p>
          )}
          </div>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={addCond}>
            <IconPlus className="mr-1 size-3.5" /> {t("addCondition")}
          </Button>
          <div className="flex items-center gap-2">
            <IconArrowRight className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t("classifyAs")}</span>
            <Select value={String(rule.tier)} onValueChange={(v) => onChange({ ...rule, tier: Number(v) as Tier })}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {/* the map param is renamed off `t` so it does not shadow the translator */}
                {([1, 2, 3] as Tier[]).map((tier) => (
                  <SelectItem key={tier} value={String(tier)}>{tTier("tier", { tier })} · {TIER_META[tier].mult}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------- page */
export default function TournamentTiersPage() {
  const t = useTranslations("rankings.admin.tournamentTiers");
  const tTier = useTranslations("rankings");
  // ── which rule set is on screen (owner 2026-08-16) ──────────────────────────────────────────
  // Tournaments and scrims keep separate rules, and the two never see each other: a scrims rule
  // cannot classify a tournament, cannot shadow a tournament rule, and does not appear in the
  // tournament contradiction report. This ONE piece of state decides which set every read and every
  // write on this page addresses, which is why it is passed explicitly on each call rather than
  // relying on the server default - a write that silently landed in the other set would not show up
  // until an event was tiered wrongly.
  const [competition, setCompetition] = useState<Competition>("tournament");
  const [rules, setRules] = useState<Rule[]>([]);
  const [defaultTier, setDefaultTier] = useState<Tier>(3);
  // True while the empty scrims set is being seeded from the tournament rules.
  const [copying, setCopying] = useState(false);
  // Has the page loaded ONCE? Switching sets re-fetches, and the whole-page loader below would
  // otherwise replace the switch with a spinner the instant it is pressed - so the control the
  // admin just used vanishes under their finger, which on a phone reads as a mis-tap. The spinner
  // is for arriving at the page; a switch keeps the page and dims the part that is changing.
  const loadedOnce = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [reason, setReason] = useState("");
  // Contradictions the backend computed for the SAVED rule set. Always warning severity here:
  // the tier endpoints report, they never refuse (admin_tournament_tiers.py, CONTRADICTIONS).
  const [issues, setIssues] = useState<Issue[]>([]);

  // The last server snapshot - used to diff on save (what to create/update/delete/reorder)
  // and to revert on Reset. Holds the priority-ordered server rules + the server default tier.
  const snapshotRef = useRef<{ rules: Rule[]; defaultTier: Tier }>({ rules: [], defaultTier: 3 });

  // test tournament (the live classifier sample)
  // `prizeCurrency` is the currency the sample POOL is typed in, defaulting to naira so the panel
  // behaves exactly as it always did until someone touches the picker. It exists because an admin
  // thinking in dollars should be able to type a pool the way an organizer enters it instead of
  // pre-converting in their head. The backend converts it with the SAME FxRate map and formula the
  // real classifier applies to Event.prize_currency, so the preview cannot disagree with the tier
  // the event will actually be given.
  const [test, setTest] = useState({
    prize: 500_000, teams: 18, players: 72,
    format: "lan" as "lan" | "virtual",
    prizeCurrency: BASE_CURRENCY,
  });
  // Server classifier result for the current sample. `prizeNgn` is the naira figure the rules were
  // actually compared against, so the panel can show the number the rules saw and not only the one
  // that was typed; `converted` is false for a naira pool, where the two are the same.
  const [result, setResult] = useState<{
    tier: Tier; ruleId: string | null; prizeNgn: number | null; converted: boolean;
  }>({ tier: 3, ruleId: null, prizeNgn: null, converted: false });
  // Set when the sample pool cannot be converted (no FX row for the picked currency). The panel is
  // non-blocking, but it must not keep displaying the PREVIOUS tier as if it answered the sample now
  // on screen, so the tier is hidden while this is set.
  const [testError, setTestError] = useState<string | null>(null);

  // The rule the last test matched, or undefined once it has been deleted or its id changed.
  // Derived rather than stored, so it cannot go stale on its own, and it is the ONLY place the
  // matched rule is looked up: the panel below used to repeat this find() three times with a
  // non-null assertion on each, which is what crashed the page when the rule was removed.
  const matchedRule = result.ruleId
    ? rules.find((r) => r.id === result.ruleId)
    : undefined;

  const sortableId = useId();
  const sensors = useSensors(useSensor(MouseSensor, {}), useSensor(TouchSensor, {}), useSensor(KeyboardSensor, {}));
  const ids = useMemo<UniqueIdentifier[]>(() => rules.map((r) => r.id), [rules]);

  // ── load (mount) ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rankingsAdminApi.tierRules(competition);
      const loaded: Rule[] = (res?.results ?? []).map(fromServerRule);
      const dt = ([1, 2, 3].includes(res?.default_tier) ? res.default_tier : 3) as Tier;
      setRules(loaded);
      setDefaultTier(dt);
      // Set from the response rather than merged, so a fixed rule clears its warning.
      setIssues(toIssues([], res?.contradictions));
      // deep-clone for the diff/revert baseline so later edits don't mutate the snapshot
      snapshotRef.current = {
        rules: loaded.map((r) => ({ ...r, conditions: r.conditions.map((c) => ({ ...c })) })),
        defaultTier: dt,
      };
      setDirty(false);
      loadedOnce.current = true;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("loadFailed"));
      // A failed switch has still "arrived": showing the full-page spinner forever would hide the
      // switch that could take them back to a set that does load.
      loadedOnce.current = true;
    } finally {
      setLoading(false);
    }
    // `competition` IS a real dependency: switching sets has to re-fetch, or the page would show
    // one set's rules while writing to the other. `t` stays out for the same reason as elsewhere
    // here (fresh identity every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competition]);

  useEffect(() => { load(); }, [load]);

  /**
   * Refresh the warnings from any response that carries them.
   *
   * Every tier-rule write (create / update / retire / reorder / default tier) returns the
   * freshly recomputed `contradictions`, so the banner follows each write as it lands instead
   * of waiting for the next page load. A response without the key leaves the banner alone: a
   * failure mid-batch must not read as "all clear".
   */
  const absorbContradictions = (res: any) => {
    if (Array.isArray(res?.contradictions)) setIssues(toIssues([], res.contradictions));
  };

  // ── live classifier (server dry-run, debounced) ───────────────────────────
  useEffect(() => {
    if (loading) return;
    const handle = setTimeout(() => {
      rankingsAdminApi
        .classifyTournament({
          prize: test.prize, teams: test.teams, players: test.players, format: test.format,
          // Omitted means naira server-side, but it is sent explicitly so the request says what it
          // means and the preview never depends on a default agreeing at both ends.
          prize_currency: test.prizeCurrency,
          // Same set the page is showing. Previewing a scrim sample against tournament rules would
          // answer confidently about the wrong table.
          competition_type: competition,
        })
        .then((r: any) => {
          const tier = ([1, 2, 3].includes(r?.tier) ? r.tier : defaultTier) as Tier;
          const matched = r?.matched_rule_id != null
            ? rules.find((x) => x.serverId === r.matched_rule_id)?.id ?? null
            : null;
          setResult({
            tier, ruleId: matched,
            prizeNgn: typeof r?.prize_ngn === "number" ? r.prize_ngn : null,
            converted: Boolean(r?.prize_converted),
          });
          setTestError(null);
        })
        .catch((err: any) => {
          // A 400 here is the reachable case: the picked currency has no exchange rate, so the
          // backend refuses rather than previewing a tier off a pool it could not convert. Say so
          // instead of leaving the last answer on screen looking like the answer to this sample.
          // Any other failure (network, auth) keeps the previous result: the panel is non-blocking.
          if (err?.response?.status === 400) {
            setTestError(err?.response?.data?.message
              || t("test.convertFailed", { currency: test.prizeCurrency }));
          }
        });
    }, 300);
    return () => clearTimeout(handle);
    // `t` is left out on purpose: the translator is a fresh function identity on every render, so
    // listing it would re-arm the 300ms debounce on each render instead of only when the sample
    // changes. It is only read inside the catch, for a fallback message. Same reasoning as the
    // exhaustive-deps exemption on `load` above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test, rules, defaultTier, loading, competition]);

  const mutate = (next: Rule[]) => { setRules(next); setDirty(true); };

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (active && over && active.id !== over.id) {
      mutate(arrayMove(rules, ids.indexOf(active.id), ids.indexOf(over.id)));
    }
  }

  // param renamed off `t` so it does not shadow the translator
  const perTier = (tier: Tier) => rules.filter((r) => r.tier === tier && r.enabled).length;

  // Does any threshold sit in a currency other than naira? If so the rule set now moves with the
  // exchange rate, and the admin has to be told - the conversion happens when an EVENT IS
  // CLASSIFIED, not when the rule is written, so the same untouched rule can match a different set
  // of events next month. The backend states the same fact in its `fx_note` for API consumers
  // (_FX_NOTE in admin_tournament_tiers.py); this page renders the translated twin because the
  // admin dashboard is localised and that field is English only. Keep the two in step.
  //
  // Computed from LOCAL rules, not the saved snapshot, so it appears the instant an admin picks a
  // foreign currency rather than only after they save - which is the moment the warning is useful.
  const usesForeignCurrency = useMemo(
    () => rules.some((r) => r.conditions.some(
      (c) => c.field === "prize" && (c.currency || BASE_CURRENCY) !== BASE_CURRENCY)),
    [rules],
  );

  const addRule = () => mutate([...rules, {
    id: `new-${Date.now()}`, serverId: null, match: "all", tier: 2, enabled: true,
    // Same starting shape a new CONDITION gets (see addCond): naira, no server-side naira figure
    // yet. Both fields are required - without them the currency picker renders with nothing
    // selected and the rate line treats the bar as foreign, so a plain naira rule would open
    // claiming it needed converting.
    conditions: [{
      id: cid(), field: "prize", op: "gte", value: 100_000,
      currency: DEFAULT_PRIZE_CURRENCY, valueNgn: null,
    }],
  }]);

  // ── seed an empty set from the other one ──────────────────────────────────
  // Only reachable from the empty state. A set with no rules classifies NOTHING, so every event of
  // that kind falls through to the default tier - copying the tournament rules across is the
  // starting point that makes scrims behave as they did before they had their own rules. One-way
  // and one-time: the backend refuses a set that already has rules, so this cannot resync or
  // duplicate later (admin_tournament_tiers.copy_rule_set).
  const seedFromTournaments = async () => {
    setCopying(true);
    try {
      const res = await rankingsAdminApi.copyTierRules({
        competition_type: competition,
        source: "tournament",
        reason: DEFAULT_REASON,
      });
      toast.success(t("competition.copied", { count: res?.copied ?? 0 }));
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("competition.copyFailed"));
    } finally {
      setCopying(false);
    }
  };

  // ── reset → revert to the last loaded server snapshot ─────────────────────
  const reset = () => {
    const snap = snapshotRef.current;
    setRules(snap.rules.map((r) => ({ ...r, conditions: r.conditions.map((c) => ({ ...c })) })));
    setDefaultTier(snap.defaultTier);
    setDirty(false);
    toast.info(t("resetDone"));
  };

  // ── save → diff local state vs the server snapshot, dispatch the real writes ───
  const confirmSave = async () => {
    const auditReason = reason.trim().length >= 10 ? reason.trim() : DEFAULT_REASON;
    setSaving(true);
    try {
      const snap = snapshotRef.current;
      const snapById = new Map(snap.rules.filter((r) => r.serverId != null).map((r) => [r.serverId as number, r]));
      const liveServerIds = new Set(rules.filter((r) => r.serverId != null).map((r) => r.serverId as number));

      // Each write echoes the recomputed contradictions; absorbing them keeps the warnings
      // current step by step, so a batch that fails halfway still leaves an honest banner.
      // 1) DELETE - rules that existed on the server but were removed locally
      for (const old of snap.rules) {
        if (old.serverId != null && !liveServerIds.has(old.serverId)) {
          absorbContradictions(await rankingsAdminApi.deleteTierRule(old.serverId, { reason: auditReason }));
        }
      }

      // 2) UPDATE existing rules whose content changed; CREATE new (unsaved) rules.
      for (const r of rules) {
        if (r.serverId == null) {
          absorbContradictions(await rankingsAdminApi.createTierRule({ ...toWritePayload(r), competition_type: competition, reason: auditReason }));
        } else {
          const prev = snapById.get(r.serverId);
          if (!prev || ruleSignature(prev) !== ruleSignature(r)) {
            absorbContradictions(await rankingsAdminApi.updateTierRule(r.serverId, { ...toWritePayload(r), reason: auditReason }));
          }
        }
      }

      // 3) DEFAULT TIER - only if changed.
      if (defaultTier !== snap.defaultTier) {
        absorbContradictions(await rankingsAdminApi.updateTierConfig({ default_tier: defaultTier, competition_type: competition, reason: auditReason }));
      }

      // 4) REORDER - re-fetch first to learn the ids of any rules we just created, then send
      //    the full priority order matching the current on-screen sequence.
      const fresh = await rankingsAdminApi.tierRules(competition);
      absorbContradictions(fresh);
      const freshRules: Rule[] = (fresh?.results ?? []).map(fromServerRule);
      if (freshRules.length > 1) {
        // Build the desired order from the on-screen list, matching freshly-created rules by
        // content signature (they had no serverId locally) and existing rules by serverId.
        const usedFreshIds = new Set<number>();
        const desiredOrder: number[] = [];
        for (const r of rules) {
          let fr: Rule | undefined;
          if (r.serverId != null) {
            fr = freshRules.find((f) => f.serverId === r.serverId && !usedFreshIds.has(f.serverId!));
          }
          if (!fr) {
            const sig = ruleSignature(r);
            fr = freshRules.find((f) => f.serverId != null && !usedFreshIds.has(f.serverId!) && ruleSignature(f) === sig);
          }
          if (fr?.serverId != null) {
            usedFreshIds.add(fr.serverId);
            desiredOrder.push(fr.serverId);
          }
        }
        // Append any server rules we couldn't map (defensive - keeps the id set complete).
        for (const f of freshRules) {
          if (f.serverId != null && !usedFreshIds.has(f.serverId)) {
            usedFreshIds.add(f.serverId);
            desiredOrder.push(f.serverId);
          }
        }
        const currentOrder = freshRules.map((f) => f.serverId).filter((v): v is number => v != null);
        const orderChanged = desiredOrder.length === currentOrder.length
          && desiredOrder.some((v, i) => v !== currentOrder[i]);
        if (orderChanged) {
          // Reordering is the write most likely to CREATE or CLEAR an unreachable rule, since
          // shadowing depends entirely on which rule is checked first.
          absorbContradictions(await rankingsAdminApi.reorderTierRules({ order: desiredOrder, competition_type: competition, reason: auditReason }));
        }
      }

      toast.success(t("saveSuccess"));
      setSaveOpen(false);
      setReason("");
      await load(); // re-sync state + snapshot with the server's canonical order
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("saveFailed"));
      // refresh so the UI reflects whatever did persist before the failure
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading && !loadedOnce.current) return <FullLoader text={t("loading")} />;

  return (
    <div className="space-y-4">
      <PageHeader
        back
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        // data-tour anchor: tournament-tiers tour "Tournament Tiers classification" step.
        title={
          <span data-tour="tournament-tiers-title" className="inline-flex flex-wrap items-center">
            {t("title")}
            <InfoTip id="rankings.tiers._page" className="ml-1.5" />
          </span>
        }
        description={t("description")}
        action={
          // Each action ⓘ is a SIBLING of its button (not nested) - Reset reverts, Save commits the rule set.
          <div className="flex w-full gap-2 md:w-auto">
            <div className="flex flex-1 items-center gap-1 md:flex-none">
              <Button variant="outline" className="flex-1 md:flex-none" onClick={reset} disabled={saving}>
                <IconRestore className="mr-1.5 size-4" /> {t("reset")}
              </Button>
              <InfoTip id="rankings.tiers.reset" />
            </div>
            <div className="flex flex-1 items-center gap-1 md:flex-none">
              {/* data-tour anchor: tournament-tiers tour "Save all changes" step. */}
              <Button data-tour="tournament-tiers-save" className="flex-1 md:flex-none" disabled={!dirty || saving} onClick={() => { setReason(""); setSaveOpen(true); }}>
                <IconDeviceFloppy className="mr-1.5 size-4" /> {t("saveRules")}{dirty ? " *" : ""}
              </Button>
              <InfoTip id="rankings.tiers.save" />
            </div>
          </div>
        }
      />

      {/* ── which set of rules ── (owner 2026-08-16)
          Two independent rule sets on one page rather than two pages: the editor, the warnings and
          the test panel are identical for both, and a second page would be the same 1,100 lines
          maintained twice. The switch is the FIRST thing under the title because everything below
          it - every rule, the default tier, the test result - belongs to the set it selects, and a
          control placed lower would be read after the thing it governs.

          Disabled while there are unsaved edits: switching re-fetches, which would throw those
          edits away without asking. Saying so beats silently discarding them. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex h-9 items-center rounded-md bg-muted p-1">
          {COMPETITIONS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCompetition(value)}
              disabled={dirty || saving || loading}
              aria-pressed={competition === value}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sm px-3 py-1 text-xs font-medium transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-60",
                competition === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`competition.${value}`)}
              {value === "scrims" && <NewBadge since="2026-08-16" />}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {dirty ? t("competition.saveFirst") : t(`competition.hint.${competition}`)}
        </span>
      </div>

      {/* status strip */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4">
        {/* data-tour anchor: tournament-tiers tour "Rule count" step. */}
        <StatCard anchor="tournament-tiers-stats" icon={<IconStack2 className="size-4" />} title={t("stats.activeRules")}
          value={rules.filter((r) => r.enabled).length} sub={t("stats.activeRulesSub", { count: rules.length })} />
        <StatCard icon={<span className="text-xs font-bold">2.0×</span>} title={t("stats.tierRules", { tier: 1 })}
          value={perTier(1)} sub={t("stats.tier1Sub")} tone="text-amber-400" />
        <StatCard icon={<span className="text-xs font-bold">1.5×</span>} title={t("stats.tierRules", { tier: 2 })}
          value={perTier(2)} sub={t("stats.tier2Sub")} tone="text-green-400" />
        <StatCard icon={<span className="text-xs font-bold">1.0×</span>} title={t("stats.defaultTier")}
          value={tTier("tier", { tier: defaultTier })} sub={t("stats.defaultTierSub")} tone="text-blue-400" />
      </div>

      <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        <IconInfoCircle className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          {/* t.rich keeps the two emphasised fragments inline (the "first match wins" lead and the
              Scoring Config page name) so each language can place them where its grammar wants. */}
          {t.rich("explainer", {
            b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
            cfg: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
          })}
        </span>
      </div>

      {/* FX drift disclosure. Shown ONLY once a threshold is in a foreign currency, so a naira-only
          rule set stays uncluttered and, more importantly, so the absence of this box is itself
          honest information: naira thresholds carry no exchange-rate risk at all.
          Amber, not the orange used by the contradiction banner below - this is a consequence of a
          choice the admin made, not a problem with their rules. */}
      {usesForeignCurrency && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          <IconInfoCircle className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <span>
            <span className="font-semibold text-amber-300">{t("currency.fxNoteTitle")}</span>{" "}
            {t("currency.fxNote")}
          </span>
        </div>
      )}

      {/* Contradiction banner. WARNING ONLY, never a blocker: the backend saves either way, and
          an admin mid-edit can legitimately have two overlapping rules on screen for a moment.
          It summarises, then defers - a problem belonging to one rule is printed on that rule's
          card instead of here, so nobody has to count rows to find it. */}
      {issues.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-orange-500/40 bg-orange-500/5 p-3">
          <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-400" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold text-orange-300">{t("issues.title")}</p>
            <p className="text-xs text-muted-foreground">{t("issues.summary", { count: issues.length })}</p>
            {/* The warnings describe what is SAVED. Say so while there are unsaved edits, or a
                stale banner reads as a verdict on what is currently on screen. */}
            {dirty && <p className="text-xs text-muted-foreground">{t("issues.savedNote")}</p>}
            {/* List-level problems only (a prize range no rule covers); these belong to no row. */}
            <IssueList className="pt-1" issues={issuesAt(issues, ISSUES_ROOT)} />
          </div>
        </div>
      )}

      <div
        className={cn(
          "grid grid-cols-1 gap-4 transition-opacity lg:grid-cols-3",
          loading && "pointer-events-none opacity-50",
        )}
        aria-busy={loading}
      >
        {/* rules list
            data-tour anchor: tournament-tiers tour "Tier rules" step. Anchors the stable
            left column (holds the drag-to-reorder rule cards, the default-tier row, and the
            add-rule button) so the highlight stays put whether or not any rules exist yet. */}
        <div data-tour="tournament-tiers-rules" className="space-y-3 lg:col-span-2">
          {rules.length === 0 ? (
            <div className="space-y-3 rounded-md border border-dashed bg-muted/20 px-3 py-10 text-center text-sm text-muted-foreground">
              <p>{t("emptyRules")}</p>
              {/* A set with no rules is not neutral - it sends EVERY event of this kind to the
                  default tier. Said plainly here, with the one-click way out, because the scrims
                  set starts empty and an admin who does not know that would read a blank list as
                  "nothing to do". */}
              {competition !== "tournament" && (
                <>
                  <p className="mx-auto max-w-md text-xs">
                    {t("competition.emptyMeaning", { tier: String(defaultTier) })}
                  </p>
                  <Button variant="outline" size="sm" disabled={copying} onClick={seedFromTournaments}>
                    <IconCopy className="mr-1.5 size-4" /> {t("competition.copyFromTournaments")}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <DndContext
              id={sortableId}
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {rules.map((r, i) => (
                    <SortableRule
                      key={r.id}
                      rule={r}
                      index={i}
                      matchedInTest={result.ruleId === r.id}
                      // Warnings are addressed by SERVER id, so a rule added on screen and not
                      // yet saved has none: the backend has not seen it to judge it.
                      issues={r.serverId == null ? [] : issuesUnder(issues, rulePath(r.serverId))}
                      onChange={(next) => mutate(rules.map((x) => (x.id === r.id ? next : x)))}
                      onDelete={() => mutate(rules.filter((x) => x.id !== r.id))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* default (pinned) */}
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed bg-muted/20 px-3 py-3">
            <Badge variant="outline" className="rounded-full text-[11px] text-muted-foreground">{t("defaultBadge")}</Badge>
            <span className="inline-flex items-center text-xs text-muted-foreground">
              {t("defaultRowText")}
              <InfoTip id="rankings.tiers.default_tier" className="ml-1" />
            </span>
            <IconArrowRight className="size-4 text-muted-foreground" />
            <Select value={String(defaultTier)} onValueChange={(v) => { setDefaultTier(Number(v) as Tier); setDirty(true); }}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {/* the map param is renamed off `t` so it does not shadow the translator */}
                {([1, 2, 3] as Tier[]).map((tier) => (
                  <SelectItem key={tier} value={String(tier)}>{tTier("tier", { tier })} · {TIER_META[tier].mult}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* data-tour anchor: tournament-tiers tour "Add a new rule" step. */}
          <Button data-tour="tournament-tiers-add" variant="outline" className="w-full border-dashed" onClick={addRule}>
            <IconPlus className="mr-1.5 size-4" /> {t("addRule")}
          </Button>
        </div>

        {/* live classifier test
            data-tour anchor: tournament-tiers tour "Test a tournament" step. */}
        <div data-tour="tournament-tiers-test" className="lg:col-span-1">
          <Card className="sticky top-4 gap-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-base">
                <IconFlask className="size-4 text-primary" /> {t("test.title")}
                <InfoTip id="rankings.tiers.test._section" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {t("test.blurb")}
              </p>
              {/* Pool + its currency, laid out like a rule's threshold row (amount, then picker) so
                  the two read the same way. The fixed ₦ that used to sit inside this input is gone
                  for the same reason it went from the rule rows: it would be wrong for any other
                  currency. */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("test.prizeLabel")}</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} value={test.prize}
                    onChange={(e) => setTest((s) => ({ ...s, prize: Math.max(0, parseInt(e.target.value || "0", 10)) }))}
                    className="h-8 min-w-0 flex-1 text-xs tabular-nums" />
                  <Select
                    value={test.prizeCurrency}
                    onValueChange={(v) => setTest((s) => ({ ...s, prizeCurrency: v }))}
                  >
                    <SelectTrigger className="h-8 w-[104px] shrink-0 text-xs" aria-label={t("test.prizeCurrencyLabel")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AFC_CURRENCIES.map((cur) => (
                        <SelectItem key={cur.code} value={cur.code} className="text-xs">
                          {cur.code} · {cur.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* The naira figure the rules were actually compared against. Only for a converted
                    pool: for a naira pool it would just repeat the number above. */}
                {result.converted && result.prizeNgn != null && !testError && (
                  <p className="text-[11px] text-muted-foreground">
                    {t("test.comparedAs", { ngn: ngn(result.prizeNgn) })}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("test.teamsLabel")}</Label>
                  <Input type="number" min={0} value={test.teams}
                    onChange={(e) => setTest((t) => ({ ...t, teams: Math.max(0, parseInt(e.target.value || "0", 10)) }))}
                    className="h-8 text-xs tabular-nums" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("test.playersLabel")}</Label>
                  <Input type="number" min={0} value={test.players}
                    onChange={(e) => setTest((t) => ({ ...t, players: Math.max(0, parseInt(e.target.value || "0", 10)) }))}
                    className="h-8 text-xs tabular-nums" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("test.formatLabel")}</Label>
                <div className="inline-flex h-8 w-full items-center rounded-md bg-muted p-[3px] text-xs">
                  {(["lan", "virtual"] as const).map((f) => (
                    <button key={f}
                      onClick={() => setTest((t) => ({ ...t, format: f }))}
                      className={cn(
                        "flex-1 rounded px-2 py-0.5 font-medium transition-colors",
                        test.format === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {f === "lan" ? t("test.formatLan") : t("test.formatVirtual")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Result. When the sample pool could not be converted there IS no answer, so the
                  tier is withheld rather than showing the previous sample's verdict next to the
                  numbers currently on screen. */}
              <div className="rounded-md border bg-muted/30 p-3">
                {testError ? (
                  <p className="text-[11px] text-orange-400">{testError}</p>
                ) : (
                <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t("test.classifiedAs")}</span>
                  <TierPill tier={result.tier} />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {/* The AND / OR joiner is a translated word, so the surrounding spaces are added
                      here rather than baked into the message (leading/trailing spaces in a
                      catalog value get lost in translation tooling). */}
                  {/* Resolved ONCE, and without a non-null assertion. `result` is a snapshot of
                      the last test run, so the rule it matched can be deleted while the result is
                      still on screen - which is exactly what happened: deleting the rule wearing
                      the "matches test" badge made this lookup return undefined, the `!` let it
                      through the compiler, and reading .conditions on undefined took the whole
                      page down with "This page couldn't load". A stale result now falls back to
                      the no-match line until the next test is run. */}
                  {matchedRule
                    ? t("test.matched", {
                        n: rules.indexOf(matchedRule) + 1,
                        conditions: matchedRule.conditions
                          .map((c) => condText(c, t))
                          .join(
                            matchedRule.match === "all"
                              ? ` ${t("test.joinAnd")} `
                              : ` ${t("test.joinOr")} `,
                          ),
                      })
                    : t("test.noMatch")}
                </p>
                </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* save (mandatory reason) */}
      <Dialog open={saveOpen} onOpenChange={(o) => { if (!o && !saving) { setSaveOpen(false); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("saveDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("saveDialog.desc")}
            </DialogDescription>
          </DialogHeader>
          {/* the two summary labels reuse the status-strip keys - same words, one source */}
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <div className="flex justify-between"><span>{t("stats.activeRules")}</span><span className="font-medium text-foreground">{rules.filter((r) => r.enabled).length}</span></div>
            <div className="mt-1 flex justify-between"><span>{t("stats.defaultTier")}</span><span className="font-medium text-foreground">{tTier("tier", { tier: defaultTier })}</span></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tt-reason">{t("saveDialog.reasonLabel")}</Label>
            <Textarea id="tt-reason" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder={t("saveDialog.reasonPlaceholder")} className="min-h-24" />
            <p className="text-[11px] text-muted-foreground">
              {reason.trim().length < 10
                ? t("saveDialog.minChars", { count: reason.trim().length, min: 10 })
                : t("saveDialog.reasonLogged")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSaveOpen(false); setReason(""); }} disabled={saving}>{t("saveDialog.cancel")}</Button>
            <Button disabled={reason.trim().length < 10 || saving} onClick={confirmSave}>
              {saving ? t("saveDialog.saving") : t("saveRules")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
