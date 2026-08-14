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
// One rule for "is this Clash Squad?" - the plain "cs" format the picker
// writes since 2026-08-13 does not match the old "cs - " literals.
import { isClashSquadFormat } from "@/lib/eventFormats";
import { toast } from "sonner";
// next-intl client hook. Strings live in messages/{en,fr,pt}/evStageModal.json;
// stage-format labels reuse the shared messages/{...}/eventFormats.json namespace
// (t.has()-guarded below since the key is built from a backend format code).
import { useTranslations } from "next-intl";
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
  type AdvancementRuleInput,
} from "./types";
// Shared Round-Robin builder (sub-project B) - same panel used by the edit flow.
import {
  RoundRobinPanel,
  type RoundRobinConfig,
} from "../../_components/RoundRobinPanel";
// Shared Clash Squad (bracket) explainer (CS sub-project) - same panel used by the edit flow.
import { ClashSquadPanel } from "../../_components/ClashSquadPanel";
import type { CSRoomDraft } from "@/components/cs-room-settings";

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
  // ── Branching advancement rules (feature #9). Optional repeatable rows; presence = branching
  //    mode (rules OVERRIDE the single teams_qualifying field at advance time). Rides into the
  //    FormData stages array on save; resolved to StageAdvancementRule rows by the backend. ──
  advancement_rules?: AdvancementRuleInput[];
  // ── Round-Robin config (sub-project B). Edited only when stage_format is
  //    "br - round robin"; rides into the FormData stages array on save. ──
  round_robin: RoundRobinConfig;
  // ── Clash Squad ROOM SETTINGS (owner 2026-08-13) ────────────────────────────────
  // The in-game custom-room configuration for this stage, filled in optionally while the event
  // is being created. Undefined / null = nothing configured, and the key is simply not sent.
  // create_event materialises it into a CSRoomConfig scoped to the new stage; from then on it is
  // edited from the bracket card on the event page. See components/cs-room-settings.tsx.
  cs_room_settings?: CSRoomDraft | null;
  // ── Clash Squad: the MODE, and the optional split into groups (owner item 21, 2026-08-13) ──
  // cs_bracket_format is the mode a one-bracket stage runs. cs_groups is non-empty ONLY when the
  // organizer ticked "split this stage into groups"; each entry becomes a StageGroups row with
  // its own bracket, teams and room. Both are optional: a stage that never touches them behaves
  // exactly as Clash Squad stages did before.
  cs_bracket_format?: import("@/lib/eventFormats").CSBracketMode;
  cs_groups?: import("../../_components/ClashSquadPanel").CSGroupDraft[];
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
  label,
}: PrizePoolSectionProps) {
  const t = useTranslations("evStageModal");
  // Callers pass a translated label; fall back to the generic "Prize Pool" string.
  const resolvedLabel = label ?? t("prizePool");
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
      <p className="text-sm font-semibold text-primary">{resolvedLabel}</p>

      <div className="grid gap-3">
        <div>
          <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
            {t("prizePoolLabel")}{" "}
            <span className="text-zinc-400">{t("prizePoolLabelHint")}</span>
          </label>
          <Input
            value={prizepool}
            onChange={(e) => onPrizepoolChange(e.target.value)}
            placeholder={t("prizePoolLabelPlaceholder")}
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
            {t("cashValue")}{" "}
            <span className="text-zinc-400">{t("cashValueHint")}</span>
          </label>
          <Input
            value={prizepoolCashValue}
            onChange={(e) => onPrizepoolCashChange(e.target.value)}
            placeholder={t("cashValuePlaceholder")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium block text-muted-foreground">
          {t("prizeDistribution")}
        </label>
        {Object.keys(prizeDistribution).length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            {t("noPositions")}
          </p>
        )}
        {Object.entries(prizeDistribution).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <Input value={key} disabled className="w-20 text-center shrink-0" />
            <Input
              value={value}
              onChange={(e) => updatePosition(key, e.target.value)}
              placeholder={t("prizeValuePlaceholder")}
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
          <Plus className="w-3.5 h-3.5 mr-1" /> {t("addPrizePosition")}
        </Button>
      </div>
    </div>
  );
}

