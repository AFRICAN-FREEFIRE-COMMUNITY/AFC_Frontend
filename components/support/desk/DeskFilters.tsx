"use client";

/**
 * DeskFilters - the support desk's filter bar (inbox #169 / #174).
 *
 * Owner 2026-10-08: "they should still be able to filter requests by dates, time, country etc."
 * Approved preview: WEBSITE/mockups/support-desk-v2/support-desk-preview.html.
 *
 * Always visible: search, status chips (filled, never ringed), a From / To date AND time range with
 * quick ranges, country. Behind "More filters": where it came from, who it is assigned to, only
 * those with files. On a phone the whole bar opens from a "Filters (n)" button.
 *
 * Owns no data: the desk (components/support/desk/SupportDesk.tsx) holds the DeskFilterState and
 * turns it into GET support/people/ parameters (lib/api/support.ts getSupportPeople). Times are the
 * viewer's wall clock in the inputs and cross to ISO through lib/i18n/time.ts localInputToIso (R31).
 *
 * On an ORGANIZER's desk (inbox #175) every request came from "Ask the organizer", so the "where it
 * came from" filter is not drawn (`hideSource`).
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { IconAdjustmentsHorizontal, IconSearch } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SupportTicket } from "@/lib/api/support";
import { isoToLocalInput } from "@/lib/i18n/time";
import { cn } from "@/lib/utils";

export const STATUSES: SupportTicket["status"][] = ["open", "waiting", "resolved", "closed"];
export const SOURCES = ["contact_form", "help_bot", "staff"] as const;
export type RangePreset = "today" | "week" | "month" | "all" | "custom";

export interface DeskFilterState {
  q: string;
  statuses: SupportTicket["status"][];
  /** datetime-local values, the viewer's wall clock ("" = no bound). */
  from: string;
  to: string;
  preset: RangePreset;
  country: string;
  source: string;
  assigned: string;
  hasFiles: boolean;
}

export const DEFAULT_FILTERS: DeskFilterState = {
  q: "",
  statuses: ["open", "waiting"],
  from: "",
  to: "",
  preset: "all",
  country: "all",
  source: "all",
  assigned: "any",
  hasFiles: false,
};

/** The From value a quick range stands for (the To bound stays open: "until now"). */
export function presetFrom(preset: RangePreset): string {
  const now = new Date();
  if (preset === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return isoToLocalInput(start.toISOString());
  }
  if (preset === "week") return isoToLocalInput(new Date(now.getTime() - 7 * 864e5).toISOString());
  if (preset === "month") return isoToLocalInput(new Date(now.getTime() - 30 * 864e5).toISOString());
  return "";
}

/** How many filters past the defaults are set (the phone button's count). */
export function activeFilterCount(f: DeskFilterState): number {
  let n = 0;
  if (f.from || f.to) n++;
  if (f.country !== "all") n++;
  if (f.source !== "all") n++;
  if (f.assigned !== "any") n++;
  if (f.hasFiles) n++;
  return n;
}

export function DeskFilters({
  value,
  onChange,
  countries,
  statusCounts,
  countLine,
  hideSource = false,
}: {
  value: DeskFilterState;
  onChange: (next: DeskFilterState) => void;
  countries: { value: string; label: string }[];
  statusCounts?: Partial<Record<SupportTicket["status"], number>>;
  countLine: string;
  hideSource?: boolean;
}) {
  const t = useTranslations("support");
  const [more, setMore] = useState(false);
  const [openOnPhone, setOpenOnPhone] = useState(false);
  const set = (patch: Partial<DeskFilterState>) => onChange({ ...value, ...patch });
  const toggleStatus = (s: SupportTicket["status"]) =>
    set({ statuses: value.statuses.includes(s) ? value.statuses.filter((x) => x !== s) : [...value.statuses, s] });
  const moreCount = (value.source !== "all" ? 1 : 0) + (value.assigned !== "any" ? 1 : 0) + (value.hasFiles ? 1 : 0);

  const label = "text-muted-foreground text-[11px] font-semibold uppercase tracking-wide";
  return (
    <>
      {/* Phone: the bar opens from one button so the list is the first thing on screen. */}
      <div className="mb-3 flex items-center justify-between gap-2 lg:hidden">
        <Button variant="outline" size="sm" onClick={() => setOpenOnPhone((v) => !v)}>
          <IconAdjustmentsHorizontal className="mr-1 size-4" />
          {t("desk.filters.button", { count: activeFilterCount(value) })}
        </Button>
        <span className="text-muted-foreground text-xs">{countLine}</span>
      </div>

      <div
        className={cn(
          "bg-card mb-3 flex-wrap items-end gap-x-3 gap-y-2.5 rounded-md p-3",
          openOnPhone ? "flex" : "hidden lg:flex",
        )}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className={label}>{t("desk.filters.search")}</span>
          <div className="relative">
            <IconSearch className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
            <Input
              value={value.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder={t("desk.search")}
              maxLength={120}
              className="w-full pl-8 sm:w-[260px]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className={label}>{t("desk.filters.status")}</span>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => {
              const on = value.statuses.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleStatus(s)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold",
                    on ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`status.${s}`)}
                  {statusCounts?.[s] !== undefined ? <span className="opacity-80">{statusCounts[s]}</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className={label}>{t("desk.filters.from")}</span>
          <Input
            type="datetime-local"
            value={value.from}
            onChange={(e) => set({ from: e.target.value, preset: "custom" })}
            className="w-full sm:w-[200px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className={label}>{t("desk.filters.to")}</span>
          <Input
            type="datetime-local"
            value={value.to}
            onChange={(e) => set({ to: e.target.value, preset: "custom" })}
            className="w-full sm:w-[200px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className={label}>{t("desk.filters.range")}</span>
          <div className="flex gap-1">
            {(["today", "week", "month", "all"] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={value.preset === p}
                onClick={() => set({ preset: p, from: presetFrom(p), to: "" })}
                className={cn(
                  "h-8 rounded-md px-2 text-xs font-semibold",
                  value.preset === p ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {t(`desk.range.${p}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className={label}>{t("desk.filters.country")}</span>
          <Select value={value.country} onValueChange={(country) => set({ country })}>
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("desk.filters.allCountries")}</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="ghost" size="sm" className="hidden lg:inline-flex" onClick={() => setMore((v) => !v)}>
          {more ? t("desk.filters.fewer") : t("desk.filters.more")}
          {!more && moreCount ? ` (${moreCount})` : ""}
        </Button>

        <div className={cn("contents", !more && "lg:hidden")}>
          <div className={cn("flex flex-col gap-1", hideSource && "hidden")}>
            <span className={label}>{t("desk.filters.source")}</span>
            <Select value={value.source} onValueChange={(source) => set({ source })}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("desk.filters.anywhere")}</SelectItem>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`desk.source.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={label}>{t("desk.filters.assigned")}</span>
            <Select value={value.assigned} onValueChange={(assigned) => set({ assigned })}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["any", "me", "none"] as const).map((a) => (
                  <SelectItem key={a} value={a}>
                    {t(`desk.assigned.${a}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="text-muted-foreground flex h-9 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={value.hasFiles}
              onChange={(e) => set({ hasFiles: e.target.checked })}
            />
            {t("desk.filters.hasFiles")}
          </label>
        </div>

        <span className="text-muted-foreground ml-auto hidden self-center text-xs lg:inline">{countLine}</span>
      </div>
    </>
  );
}
