"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("evSteps");
  const stages = form.watch("stages") || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("step4.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <h3 className="font-semibold">{t("step4.stageOrder")}</h3>
        <div className="space-y-3">
          {stageNames.map((name, index) => {
            const stage = stages[index];
            // FORMATTED_WORD is a shared bracket-label constant (lib/eventFormats); its value
            // is interpolated into the translated "{count} Groups • {format}" string.
            const stageStatus = stage
              ? t("step4.groupsFormat", {
                  count: stage.groups.length,
                  format: FORMATTED_WORD[stage.stage_format],
                })
              : t("step4.notConfigured");

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
                    size="icon"
                    onClick={() => onMoveStage(index, "up")}
                    disabled={index === 0}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
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
                    {stage ? t("step4.edit") : t("step4.add")}
                  </Button>
                  {stage && stages.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
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
