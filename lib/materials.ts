// ─────────────────────────────────────────────────────────────────────────────
// Apple materials, for CHROME only: the frosted, see-through surface the sticky header and the menu
// sheet are made of, and the thin light edge that goes on the same element.
//
// Apple design fix 16 (owner approved the mockup 24 Oct 2026, inbox #381), under the AFC rule of
// 23 Oct 2026 (inbox #375, WEBSITE/CLAUDE.md "Apple materials"): blur and a thin edge are allowed on
// chrome (header, nav, toolbars, sheets, menus) and nowhere else. Never on content cards, never as a
// decorative orb or a glow.
//
// One definition so every piece of chrome is the same material. Callers: the site header
// (app/(user)/_components/Header.tsx) and its menu sheet (MobileNavbar.tsx).
//
// The `reduced-transparency:` variant is declared in app/globals.css: anyone whose device asks for
// less transparency gets the solid page colour and no blur, so text on the chrome keeps full contrast.
// ─────────────────────────────────────────────────────────────────────────────

/** The material itself: 60% of the page colour, a 24 px blur and a little more saturation underneath. */
export const MATERIAL_CHROME =
  "bg-background/60 backdrop-blur-xl backdrop-saturate-150 reduced-transparency:bg-background reduced-transparency:backdrop-blur-none reduced-transparency:backdrop-saturate-100";

/** A 1 px light edge along the bottom (the sticky header). Dark in light mode so it still shows. */
export const MATERIAL_EDGE_BOTTOM =
  "shadow-[inset_0_-1px_0_rgb(0_0_0/0.06)] dark:shadow-[inset_0_-1px_0_rgb(255_255_255/0.08)]";

/** A 1 px light edge along the left side (a sheet that slides in from the right). */
export const MATERIAL_EDGE_LEFT =
  "shadow-[inset_1px_0_0_rgb(0_0_0/0.06)] dark:shadow-[inset_1px_0_0_rgb(255_255_255/0.08)]";
