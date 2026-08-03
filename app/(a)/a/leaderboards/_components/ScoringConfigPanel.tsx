"use client";

// ── ScoringConfigPanel ───────────────────────────────────────────────────────
// The per-match SCORING configuration editor: kill point, points per assist, points
// per 1000 damage, and the placement-rank ladder, plus an "Apply to..." fan-out that
// copies the current config onto every match of a group / stage / the whole event.
//
// WHY IT EXISTS AS A SHARED COMPONENT (owner 2026-07-04 organizer parity):
//   This body used to live inline in the AFC admin edit page
//   (app/(a)/a/leaderboards/[id]/edit/page.tsx, "Scoring Config" tab). Organizers need
//   the SAME tool on THEIR events, so the JSX + its handlers were lifted here verbatim
//   and both surfaces now mount this one component:
//     • Admin  : app/(a)/a/leaderboards/[id]/edit/page.tsx  (Scoring Config tab)
//     • Organizer: app/(organizer)/organizer/events/[slug]/leaderboard/page.tsx
//                  ("Manage leaderboard tools" tabs, new "Scoring Config" tab)
//
// BACKEND: every save/apply POSTs /events/edit-match-scoring-config/
// (afc_tournament_and_scrims.views.edit_match_scoring_config). That endpoint stores
// match.scoring_settings ONLY (it does not recompute the stored per-map points), and it
// already authorises AFC event admins OR org members holding can_upload_results on the
// event's owning org - so no per-caller change is needed for the organizer. Because the
// endpoint does not recompute points, the single-match "Save Scoring Config" action
// calls back to the parent via onScoringSaved so the parent can re-save that map's
// results (which DOES recompute) and refresh. The admin passes its handleSaveMatch; the
// organizer re-saves the map's stored stats. The "Apply to..." fan-out mirrors the
// admin's original behaviour and does NOT trigger a recalc (config is copied only).
//
// SELECTION: controlled OR uncontrolled. The admin shares its selectedMatchId across the
// Match Results / Scoring / Upload tabs, so it passes selectedMatchId + onSelectMatch to
// keep the tabs in sync. The organizer has no such shared match cursor, so it omits those
// props and this panel manages its own selection (defaults to the group's first map).
//
// COPY: authored in English, matching the sibling reused admin leaderboard components
// (ManualMatchResultStep, MvpTab, TieBreakersPanel...). The organizer TAB LABEL that
// mounts this panel is i18n'd on that page; the panel's own copy is not.

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  IconDeviceFloppy,
  IconLoader2,
  IconSettings,
  IconMap,
  IconUsers,
  IconTrophy,
  IconPlus,
  IconX,
  IconChevronDown,
  IconCopy,
} from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

// The scoring_settings blob the backend stores per match and returns on
// get-all-leaderboard-details-for-event. Only the fields this editor reads are typed.
interface ScoringSettings {
  kill_point?: number;
  placement_points?: Record<string, number>;
  points_per_assist?: number;
  points_per_1000_damage?: number;
}

// Minimal match shape this panel needs. Both callers' match objects (admin MatchData,
// organizer's raw details rows) satisfy this structurally.
interface ScoringMatch {
  match_id: number;
  match_number?: number;
  match_map?: string;
  scoring_settings?: ScoringSettings;
}

// The editable, string-backed form of one match's scoring config (inputs are text).
// ranks is the placement ladder: ranks[i] = points for placement i+1.
interface MatchScoringConfig {
  killPoint: string;
  pointsPerAssist: string;
  pointsPer1000Damage: string;
  ranks: { id: string; val: string }[];
}

interface ScoringConfigPanelProps {
  // Every stage of the event, each with groups[].matches[] - drives the "Apply to..."
  // fan-out (this group / each stage / each group / entire event). Admin + organizer both
  // pass eventData?.stages ?? [].
  stages: any[];
  // Matches of the CURRENTLY SELECTED group: the match selector row + the source the
  // per-match config is seeded from (each match's scoring_settings).
  groupMatches: ScoringMatch[];
  // Bearer token for the edit-match-scoring-config POST.
  token: string | null;
  // Backend base URL (env.NEXT_PUBLIC_BACKEND_API_URL).
  apiBase: string;
  // Controlled selection (admin): the shared selectedMatchId + its setter. Omit for the
  // uncontrolled organizer mount, where this panel owns the selection internally.
  selectedMatchId?: number | null;
  onSelectMatch?: (matchId: number) => void;
  // Called after a SUCCESSFUL single-match "Save Scoring Config" POST with the saved
  // match id, so the parent can re-save that map's results (recompute points) + refresh.
  // The "Apply to..." fan-out does NOT call this (matches the admin's original behaviour).
  onScoringSaved?: (matchId: number) => void | Promise<void>;
}

