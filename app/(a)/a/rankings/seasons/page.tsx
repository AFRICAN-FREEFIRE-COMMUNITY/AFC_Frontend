"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  IconPlus, IconEdit, IconArrowsExchange, IconPlayerPlay, IconHistory,
  IconLock, IconLockOpen, IconClockPlus, IconAlertTriangle,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { rankingsApi } from "@/lib/rankings";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
// Calendar dates (no time component) must go through formatLocalDateOnly, and real UTC
// instants through <LocalTime/>; see the fmtDate note below for which field is which.
import { formatLocalDateOnly } from "@/lib/i18n/time";
import { LocalTime } from "@/components/LocalTime";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";
// Live refresh (owner 2026-07-02): site-wide heartbeat; the seasons list + transfer log
// re-fetch on each tick (and on tab return) so this page updates without a manual reload.
// The dialogs hold their own form snapshots, so a background refresh never touches them.
import { useLiveTick } from "@/hooks/useLiveTick";

interface Season {
  season_id: number;
  name: string;
  quarter: number;
  year: number;
  is_active: boolean;
  start_date: string;
  end_date: string;
  transfer_window_open: string | null;
  transfer_window_close: string | null;
  tier_eval_run: boolean;
  tier_eval_run_at?: string | null;
  tier_eval_run_by?: string | null;
}

// shape the transfer-window log table reads (mapped from the backend rows)
interface TransferLogRow {
  id: number;
  action: string;
  prev_close: string | null;
  new_close: string | null;
  by: string;
  at: string | null;
  reason: string;
}

type TransferAction = "open" | "close" | "extend";

// mockup action → backend TransferWindowLog.ACTION_CHOICES value
const TRANSFER_ACTION_MAP: Record<TransferAction, string> = {
  open: "opened",
  close: "closed",
  extend: "extended",
};

const QUARTERS = [1, 2, 3, 4] as const;

/**
 * Render one CALENDAR DATE for display.
 *
 * Every date this page shows is a Django DateField on afc_rankings/models.py
 * (Season.start_date / end_date / transfer_window_open / transfer_window_close, and
 * TransferWindowLog.previous_close_date / new_close_date), i.e. a bare "YYYY-MM-DD" with no
 * time component, so it goes through formatLocalDateOnly. The datetime path would parse
 * "2026-08-10" as midnight UTC and show the 9th to every viewer west of London (the bug fixed
 * on 2026-08-03). The only real instant here is TransferWindowLog.changed_at (DateTimeField),
 * which is rendered with <LocalTime mode="date" /> instead.
 *
 * `locale` comes from next-intl's useLocale() so month names follow the AFC UI language; this
 * used to call toLocaleDateString(undefined, ...), which follows the BROWSER language and gave
 * a French admin English month names. `none` is the caller's translated empty-value label.
 */
const fmtDate = (d: string | null | undefined, locale: string, none: string) =>
  d ? formatLocalDateOnly(d, locale) : none;

// transfer-window state derived from the active season's dates vs "today".
// Returns a message KEY rather than English text, so each caller renders it through its own
// translator: window.* for the badge, windowLower.* inside the "Currently ..." sentence.
type WindowStateKey = "notSet" | "upcoming" | "closed" | "open";
function windowState(s: Season): { open: boolean; key: WindowStateKey } {
  if (!s.transfer_window_open || !s.transfer_window_close) return { open: false, key: "notSet" };
  const now = new Date();
  const open = new Date(s.transfer_window_open);
  const close = new Date(s.transfer_window_close);
  if (now < open) return { open: false, key: "upcoming" };
  if (now > close) return { open: false, key: "closed" };
  return { open: true, key: "open" };
}

const transferActionMeta: Record<string, string> = {
  opened: "bg-green-500/10 text-green-500 border-green-500/20",
  extended: "bg-blue-500/10 text-blue-400 border-blue-600/20",
  closed: "text-orange-500 border-orange-500/20",
};

