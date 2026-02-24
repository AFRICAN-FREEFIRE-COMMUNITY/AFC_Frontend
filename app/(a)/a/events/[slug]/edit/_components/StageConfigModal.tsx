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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { EyeIcon, EyeOffIcon, Trash2 } from "lucide-react";
import { IconMap, IconX } from "@tabler/icons-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import {
  AVAILABLE_MAPS,
  STAGE_FORMATS,
  formattedWord,
  type EventFormType,
} from "../types";

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
  };
  setStageModalData: (data: any) => void;
  tempGroups: any[];
  setTempGroups: (groups: any[]) => void;
  handleGroupCountChangeLogic: (count: number) => void;
  updateGroupDetailLogic: (index: number, field: string, value: any) => void;
  toggleMapSelection: (groupIndex: number, map: string) => void;
  handleSaveStageLogic: () => void;
  passwordVisibility: Record<number, boolean>;
  toggleVisibility: (groupIndex: number) => void;
}

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
  toggleMapSelection,
  handleSaveStageLogic,
  passwordVisibility,
  toggleVisibility,
}: StageConfigModalProps) {
  const form = useFormContext<EventFormType>();

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
              <Label className="mb-2.5">Stage Format</Label>
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

            <div>
              <Label className="mb-2.5">
                Teams Qualifying from this Stage
              </Label>
              <Input
                type="number"
                min={0}
                value={
                  stageModalData.teams_qualifying_from_stage ===
                    undefined ||
                  stageModalData.teams_qualifying_from_stage === 0
                    ? ""
                    : stageModalData.teams_qualifying_from_stage
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setStageModalData({
                    ...stageModalData,
                    teams_qualifying_from_stage:
                      val === "" ? 0 : Number(val),
                  });
                }}
              />
            </div>

            <div>
              <Label className="mb-2.5">Number of Groups</Label>
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

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-3">
                You will configure {stageModalData.number_of_groups}{" "}
                group(s) in the next step
              </p>
              <div className="flex gap-2 flex-wrap">
                {tempGroups
                  .slice(0, stageModalData.number_of_groups)
                  .map((group, i) => (
                    <div
                      key={i}
                      className="px-3 py-1   border border-primary rounded-md text-xs"
                    >
                      {group.group_name}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {stageModalStep === 2 && (
          <div className="space-y-2">
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

                <div>
                  <Label className="mb-2.5">
                    Teams Qualifying from this Group
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={
                      group.teams_qualifying === 0
                        ? ""
                        : group.teams_qualifying
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

                <div>
                  <Label className="mb-2.5">Match count</Label>
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

                <div>
                  <Label className="mb-2.5">
                    Maps to be Played{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_MAPS.map((map) => {
                      const isSelected =
                        group.match_maps?.includes(map) || false;
                      return (
                        <Badge
                          key={map}
                          variant={"outline"}
                          onClick={() => toggleMapSelection(index, map)}
                          className={`cursor-pointer ${
                            isSelected
                              ? "border-primary text-primary"
                              : "hover:border-primary/50"
                          }`}
                        >
                          {map}
                          {isSelected && <span className="ml-1">✓</span>}
                        </Badge>
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

                <div>
                  <Label className="mb-2.5">Room ID</Label>
                  <Input
                    value={group.room_id}
                    onChange={(e) =>
                      updateGroupDetailLogic(
                        index,
                        "room_id",
                        e.target.value,
                      )
                    }
                    placeholder={`Room ${index + 1}`}
                  />
                </div>

                <div>
                  <Label className="mb-2.5">Room name</Label>
                  <Input
                    value={group.room_name}
                    onChange={(e) =>
                      updateGroupDetailLogic(
                        index,
                        "room_name",
                        e.target.value,
                      )
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
                    !stageModalData.stage_discord_role_id ||
                    stageModalData.teams_qualifying_from_stage === undefined
                  ) {
                    toast.error(
                      "Please fill all required stage fields (Step 1)",
                    );
                    return;
                  }
                  if (stageModalData.number_of_groups < 1) {
                    toast.error("Number of groups must be at least 1.");
                    return;
                  }
                  setStageModalStep(2);
                }}
              >
                Next: Configure Groups
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