// Minimum number of placement ranks always shown (Free Fire lobbies seat up to 12/18, but
// 10 is the historical floor the admin editor padded to). Extra saved ranks are kept.
const MIN_RANKS = 10;

export function ScoringConfigPanel({
  stages,
  groupMatches,
  token,
  apiBase,
  selectedMatchId,
  onSelectMatch,
  onScoringSaved,
}: ScoringConfigPanelProps) {
  // ── Selection (controlled vs uncontrolled) ──────────────────────────────────
  // When the parent supplies selectedMatchId we are CONTROLLED (admin, so the Scoring tab
  // tracks the Match Results / Upload tabs). Otherwise we keep our own cursor (organizer).
  const isControlled = selectedMatchId !== undefined;
  const [internalMatchId, setInternalMatchId] = useState<number | null>(null);
  const activeMatchId = isControlled ? selectedMatchId! : internalMatchId;
  const selectMatch = (matchId: number) => {
    if (isControlled) onSelectMatch?.(matchId);
    else setInternalMatchId(matchId);
  };

  // ── Per-match config state ──────────────────────────────────────────────────
  const [matchScoring, setMatchScoring] = useState<
    Record<number, MatchScoringConfig>
  >({});
  const [savingMatchScoring, setSavingMatchScoring] = useState(false);
  const [applyingToAll, setApplyingToAll] = useState(false);

  // Seed the editable config from each match's saved scoring_settings whenever the group's
  // matches change (group/stage switch, or a refetch after a save). Placement points are
  // sorted 1..N and padded up to MIN_RANKS so the ladder always shows at least 10 slots.
  // (Ported verbatim from the admin edit page's group-change effect.) For the uncontrolled
  // organizer mount we also default the internal selection to the group's first map.
  useEffect(() => {
    const initial: Record<number, MatchScoringConfig> = {};
    for (const m of groupMatches) {
      const s = m.scoring_settings;
      const placementPts = s?.placement_points ?? {};
      const rankEntries = Object.entries(placementPts)
        .map(([rank, val]) => ({ id: rank, val: String(val) }))
        .sort((a, b) => parseInt(a.id) - parseInt(b.id));
      const padded = [...rankEntries];
      for (let i = padded.length + 1; i <= MIN_RANKS; i++) {
        padded.push({ id: `new-${i}-${Date.now()}`, val: "0" });
      }
      initial[m.match_id] = {
        killPoint: s?.kill_point?.toString() ?? "1",
        pointsPerAssist: s?.points_per_assist?.toString() ?? "0",
        pointsPer1000Damage: s?.points_per_1000_damage?.toString() ?? "0",
        ranks: padded,
      };
    }
    setMatchScoring(initial);

    // Uncontrolled: keep the current selection if it is still in the group, else fall back
    // to the first map. (Controlled selection is owned by the parent, left untouched.)
    if (!isControlled) {
      setInternalMatchId((prev) =>
        prev != null && groupMatches.some((m) => m.match_id === prev)
          ? prev
          : (groupMatches[0]?.match_id ?? null),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupMatches]);

  // ── Match id lists for the "Apply to..." fan-out ────────────────────────────
  const groupMatchIds = groupMatches.map((m) => m.match_id);
  const allMatchIds: number[] =
    stages?.flatMap((s: any) =>
      (s.groups ?? []).flatMap((g: any) =>
        (g.matches ?? []).map((m: any) => m.match_id as number),
      ),
    ) ?? [];

  // ── Config field / rank editors ─────────────────────────────────────────────

  const updateMatchScoringField = (
    matchId: number,
    field: keyof Omit<MatchScoringConfig, "ranks">,
    value: string,
  ) => {
    setMatchScoring((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], [field]: value },
    }));
  };

  const updateMatchScoringRank = (
    matchId: number,
    rankIdx: number,
    val: string,
  ) => {
    setMatchScoring((prev) => {
      const config = prev[matchId];
      if (!config) return prev;
      const ranks = config.ranks.map((r, i) =>
        i === rankIdx ? { ...r, val } : r,
      );
      return { ...prev, [matchId]: { ...config, ranks } };
    });
  };

  const addMatchScoringRank = (matchId: number) => {
    setMatchScoring((prev) => {
      const config = prev[matchId];
      if (!config) return prev;
      return {
        ...prev,
        [matchId]: {
          ...config,
          ranks: [...config.ranks, { id: `add-${Date.now()}`, val: "0" }],
        },
      };
    });
  };

  const removeMatchScoringRank = (matchId: number, rankIdx: number) => {
    setMatchScoring((prev) => {
      const config = prev[matchId];
      if (!config) return prev;
      return {
        ...prev,
        [matchId]: {
          ...config,
          ranks: config.ranks.filter((_, i) => i !== rankIdx),
        },
      };
    });
  };

  // Build the scoring_settings payload the backend stores, from an editable config.
  // ranks[i] -> placement_points[i+1]; scalar fields parsed to numbers (blank -> 0).
  const configToSettings = (config: MatchScoringConfig) => {
    const placementPointsObj: Record<string, number> = {};
    config.ranks.forEach((r, idx) => {
      placementPointsObj[(idx + 1).toString()] = parseFloat(r.val) || 0;
    });
    return {
      kill_point: parseFloat(config.killPoint) || 0,
      placement_points: placementPointsObj,
      points_per_assist: parseFloat(config.pointsPerAssist) || 0,
      points_per_1000_damage: parseFloat(config.pointsPer1000Damage) || 0,
    };
  };

  // ── Save the current match's scoring config ─────────────────────────────────
  // POSTs edit-match-scoring-config for the selected map, then asks the parent to re-save
  // that map's results (onScoringSaved) so the stored points recompute against the new
  // config. Mirrors the admin page's original handleSaveMatchScoring -> handleSaveMatch.
  const handleSaveMatchScoring = async () => {
    if (activeMatchId === null) return;
    const config = matchScoring[activeMatchId];
    if (!config) return;

    setSavingMatchScoring(true);
    try {
      const res = await fetch(`${apiBase}/events/edit-match-scoring-config/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          match_id: activeMatchId,
          scoring_settings: configToSettings(config),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.detail || "Update failed");
      }

      toast.success("Match scoring configuration updated!");
      // Re-save the map's results so points are recalculated against the new config.
      await onScoringSaved?.(activeMatchId);
    } catch (err: any) {
      toast.error(err.message || "Failed to update scoring");
    } finally {
      setSavingMatchScoring(false);
    }
  };

  // ── Apply the current config to many matches at once ────────────────────────
  // Copies the on-screen config to every match in matchIds (this group / a stage / a group
  // / the whole event). Fires one edit-match-scoring-config POST per match, then updates any
  // of those matches already loaded in the current group so the UI reflects the copy. Does
  // NOT trigger a results recalc (matches the admin's original behaviour).
  const handleApplyScoringToMatches = async (
    matchIds: number[],
    label: string,
  ) => {
    if (activeMatchId === null) return;
    const config = matchScoring[activeMatchId];
    if (!config) return;

    const scoringSettings = configToSettings(config);

    setApplyingToAll(true);
    try {
      const results = await Promise.allSettled(
        matchIds.map((matchId) =>
          fetch(`${apiBase}/events/edit-match-scoring-config/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              match_id: matchId,
              scoring_settings: scoringSettings,
            }),
          }),
        ),
      );

      const failed = results.filter((r) => r.status === "rejected").length;

      // Update local state for any matches already loaded in the current group.
      setMatchScoring((prev) => {
        const updated = { ...prev };
        for (const matchId of matchIds) {
          if (matchId in updated) {
            updated[matchId] = {
              killPoint: config.killPoint,
              pointsPerAssist: config.pointsPerAssist,
              pointsPer1000Damage: config.pointsPer1000Damage,
              ranks: config.ranks.map((r) => ({ ...r })),
            };
          }
        }
        return updated;
      });

      if (failed > 0) {
        toast.warning(
          `Applied to ${matchIds.length - failed} match${matchIds.length - failed !== 1 ? "es" : ""}. ${failed} failed.`,
        );
      } else {
        toast.success(
          `Scoring applied to ${matchIds.length} match${matchIds.length !== 1 ? "es" : ""} - ${label}!`,
        );
      }
    } catch {
      toast.error("Failed to apply scoring configuration");
    } finally {
      setApplyingToAll(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (groupMatches.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No matches found for this group.
        </CardContent>
      </Card>
    );
  }

  const config =
    activeMatchId !== null ? matchScoring[activeMatchId] : undefined;

  return (
    <div className="space-y-4">
      {/* Match selector */}
      <div className="flex gap-2 flex-wrap">
        {groupMatches.map((m) => (
          <Button
            key={m.match_id}
            variant={activeMatchId === m.match_id ? "default" : "secondary"}
            size="sm"
            onClick={() => selectMatch(m.match_id)}
          >
            {m.match_map}
          </Button>
        ))}
      </div>

      {activeMatchId !== null && config && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scoring Configuration</CardTitle>
            <CardDescription>
              Edit scoring for{" "}
              {groupMatches.find((m) => m.match_id === activeMatchId)?.match_map}{" "}
              - Match{" "}
              {
                groupMatches.find((m) => m.match_id === activeMatchId)
                  ?.match_number
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Scalar fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg">
              <div className="space-y-2">
                <Label>Kill Point</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={config.killPoint}
                  onChange={(e) =>
                    updateMatchScoringField(
                      activeMatchId,
                      "killPoint",
                      e.target.value,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Pts / Assist</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={config.pointsPerAssist}
                  onChange={(e) =>
                    updateMatchScoringField(
                      activeMatchId,
                      "pointsPerAssist",
                      e.target.value,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Pts / 1000 Dmg</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={config.pointsPer1000Damage}
                  onChange={(e) =>
                    updateMatchScoringField(
                      activeMatchId,
                      "pointsPer1000Damage",
                      e.target.value,
                    )
                  }
                />
              </div>
            </div>

            {/* Placement points */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Placement Points</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addMatchScoringRank(activeMatchId)}
                >
                  <IconPlus size={12} className="mr-1" /> Add Rank
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {config.ranks.map((r, i) => (
                  <Card key={r.id} className="py-1 group relative border">
                    <CardContent className="p-2">
                      <div className="flex justify-between items-center mb-1">
                        <Label className="text-xs text-muted-foreground">
                          Rank {i + 1}
                        </Label>
                        {config.ranks.length > 10 && (
                          <button
                            onClick={() =>
                              removeMatchScoringRank(activeMatchId, i)
                            }
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          >
                            <IconX size={10} />
                          </button>
                        )}
                      </div>
                      <Input
                        type="number"
                        min="0"
                        value={r.val}
                        onChange={(e) =>
                          updateMatchScoringRank(activeMatchId, i, e.target.value)
                        }
                        className="h-8"
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              {/* Apply to multiple matches */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={applyingToAll || savingMatchScoring}
                  >
                    {applyingToAll ? (
                      <span className="flex items-center gap-2">
                        <IconLoader2 size={14} className="animate-spin" />
                        Applying…
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <IconCopy size={14} />
                        Apply to…
                        <IconChevronDown size={12} />
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-72 max-h-96 overflow-y-auto"
                >
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    Copy current config to…
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {/* Current group - quick access */}
                  <DropdownMenuItem
                    onClick={() =>
                      handleApplyScoringToMatches(groupMatchIds, `this group`)
                    }
                  >
                    <IconMap
                      size={14}
                      className="mr-2 text-muted-foreground"
                    />
                    This group
                    <span className="ml-auto text-xs text-muted-foreground">
                      {groupMatchIds.length} match
                      {groupMatchIds.length !== 1 ? "es" : ""}
                    </span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Dynamic: every stage + each of its groups */}
                  {(stages ?? []).map((stage: any) => {
                    const stageIds: number[] = (stage.groups ?? []).flatMap(
                      (g: any) =>
                        (g.matches ?? []).map((m: any) => m.match_id as number),
                    );
                    return (
                      <DropdownMenuGroup key={stage.stage_id}>
                        {/* Stage row */}
                        <DropdownMenuItem
                          onClick={() =>
                            handleApplyScoringToMatches(
                              stageIds,
                              stage.stage_name,
                            )
                          }
                        >
                          <IconTrophy
                            size={14}
                            className="mr-2 text-muted-foreground"
                          />
                          <span className="font-medium">
                            {stage.stage_name}
                          </span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {stageIds.length} match
                            {stageIds.length !== 1 ? "es" : ""}
                          </span>
                        </DropdownMenuItem>

                        {/* Group rows (indented) */}
                        {(stage.groups ?? []).map((group: any) => {
                          const groupIds: number[] = (
                            group.matches ?? []
                          ).map((m: any) => m.match_id as number);
                          return (
                            <DropdownMenuItem
                              key={group.group_id}
                              className="pl-8"
                              onClick={() =>
                                handleApplyScoringToMatches(
                                  groupIds,
                                  `${stage.stage_name} › ${group.group_name}`,
                                )
                              }
                            >
                              <IconUsers
                                size={13}
                                className="mr-2 text-muted-foreground"
                              />
                              {group.group_name}
                              <span className="ml-auto text-xs text-muted-foreground">
                                {groupIds.length} match
                                {groupIds.length !== 1 ? "es" : ""}
                              </span>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuGroup>
                    );
                  })}

                  <DropdownMenuSeparator />

                  {/* Entire event */}
                  <DropdownMenuItem
                    onClick={() =>
                      handleApplyScoringToMatches(allMatchIds, `entire event`)
                    }
                  >
                    <IconSettings
                      size={14}
                      className="mr-2 text-muted-foreground"
                    />
                    Entire event
                    <span className="ml-auto text-xs text-muted-foreground">
                      {allMatchIds.length} match
                      {allMatchIds.length !== 1 ? "es" : ""}
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Save current match only */}
              <Button
                onClick={handleSaveMatchScoring}
                disabled={savingMatchScoring || applyingToAll}
              >
                {savingMatchScoring ? (
                  <span className="flex items-center gap-2">
                    <IconLoader2 size={14} className="animate-spin" />
                    Saving…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <IconDeviceFloppy size={14} />
                    Save Scoring Config
                  </span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
