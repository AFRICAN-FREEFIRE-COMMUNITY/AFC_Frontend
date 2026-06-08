"use client";

// ── OCRReviewTable ─────────────────────────────────────────────────────────────
// The core editable OCR review table for the admin leaderboard editor. This is the
// step that turns a raw OCR draft into committed match results AND, at the same time,
// captures the admin-confirmed truth that the OCR learning loop trains on.
//
// Where it sits in the flow (app/(a)/a/leaderboards/[id]/edit/page.tsx Upload drawer):
//   MapSelectionStep -> (uploadOcrScreenshot) -> THIS TABLE -> (commit) -> drawer closes + refresh.
// It is also the destination ImageUploadStep hands its extracted session to.
//
// Per row the admin can:
//   - see the raw OCR name (raw_name);
//   - re-assign the matched player from top_candidates (up to 3) OR keep matched_username
//     editable as a free-text fallback (see ROSTER NOTE below);
//   - edit kills;
//   - read a confidence Badge (>=0.8 default / >=0.5 secondary / else destructive;
//     team_mismatch overrides to an outline-yellow badge);
//   - correct the on-screen text (recognition-truth capture, see CORRECTED-TEXT NOTE below);
//   - acknowledge a sub for any team_mismatch row.
// Every edit calls ocrApi.patchOcrRow (afc_ocr PATCH /events/ocr-session/<id>/). Commit
// (ocrApi.commitOcrSession) is DISABLED until every row has a matched player AND every team
// mismatch is acknowledged - the same rules the backend enforces, surfaced client-side so the
// admin sees a green Commit instead of a 400. We still surface the backend 400
// {unresolved}/{unacknowledged} lists defensively.
//
// API client: lib/api/ocr.ts (ocrApi). Toasts via sonner. Help copy via InfoTip ids ocr.*.
//
// ── ROSTER NOTE ────────────────────────────────────────────────────────────────
// The full event roster is NOT readily available to this component (the edit page passes the
// match + maps, not the registered-player list, and there is no roster prop in the OCR contract).
// So "reassign to any roster player" is served by the per-row `top_candidates` dropdown (the best
// 3 fuzzy matches the backend already computed) PLUS a free-text matched_username field for the
// rare case the right player is not in the top 3. Picking a candidate sets matched_user_id (the
// real identity link the backend commits on); the free-text field only adjusts the displayed
// username. A future enhancement could thread the event roster down and swap the free-text box for
// a full searchable player picker.
//
// ── CORRECTED-TEXT NOTE ────────────────────────────────────────────────────────
// "Corrected on-screen text" is recognition-truth: what the PIXELS literally say, independent of
// WHO that resolves to (see afc_ocr/models.py header re recognition-truth vs identity-truth). The
// current PATCH endpoint does not persist a corrected_text field, so we keep it in local row state
// and send it inside commit's `final_rows`. The current commit ignores unknown keys, and the
// future training-capture step (afc_ocr.services.training_capture, referenced in the model
// docstring) is the intended consumer. It defaults to raw_name so an untouched row already carries
// the correct label.

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { InfoTip } from "@/components/ui/info-tip";
import {
  IconLoader2,
  IconDeviceFloppy,
  IconTrash,
  IconAlertTriangle,
  IconScan,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ocrApi, type DraftRow, type CommitOcrError } from "@/lib/api/ocr";

interface Props {
  /** The OCR session being reviewed (afc_ocr OCRSession.session_id). */
  sessionId: string;
  /** The rows handed over from the upload step (or a refetch). */
  draftRows: DraftRow[];
  /** The match these rows belong to - kept for parity with the rest of the flow / future roster. */
  matchId: number;
  /** Engine that produced this session, if the backend surfaced it (Local vN / Gemini / Hybrid). */
  engine?: string | null;
  /** Called after a successful commit so the parent can close the drawer + refresh. */
  onCommitted: () => void;
  /** Back to the previous step (map selection / method). */
  onBack: () => void;
}

// Sentinel <Select> value for the free-text fallback (Radix Select forbids an empty-string item).
const FREE_TEXT = "__free_text__";

