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
//   - re-assign the matched player from a roster-scoped searchable combobox that lists ONLY the
//     players registered to this event (see ROSTER NOTE below): the row's fuzzy top_candidates
//     float to the top as suggestions, the rest of the roster follows;
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
// ── i18n NOTE ──────────────────────────────────────────────────────────────────
// Every user-facing string here is a next-intl key. Component-specific copy lives under the
// "ocr" namespace, group "reviewTable" (messages/<locale>/ocr.json); generic verbs (Back,
// Discard, Cancel) reference the shared "common" group. English is authored here; the
// i18n:translate script machine-fills fr/pt. No raw English literals may reach the DOM.
//
// ── ROSTER NOTE ────────────────────────────────────────────────────────────────
// The event roster IS now fetched by this component: on mount it calls
// ocrApi.getSessionRoster(sessionId) -> GET /events/ocr-session/<id>/roster/, which returns the
// players registered to the event this session belongs to (+ event_type solo/team). That list
// powers a per-row searchable combobox (RosterMatchPicker below): the admin TYPES a name and picks
// from the REGISTERED players only. The row's fuzzy `top_candidates` are surfaced at the top as
// "Suggestions" (showing username + confidence), the rest of the roster follows under "Registered
// players" (deduped by user_id). Picking either sets matched_user_id (the real identity link the
// backend commits on) AND matched_username, plus matched_team_id / matched_team_name for team
// events, so the row RESOLVES for commit - no more inert free-text box that couldn't link a user.
// Fallbacks: while the roster loads the trigger is a disabled spinner; if the fetch ERRORS we drop
// back to the old top_candidates <Select> so the table still works; if the roster is empty the
// combobox shows a "no registered players" message.
// Because this ONE component is reused by the admin event OCR page, the organizer OCR page, the
// organizer leaderboard and the admin leaderboard editor, fixing the picker here fixes all four.
//
// ── CORRECTED-TEXT NOTE ────────────────────────────────────────────────────────
// "Corrected on-screen text" is recognition-truth: what the PIXELS literally say, independent of
// WHO that resolves to (see afc_ocr/models.py header re recognition-truth vs identity-truth). The
// current PATCH endpoint does not persist a corrected_text field, so we keep it in local row state
// and send it inside commit's `final_rows`. The current commit ignores unknown keys, and the
// future training-capture step (afc_ocr.services.training_capture, referenced in the model
// docstring) is the intended consumer. It defaults to raw_name so an untouched row already carries
// the correct label. The column is labelled "training only" (B7) so the admin knows editing it
// never changes who the row resolves to or the score.

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { InfoTip } from "@/components/ui/info-tip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  IconLoader2,
  IconDeviceFloppy,
  IconTrash,
  IconAlertTriangle,
  IconScan,
  IconCheck,
  IconSelector,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ocrApi,
  type DraftRow,
  type CommitOcrError,
  type OcrCandidate,
  type OcrRosterPlayer,
} from "@/lib/api/ocr";

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

// The identity the picker hands back when a row is matched. `confidence` is present only when the
// pick came from a fuzzy suggestion (mirrors the old handlePickCandidate, which set the badge from
// the candidate score). team_id / team_name ride along for team events.
type RosterPick = {
  user_id: number;
  username: string;
  team_id: number | null;
  team_name: string | null;
  confidence?: number;
};

