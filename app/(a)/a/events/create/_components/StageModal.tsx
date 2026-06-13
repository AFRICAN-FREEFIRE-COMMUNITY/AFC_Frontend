// "use client";

// import React from "react";
// import { toast } from "sonner";
// import {
//   Dialog,
//   DialogContent,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Badge } from "@/components/ui/badge";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { formatDate } from "@/lib/utils";
// import { AVAILABLE_MAPS, FORMATTED_WORD, GroupType, STAGE_FORMATS, StageType } from "./types";

// export interface StageModalData {
//   stage_name: string;
//   start_date: string;
//   end_date: string;
//   stage_format: string;
//   number_of_groups: number;
//   teams_qualifying_from_stage: number;
//   stage_discord_role_id: string;
// }

// interface StageModalProps {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   modalStep: number;
//   setModalStep: (step: number) => void;
//   stageModalData: StageModalData;
//   setStageModalData: (data: StageModalData) => void;
//   tempGroups: GroupType[];
//   onGroupCountChange: (count: number) => void;
//   onUpdateGroupDetail: (index: number, field: keyof GroupType, value: string | number | string[]) => void;
//   onToggleMap: (groupIndex: number, map: string) => void;
//   onSaveStage: () => void;
// }

// export function StageModal({
//   open,
//   onOpenChange,
//   modalStep,
//   setModalStep,
//   stageModalData,
//   setStageModalData,
//   tempGroups,
//   onGroupCountChange,
//   onUpdateGroupDetail,
//   onToggleMap,
//   onSaveStage,
// }: StageModalProps) {
//   const handleNextStep = () => {
//     if (
//       !stageModalData.stage_name ||
//       !stageModalData.stage_format ||
//       !stageModalData.start_date ||
//       !stageModalData.end_date ||
//       stageModalData.teams_qualifying_from_stage === undefined
//     ) {
//       toast.error("Please fill all required stage fields (Step 1)");
//       return;
//     }
//     if (stageModalData.number_of_groups < 1) {
//       toast.error("Number of groups must be at least 1.");
//       return;
//     }
//     setModalStep(2);
//   };

//   const handleClose = () => {
//     onOpenChange(false);
//     setModalStep(1);
//   };

//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle className="text-xl">
//             {modalStep === 1 ? "Stage Details" : "Configure Groups"}
//           </DialogTitle>
//           <p className="text-sm text-zinc-400">Step {modalStep} of 2</p>
//         </DialogHeader>

//         {/* ── STEP 1: Stage Info ─────────────────────────────────────── */}
//         {modalStep === 1 && (
//           <div className="space-y-4 py-4">
//             <div>
//               <label className="text-sm font-medium mb-2 block">Stage Name</label>
//               <Input
//                 value={stageModalData.stage_name}
//                 onChange={(e) =>
//                   setStageModalData({ ...stageModalData, stage_name: e.target.value })
//                 }
//                 placeholder="e.g., Group Stage, Finals"
//               />
//             </div>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               <div>
//                 <label className="text-sm font-medium mb-2 block">Start Date</label>
//                 <Input
//                   type="date"
//                   value={stageModalData.start_date}
//                   onChange={(e) =>
//                     setStageModalData({ ...stageModalData, start_date: e.target.value })
//                   }
//                 />
//               </div>
//               <div>
//                 <label className="text-sm font-medium mb-2 block">End Date</label>
//                 <Input
//                   type="date"
//                   value={stageModalData.end_date}
//                   onChange={(e) =>
//                     setStageModalData({ ...stageModalData, end_date: e.target.value })
//                   }
//                 />
//               </div>
//             </div>

//             <div>
//               <label className="text-sm font-medium mb-2 block">Stage Format</label>
//               <Select
//                 value={stageModalData.stage_format}
//                 onValueChange={(value) =>
//                   setStageModalData({ ...stageModalData, stage_format: value })
//                 }
//               >
//                 <SelectTrigger>
//                   <SelectValue placeholder="Select format" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   {STAGE_FORMATS.map((format) => (
//                     <SelectItem key={format} value={format}>
//                       {FORMATTED_WORD[format]}
//                     </SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//             </div>

