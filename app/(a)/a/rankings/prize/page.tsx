"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FullLoader } from "@/components/Loader";
import { ngn } from "@/lib/rankingsMock";
import { rankingsApi, Season } from "@/lib/rankings";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import {
  IconCoin, IconPlus, IconPencil, IconTrash, IconCalendar, IconCurrencyNaira,
} from "@tabler/icons-react";
import { toast } from "sonner";
import axios from "axios";
import { env } from "@/lib/env";

// Live shape returned by admin_prize.serialize_prize (read its dict for the exact fields).
type PrizeRow = {
  payout_id: number;
  event_id: number;
  event_name: string | null;
  tournament_team_id: number | null;
  team_id: number | null;
  team_name: string | null;
  amount: string;        // NGN, decimal-as-string
  awarded_at: string | null;
};

const amountNumber = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

// Minimal shapes from the name-picker source lists (read the backend views for the
// full payloads): /events/get-all-events/ -> { events: [{ event_id, event_name }] },
// /team/get-all-teams/ -> { teams: [{ team_id, team_name }] }.
type EventOption = { event_id: number; event_name: string };
type TeamOption = { team_id: number; team_name: string };

const MATCH_LIMIT = 8;

export default function PrizeMoneyPage() {
  // ── season scope ── undefined = not resolved yet, null = resolved but none active
  const [seasonId, setSeasonId] = useState<number | null | undefined>(undefined);

  // ── live prize rows ──
  const [rows, setRows] = useState<PrizeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const totalThisSeason = useMemo(
    () => rows.reduce((sum, r) => sum + amountNumber(r.amount), 0),
    [rows]
  );

  // Resolve the active season once (season-scoped reads/writes need its id).
  // Prefer the dedicated current-season endpoint; fall back to the list.
  useEffect(() => {
    rankingsApi.currentSeason()
      .then((s) => {
        if (s?.season_id) { setSeasonId(s.season_id); return; }
        return rankingsApi.seasons().then((r) => {
          const active: Season | undefined = r.results.find((x) => x.is_active) ?? r.results[0];
          setSeasonId(active?.season_id ?? null);
        });
      })
      .catch(() => {
        rankingsApi.seasons()
          .then((r) => {
            const active: Season | undefined = r.results.find((x) => x.is_active) ?? r.results[0];
            setSeasonId(active?.season_id ?? null);
          })
          .catch((err: any) => {
            toast.error(err?.response?.data?.message || "Failed to load seasons.");
            setSeasonId(null);
          });
      });
  }, []);

  async function loadPrizes(id?: number | null) {
    setLoading(true);
    try {
      const r = await rankingsAdminApi.prizes(id ? { season_id: id } : undefined);
      setRows(r.results ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load prize payouts.");
    } finally {
      setLoading(false);
    }
  }

  // Load on mount and whenever the active season resolves / changes.
  useEffect(() => {
    if (seasonId === undefined) return;
    loadPrizes(seasonId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId]);

  // ---- Add prize dialog ----
  const [addOpen, setAddOpen] = useState(false);
  // Event + team are picked by name; the input holds the display text while the
  // *Id state holds the resolved id the API actually uses (0 = nothing picked).
  const [addEventText, setAddEventText] = useState<string>("");
  const [addEventId, setAddEventId] = useState<number>(0);
  const [addTeamText, setAddTeamText] = useState<string>("");
  const [addTeamId, setAddTeamId] = useState<number>(0);
  const [addAmount, setAddAmount] = useState<string>("");
  const [addReason, setAddReason] = useState<string>("");
  const [addSaving, setAddSaving] = useState(false);

  // Name-search source lists — fetched once when the dialog first opens.
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  // dropdown visibility (kept open while typing, closed on pick / blur)
  const [eventMenuOpen, setEventMenuOpen] = useState(false);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);

  async function loadPickerOptions() {
    if (optionsLoaded) return;
    try {
      const [evRes, teamRes] = await Promise.all([
        axios.get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`),
        axios.get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-all-teams/`),
      ]);
      setEventOptions(evRes.data?.events ?? []);
      setTeamOptions(teamRes.data?.teams ?? []);
      setOptionsLoaded(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load events and teams.");
    }
  }

  // case-insensitive substring match by name, capped at MATCH_LIMIT
  const eventMatches = useMemo(() => {
    const q = addEventText.trim().toLowerCase();
    if (!q) return eventOptions.slice(0, MATCH_LIMIT);
    return eventOptions
      .filter((e) => e.event_name?.toLowerCase().includes(q))
      .slice(0, MATCH_LIMIT);
  }, [addEventText, eventOptions]);

  const teamMatches = useMemo(() => {
    const q = addTeamText.trim().toLowerCase();
    if (!q) return teamOptions.slice(0, MATCH_LIMIT);
    return teamOptions
      .filter((t) => t.team_name?.toLowerCase().includes(q))
      .slice(0, MATCH_LIMIT);
  }, [addTeamText, teamOptions]);

  const addValid =
    addEventId > 0 &&
    addTeamId > 0 &&
    Number(addAmount) > 0 &&
    addReason.trim().length >= 10;

  function resetAdd() {
    setAddEventText("");
    setAddEventId(0);
    setAddTeamText("");
    setAddTeamId(0);
    setAddAmount("");
    setAddReason("");
    setEventMenuOpen(false);
    setTeamMenuOpen(false);
  }

  async function handleAdd() {
    if (!addValid) return;
    setAddSaving(true);
    try {
      // team_id here is a TournamentTeam id scoped to the event. There is no
      // event-scoped tournament-team list endpoint, so the picker resolves
      // against all teams; the backend validates the team belongs to the event
      // and returns a clean 400 otherwise.
      await rankingsAdminApi.createPrize({
        event_id: addEventId,
        team_id: addTeamId,
        amount: Number(addAmount),
        reason: addReason.trim(),
      });
      toast.success(`Prize of ${ngn(Number(addAmount))} recorded.`);
      setAddOpen(false);
      resetAdd();
      await loadPrizes(seasonId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to add prize.");
    } finally {
      setAddSaving(false);
    }
  }

  // ---- Edit dialog (mandatory reason) ----
  const [editRow, setEditRow] = useState<PrizeRow | null>(null);
  const [editAmount, setEditAmount] = useState<string>("");
  const [editReason, setEditReason] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);

  function openEdit(row: PrizeRow) {
    setEditRow(row);
    setEditAmount(row.amount);
    setEditReason("");
  }

  const editValid =
    editRow !== null &&
    Number(editAmount) > 0 &&
    editReason.trim().length >= 10;

  async function handleEditSave() {
    if (!editRow || !editValid) return;
    setEditSaving(true);
    try {
      await rankingsAdminApi.updatePrize(editRow.payout_id, {
        amount: Number(editAmount),
        reason: editReason.trim(),
      });
      toast.success(`Prize for ${editRow.team_name ?? "team"} updated.`);
      setEditRow(null);
      await loadPrizes(seasonId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update prize.");
    } finally {
      setEditSaving(false);
    }
  }

  // ---- Delete confirm (mandatory reason) ----
  const [deleteRow, setDeleteRow] = useState<PrizeRow | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>("");
  const [deleteSaving, setDeleteSaving] = useState(false);

  function openDelete(row: PrizeRow) {
    setDeleteRow(row);
    setDeleteReason("");
  }

  const deleteValid = deleteRow !== null && deleteReason.trim().length >= 10;

  async function handleDelete() {
    if (!deleteRow || !deleteValid) return;
    setDeleteSaving(true);
    try {
      await rankingsAdminApi.deletePrize(deleteRow.payout_id, {
        reason: deleteReason.trim(),
      });
      toast.success(`Prize entry for ${deleteRow.team_name ?? "team"} deleted.`);
      setDeleteRow(null);
      await loadPrizes(seasonId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete prize.");
    } finally {
      setDeleteSaving(false);
    }
  }

  if (loading && rows.length === 0) {
    return <FullLoader text="Loading prize money" />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        back
        title="Prize Money"
        description="Record tournament prize payouts. Amounts are entered directly in Naira, there is no exchange-rate system."
        action={
          <Button onClick={() => { setAddOpen(true); loadPickerOptions(); }}>
            <IconPlus className="mr-1.5 size-4" /> Add prize
          </Button>
        }
      />

      {/* summary */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <Card className="gap-1 transition-shadow hover:shadow-lg">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total prizes this season
            </CardTitle>
            <span className="text-primary"><IconCoin className="size-4" /></span>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{ngn(totalThisSeason)}</p>
            <p className="text-xs text-muted-foreground">
              Across {rows.length} payout{rows.length === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* prize table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prize Payouts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Awarded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No prize money recorded yet. Use “Add prize” to log a payout.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.payout_id}>
                    <TableCell className="font-medium">{r.event_name ?? "—"}</TableCell>
                    <TableCell>{r.team_name ?? "—"}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-primary">
                      {ngn(amountNumber(r.amount))}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <IconCalendar className="size-3" />
                        {r.awarded_at ? new Date(r.awarded_at).toLocaleDateString() : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                          <IconPencil className="mr-1 size-3.5" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 hover:text-red-500"
                          onClick={() => openDelete(r)}
                        >
                          <IconTrash className="mr-1 size-3.5" /> Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ---- Add prize dialog ---- */}
      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (o) loadPickerOptions();
          if (!o) resetAdd();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add prize money</DialogTitle>
            <DialogDescription>
              Enter the amount directly in Naira. No conversion is applied.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Event name search → resolves to event_id */}
              <div className="space-y-1.5">
                <Label>Event</Label>
                <div className="relative">
                  <Input
                    value={addEventText}
                    onChange={(e) => {
                      setAddEventText(e.target.value);
                      setAddEventId(0); // typing invalidates a prior pick
                      setEventMenuOpen(true);
                    }}
                    onFocus={() => setEventMenuOpen(true)}
                    onBlur={() => setTimeout(() => setEventMenuOpen(false), 120)}
                    placeholder="Search events by name"
                    autoComplete="off"
                  />
                  {eventMenuOpen && (
                    <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                      {eventMatches.length === 0 ? (
                        <p className="px-2 py-1.5 text-sm text-muted-foreground">No matches</p>
                      ) : (
                        eventMatches.map((ev) => (
                          <button
                            key={ev.event_id}
                            type="button"
                            className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setAddEventText(ev.event_name);
                              setAddEventId(ev.event_id);
                              setEventMenuOpen(false);
                            }}
                          >
                            {ev.event_name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Team name search → resolves to team_id */}
              <div className="space-y-1.5">
                <Label>Team</Label>
                <div className="relative">
                  <Input
                    value={addTeamText}
                    onChange={(e) => {
                      setAddTeamText(e.target.value);
                      setAddTeamId(0); // typing invalidates a prior pick
                      setTeamMenuOpen(true);
                    }}
                    onFocus={() => setTeamMenuOpen(true)}
                    onBlur={() => setTimeout(() => setTeamMenuOpen(false), 120)}
                    placeholder="Search teams by name"
                    autoComplete="off"
                  />
                  {teamMenuOpen && (
                    <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                      {teamMatches.length === 0 ? (
                        <p className="px-2 py-1.5 text-sm text-muted-foreground">No matches</p>
                      ) : (
                        teamMatches.map((t) => (
                          <button
                            key={t.team_id}
                            type="button"
                            className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setAddTeamText(t.team_name);
                              setAddTeamId(t.team_id);
                              setTeamMenuOpen(false);
                            }}
                          >
                            {t.team_name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Amount (₦)</Label>
              <div className="relative">
                <IconCurrencyNaira className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  min={0}
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="0"
                  className="pl-8 tabular-nums"
                />
              </div>
            </div>

            {Number(addAmount) > 0 && (
              <p className="text-xs text-muted-foreground">
                Recording <span className="font-semibold text-primary">{ngn(Number(addAmount))}</span> in prize money.
              </p>
            )}

            <div className="space-y-1.5">
              <Label>
                Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={addReason}
                onChange={(e) => setAddReason(e.target.value)}
                placeholder="Why is this prize being recorded? (min 10 characters, written to the audit log)"
                rows={3}
              />
              <p className="text-[11px] text-muted-foreground">
                {addReason.trim().length < 10
                  ? `${10 - addReason.trim().length} more character${10 - addReason.trim().length === 1 ? "" : "s"} required`
                  : "Reason will be recorded in the audit log."}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setAddOpen(false); resetAdd(); }}>
              Cancel
            </Button>
            <Button disabled={!addValid || addSaving} onClick={handleAdd}>
              {addSaving ? "Adding…" : "Add prize"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Edit dialog (mandatory reason) ---- */}
      <Dialog open={editRow !== null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit prize money</DialogTitle>
            <DialogDescription>
              {editRow ? `${editRow.event_name ?? "—"} · ${editRow.team_name ?? "—"}` : ""}
            </DialogDescription>
          </DialogHeader>

          {editRow && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Amount (₦)</Label>
                <div className="relative">
                  <IconCurrencyNaira className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    min={0}
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="pl-8 tabular-nums"
                  />
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                <span className="text-muted-foreground">Was </span>
                <span className="line-through tabular-nums">{ngn(amountNumber(editRow.amount))}</span>
                {Number(editAmount) !== amountNumber(editRow.amount) && Number(editAmount) > 0 && (
                  <>
                    <span className="text-muted-foreground"> → </span>
                    <span className="font-medium text-foreground tabular-nums">{ngn(Number(editAmount))}</span>
                  </>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>
                  Reason <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Why is this prize being changed? (min 10 characters, written to the audit log)"
                  rows={3}
                />
                <p className="text-[11px] text-muted-foreground">
                  {editReason.trim().length < 10
                    ? `${10 - editReason.trim().length} more character${10 - editReason.trim().length === 1 ? "" : "s"} required`
                    : "Reason will be recorded in the audit log."}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditRow(null)}>
              Go back
            </Button>
            <Button disabled={!editValid || editSaving} onClick={handleEditSave}>
              {editSaving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Delete confirm (mandatory reason) ---- */}
      <AlertDialog open={deleteRow !== null} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete prize entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteRow
                ? `This removes the ${ngn(amountNumber(deleteRow.amount))} payout for ${deleteRow.team_name ?? "team"} (${deleteRow.event_name ?? "—"}). This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5">
            <Label>
              Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Why is this payout being deleted? (min 10 characters, written to the audit log)"
              rows={3}
            />
            <p className="text-[11px] text-muted-foreground">
              {deleteReason.trim().length < 10
                ? `${10 - deleteReason.trim().length} more character${10 - deleteReason.trim().length === 1 ? "" : "s"} required`
                : "Reason will be recorded in the audit log."}
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={!deleteValid || deleteSaving}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {deleteSaving ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
