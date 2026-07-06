// import React from "react";
// import { useFormContext } from "react-hook-form";
// import { Button } from "@/components/ui/button";
// import {
//   Card,
//   CardContent,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
// import { Badge } from "@/components/ui/badge";
// import { Edit, Trash2 } from "lucide-react";
// import { IconMap, IconTrophy } from "@tabler/icons-react";
// import { Loader } from "@/components/Loader";
// import { GroupResultModal } from "../../../_components/GroupResultModal";
// import { SeedToGroupModal } from "../../../_components/SeedToGroupModal";
// import { SendNotificationModal } from "../../../_components/SendNotificationModal";
// import { EditMatchModal } from "../../../_components/EditMatchModal";
// import { DeleteMatchModal } from "../../../_components/DeleteMatchModal";
// import { formatDate } from "@/lib/utils";
// import {
//   type EventFormType,
//   type EventDetails,
//   formattedWord,
//   validateStageData,
//   showValidationErrors,
// } from "../types";

// interface StagesGroupsTabProps {
//   eventDetails: EventDetails;
//   stageNames: string[];
//   passwordVisibility: Record<number, boolean>;
//   leaderboardData: any;
//   loadingLeaderboard: boolean;
//   loadingEvent: boolean;
//   pendingSubmit: boolean;
//   onOpenStageModal: (index: number) => void;
//   onRemoveStage: (index: number) => void;
//   onSeedGroup: (group: any) => void;
//   onViewResult: (group: any) => void;
//   onFetchLeaderboard: (groupId: number) => void;
//   onToggleVisibility: (groupIndex: number) => void;
//   onAddNewStage: () => void;
//   onSaveChanges: () => void;
// }

// export default function StagesGroupsTab({
//   eventDetails,
//   stageNames,
//   passwordVisibility,
//   leaderboardData,
//   loadingLeaderboard,
//   loadingEvent,
//   pendingSubmit,
//   onOpenStageModal,
//   onRemoveStage,
//   onSeedGroup,
//   onViewResult,
//   onFetchLeaderboard,
//   onToggleVisibility,
//   onAddNewStage,
//   onSaveChanges,
// }: StagesGroupsTabProps) {
//   const form = useFormContext<EventFormType>();
//   const stages = (form.watch("stages") || []) as any[];

//   return (
//     <>
//       {stages.map((stage, sIdx) => {
//         if (!stage || typeof stage !== "object") {
//           return (
//             <Card key={sIdx} className="bg-yellow-50 border-yellow-200">
//               <CardContent className="p-4">
//                 <p className="text-yellow-800">
//                   ⚠️ Stage {sIdx + 1} is not configured.
//                   <Button
//                     type="button"
//                     variant="link"
//                     onClick={() => onOpenStageModal(sIdx)}
//                   >
//                     Click here to configure
//                   </Button>
//                 </p>
//               </CardContent>
//             </Card>
//           );
//         }
//         return (
//           <Card key={sIdx} className=" ">
//             <CardHeader className="flex flex-row items-center justify-between">
//               <div className="space-y-1 w-full">
//                 <CardTitle className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-2">
//                   <div>
//                     <span>
//                       <IconTrophy className="inline-block mr-2" />
//                       {stage.stage_name}{" "}
//                       <Badge className="capitalize">
//                         {stage.stage_status}
//                       </Badge>
//                     </span>
//                     <p className="text-xs mt-1 text-muted-foreground">
//                       {formatDate(stage.start_date)} →{" "}
//                       {formatDate(stage.end_date)} |{" "}
//                       {formattedWord[stage.stage_format]} |{" "}
//                       {stage.teams_qualifying_from_stage} teams qualify
//                     </p>
//                   </div>

//                   <div className="flex items-center gap-2 w-full md:w-auto">
//                     <SeedToGroupModal
//                       onSuccess={() => {}}
//                       stageId={stage?.stage_id}
//                       participantType={eventDetails.participant_type}
//                     />
//                     <Button
//                       type="button"
//                       variant="outline"
//                       size={"icon"}
//                       onClick={() => onOpenStageModal(sIdx)}
//                     >
//                       <Edit />
//                     </Button>

