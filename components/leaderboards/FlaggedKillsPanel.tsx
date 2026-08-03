"use client";

/**
 * FlaggedKillsPanel - admin/organizer control for "ringer" kills on an event leaderboard.
 *
 * A flagged player is a Free Fire UID that a match-log FILE upload credited to a team it is NOT
 * rostered on (afc_tournament_and_scrims.MatchKillFlag). This panel shows the flagged players plus
 * the event-wide "count flagged kills" default, and lets an admin or organizer:
 *   • flip the event default (Switch) - count vs drop ALL flagged kills, or
 *   • override one player (Select: Follow / Count / Do not count).
 * Each change PATCHes the backend (lib/flaggedKills) which recomputes the team totals, then we
 * refetch + call onChanged() so the parent reloads the standings.
 *
 * SCOPING (owner 2026-07-10): flagged players show only for the stage/group they were flagged in, not
 * the whole event. By default the panel FOLLOWS the stage/group the parent leaderboard is currently
 * viewing (selectedStageId/selectedGroupId props) and re-fetches as that changes. A "Combine" picker
 * (stage + group checkboxes, mirroring CombinedStandings) lets the manager override that and view
 * flagged players across any set of stages/groups. Scoping is DISPLAY-ONLY - the count/exclude
 * decisions and the team-total recompute are unchanged (still event-wide).
 *
 * Mounted on the admin event leaderboard (app/(a)/a/leaderboards/[id] + its /edit) and the organizer
 * one (app/(organizer)/organizer/events/[slug]/leaderboard). i18n namespace: "flaggedKills".
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { IconFlag, IconAlertTriangle, IconLayersSubtract } from "@tabler/icons-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  flaggedKillsApi,
  FlaggedKill,
  FlaggedStage,
  UnmatchedTeamRow,
  EventTeamOption,
} from "@/lib/flaggedKills";

type Props = {
  eventId: number | string;
  token: string | null;
  /** Whether the viewer may change the controls (admins + organizers with can_upload_results). */
  canManage?: boolean;
  /** Called after any successful change so the parent can refetch the standings. */
  onChanged?: () => void;
  /**
   * The stage/group the parent leaderboard is currently viewing. The panel FOLLOWS these by default
   * (owner 2026-07-10) so flagged players show only for what you're looking at; the Combine picker
   * overrides it. Strings accepted (parent state); non-numeric sentinels ("all"/"overall") = none.
   */
  selectedStageId?: string | number | null;
  selectedGroupId?: string | number | null;
};

// Map the per-flag override (count_kills: null|true|false) to/from the Select value.
const toSel = (v: boolean | null) => (v === null ? "default" : v ? "count" : "exclude");
const fromSel = (v: string): boolean | null => (v === "default" ? null : v === "count");

// Parse a parent-selection value into a numeric id, or null for "no scope" (null/""/"all"/"overall").
const numOrNull = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Reason -> i18n key for the "Why flagged" badge. Covers the two legacy reasons plus the two
// name-matching reasons (name-matching feature): a roster member whose UID changed, or a name that
// matches a member registered on another team. Both arrive pending approval via the Select below.
const REASON_KEY: Record<string, string> = {
  not_on_roster: "reasonNotOnRoster",
  belongs_to_other_team: "reasonOtherTeam",
  name_matched_uid_changed: "reasonNameUidChanged",
  name_matched_other_team: "reasonNameOtherTeam",
  // unlisted_in_file (owner 2026-07-07): kills in the team's KillScore that the file listed against no
  // player (dropped line). Counts by default; toggleable here.
  unlisted_in_file: "reasonUnlisted",
};

// A small "Stage · Group" caption shown under a team name so each flagged row says where it came from.
function ScopeCaption({ stage, group }: { stage: string | null; group: string | null }) {
  if (!stage && !group) return null;
  return (
    <div className="text-[10px] text-muted-foreground">
      {[stage, group].filter(Boolean).join(" · ")}
    </div>
  );
}

