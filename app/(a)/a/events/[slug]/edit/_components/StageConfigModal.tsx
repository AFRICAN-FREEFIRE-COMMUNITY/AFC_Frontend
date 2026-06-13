"use client";

import { useFormContext } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EyeIcon, EyeOffIcon, Trash2, Plus, Minus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { InfoTip } from "@/components/ui/info-tip";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import {
  AVAILABLE_MAPS,
  STAGE_FORMATS,
  formattedWord,
  type EventFormType,
} from "../types";
// Shared Round-Robin builder (sub-project B) - same panel used by the create flow.
import {
  RoundRobinPanel,
  type RoundRobinConfig,
  type RoundRobinTeamOption,
} from "../../../_components/RoundRobinPanel";

// ── Reusable Prize Pool Section ────────────────────────────────────────────────

interface PrizePoolSectionProps {
  prizepool: string;
  prizepoolCashValue: string;
  prizeDistribution: Record<string, string>;
  onPrizepoolChange: (val: string) => void;
  onPrizepoolCashChange: (val: string) => void;
  onDistributionChange: (dist: Record<string, string>) => void;
  label?: string;
}

function PrizePoolSection({
  prizepool,
  prizepoolCashValue,
  prizeDistribution,
  onPrizepoolChange,
  onPrizepoolCashChange,
  onDistributionChange,
  label = "Prize Pool",
}: PrizePoolSectionProps) {
  const addPosition = () => {
    const nextPos = Object.keys(prizeDistribution).length + 1;
    const suffix =
      nextPos === 1 ? "st" : nextPos === 2 ? "nd" : nextPos === 3 ? "rd" : "th";
    onDistributionChange({ ...prizeDistribution, [`${nextPos}${suffix}`]: "" });
  };

  const removePosition = (key: string) => {
    if (Object.keys(prizeDistribution).length <= 1) return;
    const updated = { ...prizeDistribution };
    delete updated[key];
    onDistributionChange(updated);
  };

  const updatePosition = (key: string, value: string) => {
    onDistributionChange({ ...prizeDistribution, [key]: value });
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <p className="text-sm font-semibold text-primary">{label}</p>

      <div className="grid gap-3">
        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">
            Prize Label{" "}
            <span className="text-zinc-400">(e.g. "5000 Diamonds")</span>
          </Label>
          <Input
            value={prizepool}
            onChange={(e) => onPrizepoolChange(e.target.value)}
            placeholder="e.g. 5000 Diamonds"
          />
        </div>
        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">
            Cash Value <span className="text-zinc-400">(e.g. "$500")</span>
          </Label>
          <Input
            value={prizepoolCashValue}
            onChange={(e) => onPrizepoolCashChange(e.target.value)}
            placeholder="e.g. $500"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="block text-xs text-muted-foreground">
          Prize Distribution
        </Label>
        {Object.keys(prizeDistribution).length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            No positions yet. Click below to add one.
          </p>
        )}
        {Object.entries(prizeDistribution).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <Input
              value={key}
              disabled
              className="w-16 text-center shrink-0 text-xs"
            />
            <Input
              value={value}
              onChange={(e) => updatePosition(key, e.target.value)}
              placeholder="e.g. $200 or 1000 Diamonds"
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removePosition(key)}
              disabled={Object.keys(prizeDistribution).length <= 1}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPosition}
          className="w-full"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Prize Position
        </Button>
      </div>
    </div>
  );
}

// ── Modal Props ────────────────────────────────────────────────────────────────

