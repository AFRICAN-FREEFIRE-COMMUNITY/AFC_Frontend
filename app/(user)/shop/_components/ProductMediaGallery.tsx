"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ProductMediaGallery
//
// Purpose:
//   Renders a product's media (images + videos) at FIXED dimensions with
//   object-fit so odd-sized source files always fit the layout. Generalises the
//   shop past the single diamond image: physical goods (jerseys, phones, coolers)
//   need several angles plus short demo videos.
//
// How it connects:
//   - Data comes from the backend `media` array on the product payload
//     (view_product_details / view_all_products -> ProductMedia rows), shaped as
//     { id, url, media_type: "image"|"video", ordering }.
//   - Used in two places:
//       * ProductDetailPage.tsx  -> variant="detail" (large square with thumbs)
//       * ShopClient.tsx card     -> variant="card"   (single 16:9 cover, no thumbs)
//   - Falls back to the product's primary `image`, then DEFAULT_IMAGE, when the
//     product has no gallery media yet (legacy diamond products).
//
// Design: matches AFC constants - rounded-md, bg-muted, object-cover/contain,
// no em/en dashes in any copy.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { DEFAULT_IMAGE } from "@/constants";
import { cn } from "@/lib/utils";

export interface ProductMediaItem {
  id: number;
  url: string;
  media_type: "image" | "video";
  ordering: number;
}

interface ProductMediaGalleryProps {
  media?: ProductMediaItem[] | null;
  // legacy single image used as a fallback when there is no gallery media
  fallbackImage?: string | null;
  alt: string;
  // "detail" = large square + thumbnail strip; "card" = single cover frame
  variant?: "detail" | "card";
  className?: string;
}

export function ProductMediaGallery({
  media,
  fallbackImage,
  alt,
  variant = "detail",
  className,
}: ProductMediaGalleryProps) {
  // Build the ordered list of slides. When there is no real media, synthesise a
  // single image slide from the fallback so the gallery always renders something.
  const slides = useMemo<ProductMediaItem[]>(() => {
    const real = (media ?? []).filter((m) => !!m.url);
    if (real.length > 0) return real;
    return [
      {
        id: -1,
        url: fallbackImage || DEFAULT_IMAGE,
        media_type: "image",
        ordering: 0,
      },
    ];
  }, [media, fallbackImage]);

  const [active, setActive] = useState(0);

  // Reset to the first slide whenever the slide set changes (e.g. navigating
  // between products) so we never point at a stale index.
  useEffect(() => {
    setActive(0);
  }, [slides.length]);

  const current = slides[Math.min(active, slides.length - 1)];
  const hasMultiple = slides.length > 1;

  const go = (dir: -1 | 1) => {
    setActive((prev) => {
      const next = prev + dir;
      if (next < 0) return slides.length - 1;
      if (next >= slides.length) return 0;
      return next;
    });
  };

  // Card variant: a single 16:9 cover frame (matches the old shop card image).
  // The card only ever shows the FIRST slide as a static cover (no controls) so
  // the grid stays calm; the detail page is where the full gallery lives.
  if (variant === "card") {
    const first = slides[0];
    return (
      <div className={cn("relative bg-muted aspect-video", className)}>
        {first.media_type === "video" ? (
          // Muted, non-controls preview frame; a play glyph hints it is a video.
          <>
            <video
              src={first.url}
              muted
              playsInline
              preload="metadata"
              className="object-cover size-full"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <span className="rounded-full bg-black/55 p-2">
                <Play className="h-5 w-5 text-white" />
              </span>
            </div>
          </>
        ) : (
          <Image
            src={first.url}
            alt={alt}
            height={1000}
            width={1000}
            className="object-cover aspect-video size-full"
          />
        )}
        {/* small count chip when there is more than one media item */}
        {slides.length > 1 && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
            {slides.length} media
          </span>
        )}
      </div>
    );
  }

  // Detail variant: large square stage + thumbnail strip + prev/next controls.
  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative aspect-square rounded-md overflow-hidden bg-muted">
        {current.media_type === "video" ? (
          <video
            src={current.url}
            controls
            playsInline
            className="object-contain size-full bg-black"
          />
        ) : (
          <Image
            src={current.url}
            alt={alt}
            fill
            className="object-cover"
          />
        )}

        {/* prev / next arrows only when there is more than one slide */}
        {hasMultiple && (
          <>
            <button
              type="button"
              aria-label="Previous media"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 grid place-items-center h-9 w-9 rounded-full bg-black/45 text-white hover:bg-black/65 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next media"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center h-9 w-9 rounded-full bg-black/45 text-white hover:bg-black/65 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* thumbnail strip (images show a thumb, videos show a play glyph) */}
      {hasMultiple && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {slides.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show media ${i + 1}`}
              className={cn(
                "relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden border-2 bg-muted",
                i === active
                  ? "border-primary"
                  : "border-transparent hover:border-primary/50",
              )}
            >
              {m.media_type === "video" ? (
                <div className="grid place-items-center size-full bg-black/60">
                  <Play className="h-4 w-4 text-white" />
                </div>
              ) : (
                <Image
                  src={m.url}
                  alt={`${alt} thumbnail ${i + 1}`}
                  fill
                  className="object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
