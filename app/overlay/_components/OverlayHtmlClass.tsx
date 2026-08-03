"use client";

// ─────────────────────────────────────────────────────────────────────────────
// OverlayHtmlClass - toggles `class="overlay"` on <html> for the lifetime of any
// /overlay page. Paired with globals.css `html.overlay body { background: transparent }`
// so the OBS Browser Source page paints fully see-through (only the leaderboard board
// shows). Added on mount, removed on unmount so navigating AWAY from the overlay
// restores the normal opaque site background. Rendered by app/overlay/layout.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from "react";

export function OverlayHtmlClass() {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("overlay");
    return () => html.classList.remove("overlay");
  }, []);
  return null;
}
