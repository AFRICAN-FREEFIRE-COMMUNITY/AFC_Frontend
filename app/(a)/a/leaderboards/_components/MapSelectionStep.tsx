"use client";

// ── MapSelectionStep ───────────────────────────────────────────────────────────
// First step of the OCR review flow: the admin picks WHICH map (1-indexed map_index)
// this screenshot belongs to, drops the screenshot, and uploads it for OCR. On success
// the returned session_id + draft_rows are handed up to OCRReviewTable for edit + commit.
//
// Where it sits in the flow (app/(a)/a/leaderboards/[id]/edit/page.tsx Upload drawer):
//   THIS STEP -> (uploadOcrScreenshot) -> OCRReviewTable -> (commit) -> drawer closes + refresh.
//
// Idiom: the map cards reuse MatchMethodSelectionStep's method-card grid; the dropzone reuses
// ImageUploadStep / GroupBulkUploadPanel's dashed-dropzone pattern (drag + click, png/jpg/webp,
// object-URL preview revoked on replace). API client: lib/api/ocr.ts (ocrApi.uploadOcrScreenshot,
// which POSTs multipart to /events/ocr-match-result/). Toasts via sonner.
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
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke the object URL when the preview changes / on unmount to avoid leaks (ImageUploadStep idiom).
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const mapLabel = (m: OcrMapOption, i: number) =>
    m.match_map
      ? `${m.match_map}`
      : `Map ${m.match_number ?? i + 1}`;

  // Accept the first image file (png/jpg/webp); replace any previous preview.
  const acceptFile = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = Array.from(files).find((x) => x.type.startsWith("image/"));
    if (!f) {
      toast.error("Only image files are allowed (PNG, JPG, WEBP)");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clearFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Upload the screenshot for OCR. Builds the multipart FormData the backend expects
  // (match_id, map_index, screenshot) and hands the resulting session up to the review table.
  const handleUpload = async () => {
    if (!mapIndex) {
      toast.error("Pick which map this screenshot is for first.");
      return;
    }
    if (!file) {
      toast.error("Add a screenshot to upload.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("match_id", String(matchId));
      fd.append("map_index", String(mapIndex));
      fd.append("screenshot", file);
      const session = await ocrApi.uploadOcrScreenshot(fd);
      toast.success(
        `Read ${session.draft_rows?.length ?? 0} row${
          (session.draft_rows?.length ?? 0) !== 1 ? "s" : ""
        } from the screenshot`,
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
          Pick which map this result screenshot is for, then drop it in to read
          it with OCR.
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

        {/* ── Dropzone (ImageUploadStep / GroupBulkUploadPanel idiom) ── */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Result screenshot</h3>

          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                acceptFile(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/20",
              )}
            >
              <IconUpload size={28} className="text-muted-foreground" />
              <p className="text-sm text-center text-muted-foreground">
                Drag & drop a screenshot here, or{" "}
                <span className="text-primary font-medium">click to browse</span>
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, WEBP supported
              </p>
            </div>
          ) : (
            // Single-file preview with a remove affordance (group/hover idiom from ImageUploadStep).
            <div className="relative group rounded-lg overflow-hidden border aspect-video bg-muted/20 max-w-md">
              {/* Object-URL preview of the chosen screenshot. */}
              {preview && (
                <img
                  src={preview}
                  alt={file.name}
                  className="w-full h-full object-contain"
                />
              )}
              <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 text-white text-[10px] truncate">
                {file.name}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                className="absolute top-1.5 right-1.5 size-6 rounded-full bg-destructive/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                aria-label="Remove screenshot"
              >
                <IconX size={12} className="text-white" />
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={(e) => acceptFile(e.target.files)}
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
            disabled={uploading || !file || !mapIndex}
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <IconLoader2 size={14} className="animate-spin" />
                Reading screenshot…
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
