"use client";

/**
 * EventEditSectionNav: the section navigator for the event-EDIT pages (admin + organizer).
 *
 * WHY THIS EXISTS (owner 2026-07-13)
 *   The edit pages have 8 sections (Basic Info … Waitlist). They used to render as a single
 *   `overflow-x-auto` row of tabs with NO scroll affordance, so on a phone the extra tabs were
 *   silently clipped off-screen and organizers editing on mobile didn't know the top menu scrolled
 *   sideways ("if an organizer opens an event to edit on mobile they usually don't know they can
 *   scroll the top menu"). This component fixes that discoverability with a mobile-first, per-width
 *   treatment:
 *     • PHONE (<768px): the tab row is replaced by a full-width SECTION DROPDOWN (shadcn Select) that
 *       shows the current section and, when tapped, lists all 8, nothing is hidden, impossible to
 *       miss. It drives the SAME Radix Tabs value the desktop strip does.
 *     • TABLET/DESKTOP (>=768px): the familiar tab strip stays, but now carries a scroll affordance:
 *       a thin visible scrollbar (.custom-scroll), fading left/right edges that appear ONLY while the
 *       strip actually overflows, and the active tab auto-centers into view when it changes. So on the
 *       rare width where 8 wide labels don't fit, it's obviously scrollable instead of silently cut.
 *
 * HOW IT CONNECTS
 *   Rendered INSIDE each page's `<Tabs value={currentTab} onValueChange={selectTab}>` in place of the
 *   old inline `<TabsList>` (so the mobile Select + desktop TabsList both control the one Tabs value;
 *   the `<TabsContent>` blocks that follow are unchanged). Callers pass a data-driven `sections` array
 *   describing each tab; the per-section state (validation error dot, sponsor/waitlist "enabled" dot)
 *   is computed in the page and handed in as `dot`, so this component stays presentational and the
 *   two pages can never drift apart again (they previously duplicated ~100 lines of tab JSX each).
 *   Consumed by:
 *     - app/(a)/a/events/[slug]/edit/page.tsx           (admin, passes infoTipId + per-tab tour anchors)
 *     - app/(organizer)/organizer/events/[slug]/edit/page.tsx (organizer, passes listTourAttr)
 */

import * as React from "react";
import { useTranslations } from "next-intl";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoTip } from "@/components/ui/info-tip";
import { cn } from "@/lib/utils";

/** One section of the edit page. `dot` drives the little status marker (red = has a validation
 *  error, green/primary = the section is enabled, e.g. sponsor/waitlist toggled on). */
export type EditSection = {
  value: string;
  label: string;
  dot?: "error" | "active" | null;
  /** Admin-only: the help-content id for the ⓘ tip beside the tab. Omitted on the organizer page. */
  infoTipId?: string;
  /** Admin-only: the guided-tour anchor placed on this specific tab trigger. */
  triggerTourAttr?: string;
};

function Dot({ kind, absolute }: { kind: "error" | "active"; absolute?: boolean }) {
  return (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        kind === "error" ? "bg-destructive" : "bg-primary",
        absolute && "absolute -top-1 -right-1"
      )}
    />
  );
}

