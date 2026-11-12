// lib/center-in-strip.ts - centre one item of a sideways-scrolling strip WITHOUT moving the page.
//
// Why this exists (12 Nov 2026, inbox #554): the tab strips centred their active tab with
// `el.scrollIntoView({ inline: "center", block: "nearest" })`. scrollIntoView scrolls EVERY scrolling
// ancestor, the window included, so a strip that mounts below the fold dragged the whole page down
// (352 px on a phone) while the page was still loading. That brought the footer on screen, the
// arriving content then shoved it off again, and the daily SEO live check measured a layout shift of
// 0.196 on a tournament page every day from 20 Oct (the footer jump the 16 Oct fix had removed).
// Scrolling only the strip's own scrollLeft keeps the page where the reader left it.
//
// Used by: components/ui/scrollable-tabs.tsx (every ScrollableTabsList: event detail, leaderboard,
// shop, settings, votes, profile, players, teams tab bars) and components/events/EventEditSectionNav.tsx.
// Held by the known-bugs entry fe-scrollintoview-tab-strip (scripts/known-bugs.json).

/** Scroll `strip` sideways so `item` sits in its middle; never scrolls the page or any other ancestor. */
export function centerInStrip(strip: HTMLElement, item: HTMLElement, behavior: ScrollBehavior = "auto") {
  const stripBox = strip.getBoundingClientRect();
  const itemBox = item.getBoundingClientRect();
  // the item's left edge in the strip's scroll coordinates, minus the room that centres it
  const left = strip.scrollLeft + (itemBox.left - stripBox.left) - (strip.clientWidth - itemBox.width) / 2;
  const max = strip.scrollWidth - strip.clientWidth;
  strip.scrollTo({ left: Math.max(0, Math.min(max, left)), behavior });
}
