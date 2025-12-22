"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { IconChevronRight } from "@tabler/icons-react";
import { Label } from "@/components/ui/label";

export function FileUploadStep({ onNext, onBack, updateData }: any) {
  const [fileType, setFileType] = useState("match_result_file");

  const handleContinue = () => {
    updateData({ file_type: fileType });
    onNext();
  };

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle>Select File Type</CardTitle>
        <CardDescription>
          Choose the data source type for leaderboard extraction.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <RadioGroup
          value={fileType}
          onValueChange={setFileType}
          className="space-y-0"
        >
          <Label
            htmlFor="match"
            className={`flex items-start gap-2 p-4 rounded-lg border cursor-pointer transition-colors ${
              fileType === "match_result_file"
                ? "border-primary bg-primary/10"
                : ""
            }`}
          >
            <RadioGroupItem
              value="match_result_file"
              id="match"
              className="mt-1"
            />
            <div className="grid gap-0.5">
              <span className="font-semibold text-sm">Match Results File</span>
              <span className="text-xs text-muted-foreground">
                Extracts Rank and Kills only.
              </span>
            </div>
          </Label>

          <Label
            htmlFor="debug"
            className={`flex items-start gap-2 p-4 rounded-lg border cursor-pointer transition-colors ${
              fileType === "match_result_file"
                ? "border-primary bg-primary/10"
                : ""
            }`}
          >
            <RadioGroupItem value="debugger_file" id="debug" className="mt-1" />
            <div className="grid gap-0.5">
              <span className="font-semibold text-sm">Debugger File</span>
              <span className="text-xs text-muted-foreground">
                Extracts all metrics (Kills, Assists, Damage, etc).
              </span>
            </div>
          </Label>
        </RadioGroup>

        <div className="flex justify-between pt-6">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={handleContinue}>
            Continue to Point System <IconChevronRight size={16} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
