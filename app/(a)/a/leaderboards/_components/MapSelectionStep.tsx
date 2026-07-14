"use client";

// ── MapSelectionStep ───────────────────────────────────────────────────────────
// First step of the OCR review flow: the admin picks WHICH map this result is for, drops ONE
// OR MORE screenshots for that map, and uploads them for OCR. On success the returned
// session_id + (merged) draft_rows are handed up to OCRReviewTable for edit + commit.
//
// Why multiple screenshots: a single map's standings are often split across more than one
// screenshot (placements 1-6 on one screen, 7-12 on the next, or a top/bottom half). The
// backend (afc_ocr.views.upload_ocr_session) reads every uploaded screenshot, MERGES their
// placements (afc_leaderboard.ocr.merge_placements), and returns one combined draft session,
// so the admin reviews a single merged table. One screenshot still works exactly as before.
//
// Where it sits in the flow (app/(a)/a/leaderboards/[id]/edit/page.tsx Upload drawer; the
// same drawer is reused by the event editor's per-match "Upload Results" picker):
//   THIS STEP -> (uploadOcrScreenshot) -> OCRReviewTable -> (commit) -> drawer closes + refresh.
//
// Idiom: the map cards reuse MatchMethodSelectionStep's method-card grid; the dropzone +
// thumbnail grid reuse ImageUploadStep / GroupBulkUploadPanel's pattern (dropzone always
// visible so more can be added, png/jpg/webp, object-URLs revoked on remove/unmount). API
// client: lib/api/ocr.ts (ocrApi.uploadOcrScreenshot, which POSTs multipart to
// /events/ocr-match-result/ with the "screenshot" field repeated once per image). Toasts via sonner.
//
// Image validation: files are gated through lib/ocrImages.filterOcrImages (png/jpeg/webp, <=10 MB),
// the exact same contract the backend enforces in afc_ocr/services/image_validate.py, so an HEIC
// iPhone screenshot is rejected at drop time (B8) instead of failing later at Gemini.
//
// Map binding (B9): the picked map's STABLE backend id is carried end-to-end. Each map in the group
// IS its own Match, so on upload we send the selected map's match_id as match_id and its
// match_number as map_index (falling back to array position only if a map has no number). That makes
// attribution independent of the maps list order, so reordering/deleting a map cannot re-point a
// screenshot at the wrong map. The `maps` array is the group's matches passed down from edit/page.tsx.
// When there is exactly one map we pre-select it to save a click.

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  IconMap,
  IconUpload,
  IconLoader2,
  IconPhoto,
  IconX,
  IconCheck,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ocrApi, type DraftRow } from "@/lib/api/ocr";
import { filterOcrImages, OCR_ACCEPT } from "@/lib/ocrImages";

// One selectable map. Mirrors the {match_id, match_number, match_map} shape the edit page already
// hands GroupBulkUploadPanel. match_id + match_number are the stable identity used for the B9 binding.
export interface OcrMapOption {
  match_id: number;
  match_number?: number;
  match_map?: string;
}

// One queued screenshot for the selected map. `url` is an object URL for the preview, revoked
// when the item is removed or the component unmounts (avoids the blob leak ImageUploadStep guards).
interface QueuedShot {
  id: string;
  file: File;
  url: string;
}

interface Props {
  /** The match the drawer was opened from. Kept as a defensive fallback for the map binding (B9). */
  matchId: number;
  /** The group's maps, in order. Each map's own match_id/match_number drives the stable binding. */
  maps: OcrMapOption[];
  /** Hands the fresh session up to OCRReviewTable. engine is optional (backend may not surface it). */
  onSessionReady: (
    sessionId: string,
    draftRows: DraftRow[],
    engine?: string | null,
  ) => void;
  /** Back to the upload-method picker. */
  onBack: () => void;
}

