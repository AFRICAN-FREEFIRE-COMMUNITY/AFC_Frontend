"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// The maths. Pure, unit-tested in lib/__tests__/prizeSuggestion.test.ts. Everything about WHICH
// curve and WHY (it is fitted to AFC's own historical payouts) is documented there, not here.
import {
  suggestPrizeSplit,
  buildSuggestedDistribution,
  defaultShapeForPlaces,
  PRIZE_SHAPE_IDS,
  MAX_SUGGESTED_PLACES,
  type PrizeShapeId,
} from "@/lib/prizeSuggestion";
// Existing shared prize helpers, reused rather than reimplemented so "what counts as an amount"
// stays defined in exactly one place across the whole prize surface.
import { parsePrizeAmount, sumPrizeDistribution, hasCashValue } from "./PrizeDistributionSummary";
// Saved events do not all use numeric keys: older ones are keyed "1st"/"2nd"/"3rd" (e.g. DYNASTY
// CUP GRAND FINALS SSA still is). renumberPrizeDistribution is the helper the add/remove buttons
// already use to fold any of those shapes down to a contiguous "1".."N" in visual row order, so we
// reuse it here rather than looking rows up by a numeric key that a legacy event simply does not
// have. Without it the "Current" column silently showed a dash for every row on those events.
import { renumberPrizeDistribution, type PrizeDistInput } from "@/lib/eventFormats";

// ── PrizeSuggestionDialog (owner backlog item 24) ────────────────────────────
// "When an admin or organizer enters a prize pool value, suggest a distribution based on the
// number of available positions."
//
// This is a SUGGESTION and never a silent write. Nothing changes until the organizer presses the
// apply button, and when the event already has amounts entered the dialog shows the current value
// beside every suggested one and relabels the button to say it replaces them.
//
// WHERE IT IS MOUNTED (both prize surfaces, exactly like PrizeDistributionSummary next door):
//   • create wizard  -> Step5PrizePool.tsx  (admin create + organizer create both mount that)
//   • edit prize tab -> PrizeRulesTab.tsx   (admin edit + organizer edit both mount that)
// Each passes the form values it already watches and takes the result back through onApply, which
// does the single form.setValue("prize_distribution", ...) call. This component never touches the
// form itself, so it stays testable and the two surfaces keep their own dirty-state handling.
//
// i18n: keys live under the "evSteps" namespace (messages/{en,fr,pt}/evSteps.json) because that is
// the namespace the sibling shared prize component already uses from both surfaces.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  /** The event's prize-pool cash value, i.e. the number the split must add up to. */
  cashValue?: unknown;
  /** ISO code the amounts are denominated in (Event.prize_currency). Display only, nothing converts. */
  currency?: string;
  /**
   * The distribution currently in the form, so we can prefill the place count and diff against it.
   * Typed as PrizeDistInput (the shared "prize map as it might arrive" contract from
   * lib/eventFormats.ts) rather than Record<string, unknown>, because that is exactly what the
   * form holds: mostly strings, but legacy create seeds put the number 0 in there.
   */
  distribution?: PrizeDistInput | null;
  /** Hands the accepted split back to the parent, which writes it into the form. */
  onApply: (distribution: Record<string, string>) => void;
}

