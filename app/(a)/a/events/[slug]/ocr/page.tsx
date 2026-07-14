// ─────────────────────────────────────────────────────────────────────────────
// Admin › Events › [slug] › OCR  (rebuilt 2026-07-14, spec tasks/ocr-remediation-2026-07-14.md A1/B1).
//
// WHAT THIS PAGE DOES
//   The single admin surface for reading match-result screenshots into an event's
//   leaderboard. Two halves:
//     1. A NEW OCR READ flow (upload card + right-side drawer): pick which map the
//        result is for, drop one or more screenshots, review the auto-extracted rows,
//        and commit them. This is the SAME working stepper the leaderboard editor's
//        "Upload Results" drawer uses (app/(a)/a/leaderboards/[id]/edit/page.tsx):
//        MapSelectionStep -> OCRReviewTable -> commit.
//     2. A resumable SESSIONS LIST (top card): every OCRSession already read for this
//        event, with its real status, so an admin can resume a draft, commit it, or
//        discard it.
//
// WHY THE REBUILD (the old page was fully broken, spec A1/B1):
//   - it POSTed the wrong upload fields, but the backend needs match_id + map_index +
//     screenshot[] (upload_ocr_session);
//   - its review dialog read response fields the detail GET never returns (it returns
//     draft_rows only);
//   - its Commit was gated on a status the OCRSession model never emits;
//   - it rendered raw dates and hardcoded English.
//   This rewrite drops ALL of that and reuses the proven components + ocrApi client.
//
// HOW IT CONNECTS (data + endpoints)
//   - Event structure (stages -> groups -> maps) + numeric event_id:
//       POST /events/get-event-details/  { slug }   (afc_tournament_and_scrims.views
//       .get_event_details) -> res.data.event_details. Each match in a group IS one map
//       ({match_id, match_number, match_map}); results committed by OCR are keyed on the
//       match (afc_ocr.services.commit keys TournamentTeamMatchStats on match, not on
//       map_index), so the picked match_id is where the results land.
//   - Sessions list / review / commit / discard: lib/api/ocr.ts (ocrApi), all under the
//       /events/ prefix (afc_ocr.views): listOcrSessions (admin ?event_id= filter, O4),
//       getOcrSession, commitOcrSession, discardOcrSession.
//   - Upload + review UI: MapSelectionStep + OCRReviewTable (a/leaderboards/_components),
//       reused verbatim. Times render via <LocalTime> (viewer timezone, i18n hard rule).
//
// i18n: admin is IN scope (owner override, memory feedback_admin_i18n_now_in_scope).
//   Every user-facing string is a next-intl key under the "ocr" namespace, group
//   "adminPage" (this file's assigned group); generic verbs come from the shared
//   "common" group. English lives in messages/en/ocr.json (merged by the orchestrator).
//
// Tour anchors (admin-tour-steps.ts pageKey events-lb-ocr) that MUST stay in the DOM:
//   data-tour="ocr-title" (header), "ocr-upload" (upload card), "ocr-review"
//   (sessions card), "ocr-commit" (the Actions column that hosts the per-row Commit).
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/PageHeader";
import { LocalTime } from "@/components/LocalTime";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  IconCheck,
  IconLoader2,
  IconPlus,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
// The proven OCR stepper + editable review table, reused verbatim from the leaderboard editor.
import { MapSelectionStep } from "../../../leaderboards/_components/MapSelectionStep";
import { OCRReviewTable } from "../../../leaderboards/_components/OCRReviewTable";
// Typed OCR client (auth via the auth_token cookie, so callers don't thread a token).
import { ocrApi, type DraftRow, type OcrSession } from "@/lib/api/ocr";

type Params = { slug: string };

// One row of GET /events/ocr-sessions/ (afc_ocr.views.list_ocr_sessions). The list
// shape carries created_by + no draft_rows; the Review action re-fetches the detail
// (getOcrSession) which adds draft_rows for the editable table.
interface OcrSessionRow {
  session_id: string;
  match_id: number;
  map_index: number;
  event_type: "solo" | "team";
  status: "pending_review" | "committed" | "discarded";
  created_by?: string;
  created_at: string;
}

