"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VendorTourLauncher.tsx  —  the interactive guided "Take a tour" for the vendor portal
// ----------------------------------------------------------------------------
// PURPOSE
//   A pathname-aware launcher that gives every vendor page a step-by-step guided
//   tour, highlighting the real controls one at a time with Next / Back / Skip.
//   It is the vendor-portal twin of the admin tour
//   (app/(a)/a/_components/AdminTour.tsx + AdminTourLauncher.tsx), folded into ONE
//   self-contained component so the vendor area never reaches into shared/admin code.
//
//   It renders BOTH:
//     - the visible "Take a tour" button (outline + help icon) the vendor can click
//       any time to replay the current page's tour, and
//     - the first-visit AUTO-SHOW (once per page) plus the driver.js popover theme.
//   When the current route has no tour, it renders nothing (the header stays clean).
//
// HOW IT CONNECTS
//   - MOUNTED BY: app/(vendor)/vendor/layout.tsx (the persistent vendor header). Because
//     that header is on every vendor page, the launcher is too; it self-hides where no
//     tour exists.
//   - STEPS: ./vendor-tour-steps.ts (VENDOR_TOUR_STEPS[pageKey]); the route is mapped to
//     a pageKey by resolveVendorTourPageKey(pathname).
//   - COPY: unlike the admin tour (hardcoded English), each step's title/description is
//     i18n (AFC hard rule). We read the "vendor" namespace via useTranslations and look
//     up `${step.tKey}.title` / `${step.tKey}.description`. English source lives in
//     messages/en/vendor.json -> tour.* (fr/pt machine-generated).
//   - TOUR LIBRARY: driver.js (1.4.x). We import its base CSS once and theme ONLY our
//     .afc-vendor-tour popover to the AFC dark/green look, reusing the app's CSS vars.
//
// PERSISTENCE
//   - Completion is stored per page in localStorage under
//       afc_vendor_tour_<pageKey>_done   (value "1")
//     set when the vendor finishes, skips, closes, or Escapes the tour. Once set, the
//     tour never auto-opens again for that page (the button still replays it).
//
// SAFETY / NON-INTERFERENCE (mirrors the admin tour)
//   - Auto-show fires once, only if the flag is unset, and only after a short delay so
//     async page content (the orders/products/payouts fetches) has mounted.
//   - Selectors that match no element are dropped before driving, so a layout change
//     never makes the tour throw. If a page has zero resolvable steps, start() no-ops.
//   - allowClose + Escape + overlay click all end the tour and mark it done.
//
// COPY RULES: NO em or en dashes in any user-facing string (those come from vendor.json;
// the box-drawing dashes above are comments and never render).
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { Button } from "@/components/ui/button";
import { IconHelpCircle } from "@tabler/icons-react";
import {
  VENDOR_TOUR_STEPS,
  resolveVendorTourPageKey,
  type VendorTourPageKey,
  type VendorTourStep,
} from "./vendor-tour-steps";

// localStorage key for "this page's tour has been seen/dismissed". Centralised so the
// key format (the one the build brief specifies) is defined in exactly one place.
const doneStorageKey = (pageKey: VendorTourPageKey) =>
  `afc_vendor_tour_${pageKey}_done`;

// Read the "already seen" flag. Wrapped in try/catch because localStorage can throw in
// private-mode / SSR-edge cases; we fail safe to "seen" so we never nag on error.
function hasSeenTour(pageKey: VendorTourPageKey): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(doneStorageKey(pageKey)) === "1";
  } catch {
    return true;
  }
}

// Persist the "seen" flag. Swallows storage errors (quota / disabled) silently:
// failing to remember is harmless, it just means the tour might auto-show again.
function setSeenTour(pageKey: VendorTourPageKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(doneStorageKey(pageKey), "1");
  } catch {
    /* storage unavailable — ignore */
  }
}