//                     <Button
//                       type="button"
//                       variant="destructive"
//                       size="icon"
//                       onClick={() => onRemoveStage(sIdx)}
//                       disabled={stages.length <= 1}
//                       title={
//                         stages.length <= 1
//                           ? "Cannot remove the last stage"
//                           : "Remove this stage"
//                       }
//                     >
//                       <Trash2 className="w-4 h-4" />
//                     </Button>
//                   </div>
//                 </CardTitle>
//               </div>
//             </CardHeader>

//             <CardContent className="space-y-2 max-h-96 overflow-auto">
//               {stage.groups.map((group: any, gIdx: number) => (
//                 <Card key={gIdx} className="gap-0">
//                   <CardHeader>
//                     <CardTitle className="flex items-center justify-between gap-2">
//                       {group?.group_name}{" "}
//                       <SendNotificationModal
//                         eventId={eventDetails.event_id}
//                         groupId={group.group_id}
//                         onSuccess={() => {}}
//                       />
//                     </CardTitle>
//                   </CardHeader>
//                   <CardContent className="text-muted-foreground text-sm space-y-2">
//                     <div className="space-y-1">
//                       <p>
//                         {formatDate(group?.playing_date)} at{" "}
//                         {group?.playing_time}
//                       </p>
//                       <p className="text-primary">
//                         Maps:{" "}
//                         {group?.match_maps?.join(", ") || (
//                           <span className="italic">
//                             No maps selected
//                           </span>
//                         )}
//                       </p>
//                       <p>
//                         {group?.total_teams_in_group ||
//                           group?.competitors_in_group?.length}{" "}
//                         {group?.total_teams_in_group === 0
//                           ? "Players"
//                           : "Teams"}{" "}
//                         | {group?.teams_qualifying} qualify
//                       </p>
//                     </div>
//                     <div className="w-full">
//                       <Card className="  gap-0">
//                         <CardHeader>
//                           <CardTitle>Players</CardTitle>
//                         </CardHeader>
//                         <CardContent className="pt-1 max-h-40 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-1 mt-1.5">
//                           {group?.competitors_in_group?.length ===
//                             0 && (
//                             <p className="italic text-sm text-muted-foreground">
//                               No players yet
//                             </p>
//                           )}
//                           {group?.competitors_in_group?.map(
//                             (competitor: any, index: number) => (
//                               <Card
//                                 className="w-full py-4 px-0  "
//                                 key={index}
//                               >
//                                 <CardContent>
//                                   <CardTitle className="text-sm">
//                                     {competitor}
//                                   </CardTitle>
//                                 </CardContent>
//                               </Card>
//                             ),
//                           )}
//                         </CardContent>
//                       </Card>
//                     </div>
//                     <div className="w-full">
//                       <Card className="gap-0">
//                         <CardHeader>
//                           <CardTitle className="flex items-center justify-start gap-2">
//                             <IconMap
//                               size={16}
//                               className="text-primary"
//                             />
//                             Match Schedule & Status
//                           </CardTitle>
//                         </CardHeader>
//                         <CardContent>
//                           <Table>
//                             <TableHeader>
//                               <TableRow className="border-zinc-800">
//                                 <TableHead className="h-8 text-[10px] uppercase font-bold">
//                                   No.
//                                 </TableHead>
//                                 <TableHead className="h-8 text-[10px] uppercase font-bold">
//                                   Map
//                                 </TableHead>
//                                 <TableHead className="h-8 text-[10px] uppercase font-bold">
//                                   Status
//                                 </TableHead>
//                                 <TableHead className="h-8 text-[10px] uppercase font-bold text-right">
//                                   Actions
//                                 </TableHead>
//                               </TableRow>
//                             </TableHeader>
//                             <TableBody>
//                               {group?.matches?.length > 0 ? (
//                                 group?.matches?.map(
//                                   (match: any, mIdx: number) => (
//                                     <TableRow
//                                       key={match.match_id || mIdx}
//                                       className="border-zinc-900"
//                                     >
//                                       <TableCell className="py-2 text-xs font-mono">
//                                         #{mIdx + 1}
//                                       </TableCell>
//                                       <TableCell className="py-2 text-xs font-medium">
//                                         {match.match_map}
//                                       </TableCell>
//                                       <TableCell className="py-2">
//                                         <Badge
//                                           variant={
//                                             match.result_inputted
//                                               ? "default"
//                                               : "outline"
//                                           }
//                                           className={
//                                             match.result_inputted
//                                               ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/10"
//                                               : "text-orange-500 border-orange-500/20"
//                                           }
//                                         >
//                                           {match.result_inputted
//                                             ? "Resulted"
//                                             : "Pending"}
//                                         </Badge>
//                                       </TableCell>
//                                       <TableCell className="py-2 text-right space-x-1">
//                                         <EditMatchModal
//                                           matchId={match.match_id}
//                                           onSuccess={() => {}}
//                                           roomId={match.room_id}
//                                           roomPassword={
//                                             match.room_password
//                                           }
//                                           roomName={match.room_name}
//                                         />
//                                         <DeleteMatchModal
//                                           matchId={match.match_id}
//                                           onSuccess={() => {}}
//                                         />
//                                       </TableCell>
//                                     </TableRow>
//                                   ),
//                                 )
//                               ) : (
//                                 <TableRow>
//                                   <TableCell
//                                     colSpan={4}
//                                     className="text-center py-4 text-xs text-muted-foreground italic"
//                                   >
//                                     No matches generated for this group
//                                     yet.
//                                   </TableCell>
//                                 </TableRow>
//                               )}
//                             </TableBody>
//                           </Table>
//                         </CardContent>
//                       </Card>
//                     </div>
//                     <div className="flex w-full lg:w-auto items-start gap-2">
//                       <GroupResultModal
//                         activeGroup={group}
//                         stageName={stage.stage_name}
//                         eventId={eventDetails.event_id}
//                       />

