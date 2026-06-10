"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PageGuide.tsx  —  the on-page driver.js spotlight for the guided welcome tour
// ----------------------------------------------------------------------------
// PURPOSE
//   Piece 3 of 3 of the interactive guided welcome tour (see GuidedTourContext.tsx
//   for the orchestrator and WelcomeTour.tsx for the hub modal). Mounted ONCE in
//   app/(user)/layout.tsx. On every route change it asks the orchestrator: are we
//   mid tour, in the on-page phase, and is THIS pathname the current stop's route?
//   If yes, it waits ~600ms for the page to mount, then runs a driver.js spotlight
//   over that stop's [data-tour] anchors. When the driver ends for ANY reason
//   (Done, Skip, Escape, overlay click, or the user navigating away) it calls
//   context.finishPageGuide(), which flips the hub back open in "Continue?" mode.
//
// MIRRORS AdminTour.tsx EXACTLY
//   - the same driver() config (dark scrim, rounded stage, progress text, button
//     labels),
//   - the same missing-selector guard (safeQuery + a build step that DROPS any step
//     whose target is not in the DOM, so a layout change never throws),
//   - the same popover theme, restyled here under the shared `.afc-tour` class
//     (a verbatim copy of AdminTour's `.afc-admin-tour` rules so the two guides look
//     identical). driver.js renders its popover outside React into document.body, so
//     a global <style> scoped by the popover class is the clean way to theme it.
//
// EDGE CASES (per the design doc)
//   - Slow page: the 600ms delay + the missing-selector guard handle it. If the stop
//     still resolves zero steps, we call finishPageGuide() immediately so the hub
//     returns WITHOUT an empty overlay.
//   - User navigates away mid guide: driver onDestroyed fires -> finishPageGuide()
//     -> the hub returns at this index (acceptable). If the new route does not match
//     the current stop, PageGuide simply does not start.
//
// IDLE FALLBACK (refinement 1c)
//   The tour must never dead-end. If the user totally ignores the driver popup on a
//   page (never clicks Next, Back, Done, or closes it), an idle timer (IDLE_FALLBACK_MS
//   ~25s) auto-destroys the driver, which fires onDestroyed -> finishPageGuide(), so
//   the flow returns to the hub. The hub then auto-advances to the next stop (see the
//   hub's auto-advance countdown in WelcomeTour.tsx), so a fully passive user is still
//   carried Home -> Profile -> Teams -> Market -> Tournaments -> done. The idle timer
//   is (re)armed every time a step is highlighted (onHighlighted, which fires on the
//   first step AND whenever the user advances), so ANY interaction resets the clock;
//   it is cleared on destroy/unmount/navigation. We deliberately do NOT override
//   onNextClick/onPrevClick (that would disable driver's own auto-advance), we only
//   passively observe onHighlighted.
//
// COPY RULES: NO em or en dashes in any user-facing string. (Box-drawing dashes in
// these comments never render to the user.)
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { usePathname } from "next/navigation";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

import { useGuidedTour } from "@/contexts/GuidedTourContext";
import type { GuidedTourStep } from "./guided-tour-stops";

// Idle fallback window (refinement 1c). If the user never touches the driver popup on
// a page, auto-destroy it after this long so the flow returns to the hub and then
// auto-advances. Re-armed on every step highlight, so any interaction resets it.
const IDLE_FALLBACK_MS = 25000;

