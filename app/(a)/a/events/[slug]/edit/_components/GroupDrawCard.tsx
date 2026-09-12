"use client";

// ── GroupDrawCard ─────────────────────────────────────────────────────────────
// The organizer / admin side of the GROUP DRAW (owner 2026-09-12, Phase 1), one card on the
// Actions tab of the event edit page (shared by the admin and organizer editors, like every card
// there).
//
// WHAT IT DOES, in plain English: instead of pressing "Seed to groups" and letting the site deal
// teams into groups, the organizer picks a stage, CREATES a draw (the site deals one sealed card
// per team, evenly across the groups and never past the stage's "Teams per group", and shows the
// seal), OPENS it with a close time and a choice about stragglers (every captain is told in-app
// and by email and turns a card over on the event page), can CHANGE the close time or the choice
// while it is open, can REMIND everyone who has not picked (in-app + email, once per 10 minutes),
// and either lets it CLOSE by itself at the deadline or closes it now, placing the rest at random
// or leaving them for hand placement (the owner's ask of 2026-09-12: "the admin/organizers decides
// if they want to randomize the teams/players who did not pick"). RESET throws the draw away
// while no result exists in the stage.
//
// WHAT IT RENDERS
//   1. stage picker (stages with groups)
//   2. the state of that stage's draw: none / draft / open / closed, with the controls that make
//      sense in that state, who still has to pick (or was left unplaced), and a live mini-board
//   3. the seal: the commitment while open, plus the salt once closed, so the organizer can point
//      players at it
//
// HOW IT CONNECTS
//   - Data: lib/draws.ts drawsApi -> afc_draws/views.py (create / open / window / close / remind
//     / reset / board).
//   - After every write the parent's onRefresh (the edit page's fetchEventDetails) runs, so the
//     group rosters elsewhere on the page show the drawn teams without a reload.
//   - The public half is app/(user)/tournaments/[slug]/_components/GroupDrawBoard.tsx.
//   - Copy: messages/{en,fr,pt}/evEditTabs.json under "draw" (organizers read this in their own
//     language, so it is fully internationalized).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BellRing, Dices, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";
import { Loader } from "@/components/Loader";
import { InfoTip } from "@/components/ui/info-tip";
import { cn } from "@/lib/utils";
import { drawsApi, drawErrorMessage, type DrawBoard } from "@/lib/draws";

// The day the card went live (NEW badge, 5 days, self-expiring), and the day the close-time edit,
// the straggler choice and the reminder arrived.
const DRAW_SINCE = "2026-09-12";
const CONTROLS_SINCE = "2026-09-12";

interface StageLite {
  stage_id: number;
  stage_name: string;
  groups: Array<{ group_id: number; group_name: string }>;
}

interface Props {
  eventId: number;
  stages: StageLite[];
  onRefresh?: () => void;
}

type Busy = "create" | "open" | "window" | "close" | "remind" | "reset" | null;

// datetime-local wants "YYYY-MM-DDTHH:MM" in the browser's own zone.
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Default the close time to 24 hours from now, rounded to the next hour, which is what most
// organizers want anyway.
function defaultCloseInput(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return toLocalInput(d);
}