//             <div>
//               <label className="text-sm font-medium mb-2 block">
//                 Teams Qualifying from this Stage
//               </label>
//               <Input
//                 type="number"
//                 min={0}
//                 value={
//                   stageModalData.teams_qualifying_from_stage === undefined ||
//                   stageModalData.teams_qualifying_from_stage === 0
//                     ? ""
//                     : stageModalData.teams_qualifying_from_stage
//                 }
//                 onChange={(e) =>
//                   setStageModalData({
//                     ...stageModalData,
//                     teams_qualifying_from_stage: e.target.value === "" ? 0 : Number(e.target.value),
//                   })
//                 }
//               />
//             </div>

//             <div>
//               <label className="text-sm font-medium mb-2 block">Number of Groups</label>
//               <Input
//                 type="number"
//                 min={1}
//                 value={stageModalData.number_of_groups === 0 ? "" : stageModalData.number_of_groups}
//                 onChange={(e) =>
//                   onGroupCountChange(e.target.value === "" ? 0 : Number(e.target.value))
//                 }
//               />
//             </div>

//             <div>
//               <label className="text-sm font-medium mb-2 block">Stage Discord Role ID</label>
//               <Input
//                 value={stageModalData.stage_discord_role_id}
//                 onChange={(e) =>
//                   setStageModalData({ ...stageModalData, stage_discord_role_id: e.target.value })
//                 }
//                 placeholder="e.g: 1234567890"
//               />
//             </div>

//             <div className="pt-4 border-t">
//               <p className="text-xs text-muted-foreground mb-2">
//                 You will configure {stageModalData.number_of_groups} group(s) in the next step
//               </p>
//               <div className="flex gap-2 flex-wrap">
//                 {tempGroups.slice(0, stageModalData.number_of_groups).map((group, i) => (
//                   <div
//                     key={i}
//                     className="px-3 py-1 bg-primary/10 rounded-md border border-primary text-xs"
//                   >
//                     {group.group_name}
//                   </div>
//                 ))}
//               </div>
//             </div>
//           </div>
//         )}

//         {/* ── STEP 2: Groups Config ──────────────────────────────────── */}
//         {modalStep === 2 && (
//           <div className="space-y-3">
//             <div className="bg-primary/10 border rounded-md p-4">
//               <p className="text-sm">
//                 <span className="font-semibold">Stage:</span> {stageModalData.stage_name}
//               </p>
//               <p className="text-sm text-zinc-400">
//                 {formatDate(stageModalData.start_date)} to {formatDate(stageModalData.end_date)} |{" "}
//                 {FORMATTED_WORD[stageModalData.stage_format]}
//               </p>
//             </div>

//             {tempGroups.map((group, index) => (
//               <div key={index} className="border rounded-lg p-4 space-y-4">
//                 <div className="flex items-center justify-between">
//                   <h4 className="font-semibold">Group {index + 1}</h4>
//                   <span className="text-xs text-zinc-500">{group.group_name}</span>
//                 </div>

//                 <div>
//                   <label className="text-sm font-medium mb-2 block">Group Name</label>
//                   <Input
//                     value={group.group_name}
//                     onChange={(e) => onUpdateGroupDetail(index, "group_name", e.target.value)}
//                     placeholder={`Group ${index + 1}`}
//                   />
//                 </div>

//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <div>
//                     <label className="text-sm font-medium mb-2 block">Playing Date</label>
//                     <Input
//                       type="date"
//                       value={group.playing_date}
//                       onChange={(e) => onUpdateGroupDetail(index, "playing_date", e.target.value)}
//                     />
//                   </div>
//                   <div>
//                     <label className="text-sm font-medium mb-2 block">Playing Time</label>
//                     <Input
//                       type="time"
//                       value={group.playing_time}
//                       onChange={(e) => onUpdateGroupDetail(index, "playing_time", e.target.value)}
//                     />
//                   </div>
//                 </div>

//                 <div>
//                   <label className="text-sm font-medium mb-2 block">
//                     Teams Qualifying from this Group
//                   </label>
//                   <Input
//                     type="number"
//                     min={1}
//                     value={group.teams_qualifying === 0 ? "" : group.teams_qualifying}
//                     onChange={(e) =>
//                       onUpdateGroupDetail(
//                         index,
//                         "teams_qualifying",
//                         e.target.value === "" ? 0 : Number(e.target.value),
//                       )
//                     }
//                   />
//                 </div>

