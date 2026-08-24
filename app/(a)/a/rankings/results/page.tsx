"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
// TOURNAMENT tier badge (tier_1/2/3), NOT components/rankings/TierBadge. The rankings TierBadge
// takes a ZERO-based team-ranking tier index and renders `tier + 1`, so feeding it the tournament
// tier number printed every event one tier too high and turned tier_3 into the non-existent
// "Tier 4" (owner 2026-08-03: "Dynasty Cup SSA Grand Finals is being marked tier 4"). This is the
// same component /tournaments and /tournaments/[slug] use, so the admin badge now matches the
// public one exactly. Labels come from the `tournaments` namespace (tier.tier_1 ...).
import { TournamentTierBadge } from "@/components/TournamentTierBadge";
import { rankingsApi, Season } from "@/lib/rankings";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import { authHeaders } from "@/lib/http";
import {
  IconClipboardCheck, IconCircleCheckFilled, IconAlertTriangle, IconUsersGroup,
  IconSearch, IconFilter, IconAdjustments, IconTrophy, IconMedal, IconSwords,
  IconUser, IconUsers, IconX, IconCirclePlus, IconCircleMinus,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { matchesSearch } from "@/lib/search";
import axios from "axios";
import { env } from "@/lib/env";
import { InfoTip } from "@/components/ui/info-tip";
// i18n: every user-facing string here comes from the adminRankingsResults namespace
// (messages/{en,fr,pt}/adminRankingsResults.json). NOTE the hook is bound to `tr`, not the
// usual `t`, because `t` is already the per-row Tournament variable throughout this file
// (toggleFlag(t, ...), filtered.map((t) => ...)) and would be shadowed inside those scopes.
import { useTranslations } from "next-intl";
// Event.start_date is a Django DateField (a bare calendar date). Rendering it with
// `new Date(...).toLocaleDateString()` reads it as midnight UTC and shows the PREVIOUS day to
// anyone west of London, so it goes through formatLocalDateOnly instead.
import { formatLocalDateOnly } from "@/lib/i18n/time";

/**
 * Result Markers - counting-control surface wired to the LIVE backend
 * (afc_rankings/admin_results.py, prefix /rankings/).
 *
 * Scalable counting-control surface: enable/disable whether a tournament's results
 * count toward rankings, for the whole event (count_winner / count_placement /
 * count_kills toggles) or for specific teams/players (ResultExclusion rows).
 * Every "turn counting OFF" requires a mandatory reason (>= 10 chars), passed to the
 * backend which rejects writes without it.
 */

const MIN_REASON = 10;
// Default reason for "turn ON" paths (re-enabling counting / removing an exclusion).
// The backend requires every write to carry a >= 10-char reason; turning a flag back
// on is non-destructive, so it uses a short canned reason rather than a dialog.
const ENABLE_REASON = "Re-enabled counting via admin Result Markers.";

// Event.tournament_tier as the backend sends it (serialize_event_markers -> "tier"). Rendered
// verbatim by <TournamentTierBadge/>; there is deliberately no numeric index in between, because
// converting to a number is exactly what produced the off-by-one "Tier 4" badge.
type TierKey = "tier_1" | "tier_2" | "tier_3";
// The tier dropdown doubles as the competition-type filter now that scrims are listed.
type TierFilter = "all" | TierKey | "scrims";

// One tournament row as returned by GET admin/results/markers/ (serialize_event_markers).
type Tournament = {
  id: number;            // event_id
  name: string;          // event_name
  tier: TierKey;         // tournament_tier
  // "tournament" | "scrims". Scrims now appear in this list because their placement/kill/win
  // points feed the rankings too and the admin needs the same off switch for them. Spec §12
  // gives scrims no tier multiplier, so a scrim row shows a "Scrim" badge, not a tier.
  isScrim: boolean;      // competition_type === "scrims"
  date: string | null;   // start_date ISO
  teamCount: number;     // team_count
  countWinner: boolean;  // count_winner
  countPlacement: boolean; // count_placement
  countKills: boolean;   // count_kills
  exclusionCount: number; // active_exclusions
};

// One ResultExclusion as returned by GET result-exclusions/ (serialize_exclusion).
type Exclusion = {
  id: number;            // exclusion_id
  eventId: number;       // event_id
  entityType: "team" | "player";
  teamId: number | null;
  teamName: string | null;
  playerId: number | null;
  playerUsername: string | null;
  reason: string;
};

// map one markers-list row → local Tournament state.
function mapMarker(row: any): Tournament {
  const tier = (row.tier as TierKey) ?? "tier_3";
  return {
    id: row.event_id,
    name: row.event_name,
    tier: (["tier_1", "tier_2", "tier_3"].includes(tier) ? tier : "tier_3") as TierKey,
    isScrim: row.competition_type === "scrims",
    date: row.date ?? null,
    teamCount: row.team_count ?? 0,
    countWinner: row.count_winner !== false,
    countPlacement: row.count_placement !== false,
    countKills: row.count_kills !== false,
    exclusionCount: row.active_exclusions ?? 0,
  };
}

// map one exclusion row → local Exclusion state.
function mapExclusion(row: any): Exclusion {
  return {
    id: row.exclusion_id,
    eventId: row.event_id,
    entityType: row.entity_type,
    teamId: row.team_id ?? null,
    teamName: row.team_name ?? null,
    playerId: row.player_id ?? null,
    playerUsername: row.player_username ?? null,
    reason: row.reason ?? "",
  };
}

// One selectable entity (team or player) for the add-exclusion name picker.
// `name` is what the admin types/sees; `id` is the resolved id sent to the backend
// (team_id for teams, player user_id for players).
type EntityOption = { id: number; name: string };

// ── status derivation ──
type Status = "counting" | "partial" | "disabled";
function statusOf(t: Tournament): Status {
  const flagsOn = [t.countWinner, t.countPlacement, t.countKills].filter(Boolean).length;
  if (flagsOn === 0) return "disabled";
  if (flagsOn === 3 && t.exclusionCount === 0) return "counting";
  return "partial";
}

function StatusBadge({ status }: { status: Status }) {
  const tr = useTranslations("adminRankingsResults");
  if (status === "counting")
    return (
      <Badge variant="outline" className="rounded-full border-green-600/60 text-green-400">
        <IconCircleCheckFilled className="size-3" /> {tr("status.counting")}
      </Badge>
    );
  if (status === "partial")
    return (
      <Badge variant="outline" className="rounded-full border-orange-500/40 text-orange-400">
        <IconAlertTriangle className="size-3" /> {tr("status.partial")}
      </Badge>
    );
  return (
    <Badge variant="destructive" className="rounded-full">
      {tr("status.disabled")}
    </Badge>
  );
}

function StatCard({ icon, title, value, sub, tone }: {
  icon: React.ReactNode; title: string; value: React.ReactNode; sub?: string; tone?: string;
}) {
  return (
    <Card className="gap-1 transition-shadow hover:shadow-lg">
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

type StatusFilter = "all" | "counting" | "exclusions" | "disabled";

export default function ResultMarkersPage() {
  const tr = useTranslations("adminRankingsResults");
  const [season, setSeason] = useState<Season | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [selected, setSelected] = useState<Set<number>>(new Set());

  // ── reason dialog (single source for every "turn OFF" action) ──
  type PendingAction =
    | { kind: "flag"; id: number; flag: "countWinner" | "countPlacement" | "countKills"; tName: string; label: string }
    | { kind: "disableAll"; id: number; tName: string }
    | { kind: "bulkDisable"; ids: number[] }
    | { kind: "removeExclusion"; id: number; exclusionId: number; tName: string; eName: string; eKind: "team" | "player" };
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── drill-down dialog (exclusions for a tournament) ──
  const [drillId, setDrillId] = useState<number | null>(null);
  const drill = tournaments.find((t) => t.id === drillId) ?? null;
  const [drillExclusions, setDrillExclusions] = useState<Exclusion[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  // ── add-exclusion form (inside the drill-down) ──
  const [addType, setAddType] = useState<"team" | "player">("team");
  // name-search picker: `addQuery` is the visible text the admin types; `addEntityId`
  // is the resolved id (set only when an option is clicked) used for the API call.
  const [addQuery, setAddQuery] = useState("");
  const [addEntityId, setAddEntityId] = useState<number | null>(null);
  const [addReason, setAddReason] = useState("");
  const [adding, setAdding] = useState(false);

  // entity lists for the name picker - fetched once when the drill-down opens.
  const [teamOptions, setTeamOptions] = useState<EntityOption[]>([]);
  const [playerOptions, setPlayerOptions] = useState<EntityOption[]>([]);

  const reasonValid = reason.trim().length >= MIN_REASON;
  const addReasonValid = addReason.trim().length >= MIN_REASON;
  const addIdValid = addEntityId != null;

  // ── season resolution + initial markers load ──
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let s = await rankingsApi.currentSeason();
        if (!s) {
          const r = await rankingsApi.seasons();
          s = r.results.find((x) => x.is_active) ?? r.results[0] ?? null;
        }
        if (!active) return;
        setSeason(s);
        // No season exists -> the per-season effect below early-returns and never clears
        // `loading`, leaving the page stuck on "Loading result markers" forever. Clear it here.
        if (!s) setLoading(false);
      } catch (err: any) {
        if (!active) return;
        toast.error(err?.response?.data?.message || tr("toasts.loadSeasonFailed"));
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const loadMarkers = async (seasonId?: number) => {
    const r = await rankingsAdminApi.resultMarkers(seasonId);
    setTournaments(((r?.results ?? []) as any[]).map(mapMarker));
  };

  // load markers once the season resolves.
  useEffect(() => {
    if (!season) return;
    let active = true;
    setLoading(true);
    loadMarkers(season.season_id)
      .catch((err: any) => {
        toast.error(err?.response?.data?.message || tr("toasts.loadMarkersFailed"));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  // refresh a single row's marker state after a write (re-fetch the whole list, cheap; the
  // live event set is small and the envelope carries the resolved counting state + counts).
  const refreshMarkers = async () => {
    if (!season) return;
    try {
      await loadMarkers(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || tr("toasts.refreshFailed"));
    }
  };

  // load the exclusions for the drilled-into event.
  const loadDrillExclusions = async (eventId: number) => {
    setDrillLoading(true);
    try {
      const r = await rankingsAdminApi.resultExclusions({ event_id: eventId });
      setDrillExclusions(((r?.results ?? []) as any[]).map(mapExclusion));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || tr("toasts.loadExclusionsFailed"));
    } finally {
      setDrillLoading(false);
    }
  };

  // load the team + player lists for the name picker (once, when the drill-down opens).
  const loadEntityOptions = async () => {
    try {
      const [teamsRes, playersRes] = await Promise.all([
        axios(`${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-all-teams/`),
        // The player list is admin-only as of 2026-08-11 (it used to hand the whole roster to
        // anonymous callers), so this one carries the token. authHeaders() is the same helper
        // lib/rankingsAdmin.ts uses on this page, reading the auth_token cookie.
        axios(`${env.NEXT_PUBLIC_BACKEND_API_URL}/player/get-all-players/`, {
          headers: authHeaders(),
        }),
      ]);
      setTeamOptions(
        ((teamsRes.data?.teams ?? []) as any[]).map((t) => ({
          id: t.team_id,
          name: t.team_name,
        })),
      );
      setPlayerOptions(
        ((playersRes.data?.users ?? []) as any[]).map((p) => ({
          id: p.user_id,
          name: p.name,
        })),
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || tr("toasts.loadEntitiesFailed"));
    }
  };

  // open / refresh the drill-down whenever the target event changes.
  useEffect(() => {
    if (drillId == null) {
      setDrillExclusions([]);
      return;
    }
    setAddType("team");
    setAddQuery("");
    setAddEntityId(null);
    setAddReason("");
    loadDrillExclusions(drillId);
    if (teamOptions.length === 0 || playerOptions.length === 0) loadEntityOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillId]);

  // ── derived stats (from the live rows) ──
  const stats = useMemo(() => {
    let counting = 0, partial = 0, excludedEntities = 0;
    tournaments.forEach((t) => {
      const s = statusOf(t);
      if (s === "counting") counting++;
      else partial++; // partial + disabled both count as "not fully counting"
      excludedEntities += t.exclusionCount;
    });
    return { total: tournaments.length, counting, partial, excludedEntities };
  }, [tournaments]);

  // ── filtering ──
  const filtered = useMemo(() => {
    return tournaments.filter((t) => {
      // Text search uses the shared matchesSearch (punctuation / accent / fancy-font
      // insensitive) so a stylized event name still matches a normal-keyboard query.
      if (q && !matchesSearch(t.name, q)) return false;
      // "scrims" is a competition-type filter riding on the tier dropdown (a scrim has no tier of
      // its own, so it is the natural place to isolate them). A tier pick never returns scrims.
      if (tierFilter === "scrims" && !t.isScrim) return false;
      if (tierFilter !== "all" && tierFilter !== "scrims" && (t.isScrim || t.tier !== tierFilter)) return false;
      const s = statusOf(t);
      if (statusFilter === "counting" && s !== "counting") return false;
      if (statusFilter === "disabled" && s !== "disabled") return false;
      if (statusFilter === "exclusions" && t.exclusionCount === 0) return false;
      return true;
    });
  }, [tournaments, q, tierFilter, statusFilter]);

  // name-picker matches: filter the active entity list by the typed query (case-insensitive
  // substring), cap at 8. Hidden once an option is resolved and the text matches it exactly.
  const addMatches = useMemo(() => {
    const source = addType === "team" ? teamOptions : playerOptions;
    const query = addQuery.trim();
    // Keep this empty-query guard: matchesSearch returns true for an empty query, but the
    // picker should show nothing until the admin actually types a name.
    if (!query) return [];
    // Match on the shared helper (punctuation / accent / fancy-font insensitive) so a
    // stylized team / player name resolves from a normal-keyboard query.
    return source
      .filter((o) => matchesSearch(o.name, query))
      .slice(0, 8);
  }, [addType, addQuery, teamOptions, playerOptions]);

  // switch entity type - clears any resolved selection (a team id is invalid for players).
  const changeAddType = (v: "team" | "player") => {
    setAddType(v);
    setAddQuery("");
    setAddEntityId(null);
  };

  // turning a flag ON / OFF
  const toggleFlag = (t: Tournament, flag: "countWinner" | "countPlacement" | "countKills", label: string, next: boolean) => {
    if (next) {
      // re-enable immediately with a canned reason (non-destructive).
      const field = flag === "countWinner" ? "count_winner" : flag === "countPlacement" ? "count_placement" : "count_kills";
      // The failure toast reads the flag name mid-sentence, so it uses the lowercase variant
      // from the catalog rather than .toLowerCase() (which is wrong in most languages).
      const flagKey = flag === "countWinner" ? "winner" : flag === "countPlacement" ? "placement" : "kills";
      void (async () => {
        try {
          await rankingsAdminApi.setEventCounting(t.id, { [field]: true, reason: ENABLE_REASON });
          toast.success(tr("toasts.flagReenabled", { flag: label, tournament: t.name }));
          await refreshMarkers();
        } catch (err: any) {
          toast.error(
            err?.response?.data?.message ||
              tr("toasts.flagReenableFailed", { flag: tr(`flagsLower.${flagKey}`) }),
          );
        }
      })();
    } else {
      setReason("");
      setPending({ kind: "flag", id: t.id, flag, tName: t.name, label });
    }
  };

  // per-row "Disable all" / "Enable all"
  const toggleAllFlags = (t: Tournament) => {
    const allOn = t.countWinner && t.countPlacement && t.countKills;
    if (allOn) {
      setReason("");
      setPending({ kind: "disableAll", id: t.id, tName: t.name });
    } else {
      void (async () => {
        try {
          await rankingsAdminApi.setEventCounting(t.id, {
            count_winner: true, count_placement: true, count_kills: true, reason: ENABLE_REASON,
          });
          toast.success(tr("toasts.allMarkersReenabled", { tournament: t.name }));
          await refreshMarkers();
        } catch (err: any) {
          toast.error(err?.response?.data?.message || tr("toasts.reenableMarkersFailed"));
        }
      })();
    }
  };

  // remove an existing exclusion inside the drill-down (frees the entity).
  const removeExclusion = (t: Tournament, x: Exclusion) => {
    setReason("");
    setPending({
      kind: "removeExclusion",
      id: t.id,
      exclusionId: x.id,
      tName: t.name,
      eName: x.entityType === "team"
        ? (x.teamName ?? tr("drill.teamFallback", { id: x.teamId ?? "" }))
        : (x.playerUsername ?? tr("drill.playerFallback", { id: x.playerId ?? "" })),
      eKind: x.entityType,
    });
  };

  // add a new exclusion (create) inside the drill-down. Uses the RESOLVED id from the
  // name picker (addEntityId), not raw text - the add button is gated on it.
  const addExclusion = async () => {
    if (!drill || addEntityId == null || !addReasonValid || adding) return;
    setAdding(true);
    const idNum = addEntityId;
    const label =
      addQuery.trim() ||
      (addType === "team"
        ? tr("drill.teamFallback", { id: idNum })
        : tr("drill.playerFallback", { id: idNum }));
    try {
      await rankingsAdminApi.createExclusion({
        event_id: drill.id,
        entity_type: addType,
        ...(addType === "team" ? { team_id: idNum } : { player_id: idNum }),
        reason: addReason.trim(),
      });
      toast.success(tr("toasts.excluded", { name: label, tournament: drill.name }));
      setAddQuery("");
      setAddEntityId(null);
      setAddReason("");
      await Promise.all([loadDrillExclusions(drill.id), refreshMarkers()]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || tr("toasts.addExclusionFailed"));
    } finally {
      setAdding(false);
    }
  };

  // selection
  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const allVisibleSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.id));
  const toggleSelectAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filtered.forEach((t) => next.delete(t.id));
      else filtered.forEach((t) => next.add(t.id));
      return next;
    });
  const clearSelection = () => setSelected(new Set());

  // bulk enable (immediate - re-enable all three flags per selected event)
  const bulkEnable = () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    void (async () => {
      try {
        await Promise.all(
          ids.map((id) =>
            rankingsAdminApi.setEventCounting(id, {
              count_winner: true, count_placement: true, count_kills: true, reason: ENABLE_REASON,
            }),
          ),
        );
        toast.success(tr("toasts.bulkEnabled", { count: ids.length }));
        clearSelection();
        await refreshMarkers();
      } catch (err: any) {
        toast.error(err?.response?.data?.message || tr("toasts.bulkEnableFailed"));
      }
    })();
  };
  // bulk disable (reason-gated)
  const bulkDisable = () => {
    setReason("");
    setPending({ kind: "bulkDisable", ids: Array.from(selected) });
  };

  // ── confirm the reason-gated action ──
  const confirmReason = async () => {
    if (!pending || !reasonValid || submitting) return;
    const r = reason.trim();
    setSubmitting(true);
    try {
      if (pending.kind === "flag") {
        const field =
          pending.flag === "countWinner" ? "count_winner"
            : pending.flag === "countPlacement" ? "count_placement"
              : "count_kills";
        await rankingsAdminApi.setEventCounting(pending.id, { [field]: false, reason: r });
        toast.success(
          tr("toasts.flagDisabled", { flag: pending.label, tournament: pending.tName }),
        );
        await refreshMarkers();
      } else if (pending.kind === "disableAll") {
        await rankingsAdminApi.setEventCounting(pending.id, {
          count_winner: false, count_placement: false, count_kills: false, reason: r,
        });
        toast.success(tr("toasts.allMarkersDisabled", { tournament: pending.tName }));
        await refreshMarkers();
      } else if (pending.kind === "bulkDisable") {
        const ids = pending.ids;
        await Promise.all(
          ids.map((id) =>
            rankingsAdminApi.setEventCounting(id, {
              count_winner: false, count_placement: false, count_kills: false, reason: r,
            }),
          ),
        );
        toast.success(tr("toasts.bulkDisabled", { count: ids.length }));
        clearSelection();
        await refreshMarkers();
      } else if (pending.kind === "removeExclusion") {
        await rankingsAdminApi.deleteExclusion(pending.exclusionId, { reason: r });
        toast.success(
          tr("toasts.reincluded", { name: pending.eName, tournament: pending.tName }),
        );
        await Promise.all([
          drillId != null ? loadDrillExclusions(drillId) : Promise.resolve(),
          refreshMarkers(),
        ]);
      }
      setPending(null);
      setReason("");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || tr("toasts.actionFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const pendingTitle = () => {
    if (!pending) return "";
    if (pending.kind === "flag")
      return tr("reasonDialog.flagTitle", { flag: pending.label, tournament: pending.tName });
    if (pending.kind === "disableAll")
      return tr("reasonDialog.disableAllTitle", { tournament: pending.tName });
    if (pending.kind === "bulkDisable")
      return tr("reasonDialog.bulkTitle", { count: pending.ids.length });
    return tr("reasonDialog.reincludeTitle", { name: pending.eName, tournament: pending.tName });
  };
  const pendingDesc = () => {
    if (!pending) return "";
    // Two separate sentences rather than an interpolated "team"/"player" noun: the possessive
    // and the article around it differ per language, so the whole sentence has to be authored.
    if (pending.kind === "removeExclusion")
      return pending.eKind === "team"
        ? tr("reasonDialog.descReincludeTeam")
        : tr("reasonDialog.descReincludePlayer");
    return tr("reasonDialog.descDisable");
  };

  if (loading && tournaments.length === 0) {
    return <FullLoader text={tr("loading")} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        back
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        // data-tour anchor: result-markers tour "Result Markers control" step.
        title={
          <span data-tour="result-markers-title" className="inline-flex flex-wrap items-center">
            {tr("title")}
            <InfoTip id="rankings.results._page" className="ml-1.5" />
          </span>
        }
        description={tr("description")}
      />

      {/* status strip
          data-tour anchor: result-markers tour "Results status" step. */}
      <div data-tour="result-markers-status" className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4">
        <StatCard
          icon={<IconClipboardCheck className="size-4" />}
          title={tr("stats.total")} value={stats.total}
          sub={tr("stats.totalSub")}
        />
        <StatCard
          icon={<IconCircleCheckFilled className="size-4" />}
          title={tr("stats.counting")} value={stats.counting}
          sub={tr("stats.countingSub")}
          tone="text-green-500"
        />
        <StatCard
          icon={<IconAlertTriangle className="size-4" />}
          title={tr("stats.partial")} value={stats.partial}
          sub={tr("stats.partialSub")}
          tone={stats.partial ? "text-orange-500" : "text-muted-foreground"}
        />
        <StatCard
          icon={<IconUsersGroup className="size-4" />}
          title={tr("stats.excluded")} value={stats.excludedEntities}
          sub={tr("stats.excludedSub")}
          tone={stats.excludedEntities ? "text-orange-500" : "text-muted-foreground"}
        />
      </div>

      {/* table
          data-tour anchor: result-markers tour "Tournament list" step. */}
      <Card data-tour="result-markers-list">
        <CardHeader className="flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-base">
            {tr("list.title")}{season ? ` · ${season.name}` : ""}
          </CardTitle>
          {/* filter row: search + tier + status. data-tour anchor: result-markers tour
              "Find an event" step (anchors the whole filter cluster so the highlight covers
              the search box and the tier/status selects together). */}
          <div data-tour="result-markers-search" className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tr("filters.search")}
                className="h-9 pl-8"
              />
            </div>
            {/* SelectItem values are the raw TierFilter / StatusFilter keys the filter logic
                compares against; only the visible labels are translated. */}
            <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as TierFilter)}>
              <SelectTrigger className="h-9 w-full sm:w-[140px] text-xs">
                <IconFilter className="size-3.5 text-muted-foreground" />
                <SelectValue placeholder={tr("filters.tierPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr("filters.allTiers")}</SelectItem>
                <SelectItem value="tier_1">{tr("filters.tier1")}</SelectItem>
                <SelectItem value="tier_2">{tr("filters.tier2")}</SelectItem>
                <SelectItem value="tier_3">{tr("filters.tier3")}</SelectItem>
                <SelectItem value="scrims">{tr("filters.scrimsOnly")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-9 w-full sm:w-[170px] text-xs">
                <IconAdjustments className="size-3.5 text-muted-foreground" />
                <SelectValue placeholder={tr("filters.statusPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr("filters.allStatuses")}</SelectItem>
                <SelectItem value="counting">{tr("filters.fullyCounting")}</SelectItem>
                <SelectItem value="exclusions">{tr("filters.hasExclusions")}</SelectItem>
                <SelectItem value="disabled">{tr("filters.disabled")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        {/* bulk bar */}
        {selected.size > 0 && (
          <div className="mx-6 mb-3 flex flex-col items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="px-1 text-xs font-medium tabular-nums">
              {tr("bulk.selected", { count: selected.size })}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={bulkEnable}>
                <IconCirclePlus className="mr-1 size-3.5" /> {tr("bulk.enable")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={bulkDisable}
              >
                <IconCircleMinus className="mr-1 size-3.5" /> {tr("bulk.disable")}
              </Button>
              {/* ⓘ beside the bulk action (sibling) - explains the multi-event disable. */}
              <InfoTip id="rankings.results.bulk_disable" />
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                <IconX className="mr-1 size-3.5" /> {tr("bulk.clear")}
              </Button>
            </div>
          </div>
        )}

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-foreground">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label={tr("table.selectAll")}
                  />
                </TableHead>
                <TableHead className="text-foreground">{tr("table.tournament")}</TableHead>
                <TableHead className="text-foreground">{tr("table.tier")}</TableHead>
                <TableHead className="text-center text-foreground">{tr("table.teams")}</TableHead>
                {/* data-tour anchor: result-markers tour "Counting flags" step. Anchors the
                    first of the three counting-flag columns (Winner / Placement / Kills) - it
                    is always rendered, so the highlight has a stable target for the flag set. */}
                <TableHead data-tour="result-markers-flags" className="text-center text-foreground">
                  <span className="inline-flex items-center gap-1">
                    <IconTrophy className="size-3.5" /> {tr("flags.winner")}
                    <InfoTip id="rankings.results.count_winner" />
                  </span>
                </TableHead>
                <TableHead className="text-center text-foreground">
                  <span className="inline-flex items-center gap-1">
                    <IconMedal className="size-3.5" /> {tr("flags.placement")}
                    <InfoTip id="rankings.results.count_placement" />
                  </span>
                </TableHead>
                <TableHead className="text-center text-foreground">
                  <span className="inline-flex items-center gap-1">
                    <IconSwords className="size-3.5" /> {tr("flags.kills")}
                    <InfoTip id="rankings.results.count_kills" />
                  </span>
                </TableHead>
                <TableHead className="text-foreground">{tr("table.status")}</TableHead>
                <TableHead className="text-right text-foreground">{tr("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    {q || tierFilter !== "all" || statusFilter !== "all"
                      ? tr("list.noMatch")
                      : tr("list.empty")}
                  </TableCell>
                </TableRow>
              ) : filtered.map((t) => {
                const status = statusOf(t);
                const excl = t.exclusionCount;
                const allOn = t.countWinner && t.countPlacement && t.countKills;
                return (
                  <TableRow
                    key={t.id}
                    className={cn(
                      selected.has(t.id) && "bg-primary/5",
                      status === "disabled" && "bg-destructive/5",
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(t.id)}
                        onCheckedChange={() => toggleSelect(t.id)}
                        aria-label={tr("table.selectRow", { name: t.name })}
                      />
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      <div className="flex flex-col">
                        <span>{t.name}</span>
                        {/* Event.start_date is a bare DateField, see the formatLocalDateOnly note
                            at the imports: the date-and-time formatter would shift it a day. */}
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {t.date ? formatLocalDateOnly(t.date) : "-"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {/* Spec §12: scrims have no tier multiplier, so printing the stored
                          tournament_tier on a scrim row would claim a weight it never gets. */}
                      {t.isScrim ? (
                        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs text-muted-foreground">
                          {tr("list.scrim")}
                        </Badge>
                      ) : (
                        <TournamentTierBadge tier={t.tier} />
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs tabular-nums">{t.teamCount}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={t.countWinner}
                          onCheckedChange={(v) => toggleFlag(t, "countWinner", tr("flags.winner"), v)}
                          aria-label={tr("table.winnerToggle", { name: t.name })}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={t.countPlacement}
                          onCheckedChange={(v) => toggleFlag(t, "countPlacement", tr("flags.placement"), v)}
                          aria-label={tr("table.placementToggle", { name: t.name })}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={t.countKills}
                          onCheckedChange={(v) => toggleFlag(t, "countKills", tr("flags.kills"), v)}
                          aria-label={tr("table.killsToggle", { name: t.name })}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={status} />
                        {excl > 0 && (
                          <Badge variant="outline" className="rounded-full border-orange-500/40 px-1.5 py-0 text-[10px] text-orange-400 tabular-nums">
                            {tr("list.exclShort", { count: excl })}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="h-8" onClick={() => setDrillId(t.id)}>
                          <IconUsersGroup className="mr-1 size-3.5" /> {tr("list.exclusions")}
                          {excl > 0 && (
                            <span className="ml-1 rounded-full bg-orange-500/20 px-1.5 text-[10px] text-orange-400 tabular-nums">
                              {excl}
                            </span>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={cn(
                            "h-8",
                            allOn && "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive",
                          )}
                          onClick={() => toggleAllFlags(t)}
                        >
                          {allOn ? tr("list.disableAll") : tr("list.enableAll")}
                        </Button>
                        {/* ⓘ beside the per-event toggle-all (sibling of both action buttons). */}
                        <InfoTip id="rankings.results.toggle_all" />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* drill-down: exclusions for a tournament */}
      <Dialog open={!!drill} onOpenChange={(o) => { if (!o) setDrillId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconUsersGroup className="size-5 text-primary" />
              {tr("drill.title", { tournament: drill?.name ?? "" })}
            </DialogTitle>
            <DialogDescription>{tr("drill.description")}</DialogDescription>
          </DialogHeader>

          {drill && (
            <>
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs">
                <span className="text-muted-foreground">{tr("drill.currentlyExcluded")}</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {drillExclusions.length}
                </span>
              </div>

              {/* existing exclusions */}
              <div className="max-h-[40vh] space-y-1.5 overflow-y-auto pr-1">
                {drillLoading ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">{tr("drill.loading")}</p>
                ) : drillExclusions.length === 0 ? (
                  <p className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
                    {tr("drill.empty")}
                  </p>
                ) : drillExclusions.map((e) => {
                  const name = e.entityType === "team"
                    ? (e.teamName ?? tr("drill.teamFallback", { id: e.teamId ?? "" }))
                    : (e.playerUsername ?? tr("drill.playerFallback", { id: e.playerId ?? "" }));
                  return (
                    <div
                      key={`${e.entityType}-${e.id}`}
                      className="flex items-center justify-between rounded-md border border-orange-500/30 bg-orange-500/5 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        {e.entityType === "team"
                          ? <IconUsers className="size-4 text-muted-foreground" />
                          : <IconUser className="size-4 text-muted-foreground" />}
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">{name}</span>
                          <span className="text-[10px] capitalize text-muted-foreground">
                            {e.entityType === "team" ? tr("drill.entityTeam") : tr("drill.entityPlayer")}
                          </span>
                        </div>
                        <Badge variant="outline" className="rounded-full border-orange-500/40 px-1.5 py-0 text-[10px] text-orange-400">
                          {tr("drill.excluded")}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-muted-foreground hover:text-foreground"
                        onClick={() => removeExclusion(drill, e)}
                      >
                        <IconCirclePlus className="mr-1 size-3.5" /> {tr("drill.reinclude")}
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* add a new exclusion
                  data-tour anchor: result-markers tour "Team and player exclusions" step.
                  Anchors the add-exclusion block inside the per-event drill-down (a single
                  stable element when the dialog is open, vs. the per-row Exclusions buttons). */}
              <div data-tour="result-markers-exclusions" className="space-y-3 rounded-md border bg-muted/20 p-3">
                <p className="flex items-center text-xs font-semibold text-foreground">
                  {tr("drill.addTitle")}
                  <InfoTip id="rankings.results.exclusions" className="ml-1" />
                </p>
                <div className="flex gap-2">
                  {/* Values stay "team"/"player" - they are the entity_type sent to the backend. */}
                  <Select value={addType} onValueChange={(v) => changeAddType(v as "team" | "player")}>
                    <SelectTrigger className="h-9 w-[120px] text-xs">
                      <SelectValue placeholder={tr("drill.typePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team">{tr("drill.team")}</SelectItem>
                      <SelectItem value="player">{tr("drill.player")}</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* name-search picker - type a name, click a match to resolve the id */}
                  <div className="relative flex-1">
                    <Input
                      value={addQuery}
                      onChange={(e) => {
                        setAddQuery(e.target.value);
                        // typing invalidates any previously resolved id until a new match is clicked
                        setAddEntityId(null);
                      }}
                      placeholder={addType === "team" ? tr("drill.searchTeam") : tr("drill.searchPlayer")}
                      className="h-9"
                    />
                    {addQuery.trim().length > 0 && addEntityId == null && (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                        {addMatches.length === 0 ? (
                          <p className="px-2 py-1.5 text-sm text-muted-foreground">{tr("drill.noMatches")}</p>
                        ) : (
                          addMatches.map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                              onClick={() => {
                                setAddQuery(o.name);
                                setAddEntityId(o.id);
                              }}
                            >
                              {o.name}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="add-excl-reason" className="text-xs">
                    {tr("drill.reason")} <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="add-excl-reason"
                    value={addReason}
                    onChange={(e) => setAddReason(e.target.value)}
                    placeholder={tr("drill.reasonPlaceholder")}
                    className="min-h-20"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {tr("charMin", { count: addReason.trim().length, min: MIN_REASON })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={!addIdValid || !addReasonValid || adding}
                  onClick={addExclusion}
                >
                  <IconCircleMinus className="mr-1.5 size-3.5" /> {adding ? tr("drill.adding") : tr("drill.add")}
                </Button>
              </div>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDrillId(null)}>{tr("drill.done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* mandatory-reason dialog (every "turn counting OFF" path + re-include) */}
      <Dialog open={!!pending} onOpenChange={(o) => { if (!o) { setPending(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconAlertTriangle className="size-5 text-orange-500" />
              {pendingTitle()}
            </DialogTitle>
            <DialogDescription>{pendingDesc()}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="result-reason">
              {tr("reasonDialog.reason")} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="result-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={tr("reasonDialog.placeholder")}
              className="min-h-24"
            />
            <p className="text-[11px] text-muted-foreground">
              {tr("charMin", { count: reason.trim().length, min: MIN_REASON })}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPending(null); setReason(""); }}>
              {tr("reasonDialog.goBack")}
            </Button>
            {pending?.kind === "removeExclusion" ? (
              <Button disabled={!reasonValid || submitting} onClick={confirmReason}>
                <IconCirclePlus className="mr-1.5 size-4" /> {submitting ? tr("reasonDialog.saving") : tr("reasonDialog.reinclude")}
              </Button>
            ) : (
              <Button variant="destructive" disabled={!reasonValid || submitting} onClick={confirmReason}>
                <IconCircleMinus className="mr-1.5 size-4" /> {submitting ? tr("reasonDialog.saving") : tr("reasonDialog.disable")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
