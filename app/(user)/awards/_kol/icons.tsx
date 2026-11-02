/**
 * app/(user)/awards/_kol/icons.tsx - the five hand-drawn marks of the KOL Awards pages (close, back,
 * play, the stacked chevron between the vote steps, share). Drawn square-capped to match the cut
 * corners of the Detty Royale panels, instead of dropping a stock icon set in unchanged. Inline SVG:
 * no request, and they take the colour of the text they sit in.
 */
export function KolIcon({ name, className }: { name: "x" | "back" | "play" | "chev" | "share"; className?: string }) {
  switch (name) {
    case "x":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </svg>
      );
    case "back":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" fill="none" />
        </svg>
      );
    case "play":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M6 4l14 8-14 8z" fill="currentColor" />
        </svg>
      );
    case "chev":
      return (
        <svg viewBox="0 0 56 56" className={className} aria-hidden="true">
          <path d="M10 10l18 14 18-14v10L28 34 10 20zM10 26l18 14 18-14v10L28 50 10 36z" fill="currentColor" />
        </svg>
      );
    case "share":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="square" />
        </svg>
      );
  }
}
