"use client";

import React, { useState } from "react";
import { useFormContext } from "react-hook-form";
// i18n: this Prize & Rules tab is shared by the admin + organizer event-edit wizards. All copy is
// internationalized via the "evEditTabs" namespace (messages/{en,fr,pt}/evEditTabs.json).
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Shared prize-currency options (owner 2026-07-01: create + edit use the SAME list).
import { PRIZE_CURRENCIES } from "@/app/(a)/a/events/create/_components/Step5PrizePool";
// Shared live distribution-vs-cash-value check (owner 2026-07-02: same rule as the create wizard).
import { PrizeDistributionSummary } from "@/app/(a)/a/events/create/_components/PrizeDistributionSummary";
// Shared "Suggest a split" dialog (owner backlog item 24: same suggestion the create wizard offers).
// On an event that already has amounts entered it shows them beside the suggestion and relabels its
// button to say it replaces them, so an existing payout table is never overwritten silently.
import { PrizeSuggestionDialog } from "@/app/(a)/a/events/create/_components/PrizeSuggestionDialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2 } from "lucide-react";
import {
  IconFile,
  IconFileText,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { Loader } from "@/components/Loader";
import type { EventFormType } from "../types";

interface PrizeRulesTabProps {
  rulesInputMethod: "type" | "upload";
  setRulesInputMethod: (v: "type" | "upload") => void;
  previewRuleUrl: string;
  setPreviewRuleUrl: (url: string) => void;
  selectedRuleFile: File | null;
  setSelectedRuleFile: (f: File | null) => void;
  rulesFileInputRef: React.RefObject<HTMLInputElement | null>;
  addPrizePosition: () => void;
  removePrizePosition: (key: string) => void;
  formatPrizeKey: (key: string) => string;
  onSaveChanges: () => void;
  loadingEvent: boolean;
  pendingSubmit: boolean;
}

export default function PrizeRulesTab({
  rulesInputMethod,
  setRulesInputMethod,
  previewRuleUrl,
  setPreviewRuleUrl,
  selectedRuleFile,
  setSelectedRuleFile,
  rulesFileInputRef,
  addPrizePosition,
  removePrizePosition,
  formatPrizeKey,
  onSaveChanges,
  loadingEvent,
  pendingSubmit,
}: PrizeRulesTabProps) {
  const form = useFormContext<EventFormType>();
  const t = useTranslations("evEditTabs");
  const [isDragging, setIsDragging] = useState(false);

  const prizeDistribution = form.watch("prize_distribution") || {};

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("prizeRules.cardTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={form.control}
          name="prizepool"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("prizeRules.totalPrizePool")}</FormLabel>
              <Input
                type="text"
                {...field}
                placeholder={t("prizeRules.totalPrizePoolPlaceholder")}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="prizepool_cash_value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t("prizeRules.cashValue")} <span className="text-red-500">*</span>
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
                  placeholder={t("prizeRules.cashValuePlaceholder")}
                />
              </FormControl>
              <p className="text-muted-foreground text-xs">
                {t("prizeRules.cashValueHelp")}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Prize currency (owner 2026-07-01): pick what currency the amounts above are in so the
            backend converts FROM the right one. Same list as the create wizard (Step5PrizePool). */}
        <FormField
          control={form.control}
          name="prize_currency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("prizeRules.prizeCurrency")}</FormLabel>
              <FormControl>
                <Select
                  value={(field.value as string) || "USD"}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("prizeRules.selectCurrency")} />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIZE_CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <p className="text-muted-foreground text-xs">
                {t("prizeRules.prizeCurrencyHelp")}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        <div className="space-y-3">
          <FormLabel>{t("prizeRules.prizeDistribution")}</FormLabel>
          {Object.entries(prizeDistribution).map(([key, value]) => (
            <div key={key} className="grid grid-cols-4 gap-2">
              <Input
                value={formatPrizeKey(key)}
                disabled
                className="col-span-1"
              />
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
                    const inputVal = e.target.value;
                    const updated = { ...prizeDistribution };
                    updated[key] = inputVal;
                    form.setValue("prize_distribution", updated, {
                      shouldDirty: true,
                    });
                  }}
                  placeholder={t("prizeRules.distributionPlaceholder")}
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={addPrizePosition}
            >
              {t("prizeRules.addPrizePosition")}
            </Button>
            {/* Suggest a whole distribution at once, instead of typing every line by hand. */}
            <PrizeSuggestionDialog
              cashValue={form.watch("prizepool_cash_value")}
              currency={(form.watch("prize_currency") as string) || "USD"}
              distribution={prizeDistribution}
              onApply={(suggested) =>
                form.setValue("prize_distribution", suggested, { shouldDirty: true })
              }
            />
          </div>

          {/* Live tally: does the distribution add up to the cash value? Tells over/under + by how much. */}
          <PrizeDistributionSummary
            distribution={prizeDistribution}
            cashValue={form.watch("prizepool_cash_value")}
            currency={(form.watch("prize_currency") as string) || "USD"}
          />
        </div>

        <Separator />

        <div className="space-y-4">
          <FormLabel>{t("prizeRules.tournamentRules")}</FormLabel>
          {/* flex-wrap so the pair does not push the page sideways on a phone: the French and
              Portuguese labels ("Mettre en ligne un document") are far longer than the English
              ones and overflowed a 390px viewport by 31px before this. Same idiom as the
              add-position / suggest-a-split row above. */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={rulesInputMethod === "type" ? "default" : "outline"}
              onClick={() => setRulesInputMethod("type")}
            >
              {t("prizeRules.typeRules")}
            </Button>
            <Button
              type="button"
              variant={rulesInputMethod === "upload" ? "default" : "outline"}
              onClick={() => setRulesInputMethod("upload")}
            >
              {t("prizeRules.uploadDocument")}
            </Button>
          </div>

          {rulesInputMethod === "type" ? (
            <FormField
              control={form.control}
              name="event_rules"
              render={({ field }) => (
                <FormItem>
                  <Textarea
                    {...field}
                    rows={10}
                    placeholder={t("prizeRules.rulesPlaceholder")}
                    onFocus={() => form.setValue("rules_document", "")}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name="rules_document"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("prizeRules.uploadRulesDocument")}</FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                      {!previewRuleUrl ? (
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragging(true);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) {
                              const supportedTypes = [
                                "application/pdf",
                                "application/msword",
                                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                              ];
                              if (!supportedTypes.includes(file.type)) {
                                toast.error(t("prizeRules.toastDocType"));
                                return;
                              }
                              setSelectedRuleFile(file);
                              setPreviewRuleUrl(URL.createObjectURL(file));
                            }
                          }}
                          className={`border-2 bg-muted border-dashed rounded-md p-12 text-center transition-colors cursor-pointer ${
                            isDragging
                              ? "border-primary bg-primary/5"
                              : "border-gray-300 bg-gray-50"
                          }`}
                          onClick={() => rulesFileInputRef.current?.click()}
                        >
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-16 h-16   rounded-full flex items-center justify-center">
                              <IconFileText
                                size={32}
                                className="text-primary dark:text-white"
                              />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {t("prizeRules.dropDocument")}{" "}
                              <span className="text-primary font-medium hover:underline">
                                {t("prizeRules.browse")}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t("prizeRules.supportsDocs")}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="relative w-full aspect-video bg-gray-50 border rounded-md flex flex-col items-center justify-center p-8">
                            <IconFile size={64} className="text-primary" />
                            <p className="text-sm font-medium mt-2">
                              {selectedRuleFile?.name ||
                                t("prizeRules.rulesDocUploaded")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t("prizeRules.fileSize", {
                                size: (
                                  (selectedRuleFile?.size || 0) /
                                  1024 /
                                  1024
                                ).toFixed(2),
                              })}
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="flex-1"
                              onClick={() => {
                                setSelectedRuleFile(null);
                                setPreviewRuleUrl("");
                                field.onChange("");
                                if (rulesFileInputRef.current) {
                                  rulesFileInputRef.current.value = "";
                                }
                              }}
                            >
                              <IconX size={16} className="mr-2" />
                              {t("prizeRules.remove")}
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              className="flex-1"
                              onClick={() =>
                                rulesFileInputRef.current?.click()
                              }
                            >
                              <IconUpload size={16} className="mr-2" />
                              {t("prizeRules.replace")}
                            </Button>
                          </div>
                        </div>
                      )}

                      <input
                        ref={rulesFileInputRef}
                        type="file"
                        accept=".pdf,application/pdf,.doc,application/msword,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          const supportedTypes = [
                            "application/pdf",
                            "application/msword",
                            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                          ];

                          if (!supportedTypes.includes(file.type)) {
                            toast.error(t("prizeRules.toastDocType"));
                            return;
                          }

                          setSelectedRuleFile(file);
                          field.onChange(file);
                          setPreviewRuleUrl(URL.createObjectURL(file));
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <Button
          type="button"
          onClick={onSaveChanges}
          disabled={loadingEvent || pendingSubmit}
        >
          {loadingEvent || pendingSubmit ? (
            <Loader text={t("prizeRules.saving")} />
          ) : (
            t("prizeRules.saveChanges")
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