export function PrizeSuggestionDialog({
  cashValue,
  currency = "USD",
  distribution,
  onApply,
}: Props) {
  const t = useTranslations("evSteps");
  const [open, setOpen] = useState(false);

  // The distribution as it is actually laid out on screen, keyed "1".."N" regardless of whether
  // the saved event used numeric or legacy ordinal keys. Everything below reads THIS, not the raw
  // prop, so the Current column lines up with the rows the organizer can see.
  const currentRows = useMemo(
    () => renumberPrizeDistribution(distribution ?? {}),
    [distribution],
  );

  // How many places to split across. Seeded from the rows already in the form when the dialog
  // opens, which is the "number of available positions" the brief asks us to base the split on.
  const currentPlaces = Math.max(1, Object.keys(currentRows).length);
  const [places, setPlaces] = useState(currentPlaces);
  const [shape, setShape] = useState<PrizeShapeId>(defaultShapeForPlaces(currentPlaces));
  // Once the organizer picks a shape by hand we stop moving it under them. Until then the shape
  // tracks the place count, so going from 3 places to 12 does not leave a halving curve in place
  // that would starve the tail.
  const [shapeTouched, setShapeTouched] = useState(false);

  // Reset to the form's current state every time the dialog opens, so it never shows a stale
  // place count from a previous visit.
  useEffect(() => {
    if (!open) return;
    setPlaces(currentPlaces);
    setShape(defaultShapeForPlaces(currentPlaces));
    setShapeTouched(false);
    // currentPlaces intentionally omitted: we want the value AS AT OPEN, not a live subscription
    // that would fight the organizer while they are typing in the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pool = parsePrizeAmount(cashValue);
  const poolIsSet = hasCashValue(cashValue) && pool > 0;

  // Does the event already have money entered? Drives the overwrite guard + the Current column.
  const hasExistingAmounts = sumPrizeDistribution(currentRows) > 0;

  const split = useMemo(
    () => (poolIsSet ? suggestPrizeSplit(pool, places, shape) : null),
    [poolIsSet, pool, places, shape],
  );

  // Format for display only. The values written into the form stay as plain unformatted number
  // strings (see buildSuggestedDistribution) because the amount fields are <Input type="number">.
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  // Rows to render: every place in the suggestion, plus any EXISTING place beyond it so an
  // organizer shrinking the table can see exactly which lines they are dropping.
  const rowCount = Math.max(places, Object.keys(currentRows).length);

  const handleApply = () => {
    if (!split) return;
    onApply(buildSuggestedDistribution(split));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Wand2 className="w-4 h-4 mr-2" />
          {t("prizeSuggest.trigger")}
        </Button>
      </DialogTrigger>

      {/* Mobile-safe dialog shell: same sizing idiom as StageModal so it fits a 390px phone. */}
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("prizeSuggest.title")}</DialogTitle>
          <DialogDescription>{t("prizeSuggest.description")}</DialogDescription>
        </DialogHeader>

        {!poolIsSet ? (
          // No pool to split. Say so plainly rather than rendering a table of zeroes.
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            {t("prizeSuggest.noPool")}
          </div>
        ) : (
          <div className="space-y-4">
            {/* ── how many places ── */}
            <div className="space-y-2">
              <Label htmlFor="prize-suggest-places">{t("prizeSuggest.placesLabel")}</Label>
              <Input
                id="prize-suggest-places"
                type="number"
                min={1}
                max={MAX_SUGGESTED_PLACES}
                inputMode="numeric"
                value={places}
                onChange={(e) => {
                  // Clamp to 1..MAX so an empty or absurd entry cannot produce a nonsense table.
                  const raw = parseInt(e.target.value, 10);
                  const next = Number.isNaN(raw)
                    ? 1
                    : Math.min(MAX_SUGGESTED_PLACES, Math.max(1, raw));
                  setPlaces(next);
                  if (!shapeTouched) setShape(defaultShapeForPlaces(next));
                }}
              />
            </div>

            {/* ── which shape ── three only, matching the "Type / Upload" button idiom this
                 prize surface already uses for a pick-one choice. */}
            <div className="space-y-2">
              <Label>{t("prizeSuggest.shapeLabel")}</Label>
              <div className="flex flex-wrap gap-2">
                {PRIZE_SHAPE_IDS.map((id) => (
                  <Button
                    key={id}
                    type="button"
                    size="sm"
                    variant={shape === id ? "default" : "outline"}
                    onClick={() => {
                      setShape(id);
                      setShapeTouched(true);
                    }}
                  >
                    {t(`prizeSuggest.shapes.${id}.name`)}
                  </Button>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                {t(`prizeSuggest.shapes.${shape}.hint`)}
              </p>
            </div>

            {!split ? (
              // Pool is set but cannot be split this many ways (e.g. 5 cents across 12 places).
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                {t("prizeSuggest.poolTooSmall", { places })}
              </div>
            ) : (
              <>
                {/* ── the preview. Own scroll container so the footer buttons stay reachable
                     with 50 places open on a phone. ── */}
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-10 p-2 text-foreground">
                          {t("prizeSuggest.colPlace")}
                        </TableHead>
                        {hasExistingAmounts && (
                          <TableHead className="h-10 p-2 text-foreground text-right">
                            {t("prizeSuggest.colCurrent")}
                          </TableHead>
                        )}
                        <TableHead className="h-10 p-2 text-foreground text-right">
                          {t("prizeSuggest.colSuggested")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: rowCount }, (_, i) => {
                        const suggested = i < places ? split.lines[i] : null;
                        const existingRaw = currentRows[`${i + 1}`];
                        const existing = parsePrizeAmount(existingRaw);
                        return (
                          <TableRow key={i}>
                            <TableCell className="p-2 text-xs font-medium">
                              #{i + 1}
                            </TableCell>
                            {hasExistingAmounts && (
                              <TableCell className="p-2 text-xs text-right text-muted-foreground">
                                {existing > 0 ? fmt(existing) : "-"}
                              </TableCell>
                            )}
                            <TableCell className="p-2 text-xs text-right font-medium">
                              {suggested === null ? (
                                // This place exists today but falls outside the new place count.
                                <span className="text-red-500">
                                  {t("prizeSuggest.removedMark")}
                                </span>
                              ) : (
                                fmt(parseFloat(suggested))
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Total, so the organizer can see at a glance that it lands on the pool. */}
                <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary flex items-center justify-between gap-3">
                  <span>{t("prizeSuggest.totalRow")}</span>
                  <span className="font-semibold">
                    {fmt(pool)} {currency}
                  </span>
                </div>

                {/* Where the rounding went. Stated explicitly because the organizer is about to
                    accept numbers they did not type. */}
                <p className="text-muted-foreground text-xs">
                  {t("prizeSuggest.roundingNote", {
                    amount: fmt(split.remainderToFirst),
                    currency,
                  })}
                </p>

                {/* ── overwrite guard: never replace entered money without saying so ── */}
                {hasExistingAmounts && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                    {t("prizeSuggest.replaceWarning")}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {t("prizeSuggest.cancel")}
          </Button>
          <Button type="button" onClick={handleApply} disabled={!split}>
            {/* The label itself carries the warning when there is money to overwrite. */}
            {hasExistingAmounts ? t("prizeSuggest.replace") : t("prizeSuggest.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