// Safe querySelector: returns null instead of throwing on a bad selector. Used by
// the missing-selector guard so a layout change can never blow up the tour. (Copied
// from AdminTour.tsx.)
function safeQuery(selector: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  try {
    return document.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
}

// Turn a stop's GuidedTourStep[] into driver.js DriveStep[], DROPPING any step whose
// target is not currently in the DOM so driver.js never highlights nothing. (Mirrors
// AdminTour.buildSteps(), minus the admin-only lazy/tab-switch behaviour the user
// pages do not need.)
function buildSteps(steps: GuidedTourStep[]): DriveStep[] {
  if (typeof document === "undefined") return [];
  return steps
    .filter((s) => !!safeQuery(s.element))
    .map((s) => ({
      element: s.element,
      popover: {
        title: s.title,
        description: s.description,
        side: s.side,
        align: s.align,
      },
    }));
}

export function PageGuide() {
  const { active, phase, currentStop, finishPageGuide } = useGuidedTour();
  const pathname = usePathname();
  const driverRef = React.useRef<Driver | null>(null);
  // Guards against re-running the SAME stop's guide twice (e.g. a re-render while the
  // driver is already up). Reset whenever we leave the on-page phase.
  const startedKeyRef = React.useRef<string | null>(null);
  // Idle-fallback timer handle (refinement 1c). Re-armed on each step highlight,
  // cleared on destroy / phase change / unmount.
  const idleTimerRef = React.useRef<number | null>(null);

  // Clear any pending idle-fallback timer. Safe to call repeatedly.
  const clearIdleTimer = React.useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    // Only run when the orchestrator is mid tour, in the on-page phase, with a guide
    // stop whose route matches where we actually are.
    if (
      !active ||
      phase !== "onpage" ||
      !currentStop ||
      currentStop.kind !== "guide" ||
      !currentStop.route
    ) {
      return;
    }
    if (pathname !== currentStop.route) return;

    // Do not start the same stop's guide twice.
    const runKey = `${currentStop.id}:${pathname}`;
    if (startedKeyRef.current === runKey) return;
    startedKeyRef.current = runKey;

    let cancelled = false;

    // Wait a beat so the page's async content (forms, tables, tabs) has mounted;
    // otherwise buildSteps would drop steps whose targets are not painted yet. 600ms
    // matches the design doc and AdminTour's auto-show delay budget.
    const timer = window.setTimeout(() => {
      if (cancelled) return;

      const steps = buildSteps(currentStop.steps ?? []);

      // No resolvable steps on this page -> return to the hub immediately, with no
      // empty overlay (edge case in the design doc).
      if (steps.length === 0) {
        finishPageGuide();
        return;
      }

      const d = driver({
        // AFC look: smooth highlight, dark scrim, rounded stage to match AFC cards.
        // Identical to AdminTour's config so the two guides feel the same.
        animate: true,
        smoothScroll: true,
        overlayColor: "#09090b", // near-black, matches the dark AFC background
        overlayOpacity: 0.7,
        stagePadding: 6,
        stageRadius: 8,
        allowClose: true, // Escape / overlay click can dismiss
        showProgress: true,
        progressText: "Step {{current}} of {{total}}",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Done",
        popoverClass: "afc-tour", // themed in <PageGuideStyles/> below
        steps,
        // ── Idle fallback (refinement 1c) ──
        // onHighlighted fires when a step is shown: once for the first step, and again
        // every time the user advances/goes back. We (re)arm the idle timer here, so
        // ANY interaction (which always lands on a new highlight) resets the clock.
        // If the user never touches the popup, the timer survives and auto-destroys
        // the driver after IDLE_FALLBACK_MS; destroy() then fires onDestroyed below.
        // We do NOT define onNextClick/onPrevClick so driver keeps its own advancing.
        onHighlighted: () => {
          clearIdleTimer();
          idleTimerRef.current = window.setTimeout(() => {
            // Tear the driver down; onDestroyed handles the return to the hub. Guard
            // isActive() so a late timer after a manual close is a harmless no-op.
            if (driverRef.current?.isActive()) {
              driverRef.current.destroy();
            }
          }, IDLE_FALLBACK_MS);
        },
        // Fired whenever the tour ends for ANY reason (Done, Skip/close, Escape,
        // overlay click, OR the idle fallback above). Return to the hub in
        // "Continue?" mode.
        onDestroyed: () => {
          clearIdleTimer();
          driverRef.current = null;
          // finishPageGuide flips phase back to hub + sets return mode.
          finishPageGuide();
        },
      });

      driverRef.current = d;
      d.drive();
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      // Also drop any armed idle-fallback timer so a navigation mid guide cannot fire
      // it after the driver is gone.
      clearIdleTimer();
    };
    // Re-evaluate when any of these change (a new stop, a navigation, phase flip).
  }, [active, phase, currentStop, pathname, finishPageGuide, clearIdleTimer]);

  // When we leave the on-page phase (hub took over, or the tour ended), tear down any
  // live driver, clear the idle timer, and clear the run guard so a future visit can
  // re-run.
  React.useEffect(() => {
    if (phase !== "onpage") {
      startedKeyRef.current = null;
      clearIdleTimer();
      if (driverRef.current?.isActive()) {
        driverRef.current.destroy();
      }
      driverRef.current = null;
    }
  }, [phase, clearIdleTimer]);

  // Clean up on unmount (route change re-mounts the layout).
  React.useEffect(() => {
    return () => {
      clearIdleTimer();
      if (driverRef.current?.isActive()) {
        driverRef.current.destroy();
      }
      driverRef.current = null;
    };
  }, [clearIdleTimer]);

  return <PageGuideStyles />;
}