//                       <Button
//                         size="md"
//                         type="button"
//                         className="flex-1"
//                         onClick={() => onSeedGroup(group)}
//                       >
//                         Seed to Next Stage
//                       </Button>
//                     </div>
//                   </CardContent>
//                 </Card>
//               ))}
//             </CardContent>
//           </Card>
//         );
//       })}

//       <div className="flex justify-center p-4 border-2 border-dashed rounded-lg border-primary/20 hover:border-primary/50 transition-colors">
//         <Button
//           type="button"
//           variant="ghost"
//           className="w-full h-full py-4 text-primary"
//           onClick={onAddNewStage}
//         >
//           <IconTrophy className="mr-2 h-5 w-5" />
//           Add New Stage
//         </Button>
//       </div>

//       <Button
//         type="button"
//         onClick={async () => {
//           const currentStages = form.getValues("stages");
//           const validation = validateStageData(currentStages);

//           if (!validation.isValid) {
//             showValidationErrors(validation.errors, (stageIndex) => {
//               if (stageIndex !== undefined) {
//                 onOpenStageModal(stageIndex);
//               }
//             });
//             return;
//           }

//           onSaveChanges();
//         }}
//         disabled={loadingEvent || pendingSubmit}
//       >
//         {loadingEvent || pendingSubmit ? (
//           <Loader text="Saving..." />
//         ) : (
//           "Save Changes"
//         )}
//       </Button>
//     </>
//   );
// }