export function FlaggedKillsPanel({
  eventId,
  token,
  canManage = true,
  onChanged,
  selectedStageId,
  selectedGroupId,
}: Props) {
  const t = useTranslations("flaggedKills");
  const [loading, setLoading] = useState(true);
  const [defaultOn, setDefaultOn] = useState(true);
  const [flags, setFlags] = useState<FlaggedKill[]>([]);
  // Unmatched in-game team blocks + the registered teams to attribute them to (owner 2026-06-30).
  const [unmatched, setUnmatched] = useState<UnmatchedTeamRow[]>([]);
  const [eventTeams, setEventTeams] = useState<EventTeamOption[]>([]);
  const [busy, setBusy] = useState(false);

  // ── Scope model (owner 2026-07-10) ──
  // `stages` is the event's stage->group structure (from the response) that feeds the Combine picker.
  // `follow` ON => scope is derived from the parent's selected stage/group; OFF => the manager's custom
  // stageSel/groupSel (mirrors CombinedStandings: a whole-stage tick covers all its groups).
  const [stages, setStages] = useState<FlaggedStage[]>([]);
  const [follow, setFollow] = useState(true);
  const [stageSel, setStageSel] = useState<Set<number>>(new Set());
  const [groupSel, setGroupSel] = useState<Set<number>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);

  const followGid = numOrNull(selectedGroupId);
  const followSid = numOrNull(selectedStageId);

  // The stage_ids/group_ids to request. Follow => a single group (if viewing one) else the whole stage
  // (backend expands) else the whole event. Custom => the ticked stages/groups.
  const scope = useMemo(() => {
    if (follow) {
      if (followGid != null) return { stageIds: [] as number[], groupIds: [followGid] };
      if (followSid != null) return { stageIds: [followSid], groupIds: [] as number[] };
      return { stageIds: [] as number[], groupIds: [] as number[] };
    }
    return { stageIds: Array.from(stageSel), groupIds: Array.from(groupSel) };
  }, [follow, followGid, followSid, stageSel, groupSel]);
  // Stable dep key so load() re-runs when the scope (not the array identity) changes.
  const scopeKey = `${scope.stageIds.join(",")}|${scope.groupIds.join(",")}`;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await flaggedKillsApi.get(eventId, token, {
        stageIds: scope.stageIds,
        groupIds: scope.groupIds,
      });
      setDefaultOn(r.count_flagged_kills);
      setFlags(r.flags);
      setUnmatched(r.unmatched_teams ?? []);
      setEventTeams(r.event_teams ?? []);
      setStages(r.stages ?? []);
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
    // scope is captured via scopeKey (arrays would change identity every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, token, t, scopeKey]);

  useEffect(() => { load(); }, [load]);

  const afterChange = useCallback(async () => {
    await load();
    onChanged?.();
  }, [load, onChanged]);

  const onToggleDefault = async (next: boolean) => {
    if (!token || busy) return;
    setBusy(true);
    setDefaultOn(next); // optimistic
    try {
      await flaggedKillsApi.setEventDefault(eventId, next, token);
      toast.success(t("updated"));
      await afterChange();
    } catch {
      setDefaultOn(!next); // revert
      toast.error(t("updateFailed"));
    } finally {
      setBusy(false);
    }
  };

  const onChangeFlag = async (flag: FlaggedKill, sel: string) => {
    if (!token || busy) return;
    setBusy(true);
    try {
      await flaggedKillsApi.setFlag(flag.flag_id, fromSel(sel), token);
      toast.success(t("updated"));
      await afterChange();
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setBusy(false);
    }
  };

  // Attribute an unmatched in-game team block to a registered team ("" = don't count). Recomputes
  // the standings on the server, then refetch + tell the parent to reload (owner 2026-06-30).
  const onAttributeTeam = async (block: UnmatchedTeamRow, val: string) => {
    if (!token || busy) return;
    setBusy(true);
    try {
      await flaggedKillsApi.attributeUnmatchedTeam(
        block.block_id,
        val ? Number(val) : null,
        token,
      );
      toast.success(t("updated"));
      await afterChange();
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setBusy(false);
    }
  };

  // ── Bulk accept/reject (owner 2026-07-13) ──
  // One-by-one was slow because every per-flag PATCH re-scored the whole event. These apply the same
  // decision to EVERY currently-shown flag (respecting the scope filter) in a SINGLE bulkSet call that
  // recomputes once. value: true = count all, false = drop all, null = follow the event default.
  const bulkFlags = async (value: boolean | null) => {
    if (!token || busy || flags.length === 0) return;
    setBusy(true);
    try {
      await flaggedKillsApi.bulkSet(
        eventId,
        { flags: flags.map((f) => ({ flag_id: f.flag_id, count_kills: value })) },
        token,
      );
      toast.success(t("updated"));
      await afterChange();
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setBusy(false);
    }
  };

  // Reject every unmatched in-game team block at once (leave them all uncounted). There is no
  // "accept all" for teams since each block has no single obvious target - those stay per-row.
  const bulkRejectTeams = async () => {
    if (!token || busy || unmatched.length === 0) return;
    setBusy(true);
    try {
      await flaggedKillsApi.bulkSet(
        eventId,
        { unmatched: unmatched.map((b) => ({ block_id: b.block_id, tournament_team_id: null })) },
        token,
      );
      toast.success(t("updated"));
      await afterChange();
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setBusy(false);
    }
  };

  // ── Combine picker handlers (mirror CombinedStandings) ──
  // Ticking a whole stage covers all its groups (drop any individual group ticks inside it). Any tick
  // switches OFF follow-mode; "Follow current view" resets back to following the parent selection.
  const toggleStage = (stage: FlaggedStage) => {
    setFollow(false);
    setStageSel((prev) => {
      const next = new Set(prev);
      next.has(stage.stage_id) ? next.delete(stage.stage_id) : next.add(stage.stage_id);
      return next;
    });
    setGroupSel((prev) => {
      const next = new Set(prev);
      stage.groups.forEach((g) => next.delete(g.group_id));
      return next;
    });
  };
  const toggleGroup = (groupId: number) => {
    setFollow(false);
    setGroupSel((prev) => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  };
  const resetFollow = () => {
    setFollow(true);
    setStageSel(new Set());
    setGroupSel(new Set());
  };

  // Human-readable "what am I showing" line for the header.
  const stageName = (sid: number) => stages.find((s) => s.stage_id === sid)?.stage_name ?? `#${sid}`;
  const groupName = (gid: number) => {
    for (const s of stages) for (const g of s.groups) if (g.group_id === gid) return g.group_name;
    return `#${gid}`;
  };
  const scopeLabel = useMemo(() => {
    if (follow) {
      if (followGid != null) return t("scopeGroup", { group: groupName(followGid) });
      if (followSid != null) return t("scopeStage", { stage: stageName(followSid) });
      return t("scopeEvent");
    }
    const n = stageSel.size + groupSel.size;
    return n === 0 ? t("scopeEvent") : t("scopeCustom", { count: n });
    // groupName/stageName read `stages`; recompute when it or the selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow, followGid, followSid, stageSel, groupSel, stages, t]);

  // Don't render anything until we know whether there's something to manage. We DO show the panel
  // (with just the toggle) even when there are no flags, so the default can be pre-set.
  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">{t("loading")}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconFlag className="size-4 text-orange-400" />
              {t("title")}
              {flags.length > 0 && (
                <Badge variant="outline" className="rounded-full border-orange-500/40 px-2 py-0.5 text-[10px] text-orange-400">
                  {t("flaggedBadge", { count: flags.length })}
                </Badge>
              )}
            </CardTitle>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">{t("subtitle")}</p>
          </div>
          {/* Event-wide default toggle */}
          <label className="flex items-center gap-2">
            <span className="text-xs font-medium">{t("countAllLabel")}</span>
            <Switch checked={defaultOn} onCheckedChange={onToggleDefault} disabled={!canManage || busy} />
          </label>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {defaultOn ? t("countAllHintOn") : t("countAllHintOff")}
        </p>

        {/* ── Scope row (owner 2026-07-10): what stages/groups these flagged players are shown for ── */}
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] text-muted-foreground">
            {scopeLabel}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[11px]"
            onClick={() => setPickerOpen((o) => !o)}
          >
            <IconLayersSubtract className="size-3.5" />
            {t("combine")}
          </Button>
          {!follow && (
            <button
              type="button"
              onClick={resetFollow}
              className="text-[11px] text-primary hover:underline"
            >
              {t("followCurrent")}
            </button>
          )}
        </div>

        {/* Combine picker: tick whole stages and/or individual groups to view flagged players across them. */}
        {pickerOpen && (
          <div className="mt-2 space-y-2 rounded-lg border p-3">
            <p className="text-[11px] text-muted-foreground">{t("combineHint")}</p>
            {stages.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">{t("noStages")}</p>
            ) : (
              stages.map((s) => {
                const allGroupsTicked =
                  s.groups.length > 0 && s.groups.every((g) => groupSel.has(g.group_id));
                const stageTicked = stageSel.has(s.stage_id) || allGroupsTicked;
                return (
                  <div key={s.stage_id} className="space-y-1">
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <Checkbox
                        checked={stageTicked}
                        onCheckedChange={() => toggleStage(s)}
                        disabled={!canManage}
                      />
                      {s.stage_name}
                    </label>
                    {s.groups.length > 0 && (
                      <div className="ml-6 flex flex-wrap gap-x-4 gap-y-1">
                        {s.groups.map((g) => (
                          <label
                            key={g.group_id}
                            className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                          >
                            <Checkbox
                              checked={stageSel.has(s.stage_id) || groupSel.has(g.group_id)}
                              disabled={stageSel.has(s.stage_id) || !canManage}
                              onCheckedChange={() => toggleGroup(g.group_id)}
                            />
                            {g.group_name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {flags.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <IconAlertTriangle className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">{t("noFlags")}</p>
            <p className="max-w-sm text-xs text-muted-foreground">{t("noFlagsHint")}</p>
          </div>
        ) : (
          <>
            {/* Bulk accept/reject (owner 2026-07-13): apply one decision to every shown flag in a
                single recompute, instead of clicking each row (which re-scored the event each time). */}
            {canManage && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">{t("bulkLabel")}</span>
                <Button
                  type="button" size="sm" variant="outline" disabled={busy}
                  className="h-7 gap-1 border-green-500/40 text-[11px] text-green-500 hover:text-green-500"
                  onClick={() => bulkFlags(true)}
                >
                  {t("bulkAcceptAll")}
                </Button>
                <Button
                  type="button" size="sm" variant="outline" disabled={busy}
                  className="h-7 gap-1 border-orange-500/40 text-[11px] text-orange-400 hover:text-orange-400"
                  onClick={() => bulkFlags(false)}
                >
                  {t("bulkRejectAll")}
                </Button>
                <Button
                  type="button" size="sm" variant="ghost" disabled={busy}
                  className="h-7 text-[11px] text-muted-foreground"
                  onClick={() => bulkFlags(null)}
                >
                  {t("bulkFollowAll")}
                </Button>
              </div>
            )}
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">{t("colPlayer")}</TableHead>
                <TableHead className="text-xs">{t("colTeam")}</TableHead>
                <TableHead className="text-right text-xs">{t("colKills")}</TableHead>
                <TableHead className="text-xs">{t("colReason")}</TableHead>
                <TableHead className="text-xs">{t("colCount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((f) => (
                <TableRow key={f.flag_id}>
                  <TableCell className="py-2">
                    <div className="text-xs font-medium">{f.name || f.uid}</div>
                    <div className="text-[10px] text-muted-foreground">
                      UID {f.uid}
                      {f.registered_username ? ` · ${t("registeredAs", { name: f.registered_username })}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    {f.team_name ?? "-"}
                    {/* Which stage/group this flag was raised in (owner 2026-07-10 scoping). */}
                    <ScopeCaption stage={f.stage_name} group={f.group_name} />
                  </TableCell>
                  <TableCell className="py-2 text-right text-xs tabular-nums">{f.kills}</TableCell>
                  <TableCell className="py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] text-muted-foreground">
                        {t(REASON_KEY[f.reason] ?? "reasonNotOnRoster")}
                      </Badge>
                      {/* Pending pill: a name-matched / cross-team flag explicitly held at
                          count_kills=false until an admin approves it via the Count select. */}
                      {f.count_kills === false && (
                        <Badge variant="outline" className="rounded-full border-orange-500/40 px-2 py-0.5 text-[10px] text-orange-400">
                          {t("pending")}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <Select
                        value={toSel(f.count_kills)}
                        onValueChange={(v) => onChangeFlag(f, v)}
                        disabled={!canManage || busy}
                      >
                        <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">{t("optDefault")}</SelectItem>
                          <SelectItem value="count">{t("optCount")}</SelectItem>
                          <SelectItem value="exclude">{t("optExclude")}</SelectItem>
                        </SelectContent>
                      </Select>
                      {/* Resolved state badge: does this player's kills count right now? */}
                      <Badge
                        variant="outline"
                        className={
                          "rounded-full px-2 py-0.5 text-[10px] " +
                          (f.effective_count
                            ? "border-green-500/40 text-green-400"
                            : "border-muted-foreground/30 text-muted-foreground")
                        }
                      >
                        {f.effective_count ? t("counting") : t("excluded")}
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </>
        )}

        {/* Unmatched in-game teams (owner 2026-06-30): blocks from a match-log upload that matched NO
            registered team. Attribute each to a team (scores its placement + kills) or leave it on
            "Don't count". This is the team-level companion to the per-player flags above, so every
            upload-attribution decision lives on this one panel - no re-upload. Scoped by the SAME
            stage/group filter as the flags (owner 2026-07-10). */}
        {unmatched.length > 0 && (
          <div className="mt-4 space-y-2 border-t pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-orange-400">
                <IconAlertTriangle className="size-4" />
                {t("unmatchedTitle", { count: unmatched.length })}
              </div>
              {/* Bulk reject: leave every unmatched team block uncounted in one recompute. */}
              {canManage && unmatched.length > 1 && (
                <Button
                  type="button" size="sm" variant="outline" disabled={busy}
                  className="h-7 gap-1 border-orange-500/40 text-[11px] text-orange-400 hover:text-orange-400"
                  onClick={bulkRejectTeams}
                >
                  {t("bulkTeamsReject")}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t("unmatchedSubtitle")}</p>
            <div className="rounded-lg border divide-y">
              {unmatched.map((b) => (
                <div
                  key={b.block_id}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{b.team_name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {t("unmatchedMeta", { placement: b.placement, kills: b.kills })}
                    </div>
                    <ScopeCaption stage={b.stage_name} group={b.group_name} />
                  </div>
                  <Select
                    value={b.attributed_team_id ? String(b.attributed_team_id) : "none"}
                    onValueChange={(v) => onAttributeTeam(b, v === "none" ? "" : v)}
                    disabled={!canManage || busy}
                  >
                    <SelectTrigger className="h-8 w-[170px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("unmatchedDontCount")}</SelectItem>
                      {eventTeams.map((et) => (
                        <SelectItem
                          key={et.tournament_team_id}
                          value={String(et.tournament_team_id)}
                        >
                          {et.team_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
