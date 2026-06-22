"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { InfoTip } from "@/components/ui/info-tip";
import { EventFormType } from "./types";
// Shared prize-distribution helpers (see lib/eventFormats.ts). These renumber the map to
// a contiguous "1".."N" on every add/remove, which is what fixes the "can't re-add a
// deleted position / can't fix a wrong one" bug. The edit tab + organizer edit page use
// the exact same helpers so create + edit behave identically.
import {
  addPrizePositionTo,
  removePrizePositionFrom,
  formatPrizeKey,
} from "@/lib/eventFormats";

interface Step5Props {
  form: UseFormReturn<EventFormType>;
}

export function Step5PrizePool({ form }: Step5Props) {
  const prizeDistribution = form.watch("prize_distribution") || {};

  // Add the next sequential position. addPrizePositionTo renumbers first, so the new key
  // is always (current row count)+1 and can never collide with or overwrite an existing
  // row even after a middle position was deleted.
  const addPrizePosition = () => {
    form.setValue(
      "prize_distribution",
      addPrizePositionTo(prizeDistribution),
      { shouldDirty: true },
    );
  };

  // Remove a position and renumber the survivors back to 1..N (no gaps), so the slot can
  // be rebuilt by adding again. Keeps at least one row.
  const removePrizePosition = (key: string) => {
    form.setValue(
      "prize_distribution",
      removePrizePositionFrom(prizeDistribution, key),
      { shouldDirty: true },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          Step 5: Prize Pool &amp; Distribution
          <InfoTip id="events.create.prizes._section" className="ml-1.5" />
        </CardTitle>
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

        <FormField
          // @ts-ignore
          control={form.control}
          name="prizepool_cash_value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prize Pool Cash Value</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  value={field.value === undefined || field.value === null ? "" : field.value}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)
                  }
                  onKeyDown={(e) => {
                    if (
                      !/^\d$/.test(e.key) &&
                      !["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                    ) {
                      e.preventDefault();
                    }
                  }}
                  placeholder="e.g., 5000"
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
              {/* Show the position as an ordinal ("1st", "2nd", ...). The map is keyed by
                  contiguous numeric strings now, so we format for display; the underlying
                  key stays "1".."N" for the backend payload. */}
              <Input value={formatPrizeKey(key)} disabled className="col-span-1" />
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