import React from "react";
import { useFormContext } from "react-hook-form";
import axios from "axios";
// DnD (drag-to-reorder, owner 2026-06-15): mirrors the proven pattern at
// app/(a)/a/rankings/tournament-tiers/page.tsx (DndContext + SortableContext + useSortable +
// arrayMove + IconGripVertical). Stages reorder among themselves; groups reorder within a stage.
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2 } from "lucide-react";
import { IconMap, IconTrophy, IconGripVertical } from "@tabler/icons-react";
import { Loader } from "@/components/Loader";
import { InfoTip } from "@/components/ui/info-tip";
import { GroupResultModal } from "../../../_components/GroupResultModal";
import { RoundRobinResultsModal } from "../../../_components/RoundRobinResultsModal";
import { SeedToGroupModal } from "../../../_components/SeedToGroupModal";
import { SendNotificationModal } from "../../../_components/SendNotificationModal";
import { AddTeamsModal } from "../../../_components/AddTeamsModal";
import { EditMatchModal } from "../../../_components/EditMatchModal";
import { DeleteMatchModal } from "../../../_components/DeleteMatchModal";
// F2 (owner 2026-06-19): drag-and-drop a team between groups. Self-contained DnD (its own context),
// fed by the group-rosters endpoint, so it never collides with the stage/group reorder DnD here.
import GroupTeamMover from "./GroupTeamMover";
import { formatDate } from "@/lib/utils";
import {
  type EventFormType,
  type EventDetails,
  formattedWord,
  validateStageData,
  showValidationErrors,
} from "../types";

interface StagesGroupsTabProps {
  eventDetails: EventDetails;
  stageNames: string[];
  passwordVisibility: Record<number, boolean>;
  leaderboardData: any;
  loadingLeaderboard: boolean;
  loadingEvent: boolean;
  pendingSubmit: boolean;
  onOpenStageModal: (index: number) => void;
  onRemoveStage: (index: number) => void;
  onSeedGroup: (group: any) => void;
  onViewResult: (group: any) => void;
  onFetchLeaderboard: (groupId: number) => void;
  onToggleVisibility: (groupIndex: number) => void;
  onAddNewStage: () => void;
  onSaveChanges: () => void;
  // In-place refresh (owner 2026-06-13 "no manual refresh"): the edit page passes its
  // fetchEventDetails here so the Add-Teams modals can re-pull + re-render the new stage
  // and group rosters instead of forcing a window.location.reload().
  onRefresh?: () => void;
}

/* ───────────────────────── drag-to-reorder plumbing (owner 2026-06-15) ─────────────────────────
   Default stage_order / group_order = 0 means "auto-arrange by date/time" on the backend; dragging
   here writes 1-based orders via POST /events/reorder-stages/ + /events/reorder-groups/ that
   OVERRIDE the date sort. A SortableShell wraps each row, exposes drag-handle props through a
   render-prop so the grip can live inside the existing card header, and applies the transform.    */

interface SortableShellProps {
  id: number;
  disabled?: boolean;
  // render-prop: receives the handle props (spread onto the grip button) so the existing card
  // markup stays intact and only gains a grip handle in its header.
  children: (handle: { attributes: any; listeners: any; disabled?: boolean }) => React.ReactNode;
}

// One sortable row (a stage OR a group). useSortable must run per item, hence its own component.
function SortableShell({ id, disabled, children }: SortableShellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 opacity-80" : undefined}
    >
      {children({ attributes, listeners, disabled })}
    </div>
  );
}

// The grip the user grabs. A real <button> kept OUTSIDE any other button (sibling), matching the
// InfoTip nesting note elsewhere in this file (a button inside a button is invalid HTML).
function DragHandle({
  attributes,
  listeners,
  disabled,
  label,
}: {
  attributes: any;
  listeners: any;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      {...attributes}
      {...listeners}
      disabled={disabled}
      aria-label={label}
      title={disabled ? "Save this row first to enable reordering" : label}
      className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
    >
      <IconGripVertical className="size-4" />
    </button>
  );
}