export function MapSelectionStep({
  matchId,
  maps,
  onSessionReady,
  onBack,
}: Props) {
  const t = useTranslations("ocr");
  const tc = useTranslations("common");

  // The stable match_id of the map the admin picked (B9). Pre-pick the only map if there is one.
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(
    maps.length === 1 ? maps[0].match_id : null,
  );
  // The screenshots queued for this map (one OR many, all merged server-side into one draft).
  const [shots, setShots] = useState<QueuedShot[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke every queued object URL on unmount to avoid blob leaks (ImageUploadStep idiom).
  // Per-item removal revokes eagerly in removeShot; this is the unmount safety net.
  useEffect(() => {
    return () => {
      shots.forEach((s) => URL.revokeObjectURL(s.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Primary card label: the in-game map name if we have it, else its stable "Map N" number.
  const mapLabel = (m: OcrMapOption, i: number) =>
    m.match_map
      ? m.match_map
      : t("uploadSteps.mapStep.mapNumber", { n: m.match_number ?? i + 1 });

  // Append every dropped/selected image file to the queue (replaces nothing, multiple shots for
  // one map are the point). Files are gated through filterOcrImages so only png/jpeg/webp <=10 MB
  // survive; the first rejected file toasts the reason (wrong type / too big).
  const acceptFiles = (files: FileList | null) => {
    const images = filterOcrImages(files, {
      onReject: (reason) =>
        toast.error(
          reason === "size"
            ? t("uploadSteps.rejectSize")
            : t("uploadSteps.rejectType"),
        ),
    });
    if (images.length === 0) return;
    setShots((prev) => [
      ...prev,
      ...images.map((file, i) => ({
        id: `${file.name}-${file.size}-${prev.length + i}`,
        file,
        url: URL.createObjectURL(file),
      })),
    ]);
  };

  const removeShot = (id: string) =>
    setShots((prev) => {
      const gone = prev.find((s) => s.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((s) => s.id !== id);
    });

  // Upload the screenshot(s) for OCR. Builds the multipart FormData the backend expects
  // (match_id, map_index, and the "screenshot" field appended once per image), then hands the
  // resulting MERGED session up to the review table.
  const handleUpload = async () => {
    const selectedMap = maps.find((m) => m.match_id === selectedMatchId);
    // Resolve the stable binding BEFORE the guard so the fallback to the drawer's entry match is
    // type-honest (selectedMap may be undefined here); after the guard selectedMap is defined.
    const boundMatchId = selectedMap?.match_id ?? matchId;
    if (!selectedMap) {
      toast.error(t("uploadSteps.mapStep.pickMapFirst"));
      return;
    }
    if (shots.length === 0) {
      toast.error(t("uploadSteps.mapStep.addOneFirst"));
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      // B9: bind to the selected map's own Match id + its backend-assigned match_number as
      // map_index, instead of the drawer's entry match and the card's array position. Falls back
      // to array position only if a map somehow has no number.
      fd.append("match_id", String(boundMatchId));
      fd.append(
        "map_index",
        String(selectedMap.match_number ?? maps.indexOf(selectedMap) + 1),
      );
      shots.forEach((s) => fd.append("screenshot", s.file));
      const session = await ocrApi.uploadOcrScreenshot(fd);
      const rowCount = session.draft_rows?.length ?? 0;
      toast.success(
        t("uploadSteps.mapStep.readSuccess", {
          rows: rowCount,
          shots: shots.length,
        }),
      );
      onSessionReady(
        session.session_id,
        session.draft_rows ?? [],
        session.engine ?? session.teacher_model ?? null,
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || t("uploadSteps.mapStep.uploadFailed"),
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconMap size={20} className="text-muted-foreground" />
          {t("uploadSteps.mapStep.title")}
        </CardTitle>
        <CardDescription>{t("uploadSteps.mapStep.description")}</CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-6">
        {/* ── Map picker (method-card grid idiom) ── */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">
            {t("uploadSteps.mapStep.whichMap")}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {maps.map((m, i) => {
              const selected = selectedMatchId === m.match_id;
              return (
                <button
                  key={m.match_id}
                  onClick={() => setSelectedMatchId(m.match_id)}
                  className={cn(
                    "text-left rounded-lg border p-4 flex flex-col gap-2 transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/60 hover:bg-muted/30",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <IconMap
                        size={16}
                        className="text-muted-foreground shrink-0"
                      />
                      <span className="font-semibold text-sm">
                        {mapLabel(m, i)}
                      </span>
                    </span>
                    {selected && (
                      <IconCheck size={16} className="text-primary shrink-0" />
                    )}
                  </div>
                  {/* Stable map number (B9), not the array position. */}
                  <p className="text-xs text-primary">
                    {t("uploadSteps.mapStep.mapNumber", {
                      n: m.match_number ?? i + 1,
                    })}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Dropzone (always visible so more shots can be added) + thumbnail grid ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              {t("uploadSteps.mapStep.screenshotsHeading")}
            </h3>
            {shots.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {t("uploadSteps.mapStep.screenshotCount", {
                  count: shots.length,
                })}
              </span>
            )}
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              acceptFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/20",
            )}
          >
            <IconUpload size={28} className="text-muted-foreground" />
            <p className="text-sm text-center text-muted-foreground">
              {t("uploadSteps.mapStep.dropzoneTitle")}{" "}
              <span className="text-primary font-medium">
                {t("uploadSteps.mapStep.dropzoneBrowse")}
              </span>
            </p>
            <p className="text-xs text-muted-foreground text-center">
              {t("uploadSteps.mapStep.dropzoneHint")}
            </p>
          </div>

          {/* Selected screenshots, each removable (group/hover idiom from ImageUploadStep). */}
          {shots.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {shots.map((s) => (
                <div
                  key={s.id}
                  className="relative group rounded-lg overflow-hidden border aspect-video bg-muted/20"
                >
                  <img
                    src={s.url}
                    alt={s.file.name}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 text-white text-[10px] truncate">
                    {s.file.name}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeShot(s.id);
                    }}
                    className="absolute top-1.5 right-1.5 size-6 rounded-full bg-destructive/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                    aria-label={t("uploadSteps.mapStep.removeShot", {
                      name: s.file.name,
                    })}
                  >
                    <IconX size={12} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={OCR_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              acceptFiles(e.target.files);
              // Allow re-selecting the same file again later.
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />

          {maps.length === 0 && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <IconPhoto size={14} />
              {t("uploadSteps.mapStep.noMaps")}
            </p>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack} disabled={uploading}>
            {tc("back")}
          </Button>
          <Button
            onClick={handleUpload}
            disabled={uploading || shots.length === 0 || selectedMatchId === null}
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <IconLoader2 size={14} className="animate-spin" />
                {t("uploadSteps.mapStep.reading", { count: shots.length })}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <IconUpload size={14} />
                {t("uploadSteps.mapStep.uploadAndRead")}
              </span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
