"use client";

/**
 * components/NewBadge.tsx
 * ───────────────────────
 * The shared NEW tag (owner rule, CLAUDE.md: "Every new feature or page wears a NEW tag for
 * 5 days"). Put it beside anything a returning user would not otherwise notice: a nav entry,
 * a page title, a card title, an option inside a picker. Never a full-width banner.
 *
 * Usage is deliberately one line, because a rule that is awkward to follow does not get
 * followed. Pass the day the surface went live and nothing else:
 *
 *     import { NewBadge } from "@/components/NewBadge";
 *
 *     <h1 className="flex items-center gap-2">
 *       {t("title")}
 *       <NewBadge since="2026-08-06" />
 *     </h1>
 *
 * It renders NOTHING once the window has passed, so there is never anything to go back and
 * delete. That is the whole point of the rule: a badge somebody has to remember to remove is
 * still on the site in March, and by then it means nothing. Do not "clean up" old call sites;
 * an expired <NewBadge> is already invisible and costs a single date comparison.
 *
 * Props:
 *   since      "YYYY-MM-DD", the day the surface went live. A malformed or impossible date
 *              renders nothing (safe failure for a decoration, same policy as LocalTime).
 *   days       optional override of the 5-day life. Almost never pass this. To re-time every
 *              badge on the site, edit NEW_BADGE_DAYS in lib/newBadge.ts instead.
 *   className  optional classes, for alignment tweaks at the call site.
 *
 * ── TIMEZONE: a fixed UTC boundary, not the viewer's clock ──────────────────────────────
 * The window is judged by comparing absolute instants (Date.now() against a UTC midnight),
 * so it expires at the same moment for every viewer on earth. This intentionally differs
 * from LocalTime / lib/i18n/time.ts, which render times in the VIEWER's zone: those DISPLAY
 * an instant to a human and so must use their wall clock, whereas this DECIDES WHETHER AN
 * ELEMENT EXISTS, which is one global fact and not a per-viewer reading. A viewer-local
 * boundary would (a) let the UTC server and a UTC+1 browser disagree about whether to render
 * the node at all, which is a real hydration mismatch on a conditionally-rendered element,
 * and (b) let the badge die at four different moments across AFC's UTC-1..UTC+3 spread, so
 * the same account could see it come back on a device in another zone. Full reasoning, and
 * the accepted trade-off, is in the header of lib/newBadge.ts.
 *
 * ── SERVER AND CLIENT ───────────────────────────────────────────────────────────────────
 * Marked "use client" so it is safe in BOTH kinds of caller: a Client Component imports it
 * normally, and a Server Component (including an async one) can render it with no ceremony,
 * because a client child inside a server parent is ordinary React. next-intl's
 * useTranslations() resolves through I18nProvider, mounted outermost in app/layout.tsx, so
 * every route in the app already has it.
 *
 * Hydration is safe because the server render and the first client render evaluate the SAME
 * absolute comparison and therefore agree. The client re-evaluating is also a feature rather
 * than a risk: if a page's HTML is ever cached or prerendered while the badge was live, the
 * client's own check still removes it after the window closes, so expiry stays real even for
 * stale markup.
 *
 * ── ACCESSIBILITY ───────────────────────────────────────────────────────────────────────
 * aria-hidden. It is pure decoration sitting next to a heading or link that already carries
 * the meaning, and a screen reader announcing "new" before every one of those is noise, not
 * information. Nothing here is focusable or interactive.
 *
 * How it connects to the rest of the system:
 *  - Expiry maths + the 5-day constant: lib/newBadge.ts (pure, unit tested in
 *    lib/__tests__/newBadge.test.ts).
 *  - Label copy: messages/{en,fr,pt}/newBadge.json, namespace "newBadge".
 *  - Visual idiom: components/ui/badge.tsx `variant="outline"`, matching the AFC badge
 *    constants (rounded-full, px-2 py-0.5, text-xs) and the sibling TournamentTierBadge /
 *    WatchTag pills.
 */

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { NEW_BADGE_DAYS, isNew } from "@/lib/newBadge";

type NewBadgeProps = {
  /** The day the surface went live, "YYYY-MM-DD". Anything else renders nothing. */
  since: string;
  /** Optional life override in days. Prefer editing NEW_BADGE_DAYS over passing this. */
  days?: number;
  /** Optional classes, mainly for aligning against an unusually large heading. */
  className?: string;
};

export function NewBadge({ since, days = NEW_BADGE_DAYS, className }: NewBadgeProps) {
  const t = useTranslations("newBadge");

  // Past the window (or handed an unusable date) there is no element at all. Called before
  // any markup so an expired badge costs one comparison and renders no wrapper, no spacing
  // and no gap - which is what lets call sites leave it in place forever.
  if (!isNew(since, days)) return null;

  return (
    <Badge
      variant="outline"
      // Decoration only; the heading or link beside it already says what this is.
      aria-hidden="true"
      // Answers the one support question this component attracts ("why is that still there?")
      // straight from the inspector, without hunting for the call site.
      data-new-since={since}
      className={cn(
        // AFC badge constants: outline pill, rounded-full, px-2 py-0.5, text-xs.
        "rounded-full px-2 py-0.5 text-xs",
        // Primary green, the same accent the tier-2 TournamentTierBadge uses, with the faint
        // tinted fill WatchTag uses - reads as a tag rather than as a status.
        "border-primary/50 bg-primary/10 font-semibold uppercase tracking-wide text-primary",
        // Layout safety, the reason this can sit beside a nav item or a page title without
        // moving anything: never grows, never wraps, never squashes its neighbour. (Badge
        // already sets shrink-0 + whitespace-nowrap; align-middle keeps it on the text
        // baseline when a call site drops it inline instead of into a flex row.)
        "shrink-0 whitespace-nowrap align-middle",
        className,
      )}
    >
      {t("label")}
    </Badge>
  );
}
