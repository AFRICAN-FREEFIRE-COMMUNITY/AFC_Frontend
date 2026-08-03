"use client";

/**
 * ScrollableTabsList - a drop-in replacement for the
 *   <ScrollArea><TabsList>…triggers…</TabsList><ScrollBar orientation="horizontal" /></ScrollArea>
 * pattern used on the tab bars across the app.
 *
 * WHY THIS EXISTS (owner 2026-07-13)
 *   Those tab rows (event detail Overview/Details/…/Prizes, per-stage leaderboard tabs, the admin
 *   shop/settings/votes tabs, profile + player + team tabs, etc.) hold more tabs than fit on a phone.
 *   The old Radix ScrollArea scrollbar is nearly invisible on touch, so the extra tabs looked CLIPPED
 *   with no sign the row scrolls sideways ("for mobile it was supposed to have a different view or a
 *   hint that they can scroll"). This adds that discoverability with a mobile-first scroll affordance,
 *   identical in feel to the event-EDIT section nav (components/events/EventEditSectionNav.tsx):
 *     • a thin visible scrollbar (.custom-scroll),
 *     • left/right fading edges that appear ONLY while the strip actually overflows that direction
 *       (no false affordance when everything already fits), and
 *     • the active tab auto-centres into view when it changes, so switching to a clipped tab pulls it
 *       on-screen.
 *   It works at every width; on desktop where the tabs fit, the fades stay hidden and it looks
 *   exactly like a normal <TabsList>.
 *
 * HOW IT CONNECTS
 *   Rendered INSIDE a shadcn <Tabs> in place of the old <ScrollArea>…<TabsList>…</ScrollArea> block.
 *   It renders the SAME <TabsList> (data-slot="tabs-list") with the caller's children (the
 *   <TabsTrigger> elements) and className, so the surrounding <TabsContent> blocks are untouched and
 *   the Radix Tabs value still drives everything. Any extra props (id, data-tour, aria-*) are
 *   forwarded to the inner TabsList. It reads the active trigger via Radix's data-state="active" so it
 *   is fully data-driven by the Tabs value - no extra wiring needed at the call site.
 *   Callers (all replacing the ScrollArea+TabsList pattern): the event detail + leaderboard + shop +
 *   settings + votes + profile + players + teams tab bars. Shares the exact fade/auto-centre behaviour
 *   with EventEditSectionNav (that one adds a phone dropdown because it also carries per-section status
 *   dots; this generic one keeps the strip on every width and just makes the scroll obvious).
 */

import * as React from "react";

import { TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function ScrollableTabsList({
  children,
  className,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  });

  // The scrollable element is the shadcn TabsList (data-slot="tabs-list") inside our wrapper. We read
  // it off the wrapper ref rather than forwarding a ref into TabsList, so this stays decoupled from
  // the ui primitive.
  const getList = React.useCallback(
    () =>
      wrapRef.current?.querySelector<HTMLElement>('[data-slot="tabs-list"]') ??
      null,
    []
  );

  // Show the left/right edge fades only while the strip can actually scroll that way (so a strip that
  // already fits shows no false affordance). Recomputed on mount, scroll, resize and tab change.
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

    // Auto-centre the active tab whenever Radix flips data-state (i.e. the Tabs value changes), so
    // switching to a clipped tab pulls it on-screen. A MutationObserver keeps this fully data-driven
    // (no value prop needed) and decoupled from the call site.
    const centerActive = (behavior: ScrollBehavior) => {
      const active = list.querySelector<HTMLElement>('[data-state="active"]');
      active?.scrollIntoView({ inline: "center", block: "nearest", behavior });
      // edges shift after the programmatic scroll settles
      window.setTimeout(recomputeEdges, 250);
    };
    const mo = new MutationObserver(() => centerActive("smooth"));
    mo.observe(list, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-state"],
    });
    // Centre the initially-active tab on mount (no smooth so it lands instantly).
    centerActive("auto");

    return () => {
      list.removeEventListener("scroll", recomputeEdges);
      ro.disconnect();
      mo.disconnect();
    };
  }, [getList, recomputeEdges]);

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* Left/right fades: gradients from the strip's muted background to transparent, toggled by
          scroll position. pointer-events-none so they never eat tab clicks; rounded to hug the pill. */}
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
        className={cn(
          "w-full justify-start overflow-x-auto custom-scroll",
          className
        )}
        {...props}
      >
        {children}
      </TabsList>
    </div>
  );
}

export default ScrollableTabsList;
