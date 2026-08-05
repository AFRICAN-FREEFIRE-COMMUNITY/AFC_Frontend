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
  IconDeviceFloppy, IconInfoCircle, IconFlask, IconRestore, IconAlertTriangle,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FullLoader } from "@/components/Loader";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import { InfoTip } from "@/components/ui/info-tip";
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
 */

type Tier = 1 | 2 | 3;
type Field = "prize" | "teams" | "players" | "format";
type Op = "gte" | "lte" | "is_lan" | "is_virtual";
type Condition = { id: number; field: Field; op: Op; value: number };
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
];
const NUMERIC_OPS: { value: Op; labelKey: string }[] = [
  { value: "gte", labelKey: "ops.gte" },
  { value: "lte", labelKey: "ops.lte" },
];
const FORMAT_OPS: { value: Op; labelKey: string }[] = [
  { value: "is_lan", labelKey: "ops.isLan" },
  { value: "is_virtual", labelKey: "ops.isVirtual" },
];
const isNumeric = (f: Field) => f !== "format";
const ngn = (n: number) => "₦" + n.toLocaleString();

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

/** Strip a local Rule down to the write payload the backend validates ({match, conditions, tier, enabled}). */
function toWritePayload(rule: Rule) {
  return {
    match: rule.match,
    tier: rule.tier,
    enabled: rule.enabled,
    conditions: rule.conditions.map((c) =>
      c.field === "format"
        ? { field: "format", op: c.op, value: null }
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
  const f = c.field === "prize" ? t("cond.prize") : c.field === "teams" ? t("cond.teams") : t("cond.players");
  const v = c.field === "prize" ? ngn(c.value) : c.value;
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: rule.id });

  const patchCond = (cidv: number, patch: Partial<Condition>) =>
    onChange({ ...rule, conditions: rule.conditions.map((c) => (c.id === cidv ? { ...c, ...patch } : c)) });

  const setField = (cidv: number, field: Field) => {
    // switching numeric <-> format needs a compatible operator
    const op: Op = isNumeric(field) ? "gte" : "is_lan";
    const value = field === "prize" ? 100_000 : 0;
    patchCond(cidv, { field, op, value });
  };

  const addCond = () =>
    onChange({ ...rule, conditions: [...rule.conditions, { id: cid(), field: "prize", op: "gte", value: 100_000 }] });
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
      {/* header row */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
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

        {rule.conditions.map((c, ci) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2">
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
                {(isNumeric(c.field) ? NUMERIC_OPS : FORMAT_OPS).map((o) => (
                  <SelectItem key={o.value} value={o.value}>{t(o.labelKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isNumeric(c.field) && (
              <div className="relative">
                {c.field === "prize" && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₦</span>
                )}
                <Input
                  type="number" min={0} value={c.value}
                  onChange={(e) => patchCond(c.id, { value: Math.max(0, parseInt(e.target.value || "0", 10)) })}
                  className={cn("h-8 w-32 text-xs tabular-nums", c.field === "prize" && "pl-5")}
                />
              </div>
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
        ))}

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
  const [rules, setRules] = useState<Rule[]>([]);
  const [defaultTier, setDefaultTier] = useState<Tier>(3);
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
  const [test, setTest] = useState({ prize: 500_000, teams: 18, players: 72, format: "lan" as "lan" | "virtual" });
  // server classifier result for the current sample: { tier, ruleId(local) }
  const [result, setResult] = useState<{ tier: Tier; ruleId: string | null }>({ tier: 3, ruleId: null });

  const sortableId = useId();
  const sensors = useSensors(useSensor(MouseSensor, {}), useSensor(TouchSensor, {}), useSensor(KeyboardSensor, {}));
  const ids = useMemo<UniqueIdentifier[]>(() => rules.map((r) => r.id), [rules]);

  // ── load (mount) ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rankingsAdminApi.tierRules();
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
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("loadFailed"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        })
        .then((r: any) => {
          const tier = ([1, 2, 3].includes(r?.tier) ? r.tier : defaultTier) as Tier;
          const matched = r?.matched_rule_id != null
            ? rules.find((x) => x.serverId === r.matched_rule_id)?.id ?? null
            : null;
          setResult({ tier, ruleId: matched });
        })
        .catch(() => {
          // keep the previous result; the test panel is non-blocking
        });
    }, 300);
    return () => clearTimeout(handle);
  }, [test, rules, defaultTier, loading]);

  const mutate = (next: Rule[]) => { setRules(next); setDirty(true); };

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (active && over && active.id !== over.id) {
      mutate(arrayMove(rules, ids.indexOf(active.id), ids.indexOf(over.id)));
    }
  }

  // param renamed off `t` so it does not shadow the translator
  const perTier = (tier: Tier) => rules.filter((r) => r.tier === tier && r.enabled).length;

  const addRule = () => mutate([...rules, {
    id: `new-${Date.now()}`, serverId: null, match: "all", tier: 2, enabled: true,
    conditions: [{ id: cid(), field: "prize", op: "gte", value: 100_000 }],
  }]);

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
          absorbContradictions(await rankingsAdminApi.createTierRule({ ...toWritePayload(r), reason: auditReason }));
        } else {
          const prev = snapById.get(r.serverId);
          if (!prev || ruleSignature(prev) !== ruleSignature(r)) {
            absorbContradictions(await rankingsAdminApi.updateTierRule(r.serverId, { ...toWritePayload(r), reason: auditReason }));
          }
        }
      }

      // 3) DEFAULT TIER - only if changed.
      if (defaultTier !== snap.defaultTier) {
        absorbContradictions(await rankingsAdminApi.updateTierConfig({ default_tier: defaultTier, reason: auditReason }));
      }

      // 4) REORDER - re-fetch first to learn the ids of any rules we just created, then send
      //    the full priority order matching the current on-screen sequence.
      const fresh = await rankingsAdminApi.tierRules();
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
          absorbContradictions(await rankingsAdminApi.reorderTierRules({ order: desiredOrder, reason: auditReason }));
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

  if (loading) return <FullLoader text={t("loading")} />;

  return (
    <div className="space-y-4">
      <PageHeader
        back
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        // data-tour anchor: tournament-tiers tour "Tournament Tiers classification" step.
        title={
          <span data-tour="tournament-tiers-title" className="inline-flex items-center">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* rules list
            data-tour anchor: tournament-tiers tour "Tier rules" step. Anchors the stable
            left column (holds the drag-to-reorder rule cards, the default-tier row, and the
            add-rule button) so the highlight stays put whether or not any rules exist yet. */}
        <div data-tour="tournament-tiers-rules" className="space-y-3 lg:col-span-2">
          {rules.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 px-3 py-10 text-center text-sm text-muted-foreground">
              {t("emptyRules")}
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
              <div className="space-y-1.5">
                <Label className="text-xs">{t("test.prizeLabel")}</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₦</span>
                  <Input type="number" min={0} value={test.prize}
                    onChange={(e) => setTest((t) => ({ ...t, prize: Math.max(0, parseInt(e.target.value || "0", 10)) }))}
                    className="h-8 pl-5 text-xs tabular-nums" />
                </div>
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

              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t("test.classifiedAs")}</span>
                  <TierPill tier={result.tier} />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {/* The AND / OR joiner is a translated word, so the surrounding spaces are added
                      here rather than baked into the message (leading/trailing spaces in a
                      catalog value get lost in translation tooling). */}
                  {result.ruleId
                    ? t("test.matched", {
                        n: rules.findIndex((r) => r.id === result.ruleId) + 1,
                        conditions: rules
                          .find((r) => r.id === result.ruleId)!
                          .conditions.map((c) => condText(c, t))
                          .join(
                            rules.find((r) => r.id === result.ruleId)!.match === "all"
                              ? ` ${t("test.joinAnd")} `
                              : ` ${t("test.joinOr")} `,
                          ),
                      })
                    : t("test.noMatch")}
                </p>
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