export default function StagesGroupsTab({
  eventDetails,
  stageNames,
  passwordVisibility,
  leaderboardData,
  loadingLeaderboard,
  loadingEvent,
  pendingSubmit,
  onOpenStageModal,
  onRemoveStage,
  onSeedGroup,
  onViewResult,
  onFetchLeaderboard,
  onToggleVisibility,
  onAddNewStage,
  onSaveChanges,
  onRefresh,
}: StagesGroupsTabProps) {
  const form = useFormContext<EventFormType>();
  const stages = (form.watch("stages") || []) as any[];
  const { token } = useAuth();

  // Shared DnD sensors (mouse + touch + keyboard for mobile/accessibility), matching
  // app/(a)/a/rankings/tournament-tiers/page.tsx.
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  // STAGE reorder: optimistically reorder the form's stages array (instant UI), then persist via
  // POST /events/reorder-stages/. On success, refetch the canonical order (onRefresh) and, if the
  // backend flags that the manual order diverges from the schedule, toast that warning. On failure,
  // refetch to snap back to the saved order. Stages without a saved stage_id are not draggable
  // (the backend keys on persisted ids), so we only POST the ids that exist.
  async function handleStageDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const from = stages.findIndex((s) => s?.stage_id === active.id);
    const to = stages.findIndex((s) => s?.stage_id === over.id);
    if (from < 0 || to < 0) return;

    const reordered = arrayMove(stages, from, to);
    form.setValue("stages", reordered as any, { shouldDirty: false });

    const stageIds = reordered.map((s) => s?.stage_id).filter((v): v is number => !!v);
    try {
      // Hits afc_tournament_and_scrims.views.reorder_stages: writes 1-based stage_order that
      // overrides the auto-by-date sort. Returns {warning} when the order differs from the dates.
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/reorder-stages/`,
        { event_id: eventDetails.event_id, stage_ids: stageIds },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data?.warning) toast.info(res.data.warning);
      else toast.success("Stage order saved.");
      onRefresh?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save stage order.");
      onRefresh?.(); // snap back to the canonical saved order
    }
  }

  // GROUP reorder within ONE stage. Same flow as stages but scoped to stage.groups; persists via
  // POST /events/reorder-groups/ (views.reorder_groups -> 1-based group_order overriding date sort).
  async function handleGroupDragEnd(stageIndex: number, e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const groups = (stages[stageIndex]?.groups || []) as any[];
    const from = groups.findIndex((g) => g?.group_id === active.id);
    const to = groups.findIndex((g) => g?.group_id === over.id);
    if (from < 0 || to < 0) return;

    const reordered = arrayMove(groups, from, to);
    form.setValue(`stages.${stageIndex}.groups` as any, reordered as any, { shouldDirty: false });

    const groupIds = reordered.map((g) => g?.group_id).filter((v): v is number => !!v);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/reorder-groups/`,
        { stage_id: stages[stageIndex]?.stage_id, group_ids: groupIds },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data?.warning) toast.info(res.data.warning);
      else toast.success("Group order saved.");
      onRefresh?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save group order.");
      onRefresh?.(); // snap back to the canonical saved order
    }
  }

  // Ids that DndContext sorts over. Unsaved rows (no id yet) can't be persisted, so they fall back
  // to a synthetic negative id that is never used as a drag target (handle disabled below).
  const stageSortIds = stages.map((s, i) => (s?.stage_id ?? -(i + 1)));

  return (
    <>
      {/* F2: drag-and-drop teams between groups (team events only). Self-contained DnD, reads team
          ids from the group-rosters endpoint, persists via /events/seeding/move-team/. */}
      {eventDetails.participant_type !== "solo" && (
        <div className="mb-4">
          <GroupTeamMover eventId={eventDetails.event_id} />
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleStageDragEnd}
      >
        <SortableContext items={stageSortIds} strategy={verticalListSortingStrategy}>
      {stages.map((stage, sIdx) => {
        // Sortable id: persisted stage_id, or a synthetic negative for unsaved stages (never a real
        // drag target). Unsaved stages can't be reordered server-side, so their handle is disabled.
        const stageSortId = stage?.stage_id ?? -(sIdx + 1);
        const stageDragDisabled = !stage?.stage_id;

        if (!stage || typeof stage !== "object") {
          return (
            <SortableShell key={sIdx} id={stageSortId} disabled>
              {() => (
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="p-4">
                    <p className="text-yellow-800">
                      ⚠️ Stage {sIdx + 1} is not configured.
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => onOpenStageModal(sIdx)}
                      >
                        Click here to configure
                      </Button>
                    </p>
                  </CardContent>
                </Card>
              )}
            </SortableShell>
          );
        }

        // Determine if this stage has a prize configured
        const hasStagePrize = !!(stage.prizepool || stage.prizepool_cash_value);

        return (
          <SortableShell key={sIdx} id={stageSortId} disabled={stageDragDisabled}>
            {(handle) => (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="space-y-1 w-full">
                <CardTitle className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-2">
                  <div className="flex items-start gap-1">
                    {/* Stage drag handle: POSTs /events/reorder-stages/ on drop. Disabled until the
                        stage is saved (the backend keys reordering on the persisted stage_id). */}
                    <DragHandle {...handle} label="Drag to reorder stage" />
                    <div>
                    <span>
                      <IconTrophy className="inline-block mr-2" />
                      {stage.stage_name}{" "}
                      <Badge className="capitalize">{stage.stage_status}</Badge>
                    </span>
                    <p className="text-xs mt-1 text-muted-foreground">
                      {formatDate(stage.start_date)} →{" "}
                      {formatDate(stage.end_date)} |{" "}
                      {formattedWord[stage.stage_format]} |{" "}
                      {stage.teams_qualifying_from_stage} teams qualify
                    </p>
                    {/* Stage prize summary */}
                    {hasStagePrize && (
                      <p className="text-xs mt-1 text-primary font-medium">
                        🏆 Prize:{" "}
                        {[stage.prizepool, stage.prizepool_cash_value]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                    {/* Round-Robin (sub-project B): stage-level cumulative / per-day
                        standings. Only for the BR Round-Robin format + a saved stage. */}
                    {stage.stage_format === "br - round robin" &&
                      stage?.stage_id && (
                        <RoundRobinResultsModal
                          eventId={eventDetails.event_id}
                          stageId={stage.stage_id}
                          stageName={stage.stage_name}
                        />
                      )}
                    {eventDetails.participant_type === "squad" &&
                      stage?.stage_id && (
                        <AddTeamsModal
                          mode="stage"
                          targetId={stage.stage_id}
                          targetName={stage.stage_name}
                          // eventId => the picker lists only THIS event's registered teams (owner 2026-07-06).
                          eventId={eventDetails.event_id}
                          // Re-pull + re-render in place after teams are added (no reload).
                          onSuccess={() => onRefresh?.()}
                        />
                      )}
                    <SeedToGroupModal
                      // Refetch after seeding (owner 2026-07-04 bug fix): this was a no-op, so an
                      // organizer seeded to groups, got "success", but the group rosters on this tab
                      // (rendered from the one-time get-event-details snapshot) never updated -
                      // "seeded but not showing". Mirrors the sibling AddTeamsModal above + the
                      // Actions-tab seed, both of which already call onRefresh.
                      onSuccess={() => onRefresh?.()}
                      stageId={stage?.stage_id}
                      participantType={eventDetails.participant_type}
                      // Enable the "seed next stage by combined standings" option (owner 2026-07-06):
                      // this stage's format + the NEXT stage's name (the stage after it in order).
                      stageFormat={stage?.stage_format}
                      nextStageName={stages[sIdx + 1]?.stage_name ?? null}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size={"icon"}
                      onClick={() => onOpenStageModal(sIdx)}
                    >
                      <Edit />
                    </Button>

                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => onRemoveStage(sIdx)}
                      disabled={stages.length <= 1}
                      title={
                        stages.length <= 1
                          ? "Cannot remove the last stage"
                          : "Remove this stage"
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent className="space-y-2 max-h-96 overflow-auto">
              {/* Groups drag-to-reorder within THIS stage (nested DndContext so a group never
                  drags out of its stage). On drop -> POST /events/reorder-groups/. */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={(ev) => handleGroupDragEnd(sIdx, ev)}
              >
                <SortableContext
                  items={(stage.groups || []).map(
                    (g: any, gi: number) => g?.group_id ?? -(gi + 1),
                  )}
                  strategy={verticalListSortingStrategy}
                >
              {stage.groups.map((group: any, gIdx: number) => {
                const hasGroupPrize = !!(
                  group.prizepool || group.prizepool_cash_value
                );
                // Sortable id + disabled flag, same rule as stages: unsaved groups can't persist.
                const groupSortId = group?.group_id ?? -(gIdx + 1);
                const groupDragDisabled = !group?.group_id;

                return (
                  <SortableShell key={gIdx} id={groupSortId} disabled={groupDragDisabled}>
                    {(groupHandle) => (
                  <Card className="gap-0">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          {/* Group drag handle: POSTs /events/reorder-groups/ on drop. */}
                          <DragHandle {...groupHandle} label="Drag to reorder group" />
                          <div>
                          {group?.group_name}
                          {/* Group prize summary */}
                          {hasGroupPrize && (
                            <p className="text-xs text-primary font-medium mt-0.5">
                              🏆{" "}
                              {[group.prizepool, group.prizepool_cash_value]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {eventDetails.participant_type === "squad" &&
                            group?.group_id && (
                              <AddTeamsModal
                                mode="group"
                                targetId={group.group_id}
                                targetName={`${stage.stage_name} › ${group.group_name}`}
                                // eventId => picker shows only this event's registered teams (owner 2026-07-06).
                                eventId={eventDetails.event_id}
                                // Re-pull + re-render in place after teams are added (no reload).
                                onSuccess={() => onRefresh?.()}
                              />
                            )}
                          {/* Per-group broadcast composer (labelled "Message group").
                              Names passed so the dialog titles itself with the exact
                              stage > group it will message. */}
                          <SendNotificationModal
                            eventId={eventDetails.event_id}
                            groupId={group.group_id}
                            groupName={group.group_name}
                            stageName={stage.stage_name}
                            onSuccess={() => {}}
                          />
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-muted-foreground text-sm space-y-2">
                      <div className="space-y-1">
                        <p>
                          {formatDate(group?.playing_date)} at{" "}
                          {group?.playing_time}
                        </p>
                        <p className="text-primary">
                          Maps:{" "}
                          {group?.match_maps?.join(", ") || (
                            <span className="italic">No maps selected</span>
                          )}
                        </p>
                        <p>
                          {group?.total_teams_in_group ||
                            group?.competitors_in_group?.length}{" "}
                          {group?.total_teams_in_group === 0
                            ? "Players"
                            : "Teams"}{" "}
                          | {group?.teams_qualifying} qualify
                        </p>
                      </div>
                      <div className="w-full">
                        <Card className="gap-0">
                          <CardHeader>
                            <CardTitle>Players</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-1 max-h-40 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-1 mt-1.5">
                            {group?.competitors_in_group?.length === 0 && (
                              <p className="italic text-sm text-muted-foreground">
                                No players yet
                              </p>
                            )}
                            {group?.competitors_in_group?.map(
                              (competitor: any, index: number) => (
                                <Card className="w-full py-4 px-0" key={index}>
                                  <CardContent>
                                    <CardTitle className="text-sm">
                                      {competitor}
                                    </CardTitle>
                                  </CardContent>
                                </Card>
                              ),
                            )}
                          </CardContent>
                        </Card>
                      </div>
                      <div className="w-full">
                        <Card className="gap-0">
                          <CardHeader>
                            <CardTitle className="flex items-center justify-start gap-2">
                              <IconMap size={16} className="text-primary" />
                              Match Schedule & Status
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader>
                                <TableRow className="border-zinc-800">
                                  <TableHead className="h-8 text-[10px] uppercase font-bold">
                                    No.
                                  </TableHead>
                                  <TableHead className="h-8 text-[10px] uppercase font-bold">
                                    Map
                                  </TableHead>
                                  <TableHead className="h-8 text-[10px] uppercase font-bold">
                                    Status
                                  </TableHead>
                                  <TableHead className="h-8 text-[10px] uppercase font-bold text-right">
                                    Actions
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group?.matches?.length > 0 ? (
                                  group?.matches?.map(
                                    (match: any, mIdx: number) => (
                                      <TableRow
                                        key={match.match_id || mIdx}
                                        className="border-zinc-900"
                                      >
                                        <TableCell className="py-2 text-xs font-mono">
                                          #{mIdx + 1}
                                        </TableCell>
                                        <TableCell className="py-2 text-xs font-medium">
                                          {match.match_map}
                                        </TableCell>
                                        <TableCell className="py-2">
                                          <Badge
                                            variant={
                                              match.result_inputted
                                                ? "default"
                                                : "outline"
                                            }
                                            className={
                                              match.result_inputted
                                                ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/10"
                                                : "text-orange-500 border-orange-500/20"
                                            }
                                          >
                                            {match.result_inputted
                                              ? "Resulted"
                                              : "Pending"}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="py-2 text-right space-x-1">
                                          <EditMatchModal
                                            matchId={match.match_id}
                                            // Refetch after saving so the new room details persist
                                            // in view (owner 2026-06-17: was a no-op, so edits looked
                                            // like they reverted to the old value on reopen).
                                            onSuccess={() => onRefresh?.()}
                                            roomId={match.room_id}
                                            roomPassword={match.room_password}
                                            roomName={match.room_name}
                                            matchLabel={`Match ${match.match_number}${match.match_map ? ` - ${match.match_map}` : ""}`}
                                          />
                                          <DeleteMatchModal
                                            matchId={match.match_id}
                                            onSuccess={() => {}}
                                          />
                                        </TableCell>
                                      </TableRow>
                                    ),
                                  )
                                ) : (
                                  <TableRow>
                                    <TableCell
                                      colSpan={4}
                                      className="text-center py-4 text-xs text-muted-foreground italic"
                                    >
                                      No matches generated for this group yet.
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      </div>
                      <div className="flex w-full lg:w-auto items-center gap-2">
                        <GroupResultModal
                          activeGroup={group}
                          stageName={stage.stage_name}
                          eventId={eventDetails.event_id}
                        />

                        <Button
                          size="md"
                          type="button"
                          className="flex-1"
                          onClick={() => onSeedGroup(group)}
                        >
                          Seed to Next Stage
                        </Button>
                        {/*
                          Edit-only live-event action - explain what seeding does.
                          The ⓘ (a real <button>) sits OUTSIDE the Seed button as a
                          sibling, not nested inside it: a <button> inside a <button>
                          is invalid HTML and triggers a hydration/DOM-nesting error.
                        */}
                        <InfoTip id="events.edit.seed_to_next_stage" side="top" />
                      </div>
                    </CardContent>
                  </Card>
                    )}
                  </SortableShell>
                );
              })}
                </SortableContext>
              </DndContext>
            </CardContent>
          </Card>
            )}
          </SortableShell>
        );
      })}
        </SortableContext>
      </DndContext>

      <div className="flex justify-center p-4 border-2 border-dashed rounded-lg border-primary/20 hover:border-primary/50 transition-colors">
        <Button
          type="button"
          variant="ghost"
          className="w-full h-full py-4 text-primary"
          onClick={onAddNewStage}
        >
          <IconTrophy className="mr-2 h-5 w-5" />
          Add New Stage
        </Button>
      </div>

      <Button
        type="button"
        onClick={async () => {
          const currentStages = form.getValues("stages");
          const validation = validateStageData(currentStages);

          if (!validation.isValid) {
            showValidationErrors(validation.errors, (stageIndex) => {
              if (stageIndex !== undefined) {
                onOpenStageModal(stageIndex);
              }
            });
            return;
          }

          onSaveChanges();
        }}
        disabled={loadingEvent || pendingSubmit}
      >
        {loadingEvent || pendingSubmit ? (
          <Loader text="Saving..." />
        ) : (
          "Save Changes"
        )}
      </Button>
    </>
  );
}
