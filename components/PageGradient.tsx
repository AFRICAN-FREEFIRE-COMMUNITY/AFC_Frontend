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

  return (
    <div>
      <div className="fixed inset-0 bg-[url('/gaming-pattern.png')] opacity-5 pointer-events-none"></div>
      <div className="fixed inset-0 bg-gradient-to-br from-primary/20 via-transparent to-gold/20 pointer-events-none"></div>
    </div>
  );
};
