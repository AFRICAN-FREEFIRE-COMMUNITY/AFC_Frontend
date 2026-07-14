"use client";

// ── OcrBatchDialog (Phase 2.6) ────────────────────────────────────────────────
// The multi-map, multi-image screenshot reader for the standalone-leaderboard wizard. It replaces the
// old single-image OcrUploadDialog: the admin builds several MAP cards, attaches ONE OR MORE screenshots
// to each, then reads them in the BACKGROUND so the request can never time out (a Gemini read is
// 12-26s; the old synchronous read died on prod's ~30s request cap).
//
// FLOW (per the owner's ask "select maps, upload multiple images for each, run one by one or as a group"):
//   1. Add a map card -> drop 1+ screenshots on it (and name it).
//   2. "Read" that map (one by one) OR "Read all maps" (a group, processed in parallel by Celery).
//      Each map's job is created server-side (ocrJobCreate) then enqueued (ocrJobRun / ocrRunAll).
//   3. The dialog POLLS ocrJobList every few seconds; each map shows pending -> processing -> done.
//   4. When a map is done, its merged review rows render in an OcrReviewTable; the admin corrects matches
//      and presses "Apply this map", which writes one map + participants + results (ocrJobApply) and
//      merges them into the wizard via onApplied. Apply is per map (review before applying); the "group"
//      part is the READING, which is what takes time.
//
// HOW IT CONNECTS: ParticipantsStep renders this behind "Upload screenshots" and passes leaderboardId +
// format. Each apply calls onApplied(result); the wizard (create/page.tsx) merges the returned
// participants + match into its state.
//
// i18n (B3): all user-facing copy lives under the `ocr` namespace, group `stdBatch` (author English
// only; `pnpm i18n:translate` fills fr/pt). Generic verbs (Done / Cancel / Remove / Retry) come from the
// shared `ocr.common.*` group. Reference via `t = useTranslations("ocr")` -> `t("stdBatch.*")`.
//
// SAFETY (B4 #5): removing a map can delete a SERVER OCR job (ocrJobDelete) and lose read/applied
// results, so the trash button stages a pending target and an AlertDialog confirm gates the delete. The
// per-screenshot removeFile (local URL.revokeObjectURL only) needs no confirm.
//
// VALIDATION (B8): image uploads are filtered by the shared `filterOcrImages` helper (lib/ocrImages),
// which rejects non-PNG/JPG/WEBP and files over 10 MB (toasting the first offending reason). The file
// input's accept attribute is aligned to the same `OCR_ACCEPT` contract.
//
// DESIGN: AFC constants - rounded-md cards, text-xs, outline rounded-full badges, dropzone idiom from
// MapSelectionStep. No em/en dashes anywhere.

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// AlertDialog gates the destructive server DELETE (B4 #5): removing a map hits ocrJobDelete and loses any
// results already read for it, so the trash button only stages `confirmRemoveId` and the actual removal
// runs solely from AlertDialogAction.
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconLoader2,
  IconUpload,
  IconX,
  IconScan,
  IconPlus,
  IconTrash,
  IconPhoto,
  IconAlertTriangle,
  IconPlayerPlay,
  IconReload,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
// Shared client image contract (B8): OCR_ACCEPT is the input accept string; filterOcrImages keeps only
// allowed mimes (PNG/JPG/WEBP) that are <= 10 MB and toasts the first rejected reason. Owned by the
// FE-uploadsteps agent (lib/ocrImages.ts) and shared with MapSelectionStep / ImageUploadStep.
import { filterOcrImages, OCR_ACCEPT } from "@/lib/ocrImages";
import {
  standaloneLeaderboardsApi,
  type LeaderboardFormat,
  type OcrExtractRow,
  type OcrApplyRow,
  type OcrApplyResponse,
  type OcrJob,
  type OcrJobStatus,
} from "@/lib/standaloneLeaderboards";
import { OcrReviewTable, type OcrScoring } from "./OcrReviewTable";

// The six Free Fire battle-royale maps. The admin SELECTS a map (no typing) and may pick the same map on
// as many cards as they want (e.g. two matches both played on Bermuda). The chosen name is sent as the
// match_map label for the created LeaderboardMatch. Keep in sync if Garena adds/renames a BR map.
// Exported for ResultFileDialog (the "upload result file" option uses the same map picker).
export const FF_MAPS = ["Bermuda", "Nexterra", "Alpine", "Purgatory", "Kalahari", "Solara"] as const;

