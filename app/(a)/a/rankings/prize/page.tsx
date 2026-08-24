"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/contexts/CurrencyContext";
import { displayMoney } from "@/lib/money";
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
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FullLoader } from "@/components/Loader";
// awarded_at is EventPrizePayout.created_at, a Django DateTimeField (a real UTC instant), so it
// renders through <LocalTime/> in the VIEWER's timezone + the active AFC UI language. It used to
// be new Date(...).toLocaleDateString(), which follows the BROWSER's language, not the UI one.
import { LocalTime } from "@/components/LocalTime";
import { rankingsApi, Season } from "@/lib/rankings";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import { matchesSearch } from "@/lib/search";
import {
  IconCoin, IconPlus, IconPencil, IconTrash, IconCalendar, IconCurrencyNaira,
} from "@tabler/icons-react";
import { toast } from "sonner";
import axios from "axios";
import { env } from "@/lib/env";
import { InfoTip } from "@/components/ui/info-tip";
// Live refresh (owner 2026-07-02): site-wide heartbeat; the prize payout list re-fetches
// on each tick (and on tab return) so auto-synced payouts appear without a manual reload.
// The add/edit/delete dialogs hold their own form state, so a background refresh never
// touches anything mid-typing.
import { useLiveTick } from "@/hooks/useLiveTick";

