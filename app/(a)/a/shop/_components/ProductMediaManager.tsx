"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ProductMediaManager  (admin)
//
// Purpose:
//   Lets an admin attach MANY images + videos to an existing product, and remove
//   them. This is the multi-media half of the shop generalisation: physical
//   goods need several angles plus short demo clips.
//
// How it connects:
//   - Uploads multipart to POST /shop/add-product-media/ (field name `files`,
//     accepts multiple). Removes via POST /shop/delete-product-media/.
//     Both are admin-gated (Bearer token from useAuth).
//   - The media list is passed in via `media` (from view-product-details) and
//     refreshed by calling `onChanged` after every upload/delete, so the parent
//     re-fetches and re-renders the gallery.
//   - Client-side size caps mirror the backend (images <= 5 MB, videos <= 50 MB)
//     so oversized files are rejected before upload; the backend re-checks.
//   - Used on the edit product page (/a/shop/inventory/[id]). For the *Add*
//     flow, AddProductModal uploads queued files right after the product is
//     created (the product id does not exist before then).
//
// Design: matches AFC admin idioms (cards rounded-md, outline badges, sonner
// toasts). No em/en dashes in any copy.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import Image from "next/image";
import { IconPhotoPlus, IconTrash, IconVideo } from "@tabler/icons-react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { SHOP_MAX_IMAGE_BYTES, SHOP_MAX_VIDEO_BYTES } from "@/constants";

export interface ProductMediaItem {
  id: number;
  url: string;
  media_type: "image" | "video";
  ordering: number;
}

interface ProductMediaManagerProps {
  productId: number;
  media: ProductMediaItem[];
  // called after a successful upload or delete so the parent re-fetches media
  onChanged: () => void;
  // Endpoints to hit. Default to the ADMIN media routes (back-compat for the admin
  // edit-product page). The VENDOR product form passes the vendor-gated routes
  // (/shop/vendor/products/media/{add,delete}/) so a vendor can build the SAME gallery
  // on their own draft/rejected product. Both contracts are identical (multipart
  // product_id + files[] to upload; JSON { media_id } to delete).
  uploadUrl?: string;
  deleteUrl?: string;
}

export function ProductMediaManager({
  productId,
  media,
  onChanged,
  uploadUrl = "/shop/add-product-media/",
  deleteUrl = "/shop/delete-product-media/",
}: ProductMediaManagerProps) {
  const { token } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Validate each file against the matching size cap before sending.
  const validateFiles = (files: File[]): string | null => {
    for (const f of files) {
      const isImage = f.type.startsWith("image/");
      const isVideo = f.type.startsWith("video/");
      if (!isImage && !isVideo) {
        return `${f.name}: only images and videos are allowed.`;
      }
      if (isImage && f.size > SHOP_MAX_IMAGE_BYTES) {
        return `${f.name}: image exceeds the 5 MB limit.`;
      }
      if (isVideo && f.size > SHOP_MAX_VIDEO_BYTES) {
        return `${f.name}: video exceeds the 50 MB limit.`;
      }
    }
    return null;
  };

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // reset the input so picking the same file again still fires onChange
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0) return;

    const errorMsg = validateFiles(files);
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }

    try {
      setIsUploading(true);
      const fd = new FormData();
      fd.append("product_id", String(productId));
      files.forEach((f) => fd.append("files", f));

      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}${uploadUrl}`,
        fd,
        // No explicit Content-Type: axios sets the multipart boundary itself.
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(
        files.length > 1 ? `${files.length} files uploaded` : "Media uploaded",
      );
      onChanged();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to upload media");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (mediaId: number) => {
    try {
      setDeletingId(mediaId);
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}${deleteUrl}`,
        { media_id: mediaId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Media removed");
      onChanged();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to remove media");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {media.length} item{media.length === 1 ? "" : "s"}. Images up to 5 MB,
          videos up to 50 MB.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <IconPhotoPlus className="h-4 w-4" />
          )}
          Upload media
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handleSelect}
        />
      </div>

      {media.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No media yet. Upload images and videos to build a gallery.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {media.map((m) => (
            <div
              key={m.id}
              className="relative aspect-square rounded-md overflow-hidden border bg-muted group"
            >
              {m.media_type === "video" ? (
                <div className="relative size-full">
                  <video
                    src={m.url}
                    muted
                    preload="metadata"
                    className="object-cover size-full"
                  />
                  <span className="absolute bottom-1 left-1 rounded-full bg-black/55 p-1">
                    <IconVideo className="h-3 w-3 text-white" />
                  </span>
                </div>
              ) : (
                <Image
                  src={m.url}
                  alt="Product media"
                  fill
                  className="object-cover"
                />
              )}

              {/* delete button (top-right) */}
              <button
                type="button"
                onClick={() => handleDelete(m.id)}
                disabled={deletingId === m.id}
                aria-label="Remove media"
                className="absolute right-1 top-1 grid place-items-center h-6 w-6 rounded-full bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
              >
                {deletingId === m.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <IconTrash className="h-3 w-3" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
