"use client";

// ── MapSelectionStep ───────────────────────────────────────────────────────────
// First step of the OCR review flow: the admin picks WHICH map (1-indexed map_index)
// this result is for, drops ONE OR MORE screenshots for that map, and uploads them for
// OCR. On success the returned session_id + (merged) draft_rows are handed up to
// OCRReviewTable for edit + commit.
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
// The `maps` array is the group's matches passed down from edit/page.tsx. Map index is 1-based and
// derived from each map's position in that array (matching how ImageUploadStep labels Map 1..N),
// so it lines up with the backend's map_index (1-indexed). When there is exactly one map we
// pre-select it to save a click.

import { useEffect, useRef, useState } from "react";
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

// One selectable map. Mirrors the {match_id, match_number, match_map} shape the edit page already
// hands GroupBulkUploadPanel; only match_map (+ a 1-based index) is needed for the label here.
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
  /** The match these maps belong to (afc_ocr OCR is gated per match_id). */
  matchId: number;
  /** The group's maps, in order. Position drives the 1-indexed map_index sent to the backend. */
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
  // 1-indexed map_index the admin picked (the backend expects 1-based). Pre-pick the only map.
  const [mapIndex, setMapIndex] = useState<number | null>(
    maps.length === 1 ? 1 : null,
  );
  // The screenshots queued for this map (one OR many — all merged server-side into one draft).
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

  const mapLabel = (m: OcrMapOption, i: number) =>
    m.match_map ? `${m.match_map}` : `Map ${m.match_number ?? i + 1}`;

  // Append every dropped/selected image file to the queue (replaces nothing — multiple shots
  // for one map are the point). Non-image files are rejected with a toast.
  const acceptFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      toast.error("Only image files are allowed (PNG, JPG, WEBP)");
      return;
    }
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
    if (!mapIndex) {
      toast.error("Pick which map these screenshots are for first.");
      return;
    }
    if (shots.length === 0) {
      toast.error("Add at least one screenshot to upload.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("match_id", String(matchId));
      fd.append("map_index", String(mapIndex));
      shots.forEach((s) => fd.append("screenshot", s.file));
      const session = await ocrApi.uploadOcrScreenshot(fd);
      const rowCount = session.draft_rows?.length ?? 0;
      toast.success(
        `Read ${rowCount} row${rowCount !== 1 ? "s" : ""} from ${shots.length} screenshot${
          shots.length !== 1 ? "s" : ""
        }`,
      );
      onSessionReady(
        session.session_id,
        session.draft_rows ?? [],
        session.engine ?? session.teacher_model ?? null,
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "OCR upload failed. Try again.",
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
          Select Map and Upload Screenshot
        </CardTitle>
        <CardDescription>
          Pick which map this result is for, then drop in one or more screenshots to read
          them with OCR.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-6">
        {/* ── Map picker (method-card grid idiom) ── */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Which map is this for?</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {maps.map((m, i) => {
              const idx = i + 1; // 1-based map_index
              const selected = mapIndex === idx;
              return (
                <button
                  key={m.match_id}
                  onClick={() => setMapIndex(idx)}
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
                  <p className="text-xs text-primary">Map {idx}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Dropzone (always visible so more shots can be added) + thumbnail grid ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Result screenshots</h3>
            {shots.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {shots.length} screenshot{shots.length !== 1 ? "s" : ""} for this map
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
              Drag &amp; drop one or more screenshots here, or{" "}
              <span className="text-primary font-medium">click to browse</span>
            </p>
            <p className="text-xs text-muted-foreground text-center">
              PNG, JPG, WEBP. Add several when a map&apos;s standings span more than one
              screenshot, they are merged into one result.
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
                    aria-label={`Remove ${s.file.name}`}
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
            accept="image/png,image/jpeg,image/jpg,image/webp"
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
              No maps found for this match.
            </p>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack} disabled={uploading}>
            Back
          </Button>
          <Button
            onClick={handleUpload}
            disabled={uploading || shots.length === 0 || !mapIndex}
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <IconLoader2 size={14} className="animate-spin" />
                Reading screenshot{shots.length !== 1 ? "s" : ""}…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <IconUpload size={14} />
                Upload and read
              </span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