// One selectable map, flattened from the event structure. Each Match in a BR/solo group
// IS a map (match_map), and the picked match_id is where OCR results are committed.
interface MapOption {
  matchId: number;
  matchNumber?: number;
  matchMap?: string;
  stageName: string;
  groupName: string;
}

// The three REAL OCRSession statuses (afc_ocr/models.py STATUS_CHOICES). Outline badge
// per AFC design constants (rounded-full, px-2 py-0.5 text-xs); colour by status only.
const STATUS_STYLES: Record<string, string> = {
  pending_review: "text-yellow-600 border-yellow-500/50",
  committed: "text-green-600 border-green-500/50",
  discarded: "text-red-600 border-red-500/50",
};

export default function AdminEventOcrPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = use(params);
  const { token } = useAuth();
  // i18n: admin surface, namespace "ocr", this file's group "adminPage".
  const t = useTranslations("ocr");

  // ── Event structure (stages -> groups -> maps) + numeric event_id ─────────────
  const [loadingStructure, setLoadingStructure] = useState(true);
  const [structureError, setStructureError] = useState(false);
  const [eventId, setEventId] = useState<number | null>(null);
  const [eventName, setEventName] = useState<string>("");
  const [mapOptions, setMapOptions] = useState<MapOption[]>([]);
  // Every match_id in the event, used to scope the sessions list client-side (belt-and-
  // braces on top of the admin ?event_id= backend filter).
  const [eventMatchIds, setEventMatchIds] = useState<Set<number>>(new Set());

  // ── Sessions list ─────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<OcrSessionRow[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState(false);

  // ── New-read drawer (match picker -> MapSelectionStep -> OCRReviewTable) ───────
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pickedMatchId, setPickedMatchId] = useState<number | null>(null);
  const [uploadDraft, setUploadDraft] = useState<{
    sessionId: string;
    draftRows: DraftRow[];
    engine?: string | null;
  } | null>(null);

  // ── Review drawer (resume an existing session in the editable table) ───────────
  const [reviewSession, setReviewSession] = useState<OcrSession | null>(null);
  const [openingReviewId, setOpeningReviewId] = useState<string | null>(null);

  // ── Per-row commit / discard state ────────────────────────────────────────────
  const [committingId, setCommittingId] = useState<string | null>(null);
  const [discardTargetId, setDiscardTargetId] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);

  // ── 1) Load the event structure ───────────────────────────────────────────────
  // POST /events/get-event-details/ { slug } is the SAME loader the admin event-detail
  // page uses; res.data.event_details carries event_id + stages[].groups[].matches[].
  // We flatten every group's matches into the map picker (skipping Clash-Squad stages,
  // which enter results on the bracket, not via BR OCR) and collect every match_id.
  const fetchStructure = useCallback(async () => {
    if (!slug || !token) return;
    setLoadingStructure(true);
    setStructureError(false);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
        { slug },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const details = res.data?.event_details;
      if (!details) {
        setStructureError(true);
        return;
      }
      setEventId(details.event_id ?? null);
      setEventName(details.event_name ?? slug);

      const opts: MapOption[] = [];
      const ids = new Set<number>();
      for (const stage of details.stages ?? []) {
        const isCs = String(stage.stage_format || "").startsWith("cs -");
        for (const group of stage.groups ?? []) {
          for (const match of group.matches ?? []) {
            // Track every match_id for session scoping regardless of stage format.
            if (typeof match.match_id === "number") ids.add(match.match_id);
            // Only BR/solo maps are OCR-eligible in the picker.
            if (isCs) continue;
            opts.push({
              matchId: match.match_id,
              matchNumber: match.match_number,
              matchMap: match.match_map,
              stageName: stage.stage_name,
              groupName: group.group_name,
            });
          }
        }
      }
      setMapOptions(opts);
      setEventMatchIds(ids);
    } catch {
      setStructureError(true);
    } finally {
      setLoadingStructure(false);
    }
  }, [slug, token]);

  useEffect(() => {
    fetchStructure();
  }, [fetchStructure]);

  // ── 2) Load the sessions list, scoped to this event ───────────────────────────
  // ocrApi.listOcrSessions passes ?event_id= (admin filter, spec O4). We ALSO filter
  // client-side by the event's match_ids so the list stays correct even if the backend
  // filter is not live yet. event_id is not in the client's typed params, so we widen it.
  const fetchSessions = useCallback(async () => {
    if (!token || eventId == null) return;
    setLoadingSessions(true);
    setSessionsError(false);
    try {
      const rows = await ocrApi.listOcrSessions({
        event_id: eventId,
      } as { match_id?: number });
      const scoped = (rows ?? []).filter(
        (r: OcrSessionRow) =>
          eventMatchIds.size === 0 || eventMatchIds.has(r.match_id),
      );
      setSessions(scoped as OcrSessionRow[]);
    } catch {
      setSessionsError(true);
      toast.error(t("adminPage.sessions.loadError"));
    } finally {
      setLoadingSessions(false);
    }
  }, [token, eventId, eventMatchIds, t]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // ── New-read drawer helpers ───────────────────────────────────────────────────
  const openUpload = () => {
    setPickedMatchId(null);
    setUploadDraft(null);
    setUploadOpen(true);
  };

  const closeUpload = () => {
    setUploadOpen(false);
    setPickedMatchId(null);
    setUploadDraft(null);
  };

  const pickedMatch = useMemo(
    () => mapOptions.find((m) => m.matchId === pickedMatchId) ?? null,
    [mapOptions, pickedMatchId],
  );

  // ── Review an existing session ────────────────────────────────────────────────
  // GET /events/ocr-session/<id>/ hydrates draft_rows + match_id + engine for the
  // editable OCRReviewTable, then we open it in a drawer.
  const handleReview = async (sessionId: string) => {
    setOpeningReviewId(sessionId);
    try {
      const detail = await ocrApi.getOcrSession(sessionId);
      setReviewSession(detail);
    } catch {
      toast.error(t("adminPage.reviewDrawer.loadError"));
    } finally {
      setOpeningReviewId(null);
    }
  };

  // ── Quick-commit from the list (only offered while status is pending_review) ───
  // POST /events/ocr-session/<id>/commit/ with no body commits the session's stored
  // draft_rows. A 400 names the rows that still block the write, so we point the admin
  // at Review to fix them there.
  const handleCommit = async (sessionId: string) => {
    setCommittingId(sessionId);
    try {
      await ocrApi.commitOcrSession(sessionId);
      toast.success(t("adminPage.commit.success"));
      fetchSessions();
    } catch (err: any) {
      const data = err?.response?.data ?? {};
      if (data.unresolved?.length) {
        toast.error(
          t("adminPage.commit.unresolved", {
            names: data.unresolved.join(", "),
          }),
        );
      } else if (data.unacknowledged?.length) {
        toast.error(
          t("adminPage.commit.unacknowledged", {
            names: data.unacknowledged.join(", "),
          }),
        );
      } else {
        toast.error(data.message || t("adminPage.commit.error"));
      }
    } finally {
      setCommittingId(null);
    }
  };

  // ── Discard (soft): DELETE /events/ocr-session/<id>/ sets status="discarded" ────
  const handleDiscardConfirm = async () => {
    if (!discardTargetId) return;
    setDiscarding(true);
    try {
      await ocrApi.discardOcrSession(discardTargetId);
      toast.success(t("adminPage.discard.success"));
      setDiscardTargetId(null);
      fetchSessions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("adminPage.discard.error"));
    } finally {
      setDiscarding(false);
    }
  };

  // ── Small label helpers (translated, with safe fallbacks) ─────────────────────
  const statusLabel = (status: string) =>
    ["pending_review", "committed", "discarded"].includes(status)
      ? t(`adminPage.status.${status}` as any)
      : status;

  const typeLabel = (eventType: string) =>
    eventType === "solo" || eventType === "team"
      ? t(`adminPage.type.${eventType}` as any)
      : eventType;

  const mapOptionLabel = (m: MapOption) => {
    const mapName =
      m.matchMap ||
      t("adminPage.mapLabel", { index: m.matchNumber ?? m.matchId });
    // Middle dot separator (not a dash) keeps the compound label readable.
    return `${m.stageName} · ${m.groupName} · ${mapName}`;
  };

  return (
    <div className="space-y-4">
      {/* ── Header (data-tour="ocr-title": tour "OCR screenshot extraction" step) ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span data-tour="ocr-title" className="inline-flex">
          <PageHeader
            back
            title={t("adminPage.title")}
            description={t("adminPage.description", {
              event: eventName || slug,
            })}
          />
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchSessions}
          disabled={loadingSessions || eventId == null}
        >
          <IconRefresh className="h-4 w-4 mr-1.5" />
          {t("common.refresh")}
        </Button>
      </div>

      {/* ── Upload card (data-tour="ocr-upload": tour "Upload screenshot" step) ──── */}
      <Card data-tour="ocr-upload">
        <CardHeader>
          <CardTitle className="text-base">
            {t("adminPage.upload.title")}
          </CardTitle>
          <CardDescription>{t("adminPage.upload.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStructure ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconLoader2 className="h-4 w-4 animate-spin" />
              {t("common.loading")}
            </div>
          ) : structureError ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {t("adminPage.structure.loadError")}
              </p>
              <Button size="sm" variant="outline" onClick={fetchStructure}>
                {t("common.retry")}
              </Button>
            </div>
          ) : mapOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("adminPage.upload.noStructure")}
            </p>
          ) : (
            <Button onClick={openUpload}>
              <IconPlus className="h-4 w-4 mr-1.5" />
              {t("adminPage.upload.cta")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Sessions list (data-tour="ocr-review": tour "Review extracted data" step) ── */}
      <Card data-tour="ocr-review">
        <CardHeader>
          <CardTitle className="text-base">
            {t("adminPage.sessions.title")}
          </CardTitle>
          <CardDescription>
            {t("adminPage.sessions.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Table scrolls inside its own container on small screens (no page overflow). */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-10 text-xs text-foreground">
                    {t("adminPage.table.session")}
                  </TableHead>
                  <TableHead className="h-10 text-xs text-foreground">
                    {t("adminPage.table.map")}
                  </TableHead>
                  <TableHead className="h-10 text-xs text-foreground">
                    {t("adminPage.table.type")}
                  </TableHead>
                  <TableHead className="h-10 text-xs text-foreground">
                    {t("adminPage.table.status")}
                  </TableHead>
                  <TableHead className="h-10 text-xs text-foreground">
                    {t("adminPage.table.uploadedBy")}
                  </TableHead>
                  <TableHead className="h-10 text-xs text-foreground">
                    {t("adminPage.table.created")}
                  </TableHead>
                  {/* data-tour="ocr-commit": tour "Commit OCR data" step. The per-row Commit
                      button lives in this Actions column; the header is its stable anchor. */}
                  <TableHead
                    data-tour="ocr-commit"
                    className="h-10 text-xs text-foreground text-right"
                  >
                    {t("adminPage.table.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSessions ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : sessionsError ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      <span className="mr-3">
                        {t("adminPage.sessions.loadError")}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={fetchSessions}
                      >
                        {t("common.retry")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : sessions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      {t("adminPage.sessions.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((session) => {
                    const isPending = session.status === "pending_review";
                    return (
                      <TableRow key={session.session_id}>
                        <TableCell className="p-2 font-mono text-xs">
                          {session.session_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="p-2 text-xs">
                          {t("adminPage.mapLabel", { index: session.map_index })}
                        </TableCell>
                        <TableCell className="p-2">
                          <Badge
                            variant="outline"
                            className="rounded-full px-2 py-0.5 text-xs"
                          >
                            {typeLabel(session.event_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="p-2">
                          <Badge
                            variant="outline"
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              STATUS_STYLES[session.status] ?? ""
                            }`}
                          >
                            {statusLabel(session.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="p-2 text-xs text-muted-foreground">
                          {session.created_by || "-"}
                        </TableCell>
                        <TableCell className="p-2 text-xs text-muted-foreground">
                          {/* Viewer-timezone render (i18n hard rule) - never a raw toLocale*. */}
                          {session.created_at ? (
                            <LocalTime value={session.created_at} />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="p-2">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReview(session.session_id)}
                              disabled={openingReviewId === session.session_id}
                            >
                              {openingReviewId === session.session_id ? (
                                <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              {t("adminPage.review")}
                            </Button>
                            {/* Commit only while the draft is still reviewable. */}
                            {isPending && (
                              <Button
                                size="sm"
                                onClick={() => handleCommit(session.session_id)}
                                disabled={committingId === session.session_id}
                              >
                                {committingId === session.session_id ? (
                                  <IconLoader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                ) : (
                                  <IconCheck className="h-3.5 w-3.5 mr-1" />
                                )}
                                {committingId === session.session_id
                                  ? t("adminPage.committing")
                                  : t("adminPage.commit.action")}
                              </Button>
                            )}
                            {/* Discard the draft (soft, sets status="discarded"). */}
                            {isPending && (
                              <Button
                                size="icon"
                                variant="destructive"
                                aria-label={t("adminPage.discard.aria")}
                                onClick={() =>
                                  setDiscardTargetId(session.session_id)
                                }
                              >
                                <IconTrash className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── New-read drawer: match picker -> MapSelectionStep -> OCRReviewTable ──── */}
      <Sheet
        open={uploadOpen}
        onOpenChange={(o) => (o ? setUploadOpen(true) : closeUpload())}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 sm:max-w-2xl"
        >
          <SheetHeader className="p-6 pb-0">
            <SheetTitle>{t("adminPage.drawer.title")}</SheetTitle>
            <SheetDescription>
              {t("adminPage.drawer.description")}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 p-6">
            {/* Step 1: pick the map this result is for (no match picked yet). */}
            {!pickedMatch && (
              <Card className="gap-0">
                <CardHeader>
                  <CardTitle className="text-base">
                    {t("adminPage.picker.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("adminPage.picker.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <Select
                    value={
                      pickedMatchId != null ? String(pickedMatchId) : undefined
                    }
                    onValueChange={(v) => setPickedMatchId(Number(v))}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue
                        placeholder={t("adminPage.picker.placeholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {mapOptions.map((m) => (
                        <SelectItem key={m.matchId} value={String(m.matchId)}>
                          {mapOptionLabel(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}

            {/* Step 2: drop screenshots for the picked map. matchId is the picked match
                (results commit to it); maps is that single map so map_index stays aligned
                with the chosen match. onSessionReady hands the draft to the review table. */}
            {pickedMatch && !uploadDraft && (
              <MapSelectionStep
                matchId={pickedMatch.matchId}
                maps={[
                  {
                    match_id: pickedMatch.matchId,
                    match_number: pickedMatch.matchNumber,
                    match_map: pickedMatch.matchMap,
                  },
                ]}
                onSessionReady={(sessionId, draftRows, engine) =>
                  setUploadDraft({ sessionId, draftRows, engine })
                }
                onBack={() => setPickedMatchId(null)}
              />
            )}

            {/* Step 3: review + commit the extracted rows. onCommitted closes the drawer
                and refreshes the sessions list; onBack returns to the upload step. */}
            {pickedMatch && uploadDraft && (
              <OCRReviewTable
                sessionId={uploadDraft.sessionId}
                draftRows={uploadDraft.draftRows}
                matchId={pickedMatch.matchId}
                engine={uploadDraft.engine}
                onCommitted={() => {
                  closeUpload();
                  fetchSessions();
                }}
                onBack={() => setUploadDraft(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Review drawer: resume an existing session in the editable table ──────── */}
      <Sheet
        open={!!reviewSession}
        onOpenChange={(o) => {
          if (!o) setReviewSession(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 sm:max-w-2xl"
        >
          <SheetHeader className="p-6 pb-0">
            <SheetTitle>{t("adminPage.reviewDrawer.title")}</SheetTitle>
            <SheetDescription>
              {t("adminPage.reviewDrawer.description")}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-6">
            {reviewSession && (
              <OCRReviewTable
                sessionId={reviewSession.session_id}
                draftRows={reviewSession.draft_rows ?? []}
                matchId={reviewSession.match_id ?? 0}
                engine={reviewSession.engine ?? reviewSession.teacher_model}
                onCommitted={() => {
                  setReviewSession(null);
                  fetchSessions();
                }}
                onBack={() => setReviewSession(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Discard confirmation (destructive, spec B4#1) ───────────────────────── */}
      <AlertDialog
        open={!!discardTargetId}
        onOpenChange={(o) => {
          if (!o) setDiscardTargetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("adminPage.discard.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("adminPage.discard.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={discarding}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Keep the dialog controlled by discardTargetId; run the async discard.
                e.preventDefault();
                handleDiscardConfirm();
              }}
              disabled={discarding}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {discarding ? (
                <IconLoader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : null}
              {t("common.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
