"use client";

// ── Round-Robin stage builder panel (sub-project B) ─────────────────────────────
//
// Shared between the CREATE wizard (StageModal) and the EDIT flow (StageConfigModal)
// so the two never drift — mirrors how lib/eventFormats.ts centralises the stage
// formats. Rendered ONLY when a stage's format is "br - round robin"; hidden for
// every other bracket type (the caller guards the render).
//
// It edits a single `RoundRobinConfig` value (see types below) that the parent
// threads into the stage object → JSON-stringified into the create/edit FormData,
// exactly the way the Champion-Point / Point-Rush scoring-mode fields ride along.
//
// Backend contract (see backend/MINTROUTE… no — see the round-robin plan / views):
//   • round_robin_groups: [{ label, order, team_ids }]   team_ids are TEAM PKs.
//   • generate_schedule: true   → backend auto-pairs every base-group pair, one
//                                  pairing per game-day (round_robin.round_robin_schedule).
//   • games_per_day + maps       → propagate onto each auto-generated lobby.
//   • game_days: [{ game_day, source_group_ids, match_count, match_maps }]
//                                  → a MANUAL lobby list used when generate_schedule is off.
//
// Team assignment is only meaningful once the event has registered teams, so the
// team picker appears only when the caller passes `availableTeams` (the EDIT flow);
// on CREATE the admin sets up labels + schedule and assigns teams later via edit.

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, Minus } from "lucide-react";
import { InfoTip } from "@/components/ui/info-tip";
import { AVAILABLE_MAPS } from "../create/_components/types";

// ── Shared types ────────────────────────────────────────────────────────────────

// One fixed base group (A/B/C…). team_ids hold TEAM PKs (empty on create).
export interface RoundRobinGroupInput {
  label: string;
  order: number;
  team_ids: number[];
}

// One MANUAL game-day lobby: merges the chosen base groups (by their 0-based index
// in the groups array — resolved to real group ids server-side on save) for a day.
export interface RoundRobinGameDayInput {
  game_day: number;
  // 0-based indices into `groups` — index-based so it survives before the groups
  // have server ids (on create). The backend maps these to source_group_ids.
  source_group_indices: number[];
  match_count: number;
  match_maps: string[];
}

export interface RoundRobinConfig {
  round_robin_groups: RoundRobinGroupInput[];
  // Auto-pair every base-group pair (one pairing per game-day) instead of the
  // manual game_days list below.
  generate_schedule: boolean;
  games_per_day: number; // applied to every auto-generated lobby
  game_days: RoundRobinGameDayInput[]; // manual lobbies (used when generate_schedule is off)
}

// A registered team the admin can drop into a base group (EDIT flow only).
export interface RoundRobinTeamOption {
  team_id: number;
  team_name: string;
}

// Default config for a brand-new round-robin stage: two empty base groups (A, B),
// auto-schedule on, one game per day. Mirrors the "two groups" default the rest of
// the stage builder uses.
export const DEFAULT_ROUND_ROBIN_CONFIG: RoundRobinConfig = {
  round_robin_groups: [
    { label: "A", order: 0, team_ids: [] },
    { label: "B", order: 1, team_ids: [] },
  ],
  generate_schedule: true,
  games_per_day: 1,
  game_days: [],
};

// Next group label by order: A, B, C … then G7, G8 … past the alphabet.
function nextGroupLabel(count: number): string {
  return count < 26 ? String.fromCharCode(65 + count) : `G${count + 1}`;
}

// ── Panel props ─────────────────────────────────────────────────────────────────

interface RoundRobinPanelProps {
  config: RoundRobinConfig;
  onChange: (config: RoundRobinConfig) => void;
  // Registered teams to assign into base groups. Omitted on CREATE (no teams yet) —
  // the team picker is hidden and only labels + schedule are editable.
  availableTeams?: RoundRobinTeamOption[];
}

// ── Panel ───────────────────────────────────────────────────────────────────────

