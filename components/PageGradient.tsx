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
  // asset does not exist (public/gaming-pattern.png -> 404 on every page load), so the layer painted
  // nothing while firing a broken request. The gradient interpolation is pinned to sRGB
  // (`bg-linear-to-br/srgb`): Tailwind v4's default is OKLAB, and fading a colour THROUGH
  // `transparent` in OKLAB passes through muddy desaturated greys that low-end mobile GPUs render as
  // visible banding/noise over the dark background (a user reported scanline noise on mobile - though
  // that screenshot was also WhatsApp-JPEG-compressed, which alone mangles dark gradients). sRGB
  // interpolation keeps the fade-to-transparent clean.
  return (
    <div>
      <div className="fixed inset-0 bg-linear-to-br/srgb from-primary/20 via-transparent to-gold/20 pointer-events-none"></div>
    </div>
  );
};