// ── Reusable Advancement Routing Section (feature #9) ───────────────────────────
// The authoring UI for branching advancement. OFF (no rules) keeps the legacy single
// "Teams Qualifying from this Stage" field above; ON shows repeatable rows of
// [From #][To #][from: All groups | Group N][-> target later-stage]. Each row maps to a
// StageAdvancementRule (positions [from..to] of this stage / one group advance into a later
// stage). Rides via stageModalData.advancement_rules; the target Select reuses the exact
// later-stages filter the Point-Rush target uses. Shared verbatim by the create StageModal and
// (a copy of) the edit StageConfigModal, mirroring how PrizePoolSection is duplicated per modal.
interface AdvancementRoutingSectionProps {
  rules: AdvancementRuleInput[] | undefined;
  onChange: (rules: AdvancementRuleInput[]) => void;
  // Stage names + the index being edited -> the list of LATER stages a rule can target.
  stageNames: string[];
  editingStageIndex: number | null;
  // The group labels of THIS stage, for the per-group scope option (empty -> stage-wide only).
  groupOptions: { index: number; label: string }[];
}

function AdvancementRoutingSection({
  rules,
  onChange,
  stageNames,
  editingStageIndex,
  groupOptions,
}: AdvancementRoutingSectionProps) {
  const t = useTranslations("evStageModal");
  const list = rules ?? [];
  const branchingOn = list.length > 0;

  // The later stages this stage can route into (same filter as the Point-Rush target).
  const laterStages = stageNames
    .map((name, idx) => ({ name, idx }))
    .filter(({ idx }) => editingStageIndex === null || idx > editingStageIndex);
  const firstLaterIdx = laterStages.length > 0 ? laterStages[0].idx : undefined;

  const addRow = () => {
    // A new row defaults to "top 1" of the whole stage into the first available later stage.
    onChange([
      ...list,
      {
        position_from: 1,
        position_to: 1,
        source_group_index: null,
        target_stage_index: firstLaterIdx ?? 0,
      },
    ]);
  };

  const updateRow = (i: number, patch: Partial<AdvancementRuleInput>) => {
    const next = list.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange(next);
  };

  const removeRow = (i: number) => {
    onChange(list.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">
            {t("advancementRouting")}
            <InfoTip id="events.create.advancement_routing" className="ml-1" />
          </p>
          <p className="text-xs text-muted-foreground">
            {t("advancementRoutingDesc")}
          </p>
        </div>
        <Switch
          checked={branchingOn}
          onCheckedChange={(checked) => {
            // ON seeds one starter row; OFF clears all rules (back to the single qualifier).
            if (checked) {
              if (list.length === 0) addRow();
            } else {
              onChange([]);
            }
          }}
        />
      </div>

      {branchingOn && (
        <div className="space-y-3">
          {laterStages.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              {t("addLaterStageRoute")}
            </p>
          )}
          {list.map((rule, i) => (
            <div
              key={i}
              className="space-y-2 rounded-md border bg-background p-3"
            >
              <div className="flex flex-wrap items-end gap-2">
                {/* From # */}
                <div className="w-20">
                  <label className="text-[0.68rem] font-medium mb-1 block text-muted-foreground">
                    {t("fromNumber")}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={rule.position_from}
                    onChange={(e) =>
                      updateRow(i, {
                        position_from:
                          e.target.value === "" ? 1 : Number(e.target.value),
                      })
                    }
                  />
                </div>
                {/* To # */}
                <div className="w-20">
                  <label className="text-[0.68rem] font-medium mb-1 block text-muted-foreground">
                    {t("toNumber")}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={rule.position_to}
                    onChange={(e) =>
                      updateRow(i, {
                        position_to:
                          e.target.value === "" ? 1 : Number(e.target.value),
                      })
                    }
                  />
                </div>
                {/* Source scope: All groups (stage-wide) or one group */}
                <div className="flex-1 min-w-[140px]">
                  <label className="text-[0.68rem] font-medium mb-1 block text-muted-foreground">
                    {t("from")}
                  </label>
                  <Select
                    value={
                      rule.source_group_index === null ||
                      rule.source_group_index === undefined
                        ? "stage"
                        : String(rule.source_group_index)
                    }
                    onValueChange={(value) =>
                      updateRow(i, {
                        source_group_index:
                          value === "stage" ? null : Number(value),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stage">{t("allGroups")}</SelectItem>
                      {groupOptions.map((g) => (
                        <SelectItem key={g.index} value={String(g.index)}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-end gap-2">
                {/* Target later stage (same options as the Point-Rush target) */}
                <div className="flex-1">
                  <label className="text-[0.68rem] font-medium mb-1 block text-muted-foreground">
                    {t("advanceTo")}
                  </label>
                  <Select
                    value={
                      rule.target_stage_index === undefined
                        ? ""
                        : String(rule.target_stage_index)
                    }
                    onValueChange={(value) =>
                      updateRow(i, { target_stage_index: Number(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectLaterStage")} />
                    </SelectTrigger>
                    <SelectContent>
                      {laterStages.map(({ name, idx }) => (
                        <SelectItem key={idx} value={String(idx)}>
                          {name || t("stageFallback", { n: idx + 1 })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(i)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {laterStages.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              className="w-full"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> {t("addRoutingRule")}
            </Button>
          )}
        </div>
      )}
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
  const t = useTranslations("evStageModal");
  // Stage-format labels: reuse the shared eventFormats namespace. The lookup key is a
  // backend format code, so it is t.has()-guarded (fall back to the shared FORMATTED_WORD
  // constant when a code has no message) to avoid a MISSING_MESSAGE throw at render.
  const tf = useTranslations("eventFormats");
  const formatLabel = (code: string) =>
    tf.has(code) ? tf(code) : FORMATTED_WORD[code] ?? code;

  // Round-robin stages are defined ENTIRELY by the base groups + schedule in the
  // Round-Robin panel (Step 1): the classic "Number of Groups" field and the Step-2
  // per-group config (match count / maps) are IGNORED by the backend for this format,
  // so re-entering them was redundant and confusing (owner 2026-06-13). For round-robin
  // we hide those pieces and skip Step 2 entirely - "games per day" in the panel is the
  // single source for match count.
  const isRoundRobin = stageModalData.stage_format === "br - round robin";
  // Clash Squad (cs - *) runs as a head-to-head bracket, not BR lobbies: like round-robin
  // it has no classic groups and no Step-2 per-group config, so it saves straight from
  // Step 1 (the bracket is generated later from the event page). See ClashSquadPanel.
  const isClashSquad = isClashSquadFormat(stageModalData.stage_format);

  const handleNextStep = () => {
    if (
      !stageModalData.stage_name ||
      !stageModalData.stage_format ||
      !stageModalData.start_date ||
      !stageModalData.end_date ||
      stageModalData.teams_qualifying_from_stage === undefined
    ) {
      toast.error(t("toastFillRequired"));
      return;
    }
    // Round-robin AND Clash Squad: no classic groups, no Step 2 - save straight from Step 1.
    if (isRoundRobin || isClashSquad) {
      onSaveStage();
      return;
    }
    if (stageModalData.number_of_groups < 1) {
      toast.error(t("toastGroupsMin"));
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
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {modalStep === 1
              ? t("titleStageDetails")
              : t("titleConfigureGroups")}
          </DialogTitle>
          <p className="text-sm text-zinc-400">
            {t("stepOf", { step: modalStep })}
          </p>
        </DialogHeader>

        {/* ── STEP 1: Stage Info + Stage Prize Pool ──────────────────── */}
        {modalStep === 1 && (
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("stageName")}
              </label>
              <Input
                value={stageModalData.stage_name}
                onChange={(e) =>
                  setStageModalData({
                    ...stageModalData,
                    stage_name: e.target.value,
                  })
                }
                placeholder={t("stageNamePlaceholder")}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t("startDate")}
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
                  {t("endDate")}
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
                {t("stageFormat")}
                <InfoTip id="events.create.stage_format" className="ml-1" />
              </label>
              <Select
                value={stageModalData.stage_format}
                onValueChange={(value) =>
                  setStageModalData({ ...stageModalData, stage_format: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectFormat")} />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_FORMATS.map((format) => (
                    <SelectItem key={format} value={format}>
                      {formatLabel(format)}
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

            {/* ── Clash Squad (bracket) explainer (CS sub-project): shown for any "cs - *"
                format INSTEAD of the BR group/map wizard. It has no inputs - the bracket is
                generated from the event page - so the modal saves straight from Step 1. */}
            {isClashSquad && (
              <ClashSquadPanel
                stageFormat={stageModalData.stage_format}
                stageName={stageModalData.stage_name}
                // The MODE, and the optional split into groups (owner backlog item 21,
                // 2026-08-13). Both live on the stage draft and ride into the payload.
                mode={stageModalData.cs_bracket_format}
                onModeChange={(m) =>
                  setStageModalData({ ...stageModalData, cs_bracket_format: m })
                }
                groups={stageModalData.cs_groups ?? []}
                onGroupsChange={(g) =>
                  setStageModalData({ ...stageModalData, cs_groups: g })
                }
                // The stage does not exist yet, so the room settings ride along in the stage
                // draft and are materialised by create_event (owner 2026-08-13). Optional:
                // leaving it untouched sends nothing.
                roomSettings={stageModalData.cs_room_settings ?? null}
                onRoomSettingsChange={(draft) =>
                  setStageModalData({ ...stageModalData, cs_room_settings: draft })
                }
              />
            )}

            {/* ── Scoring modes (sub-project A): Champion-Point + Point-Rush ──────────
                Both are independent per-stage toggles. Champion-Point is a match-point
                win rule; Point-Rush banks this stage's placement bonus into a later
                stage. They can be on together.
                HIDDEN FOR CLASH SQUAD (owner 2026-08-12, finding #14): both are Battle Royale
                rules about placement points across a lobby. A Clash Squad set is won by round
                wins in a head-to-head bracket, so neither toggle does anything there and
                offering them only invites an organizer to turn on a rule that will not apply. */}
            <div className={`space-y-4 p-4 border rounded-lg bg-muted/30${isClashSquad ? " hidden" : ""}`}>
              <p className="text-sm font-semibold text-primary">
                {t("scoringModes")}
              </p>

              {/* Champion-Point toggle + threshold */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label className="text-sm font-medium block">
                      {t("championPoint")}
                      <InfoTip id="events.create.champion_point" className="ml-1" />
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {t("championPointDesc")}
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
                      {t("championPointThreshold")}
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
                      placeholder={t("championPointThresholdPlaceholder")}
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
                      {t("pointRush")}
                      <InfoTip id="events.create.point_rush" className="ml-1" />
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {t("pointRushDesc")}
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
                        {t("placementRewards")}
                        <InfoTip id="events.create.point_rush_reward" className="ml-1" />
                      </label>
                      {Object.keys(stageModalData.point_rush_reward).length ===
                        0 && (
                        <p className="text-xs text-muted-foreground italic">
                          {t("noRewards")}
                        </p>
                      )}
                      {Object.entries(stageModalData.point_rush_reward).map(
                        ([placement, points]) => (
                          <div
                            key={placement}
                            className="flex items-center gap-2"
                          >
                            <span className="text-xs text-muted-foreground w-16 shrink-0">
                              {t("place", { placement })}
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
                              placeholder={t("bonusPointsPlaceholder")}
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
                        <Plus className="w-3.5 h-3.5 mr-1" /> {t("addPlacementReward")}
                      </Button>
                    </div>

                    {/* Target stage: only stages AFTER the one being edited. */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        {t("carryOverTargetStage")}
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
                          <SelectValue placeholder={t("selectLaterStage")} />
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
                                {name || t("stageFallback", { n: idx + 1 })}
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
                          {t("addLaterStageCarryOver")}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("teamsQualifyingStage")}
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

            {/* Branching advancement routing (feature #9). Off (default) uses the single
                qualifier above; on splits the stage's finishers into different later stages.
                Group options are the classic groups (none for round-robin -> stage-wide only). */}
            <AdvancementRoutingSection
              rules={stageModalData.advancement_rules}
              onChange={(rules) =>
                setStageModalData({ ...stageModalData, advancement_rules: rules })
              }
              stageNames={stageNames}
              editingStageIndex={editingStageIndex}
              groupOptions={
                // No classic groups for round-robin OR Clash Squad -> stage-wide routing only.
                isRoundRobin || isClashSquad
                  ? []
                  : tempGroups
                      .slice(0, stageModalData.number_of_groups)
                      .map((g, idx) => ({
                        index: idx,
                        label: g.group_name || t("groupFallback", { n: idx + 1 }),
                      }))
              }
            />

            {/* Classic "Number of Groups" - NOT used for round-robin (its base groups
                above define the structure) or Clash Squad (a bracket has no groups), so it
                is hidden for those formats. RR shows a note; CS is covered by ClashSquadPanel. */}
            {isRoundRobin ? (
              <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
                {t("roundRobinNote")}
              </p>
            ) : isClashSquad ? null : (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t("numberOfGroups")}
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
                  {t("stageDiscordRoleId")}
                </label>
                <Input
                  value={stageModalData.stage_discord_role_id}
                  onChange={(e) =>
                    setStageModalData({
                      ...stageModalData,
                      stage_discord_role_id: e.target.value,
                    })
                  }
                  placeholder={t("discordRoleIdPlaceholder")}
                />
              </div>
            )}

            <Separator />

            <PrizePoolSection
              label={t("stagePrizePool")}
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

            {/* Group preview only for classic formats - round-robin and Clash Squad have no Step 2. */}
            {!isRoundRobin && !isClashSquad && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">
                  {t("configureGroupsNext", {
                    count: stageModalData.number_of_groups,
                  })}
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
                <span className="font-semibold">{t("stageLabel")}</span>{" "}
                {stageModalData.stage_name}
              </p>
              <p className="text-sm text-zinc-400">
                {t("dateFormatLine", {
                  start: formatDate(stageModalData.start_date),
                  end: formatDate(stageModalData.end_date),
                  format: formatLabel(stageModalData.stage_format),
                })}
              </p>
              {stageModalData.prizepool && (
                <p className="text-xs text-primary mt-1">
                  {t("stagePrize", { prize: stageModalData.prizepool })}
                  {stageModalData.prizepool_cash_value
                    ? ` (${stageModalData.prizepool_cash_value})`
                    : ""}
                </p>
              )}
            </div>

            {tempGroups.map((group, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">
                    {t("groupHeading", { n: index + 1 })}
                  </h4>
                  <span className="text-xs text-zinc-500">
                    {group.group_name}
                  </span>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("groupName")}
                  </label>
                  <Input
                    value={group.group_name}
                    onChange={(e) =>
                      onUpdateGroupDetail(index, "group_name", e.target.value)
                    }
                    placeholder={t("groupFallback", { n: index + 1 })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      {t("playingDate")}
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
                      {t("playingTime")}
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
                    {t("teamsQualifyingGroup")}
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
                    {t("matchCount")}
                    <InfoTip id="events.create.match_count" className="ml-1" />
                  </label>
                  <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                    {t("matchCountDerived", {
                      count: group.match_maps?.length || 0,
                    })}
                  </p>
                </div>

                {/* Group Discord Role ID - omitted in the organizer flow (hideDiscord). */}
                {!hideDiscord && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      {t("discordRoleId")}
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
                      placeholder={t("discordRoleIdPlaceholder")}
                    />
                  </div>
                )}

                {/* Map Selection */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("mapsToBePlayed")} <span className="text-red-500">*</span>
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
                            className="flex size-7 items-center justify-center rounded disabled:opacity-30 hover:opacity-70"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="min-w-[1.25rem] text-center font-medium">
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={() => onAddMap(index, map)}
                            className="flex size-7 items-center justify-center rounded hover:opacity-70"
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
                      {t("selectAtLeastOneMap")}
                    </p>
                  )}
                  {group.match_maps && group.match_maps.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("selectedMaps", { maps: group.match_maps.join(", ") })}
                    </p>
                  )}
                </div>

                <Separator />

                {/* Group Prize Pool */}
                <PrizePoolSection
                  label={t("groupPrizePool")}
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
                {t("back")}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={handleClose}>
              {t("cancel")}
            </Button>
            {modalStep === 1 ? (
              <Button type="button" onClick={handleNextStep}>
                {isRoundRobin || isClashSquad
                  ? t("saveStage")
                  : t("nextConfigureGroups")}
              </Button>
            ) : (
              <Button type="button" onClick={onSaveStage}>
                {t("saveStage")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