export function RoundRobinPanel({
  config,
  onChange,
  availableTeams,
}: RoundRobinPanelProps) {
  const groups = config.round_robin_groups;

  // ── Base-group helpers ───────────────────────────────────────────────────────

  const addGroup = () => {
    onChange({
      ...config,
      round_robin_groups: [
        ...groups,
        { label: nextGroupLabel(groups.length), order: groups.length, team_ids: [] },
      ],
    });
  };

  const removeGroup = (index: number) => {
    if (groups.length <= 1) return; // keep at least one base group
    const next = groups
      .filter((_, i) => i !== index)
      // re-pack order so it stays 0..n-1 with no gaps
      .map((g, i) => ({ ...g, order: i }));
    onChange({
      ...config,
      round_robin_groups: next,
      // Drop any manual lobby that referenced the removed group, and re-base the
      // remaining indices (everything past `index` shifts down by one).
      game_days: config.game_days
        .map((gd) => ({
          ...gd,
          source_group_indices: gd.source_group_indices
            .filter((gi) => gi !== index)
            .map((gi) => (gi > index ? gi - 1 : gi)),
        }))
        .filter((gd) => gd.source_group_indices.length > 0),
    });
  };

  const updateGroupLabel = (index: number, label: string) => {
    const next = [...groups];
    next[index] = { ...next[index], label };
    onChange({ ...config, round_robin_groups: next });
  };

  // Toggle a team into / out of a base group. A team belongs to exactly ONE base
  // group, so adding it here removes it from every other group first.
  const toggleTeamInGroup = (index: number, teamId: number) => {
    const isIn = groups[index].team_ids.includes(teamId);
    const next = groups.map((g, i) => {
      if (i === index) {
        return {
          ...g,
          team_ids: isIn
            ? g.team_ids.filter((t) => t !== teamId)
            : [...g.team_ids, teamId],
        };
      }
      // strip the team from any other group so it lives in only one
      return isIn ? g : { ...g, team_ids: g.team_ids.filter((t) => t !== teamId) };
    });
    onChange({ ...config, round_robin_groups: next });
  };

  // ── Manual game-day helpers ────────────────────────────────────────────────────

  const addGameDay = () => {
    onChange({
      ...config,
      game_days: [
        ...config.game_days,
        {
          game_day: config.game_days.length + 1,
          source_group_indices: [],
          match_count: config.games_per_day || 1,
          match_maps: ["Bermuda"],
        },
      ],
    });
  };

  const removeGameDay = (gdIndex: number) => {
    onChange({
      ...config,
      // re-number game_day so it stays 1..n after a removal
      game_days: config.game_days
        .filter((_, i) => i !== gdIndex)
        .map((gd, i) => ({ ...gd, game_day: i + 1 })),
    });
  };

  const updateGameDay = (
    gdIndex: number,
    patch: Partial<RoundRobinGameDayInput>,
  ) => {
    const next = [...config.game_days];
    next[gdIndex] = { ...next[gdIndex], ...patch };
    onChange({ ...config, game_days: next });
  };

  // Toggle a base group into / out of a manual lobby's merged set.
  const toggleSourceGroup = (gdIndex: number, groupIndex: number) => {
    const current = config.game_days[gdIndex].source_group_indices;
    updateGameDay(gdIndex, {
      source_group_indices: current.includes(groupIndex)
        ? current.filter((gi) => gi !== groupIndex)
        : [...current, groupIndex],
    });
  };

  // +/- a single map onto a manual lobby (mirrors the group map stepper).
  const addMapToGameDay = (gdIndex: number, map: string) => {
    updateGameDay(gdIndex, {
      match_maps: [...config.game_days[gdIndex].match_maps, map],
    });
  };
  const removeMapFromGameDay = (gdIndex: number, map: string) => {
    const current = config.game_days[gdIndex].match_maps;
    const last = current.lastIndexOf(map);
    if (last === -1) return;
    updateGameDay(gdIndex, {
      match_maps: current.filter((_, i) => i !== last),
    });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <p className="text-sm font-semibold text-primary">
        Round-Robin Setup
        <InfoTip id="events.create.rr_base_groups" className="ml-1" />
      </p>

      {/* ── Base Groups editor ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <Label className="block text-xs text-muted-foreground">Base Groups</Label>
        {groups.map((group, index) => (
          <div key={index} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-12 shrink-0">
                Group
              </span>
              <Input
                value={group.label}
                onChange={(e) => updateGroupLabel(index, e.target.value)}
                placeholder="A"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeGroup(index)}
                disabled={groups.length <= 1}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Team picker — only when the caller supplies registered teams (edit). */}
            {availableTeams && availableTeams.length > 0 ? (
              <div className="space-y-1.5">
                <Label className="block text-[11px] text-muted-foreground">
                  Teams in this group
                  <InfoTip id="events.create.rr_group_teams" className="ml-1" />
                </Label>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {availableTeams.map((team) => (
                    <label
                      key={team.team_id}
                      className="flex items-center gap-1.5 text-xs cursor-pointer"
                    >
                      <Checkbox
                        checked={group.team_ids.includes(team.team_id)}
                        onCheckedChange={() =>
                          toggleTeamInGroup(index, team.team_id)
                        }
                      />
                      <span>{team.team_name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">
                Assign teams to this group from the edit screen once the event has
                registrations.
              </p>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addGroup}
          className="w-full"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Base Group
        </Button>
      </div>

      <Separator />

      {/* ── Schedule ────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>
              Auto-generate round-robin schedule
              <InfoTip
                id="events.create.rr_generate_schedule"
                className="ml-1"
              />
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Every pair of base groups meets once, one pairing per game-day.
            </p>
          </div>
          <Switch
            checked={config.generate_schedule}
            onCheckedChange={(checked) =>
              onChange({ ...config, generate_schedule: checked })
            }
          />
        </div>

        {config.generate_schedule ? (
          // ── Auto path: just a games-per-day applied to every generated lobby. ──
          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">
              Games per day
              <InfoTip id="events.create.rr_games_per_day" className="ml-1" />
            </Label>
            <Input
              type="number"
              min={1}
              value={config.games_per_day === 0 ? "" : config.games_per_day}
              onChange={(e) =>
                onChange({
                  ...config,
                  games_per_day:
                    e.target.value === "" ? 0 : Number(e.target.value),
                })
              }
              placeholder="e.g. 1"
            />
          </div>
        ) : (
          // ── Manual path: explicit game-day lobbies (merge groups + count + maps). ──
          <div className="space-y-3">
            <Label className="block text-xs text-muted-foreground">
              Game Days
              <InfoTip id="events.create.rr_game_days" className="ml-1" />
            </Label>
            {config.game_days.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                No game days yet. Click below to add a lobby.
              </p>
            )}
            {config.game_days.map((gd, gdIndex) => (
              <div key={gdIndex} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">
                    Game Day {gd.game_day}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeGameDay(gdIndex)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Which base groups merge into this lobby. */}
                <div className="space-y-1.5">
                  <Label className="block text-[11px] text-muted-foreground">
                    Merge groups
                  </Label>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {groups.map((g, gi) => (
                      <label
                        key={gi}
                        className="flex items-center gap-1.5 text-xs cursor-pointer"
                      >
                        <Checkbox
                          checked={gd.source_group_indices.includes(gi)}
                          onCheckedChange={() => toggleSourceGroup(gdIndex, gi)}
                        />
                        <span>{g.label || `Group ${gi + 1}`}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Match count for this lobby. */}
                <div>
                  <Label className="mb-1.5 block text-[11px] text-muted-foreground">
                    Match count
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={gd.match_count === 0 ? "" : gd.match_count}
                    onChange={(e) =>
                      updateGameDay(gdIndex, {
                        match_count:
                          e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                  />
                </div>

                {/* Maps for this lobby (same +/- stepper as the group editor). */}
                <div>
                  <Label className="mb-1.5 block text-[11px] text-muted-foreground">
                    Maps
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_MAPS.map((map) => {
                      const count = gd.match_maps.filter(
                        (m) => m === map,
                      ).length;
                      return (
                        <div
                          key={map}
                          className={`flex items-center gap-1 border rounded-md px-2 py-1 text-xs ${
                            count > 0
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-muted text-foreground"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => removeMapFromGameDay(gdIndex, map)}
                            disabled={count === 0}
                            className="disabled:opacity-30 hover:opacity-70"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="min-w-[1.25rem] text-center font-medium">
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={() => addMapToGameDay(gdIndex, map)}
                            className="hover:opacity-70"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <span className="ml-1">{map}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addGameDay}
              className="w-full"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Game Day
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
