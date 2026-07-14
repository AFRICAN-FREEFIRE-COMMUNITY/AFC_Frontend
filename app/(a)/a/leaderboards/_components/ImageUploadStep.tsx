"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
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
  IconUpload,
  IconPhoto,
  IconX,
  IconLoader2,
  IconTrash,
  IconRefresh,
  IconScan,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
// Centralized OCR contract (lib/api/ocr.ts). The extract handler below hits ocrApi.ocrFromStoredImage
// (POST /events/ocr-from-image/) instead of a hand-rolled fetch, and the returned session is handed
// to OCRReviewTable for in-place edit + commit (replacing the old read-only preview dialog).
import { ocrApi, type DraftRow } from "@/lib/api/ocr";
import { OCRReviewTable } from "./OCRReviewTable";
// Shared client image gate (png/jpeg/webp, <=10 MB) matching the backend contract in
// afc_ocr/services/image_validate.py, so an HEIC iPhone screenshot is rejected at drop time (B8).
import { filterOcrImages, OCR_ACCEPT } from "@/lib/ocrImages";

interface MatchImage {
  image_id: number;
  image_url: string;
  uploaded_by?: string;
  uploaded_at?: string;
}

interface PendingFile {
  file: File;
  preview: string;
}

// The OCR session this step handed off to the inline review table. Holds everything
// OCRReviewTable needs (session_id + draft_rows + the engine that answered, if surfaced).
interface ReviewSession {
  sessionId: string;
  draftRows: DraftRow[];
  engine?: string | null;
}

interface Props {
  match: { match_id: number; match_name: string };
  onNext: () => void;
  onBack: () => void;
}