//                 <div>
//                   <label className="text-sm font-medium mb-2 block">Match Count</label>
//                   <Input
//                     type="number"
//                     min={1}
//                     value={group.match_count === 0 ? "" : group.match_count}
//                     onChange={(e) =>
//                       onUpdateGroupDetail(
//                         index,
//                         "match_count",
//                         e.target.value === "" ? 0 : Number(e.target.value),
//                       )
//                     }
//                   />
//                 </div>

//                 <div>
//                   <label className="text-sm font-medium mb-2 block">Discord Role ID</label>
//                   <Input
//                     value={group.group_discord_role_id}
//                     onChange={(e) =>
//                       onUpdateGroupDetail(index, "group_discord_role_id", e.target.value)
//                     }
//                     placeholder="e.g: 1234567890"
//                   />
//                 </div>

//                 {/* Map Selection */}
//                 <div>
//                   <label className="text-sm font-medium mb-2 block">
//                     Maps to be Played <span className="text-red-500">*</span>
//                   </label>
//                   <div className="flex flex-wrap gap-2">
//                     {AVAILABLE_MAPS.map((map) => {
//                       const isSelected = group.match_maps?.includes(map) || false;
//                       return (
//                         <Badge
//                           key={map}
//                           onClick={() => onToggleMap(index, map)}
//                           className={`cursor-pointer ${
//                             isSelected
//                               ? "border-primary bg-primary/10 text-primary"
//                               : "border-gray-300 bg-muted text-black dark:text-white hover:border-primary/50"
//                           }`}
//                         >
//                           {map}
//                           {isSelected && <span className="ml-1">✓</span>}
//                         </Badge>
//                       );
//                     })}
//                   </div>
//                   {(!group.match_maps || group.match_maps.length === 0) && (
//                     <p className="text-xs text-red-500 mt-1">Please select at least one map</p>
//                   )}
//                   {group.match_maps && group.match_maps.length > 0 && (
//                     <p className="text-xs text-muted-foreground mt-2">
//                       Selected: {group.match_maps.join(", ")}
//                     </p>
//                   )}
//                 </div>
//               </div>
//             ))}
//           </div>
//         )}

//         <DialogFooter className="flex justify-between">
//           <div>
//             {modalStep === 2 && (
//               <Button type="button" variant="outline" onClick={() => setModalStep(1)}>
//                 Back
//               </Button>
//             )}
//           </div>
//           <div className="flex items-center gap-2">
//             <Button type="button" variant="ghost" onClick={handleClose}>
//               Cancel
//             </Button>
//             {modalStep === 1 ? (
//               <Button type="button" onClick={handleNextStep}>
//                 Next: Configure Groups
//               </Button>
//             ) : (
//               <Button type="button" onClick={onSaveStage}>
//                 Save Stage
//               </Button>
//             )}
//           </div>
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   );
// }

"use client";

import React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Minus } from "lucide-react";
import { InfoTip } from "@/components/ui/info-tip";
import { formatDate } from "@/lib/utils";
import {
  AVAILABLE_MAPS,
  FORMATTED_WORD,
  GroupType,
  STAGE_FORMATS,
} from "./types";
// Shared Round-Robin builder (sub-project B) - same panel used by the edit flow.
import {
  RoundRobinPanel,
  type RoundRobinConfig,
} from "../../_components/RoundRobinPanel";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StageModalData {
  stage_name: string;
  start_date: string;
  end_date: string;
  stage_format: string;
  number_of_groups: number;
  teams_qualifying_from_stage: number;
  stage_discord_role_id: string;
  prizepool: any;
  prizepool_cash_value: any;
  prize_distribution: Record<string, string>;
  // ── Scoring-mode config (sub-project A). Independent + combinable toggles. ──
  champion_point_enabled: boolean;
  champion_point_threshold?: number;
  point_rush_enabled: boolean;
  point_rush_reward: Record<string, number>; // {"1":10,"2":7,...} placement→bonus
  point_rush_target_index?: number; // 0-based index of the LATER stage that banks the bonus
  // ── Round-Robin config (sub-project B). Edited only when stage_format is
  //    "br - round robin"; rides into the FormData stages array on save. ──
  round_robin: RoundRobinConfig;
}