// One map card's local state. "draft" = staged locally with no server job yet; after a read it carries a
// server jobId + the job status. `rows` arrives from the poll once the job is done.
type MapStatus = "draft" | OcrJobStatus;
interface MapEntry {
  localId: string;
  label: string;
  files: File[]; // staged screenshots (cleared once the job is created server-side)
  previews: string[]; // object URLs for thumbnails (kept for display)
  jobId: string | null;
  status: MapStatus;
  rows: OcrExtractRow[] | null;
  engine: string;
  error: string;
  imageCount: number;
  applying: boolean;
  applied: boolean;
}

let _seq = 0;
const newMap = (): MapEntry => ({
  localId: `m${++_seq}`,
  label: "",
  files: [],
  previews: [],
  jobId: null,
  status: "draft",
  rows: null,
  engine: "",
  error: "",
  imageCount: 0,
  applying: false,
  applied: false,
});

// Status chip per map (mirrors the AFC outline-badge idiom). Labels come from the `ocr` namespace
// (`stdBatch.status.*`); this is its own component so it can call the translations hook cleanly.
function StatusChip({ status }: { status: MapStatus }) {
  const t = useTranslations("ocr");
  const meta: Record<MapStatus, { key: string; cls: string; spin?: boolean }> = {
    draft: { key: "status.notRead", cls: "border-muted-foreground text-muted-foreground" },
    pending: { key: "status.queued", cls: "border-blue-500 text-blue-600", spin: true },
    processing: { key: "status.reading", cls: "border-blue-500 text-blue-600", spin: true },
    done: { key: "status.read", cls: "border-green-500 text-green-600" },
    failed: { key: "status.failed", cls: "border-destructive text-destructive" },
    applied: { key: "status.applied", cls: "border-green-500 text-green-600" },
  };
  const s = meta[status];
  return (
    <Badge variant="outline" className={cn("rounded-full px-2 py-0.5 text-xs", s.cls)}>
      {s.spin && <IconLoader2 size={11} className="mr-1 animate-spin" />}
      {t(`stdBatch.${s.key}`)}
    </Badge>
  );
}