// The log badge shows the backend TransferWindowLog.action value, which is stored in English
// ("opened" / "closed" / "extended"). Map the known values onto a translated label; an
// unknown/new action falls through to the raw value rather than showing a missing-key error.
const TRANSFER_ACTION_LABEL_KEY: Record<string, string> = {
  opened: "log.actionOpened",
  closed: "log.actionClosed",
  extended: "log.actionExtended",
};

// map one backend TransferWindowLog row to the shape the log table renders.
function mapTransferLog(row: any): TransferLogRow {
  return {
    id: row.id,
    action: row.action,
    prev_close: row.previous_close_date ?? null,
    new_close: row.new_close_date ?? null,
    by: row.changed_by != null ? String(row.changed_by) : "-",
    at: row.changed_at ?? null,
    reason: row.reason ?? "",
  };
}

export default function SeasonsAdminPage() {
  const t = useTranslations("rankings.admin.seasons");
  const locale = useLocale();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [transferLog, setTransferLog] = useState<TransferLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  // dialog state
  const [editTarget, setEditTarget] = useState<Season | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [windowTarget, setWindowTarget] = useState<Season | null>(null);
  const [evalTarget, setEvalTarget] = useState<Season | null>(null);

  const active = useMemo(() => seasons.find((s) => s.is_active) ?? seasons[0], [seasons]);

  // load the season list (and the active season's transfer log).
  const loadSeasons = useCallback(async () => {
    try {
      const env = await rankingsApi.seasons();
      const rows = (env.results ?? []) as Season[];
      setSeasons(rows);
      return rows;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("loadFailed"));
      return [] as Season[];
    }
  }, [t]);

  const loadTransferLog = useCallback(async (seasonId?: number) => {
    if (!seasonId) {
      setTransferLog([]);
      return;
    }
    try {
      const res = await rankingsAdminApi.transferLog(seasonId);
      setTransferLog(((res?.results ?? []) as any[]).map(mapTransferLog));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("logLoadFailed"));
    }
  }, [t]);

  // initial load on mount + live refresh (owner 2026-07-02): tick 0 = the normal first
  // load (with the table.loading row); later ticks re-fetch both read-only lists in
  // the background without flipping `loading`, so the tables never flash away.
  const tick = useLiveTick();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (tick === 0) setLoading(true);
      const rows = await loadSeasons();
      if (cancelled) return;
      const act = rows.find((s) => s.is_active) ?? rows[0];
      await loadTransferLog(act?.season_id);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tick, loadSeasons, loadTransferLog]);

  // re-fetch seasons + the active season's transfer log after any write.
  const refresh = useCallback(async () => {
    const rows = await loadSeasons();
    const act = rows.find((s) => s.is_active) ?? rows[0];
    await loadTransferLog(act?.season_id);
  }, [loadSeasons, loadTransferLog]);

  return (
    <div className="space-y-4">
      <PageHeader
        back
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        // data-tour anchor: seasons tour "Seasons management" step.
        title={
          <span data-tour="seasons-title" className="inline-flex items-center">
            {t("title")}
            <InfoTip id="rankings.seasons._page" className="ml-1.5" />
          </span>
        }
        description={t("description")}
        action={
          // ⓘ sits beside the create button (sibling, not nested).
          <div className="flex items-center gap-1">
            {/* data-tour anchor: seasons tour "Create a new season" step. */}
            <Button data-tour="seasons-create" onClick={() => setCreateOpen(true)}>
              <IconPlus className="mr-1.5 size-4" /> {t("createCta")}
            </Button>
            <InfoTip id="rankings.seasons.create" />
          </div>
        }
      />

      {/* seasons table
          data-tour anchor: seasons tour "All seasons table" step. */}
      <Card data-tour="seasons-list">
        <CardHeader>
          <CardTitle className="text-base">{t("table.cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-foreground">{t("table.colSeason")}</TableHead>
                <TableHead className="text-foreground">{t("table.colQuarterYear")}</TableHead>
                <TableHead className="text-foreground">{t("table.colDates")}</TableHead>
                {/* data-tour anchor: seasons tour "Transfer window" step. Anchors the column
                    header (always rendered) so the highlight has a stable target for the
                    per-row transfer-window state + action. */}
                <TableHead data-tour="seasons-transfer" className="text-foreground">{t("table.colTransferWindow")}</TableHead>
                <TableHead className="text-foreground">{t("table.colStatus")}</TableHead>
                {/* data-tour anchor: seasons tour "Tier evaluation" step (column header is the
                    stable target for each season's evaluation status + run-evaluation action). */}
                <TableHead data-tour="seasons-evaluation" className="text-foreground">{t("table.colEvaluation")}</TableHead>
                <TableHead className="text-right text-foreground">{t("table.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    {t("table.loading")}
                  </TableCell>
                </TableRow>
              ) : seasons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    {t("table.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                seasons.map((s) => {
                  const w = windowState(s);
                  return (
                    <TableRow key={s.season_id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {/* "Q" is the quarter marker; French and Portuguese abbreviate
                            trimestre as "T", so the whole marker is one translated string.
                            The year is passed as a STRING: ICU would otherwise format the
                            number and print "2 026" / "2,026". */}
                        {t("table.quarterYear", { quarter: s.quarter, year: String(s.year) })}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {fmtDate(s.start_date, locale, t("common.noDate"))}{" "}
                        <span className="text-muted-foreground">→</span>{" "}
                        {fmtDate(s.end_date, locale, t("common.noDate"))}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "w-fit rounded-full px-2 py-0.5 text-xs",
                              w.open
                                ? "bg-green-500/10 text-green-500 border-green-500/20"
                                : "text-orange-500 border-orange-500/20"
                            )}
                          >
                            {t(`window.${w.key}` as never)}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {t("window.range", {
                              open: fmtDate(s.transfer_window_open, locale, t("common.noDate")),
                              close: fmtDate(s.transfer_window_close, locale, t("common.noDate")),
                            })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {s.is_active ? (
                          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs bg-green-500/10 text-green-500 border-green-500/20">
                            {t("table.statusActive")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs text-muted-foreground">
                            {t("table.statusClosed")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {s.tier_eval_run ? (
                          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs bg-green-500/10 text-green-500 border-green-500/20">
                            {t("table.evalRun")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs text-orange-500 border-orange-500/20">
                            {t("table.evalPending")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => setEditTarget(s)}>
                            <IconEdit className="mr-1 size-3.5" /> {t("table.edit")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setWindowTarget(s)}>
                            <IconArrowsExchange className="mr-1 size-3.5" /> {t("table.transferWindow")}
                          </Button>
                          {/* ⓘ beside the transfer-window action (sibling of the row buttons). */}
                          <InfoTip id="rankings.seasons.transfer_window" />
                          <Button size="sm" variant="outline" onClick={() => setEvalTarget(s)}>
                            <IconPlayerPlay className="mr-1 size-3.5" /> {t("table.runEvaluation")}
                          </Button>
                          {/* ⓘ beside the run-evaluation action (sibling of the row buttons). */}
                          <InfoTip id="rankings.seasons.run_evaluation" />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* transfer window log
          data-tour anchor: seasons tour "Transfer window log" step. */}
      <Card data-tour="seasons-log">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <IconHistory className="size-4 text-muted-foreground" /> {t("log.cardTitle")}
            <InfoTip id="rankings.seasons.transfer_log._section" />
          </CardTitle>
          <Badge variant="outline" className="rounded-full text-[10px] text-muted-foreground">
            {/* ICU plural, so each language picks its own forms instead of the English "add an s". */}
            {t("log.entryCount", { count: transferLog.length })}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-foreground">{t("log.colAction")}</TableHead>
                <TableHead className="text-foreground">{t("log.colCloseChange")}</TableHead>
                <TableHead className="text-foreground">{t("log.colBy")}</TableHead>
                <TableHead className="text-foreground">{t("log.colAt")}</TableHead>
                <TableHead className="text-foreground">{t("log.colReason")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transferLog.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                    {loading ? t("log.loading") : t("log.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                transferLog.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs capitalize",
                          transferActionMeta[row.action] ?? "text-muted-foreground"
                        )}
                      >
                        {TRANSFER_ACTION_LABEL_KEY[row.action]
                          ? t(TRANSFER_ACTION_LABEL_KEY[row.action] as never)
                          : row.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {row.prev_close ? (
                        <>
                          <span className="text-muted-foreground line-through">{fmtDate(row.prev_close, locale, t("common.noDate"))}</span>{" "}
                          <span className="text-muted-foreground">→</span>{" "}
                          <span className="font-medium text-foreground">{fmtDate(row.new_close, locale, t("common.noDate"))}</span>
                        </>
                      ) : (
                        <span className="font-medium text-foreground">{fmtDate(row.new_close, locale, t("common.noDate"))}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{row.by}</TableCell>
                    {/* changed_at is a real UTC instant (DateTimeField), not a calendar date, so
                        it renders through <LocalTime/> in the viewer's timezone + language. */}
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {row.at ? <LocalTime value={row.at} mode="date" /> : t("common.noDate")}
                    </TableCell>
                    <TableCell className="max-w-xs text-xs text-muted-foreground">{row.reason}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ---------- dialogs ---------- */}
      <SeasonFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refresh}
      />
      <SeasonFormDialog
        mode="edit"
        season={editTarget ?? undefined}
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
        onSaved={refresh}
      />
      <TransferWindowDialog
        season={windowTarget}
        open={!!windowTarget}
        onOpenChange={(o) => !o && setWindowTarget(null)}
        onSaved={refresh}
      />
      <RunEvaluationDialog
        season={evalTarget}
        open={!!evalTarget}
        onOpenChange={(o) => !o && setEvalTarget(null)}
        onConfirmed={(id) =>
          setSeasons((prev) => prev.map((p) => (p.season_id === id ? { ...p, tier_eval_run: true } : p)))
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Create / Edit season form dialog                                    */
/* ------------------------------------------------------------------ */
function SeasonFormDialog({
  mode,
  season,
  open,
  onOpenChange,
  onSaved,
}: {
  mode: "create" | "edit";
  season?: Season;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void | Promise<void>;
}) {
  const t = useTranslations("rankings.admin.seasons");
  const blank: Season = {
    season_id: 0, name: "", quarter: 1, year: new Date().getFullYear(), is_active: false,
    start_date: "", end_date: "",
    transfer_window_open: "", transfer_window_close: "",
    tier_eval_run: false, tier_eval_run_at: null, tier_eval_run_by: null,
  };
  const [form, setForm] = useState<Season>(season ?? blank);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // re-seed the form whenever the dialog opens for a different target
  React.useEffect(() => {
    if (open) {
      setForm(season ?? blank);
      setReason("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, season?.season_id]);

  const set = (patch: Partial<Season>) => setForm((f) => ({ ...f, ...patch }));
  const reasonOk = reason.trim().length >= 10;
  const valid = form.name.trim().length >= 2 && !!form.start_date && !!form.end_date && reasonOk;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      if (mode === "create") {
        await rankingsAdminApi.createSeason({
          name: form.name.trim(),
          quarter: form.quarter,
          year: form.year,
          start_date: form.start_date,
          end_date: form.end_date,
          transfer_window_open: form.transfer_window_open || null,
          transfer_window_close: form.transfer_window_close || null,
          is_active: form.is_active,
          reason: reason.trim(),
        });
        toast.success(t("form.createdToast", { name: form.name }));
      } else {
        // edit: send the full editable field set + reason (partial-safe on the backend).
        await rankingsAdminApi.updateSeason(form.season_id, {
          name: form.name.trim(),
          quarter: form.quarter,
          year: form.year,
          start_date: form.start_date,
          end_date: form.end_date,
          transfer_window_open: form.transfer_window_open || undefined,
          transfer_window_close: form.transfer_window_close || undefined,
          is_active: form.is_active,
          reason: reason.trim(),
        });
        toast.success(t("form.updatedToast", { name: form.name }));
      }
      onOpenChange(false);
      await onSaved();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          (mode === "create" ? t("form.createFailed") : t("form.updateFailed"))
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          {/* The season NAME is API data; only the surrounding "Edit ..." wording is translated. */}
          <DialogTitle>
            {mode === "create"
              ? t("form.createTitle")
              : season?.name
                ? t("form.editTitle", { name: season.name })
                : t("form.editTitleFallback")}
          </DialogTitle>
          <DialogDescription>
            {t("form.desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="season-name">{t("form.nameLabel")}</Label>
            <Input
              id="season-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder={t("form.namePlaceholder")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="season-quarter">{t("form.quarterLabel")}</Label>
              <Select value={String(form.quarter)} onValueChange={(v) => set({ quarter: Number(v) })}>
                <SelectTrigger id="season-quarter" className="w-full">
                  <SelectValue placeholder={t("form.quarterPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {/* The VALUE stays the raw quarter number the API wants; only the label is translated. */}
                  {QUARTERS.map((q) => (
                    <SelectItem key={q} value={String(q)}>{t("form.quarterOption", { quarter: q })}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="season-year">{t("form.yearLabel")}</Label>
              <Input
                id="season-year"
                type="number"
                value={form.year}
                onChange={(e) => set({ year: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="season-start">{t("form.startLabel")}</Label>
              <Input
                id="season-start"
                type="date"
                value={form.start_date}
                onChange={(e) => set({ start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="season-end">{t("form.endLabel")}</Label>
              <Input
                id="season-end"
                type="date"
                value={form.end_date}
                onChange={(e) => set({ end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="window-open">{t("form.windowOpenLabel")}</Label>
              <Input
                id="window-open"
                type="date"
                value={form.transfer_window_open ?? ""}
                onChange={(e) => set({ transfer_window_open: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="window-close">{t("form.windowCloseLabel")}</Label>
              <Input
                id="window-close"
                type="date"
                value={form.transfer_window_close ?? ""}
                onChange={(e) => set({ transfer_window_close: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="normal-case text-foreground">
                {t("form.activeLabel")}
                <InfoTip id="rankings.seasons.active_season" className="ml-1" />
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("form.activeHint")}
              </p>
            </div>
            <Switch checked={form.is_active} onCheckedChange={(v) => set({ is_active: v })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="season-reason">{t("common.reasonLabel")}</Label>
            <Textarea
              id="season-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                mode === "create"
                  ? t("form.reasonPlaceholderCreate")
                  : t("form.reasonPlaceholderEdit")
              }
            />
            <p className={cn("text-[11px]", reasonOk ? "text-muted-foreground" : "text-orange-500")}>
              {t("common.minChars", { count: reason.trim().length, min: 10 })}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={submit} disabled={!valid || saving}>
            {saving
              ? mode === "create" ? t("form.creating") : t("form.saving")
              : mode === "create" ? t("form.createCta") : t("form.saveCta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Transfer window dialog (open / close / extend + required reason)    */
/* ------------------------------------------------------------------ */
function TransferWindowDialog({
  season,
  open,
  onOpenChange,
  onSaved,
}: {
  season: Season | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void | Promise<void>;
}) {
  const t = useTranslations("rankings.admin.seasons");
  const locale = useLocale();
  const [action, setAction] = useState<TransferAction>("extend");
  const [newClose, setNewClose] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open && season) {
      setAction("extend");
      setNewClose(season.transfer_window_close ?? "");
      setReason("");
    }
  }, [open, season]);

  if (!season) return null;
  const w = windowState(season);
  const reasonOk = reason.trim().length >= 10;
  const needsDate = action === "extend";
  const canConfirm = reasonOk && (!needsDate || !!newClose) && !saving;

  // `key` is the internal action id (mapped to the backend enum by TRANSFER_ACTION_MAP);
  // only `label` is user-facing. "Open"/"Close" here mean opening and closing the transfer
  // window, not a physical door, so the translations use ouvrir/clôturer and abrir/encerrar.
  const actions: { key: TransferAction; label: string; icon: React.ReactNode; cls: string }[] = [
    { key: "open", label: t("windowDialog.openNow"), icon: <IconLockOpen className="size-4" />, cls: "data-[active=true]:border-green-500/50 data-[active=true]:bg-green-500/10 data-[active=true]:text-green-500" },
    { key: "close", label: t("windowDialog.closeNow"), icon: <IconLock className="size-4" />, cls: "data-[active=true]:border-orange-500/50 data-[active=true]:bg-orange-500/10 data-[active=true]:text-orange-500" },
    { key: "extend", label: t("windowDialog.extend"), icon: <IconClockPlus className="size-4" />, cls: "data-[active=true]:border-blue-500/50 data-[active=true]:bg-blue-500/10 data-[active=true]:text-blue-400" },
  ];

  const submit = async () => {
    if (!canConfirm) return;
    setSaving(true);
    try {
      const body: Record<string, any> = {
        action: TRANSFER_ACTION_MAP[action],
        reason: reason.trim(),
      };
      // only "extend" supplies a new close date; open/close keep the configured dates.
      if (action === "extend") body.new_close_date = newClose;
      await rankingsAdminApi.transferWindow(season.season_id, body);

      // One full sentence per action rather than "window for X " + a verb: the verb agrees
      // with the subject in French and Portuguese, so it cannot be spliced in at the end.
      toast.success(
        action === "extend"
          ? t("windowDialog.extendedToast", {
              season: season.name,
              // newClose comes from the date input, a bare YYYY-MM-DD bound for the
              // new_close_date DateField, so it formats as a calendar date.
              date: fmtDate(newClose, locale, t("common.noDate")),
            })
          : action === "open"
            ? t("windowDialog.openedToast", { season: season.name })
            : t("windowDialog.closedToast", { season: season.name })
      );
      onOpenChange(false);
      await onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("windowDialog.failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("windowDialog.title", { season: season.name })}</DialogTitle>
          <DialogDescription>
            {/* t.rich keeps the state word colour-coded while each language owns the word
                order. The state comes from windowLower.* (a lowercase form authored per
                language) instead of .toLowerCase() on a translated noun. */}
            {t.rich("windowDialog.currently", {
              state: () => (
                <span className={cn("font-medium", w.open ? "text-green-500" : "text-orange-500")}>
                  {t(`windowLower.${w.key}` as never)}
                </span>
              ),
              open: fmtDate(season.transfer_window_open, locale, t("common.noDate")),
              close: fmtDate(season.transfer_window_close, locale, t("common.noDate")),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("windowDialog.actionLabel")}</Label>
            <div className="grid grid-cols-3 gap-2">
              {actions.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  data-active={action === a.key}
                  onClick={() => setAction(a.key)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md border bg-card p-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40",
                    a.cls
                  )}
                >
                  {a.icon}
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {needsDate && (
            <div className="space-y-2">
              <Label htmlFor="new-close">{t("windowDialog.newCloseLabel")}</Label>
              <Input
                id="new-close"
                type="date"
                value={newClose}
                onChange={(e) => setNewClose(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="tw-reason">{t("common.reasonLabel")}</Label>
            <Textarea
              id="tw-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("windowDialog.reasonPlaceholder")}
            />
            <p className={cn("text-[11px]", reasonOk ? "text-muted-foreground" : "text-orange-500")}>
              {t("common.minChars", { count: reason.trim().length, min: 10 })}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={submit} disabled={!canConfirm}>
            {saving ? t("windowDialog.saving") : t("windowDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Run quarterly evaluation confirm dialog (required reason)           */
/* ------------------------------------------------------------------ */
function RunEvaluationDialog({
  season,
  open,
  onOpenChange,
  onConfirmed,
}: {
  season: Season | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirmed: (seasonId: number) => void;
}) {
  const t = useTranslations("rankings.admin.seasons");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // real dry-run preview (writes nothing) so the dialog's numbers reflect the live data,
  // not a hardcoded mock.
  const [preview, setPreview] = useState<{ teams: number; players: number; below: number } | null>(null);

  React.useEffect(() => {
    if (!open || !season) { setReason(""); setPreview(null); return; }
    setReason("");
    rankingsAdminApi
      // NOT user-facing: this reason string is an API argument written to the backend audit
      // trail (afc_rankings audit log), so it stays English like the rest of the log payload.
      .runEvaluation(season.season_id, { dry_run: true, reason: "Dialog preview (dry run)." })
      .then((r: any) => {
        const below = (r?.team_changes || []).filter((c: any) => c.new_tier === 3).length;
        setPreview({ teams: r?.teams_evaluated ?? 0, players: r?.players_evaluated ?? 0, below });
      })
      .catch(() => setPreview(null));
  }, [open, season]);

  if (!season) return null;
  const reasonOk = reason.trim().length >= 10;
  const alreadyRun = season.tier_eval_run;

  // Real run: locks tiers via the backend. force=true when the season was already evaluated
  // (re-run overwrites). The §16 audit reason is mandatory.
  const submit = async () => {
    if (!reasonOk || submitting) return;
    setSubmitting(true);
    try {
      const res: any = await rankingsAdminApi.runEvaluation(season.season_id, {
        force: alreadyRun, reason: reason.trim(),
      });
      if (res && res.ok === false) {
        toast.error(res.error || t("evalDialog.cannotRun"));
        return;
      }
      // Evaluation now rebuilds scores from match results first (backend recalc_season), so a
      // 0/0 result means there genuinely are no countable results in the season window - surface
      // the backend's note instead of a misleading "0 teams tiered" success (owner bug 2026-06-29).
      const tiered = (res?.teams_evaluated ?? 0) + (res?.players_evaluated ?? 0);
      if (tiered === 0 && res?.note) {
        toast.warning(res.note);
      } else {
        // Two ICU plurals in one sentence, so each language picks its own forms rather
        // than relying on the English "add an s" trick.
        toast.success(
          t("evalDialog.success", {
            season: season.name,
            teams: res.teams_evaluated,
            players: res.players_evaluated,
          }),
        );
      }
      onConfirmed(season.season_id);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("evalDialog.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("evalDialog.title", { season: season.name })}</DialogTitle>
          <DialogDescription>
            {t("evalDialog.desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {alreadyRun && (
            <div className="flex items-start gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-500">
              <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                {t("evalDialog.alreadyRun")}
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border bg-card p-3 text-center">
              <p className="text-lg font-bold tabular-nums">{preview ? preview.teams : "-"}</p>
              <p className="text-[11px] text-muted-foreground">{t("evalDialog.teams")}</p>
            </div>
            <div className="rounded-md border bg-card p-3 text-center">
              <p className="text-lg font-bold tabular-nums">{preview ? preview.players : "-"}</p>
              <p className="text-[11px] text-muted-foreground">{t("evalDialog.players")}</p>
            </div>
            <div className="rounded-md border bg-card p-3 text-center">
              <p className="text-lg font-bold tabular-nums text-orange-500">{preview ? preview.below : "-"}</p>
              {/* "Entry" here is the entry-level tier a team drops to, not an entrance,
                  so fr/pt say "niveau d'entree" / "nivel de entrada" (accented in the file). */}
              <p className="text-[11px] text-muted-foreground">{t("evalDialog.belowFloor")}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eval-reason">{t("common.reasonLabel")}</Label>
            <Textarea
              id="eval-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("evalDialog.reasonPlaceholder")}
            />
            <p className={cn("text-[11px]", reasonOk ? "text-muted-foreground" : "text-orange-500")}>
              {t("common.minChars", { count: reason.trim().length, min: 10 })}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          {reasonOk ? (
            <Button onClick={submit} disabled={submitting}>
              <IconPlayerPlay className="mr-1.5 size-4" /> {submitting ? t("evalDialog.running") : (alreadyRun ? t("evalDialog.forceRerun") : t("evalDialog.run"))}
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button disabled>
                    <IconPlayerPlay className="mr-1.5 size-4" /> {t("evalDialog.run")}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{t("evalDialog.reasonTooltip", { min: 10 })}</TooltipContent>
            </Tooltip>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
