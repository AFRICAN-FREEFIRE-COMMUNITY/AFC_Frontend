"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { EventFormType, FORMATTED_WORD } from "./types";

interface Step4Props {
  form: UseFormReturn<EventFormType>;
  stageNames: string[];
  onMoveStage: (index: number, direction: "up" | "down") => void;
  onDeleteStage: (index: number) => void;
  onOpenStageModal: (index: number) => void;
}

export function Step4StageOrdering({
  form,
  stageNames,
  onMoveStage,
  onDeleteStage,
  onOpenStageModal,
}: Step4Props) {
  const stages = form.watch("stages") || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 4: Stage Details &amp; Ordering</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <h3 className="font-semibold">Stage Order</h3>
        <div className="space-y-3">
          {stageNames.map((name, index) => {
            const stage = stages[index];
            const stageStatus = stage
              ? `${stage.groups.length} Groups • ${FORMATTED_WORD[stage.stage_format]}`
              : "Not Configured";

            return (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-primary/10 border border-primary/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500">::</span>
                  <div>
                    <div className="font-semibold">{name}</div>
                    {stage && <div className="text-sm text-zinc-400">{stageStatus}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onMoveStage(index, "up")}
                    disabled={index === 0}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onMoveStage(index, "down")}
                    disabled={index === stageNames.length - 1}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenStageModal(index)}
                  >
                    {stage ? "Edit" : "Add"}
                  </Button>
                  {stage && stages.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => onDeleteStage(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