interface StageConfigModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  stageModalStep: number;
  setStageModalStep: (step: number) => void;
  editingStageIndex: number | null;
  stageNames: string[];
  stageModalData: {
    stage_id?: number;
    stage_name: string;
    start_date: string;
    end_date: string;
    stage_format: string;
    number_of_groups: number;
    teams_qualifying_from_stage: number;
    stage_discord_role_id: string;
    total_teams_in_stage: number;
    prizepool: string;
    prizepool_cash_value: string;
    prize_distribution: Record<string, string>;
    // ── Scoring-mode config (sub-project A). Independent + combinable toggles. ──
    champion_point_enabled: boolean;
    champion_point_threshold?: number;
    point_rush_enabled: boolean;
    point_rush_reward: Record<string, number>; // {"1":10,"2":7,...} placement→bonus
    point_rush_target_index?: number; // 0-based index of the LATER stage that banks the bonus
    // ── Round-Robin config (sub-project B) - only for "br - round robin" stages. ──
    round_robin: RoundRobinConfig;
  };
  setStageModalData: (data: any) => void;
  tempGroups: any[];
  setTempGroups: (groups: any[]) => void;
  handleGroupCountChangeLogic: (count: number) => void;
  updateGroupDetailLogic: (index: number, field: string, value: any) => void;
  onAddMap: (groupIndex: number, map: string) => void;
  onRemoveMap: (groupIndex: number, map: string) => void;
  handleSaveStageLogic: () => void;
  passwordVisibility: Record<number, boolean>;
  toggleVisibility: (groupIndex: number) => void;
  // Registered teams (TEAM PK + name) the admin can drop into round-robin base
  // groups. Comes from the event's tournament_teams.
  availableTeams: RoundRobinTeamOption[];
  // ── Discord omission (organizer reuse) ──────────────────────────────────────
  // When true, every Discord Role ID input (stage-level + per-group) is hidden and
  // the "Stage Discord Role ID" requirement is dropped from the Step 1 "Next" gate.
  // The organizer edit page passes this so organizers never touch AFC's Discord
  // automation; the admin edit page leaves it undefined (defaults false) so its
  // behaviour is completely unchanged. The empty stage_discord_role_id / group
  // group_discord_role_id values still ride in the payload, keeping the stage shape
  // identical to the admin one (matches the create flow's StageModal hideDiscord).
  hideDiscord?: boolean;
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

