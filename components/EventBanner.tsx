"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EventBanner: an event's banner picture, or, when the event has none or the picture fails to load,
// the event's own name drawn on an AFC surface.
//
// Apple design fix 4 (owner approved the mockup 24 Oct 2026, inbox #381; mockup
// mockups/apple-design-fixes/ section 4). Before this, every banner-less event showed DEFAULT_IMAGE
// (constants/index.ts), a grey picture with "600 x 400" printed on it, so a card without art said
// nothing about the event. An uploaded banner shows exactly as before.
//
// Callers: the tournaments list card (app/(user)/tournaments/page.tsx), the event page
// (tournaments/[slug]/_components/EventDetailsWrapper.tsx), the organization page's event cards
// (organizations/[slug]/page.tsx) and the admin + organizer event pages. They pass the banner URL
// their endpoint returns (event_banner / event_banner_url / banner) and the event name; `kind` is the
// event's competition_type ("tournament" | "scrims") where the endpoint returns it.
//
// The broken-URL case matters as much as the empty one: a non-empty banner that 404s or is hotlink
// blocked used to be swapped for DEFAULT_IMAGE in onError by the admin and organizer pages. It now
// falls back to the same surface on every page.
// ─────────────────────────────────────────────────────────────────────────────

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

type Props = {
  src?: string | null;
  name: string;
  /** competition_type from the event endpoints; anything else shows no label. */
  kind?: string | null;
  /** card: list cards. hero: the big banner at the top of an event page. */
  size?: "card" | "hero";
  alt?: string;
  /** Classes for the picture AND the fallback surface (shape, radius, aspect). */
  className?: string;
};

export function EventBanner({ src, name, kind, size = "card", alt, className }: Props) {
  const t = useTranslations("common");
  // Set by onError: a banner URL that does not load falls back like an empty one.
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <Image
        src={src}
        alt={alt || name}
        width={1000}
        height={1000}
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }

  const kindLabel = kind === "tournament" || kind === "scrims" ? t(`eventKind.${kind}`) : null;

  // ── fallback: the AFC mark top left, the kind label and the name bottom left, on a dark green
  // surface that warms toward gold (the site's own two brand colours, flat enough to read on). ──
  return (
    <div
      role="img"
      aria-label={alt || name}
      className={cn(
        "flex flex-col justify-between bg-[linear-gradient(160deg,oklch(0.30_0.06_149.09),oklch(0.18_0.02_149.09)_60%,oklch(0.20_0.03_83.63))] text-white",
        size === "hero" ? "p-5 md:p-8" : "p-4",
        className,
      )}
    >
      <Logo size="small" className={size === "hero" ? "md:size-14" : ""} />
      <div className="min-w-0">
        {kindLabel && (
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gold">{kindLabel}</div>
        )}
        <div
          className={cn(
            "font-bold tracking-[-0.01em] line-clamp-3 max-w-[90%] break-words",
            size === "hero" ? "text-xl md:text-4xl leading-[1.1]" : "text-lg leading-[1.2]",
          )}
        >
          {name}
        </div>
      </div>
    </div>
  );
}