export function OcrBatchDialog({
  open,
  onOpenChange,
  leaderboardId,
  format,
  scoring,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaderboardId: number;
  format: LeaderboardFormat;
  // The leaderboard's scoring config, forwarded to each map's OcrReviewTable for its per-row
  // Points preview (placement points + kills * kill point). Optional.
  scoring?: OcrScoring;
  // Fired after EACH map is applied. The wizard merges result.participants + result.match (see
  // ParticipantsStep / create/page.tsx). The dialog stays open so the admin can apply more maps.
  onApplied: (result: OcrApplyResponse) => void;
}) {
  // `ocr` namespace, group `stdBatch`; `t("common.*")` reaches the shared generic verbs.
  const t = useTranslations("ocr");
  const [maps, setMaps] = useState<MapEntry[]>([newMap()]);
  const [polling, setPolling] = useState(false);
  const [busyAll, setBusyAll] = useState(false); // "Read all" in-flight (creating jobs)
  // Pending remove-map target: non-null opens the confirm dialog; only AlertDialogAction runs the actual
  // removal (which may delete the server OCR job). B4 #5.
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Ref mirror so the poll loop reads current jobIds without re-subscribing each render.
  const mapsRef = useRef(maps);
  useEffect(() => {
    mapsRef.current = maps;
  }, [maps]);

  const update = useCallback((localId: string, patch: Partial<MapEntry>) => {
    setMaps((prev) => prev.map((m) => (m.localId === localId ? { ...m, ...patch } : m)));
  }, []);

  // Reset everything when the dialog closes (revoke object URLs first).
  useEffect(() => {
    if (!open) {
      mapsRef.current.forEach((m) => m.previews.forEach((u) => URL.revokeObjectURL(u)));
      setMaps([newMap()]);
      setPolling(false);
      setBusyAll(false);
      setConfirmRemoveId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Poll the jobs while any of ours is pending/processing. ──────────────────
  const refreshJobs = useCallback(async () => {
    try {
      const { jobs } = await standaloneLeaderboardsApi.ocrJobList(leaderboardId);
      const byId = new Map<string, OcrJob>(jobs.map((j) => [j.id, j]));
      setMaps((prev) =>
        prev.map((m) => {
          if (!m.jobId) return m;
          const j = byId.get(m.jobId);
          if (!j) return m;
          return {
            ...m,
            status: m.applied ? "applied" : (j.status as MapStatus),
            rows: j.rows,
            engine: j.engine,
            error: j.error,
            imageCount: j.image_count,
          };
        }),
      );
      const ourIds = new Set(mapsRef.current.map((m) => m.jobId).filter(Boolean) as string[]);
      const busy = jobs.some(
        (j) => ourIds.has(j.id) && (j.status === "pending" || j.status === "processing"),
      );
      setPolling(busy);
    } catch {
      // Transient poll failure: keep the interval; the next tick retries.
    }
  }, [leaderboardId]);

  useEffect(() => {
    if (!polling) return;
    const iv = setInterval(refreshJobs, 2500);
    return () => clearInterval(iv);
  }, [polling, refreshJobs]);

  // ── File handling per map ───────────────────────────────────────────────────
  const addFiles = (localId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    // B8: validate types + size against the shared OCR contract. The helper toasts the first rejected
    // reason (via our stdBatch keys) and returns only the accepted files; an empty result means every
    // file was rejected and the reason was already surfaced.
    const imgs = filterOcrImages(files, {
      onReject: (reason) =>
        toast.error(reason === "type" ? t("stdBatch.rejectType") : t("stdBatch.rejectSize")),
    });
    if (imgs.length === 0) return;
    setMaps((prev) =>
      prev.map((m) =>
        m.localId === localId
          ? {
              ...m,
              files: [...m.files, ...imgs],
              previews: [...m.previews, ...imgs.map((f) => URL.createObjectURL(f))],
            }
          : m,
      ),
    );
  };

  // Local-only removal of a single staged screenshot (revoke its object URL). No server call, so no
  // confirm is needed (B4 #5 excludes this).
  const removeFile = (localId: string, idx: number) => {
    setMaps((prev) =>
      prev.map((m) => {
        if (m.localId !== localId) return m;
        const previews = [...m.previews];
        const [gone] = previews.splice(idx, 1);
        if (gone) URL.revokeObjectURL(gone);
        const files = [...m.files];
        files.splice(idx, 1);
        return { ...m, files, previews };
      }),
    );
  };

  const addMap = () => setMaps((prev) => [...prev, newMap()]);

  // Actual map removal: best-effort server cleanup (ocrJobDelete) + local teardown (revoke URLs, drop the
  // card). Called only after the AlertDialog confirm resolves, or directly for an empty draft card that
  // has nothing to lose.
  const performRemoveMap = (localId: string) => {
    const m = mapsRef.current.find((x) => x.localId === localId);
    if (m?.jobId) {
      // Best-effort server cleanup; ignore failure (the row is leaving the UI either way).
      standaloneLeaderboardsApi.ocrJobDelete(leaderboardId, m.jobId).catch(() => {});
    }
    m?.previews.forEach((u) => URL.revokeObjectURL(u));
    setMaps((prev) => {
      const next = prev.filter((x) => x.localId !== localId);
      return next.length ? next : [newMap()]; // always keep at least one card
    });
  };

  // Trash-button handler (B4 #5). A card with a server job OR staged screenshots has something to lose, so
  // route it through the confirm dialog. A truly empty draft card removes immediately.
  const requestRemoveMap = (localId: string) => {
    const m = mapsRef.current.find((x) => x.localId === localId);
    const hasSomethingToLose = Boolean(m?.jobId) || (m?.previews.length ?? 0) > 0;
    if (hasSomethingToLose) {
      setConfirmRemoveId(localId);
    } else {
      performRemoveMap(localId);
    }
  };

  // Create the server job for a map if it does not have one yet. Returns the jobId (or null on failure).
  const ensureJob = async (m: MapEntry): Promise<string | null> => {
    if (m.jobId) return m.jobId;
    if (m.files.length === 0) return null;
    const { job } = await standaloneLeaderboardsApi.ocrJobCreate(
      leaderboardId,
      m.files,
      m.label.trim() || undefined,
    );
    update(m.localId, {
      jobId: job.id,
      status: "pending",
      imageCount: job.image_count,
      files: [], // the bytes now live server-side; keep the previews for display
    });
    return job.id;
  };

  // ── Read one map ────────────────────────────────────────────────────────────
  const readMap = async (localId: string) => {
    const m = mapsRef.current.find((x) => x.localId === localId);
    if (!m) return;
    if (m.status === "pending" || m.status === "processing") return;
    if (!m.jobId && m.files.length === 0) {
      toast.error(t("stdBatch.addOneShotFirst"));
      return;
    }
    try {
      const jobId = await ensureJob(m);
      if (!jobId) return;
      await standaloneLeaderboardsApi.ocrJobRun(leaderboardId, jobId);
      update(localId, { status: "processing", error: "" });
      setPolling(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("stdBatch.couldNotStartMap"));
    }
  };

  // ── Read all maps (group, parallel) ─────────────────────────────────────────
  const readAll = async () => {
    const candidates = mapsRef.current.filter(
      (m) => (m.jobId && (m.status === "failed" || m.status === "pending")) || m.files.length > 0,
    );
    if (candidates.length === 0) {
      toast.error(t("stdBatch.addShotsToOneMap"));
      return;
    }
    setBusyAll(true);
    try {
      // Create any missing jobs first (so run-all has something to enqueue for the new maps).
      for (const m of candidates) {
        if (!m.jobId && m.files.length > 0) {
          // eslint-disable-next-line no-await-in-loop
          await ensureJob(m);
        }
      }
      const { queued } = await standaloneLeaderboardsApi.ocrRunAll(leaderboardId);
      toast.success(t("stdBatch.readingInBackground", { count: queued }));
      setPolling(true);
      // Reflect the enqueue immediately, then let polling take over.
      setMaps((prev) =>
        prev.map((m) =>
          m.jobId && (m.status === "pending" || m.status === "failed")
            ? { ...m, status: "processing", error: "" }
            : m,
        ),
      );
      refreshJobs();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("stdBatch.couldNotStartMaps"));
    } finally {
      setBusyAll(false);
    }
  };

  // ── Apply one map's reviewed rows ───────────────────────────────────────────
  const applyMap = async (localId: string, applyRows: OcrApplyRow[]) => {
    const m = mapsRef.current.find((x) => x.localId === localId);
    if (!m?.jobId) return;
    update(localId, { applying: true });
    try {
      const result = await standaloneLeaderboardsApi.ocrJobApply(leaderboardId, m.jobId, {
        rows: applyRows,
        match_map: m.label.trim() || undefined,
      });
      const label = m.label.trim() || t("stdBatch.mapFallback");
      toast.success(t("stdBatch.appliedMap", { label, count: applyRows.length }));
      onApplied(result);
      update(localId, { applying: false, applied: true, status: "applied" });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("stdBatch.failedApply"));
      update(localId, { applying: false });
    }
  };

  const anyBusy = polling || busyAll;
  const readableCount = maps.filter((m) => m.files.length > 0 || m.status === "failed").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Wide dialog: the review table gained Points + per-player panels (2026-06-12), so 5xl started
          clipping the match column behind a horizontal scrollbar. 95vw capped at 7xl keeps every
          column visible on a laptop while still fitting small screens. */}
      <DialogContent className="w-[95vw] sm:max-w-7xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconScan size={18} className="text-muted-foreground" />
            {t("stdBatch.title")}
          </DialogTitle>
          <DialogDescription>{t("stdBatch.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {maps.map((m, i) => (
            <div key={m.localId} className="space-y-3 rounded-md border p-4">
              {/* Card header: label + status + remove */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label className="sr-only">{t("stdBatch.mapSrLabel")}</Label>
                  {/* Pick one of the six FF maps (no typing). The same map may be chosen on multiple
                      cards (two matches on Bermuda is fine). Optional: an unset map just leaves the
                      created match unnamed. */}
                  <Select
                    value={m.label || undefined}
                    onValueChange={(v) => update(m.localId, { label: v })}
                    disabled={m.applied}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder={t("stdBatch.selectMapPlaceholder", { num: i + 1 })} />
                    </SelectTrigger>
                    <SelectContent>
                      {FF_MAPS.map((mp) => (
                        <SelectItem key={mp} value={mp}>
                          {mp}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <StatusChip status={m.status} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => requestRemoveMap(m.localId)}
                  aria-label={t("stdBatch.removeMapAria")}
                >
                  <IconTrash size={15} />
                </Button>
              </div>

              {/* Thumbnails (staged or read) */}
              {m.previews.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {m.previews.map((src, idx) => (
                    <div
                      key={src}
                      className="relative h-16 w-24 overflow-hidden rounded-md border bg-muted/20"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={t("stdBatch.shotAlt", { mapNum: i + 1, shotNum: idx + 1 })}
                        className="h-full w-full object-cover"
                      />
                      {m.status === "draft" && (
                        <button
                          type="button"
                          onClick={() => removeFile(m.localId, idx)}
                          className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-destructive/90 opacity-90 hover:bg-destructive"
                          aria-label={t("stdBatch.removeShotAria")}
                        >
                          <IconX size={11} className="text-white" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Per-status body */}
              {m.status === "draft" && (
                <div className="space-y-2">
                  <label
                    className={cn(
                      "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed px-4 py-5 text-center transition-colors",
                      "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/20",
                    )}
                  >
                    <IconPhoto size={22} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {m.previews.length > 0 ? t("stdBatch.dropAddMore") : t("stdBatch.dropFirst")}
                    </span>
                    <input
                      type="file"
                      accept={OCR_ACCEPT}
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        addFiles(m.localId, e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => readMap(m.localId)}
                      disabled={m.files.length === 0}
                    >
                      <IconPlayerPlay size={14} className="mr-1" />
                      {t("stdBatch.readThisMap")}
                    </Button>
                  </div>
                </div>
              )}

              {(m.status === "pending" || m.status === "processing") && (
                <div className="flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                  <IconLoader2 size={14} className="animate-spin" />
                  {t("stdBatch.readingStatus", { count: m.imageCount })}
                </div>
              )}

              {m.status === "failed" && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <IconAlertTriangle className="size-4 shrink-0" />
                    <span>{m.error || t("stdBatch.couldNotReadMap")}</span>
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" size="sm" variant="outline" onClick={() => readMap(m.localId)}>
                      <IconReload size={14} className="mr-1" />
                      {t("common.retry")}
                    </Button>
                  </div>
                </div>
              )}

              {(m.status === "done" || m.status === "applied") && m.rows && (
                <OcrReviewTable
                  key={m.jobId ?? m.localId}
                  format={format}
                  rows={m.rows}
                  applied={m.applied}
                  applying={m.applying}
                  scoring={scoring}
                  onApply={(applyRows) => applyMap(m.localId, applyRows)}
                />
              )}
            </div>
          ))}

          {/* Add another map */}
          <Button type="button" variant="outline" size="sm" onClick={addMap}>
            <IconPlus size={14} className="mr-1" />
            {t("stdBatch.addAnotherMap")}
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.done")}
          </Button>
          <Button type="button" onClick={readAll} disabled={anyBusy || readableCount === 0}>
            {busyAll ? (
              <span className="flex items-center gap-2">
                <IconLoader2 size={14} className="animate-spin" />
                {t("stdBatch.starting")}
              </span>
            ) : polling ? (
              <span className="flex items-center gap-2">
                <IconLoader2 size={14} className="animate-spin" />
                {t("stdBatch.readingMaps")}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <IconUpload size={14} />
                {t("stdBatch.readAllMaps")}
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* ── Confirm before removing a map (B4 #5) ── the trash button only stages `confirmRemoveId`; the
          removal (which may delete the server OCR job via ocrJobDelete) runs solely from
          AlertDialogAction. onOpenChange clears the target on dismiss. */}
      <AlertDialog
        open={confirmRemoveId !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmRemoveId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("stdBatch.removeMapConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("stdBatch.removeMapConfirm.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (confirmRemoveId) performRemoveMap(confirmRemoveId);
                setConfirmRemoveId(null);
              }}
            >
              {t("common.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
