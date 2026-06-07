"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";

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
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "None";

// transfer-window state derived from the active season's dates vs "today"
function windowState(s: Season) {
  if (!s.transfer_window_open || !s.transfer_window_close) return { open: false, label: "Not set" };
  const now = new Date();
  const open = new Date(s.transfer_window_open);
  const close = new Date(s.transfer_window_close);
  if (now < open) return { open: false, label: "Upcoming" };
  if (now > close) return { open: false, label: "Closed" };
  return { open: true, label: "Open" };
}

const transferActionMeta: Record<string, string> = {
  opened: "bg-green-500/10 text-green-500 border-green-500/20",
  extended: "bg-blue-500/10 text-blue-400 border-blue-600/20",
  closed: "text-orange-500 border-orange-500/20",
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
      toast.error(err?.response?.data?.message || "Failed to load seasons.");
      return [] as Season[];
    }
  }, []);

  const loadTransferLog = useCallback(async (seasonId?: number) => {
    if (!seasonId) {
      setTransferLog([]);
      return;
    }
    try {
      const res = await rankingsAdminApi.transferLog(seasonId);
      setTransferLog(((res?.results ?? []) as any[]).map(mapTransferLog));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load transfer log.");
    }
  }, []);

  // initial load on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const rows = await loadSeasons();
      if (cancelled) return;
      const act = rows.find((s) => s.is_active) ?? rows[0];
      await loadTransferLog(act?.season_id);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSeasons, loadTransferLog]);

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
        title={
          <span className="inline-flex items-center">
            Seasons
            <InfoTip id="rankings.seasons._page" className="ml-1.5" />
          </span>
        }
        description="Define competition seasons, open and close the transfer window, and run the quarterly tier evaluation."
        action={
          // ⓘ sits beside the create button (sibling, not nested).
          <div className="flex items-center gap-1">
            <Button onClick={() => setCreateOpen(true)}>
              <IconPlus className="mr-1.5 size-4" /> Create season
            </Button>
            <InfoTip id="rankings.seasons.create" />
          </div>
        }
      />

      {/* seasons table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Seasons</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-foreground">Season</TableHead>
                <TableHead className="text-foreground">Quarter / Year</TableHead>
                <TableHead className="text-foreground">Dates</TableHead>
                <TableHead className="text-foreground">Transfer window</TableHead>
                <TableHead className="text-foreground">Status</TableHead>
                <TableHead className="text-foreground">Evaluation</TableHead>
                <TableHead className="text-right text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Loading seasons…
                  </TableCell>
                </TableRow>
              ) : seasons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No seasons yet. Create the first season to get started.
                  </TableCell>
                </TableRow>
              ) : (
                seasons.map((s) => {
                  const w = windowState(s);
                  return (
                    <TableRow key={s.season_id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        Q{s.quarter} · {s.year}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {fmtDate(s.start_date)} <span className="text-muted-foreground">→</span> {fmtDate(s.end_date)}
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
                            {w.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {fmtDate(s.transfer_window_open)} to {fmtDate(s.transfer_window_close)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {s.is_active ? (
                          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs bg-green-500/10 text-green-500 border-green-500/20">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs text-muted-foreground">
                            Closed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {s.tier_eval_run ? (
                          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs bg-green-500/10 text-green-500 border-green-500/20">
                            Run
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs text-orange-500 border-orange-500/20">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => setEditTarget(s)}>
                            <IconEdit className="mr-1 size-3.5" /> Edit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setWindowTarget(s)}>
                            <IconArrowsExchange className="mr-1 size-3.5" /> Transfer window
                          </Button>
                          {/* ⓘ beside the transfer-window action (sibling of the row buttons). */}
                          <InfoTip id="rankings.seasons.transfer_window" />
                          <Button size="sm" variant="outline" onClick={() => setEvalTarget(s)}>
                            <IconPlayerPlay className="mr-1 size-3.5" /> Run evaluation
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

      {/* transfer window log */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <IconHistory className="size-4 text-muted-foreground" /> Transfer window log
            <InfoTip id="rankings.seasons.transfer_log._section" />
          </CardTitle>
          <Badge variant="outline" className="rounded-full text-[10px] text-muted-foreground">
            {transferLog.length} {transferLog.length === 1 ? "entry" : "entries"}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-foreground">Action</TableHead>
                <TableHead className="text-foreground">Close date change</TableHead>
                <TableHead className="text-foreground">By</TableHead>
                <TableHead className="text-foreground">At</TableHead>
                <TableHead className="text-foreground">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transferLog.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                    {loading ? "Loading…" : "No transfer-window changes recorded yet."}
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
                        {row.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {row.prev_close ? (
                        <>
                          <span className="text-muted-foreground line-through">{fmtDate(row.prev_close)}</span>{" "}
                          <span className="text-muted-foreground">→</span>{" "}
                          <span className="font-medium text-foreground">{fmtDate(row.new_close)}</span>
                        </>
                      ) : (
                        <span className="font-medium text-foreground">{fmtDate(row.new_close)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{row.by}</TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">{fmtDate(row.at)}</TableCell>
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
        toast.success(`Season "${form.name}" created.`);
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
        toast.success(`Season "${form.name}" updated.`);
      }
      onOpenChange(false);
      await onSaved();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          (mode === "create" ? "Failed to create season." : "Failed to update season.")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create season" : `Edit ${season?.name ?? "season"}`}</DialogTitle>
          <DialogDescription>
            Set the competition window and transfer window. The active season drives the public rankings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="season-name">Name</Label>
            <Input
              id="season-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Season 3 2026"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="season-quarter">Quarter</Label>
              <Select value={String(form.quarter)} onValueChange={(v) => set({ quarter: Number(v) })}>
                <SelectTrigger id="season-quarter" className="w-full">
                  <SelectValue placeholder="Quarter" />
                </SelectTrigger>
                <SelectContent>
                  {QUARTERS.map((q) => (
                    <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="season-year">Year</Label>
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
              <Label htmlFor="season-start">Start date</Label>
              <Input
                id="season-start"
                type="date"
                value={form.start_date}
                onChange={(e) => set({ start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="season-end">End date</Label>
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
              <Label htmlFor="window-open">Transfer window opens</Label>
              <Input
                id="window-open"
                type="date"
                value={form.transfer_window_open ?? ""}
                onChange={(e) => set({ transfer_window_open: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="window-close">Transfer window closes</Label>
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
                Active season
                <InfoTip id="rankings.seasons.active_season" className="ml-1" />
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Only one season should be active, this drives the public board.
              </p>
            </div>
            <Switch checked={form.is_active} onCheckedChange={(v) => set({ is_active: v })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="season-reason">Reason</Label>
            <Textarea
              id="season-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                mode === "create"
                  ? "Why are you creating this season? (logged to the audit trail, min 10 characters)"
                  : "Why are you editing this season? (logged to the audit trail, min 10 characters)"
              }
            />
            <p className={cn("text-[11px]", reasonOk ? "text-muted-foreground" : "text-orange-500")}>
              {reason.trim().length}/10 characters minimum.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || saving}>
            {saving
              ? mode === "create" ? "Creating…" : "Saving…"
              : mode === "create" ? "Create season" : "Save changes"}
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

  const actions: { key: TransferAction; label: string; icon: React.ReactNode; cls: string }[] = [
    { key: "open", label: "Open now", icon: <IconLockOpen className="size-4" />, cls: "data-[active=true]:border-green-500/50 data-[active=true]:bg-green-500/10 data-[active=true]:text-green-500" },
    { key: "close", label: "Close now", icon: <IconLock className="size-4" />, cls: "data-[active=true]:border-orange-500/50 data-[active=true]:bg-orange-500/10 data-[active=true]:text-orange-500" },
    { key: "extend", label: "Extend", icon: <IconClockPlus className="size-4" />, cls: "data-[active=true]:border-blue-500/50 data-[active=true]:bg-blue-500/10 data-[active=true]:text-blue-400" },
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

      const verb = action === "open" ? "opened" : action === "close" ? "closed" : "extended";
      toast.success(
        action === "extend"
          ? `Transfer window for ${season.name} extended to ${fmtDate(newClose)}.`
          : `Transfer window for ${season.name} ${verb}.`
      );
      onOpenChange(false);
      await onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update the transfer window.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transfer window, {season.name}</DialogTitle>
          <DialogDescription>
            Currently{" "}
            <span className={cn("font-medium", w.open ? "text-green-500" : "text-orange-500")}>
              {w.label.toLowerCase()}
            </span>
            {" · "}{fmtDate(season.transfer_window_open)} to {fmtDate(season.transfer_window_close)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Action</Label>
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
              <Label htmlFor="new-close">New close date</Label>
              <Input
                id="new-close"
                type="date"
                value={newClose}
                onChange={(e) => setNewClose(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="tw-reason">Reason</Label>
            <Textarea
              id="tw-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is the window changing? (logged to the audit trail, min 10 characters)"
            />
            <p className={cn("text-[11px]", reasonOk ? "text-muted-foreground" : "text-orange-500")}>
              {reason.trim().length}/10 characters minimum.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canConfirm}>
            {saving ? "Saving…" : "Confirm change"}
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
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // real dry-run preview (writes nothing) so the dialog's numbers reflect the live data,
  // not a hardcoded mock.
  const [preview, setPreview] = useState<{ teams: number; players: number; below: number } | null>(null);

  React.useEffect(() => {
    if (!open || !season) { setReason(""); setPreview(null); return; }
    setReason("");
    rankingsAdminApi
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
        toast.error(res.error || "Evaluation could not run.");
        return;
      }
      toast.success(
        `Evaluation run for ${season.name}: ${res.teams_evaluated} teams, ${res.players_evaluated} players tiered.`,
      );
      onConfirmed(season.season_id);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to run evaluation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Run quarterly evaluation, {season.name}</DialogTitle>
          <DialogDescription>
            This locks every team and player tier for the next quarter from the current scores, then publishes
            the results. Head Admin or Metrics Admin only.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {alreadyRun && (
            <div className="flex items-start gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-500">
              <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Evaluation has already been run for this season. Re-running will overwrite the previously
                assigned tiers.
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border bg-card p-3 text-center">
              <p className="text-lg font-bold tabular-nums">{preview ? preview.teams : "-"}</p>
              <p className="text-[11px] text-muted-foreground">Teams</p>
            </div>
            <div className="rounded-md border bg-card p-3 text-center">
              <p className="text-lg font-bold tabular-nums">{preview ? preview.players : "-"}</p>
              <p className="text-[11px] text-muted-foreground">Players</p>
            </div>
            <div className="rounded-md border bg-card p-3 text-center">
              <p className="text-lg font-bold tabular-nums text-orange-500">{preview ? preview.below : "-"}</p>
              <p className="text-[11px] text-muted-foreground">Below floor → Entry</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eval-reason">Reason</Label>
            <Textarea
              id="eval-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you running the evaluation now? (logged to the audit trail, min 10 characters)"
            />
            <p className={cn("text-[11px]", reasonOk ? "text-muted-foreground" : "text-orange-500")}>
              {reason.trim().length}/10 characters minimum.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {reasonOk ? (
            <Button onClick={submit} disabled={submitting}>
              <IconPlayerPlay className="mr-1.5 size-4" /> {submitting ? "Running…" : (alreadyRun ? "Force re-run" : "Run evaluation")}
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button disabled>
                    <IconPlayerPlay className="mr-1.5 size-4" /> Run evaluation
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Enter a reason of at least 10 characters.</TooltipContent>
            </Tooltip>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
