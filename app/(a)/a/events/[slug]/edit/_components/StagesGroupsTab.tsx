import React from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { IconMap, IconTrophy } from "@tabler/icons-react";
import { Loader } from "@/components/Loader";
import { GroupResultModal } from "../../../_components/GroupResultModal";
import { SeedToGroupModal } from "../../../_components/SeedToGroupModal";
import { SendNotificationModal } from "../../../_components/SendNotificationModal";
import { EditMatchModal } from "../../../_components/EditMatchModal";
import { DeleteMatchModal } from "../../../_components/DeleteMatchModal";
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
}: StagesGroupsTabProps) {
  const form = useFormContext<EventFormType>();
  const stages = (form.watch("stages") || []) as any[];

  return (
    <>
      {stages.map((stage, sIdx) => {
        if (!stage || typeof stage !== "object") {
          return (
            <Card key={sIdx} className="bg-yellow-50 border-yellow-200">
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
          );
        }
        return (
          <Card key={sIdx} className=" ">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="space-y-1 w-full">
                <CardTitle className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-2">
                  <div>
                    <span>
                      <IconTrophy className="inline-block mr-2" />
                      {stage.stage_name}{" "}
                      <Badge className="capitalize">
                        {stage.stage_status}
                      </Badge>
                    </span>
                    <p className="text-xs mt-1 text-muted-foreground">
                      {formatDate(stage.start_date)} →{" "}
                      {formatDate(stage.end_date)} |{" "}
                      {formattedWord[stage.stage_format]} |{" "}
                      {stage.teams_qualifying_from_stage} teams qualify
                    </p>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <SeedToGroupModal
                      onSuccess={() => {}}
                      stageId={stage?.stage_id}
                      participantType={eventDetails.participant_type}
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
              {stage.groups.map((group: any, gIdx: number) => (
                <Card key={gIdx} className="gap-0">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      {group?.group_name}{" "}
                      <SendNotificationModal
                        eventId={eventDetails.event_id}
                        groupId={group.group_id}
                        onSuccess={() => {}}
                      />
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
                          <span className="italic">
                            No maps selected
                          </span>
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
                      <Card className="  gap-0">
                        <CardHeader>
                          <CardTitle>Players</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-1 max-h-40 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-1 mt-1.5">
                          {group?.competitors_in_group?.length ===
                            0 && (
                            <p className="italic text-sm text-muted-foreground">
                              No players yet
                            </p>
                          )}
                          {group?.competitors_in_group?.map(
                            (competitor: any, index: number) => (
                              <Card
                                className="w-full py-4 px-0  "
                                key={index}
                              >
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
                            <IconMap
                              size={16}
                              className="text-primary"
                            />
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
                                          onSuccess={() => {}}
                                          roomId={match.room_id}
                                          roomPassword={
                                            match.room_password
                                          }
                                          roomName={match.room_name}
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
                                    No matches generated for this group
                                    yet.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="flex w-full lg:w-auto items-start gap-2">
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
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        );
      })}

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