// ── <PageGuideStyles>: scoped theme overrides for the driver.js popover ───────
// A verbatim copy of AdminTour's `.afc-admin-tour` popover theme, scoped to
// `.afc-tour` so the user-facing guide matches the admin guide exactly. Injected as
// a plain <style> tag because driver.js renders its popover outside React into
// document.body. Uses the same CSS variables globals.css defines (--card, --primary,
// etc.) so it automatically tracks the theme.
function PageGuideStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
        /* Card body: dark surface, light text, rounded-md to match AFC cards. */
        .driver-popover.afc-tour {
          background-color: var(--card);
          color: var(--card-foreground);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6);
          font-family: var(--font-dm-sans, "DM Sans", ui-sans-serif, system-ui, sans-serif);
          max-width: 320px;
        }
        /* Title: green/primary + bold, mirroring AFC page headings. */
        .driver-popover.afc-tour .driver-popover-title {
          color: var(--primary);
          font-size: 1rem;
          font-weight: 700;
        }
        /* Body copy: readable muted-light, comfortable line height. */
        .driver-popover.afc-tour .driver-popover-description {
          color: var(--card-foreground);
          opacity: 0.85;
          font-size: 0.8125rem;
          line-height: 1.5;
        }
        /* Step counter (Step X of Y): muted. */
        .driver-popover.afc-tour .driver-popover-progress-text {
          color: var(--muted-foreground);
          font-size: 0.75rem;
        }
        /* The little arrow that points at the target inherits the card colour. */
        .driver-popover.afc-tour .driver-popover-arrow-side-left.driver-popover-arrow { border-left-color: var(--card); }
        .driver-popover.afc-tour .driver-popover-arrow-side-right.driver-popover-arrow { border-right-color: var(--card); }
        .driver-popover.afc-tour .driver-popover-arrow-side-top.driver-popover-arrow { border-top-color: var(--card); }
        .driver-popover.afc-tour .driver-popover-arrow-side-bottom.driver-popover-arrow { border-bottom-color: var(--card); }
        /* Footer buttons: Next/Done as the green primary, Back as a subtle outline. */
        .driver-popover.afc-tour .driver-popover-footer button {
          border-radius: 0.375rem;
          font-size: 0.8125rem;
          font-weight: 500;
          text-shadow: none;
          padding: 0.35rem 0.7rem;
          transition: background-color 0.15s ease, opacity 0.15s ease;
        }
        .driver-popover.afc-tour .driver-popover-next-btn,
        .driver-popover.afc-tour .driver-popover-footer button.driver-popover-next-btn {
          background-color: var(--primary);
          color: var(--primary-foreground);
          border: 1px solid var(--primary);
        }
        .driver-popover.afc-tour .driver-popover-next-btn:hover {
          opacity: 0.9;
        }
        .driver-popover.afc-tour .driver-popover-prev-btn {
          background-color: transparent;
          color: var(--card-foreground);
          border: 1px solid var(--border);
        }
        .driver-popover.afc-tour .driver-popover-prev-btn:hover {
          background-color: rgba(255, 255, 255, 0.06);
        }
        /* The close (x) control: muted, brightens on hover. */
        .driver-popover.afc-tour .driver-popover-close-btn {
          color: var(--muted-foreground);
        }
        .driver-popover.afc-tour .driver-popover-close-btn:hover {
          color: var(--card-foreground);
        }
      `,
      }}
    />
  );
}

export default PageGuide;
