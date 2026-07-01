// ─────────────────────────────────────────────────────────────────────────────
// Overlay route group layout (app/overlay/*).
// ----------------------------------------------------------------------------
// These are BROADCAST GRAPHICS loaded as an OBS Browser Source, not normal site
// pages. This layout does two minimal things:
//   1. Marks the pages noindex (they are per-token live graphics, never crawlable).
//   2. Mounts <OverlayHtmlClass/>, which adds `class="overlay"` to <html> while an
//      overlay page is shown. globals.css `html.overlay body { background: transparent }`
//      then makes the page see-through, and PageGradient (path-aware) renders nothing
//      on /overlay, so only the leaderboard board paints over the stream.
//
// This layout nests INSIDE the root app/layout.tsx (providers + PageGradient + Toaster
// still wrap it), so no site chrome needs re-wiring — the transparency is handled purely
// by the html.overlay class + the path-aware gradient.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { OverlayHtmlClass } from "./_components/OverlayHtmlClass";

export const metadata: Metadata = {
  title: "Live Leaderboard Overlay",
  robots: { index: false, follow: false },
};

export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <OverlayHtmlClass />
      {children}
    </>
  );
}
