"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  IconUpload,
  IconPhoto,
  IconX,
  IconLoader2,
  IconTrash,
  IconRefresh,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MatchImage {
  image_id: number;
  image_url: string;
  created_at?: string;
}

interface Props {
  match: { match_id: number; match_name: string };
  onNext: () => void;
  onBack: () => void;
}

export function ImageUploadStep({ match, onNext, onBack }: Props) {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [existingImages, setExistingImages] = useState<MatchImage[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingImages, setLoadingImages] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [uploading, startUpload] = useTransition();

  const matchId = match?.match_id;

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
        toast.error(data.message || "Failed to load images");
      }
    } catch {
      toast.error("Failed to load images");
    } finally {
      setLoadingImages(false);
    }
  }, [matchId, token]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (newFiles.length === 0) {
      toast.error("Only image files are allowed");
      return;
    }
    setPendingFiles((prev) => [...prev, ...newFiles]);
  };

  const removePending = (idx: number) => {
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
      pendingFiles.forEach((f) => formData.append("images", f));

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
          toast.success("Images uploaded successfully");
          setPendingFiles([]);
          if (fileInputRef.current) fileInputRef.current.value = "";
          fetchImages();
        } else {
          toast.error(data.message || "Upload failed");
        }
      } catch {
        toast.error("An unexpected error occurred");
      }
    });
  };

  const handleDelete = async (imageId: number) => {
    setDeletingId(imageId);
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/delete/match-result-image/`,
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
        toast.success("Image deleted");
        setExistingImages((prev) => prev.filter((img) => img.image_id !== imageId));
      } else {
        toast.error(data.message || "Failed to delete image");
      }
    } catch {
      toast.error("Failed to delete image");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle>{match?.match_name ?? "Match"}: Image Upload</CardTitle>
        <CardDescription>
          Upload screenshots of match results. Existing images are shown below.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-6">
        {/* Existing images */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Uploaded Images
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
            >
              <IconRefresh size={14} className={loadingImages ? "animate-spin" : ""} />
            </Button>
          </div>

          {loadingImages ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <IconLoader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading images…</span>
            </div>
          ) : existingImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed text-muted-foreground gap-2">
              <IconPhoto size={28} className="opacity-40" />
              <p className="text-sm">No images uploaded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {existingImages.map((img) => (
                <div
                  key={img.image_id}
                  className="relative group rounded-lg overflow-hidden border aspect-video bg-muted/20"
                >
                  <img
                    src={img.image_url}
                    alt="Match result"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => handleDelete(img.image_id)}
                    disabled={deletingId === img.image_id}
                    className="absolute top-1.5 right-1.5 size-6 rounded-full bg-destructive/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                  >
                    {deletingId === img.image_id ? (
                      <IconLoader2 size={12} className="animate-spin text-white" />
                    ) : (
                      <IconTrash size={12} className="text-white" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dropzone */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Add New Images</h3>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/20",
            )}
          >
            <IconUpload size={28} className="text-muted-foreground" />
            <p className="text-sm text-center text-muted-foreground">
              Drag & drop images here, or{" "}
              <span className="text-primary font-medium">click to browse</span>
            </p>
            <p className="text-xs text-muted-foreground">PNG, JPG, WEBP supported</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />

          {/* Pending files list */}
          {pendingFiles.length > 0 && (
            <div className="space-y-2">
              {pendingFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded-lg border bg-muted/20"
                >
                  <IconPhoto size={16} className="text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1 truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removePending(idx); }}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <IconX size={14} />
                  </button>
                </div>
              ))}

              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full"
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <IconLoader2 size={14} className="animate-spin" />
                    Uploading…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <IconUpload size={14} />
                    Upload {pendingFiles.length} Image{pendingFiles.length !== 1 ? "s" : ""}
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button
            onClick={onNext}
            disabled={existingImages.length === 0 && pendingFiles.length === 0}
          >
            Done
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
