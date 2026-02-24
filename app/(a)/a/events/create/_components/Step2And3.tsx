"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { EventFormType } from "./types";

// ─── Step 2: Event Mode ───────────────────────────────────────────────────────

interface Step2Props {
  form: UseFormReturn<EventFormType>;
}

export function Step2EventMode({ form }: Step2Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: Event Mode</CardTitle>
      </CardHeader>
      <CardContent>
        <FormField
          // @ts-ignore
          control={form.control}
          name="event_mode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Select Event Mode</FormLabel>
              <FormControl>
                <RadioGroup onValueChange={field.onChange} value={field.value}>
                  {["virtual", "physical", "hybrid"].map((mode) => (
                    <div
                      key={mode}
                      className="flex items-center gap-2 p-4 border border-input rounded-md"
                    >
                      <RadioGroupItem value={mode} />
                      <span className="capitalize text-sm">
                        {mode === "physical" ? "Physical (LAN)" : mode}
                      </span>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}

// ─── Step 3: Number of Stages ─────────────────────────────────────────────────

interface Step3Props {
  form: UseFormReturn<EventFormType>;
  stageNames: string[];
  onStageCountChange: (count: number) => void;
  onStageNameChange: (index: number, name: string) => void;
}

export function Step3StageCount({
  form,
  stageNames,
  onStageCountChange,
  onStageNameChange,
}: Step3Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 3: Select Number of Stages</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          // @ts-ignore
          control={form.control}
          name="number_of_stages"
          render={({ field }) => (
            <FormItem>
              <FormLabel>How many stages?</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  value={
                    field.value === undefined || field.value === null || field.value === 0
                      ? ""
                      : field.value.toString()
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    field.onChange(val);
                    const numericVal = Number(val);
                    if (val !== "" && !isNaN(numericVal)) {
                      onStageCountChange(numericVal);
                    } else {
                      onStageCountChange(0);
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3">
          <FormLabel>Stage Names</FormLabel>
          {stageNames.map((name, index) => (
            <Input
              key={index}
              value={name}
              onChange={(e) => onStageNameChange(index, e.target.value)}
              placeholder={`Stage ${index + 1}`}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