export function GroupDrawCard({ eventId, stages, onRefresh }: Props) {
  const t = useTranslations("evEditTabs");

  const stagesWithGroups = useMemo(() => stages.filter((s) => (s.groups ?? []).length > 0), [stages]);

  const [stageId, setStageId] = useState<string>("");
  const [boards, setBoards] = useState<DrawBoard[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [closeInput, setCloseInput] = useState<string>(defaultCloseInput);
  // The straggler choice: dealt in at close (true) or left for the organizer (false).
  const [placeRest, setPlaceRest] = useState(true);
  // While open: what the close-time field last mirrored from the board, so a board refresh does
  // not overwrite an edit in progress (adjusted during render from the previous board value).
  const [mirroredClose, setMirroredClose] = useState<string | null>(null);

  const board = useMemo(
    () => boards.find((b) => String(b.stage_id) === stageId) ?? null,
    [boards, stageId],
  );

  // Mirror the open draw's close time and choice into the controls whenever the BOARD's values
  // change (not on every poll): the previous-value comparison is the accepted "adjust state
  // during render" shape, no effect + setState needed.
  const boardClose = board?.status === "open" && board.closes_at ? toLocalInput(new Date(board.closes_at)) : null;
  if (boardClose !== mirroredClose) {
    setMirroredClose(boardClose);
    if (boardClose) {
      setCloseInput(boardClose);
      setPlaceRest(board?.auto_place_at_close ?? true);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await drawsApi.forEvent(eventId);
      setBoards(res.draws);
    } catch (err) {
      toast.error(drawErrorMessage(err, t("draw.toastLoadFailed")));
    } finally {
      setLoading(false);
    }
  }, [eventId, t]);

  useEffect(() => {
    load();
  }, [load]);

  // The edit page refetches the event after every write and this card remounts with it (seen in
  // the 2026-09-12 walk: "Create draw" landed and the stage picker went blank). Default the picker
  // to the stage that already has a draw, else to the only stage with groups, so the organizer
  // never has to re-pick what they were just working on.
  useEffect(() => {
    if (stageId) return;
    if (boards.length > 0) {
      setStageId(String(boards[0].stage_id));
    } else if (stagesWithGroups.length === 1) {
      setStageId(String(stagesWithGroups[0].stage_id));
    }
  }, [boards, stagesWithGroups, stageId]);

  // While a draw is open its board changes under other people's fingers; keep it live.
  useEffect(() => {
    if (!board || board.status !== "open") return;
    const id = window.setInterval(load, 10000);
    return () => window.clearInterval(id);
  }, [board, load]);

  const run = async (kind: Busy, fn: () => Promise<unknown>, ok: string | ((r: unknown) => string)) => {
    setBusy(kind);
    try {
      const r = await fn();
      toast.success(typeof ok === "string" ? ok : ok(r));
      await load();
      onRefresh?.();
    } catch (err) {
      // The backend's sentence (a pool the groups cannot hold, a reminder too soon, ...) is the
      // message; the generic line only when there is none.
      toast.error(drawErrorMessage(err, t("draw.toastFailed")));
    } finally {
      setBusy(null);
    }
  };

  const parseCloseInput = (): Date | null => {
    const when = new Date(closeInput);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      toast.error(t("draw.toastCloseTimeInvalid"));
      return null;
    }
    return when;
  };

  const handleCreate = () => run("create", () => drawsApi.create(Number(stageId)), t("draw.toastCreated"));
  const handleOpen = () => {
    if (!board) return;
    const when = parseCloseInput();
    if (!when) return;
    run("open", () => drawsApi.open(board.draw_id, when.toISOString(), placeRest), t("draw.toastOpened"));
  };
  // While open: push a new close time and/or choice (R1 / R2 of the owner's 2026-09-12 message).
  const handleWindow = () => {
    if (!board) return;
    const when = parseCloseInput();
    if (!when) return;
    run(
      "window",
      () => drawsApi.window(board.draw_id, { closes_at: when.toISOString(), auto_place_at_close: placeRest }),
      t("draw.toastWindowUpdated"),
    );
  };
  const handleRemind = () => {
    if (!board) return;
    run(
      "remind",
      () => drawsApi.remind(board.draw_id),
      (r) => t("draw.toastReminded", { count: (r as { reminded?: number })?.reminded ?? 0 }),
    );
  };
  const unpickedCount = board?.unpicked.length ?? 0;
  const handleClose = (place: boolean) => {
    if (!board) return;
    const question =
      unpickedCount === 0
        ? t("draw.confirmCloseNone")
        : place
          ? t("draw.confirmClosePlace", { count: unpickedCount })
          : t("draw.confirmCloseLeave", { count: unpickedCount });
    if (!window.confirm(question)) return;
    run("close", () => drawsApi.close(board.draw_id, place), t("draw.toastClosed"));
  };
  const handleReset = () => {
    if (!board) return;
    if (!window.confirm(t("draw.confirmReset"))) return;
    run("reset", () => drawsApi.reset(board.draw_id), t("draw.toastReset"));
  };

  const statusKey =
    board?.status === "open" ? "draw.statusOpen" : board?.status === "closed" ? "draw.statusClosed" : "draw.statusDraft";

  // The close-time + straggler controls, shared by the draft panel (open) and the open panel
  // (update). Filled surfaces, no outlines (design rule).
  const windowControls = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          aria-label={t("draw.closeTime")}
          className="h-9 rounded-md bg-background px-3 text-sm"
          value={closeInput}
          onChange={(e) => setCloseInput(e.target.value)}
        />
        {board?.status === "draft" ? (
          <Button size="sm" onClick={handleOpen} disabled={busy !== null}>
            {busy === "open" ? <Loader text={t("draw.opening")} /> : t("draw.open")}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={handleWindow} disabled={busy !== null}>
            {busy === "window" ? <Loader text={t("draw.updating")} /> : t("draw.updateWindow")}
          </Button>
        )}
      </div>
      <label className="flex items-start gap-3 text-sm">
        <Switch checked={placeRest} onCheckedChange={setPlaceRest} aria-label={t("draw.placeRestLabel")} />
        <span>
          <span className="font-medium">
            {t("draw.placeRestLabel")}
            <NewBadge since={CONTROLS_SINCE} className="ml-1" />
          </span>
          <span className="block text-xs text-muted-foreground">{t("draw.placeRestHelp")}</span>
        </span>
      </label>
    </>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Dices className="size-4" />
          {t("draw.title")}
          <NewBadge since={DRAW_SINCE} />
          <InfoTip id="events.edit.group_draw" className="ml-1" />
        </CardTitle>
        <CardDescription>{t("draw.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={stageId} onValueChange={setStageId}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder={t("draw.selectStage")} />
            </SelectTrigger>
            <SelectContent>
              {stagesWithGroups.map((s) => (
                <SelectItem key={s.stage_id} value={String(s.stage_id)}>
                  {s.stage_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="h-9">
            <RefreshCw className={cn("size-4 mr-1", loading && "animate-spin")} />
            {t("draw.refresh")}
          </Button>
        </div>

        {stagesWithGroups.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("draw.noStagesWithGroups")}</p>
        )}

        {stageId && !board && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("draw.createHelp")}</p>
            <Button size="sm" onClick={handleCreate} disabled={busy !== null}>
              {busy === "create" ? <Loader text={t("draw.creating")} /> : t("draw.create")}
            </Button>
          </div>
        )}

        {board && (
          <div className="space-y-4">
            {/* state line: status pill + counts + times. Filled pills, no outline (design rule). */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  board.status === "open" && "bg-green-100 text-green-700",
                  board.status === "closed" && "bg-muted text-muted-foreground",
                  board.status === "draft" && "bg-yellow-100 text-yellow-700",
                )}
              >
                {t(statusKey)}
              </span>
              <span className="text-muted-foreground">
                {t("draw.cardsTaken", { taken: board.cards_taken, total: board.cards_total })}
              </span>
              {board.per_group ? (
                <span className="text-muted-foreground">{t("draw.perGroup", { size: board.per_group })}</span>
              ) : null}
              {board.status === "open" && board.closes_at && (
                <span className="text-muted-foreground">
                  {t("draw.closesAt")} <LocalTime value={board.closes_at} />
                </span>
              )}
              {board.status === "closed" && board.closed_at && (
                <span className="text-muted-foreground">
                  {t("draw.closedAt")} <LocalTime value={board.closed_at} />
                </span>
              )}
            </div>

            {/* controls per state */}
            {board.status === "draft" && (
              <div className="space-y-3 rounded-md bg-muted/30 p-3">
                <p className="text-sm font-medium">{t("draw.openTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("draw.openHelp")}</p>
                {windowControls}
              </div>
            )}

            {board.status === "open" && (
              <div className="space-y-3 rounded-md bg-muted/30 p-3">
                <p className="text-sm font-medium">{t("draw.windowTitle")}</p>
                {windowControls}
              </div>
            )}

            {/* who still has to pick (open), or who was left for the organizer (closed) */}
            {unpickedCount > 0 && (
              <div className="space-y-1.5 rounded-md bg-muted/30 p-3">
                <p className="text-sm font-medium">
                  {board.status === "closed"
                    ? t("draw.notPlaced", { count: unpickedCount })
                    : t("draw.stillToPick", { count: unpickedCount })}
                </p>
                {board.status === "closed" && (
                  <p className="text-xs text-muted-foreground">{t("draw.notPlacedHelp")}</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {board.unpicked.map((name) => (
                    <span key={name} className="rounded-md bg-background px-2 py-1 text-xs">
                      {name}
                    </span>
                  ))}
                </div>
                {board.status === "open" && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button size="sm" variant="secondary" onClick={handleRemind} disabled={busy !== null}>
                      <BellRing className="size-4 mr-1" />
                      {busy === "remind" ? <Loader text={t("draw.reminding")} /> : t("draw.remind")}
                      <NewBadge since={CONTROLS_SINCE} className="ml-1" />
                    </Button>
                    {board.last_reminder_at && (
                      <span className="text-xs text-muted-foreground">
                        {t("draw.lastReminder")} <LocalTime value={board.last_reminder_at} />
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {board.status === "open" && unpickedCount === 0 && (
                <Button size="sm" variant="outline" onClick={() => handleClose(true)} disabled={busy !== null}>
                  {busy === "close" ? <Loader text={t("draw.closing")} /> : t("draw.closeNow")}
                </Button>
              )}
              {board.status === "open" && unpickedCount > 0 && (
                <>
                  <Button size="sm" variant="outline" onClick={() => handleClose(true)} disabled={busy !== null}>
                    {busy === "close" ? <Loader text={t("draw.closing")} /> : t("draw.closePlace")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleClose(false)} disabled={busy !== null}>
                    {t("draw.closeLeave")}
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={handleReset}
                disabled={busy !== null}
              >
                <Trash2 className="size-4 mr-1" />
                {busy === "reset" ? <Loader text={t("draw.resetting")} /> : t("draw.reset")}
              </Button>
            </div>

            {/* the mini board: one chip per card, taken ones name the group and the team */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("draw.board")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {board.cards.map((c) => (
                  <span
                    key={c.number}
                    title={c.taken ? `${c.competitor ?? ""} ${c.via === "auto" ? `(${t("draw.autoPlaced")})` : ""}`.trim() : undefined}
                    className={cn(
                      "rounded-md px-2 py-1 text-xs tabular-nums",
                      c.taken ? "bg-primary/15 text-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    #{c.number}
                    {c.group_name && <span className="ml-1 font-medium">{c.group_name}</span>}
                    {c.competitor && <span className="ml-1 text-muted-foreground">{c.competitor}</span>}
                  </span>
                ))}
              </div>
            </div>

            {/* the seal */}
            <div className="space-y-1 rounded-md bg-muted/30 p-3 text-xs">
              <p className="font-medium">{t("draw.sealTitle")}</p>
              <p className="text-muted-foreground">{t("draw.sealHelp")}</p>
              <p className="break-all font-mono text-muted-foreground">{board.commitment}</p>
              {board.salt && (
                <p className="break-all font-mono text-muted-foreground">
                  {t("draw.salt")}: {board.salt}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
