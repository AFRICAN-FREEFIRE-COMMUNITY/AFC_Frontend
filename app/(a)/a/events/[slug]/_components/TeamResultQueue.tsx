"use client";

// ── TeamResultQueue ────────────────────────────────────────────────────────────
// The ORGANIZER's half of team-submitted map results (owner backlog item 6).
//
// WHY THIS EXISTS: on a large event only an organizer could enter results, so one person ended up
// transcribing screenshots teams had already sent them on WhatsApp. Teams now file their own row
// for a map and the organizer approves it here. Approval is what writes the standings; nothing a
// team types is live until someone on this screen says so.
//
// WHERE IT SITS: the admin event page, alongside the other per-match tools. It takes the match it
// is reviewing as a prop rather than choosing one, because the organizer is already looking at a
// specific map when they get here.
//
// SHAPE BORROWED DELIBERATELY: this follows the OCR review table
// (app/(a)/a/leaderboards/_components/OCRReviewTable.tsx) rather than inventing a second review
// idiom. An organizer already knows that screen: rows of proposed truth, editable in place,
// with the accept action disabled until the row is coherent.
//
// THE THREE THINGS THIS SCREEN MUST GET RIGHT:
//   1. CONFLICTS ARE LOUD. Two teams claiming the same finishing position is the one thing an
//      organizer cannot see by reading a single row, so the backend returns a `conflicts` list per
//      submission and it is rendered as a warning ON the row, not in a summary somewhere else.
//   2. A CORRECTION IS VISIBLE. The organizer can edit before approving. What the team sent and
//      what was approved are BOTH kept server side, so this screen marks a row it has changed
//      rather than quietly replacing the numbers.
//   3. A REJECTION EXPLAINS ITSELF. The backend requires a note, so the dialog asks for one and
//      disables the confirm until it is there. A team told only "rejected" resubmits the same
//      numbers and costs the organizer the round trip twice.
//
// BONUS AND PENALTY ARE ORGANIZER-ONLY and appear nowhere on the team's side: a sanction is a
// ruling, not a claim. See lib/teamMapResults.ts, where they are absent from TeamResultPayload.
//
// API: lib/teamMapResults.ts -> events/team-map-results/{queue,<id>/approve,<id>/reject}/
// i18n: the `teamResults` namespace, group "queue". Times render through LocalTime so every
// viewer reads them in their own timezone (the backend is UTC).

import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconAlertTriangle, IconCheck, IconPencil, IconX } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import {
  teamMapResultsApi,
  type TeamMapSubmission,
  type TeamResultPayload,
} from "@/lib/teamMapResults";

/** Per-row editing state. Absent from the map means "approve exactly what the team sent", which
 *  is why the API's `results` argument is optional: an untouched row sends no override at all. */
type RowEdit = { placement: string; bonus: string; penalty: string };

