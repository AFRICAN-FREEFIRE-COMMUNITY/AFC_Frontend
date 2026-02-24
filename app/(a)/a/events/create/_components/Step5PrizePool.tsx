"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { EventFormType } from "./types";

interface Step5Props {
  form: UseFormReturn<EventFormType>;
}

export function Step5PrizePool({ form }: Step5Props) {
  const prizeDistribution = form.watch("prize_distribution") || {};

  const addPrizePosition = () => {
    const current = { ...prizeDistribution };
    const nextPos = Object.keys(current).length + 1;
    const suffix =
      nextPos === 1 ? "st" : nextPos === 2 ? "nd" : nextPos === 3 ? "rd" : "th";
    form.setValue("prize_distribution", {
      ...current,
      [`${nextPos}${suffix}`]: 0,
    });
  };

  const removePrizePosition = (key: string) => {
    if (Object.keys(prizeDistribution).length <= 1) return;
    const current = { ...prizeDistribution };
    delete current[key];
    form.setValue("prize_distribution", current);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 5: Prize Pool &amp; Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          // @ts-ignore
          control={form.control}
          name="prizepool"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Total Prize Pool</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  value={field.value === undefined || field.value === null ? "" : field.value.toString()}
                  onChange={(e) => field.onChange(e.target.value)}
                  placeholder="e.g., 5000 USD"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3">
          <FormLabel>Prize Distribution</FormLabel>
          {Object.entries(prizeDistribution).map(([key, value]) => (
            <div key={key} className="grid grid-cols-4 gap-2">
              <Input value={key} disabled className="col-span-1" />
              <div className="col-span-3 flex items-center justify-end gap-1">
                <Input
                  type="text"
                  value={value || ""}
                  onChange={(e) => {
                    const updated = { ...prizeDistribution, [key]: e.target.value };
                    form.setValue("prize_distribution", updated, { shouldDirty: true });
                  }}
                  placeholder="e.g., $2,000 or 2000 Diamonds"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removePrizePosition(key)}
                  disabled={Object.keys(prizeDistribution).length <= 1}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addPrizePosition}>
            + Add Prize Position
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
