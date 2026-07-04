"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PageGradient — the site-wide fixed background art (gaming pattern + green/gold
// gradient) rendered once by app/layout.tsx behind every page.
// ----------------------------------------------------------------------------
// PATH-AWARE (owner 2026-07-01): the OBS live-overlay routes (app/overlay/*) are
// broadcast graphics that must be fully transparent (see globals.css
// `html.overlay body { background: transparent }` + app/overlay/layout.tsx). So on
// any /overlay path this component renders NOTHING — otherwise the fixed gradient
// would paint over the transparent OBS Browser Source. usePathname() makes this a
// Client Component; it stays a trivial presentational node everywhere else.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { usePathname } from "next/navigation";

export const PageGradient = () => {
  const pathname = usePathname();
  // Overlay pages are transparent broadcast graphics — never paint the site gradient there.
  if (pathname?.startsWith("/overlay")) return null;

  // NOTE (owner 2026-07-04): the old `bg-[url('/gaming-pattern.png')]` layer was removed - that
  // asset does not exist (public/gaming-pattern.png -> 404 on every page load), so it painted nothing
  // while firing a broken request. Two-part banding fix so the dark gradient can never show scanline
  // noise on mobile again:
  //   (1) sRGB interpolation (`bg-linear-to-br/srgb`): Tailwind v4 defaults to OKLAB, and fading a
  //       colour THROUGH `transparent` in OKLAB passes through muddy greys that low-end mobile GPUs
  //       band. sRGB keeps the fade clean.
  //   (2) A fine DITHER layer (inline SVG feTurbulence, so it is self-contained and can NEVER 404).
  //       Sub-pixel noise at ~5% breaks the smooth colour steps so no 8-bit/mobile GPU can render
  //       them as visible bands - the standard cure for gradient banding. `mix-blend-overlay` keeps
  //       it invisible as texture while still dithering.
  return (
    <div>
      <div className="fixed inset-0 bg-linear-to-br/srgb from-primary/20 via-transparent to-gold/20 pointer-events-none"></div>
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      ></div>
    </div>
  );
};