export function TeamResultQueue({ matchId }: { matchId: number }) {
  const t = useTranslations("teamResults");

  const [rows, setRows] = useState<TeamMapSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [edits, setEdits] = useState<Record<number, RowEdit>>({});

  // Rejection is a two-step action because it needs a note, so the target and the dialog's open
  // state are separate: clearing the target as the dialog closes would blank the team name
  // mid-animation and the organizer would read "Reject ?" with a hole in it.
  const [rejectTarget, setRejectTarget] = useState<TeamMapSubmission | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await teamMapResultsApi.queue(matchId);
      setRows(res.submissions ?? []);
    } catch {
      toast.error(t("queue.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [matchId, t]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (row: TeamMapSubmission) => {
    setEdits((prev) => ({
      ...prev,
      [row.submission_id]: {
        placement: String(row.submitted_payload?.placement ?? ""),
        bonus: "0",
        penalty: "0",
      },
    }));
  };

  const cancelEdit = (id: number) =>
    setEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const approve = async (row: TeamMapSubmission) => {
    const edit = edits[row.submission_id];
    setBusyId(row.submission_id);
    try {
      // No edit staged means no override: the backend approves the stored payload untouched, so
      // an organizer who simply agrees never has to re-send the numbers back.
      const body = edit
        ? {
            results: {
              ...(row.submitted_payload as TeamResultPayload),
              placement: Number(edit.placement) || 0,
            },
            bonus_points: Number(edit.bonus) || 0,
            penalty_points: Number(edit.penalty) || 0,
          }
        : undefined;
      await teamMapResultsApi.approve(row.submission_id, body);
      toast.success(t("queue.approved"));
      cancelEdit(row.submission_id);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("queue.actionFailed"));
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    const note = rejectNote.trim();
    if (!note) {
      toast.error(t("queue.noteRequired"));
      return;
    }
    setBusyId(rejectTarget.submission_id);
    try {
      await teamMapResultsApi.reject(rejectTarget.submission_id, note);
      toast.success(t("queue.rejected"));
      setRejectOpen(false);
      setRejectNote("");
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("queue.actionFailed"));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <FullLoader text={t("queue.title")} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("queue.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("queue.subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground">{t("queue.empty")}</p>
        )}

        {rows.map((row) => {
          const payload = row.submitted_payload;
          const edit = edits[row.submission_id];
          const pending = row.status === "pending";
          const kills = (payload?.players ?? []).reduce(
            (sum, p) => sum + (Number(p.kills) || 0), 0);

          return (
            <div key={row.submission_id} className="rounded-md border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{row.team_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("queue.sentBy", { name: row.submitted_by_username })}
                    {row.submitted_at ? " " : ""}
                    {row.submitted_at && <LocalTime value={row.submitted_at} />}
                  </p>
                </div>
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                  {t(`team.status.${row.status}` as any)}
                </Badge>
              </div>

              <p className="text-xs">
                {t("queue.claims")}:{" "}
                {payload?.played === false
                  ? t("queue.didNotPlay")
                  : `${t("queue.placementLabel", { placement: payload?.placement ?? 0 })}, ${t("queue.kills", { count: kills })}`}
              </p>

              {/* A conflict lives ON the row it affects. Put in a summary elsewhere it reads as
                  background noise; here it is impossible to approve without seeing it. */}
              {(row.conflicts?.length ?? 0) > 0 && (
                <div className="rounded-md border border-orange-500/40 bg-orange-500/10 p-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-orange-500">
                    <IconAlertTriangle className="size-3.5" />
                    {t("queue.conflictTitle")}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {row.conflicts!.map((c) => (
                      <li key={c.submission_id} className="text-xs text-muted-foreground">
                        {t("queue.conflictLine", { team: c.team_name, placement: c.placement })}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-muted-foreground">{t("queue.conflictHelp")}</p>
                </div>
              )}

              {edit && (
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("queue.placementLabel", { placement: "" })}</Label>
                    <Input
                      type="number" min={0} className="h-9"
                      value={edit.placement}
                      onChange={(e) => setEdits((p) => ({
                        ...p, [row.submission_id]: { ...edit, placement: e.target.value } }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("queue.bonus")}</Label>
                    <Input
                      type="number" className="h-9"
                      value={edit.bonus}
                      onChange={(e) => setEdits((p) => ({
                        ...p, [row.submission_id]: { ...edit, bonus: e.target.value } }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("queue.penalty")}</Label>
                    <Input
                      type="number" className="h-9"
                      value={edit.penalty}
                      onChange={(e) => setEdits((p) => ({
                        ...p, [row.submission_id]: { ...edit, penalty: e.target.value } }))}
                    />
                  </div>
                  <p className="sm:col-span-3 text-xs text-muted-foreground">
                    {t("queue.sanctionHint")}
                  </p>
                </div>
              )}

              {row.status === "rejected" && row.review_note && (
                <p className="text-xs text-muted-foreground">
                  {t("team.organizerNote")}: {row.review_note}
                </p>
              )}

              {pending && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm" className="min-h-9"
                    disabled={busyId === row.submission_id}
                    onClick={() => approve(row)}
                  >
                    <IconCheck className="size-4" />
                    {edit ? t("queue.approveEdited") : t("queue.approve")}
                  </Button>
                  {edit ? (
                    <Button size="sm" variant="ghost" className="min-h-9"
                      onClick={() => cancelEdit(row.submission_id)}>
                      {t("queue.cancelEdit")}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="min-h-9"
                      onClick={() => startEdit(row)}>
                      <IconPencil className="size-4" />
                      {t("queue.edit")}
                    </Button>
                  )}
                  <Button
                    size="sm" variant="outline" className="min-h-9"
                    disabled={busyId === row.submission_id}
                    onClick={() => { setRejectTarget(row); setRejectNote(""); setRejectOpen(true); }}
                  >
                    <IconX className="size-4" />
                    {t("queue.reject")}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("queue.rejectTitle")}</DialogTitle>
            <DialogDescription>{t("queue.rejectPrompt")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">{t("queue.rejectNote")}</Label>
            <Textarea
              value={rejectNote}
              placeholder={t("queue.rejectPlaceholder")}
              onChange={(e) => setRejectNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            {/* Disabled until there is a note, because the backend requires one: letting the
                organizer press this and collect a 400 would teach them the button is broken. */}
            <Button onClick={confirmReject} disabled={!rejectNote.trim() || busyId !== null}>
              {t("queue.rejectConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default TeamResultQueue;