export function ImageUploadStep({ match, onNext, onBack }: Props) {
  const t = useTranslations("ocr");
  const tc = useTranslations("common");
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [existingImages, setExistingImages] = useState<MatchImage[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingImages, setLoadingImages] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [extractingId, setExtractingId] = useState<number | null>(null);
  // The stored image the admin asked to permanently delete (B4#4). While non-null the AlertDialog
  // confirm is open; the actual server DELETE only fires once they confirm.
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  // The session under review (null = still on the upload list). When set, the inline
  // OCRReviewTable takes over so the admin can edit + commit without leaving this step.
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null);
  const [uploading, startUpload] = useTransition();

  const matchId = match?.match_id;

  // Revoke object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      pendingFiles.forEach(({ preview }) => URL.revokeObjectURL(preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchImages = useCallback(async () => {
    if (!matchId) return;
    setLoadingImages(true);
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-match-result-images/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ match_id: matchId }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        setExistingImages(data.images ?? []);
      } else {
        toast.error(data.message || t("uploadSteps.imageStep.loadFailed"));
      }
    } catch {
      toast.error(t("uploadSteps.imageStep.loadFailed"));
    } finally {
      setLoadingImages(false);
    }
  }, [matchId, token, t]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Gate new files through the shared OCR image validator (png/jpeg/webp, <=10 MB). The first
  // rejected file toasts the reason (wrong type / too big); the rest are dropped silently (B8).
  const addFiles = (files: FileList | null) => {
    const images = filterOcrImages(files, {
      onReject: (reason) =>
        toast.error(
          reason === "size"
            ? t("uploadSteps.rejectSize")
            : t("uploadSteps.rejectType"),
        ),
    });
    if (images.length === 0) return;
    setPendingFiles((prev) => [
      ...prev,
      ...images.map((f) => ({ file: f, preview: URL.createObjectURL(f) })),
    ]);
  };

  const removePending = (idx: number) => {
    URL.revokeObjectURL(pendingFiles[idx].preview);
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleUpload = () => {
    if (pendingFiles.length === 0 || !matchId) return;

    startUpload(async () => {
      const formData = new FormData();
      formData.append("match_id", String(matchId));
      pendingFiles.forEach(({ file }) => formData.append("images", file));

      try {
        const res = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/upload-match-result-image/`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          },
        );
        const data = await res.json();
        if (res.ok) {
          toast.success(t("uploadSteps.imageStep.uploadSuccess"));
          pendingFiles.forEach(({ preview }) => URL.revokeObjectURL(preview));
          setPendingFiles([]);
          if (fileInputRef.current) fileInputRef.current.value = "";
          fetchImages();
        } else {
          toast.error(data.message || t("uploadSteps.imageStep.uploadFailed"));
        }
      } catch {
        toast.error(t("uploadSteps.imageStep.unexpectedError"));
      }
    });
  };

  // Permanent server delete of a stored screenshot. Gated behind the AlertDialog confirm below
  // (B4#4) since it cannot be undone; only fires after the admin confirms.
  const handleDelete = async (imageId: number) => {
    setDeletingId(imageId);
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/delete-match-result-image/`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ image_id: String(imageId) }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(t("uploadSteps.imageStep.imageDeleted"));
        setExistingImages((prev) =>
          prev.filter((img) => img.image_id !== imageId),
        );
      } else {
        toast.error(data.message || t("uploadSteps.imageStep.deleteFailed"));
      }
    } catch {
      toast.error(t("uploadSteps.imageStep.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  };

  // Re-run OCR on an already-uploaded image. Goes through the centralized OCR client
  // (ocrApi.ocrFromStoredImage -> POST /events/ocr-from-image/) and hands the resulting session to
  // the inline OCRReviewTable for edit + commit, instead of the old read-only preview dialog.
  // B9 caveat: mapIndex here is the image's POSITION in existingImages, not a stable per-image map
  // id. The get-match-result-images response carries no stable map_index/order field, so position
  // is the only signal available on this surface; if the backend later adds a stable per-image map
  // number, thread it here instead of idx + 1. (The primary screenshot -> review path is the
  // stable-bound MapSelectionStep flow; this re-extract path is the secondary one.)
  const handleExtract = async (img: MatchImage, mapIndex: number) => {
    if (!matchId) return;
    setExtractingId(img.image_id);
    try {
      const session = await ocrApi.ocrFromStoredImage({
        image_id: img.image_id,
        match_id: matchId,
        map_index: mapIndex,
      });
      toast.success(
        t("uploadSteps.imageStep.extractSuccess", {
          count: session.draft_rows?.length ?? 0,
        }),
      );
      setReviewSession({
        sessionId: session.session_id,
        draftRows: session.draft_rows ?? [],
        engine: session.engine ?? session.teacher_model ?? null,
      });
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || t("uploadSteps.imageStep.extractFailed"),
      );
    } finally {
      setExtractingId(null);
    }
  };

  // ── Inline review ────────────────────────────────────────────────────────────
  // Once an image is extracted, the OCRReviewTable takes over this step so the admin edits +
  // commits in place (the old version told them to commit elsewhere with the session id). On
  // commit we bubble up via onNext (the parent closes the drawer + refreshes); on back we drop the
  // session and return to the image list.
  if (reviewSession) {
    return (
      <OCRReviewTable
        sessionId={reviewSession.sessionId}
        draftRows={reviewSession.draftRows}
        matchId={match.match_id}
        engine={reviewSession.engine}
        onCommitted={onNext}
        onBack={() => setReviewSession(null)}
      />
    );
  }

  return (
    <>
      <Card className="gap-0">
        <CardHeader>
          <CardTitle>
            {t("uploadSteps.imageStep.title", {
              match: match?.match_name ?? t("uploadSteps.imageStep.matchFallback"),
            })}
          </CardTitle>
          <CardDescription>
            {t("uploadSteps.imageStep.description")}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-6">
          {/* ── Uploaded images ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">
                {t("uploadSteps.imageStep.uploadedImages")}
                {existingImages.length > 0 && (
                  <span className="ml-2 text-muted-foreground">
                    ({existingImages.length})
                  </span>
                )}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchImages}
                disabled={loadingImages}
                aria-label={tc("refresh")}
              >
                <IconRefresh
                  size={14}
                  className={loadingImages ? "animate-spin" : ""}
                />
              </Button>
            </div>

            {loadingImages ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <IconLoader2 size={18} className="animate-spin" />
                <span className="text-sm">
                  {t("uploadSteps.imageStep.loadingImages")}
                </span>
              </div>
            ) : existingImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed text-muted-foreground gap-2">
                <IconPhoto size={28} className="opacity-40" />
                <p className="text-sm">{t("uploadSteps.imageStep.noImages")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {existingImages.map((img, idx) => (
                  <div
                    key={img.image_id}
                    className="relative group rounded-lg overflow-hidden border aspect-video bg-muted/20"
                  >
                    <img
                      src={img.image_url}
                      alt={t("uploadSteps.imageStep.imageAlt", { n: idx + 1 })}
                      className="w-full h-full object-cover"
                    />

                    {/* Map index label (positional, see B9 caveat on handleExtract) */}
                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/60 text-white">
                      {t("uploadSteps.imageStep.mapLabel", { n: idx + 1 })}
                    </div>

                    {/* Extracting overlay */}
                    {extractingId === img.image_id && (
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1.5">
                        <IconLoader2
                          size={22}
                          className="animate-spin text-white"
                        />
                        <span className="text-xs text-white font-medium">
                          {t("uploadSteps.imageStep.extracting")}
                        </span>
                      </div>
                    )}

                    {/* Action buttons - visible on hover */}
                    {extractingId !== img.image_id && (
                      <>
                        {/* Extract button */}
                        <button
                          onClick={() => handleExtract(img, idx + 1)}
                          title={t("uploadSteps.imageStep.extractTitle")}
                          className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/90 text-primary-foreground text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary"
                        >
                          <IconScan size={11} />
                          {t("uploadSteps.imageStep.extract")}
                        </button>

                        {/* Delete button (opens the confirm dialog, does not delete directly) */}
                        <button
                          onClick={() => setConfirmDeleteId(img.image_id)}
                          disabled={deletingId === img.image_id}
                          title={t("uploadSteps.imageStep.deleteTitle")}
                          className="absolute top-1.5 right-1.5 size-6 rounded-full bg-destructive/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                        >
                          {deletingId === img.image_id ? (
                            <IconLoader2
                              size={12}
                              className="animate-spin text-white"
                            />
                          ) : (
                            <IconTrash size={12} className="text-white" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Drop zone ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">
              {t("uploadSteps.imageStep.addNewImages")}
            </h3>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
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
                {t("uploadSteps.imageStep.dropzoneTitle")}{" "}
                <span className="text-primary font-medium">
                  {t("uploadSteps.imageStep.dropzoneBrowse")}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {t("uploadSteps.imageStep.dropzoneHint")}
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={OCR_ACCEPT}
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />

            {/* Pending files with thumbnail preview */}
            {pendingFiles.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {pendingFiles.map(({ file, preview }, idx) => (
                    <div
                      key={idx}
                      className="relative group rounded-lg overflow-hidden border aspect-video bg-muted/20"
                    >
                      <img
                        src={preview}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 text-white text-[10px] truncate">
                        {file.name}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removePending(idx);
                        }}
                        aria-label={t("uploadSteps.imageStep.removePending", {
                          name: file.name,
                        })}
                        className="absolute top-1.5 right-1.5 size-6 rounded-full bg-destructive/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                      >
                        <IconX size={12} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full"
                >
                  {uploading ? (
                    <span className="flex items-center gap-2">
                      <IconLoader2 size={14} className="animate-spin" />
                      {t("uploadSteps.imageStep.uploading")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <IconUpload size={14} />
                      {t("uploadSteps.imageStep.uploadCount", {
                        count: pendingFiles.length,
                      })}
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={onBack}>
              {tc("back")}
            </Button>
            <Button
              onClick={onNext}
              disabled={existingImages.length === 0 && pendingFiles.length === 0}
            >
              {tc("done")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Delete-screenshot confirm (B4#4) ──────────────────────────────────────
          The stored-image delete is a permanent server DELETE, so it is gated here. Local pending
          removals (removePending) revoke an object URL only and need no confirm. */}
      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("uploadSteps.imageStep.deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("uploadSteps.imageStep.deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (confirmDeleteId !== null) handleDelete(confirmDeleteId);
                setConfirmDeleteId(null);
              }}
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