// Safe querySelector: returns null instead of throwing on a bad selector, so a layout
// change can never blow up the tour.
function safeQuery(selector: string): HTMLElement | null {
  try {
    return document.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
}

// Turn our VendorTourStep[] into driver.js DriveStep[], dropping any step whose target
// is not currently in the DOM (so driver never highlights nothing). `tr` resolves the
// step's i18n copy from the "vendor" namespace.
function buildSteps(
  steps: VendorTourStep[],
  tr: (key: string) => string,
): DriveStep[] {
  if (typeof document === "undefined") return [];
  return steps
    .filter((s) => !!safeQuery(s.element))
    .map((s) => ({
      element: s.element,
      popover: {
        title: tr(`${s.tKey}.title`),
        description: tr(`${s.tKey}.description`),
        side: s.side,
        align: s.align,
      },
    }));
}

// ── The launcher ─────────────────────────────────────────────────────────────
// One component owns: the pathname → pageKey resolution, the driver.js instance, the
// first-visit auto-show, the replay button, and the scoped popover theme. Hooks run
// unconditionally (Rules of Hooks); we only branch on `pageKey` at render time.
export function VendorTourLauncher() {
  const pathname = usePathname();
  const pageKey = resolveVendorTourPageKey(pathname ?? "");
  // useTranslations must be called unconditionally; the namespace is always loaded.
  const t = useTranslations("vendor");

  const driverRef = React.useRef<Driver | null>(null);

  // Mark the page's tour as done (used by finish / skip / close / Escape).
  const markDone = React.useCallback(() => {
    if (pageKey) setSeenTour(pageKey);
  }, [pageKey]);

  // Tear down any live driver instance (on unmount / route change).
  const destroy = React.useCallback(() => {
    if (driverRef.current?.isActive()) driverRef.current.destroy();
    driverRef.current = null;
  }, []);

  // Start (or replay) the tour. Builds steps fresh each time so it always reflects the
  // CURRENT DOM (async tables, conditional cards, etc.). No-ops if nothing is highlightable.
  const start = React.useCallback(() => {
    if (!pageKey) return;
    const steps = buildSteps(VENDOR_TOUR_STEPS[pageKey] ?? [], (key) => t(key));
    if (steps.length === 0) return; // nothing to show — do not open an empty overlay

    destroy(); // clear a previous run

    const d = driver({
      // AFC look: smooth highlight, dark scrim, rounded stage to match rounded-md cards.
      animate: true,
      smoothScroll: true,
      overlayColor: "#09090b", // near-black, matches the dark background
      overlayOpacity: 0.7,
      stagePadding: 6,
      stageRadius: 8,
      allowClose: true, // Escape / overlay click can dismiss
      showProgress: true,
      // Chrome labels mirror the admin tour verbatim (kept in English like the admin
      // system, which sets the precedent; the localized content is the step copy).
      progressText: "Step {{current}} of {{total}}",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Done",
      popoverClass: "afc-vendor-tour", // themed in <VendorTourStyles/> below
      steps,
      // Fired whenever the tour ends for ANY reason (Done, Skip/close, Escape, overlay
      // click). Persist "seen" here so it never auto-nags again.
      onDestroyed: () => {
        markDone();
        driverRef.current = null;
      },
    });

    driverRef.current = d;
    d.drive();
  }, [pageKey, t, destroy, markDone]);

  // First-visit auto-show: on a page whose tour has not been seen, open it after a beat
  // so async content has mounted (otherwise buildSteps would drop not-yet-rendered steps).
  React.useEffect(() => {
    if (!pageKey) return;
    if (hasSeenTour(pageKey)) return;
    const timer = window.setTimeout(() => {
      // Re-check in case the vendor already launched + dismissed it within the delay.
      if (!hasSeenTour(pageKey)) start();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [pageKey, start]);

  // Clean up if the launcher unmounts mid-tour.
  React.useEffect(() => destroy, [destroy]);

  // No tour for this route → render nothing (header stays clean).
  if (!pageKey) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={start}
        aria-label="Take a guided tour of this vendor page"
      >
        <IconHelpCircle className="h-4 w-4" />
        {/* Label hides on very small screens to keep the header tidy; icon + aria stay. */}
        <span className="hidden sm:inline">Take a tour</span>
      </Button>
      <VendorTourStyles />
    </>
  );
}

// ── <VendorTourStyles>: scoped theme overrides for the driver.js popover ─────
// driver.css renders a plain white popover; this restyles ONLY our .afc-vendor-tour
// popover to the AFC dark/green theme using the same CSS variables globals.css defines
// (so it tracks the active theme). driver.js renders the popover outside React into
// document.body, so a global <style> scoped by the popoverClass is the clean way to theme it.
function VendorTourStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
        .driver-popover.afc-vendor-tour {
          background-color: var(--card);
          color: var(--card-foreground);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6);
          font-family: var(--font-dm-sans, "DM Sans", ui-sans-serif, system-ui, sans-serif);
          max-width: 320px;
        }
        .driver-popover.afc-vendor-tour .driver-popover-title {
          color: var(--primary);
          font-size: 1rem;
          font-weight: 700;
        }
        .driver-popover.afc-vendor-tour .driver-popover-description {
          color: var(--card-foreground);
          opacity: 0.85;
          font-size: 0.8125rem;
          line-height: 1.5;
        }
        .driver-popover.afc-vendor-tour .driver-popover-progress-text {
          color: var(--muted-foreground);
          font-size: 0.75rem;
        }
        .driver-popover.afc-vendor-tour .driver-popover-arrow-side-left.driver-popover-arrow { border-left-color: var(--card); }
        .driver-popover.afc-vendor-tour .driver-popover-arrow-side-right.driver-popover-arrow { border-right-color: var(--card); }
        .driver-popover.afc-vendor-tour .driver-popover-arrow-side-top.driver-popover-arrow { border-top-color: var(--card); }
        .driver-popover.afc-vendor-tour .driver-popover-arrow-side-bottom.driver-popover-arrow { border-bottom-color: var(--card); }
        .driver-popover.afc-vendor-tour .driver-popover-footer button {
          border-radius: 0.375rem;
          font-size: 0.8125rem;
          font-weight: 500;
          text-shadow: none;
          padding: 0.35rem 0.7rem;
          transition: background-color 0.15s ease, opacity 0.15s ease;
        }
        .driver-popover.afc-vendor-tour .driver-popover-next-btn,
        .driver-popover.afc-vendor-tour .driver-popover-footer button.driver-popover-next-btn {
          background-color: var(--primary);
          color: var(--primary-foreground);
          border: 1px solid var(--primary);
        }
        .driver-popover.afc-vendor-tour .driver-popover-next-btn:hover { opacity: 0.9; }
        .driver-popover.afc-vendor-tour .driver-popover-prev-btn {
          background-color: transparent;
          color: var(--card-foreground);
          border: 1px solid var(--border);
        }
        .driver-popover.afc-vendor-tour .driver-popover-prev-btn:hover {
          background-color: rgba(255, 255, 255, 0.06);
        }
        .driver-popover.afc-vendor-tour .driver-popover-close-btn { color: var(--muted-foreground); }
        .driver-popover.afc-vendor-tour .driver-popover-close-btn:hover { color: var(--card-foreground); }
      `,
      }}
    />
  );
}