// ── RosterMatchPicker ──────────────────────────────────────────────────────────
// The roster-scoped "matched player" combobox for ONE review row. Mirrors the Popover + Command
// pattern in components/ui/user-search-select.tsx, but the DATA SOURCE is the event roster the
// parent fetched once (getSessionRoster) - filtered CLIENT-SIDE by cmdk (the list is bounded, so
// there is no server search). The row's fuzzy `topCandidates` float to the top under "Suggestions"
// (shown as "username (NN%)"); the rest of the roster follows under "Registered players", deduped
// by user_id so a suggestion is never listed twice. For team events each entry also shows the
// player's team_name. Picking either calls onPick with the full identity so the parent persists
// matched_user_id (+ team fields for team events) and the row resolves for commit.
function RosterMatchPicker({
  roster,
  eventType,
  topCandidates,
  matchedUserId,
  matchedUsername,
  onPick,
}: {
  roster: OcrRosterPlayer[];
  eventType: "solo" | "team";
  topCandidates: OcrCandidate[];
  matchedUserId: number | null;
  matchedUsername: string | null;
  onPick: (pick: RosterPick) => void;
}) {
  // Its own translator (component copy under ocr.reviewTable.*), so no translator prop threading.
  const t = useTranslations("ocr");
  // Each row owns its own popover open state (that is why this is a component, not inline JSX).
  const [open, setOpen] = useState(false);
  const isTeam = eventType === "team";

  // Fast id -> roster player lookup, used to enrich a suggestion (top_candidates carry no team).
  const rosterById = useMemo(() => {
    const m = new Map<number, OcrRosterPlayer>();
    for (const p of roster) m.set(p.user_id, p);
    return m;
  }, [roster]);

  // Suggestion ids, so the "Registered players" group can exclude anyone already shown on top.
  const candidateIds = useMemo(
    () => new Set(topCandidates.map((c) => c.user_id)),
    [topCandidates],
  );
  const restRoster = useMemo(
    () => roster.filter((p) => !candidateIds.has(p.user_id)),
    [roster, candidateIds],
  );

  // Pick a fuzzy suggestion: enrich with team fields from the roster (if the candidate is on it).
  const pickCandidate = (c: OcrCandidate) => {
    const rp = rosterById.get(c.user_id);
    onPick({
      user_id: c.user_id,
      username: c.username,
      team_id: rp?.team_id ?? null,
      team_name: rp?.team_name ?? null,
      confidence: c.confidence,
    });
    setOpen(false);
  };

  // Pick a plain roster player (no fuzzy score -> leave the confidence badge as it was).
  const pickRoster = (p: OcrRosterPlayer) => {
    onPick({
      user_id: p.user_id,
      username: p.username,
      team_id: p.team_id,
      team_name: p.team_name,
    });
    setOpen(false);
  };

  const triggerLabel =
    matchedUserId != null && matchedUsername
      ? matchedUsername
      : t("reviewTable.selectPlayer");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-8 w-full justify-between gap-2 text-xs font-normal",
            matchedUserId == null && "text-muted-foreground",
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <IconSelector size={14} className="shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        {/* cmdk filters CommandItems client-side by their `value` (username + team_name), so the
            admin can just type to narrow the bounded roster - no server round-trip. */}
        <Command>
          <CommandInput
            placeholder={t("reviewTable.searchPlayerPlaceholder")}
            className="text-xs"
          />
          <CommandList>
            <CommandEmpty>
              {roster.length === 0 && topCandidates.length === 0
                ? t("reviewTable.rosterEmpty")
                : t("reviewTable.noRosterMatch")}
            </CommandEmpty>

            {/* Suggestions: the backend's best fuzzy matches, on top. */}
            {topCandidates.length > 0 && (
              <CommandGroup heading={t("reviewTable.suggestionsGroup")}>
                {topCandidates.map((c) => {
                  const rp = rosterById.get(c.user_id);
                  return (
                    <CommandItem
                      key={`cand-${c.user_id}`}
                      value={`${c.username} ${rp?.team_name ?? ""}`}
                      onSelect={() => pickCandidate(c)}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">
                          {c.username} ({Math.round(c.confidence * 100)}%)
                        </span>
                        {isTeam && rp?.team_name && (
                          <span className="truncate text-[10px] text-muted-foreground">
                            {rp.team_name}
                          </span>
                        )}
                      </span>
                      {matchedUserId === c.user_id && (
                        <IconCheck size={14} className="shrink-0 text-primary" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {/* The rest of the registered roster (suggestions removed). */}
            {restRoster.length > 0 && (
              <CommandGroup heading={t("reviewTable.rosterGroup")}>
                {restRoster.map((p) => (
                  <CommandItem
                    key={`roster-${p.user_id}`}
                    value={`${p.username} ${p.team_name ?? ""}`}
                    onSelect={() => pickRoster(p)}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{p.username}</span>
                      {isTeam && p.team_name && (
                        <span className="truncate text-[10px] text-muted-foreground">
                          {p.team_name}
                        </span>
                      )}
                    </span>
                    {matchedUserId === p.user_id && (
                      <IconCheck size={14} className="shrink-0 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function OCRReviewTable({
  sessionId,
  draftRows,
  matchId,
  engine,
  onCommitted,
  onBack,
}: Props) {
  // next-intl translators. `t` = component copy under ocr.reviewTable.*; `tc` = shared verbs
  // under the common.* group (Back / Discard / Cancel), so those stay consistent site-wide.
  const t = useTranslations("ocr");
  const tc = useTranslations("common");

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
  // Controls the "Discard this draft?" confirm gate (B4 #3). Discard throws away every local
  // edit and deletes the server draft, so BOTH discard triggers (empty-state + main button) open
  // this AlertDialog first; only AlertDialogAction actually runs handleDiscard.
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  // ── Event roster (source for the matched-player combobox) ────────────────────
  // Fetched ONCE per session from GET /events/ocr-session/<id>/roster/. The list is the players
  // registered to this event; RosterMatchPicker filters it client-side. rosterError flips the per
  // row picker to the old top_candidates <Select> fallback so the table still works offline of the
  // roster endpoint. rosterEventType decides whether we show + persist team fields.
  const [roster, setRoster] = useState<OcrRosterPlayer[]>([]);
  const [rosterEventType, setRosterEventType] = useState<"solo" | "team">(
    "solo",
  );
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterError, setRosterError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRosterLoading(true);
    setRosterError(false);
    ocrApi
      .getSessionRoster(sessionId)
      .then((res) => {
        if (cancelled) return;
        setRoster(res.players ?? []);
        setRosterEventType(res.event_type ?? "solo");
      })
      .catch(() => {
        if (!cancelled) setRosterError(true);
      })
      .finally(() => {
        if (!cancelled) setRosterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

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
      toast.error(err?.response?.data?.message || t("reviewTable.saveFailed"));
    } finally {
      markSaving(rowId, false);
    }
  };

  // ── Per-field edit handlers ──────────────────────────────────────────────────

  // Reassign the matched player from a roster pick (RosterMatchPicker.onPick). Sets BOTH the user
  // id (identity link the backend commits on) and the displayed username so the row RESOLVES for
  // commit; for team events it also stores matched_team_id / matched_team_name from the picked
  // roster player. A pick that came from a fuzzy suggestion carries a confidence, which we mirror
  // onto the badge (as the old top_candidates dropdown did); a plain roster pick leaves the badge
  // untouched. matched_team_name is display-only local state (the PATCH body only takes team_id).
  const handlePickRosterPlayer = (row: DraftRow, pick: RosterPick) => {
    const patch: Partial<DraftRow> = {
      matched_user_id: pick.user_id,
      matched_username: pick.username,
    };
    const apiBody: Record<string, any> = {
      matched_user_id: pick.user_id,
      matched_username: pick.username,
    };
    if (pick.confidence != null) patch.confidence = pick.confidence;
    if (rosterEventType === "team") {
      patch.matched_team_id = pick.team_id;
      patch.matched_team_name = pick.team_name;
      apiBody.matched_team_id = pick.team_id;
    }
    persistRow(row.row_id, patch, apiBody);
  };

  // Fallback picker (roster endpoint unavailable): reassign from a top candidate exactly as before.
  // Sets the user id + displayed username + confidence badge. Only rendered when rosterError.
  const handlePickCandidate = (row: DraftRow, value: string) => {
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
      toast.success(t("reviewTable.committed"));
      onCommitted();
    } catch (err: any) {
      const data = (err?.response?.data ?? {}) as CommitOcrError;
      // Surface the backend's blocking lists explicitly so the admin knows which names to fix.
      if (data.unresolved?.length) {
        toast.error(
          t("reviewTable.resolveFirst", { names: data.unresolved.join(", ") }),
        );
      } else if (data.unacknowledged?.length) {
        toast.error(
          t("reviewTable.acknowledgeFirst", {
            names: data.unacknowledged.join(", "),
          }),
        );
      } else {
        toast.error(data.message || t("reviewTable.commitFailed"));
      }
    } finally {
      setCommitting(false);
    }
  };

  const handleDiscard = async () => {
    setDiscarding(true);
    try {
      await ocrApi.discardOcrSession(sessionId);
      toast.success(t("reviewTable.discarded"));
      onBack();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || t("reviewTable.discardFailed"),
      );
    } finally {
      setDiscarding(false);
    }
  };

  // ── Discard confirm gate (B4 #3) ─────────────────────────────────────────────
  // Rendered once and reused from both discard triggers (empty-state + main). Only the
  // AlertDialogAction runs handleDiscard; Cancel just closes. Controlled via confirmDiscardOpen.
  const discardConfirmDialog = (
    <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("reviewTable.discardConfirmTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("reviewTable.discardConfirmDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDiscard}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {t("reviewTable.discardDraft")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

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
          {t("reviewTable.teamMismatch")}
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

  // ── Matched-player picker: fallback ──────────────────────────────────────────
  // Only rendered when the roster endpoint FAILED (rosterError). Degrades to the original
  // top_candidates-only <Select> so the row is still resolvable from the backend's best fuzzy
  // guesses. No free-text (a typed string can't link a real user) - that inert box is gone.
  const fallbackCandidateSelect = (row: DraftRow) => {
    const value =
      row.matched_user_id != null &&
      row.top_candidates.some((c) => c.user_id === row.matched_user_id)
        ? String(row.matched_user_id)
        : undefined;
    return (
      <Select value={value} onValueChange={(v) => handlePickCandidate(row, v)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={t("reviewTable.pickPlayer")} />
        </SelectTrigger>
        <SelectContent>
          {row.top_candidates.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {t("reviewTable.noSuggestions")}
            </div>
          ) : (
            row.top_candidates.map((c) => (
              <SelectItem key={c.user_id} value={String(c.user_id)}>
                {c.username} ({Math.round(c.confidence * 100)}%)
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    );
  };

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <Card className="gap-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconScan size={20} className="text-muted-foreground" />
            {t("reviewTable.emptyTitle")}
          </CardTitle>
          <CardDescription>{t("reviewTable.emptyDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
            <IconAlertTriangle className="size-4 shrink-0" />
            <span>{t("reviewTable.emptyWarning")}</span>
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={onBack}>
              {tc("back")}
            </Button>
            {/* Discard is destructive (deletes the server draft), so route it through the confirm. */}
            <Button
              variant="ghost"
              onClick={() => setConfirmDiscardOpen(true)}
              disabled={discarding}
              className="text-destructive hover:text-destructive"
            >
              {discarding ? (
                <IconLoader2 size={14} className="mr-1 animate-spin" />
              ) : (
                <IconTrash size={14} className="mr-1" />
              )}
              {t("reviewTable.discardDraft")}
            </Button>
          </div>
        </CardContent>
        {discardConfirmDialog}
      </Card>
    );
  }

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconScan size={20} className="text-muted-foreground" />
          {t("reviewTable.title")}
          {/* "Which engine answered" visibility - rendered only when the backend surfaced it. */}
          {engine ? (
            <Badge variant="outline" className="rounded-full text-xs">
              {t("reviewTable.enginePrefix", { engine })}
            </Badge>
          ) : null}
          <InfoTip id="ocr.engine" className="ml-1" />
        </CardTitle>
        <CardDescription>{t("reviewTable.description")}</CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* ── Readiness hints (mirror the backend's two commit guards) ── */}
        {(unresolvedCount > 0 || unacknowledgedCount > 0) && (
          <div className="flex flex-col gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            {unresolvedCount > 0 && (
              <span>
                {t("reviewTable.needMatchedPlayer", { count: unresolvedCount })}
              </span>
            )}
            {unacknowledgedCount > 0 && (
              <span>
                {t("reviewTable.needAcknowledging", {
                  count: unacknowledgedCount,
                })}
              </span>
            )}
          </div>
        )}

        {/* Roster fetch failed: tell the admin once why the picker degraded to suggestions only. */}
        {rosterError && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <IconAlertTriangle className="size-4 shrink-0" />
            <span>{t("reviewTable.rosterError")}</span>
          </div>
        )}

        {/* ── Review table (compact density, matches the leaderboard editor) ── */}
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-xs">
                  {t("reviewTable.colNumber")}
                </TableHead>
                <TableHead className="text-xs">
                  {t("reviewTable.colRawName")}
                </TableHead>
                <TableHead className="text-xs">
                  {t("reviewTable.colMatchedPlayer")}
                </TableHead>
                <TableHead className="w-20 text-xs">
                  {t("reviewTable.colKills")}
                </TableHead>
                <TableHead className="w-28 text-xs">
                  {t("reviewTable.colConfidence")}
                  <InfoTip id="ocr.confidence" className="ml-1" />
                </TableHead>
                <TableHead className="text-xs">
                  {t("reviewTable.colCorrectedText")}
                  <InfoTip id="ocr.corrected_text" className="ml-1" />
                </TableHead>
                <TableHead className="w-24 text-center text-xs">
                  {t("reviewTable.colAcknowledge")}
                  <InfoTip id="ocr.team_mismatch" className="ml-1" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => {
                const saving = savingRowIds.has(row.row_id);
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

                    {/* Matched player: roster-scoped searchable combobox (registered players only).
                        Three states: roster loading -> disabled spinner trigger; roster fetch
                        failed -> old top_candidates <Select> fallback; otherwise the picker. */}
                    <TableCell className="p-2">
                      {rosterError ? (
                        fallbackCandidateSelect(row)
                      ) : rosterLoading ? (
                        <Button
                          variant="outline"
                          disabled
                          className="h-8 w-full justify-start gap-2 text-xs font-normal text-muted-foreground"
                        >
                          <IconLoader2 size={14} className="animate-spin" />
                          {t("reviewTable.rosterLoading")}
                        </Button>
                      ) : (
                        <RosterMatchPicker
                          roster={roster}
                          eventType={rosterEventType}
                          topCandidates={row.top_candidates}
                          matchedUserId={row.matched_user_id}
                          matchedUsername={row.matched_username}
                          onPick={(pick) => handlePickRosterPlayer(row, pick)}
                        />
                      )}
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

                    {/* Corrected on-screen text (recognition-truth capture, training only) */}
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
                          aria-label={t("reviewTable.acknowledgeSub")}
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
            {tc("back")}
          </Button>
          <div className="flex items-center gap-2">
            {/* Discard is destructive (loses every local edit), so open the confirm gate first. */}
            <Button
              variant="ghost"
              onClick={() => setConfirmDiscardOpen(true)}
              disabled={discarding || committing}
              className="text-destructive hover:text-destructive"
            >
              {discarding ? (
                <span className="flex items-center gap-2">
                  <IconLoader2 size={14} className="animate-spin" />
                  {t("reviewTable.discarding")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <IconTrash size={14} />
                  {tc("discard")}
                </span>
              )}
            </Button>
            <Button onClick={handleCommit} disabled={!canCommit || committing}>
              {committing ? (
                <span className="flex items-center gap-2">
                  <IconLoader2 size={14} className="animate-spin" />
                  {t("reviewTable.committing")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <IconDeviceFloppy size={14} />
                  {t("reviewTable.commitResults")}
                </span>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
      {discardConfirmDialog}
    </Card>
  );
}