export function StageConfigModal({
  isOpen,
  onOpenChange,
  stageModalStep,
  setStageModalStep,
  editingStageIndex,
  stageNames,
  stageModalData,
  setStageModalData,
  tempGroups,
  setTempGroups,
  handleGroupCountChangeLogic,
  updateGroupDetailLogic,
  onAddMap,
  onRemoveMap,
  handleSaveStageLogic,
  passwordVisibility,
  toggleVisibility,
  availableTeams,
  hideDiscord = false,
}: StageConfigModalProps) {
  const form = useFormContext<EventFormType>();

  // Round-robin stages are defined ENTIRELY by the base groups + schedule in the
  // Round-Robin panel: the classic "Number of Groups" field and the Step-2 per-group
  // config (match count / maps) are ignored by the backend for this format, so they are
  // hidden and Step 2 is skipped (owner 2026-06-13, matching the create wizard).
  const isRoundRobin = stageModalData.stage_format === "br - round robin";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] overflow-auto justify-start flex-col gap-0">
        <DialogHeader>
          <DialogTitle>
            {stageModalStep === 1 ? "Stage Details" : "Configure Groups"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mb-4">
            Step {stageModalStep} of 2 (Configuration for{" "}
            {editingStageIndex !== null
              ? stageNames[editingStageIndex]
              : "New Stage"}
            )
          </p>
        </DialogHeader>

        {/* ── STEP 1: Stage Info + Stage Prize Pool ──────────────────────── */}
        {stageModalStep === 1 && (
          <div className="space-y-4">
            <div>
              <Label className="mb-2.5">Stage Name</Label>
              <Input
                value={stageModalData.stage_name}
                onChange={(e) =>
                  setStageModalData({
                    ...stageModalData,
                    stage_name: e.target.value,
                  })
                }
                placeholder="e.g., Group Stage, Finals"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-2.5">Start Date</Label>
                <Input
                  type="date"
                  value={stageModalData.start_date}
                  onChange={(e) =>
                    setStageModalData({
                      ...stageModalData,
                      start_date: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label className="mb-2.5">End Date</Label>
                <Input
                  type="date"
                  value={stageModalData.end_date}
                  onChange={(e) =>
                    setStageModalData({
                      ...stageModalData,
                      end_date: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div>
              <Label className="mb-2.5">
                Stage Format
                {/* Reuse the create-wizard copy - identical scoring control. */}
                <InfoTip id="events.create.stage_format" className="ml-1" />
              </Label>
              <Select
                value={stageModalData.stage_format}
                onValueChange={(value) =>
                  setStageModalData({
                    ...stageModalData,
                    stage_format: value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_FORMATS.map((format) => (
                    <SelectItem key={format} value={format}>
                      {formattedWord[format]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Round-Robin builder (sub-project B): only for the BR Round-Robin
                bracket. On edit the event has registrations, so the base-group team
                picker is live (availableTeams = the event's tournament_teams). The
                per-group Step-2 config is ignored by the backend for this format. */}
            {stageModalData.stage_format === "br - round robin" && (
              <RoundRobinPanel
                config={stageModalData.round_robin}
                onChange={(rr) =>
                  setStageModalData({ ...stageModalData, round_robin: rr })
                }
                availableTeams={availableTeams}
              />
            )}

            {/* ── Scoring modes (sub-project A): Champion-Point + Point-Rush ──────────
                Both are independent per-stage toggles. Champion-Point is a match-point
                win rule; Point-Rush banks this stage's placement bonus into a later
                stage. They can be on together. */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <p className="text-sm font-semibold text-primary">
                Scoring Modes (optional)
              </p>

              {/* Champion-Point toggle + threshold */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>
                      Champion-Point
                      <InfoTip
                        id="events.create.champion_point"
                        className="ml-1"
                      />
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      First team to Booyah while already at/above the threshold
                      wins the stage.
                    </p>
                  </div>
                  <Switch
                    checked={stageModalData.champion_point_enabled}
                    onCheckedChange={(checked) =>
                      setStageModalData({
                        ...stageModalData,
                        champion_point_enabled: checked,
                      })
                    }
                  />
                </div>
                {stageModalData.champion_point_enabled && (
                  <div>
                    <Label className="mb-2.5">Champion Point Threshold</Label>
                    <Input
                      type="number"
                      min={1}
                      value={stageModalData.champion_point_threshold ?? ""}
                      onChange={(e) =>
                        setStageModalData({
                          ...stageModalData,
                          champion_point_threshold:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        })
                      }
                      placeholder="e.g. 80"
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* Point-Rush toggle + reward table + target later-stage */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>
                      Point-Rush
                      <InfoTip id="events.create.point_rush" className="ml-1" />
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Award per-lobby placement bonuses here and bank them into a
                      later stage.
                    </p>
                  </div>
                  <Switch
                    checked={stageModalData.point_rush_enabled}
                    onCheckedChange={(checked) =>
                      setStageModalData({
                        ...stageModalData,
                        point_rush_enabled: checked,
                      })
                    }
                  />
                </div>

                {stageModalData.point_rush_enabled && (
                  <div className="space-y-3">
                    {/* Reward table: rows of placement → bonus points (add/remove). */}
                    <div className="space-y-2">
                      <Label className="block text-xs text-muted-foreground">
                        Placement Rewards
                      </Label>
                      {Object.keys(stageModalData.point_rush_reward).length ===
                        0 && (
                        <p className="text-xs text-muted-foreground italic">
                          No rewards yet. Click below to add a placement.
                        </p>
                      )}
                      {Object.entries(stageModalData.point_rush_reward).map(
                        ([placement, points]) => (
                          <div
                            key={placement}
                            className="flex items-center gap-2"
                          >
                            <span className="text-xs text-muted-foreground w-16 shrink-0">
                              Place {placement}
                            </span>
                            <Input
                              type="number"
                              min={0}
                              value={points}
                              onChange={(e) =>
                                setStageModalData({
                                  ...stageModalData,
                                  point_rush_reward: {
                                    ...stageModalData.point_rush_reward,
                                    [placement]:
                                      e.target.value === ""
                                        ? 0
                                        : Number(e.target.value),
                                  },
                                })
                              }
                              placeholder="bonus points"
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const updated = {
                                  ...stageModalData.point_rush_reward,
                                };
                                delete updated[placement];
                                setStageModalData({
                                  ...stageModalData,
                                  point_rush_reward: updated,
                                });
                              }}
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ),
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Next placement = highest existing + 1 (defaults to 1).
                          const keys = Object.keys(
                            stageModalData.point_rush_reward,
                          ).map(Number);
                          const next = keys.length ? Math.max(...keys) + 1 : 1;
                          setStageModalData({
                            ...stageModalData,
                            point_rush_reward: {
                              ...stageModalData.point_rush_reward,
                              [String(next)]: 0,
                            },
                          });
                        }}
                        className="w-full"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Placement Reward
                      </Button>
                    </div>

                    {/* Target stage: only stages AFTER the one being edited. */}
                    <div>
                      <Label className="mb-2.5">Carry-Over Target Stage</Label>
                      <Select
                        value={
                          stageModalData.point_rush_target_index === undefined
                            ? ""
                            : String(stageModalData.point_rush_target_index)
                        }
                        onValueChange={(value) =>
                          setStageModalData({
                            ...stageModalData,
                            point_rush_target_index: Number(value),
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a later stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {stageNames
                            // keep each stage's original index, then drop this stage + earlier ones
                            .map((name, idx) => ({ name, idx }))
                            .filter(
                              ({ idx }) =>
                                editingStageIndex === null ||
                                idx > editingStageIndex,
                            )
                            .map(({ name, idx }) => (
                              <SelectItem key={idx} value={String(idx)}>
                                {name || `Stage ${idx + 1}`}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {stageNames.filter(
                        (_, idx) =>
                          editingStageIndex === null ||
                          idx > editingStageIndex,
                      ).length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Add a later stage to use as the carry-over target.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label className="mb-2.5">Teams Qualifying from this Stage</Label>
              <Input
                type="number"
                min={0}
                value={
                  stageModalData.teams_qualifying_from_stage === undefined ||
                  stageModalData.teams_qualifying_from_stage === 0
                    ? ""
                    : stageModalData.teams_qualifying_from_stage
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setStageModalData({
                    ...stageModalData,
                    teams_qualifying_from_stage: val === "" ? 0 : Number(val),
                  });
                }}
              />
            </div>

            {/* Classic "Number of Groups" - NOT used for round-robin (its base groups
                above define the structure), so it is hidden for that format. */}
            {isRoundRobin ? (
              <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
                This is a round-robin stage. Its lobbies come from the base groups and
                schedule above, so there is no separate "number of groups" or per-group
                map setup. "Games per day" above sets how many matches each lobby runs.
              </p>
            ) : (
              <div>
                <Label className="mb-2.5">
                  Number of Groups
                  <InfoTip id="events.create.number_of_groups" className="ml-1" />
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={
                    stageModalData.number_of_groups === 0
                      ? ""
                      : stageModalData.number_of_groups
                  }
                  onChange={(e) =>
                    handleGroupCountChangeLogic(
                      e.target.value === "" ? 0 : Number(e.target.value),
                    )
                  }
                />
              </div>
            )}

            {/* Stage Discord Role ID — hidden in the organizer flow (hideDiscord).
                The empty stage_discord_role_id still rides in the payload so the
                stage shape stays identical to the admin one. */}
            {!hideDiscord && (
              <div>
                <Label className="mb-2.5">Stage Discord Role ID</Label>
                <Input
                  value={stageModalData.stage_discord_role_id}
                  onChange={(e) =>
                    setStageModalData({
                      ...stageModalData,
                      stage_discord_role_id: e.target.value,
                    })
                  }
                  placeholder="e.g: 1234567890"
                />
              </div>
            )}

            <Separator />

            {/* Stage-level prize pool */}
            <PrizePoolSection
              label="Stage Prize Pool (optional)"
              prizepool={stageModalData.prizepool}
              prizepoolCashValue={stageModalData.prizepool_cash_value}
              prizeDistribution={stageModalData.prize_distribution}
              onPrizepoolChange={(val) =>
                setStageModalData({ ...stageModalData, prizepool: val })
              }
              onPrizepoolCashChange={(val) =>
                setStageModalData({
                  ...stageModalData,
                  prizepool_cash_value: val,
                })
              }
              onDistributionChange={(dist) =>
                setStageModalData({
                  ...stageModalData,
                  prize_distribution: dist,
                })
              }
            />

            {/* Group preview only for classic formats - round-robin has no Step 2. */}
            {!isRoundRobin && (
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-3">
                  You will configure {stageModalData.number_of_groups} group(s) in
                  the next step
                </p>
                <div className="flex gap-2 flex-wrap">
                  {tempGroups
                    .slice(0, stageModalData.number_of_groups)
                    .map((group, i) => (
                      <div
                        key={i}
                        className="px-3 py-1 border border-primary rounded-md text-xs"
                      >
                        {group.group_name}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Groups Config + Group Prize Pools ──────────────────── */}
        {stageModalStep === 2 && (
          <div className="space-y-2">
            {/* Stage summary */}
            <div className="border border-primary/50 rounded-lg p-4">
              <p className="text-sm">
                <span className="font-semibold">Stage:</span>{" "}
                {stageModalData.stage_name}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {formatDate(stageModalData.start_date)} to{" "}
                {formatDate(stageModalData.end_date)} •{" "}
                {formattedWord[stageModalData.stage_format]}
              </p>
              {stageModalData.prizepool && (
                <p className="text-xs text-primary mt-1">
                  Stage Prize: {stageModalData.prizepool}
                  {stageModalData.prizepool_cash_value
                    ? ` (${stageModalData.prizepool_cash_value})`
                    : ""}
                </p>
              )}
            </div>

            {tempGroups.map((group, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm md:text-base">
                    Group {index + 1}
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    {group.group_name}
                  </span>
                </div>

                {/* Group Name */}
                <div>
                  <Label className="mb-2.5">Group Name</Label>
                  <Input
                    value={group.group_name}
                    onChange={(e) =>
                      updateGroupDetailLogic(
                        index,
                        "group_name",
                        e.target.value,
                      )
                    }
                    placeholder={`Group ${index + 1}`}
                  />
                </div>

                {/* Playing Date & Time */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="mb-2.5">Playing Date</Label>
                    <Input
                      type="date"
                      value={group.playing_date}
                      onChange={(e) =>
                        updateGroupDetailLogic(
                          index,
                          "playing_date",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label className="mb-2.5">Playing Time</Label>
                    <Input
                      type="time"
                      value={group.playing_time}
                      onChange={(e) =>
                        updateGroupDetailLogic(
                          index,
                          "playing_time",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                </div>

                {/* Teams Qualifying */}
                <div>
                  <Label className="mb-2.5">
                    Teams Qualifying from this Group
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={
                      group.teams_qualifying === 0 ? "" : group.teams_qualifying
                    }
                    onChange={(e) =>
                      updateGroupDetailLogic(
                        index,
                        "teams_qualifying",
                        e.target.value === "" ? 0 : Number(e.target.value),
                      )
                    }
                  />
                </div>

                {/* Match Count */}
                <div>
                  <Label className="mb-2.5">
                    Match count
                    <InfoTip id="events.create.match_count" className="ml-1" />
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={group.match_count === 0 ? "" : group.match_count}
                    onChange={(e) =>
                      updateGroupDetailLogic(
                        index,
                        "match_count",
                        e.target.value === "" ? 0 : Number(e.target.value),
                      )
                    }
                  />
                </div>

                {/* Discord Role — hidden in the organizer flow (hideDiscord).
                    The empty group_discord_role_id still rides in the payload. */}
                {!hideDiscord && (
                  <div>
                    <Label className="mb-2.5">Discord Role ID</Label>
                    <Input
                      value={group.group_discord_role_id}
                      onChange={(e) =>
                        updateGroupDetailLogic(
                          index,
                          "group_discord_role_id",
                          e.target.value,
                        )
                      }
                      placeholder="e.g: 1234567890"
                    />
                  </div>
                )}

                {/* Maps */}
                <div>
                  <Label className="mb-2.5">
                    Maps to be Played <span className="text-red-500">*</span>
                    <InfoTip id="events.create.match_maps" className="ml-1" />
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_MAPS.map((map) => {
                      const count = (group.match_maps || []).filter(
                        (m: string) => m === map,
                      ).length;
                      return (
                        <div
                          key={map}
                          className={`flex items-center gap-1 border rounded-md px-2 py-1 text-sm ${
                            count > 0
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-muted text-foreground"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onRemoveMap(index, map)}
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
                            onClick={() => onAddMap(index, map)}
                            className="hover:opacity-70"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <span className="ml-1">{map}</span>
                        </div>
                      );
                    })}
                  </div>
                  {(!group.match_maps || group.match_maps.length === 0) && (
                    <p className="text-xs text-red-500 mt-1">
                      Please select at least one map
                    </p>
                  )}
                  {group.match_maps && group.match_maps.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Selected: {group.match_maps.join(", ")}
                    </p>
                  )}
                </div>

                {/* Room fields */}
                <div>
                  <Label className="mb-2.5">Room ID</Label>
                  <Input
                    value={group.room_id}
                    onChange={(e) =>
                      updateGroupDetailLogic(index, "room_id", e.target.value)
                    }
                    placeholder={`Room ${index + 1}`}
                  />
                </div>

                <div>
                  <Label className="mb-2.5">Room name</Label>
                  <Input
                    value={group.room_name}
                    onChange={(e) =>
                      updateGroupDetailLogic(index, "room_name", e.target.value)
                    }
                    placeholder="Room name"
                  />
                </div>

                <div>
                  <Label className="mb-2.5">Room password</Label>
                  <div className="relative">
                    <Input
                      type={passwordVisibility[index] ? "text" : "password"}
                      value={group.room_password || ""}
                      onChange={(e) =>
                        updateGroupDetailLogic(
                          index,
                          "room_password",
                          e.target.value,
                        )
                      }
                      className="pr-10"
                      placeholder="Enter room password"
                    />
                    <Button
                      className="absolute top-[50%] translate-y-[-50%] end-1 text-muted-foreground/80"
                      variant="ghost"
                      size="icon"
                      type="button"
                      onClick={() => toggleVisibility(index)}
                      aria-label={
                        passwordVisibility[index]
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      {passwordVisibility[index] ? (
                        <EyeOffIcon className="size-4" />
                      ) : (
                        <EyeIcon className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Group-level prize pool */}
                <PrizePoolSection
                  label="Group Prize Pool (optional)"
                  prizepool={group.prizepool ?? ""}
                  prizepoolCashValue={group.prizepool_cash_value ?? ""}
                  prizeDistribution={group.prize_distribution ?? {}}
                  onPrizepoolChange={(val) =>
                    updateGroupDetailLogic(index, "prizepool", val)
                  }
                  onPrizepoolCashChange={(val) =>
                    updateGroupDetailLogic(index, "prizepool_cash_value", val)
                  }
                  onDistributionChange={(dist) =>
                    updateGroupDetailLogic(index, "prize_distribution", dist)
                  }
                />
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="flex justify-between mt-4">
          <div>
            {stageModalStep === 2 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStageModalStep(1)}
                className="w-full"
              >
                Back
              </Button>
            )}
          </div>

          <div className="flex justify-between items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
                setStageModalStep(1);
              }}
            >
              Cancel
            </Button>

            {stageModalStep === 1 ? (
              <Button
                type="button"
                onClick={() => {
                  if (
                    !stageModalData.stage_name ||
                    !stageModalData.stage_format ||
                    !stageModalData.start_date ||
                    !stageModalData.end_date ||
                    // Stage Discord Role ID is only required when the Discord inputs
                    // are shown (admin flow). The organizer flow hides them, so it is
                    // not part of the gate there.
                    (!hideDiscord && !stageModalData.stage_discord_role_id) ||
                    stageModalData.teams_qualifying_from_stage === undefined
                  ) {
                    toast.error(
                      "Please fill all required stage fields (Step 1)",
                    );
                    return;
                  }
                  // Round-robin: no classic groups, no Step 2 - save from Step 1
                  // (handleSaveStageLogic validates the base groups for this format).
                  if (isRoundRobin) {
                    handleSaveStageLogic();
                    return;
                  }
                  if (stageModalData.number_of_groups < 1) {
                    toast.error("Number of groups must be at least 1.");
                    return;
                  }
                  setStageModalStep(2);
                }}
              >
                {isRoundRobin ? "Save Stage" : "Next: Configure Groups"}
              </Button>
            ) : (
              <Button type="button" onClick={handleSaveStageLogic}>
                Save Stage
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