// Live shape returned by admin_prize.serialize_prize (read its dict for the exact fields).
type PrizeRow = {
  payout_id: number;
  event_id: number;
  event_name: string | null;
  // Auto-synced from the event's prize pool + final standings (owner 2026-07-02); manual rows false.
  auto_synced?: boolean;
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
// Minimum reason length for every audit-logged write (matches the backend gate and the
// sibling rankings admin pages: results / overrides / social / seasons / ghost-teams).
const MIN_REASON = 10;

export default function PrizeMoneyPage() {
  const t = useTranslations("rankings.admin.prize");
  // Multi-currency display (owner 2026-06-30): prize amounts are STORED in NGN; show them in the
  // admin's chosen display currency (set currency=USD in profile to see USD, the original ask).
  // `fmt` converts a stored-NGN amount -> the viewer's currency. Inputs stay in Naira for now
  // (storage stays NGN); the entered amount's live preview also converts via fmt.
  const { rates, currency } = useCurrency();
  const fmt = (x: number | string) => displayMoney(Number(x) || 0, "NGN", currency, rates);
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
            toast.error(err?.response?.data?.message || t("toasts.loadSeasonsFailed"));
            setSeasonId(null);
          });
      });
  }, []);

  // Live refresh (owner 2026-07-02): background=true skips the loading flag so an
  // automatic refresh never flips the page back to the FullLoader.
  async function loadPrizes(id?: number | null, background = false) {
    if (!background) setLoading(true);
    try {
      const r = await rankingsAdminApi.prizes(id ? { season_id: id } : undefined);
      setRows(r.results ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toasts.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  // Load on mount and whenever the active season resolves / changes.
  // Live refresh (owner 2026-07-02): tick 0 = the normal first load (with loader);
  // later ticks re-fetch the payout list in the background (no spinner flash).
  const tick = useLiveTick();
  useEffect(() => {
    if (seasonId === undefined) return;
    loadPrizes(seasonId, tick > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId, tick]);

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

  // Name-search source lists - fetched once when the dialog first opens.
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
      toast.error(err?.response?.data?.message || t("toasts.loadOptionsFailed"));
    }
  }

  // Match by name, capped at MATCH_LIMIT. Uses the shared matchesSearch helper so the
  // event picker is punctuation/accent/fancy-font insensitive (typing "ve" finds "V-E"),
  // consistent with every other search box on the site.
  const eventMatches = useMemo(() => {
    const q = addEventText.trim();
    if (!q) return eventOptions.slice(0, MATCH_LIMIT);
    return eventOptions
      .filter((e) => matchesSearch(e.event_name, addEventText))
      .slice(0, MATCH_LIMIT);
  }, [addEventText, eventOptions]);

  // Match by name, capped at MATCH_LIMIT. Uses the shared matchesSearch helper so the
  // team picker is punctuation/accent/fancy-font insensitive (typing "ve" finds "V-E"),
  // consistent with every other search box on the site.
  const teamMatches = useMemo(() => {
    const q = addTeamText.trim();
    if (!q) return teamOptions.slice(0, MATCH_LIMIT);
    return teamOptions
      .filter((t) => matchesSearch(t.team_name, addTeamText))
      .slice(0, MATCH_LIMIT);
  }, [addTeamText, teamOptions]);

  const addValid =
    addEventId > 0 &&
    addTeamId > 0 &&
    Number(addAmount) > 0 &&
    addReason.trim().length >= MIN_REASON;

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
      toast.success(t("toasts.added", { amount: fmt(Number(addAmount)) }));
      setAddOpen(false);
      resetAdd();
      await loadPrizes(seasonId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toasts.addFailed"));
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
    editReason.trim().length >= MIN_REASON;

  async function handleEditSave() {
    if (!editRow || !editValid) return;
    setEditSaving(true);
    try {
      await rankingsAdminApi.updatePrize(editRow.payout_id, {
        amount: Number(editAmount),
        reason: editReason.trim(),
      });
      // Separate key for the "no team name on the row" case rather than interpolating a
      // translated word for "team": "Prize for the team" needs a different article/contraction
      // in French and Portuguese, so a fallback noun cannot be glued into the same sentence.
      toast.success(
        editRow.team_name
          ? t("toasts.updated", { name: editRow.team_name })
          : t("toasts.updatedFallback"),
      );
      setEditRow(null);
      await loadPrizes(seasonId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toasts.updateFailed"));
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

  const deleteValid = deleteRow !== null && deleteReason.trim().length >= MIN_REASON;

  async function handleDelete() {
    if (!deleteRow || !deleteValid) return;
    setDeleteSaving(true);
    try {
      await rankingsAdminApi.deletePrize(deleteRow.payout_id, {
        reason: deleteReason.trim(),
      });
      // Same split as the edit toast: no team name on the row means a whole different sentence,
      // not the same sentence with a translated "team" dropped into the slot.
      toast.success(
        deleteRow.team_name
          ? t("toasts.deleted", { name: deleteRow.team_name })
          : t("toasts.deletedFallback"),
      );
      setDeleteRow(null);
      await loadPrizes(seasonId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toasts.deleteFailed"));
    } finally {
      setDeleteSaving(false);
    }
  }

  if (loading && rows.length === 0) {
    return <FullLoader text={t("loading")} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        back
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        // data-tour anchor: prize tour "Prize money tracking" step.
        title={
          <span data-tour="prize-title" className="inline-flex flex-wrap items-center">
            {t("title")}
            <InfoTip id="rankings.prize._page" className="ml-1.5" />
          </span>
        }
        description={t("description")}
        action={
          // ⓘ sits beside the add-prize button (sibling, not nested).
          <div className="flex items-center gap-1">
            {/* data-tour anchor: prize tour "Record a payout" step. */}
            <Button data-tour="prize-add" onClick={() => { setAddOpen(true); loadPickerOptions(); }}>
              <IconPlus className="mr-1.5 size-4" /> {t("addCta")}
            </Button>
            <InfoTip id="rankings.prize.add" />
          </div>
        }
      />

      {/* summary
          data-tour anchor (wrapper): prize tour "Prize bracket scale" step. This page has no
          standalone bracket-scale widget (the brackets live in Scoring Config); the summary
          grid that surfaces the quarterly total feeding those brackets is the closest stable
          target. The inner card carries the "Season total" anchor. */}
      <div data-tour="prize-scale" className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <Card data-tour="prize-total" className="gap-1 transition-shadow hover:shadow-lg">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("summary.totalTitle")}
            </CardTitle>
            <span className="text-primary"><IconCoin className="size-4" /></span>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{fmt(totalThisSeason)}</p>
            {/* ICU plural, not an appended "s": each language picks its own plural forms. */}
            <p className="text-xs text-muted-foreground">
              {t("summary.acrossPayouts", { count: rows.length })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* prize table
          data-tour anchor: prize tour "Prize payouts table" step. */}
      <Card data-tour="prize-list">
        {/* data-tour anchor: prize tour "Find a payout" step. This page has no dedicated
            search box; the payouts table header is the closest stable target for the
            "locate a specific prize" step. */}
        <CardHeader data-tour="prize-search">
          <CardTitle className="text-base">{t("table.cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.colEvent")}</TableHead>
                <TableHead>{t("table.colTeam")}</TableHead>
                <TableHead className="text-right">{t("table.colAmount")}</TableHead>
                <TableHead>{t("table.colAwarded")}</TableHead>
                <TableHead className="text-right">{t("table.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    {t("table.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.payout_id}>
                    <TableCell className="font-medium">
                      {r.event_name ?? "-"}
                      {r.auto_synced ? (
                        <span className="text-primary border-primary/50 ml-2 rounded-full border px-2 py-0.5 text-[0.6rem] uppercase">
                          {t("table.auto")}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{r.team_name ?? "-"}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-primary">
                      {fmt(amountNumber(r.amount))}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <IconCalendar className="size-3" />
                        {/* UTC instant (EventPrizePayout.created_at) -> viewer tz + UI language. */}
                        {r.awarded_at ? <LocalTime value={r.awarded_at} mode="date" /> : "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                          <IconPencil className="mr-1 size-3.5" /> {t("table.edit")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => openDelete(r)}
                        >
                          <IconTrash className="mr-1 size-3.5" /> {t("table.delete")}
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
            <DialogTitle>{t("addDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("addDialog.desc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Event name search → resolves to event_id */}
              <div className="space-y-1.5">
                <Label>{t("addDialog.eventLabel")}</Label>
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
                    placeholder={t("addDialog.eventPlaceholder")}
                    autoComplete="off"
                  />
                  {eventMenuOpen && (
                    <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                      {eventMatches.length === 0 ? (
                        <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("addDialog.noMatches")}</p>
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
                <Label>{t("addDialog.teamLabel")}</Label>
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
                    placeholder={t("addDialog.teamPlaceholder")}
                    autoComplete="off"
                  />
                  {teamMenuOpen && (
                    <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                      {teamMatches.length === 0 ? (
                        <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("addDialog.noMatches")}</p>
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
              <Label>
                {/* The ₦ symbol stays inside the translated label: inputs are entered in Naira
                    regardless of the admin's display currency (storage is NGN). */}
                {t("common.amountLabel")}
                <InfoTip id="rankings.prize.amount" className="ml-1" />
              </Label>
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
                {/* t.rich keeps the highlighted amount inside the sentence so each language owns
                    the word order instead of gluing "Recording" + amount + "in prize money". */}
                {t.rich("addDialog.recording", {
                  amount: fmt(Number(addAmount)),
                  b: (chunks) => <span className="font-semibold text-primary">{chunks}</span>,
                })}
              </p>
            )}

            <div className="space-y-1.5">
              <Label>
                {t("common.reasonLabel")} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={addReason}
                onChange={(e) => setAddReason(e.target.value)}
                placeholder={t("addDialog.reasonPlaceholder")}
                rows={3}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("common.minChars", { count: addReason.trim().length, min: MIN_REASON })}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setAddOpen(false); resetAdd(); }}>
              {t("common.cancel")}
            </Button>
            <Button disabled={!addValid || addSaving} onClick={handleAdd}>
              {addSaving ? t("addDialog.adding") : t("addCta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Edit dialog (mandatory reason) ---- */}
      <Dialog open={editRow !== null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("editDialog.title")}</DialogTitle>
            <DialogDescription>
              {editRow ? `${editRow.event_name ?? "-"} · ${editRow.team_name ?? "-"}` : ""}
            </DialogDescription>
          </DialogHeader>

          {editRow && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("common.amountLabel")}</Label>
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
                <span className="text-muted-foreground">{t("editDialog.was")} </span>
                <span className="line-through tabular-nums">{fmt(amountNumber(editRow.amount))}</span>
                {Number(editAmount) !== amountNumber(editRow.amount) && Number(editAmount) > 0 && (
                  <>
                    <span className="text-muted-foreground"> → </span>
                    <span className="font-medium text-foreground tabular-nums">{fmt(Number(editAmount))}</span>
                  </>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>
                  {t("common.reasonLabel")} <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder={t("editDialog.reasonPlaceholder")}
                  rows={3}
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("common.minChars", { count: editReason.trim().length, min: MIN_REASON })}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditRow(null)}>
              {t("common.goBack")}
            </Button>
            <Button disabled={!editValid || editSaving} onClick={handleEditSave}>
              {editSaving ? t("editDialog.saving") : t("editDialog.saveCta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Delete confirm (mandatory reason) ---- */}
      <AlertDialog open={deleteRow !== null} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {/* Two whole sentences rather than one with a translated "team" dropped in: the
                  no-team-name case needs its own phrasing in French and Portuguese. */}
              {deleteRow
                ? deleteRow.team_name
                  ? t("deleteDialog.desc", {
                      amount: fmt(amountNumber(deleteRow.amount)),
                      name: deleteRow.team_name,
                      event: deleteRow.event_name ?? "-",
                    })
                  : t("deleteDialog.descNoTeam", {
                      amount: fmt(amountNumber(deleteRow.amount)),
                      event: deleteRow.event_name ?? "-",
                    })
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5">
            <Label>
              {t("common.reasonLabel")} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder={t("deleteDialog.reasonPlaceholder")}
              rows={3}
            />
            <p className="text-[11px] text-muted-foreground">
              {t("common.minChars", { count: deleteReason.trim().length, min: MIN_REASON })}
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={!deleteValid || deleteSaving}
            >
              {deleteSaving ? t("deleteDialog.deleting") : t("deleteDialog.cta")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