export function OCRReviewTable({
  sessionId,
  draftRows,
  matchId,
  engine,
  onCommitted,
  onBack,
}: Props) {
  // Local editable copy of the rows. Each edit updates this AND fires a patch to the server.
  // corrected_text is seeded from raw_name so an untouched row already carries the right label.
  const [rows, setRows] = useState<DraftRow[]>(() =>
    draftRows.map((r) => ({
      ...r,
      corrected_text: r.corrected_text ?? r.raw_name ?? "",
    })),
  );
  // Which row_ids currently have an in-flight patch (for a subtle per-row spinner).
  const [savingRowIds, setSavingRowIds] = useState<Set<string>>(new Set());
  const [committing, setCommitting] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  // ── Commit-readiness (mirrors the backend's two 400 guards) ──────────────────
  // Disable Commit until: every row has a matched player, AND every team_mismatch is acknowledged.
  const unresolvedCount = useMemo(
    () => rows.filter((r) => !r.matched_user_id).length,
    [rows],
  );
  const unacknowledgedCount = useMemo(
    () => rows.filter((r) => r.team_mismatch && !r.admin_confirmed_sub).length,
    [rows],
  );
  const canCommit =
    rows.length > 0 && unresolvedCount === 0 && unacknowledgedCount === 0;

  // ── Local-state helpers ──────────────────────────────────────────────────────

  const setRow = (rowId: string, patch: Partial<DraftRow>) =>
    setRows((prev) =>
      prev.map((r) => (r.row_id === rowId ? { ...r, ...patch } : r)),
    );

  const markSaving = (rowId: string, on: boolean) =>
    setSavingRowIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(rowId);
      else next.delete(rowId);
      return next;
    });

  // Persist one row edit. Updates local state optimistically, then PATCHes the server; on failure
  // we toast (the local edit stays so the admin's typing isn't lost, but they know it didn't save).
  const persistRow = async (
    rowId: string,
    patch: Partial<DraftRow>,
    apiBody: Record<string, any>,
  ) => {
    setRow(rowId, patch);
    markSaving(rowId, true);
    try {
      await ocrApi.patchOcrRow(sessionId, { row_id: rowId, ...apiBody });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not save that change");
    } finally {
      markSaving(rowId, false);
    }
  };

  // ── Per-field edit handlers ──────────────────────────────────────────────────

  // Reassign the matched player from a top candidate. Sets BOTH the user id (identity link the
  // backend commits on) and the displayed username. We also clear any stale team_mismatch -> the
  // backend recomputes team context on the next upload, but locally picking a known candidate is a
  // resolution, so we keep team fields as-is and let the admin acknowledge if still mismatched.
  const handlePickCandidate = (row: DraftRow, value: string) => {
    if (value === FREE_TEXT) return; // selecting the placeholder is a no-op
    const cand = row.top_candidates.find((c) => String(c.user_id) === value);
    if (!cand) return;
    persistRow(
      row.row_id,
      {
        matched_user_id: cand.user_id,
        matched_username: cand.username,
        confidence: cand.confidence,
      },
      { matched_user_id: cand.user_id, matched_username: cand.username },
    );
  };

  // Free-text username fallback (see ROSTER NOTE). This only sets matched_username; it does NOT
  // invent a matched_user_id (we can't resolve a free string to a real user here), so a free-text
  // row stays "unresolved" for commit unless a candidate is also picked. Saved on blur.
  const handleUsernameBlur = (row: DraftRow, username: string) => {
    if (username === (row.matched_username ?? "")) return;
    persistRow(
      row.row_id,
      { matched_username: username },
      { matched_username: username },
    );
  };

  // Editable kills. Saved on blur to avoid a patch per keystroke.
  const handleKillsBlur = (row: DraftRow, kills: number) => {
    if (kills === (row.kills ?? 0)) return;
    persistRow(row.row_id, { kills }, { kills });
  };

  // Recognition-truth capture (see CORRECTED-TEXT NOTE). Sent on PATCH for forward-compat (ignored
  // by the current backend) AND carried in commit's final_rows. Saved on blur.
  const handleCorrectedTextBlur = (row: DraftRow, corrected: string) => {
    if (corrected === (row.corrected_text ?? "")) return;
    persistRow(
      row.row_id,
      { corrected_text: corrected },
      { corrected_text: corrected },
    );
  };

  // Acknowledge a sub for a team_mismatch row.
  const handleAcknowledgeSub = (row: DraftRow, confirmed: boolean) => {
    persistRow(
      row.row_id,
      { admin_confirmed_sub: confirmed },
      { admin_confirmed_sub: confirmed },
    );
  };

  // ── Commit / discard ─────────────────────────────────────────────────────────

  const handleCommit = async () => {
    setCommitting(true);
    try {
      // Send the full local row set as final_rows so corrected_text (recognition-truth) rides along
      // for the training-capture step. The backend re-validates resolved + acknowledged regardless.
      await ocrApi.commitOcrSession(sessionId, { final_rows: rows });
      toast.success("Match results committed from the screenshot");
      onCommitted();
    } catch (err: any) {
      const data = (err?.response?.data ?? {}) as CommitOcrError;
      // Surface the backend's blocking lists explicitly so the admin knows which names to fix.
      if (data.unresolved?.length) {
        toast.error(
          `Resolve these unmatched names first: ${data.unresolved.join(", ")}`,
        );
      } else if (data.unacknowledged?.length) {
        toast.error(
          `Acknowledge these team mismatches first: ${data.unacknowledged.join(", ")}`,
        );
      } else {
        toast.error(data.message || "Failed to commit the session");
      }
    } finally {
      setCommitting(false);
    }
  };

  const handleDiscard = async () => {
    setDiscarding(true);
    try {
      await ocrApi.discardOcrSession(sessionId);
      toast.success("Draft discarded");
      onBack();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to discard the draft",
      );
    } finally {
      setDiscarding(false);
    }
  };

  // ── Confidence badge ─────────────────────────────────────────────────────────
  // team_mismatch wins (outline-yellow), matching ImageUploadStep's mismatch styling. Otherwise
  // the standard >=0.8 default / >=0.5 secondary / else destructive ladder (same thresholds the
  // old read-only preview used).
  const confidenceBadge = (row: DraftRow) => {
    if (row.team_mismatch) {
      return (
        <Badge
          variant="outline"
          className="rounded-full text-yellow-600 border-yellow-500/50"
        >
          Team mismatch
        </Badge>
      );
    }
    if (row.confidence == null) {
      return <span className="text-muted-foreground text-xs">-</span>;
    }
    const variant =
      row.confidence >= 0.8
        ? "default"
        : row.confidence >= 0.5
          ? "secondary"
          : "destructive";
    return (
      <Badge variant={variant} className="rounded-full">
        {Math.round(row.confidence * 100)}%
      </Badge>
    );
  };

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <Card className="gap-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconScan size={20} className="text-muted-foreground" />
            OCR Review
          </CardTitle>
          <CardDescription>
            No rows were read from this screenshot.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
            <IconAlertTriangle className="size-4 shrink-0" />
            <span>
              Check that the screenshot is clear and shows the match results,
              then try again.
            </span>
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button
              variant="ghost"
              onClick={handleDiscard}
              disabled={discarding}
              className="text-destructive hover:text-destructive"
            >
              {discarding ? (
                <IconLoader2 size={14} className="mr-1 animate-spin" />
              ) : (
                <IconTrash size={14} className="mr-1" />
              )}
              Discard draft
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconScan size={20} className="text-muted-foreground" />
          Review OCR Result
          {/* "Which engine answered" visibility - rendered only when the backend surfaced it. */}
          {engine ? (
            <Badge variant="outline" className="rounded-full text-xs">
              Engine: {engine}
            </Badge>
          ) : null}
          <InfoTip id="ocr.engine" className="ml-1" />
        </CardTitle>
        <CardDescription>
          Check each player the screenshot read, correct any mistakes, then
          commit to write the results to the leaderboard.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* ── Readiness hints (mirror the backend's two commit guards) ── */}
        {(unresolvedCount > 0 || unacknowledgedCount > 0) && (
          <div className="flex flex-col gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            {unresolvedCount > 0 && (
              <span>
                {unresolvedCount} row{unresolvedCount !== 1 ? "s" : ""} still
                need a matched player.
              </span>
            )}
            {unacknowledgedCount > 0 && (
              <span>
                {unacknowledgedCount} team mismatch
                {unacknowledgedCount !== 1 ? "es" : ""} still need
                acknowledging.
              </span>
            )}
          </div>
        )}

        {/* ── Review table (compact density, matches the leaderboard editor) ── */}
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-xs">#</TableHead>
                <TableHead className="text-xs">Raw name (OCR)</TableHead>
                <TableHead className="text-xs">Matched player</TableHead>
                <TableHead className="w-20 text-xs">Kills</TableHead>
                <TableHead className="w-28 text-xs">
                  Confidence
                  <InfoTip id="ocr.confidence" className="ml-1" />
                </TableHead>
                <TableHead className="text-xs">
                  Corrected text
                  <InfoTip id="ocr.corrected_text" className="ml-1" />
                </TableHead>
                <TableHead className="w-24 text-center text-xs">
                  Acknowledge
                  <InfoTip id="ocr.team_mismatch" className="ml-1" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => {
                const saving = savingRowIds.has(row.row_id);
                // Value for the candidate <Select>: the currently matched candidate id, or the
                // free-text sentinel when the match isn't one of the listed candidates.
                const selectValue =
                  row.matched_user_id != null &&
                  row.top_candidates.some(
                    (c) => c.user_id === row.matched_user_id,
                  )
                    ? String(row.matched_user_id)
                    : FREE_TEXT;
                return (
                  <TableRow
                    key={row.row_id}
                    className={cn(
                      row.team_mismatch && "bg-yellow-500/5",
                      !row.matched_user_id && "bg-destructive/5",
                    )}
                  >
                    {/* Placement # */}
                    <TableCell className="p-2 text-xs text-muted-foreground">
                      {row.placement ?? idx + 1}
                    </TableCell>

                    {/* Raw OCR name (read-only, monospace so glyph errors are obvious) */}
                    <TableCell className="p-2">
                      <span className="font-mono text-xs">{row.raw_name}</span>
                    </TableCell>

                    {/* Matched player: top_candidates dropdown + free-text fallback */}
                    <TableCell className="p-2">
                      <div className="flex flex-col gap-1.5">
                        <Select
                          value={selectValue}
                          onValueChange={(v) => handlePickCandidate(row, v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Pick a player" />
                          </SelectTrigger>
                          <SelectContent>
                            {row.top_candidates.length === 0 && (
                              <SelectItem value={FREE_TEXT} disabled>
                                No suggestions
                              </SelectItem>
                            )}
                            {row.top_candidates.map((c) => (
                              <SelectItem
                                key={c.user_id}
                                value={String(c.user_id)}
                              >
                                {c.username} ({Math.round(c.confidence * 100)}%)
                              </SelectItem>
                            ))}
                            {/* Free-text marker so the dropdown can reflect a manual username. */}
                            <SelectItem value={FREE_TEXT}>
                              Other (type below)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {/* Free-text username fallback - only sets the displayed name (see ROSTER
                            NOTE); a row still needs a real candidate pick to resolve for commit. */}
                        <Input
                          defaultValue={row.matched_username ?? ""}
                          placeholder="or type a username"
                          className="h-7 text-xs"
                          onBlur={(e) =>
                            handleUsernameBlur(row, e.target.value.trim())
                          }
                        />
                      </div>
                    </TableCell>

                    {/* Editable kills */}
                    <TableCell className="p-2">
                      <Input
                        type="number"
                        min="0"
                        defaultValue={row.kills ?? 0}
                        className="h-8 w-16 text-xs"
                        onBlur={(e) =>
                          handleKillsBlur(row, parseInt(e.target.value) || 0)
                        }
                      />
                    </TableCell>

                    {/* Confidence badge (or team-mismatch badge) */}
                    <TableCell className="p-2">
                      <span className="flex items-center gap-1.5">
                        {confidenceBadge(row)}
                        {saving && (
                          <IconLoader2
                            size={12}
                            className="animate-spin text-muted-foreground"
                          />
                        )}
                      </span>
                    </TableCell>

                    {/* Corrected on-screen text (recognition-truth capture) */}
                    <TableCell className="p-2">
                      <Input
                        defaultValue={row.corrected_text ?? row.raw_name ?? ""}
                        className="h-8 text-xs"
                        onBlur={(e) =>
                          handleCorrectedTextBlur(row, e.target.value)
                        }
                      />
                    </TableCell>

                    {/* Acknowledge sub - only meaningful for team_mismatch rows */}
                    <TableCell className="p-2 text-center">
                      {row.team_mismatch ? (
                        <Checkbox
                          checked={row.admin_confirmed_sub}
                          onCheckedChange={(v) =>
                            handleAcknowledgeSub(row, !!v)
                          }
                          aria-label="Acknowledge sub"
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* ── Actions ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button variant="outline" onClick={onBack} disabled={committing}>
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={handleDiscard}
              disabled={discarding || committing}
              className="text-destructive hover:text-destructive"
            >
              {discarding ? (
                <span className="flex items-center gap-2">
                  <IconLoader2 size={14} className="animate-spin" />
                  Discarding…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <IconTrash size={14} />
                  Discard
                </span>
              )}
            </Button>
            <Button onClick={handleCommit} disabled={!canCommit || committing}>
              {committing ? (
                <span className="flex items-center gap-2">
                  <IconLoader2 size={14} className="animate-spin" />
                  Committing…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <IconDeviceFloppy size={14} />
                  Commit results
                </span>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
