"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { InfoTip } from "@/components/ui/info-tip";
import { EventFormType } from "./types";
import { AFC_CURRENCIES } from "@/lib/currencies";
// Shared prize-distribution helpers (see lib/eventFormats.ts). These renumber the map to
// a contiguous "1".."N" on every add/remove, which is what fixes the "can't re-add a
// deleted position / can't fix a wrong one" bug. The edit tab + organizer edit page use
// the exact same helpers so create + edit behave identically.
import {
  addPrizePositionTo,
  removePrizePositionFrom,
  formatPrizeKey,
} from "@/lib/eventFormats";
// Live "distribution vs cash value" check (owner 2026-07-02). Same component + rule the edit tab uses.
import { PrizeDistributionSummary } from "./PrizeDistributionSummary";

// Prize-currency options (owner 2026-07-01: "more currencies, not just usd and ngn"; widened again by
// backlog item 28, 2026-08-03: "some currencies are missing when entering a prize pool").
//
// This used to be a 20-code array maintained here. It is now the canonical menu from
// lib/currencies.ts, which every currency picker on the site shares, so the prize-pool list can no
// longer drift away from the display-currency and broadcast lists. Every code is FxRate-backed, so
// the backend (get_total_prize_pool) can convert it to USD. USD is the platform base + the default.
// Re-exported under the original name so PrizeRulesTab's import keeps working.
export const PRIZE_CURRENCIES = AFC_CURRENCIES;

interface Step5Props {
  form: UseFormReturn<EventFormType>;
}

export function Step5PrizePool({ form }: Step5Props) {
  const t = useTranslations("evSteps");
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
          {t("step5.title")}
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
              <FormLabel>{t("step5.totalPrizePool")}</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  value={field.value === undefined || field.value === null ? "" : field.value.toString()}
                  onChange={(e) => field.onChange(e.target.value)}
                  placeholder={t("step5.totalPrizePoolPlaceholder")}
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
              <FormLabel>
                {t("step5.cashValue")} <span className="text-red-500">*</span>
              </FormLabel>
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
                  placeholder={t("step5.cashValuePlaceholder")}
                />
              </FormControl>
              <p className="text-muted-foreground text-xs">
                {t("step5.cashValueHelp")}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Currency the prize amounts above are entered in, so the backend knows what to convert FROM
            (owner 2026-07-01). Default USD (the platform base). Binds to prize_currency; sent on submit
            + read by get_total_prize_pool + the <Money from={prize_currency}> displays. */}
        <FormField
          // @ts-ignore
          control={form.control}
          name="prize_currency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("step5.prizeCurrency")}</FormLabel>
              <FormControl>
                <Select
                  value={(field.value as string) || "USD"}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("step5.selectCurrency")} />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIZE_CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {/* c.code comes from the shared menu in lib/currencies.ts. Names are
                            translated under step5.currencyNames.*; the t.has guard falls back to the
                            English c.name for any code added to the shared list before its key
                            exists, so widening the menu can never render a raw MISSING_MESSAGE. */}
                        {c.code} -{" "}
                        {t.has(`step5.currencyNames.${c.code}`)
                          ? t(`step5.currencyNames.${c.code}`)
                          : c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <p className="text-muted-foreground text-xs">
                {t("step5.currencyHelp")}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3">
          <FormLabel>{t("step5.prizeDistribution")}</FormLabel>
          {Object.entries(prizeDistribution).map(([key, value]) => (
            <div key={key} className="grid grid-cols-4 gap-2">
              {/* Show the position as an ordinal ("1st", "2nd", ...). The map is keyed by
                  contiguous numeric strings now, so we format for display; the underlying
                  key stays "1".."N" for the backend payload. */}
              <Input value={formatPrizeKey(key)} disabled className="col-span-1" />
              <div className="col-span-3 flex items-center justify-end gap-1">
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  onKeyDown={(e) => {
                    // Numbers only (owner 2026-07-02): prize amounts must be plain numbers so the
                    // distribution can be summed and checked against the cash value.
                    if (
                      !/^[0-9.]$/.test(e.key) &&
                      !["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                    ) {
                      e.preventDefault();
                    }
                  }}
                  value={value || ""}
                  onChange={(e) => {
                    const updated = { ...prizeDistribution, [key]: e.target.value };
                    form.setValue("prize_distribution", updated, { shouldDirty: true });
                  }}
                  placeholder={t("step5.amountPlaceholder")}
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
            {t("step5.addPosition")}
          </Button>

          {/* Live tally: does the distribution add up to the cash value? Tells over/under + by how much. */}
          <PrizeDistributionSummary
            distribution={prizeDistribution}
            cashValue={form.watch("prizepool_cash_value")}
            currency={(form.watch("prize_currency") as string) || "USD"}
          />
        </div>
      </CardContent>
    </Card>
  );
}