export function EventEditSectionNav({
  sections,
  value,
  onValueChange,
  listTourAttr,
  className,
}: {
  sections: EditSection[];
  value: string;
  onValueChange: (value: string) => void;
  /** Guided-tour anchor for the whole strip (organizer page uses "org-event-edit-tabs"). */
  listTourAttr?: string;
  className?: string;
}) {
  // i18n: "events" ns (editNav.chooseSection). Only the mobile section-picker aria-label is a
  // fixed string here; the tab labels themselves are passed in by the parent page.
  const t = useTranslations("events");
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  });

  // The scrollable element is the shadcn TabsList (data-slot="tabs-list") inside our wrapper. We read
  // it off the wrapper ref rather than ref-forwarding TabsList, so this stays decoupled from the ui
  // primitive. Returns null before mount / on the mobile branch (list is display:none there).
  const getList = React.useCallback(
    () =>
      wrapRef.current?.querySelector<HTMLElement>('[data-slot="tabs-list"]') ?? null,
    []
  );

  // Show the left/right edge fades only while the strip can actually scroll that way (no false
  // affordance on a strip that already fits). Recomputed on mount, scroll, resize and tab change.
  const recomputeEdges = React.useCallback(() => {
    const list = getList();
    if (!list) return;
    const maxScroll = list.scrollWidth - list.clientWidth;
    setEdges({
      left: list.scrollLeft > 1,
      right: list.scrollLeft < maxScroll - 1,
    });
  }, [getList]);

  React.useEffect(() => {
    const list = getList();
    if (!list) return;
    recomputeEdges();
    list.addEventListener("scroll", recomputeEdges, { passive: true });
    const ro = new ResizeObserver(recomputeEdges);
    ro.observe(list);
    return () => {
      list.removeEventListener("scroll", recomputeEdges);
      ro.disconnect();
    };
  }, [getList, recomputeEdges]);

  // Auto-center the active tab whenever it changes, so switching to a clipped tab pulls it on-screen.
  React.useEffect(() => {
    const el = wrapRef.current?.querySelector<HTMLElement>(
      `[data-nav-value="${value}"]`
    );
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    // edges shift after the programmatic scroll settles
    const t = window.setTimeout(recomputeEdges, 250);
    return () => window.clearTimeout(t);
  }, [value, recomputeEdges]);

  const current = sections.find((s) => s.value === value);

  return (
    <div className={cn("mb-2", className)} data-testid="event-edit-section-nav">
      {/* ── PHONE (<768px): section dropdown. Shows the current section + a status dot; the list holds
             all 8 so none are hidden. Drives the same Tabs value as the desktop strip. ── */}
      <div className="md:hidden" data-nav-part="mobile">
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger
            className="w-full"
            aria-label={t("editNav.chooseSection")}
            {...(listTourAttr ? { "data-tour": listTourAttr } : {})}
          >
            <span className="flex min-w-0 items-center gap-2">
              <SelectValue />
              {current?.dot ? <Dot kind={current.dot} /> : null}
            </span>
          </SelectTrigger>
          <SelectContent>
            {sections.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                <span className="flex items-center gap-2">
                  {s.label}
                  {s.dot ? <Dot kind={s.dot} /> : null}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── TABLET/DESKTOP (>=768px): the tab strip + scroll affordance (thin scrollbar, edge fades
             that show only on overflow, active auto-centers). ── */}
      <div ref={wrapRef} className="relative hidden md:block" data-nav-part="desktop">
        {/* Left/right fades: gradients from the strip's muted background to transparent, toggled by
            scroll position. pointer-events-none so they never eat clicks. rounded to hug the pill. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-10 w-8 rounded-l-lg bg-gradient-to-r from-muted to-transparent transition-opacity",
            edges.left ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-10 w-8 rounded-r-lg bg-gradient-to-l from-muted to-transparent transition-opacity",
            edges.right ? "opacity-100" : "opacity-0"
          )}
        />
        <TabsList
          data-tour={listTourAttr}
          className="w-full justify-start overflow-x-auto custom-scroll"
        >
          {sections.map((s) => (
            <span
              key={s.value}
              data-nav-value={s.value}
              className="relative inline-flex flex-1 items-center justify-center"
            >
              <TabsTrigger
                value={s.value}
                className="px-6 w-full"
                {...(s.triggerTourAttr ? { "data-tour": s.triggerTourAttr } : {})}
              >
                {s.label}
              </TabsTrigger>
              {s.infoTipId ? <InfoTip id={s.infoTipId} className="ml-1" /> : null}
              {s.dot ? <Dot kind={s.dot} absolute /> : null}
            </span>
          ))}
        </TabsList>
      </div>
    </div>
  );
}