interface StageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modalStep: number;
  setModalStep: (step: number) => void;
  stageModalData: StageModalData;
  setStageModalData: (data: StageModalData) => void;
  // Stage names + which stage is being edited - used to list the *later* stages a
  // Point-Rush target can point at (a stage can only bank into a stage after it).
  stageNames: string[];
  editingStageIndex: number | null;
  tempGroups: GroupType[];
  onGroupCountChange: (count: number) => void;
  onUpdateGroupDetail: (
    index: number,
    field: keyof GroupType,
    value: string | number | string[] | Record<string, string>,
  ) => void;
  onAddMap: (groupIndex: number, map: string) => void;
  onRemoveMap: (groupIndex: number, map: string) => void;
  onSaveStage: () => void;
  // ── Discord omission (organizer parity) ─────────────────────────────────────
  // When true, both the per-stage and per-group "Discord Role ID" inputs are hidden.
  // The organizer create flow passes hideDiscord so its stage/group configuration
  // matches the admin wizard EXCEPT for Discord role wiring (an AFC-admin-only concern
  // for now). The submitted stage payload still carries empty stage_discord_role_id /
  // group_discord_role_id strings, so the backend shape is identical - the fields are
  // just never editable in the organizer UI. Defaults to false → admin modal unchanged.
  hideDiscord?: boolean;
}

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
          <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
            Prize Pool Label{" "}
            <span className="text-zinc-400">(e.g. "5000 Diamonds")</span>
          </label>
          <Input
            value={prizepool}
            onChange={(e) => onPrizepoolChange(e.target.value)}
            placeholder="e.g. 5000 Diamonds, Gift Cards"
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
            Cash Value <span className="text-zinc-400">(e.g. "$500")</span>
          </label>
          <Input
            value={prizepoolCashValue}
            onChange={(e) => onPrizepoolCashChange(e.target.value)}
            placeholder="e.g. $500"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium block text-muted-foreground">
          Prize Distribution
        </label>
        {Object.keys(prizeDistribution).length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            No positions added yet. Click below to add one.
          </p>
        )}
        {Object.entries(prizeDistribution).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <Input value={key} disabled className="w-20 text-center shrink-0" />
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
          className="w-full mt-1"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Prize Position
        </Button>
      </div>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

export function StageModal({
  open,
  onOpenChange,
  modalStep,
  setModalStep,
  stageModalData,
  setStageModalData,
  stageNames,
  editingStageIndex,
  tempGroups,
  onGroupCountChange,
  onUpdateGroupDetail,
  onAddMap,
  onRemoveMap,
  onSaveStage,
  hideDiscord = false,
}: StageModalProps) {
  // Round-robin stages are defined ENTIRELY by the base groups + schedule in the
  // Round-Robin panel (Step 1): the classic "Number of Groups" field and the Step-2
  // per-group config (match count / maps) are IGNORED by the backend for this format,
  // so re-entering them was redundant and confusing (owner 2026-06-13). For round-robin
  // we hide those pieces and skip Step 2 entirely - "games per day" in the panel is the
  // single source for match count.
  const isRoundRobin = stageModalData.stage_format === "br - round robin";

  const handleNextStep = () => {
    if (
      !stageModalData.stage_name ||
      !stageModalData.stage_format ||
      !stageModalData.start_date ||
      !stageModalData.end_date ||
      stageModalData.teams_qualifying_from_stage === undefined
    ) {
      toast.error("Please fill all required stage fields (Step 1)");
      return;
    }
    // Round-robin: no classic groups, no Step 2 - save straight from Step 1.
    if (isRoundRobin) {
      onSaveStage();
      return;
    }
    if (stageModalData.number_of_groups < 1) {
      toast.error("Number of groups must be at least 1.");
      return;
    }
    setModalStep(2);
  };

  const handleClose = () => {
    onOpenChange(false);
    setModalStep(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {modalStep === 1 ? "Stage Details" : "Configure Groups"}
          </DialogTitle>
          <p className="text-sm text-zinc-400">Step {modalStep} of 2</p>
        </DialogHeader>

        {/* ── STEP 1: Stage Info + Stage Prize Pool ──────────────────── */}
        {modalStep === 1 && (
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Stage Name
              </label>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Start Date
                </label>
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
                <label className="text-sm font-medium mb-2 block">
                  End Date
                </label>
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
              <label className="text-sm font-medium mb-2 block">
                Stage Format
                <InfoTip id="events.create.stage_format" className="ml-1" />
              </label>
              <Select
                value={stageModalData.stage_format}
                onValueChange={(value) =>
                  setStageModalData({ ...stageModalData, stage_format: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_FORMATS.map((format) => (
                    <SelectItem key={format} value={format}>
                      {FORMATTED_WORD[format]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Round-Robin builder (sub-project B): only for the BR Round-Robin
                bracket. The classic per-group config in Step 2 is ignored by the
                backend for this format - game-day lobbies come from the base groups
                + schedule below. No team picker on create (no registrations yet). */}
            {stageModalData.stage_format === "br - round robin" && (
              <RoundRobinPanel
                config={stageModalData.round_robin}
                onChange={(rr) =>
                  setStageModalData({ ...stageModalData, round_robin: rr })
                }
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
                    <label className="text-sm font-medium block">
                      Champion-Point
                      <InfoTip id="events.create.champion_point" className="ml-1" />
                    </label>
                    <p className="text-xs text-muted-foreground">
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
                    <label className="text-sm font-medium mb-2 block">
                      Champion Point Threshold
                      <InfoTip id="events.create.champion_point_threshold" className="ml-1" />
                    </label>
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
                    <label className="text-sm font-medium block">
                      Point-Rush
                      <InfoTip id="events.create.point_rush" className="ml-1" />
                    </label>
                    <p className="text-xs text-muted-foreground">
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
                      <label className="text-xs font-medium block text-muted-foreground">
                        Placement Rewards
                        <InfoTip id="events.create.point_rush_reward" className="ml-1" />
                      </label>
                      {Object.keys(stageModalData.point_rush_reward).length ===
                        0 && (
                        <p className="text-xs text-muted-foreground italic">
                          No rewards added yet. Click below to add a placement.
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
                        className="w-full mt-1"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Placement Reward
                      </Button>
                    </div>

                    {/* Target stage: only stages AFTER the one being edited. */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Carry-Over Target Stage
                        <InfoTip id="events.create.point_rush_target" className="ml-1" />
                      </label>
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
              <label className="text-sm font-medium mb-2 block">
                Teams Qualifying from this Stage
              </label>
              <Input
                type="number"
                min={0}
                value={
                  stageModalData.teams_qualifying_from_stage === undefined ||
                  stageModalData.teams_qualifying_from_stage === 0
                    ? ""
                    : stageModalData.teams_qualifying_from_stage
                }
                onChange={(e) =>
                  setStageModalData({
                    ...stageModalData,
                    teams_qualifying_from_stage:
                      e.target.value === "" ? 0 : Number(e.target.value),
                  })
                }
              />
            </div>

            {/* Classic "Number of Groups" - NOT used for round-robin (its base groups
                above define the structure), so it is hidden for that format with a note. */}
            {isRoundRobin ? (
              <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
                This is a round-robin stage. Its lobbies come from the base groups and
                schedule above, so there is no separate "number of groups" or per-group
                map setup. "Games per day" above sets how many matches each lobby runs.
              </p>
            ) : (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Number of Groups
                  <InfoTip id="events.create.number_of_groups" className="ml-1" />
                </label>
                <Input
                  type="number"
                  min={1}
                  value={
                    stageModalData.number_of_groups === 0
                      ? ""
                      : stageModalData.number_of_groups
                  }
                  onChange={(e) =>
                    onGroupCountChange(
                      e.target.value === "" ? 0 : Number(e.target.value),
                    )
                  }
                />
              </div>
            )}

            {/* Stage Discord Role ID - omitted in the organizer flow (hideDiscord). */}
            {!hideDiscord && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Stage Discord Role ID
                </label>
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
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">
                  You will configure {stageModalData.number_of_groups} group(s) in
                  the next step
                </p>
                <div className="flex gap-2 flex-wrap">
                  {tempGroups
                    .slice(0, stageModalData.number_of_groups)
                    .map((group, i) => (
                      <div
                        key={i}
                        className="px-3 py-1 bg-primary/10 rounded-md border border-primary text-xs"
                      >
                        {group.group_name}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Groups Config + Group Prize Pools ──────────────── */}
        {modalStep === 2 && (
          <div className="space-y-3">
            <div className="bg-primary/10 border rounded-md p-4">
              <p className="text-sm">
                <span className="font-semibold">Stage:</span>{" "}
                {stageModalData.stage_name}
              </p>
              <p className="text-sm text-zinc-400">
                {formatDate(stageModalData.start_date)} to{" "}
                {formatDate(stageModalData.end_date)} |{" "}
                {FORMATTED_WORD[stageModalData.stage_format]}
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
                  <h4 className="font-semibold">Group {index + 1}</h4>
                  <span className="text-xs text-zinc-500">
                    {group.group_name}
                  </span>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Group Name
                  </label>
                  <Input
                    value={group.group_name}
                    onChange={(e) =>
                      onUpdateGroupDetail(index, "group_name", e.target.value)
                    }
                    placeholder={`Group ${index + 1}`}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Playing Date
                    </label>
                    <Input
                      type="date"
                      value={group.playing_date}
                      onChange={(e) =>
                        onUpdateGroupDetail(
                          index,
                          "playing_date",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Playing Time
                    </label>
                    <Input
                      type="time"
                      value={group.playing_time}
                      onChange={(e) =>
                        onUpdateGroupDetail(
                          index,
                          "playing_time",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Teams Qualifying from this Group
                    <InfoTip id="events.create.teams_qualifying" className="ml-1" />
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={
                      group.teams_qualifying === 0 ? "" : group.teams_qualifying
                    }
                    onChange={(e) =>
                      onUpdateGroupDetail(
                        index,
                        "teams_qualifying",
                        e.target.value === "" ? 0 : Number(e.target.value),
                      )
                    }
                  />
                </div>

                {/* Match count is DERIVED from the maps selected below (owner 2026-06-13):
                    one match per map, so there is no separate count to type. */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Match Count
                    <InfoTip id="events.create.match_count" className="ml-1" />
                  </label>
                  <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                    {(group.match_maps?.length || 0)} match
                    {(group.match_maps?.length || 0) === 1 ? "" : "es"} (one per map
                    selected below). Add or remove maps to change this.
                  </p>
                </div>

                {/* Group Discord Role ID - omitted in the organizer flow (hideDiscord). */}
                {!hideDiscord && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Discord Role ID
                    </label>
                    <Input
                      value={group.group_discord_role_id}
                      onChange={(e) =>
                        onUpdateGroupDetail(
                          index,
                          "group_discord_role_id",
                          e.target.value,
                        )
                      }
                      placeholder="e.g: 1234567890"
                    />
                  </div>
                )}

                {/* Map Selection */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Maps to be Played <span className="text-red-500">*</span>
                    <InfoTip id="events.create.match_maps" className="ml-1" />
                  </label>
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

                <Separator />

                {/* Group Prize Pool */}
                <PrizePoolSection
                  label="Group Prize Pool (optional)"
                  prizepool={group.prizepool ?? ""}
                  prizepoolCashValue={group.prizepool_cash_value ?? ""}
                  prizeDistribution={group.prize_distribution ?? {}}
                  onPrizepoolChange={(val) =>
                    onUpdateGroupDetail(index, "prizepool", val)
                  }
                  onPrizepoolCashChange={(val) =>
                    onUpdateGroupDetail(index, "prizepool_cash_value", val)
                  }
                  onDistributionChange={(dist) =>
                    onUpdateGroupDetail(index, "prize_distribution", dist)
                  }
                />
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div>
            {modalStep === 2 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalStep(1)}
              >
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            {modalStep === 1 ? (
              <Button type="button" onClick={handleNextStep}>
                {isRoundRobin ? "Save Stage" : "Next: Configure Groups"}
              </Button>
            ) : (
              <Button type="button" onClick={onSaveStage}>
                Save Stage
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
