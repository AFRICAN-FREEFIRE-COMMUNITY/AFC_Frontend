"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SponsorTourLauncher.tsx  —  the guided "Take a tour" for the sponsor portal
// ----------------------------------------------------------------------------
// PURPOSE
//   A pathname-aware launcher that gives the sponsor dashboard a step-by-step guided
//   tour, highlighting the real controls one at a time. The sponsor-portal twin of the
//   vendor launcher (app/(vendor)/vendor/_components/VendorTourLauncher.tsx) and the
//   admin tour (app/(a)/a/_components/AdminTour.tsx), folded into ONE self-contained
//   component so the sponsor area never reaches into shared/admin code.
//
//   Renders BOTH the visible "Take a tour" replay button and the first-visit AUTO-SHOW
//   (once per page) plus the driver.js popover theme. Renders nothing where no tour exists.
//
// HOW IT CONNECTS
//   - MOUNTED BY: app/(sponsor)/sponsor/layout.tsx (the persistent sponsor header).
//   - STEPS: ./sponsor-tour-steps.ts (SPONSOR_TOUR_STEPS[pageKey]); the route maps to a
//     pageKey via resolveSponsorTourPageKey(pathname).
//   - COPY: i18n (AFC hard rule). Reads the "sponsor" namespace via useTranslations and
//     looks up `${step.tKey}.title` / `${step.tKey}.description`. English source lives in
//     messages/en/sponsor.json -> tour.* (fr/pt machine-generated).
//   - TOUR LIBRARY: driver.js (1.4.x); base CSS imported once, our .afc-sponsor-tour
//     popover themed to the AFC dark/green look via the app's CSS variables.
//
// PERSISTENCE
//   - Per-page completion flag in localStorage: afc_sponsor_tour_<pageKey>_done ("1"),
//     set on finish / skip / close / Escape. Once set the tour never auto-opens again
//     (the button still replays it).
//
// SAFETY / NON-INTERFERENCE (mirrors the admin + vendor tours)
//   - Auto-show fires once, only if unseen, after a short delay so async content mounts.
//   - Steps whose selector matches nothing are dropped before driving. The sponsor
//     dashboard renders one of two components (scoped vs legacy); both carry the same
//     anchors, so the tour works either way and silently drops any missing step.
//   - allowClose + Escape + overlay click end the tour and mark it done.
//
// COPY RULES: NO em or en dashes in user-facing strings (those come from sponsor.json).
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { Button } from "@/components/ui/button";
import { IconHelpCircle } from "@tabler/icons-react";
import {
  SPONSOR_TOUR_STEPS,
  resolveSponsorTourPageKey,
  type SponsorTourPageKey,
  type SponsorTourStep,
} from "./sponsor-tour-steps";

// localStorage key for "this page's tour has been seen/dismissed".
const doneStorageKey = (pageKey: SponsorTourPageKey) =>
  `afc_sponsor_tour_${pageKey}_done`;

// Read the "already seen" flag (fail safe to "seen" on storage errors so we never nag).
function hasSeenTour(pageKey: SponsorTourPageKey): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(doneStorageKey(pageKey)) === "1";
  } catch {
    return true;
  }
}

// Persist the "seen" flag (storage errors are harmless and swallowed).
function setSeenTour(pageKey: SponsorTourPageKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(doneStorageKey(pageKey), "1");
  } catch {
    /* storage unavailable — ignore */
  }
}

// Safe querySelector: returns null instead of throwing on a bad selector.
function safeQuery(selector: string): HTMLElement | null {
  try {
    return document.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
}

// Turn SponsorTourStep[] into driver.js DriveStep[], dropping steps whose target is not
// in the DOM. `tr` resolves each step's i18n copy from the "sponsor" namespace.
function buildSteps(
  steps: SponsorTourStep[],
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
export function SponsorTourLauncher() {
  const pathname = usePathname();
  const pageKey = resolveSponsorTourPageKey(pathname ?? "");
  const t = useTranslations("sponsor");

  const driverRef = React.useRef<Driver | null>(null);

  const markDone = React.useCallback(() => {
    if (pageKey) setSeenTour(pageKey);
  }, [pageKey]);

  const destroy = React.useCallback(() => {
    if (driverRef.current?.isActive()) driverRef.current.destroy();
    driverRef.current = null;
  }, []);

  // Start (or replay) the tour; builds steps fresh so it reflects the current DOM.
  const start = React.useCallback(() => {
    if (!pageKey) return;
    const steps = buildSteps(SPONSOR_TOUR_STEPS[pageKey] ?? [], (key) => t(key));
    if (steps.length === 0) return; // nothing to show — do not open an empty overlay

    destroy();

    const d = driver({
      animate: true,
      smoothScroll: true,
      overlayColor: "#09090b",
      overlayOpacity: 0.7,
      stagePadding: 6,
      stageRadius: 8,
      allowClose: true,
      showProgress: true,
      // Chrome labels mirror the admin tour verbatim (English, like the admin system).
      progressText: "Step {{current}} of {{total}}",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Done",
      popoverClass: "afc-sponsor-tour",
      steps,
      onDestroyed: () => {
        markDone();
        driverRef.current = null;
      },
    });

    driverRef.current = d;
    d.drive();
  }, [pageKey, t, destroy, markDone]);

  // First-visit auto-show (after a beat so the dashboard's data has loaded).
  React.useEffect(() => {
    if (!pageKey) return;
    if (hasSeenTour(pageKey)) return;
    const timer = window.setTimeout(() => {
      if (!hasSeenTour(pageKey)) start();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [pageKey, start]);

  React.useEffect(() => destroy, [destroy]);

  if (!pageKey) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={start}
        aria-label="Take a guided tour of the sponsor dashboard"
      >
        <IconHelpCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Take a tour</span>
      </Button>
      <SponsorTourStyles />
    </>
  );
}

// ── <SponsorTourStyles>: scoped theme overrides for the driver.js popover ────
// Themes ONLY our .afc-sponsor-tour popover to the AFC dark/green look using the app's
// CSS variables (so it tracks the active theme). driver.js renders the popover into
// document.body, so a global <style> scoped by the popoverClass is the clean way to theme it.
function SponsorTourStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
        .driver-popover.afc-sponsor-tour {
          background-color: var(--card);
          color: var(--card-foreground);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6);
          font-family: var(--font-dm-sans, "DM Sans", ui-sans-serif, system-ui, sans-serif);
          max-width: 320px;
        }
        .driver-popover.afc-sponsor-tour .driver-popover-title {
          color: var(--primary);
          font-size: 1rem;
          font-weight: 700;
        }
        .driver-popover.afc-sponsor-tour .driver-popover-description {
          color: var(--card-foreground);
          opacity: 0.85;
          font-size: 0.8125rem;
          line-height: 1.5;
        }
        .driver-popover.afc-sponsor-tour .driver-popover-progress-text {
          color: var(--muted-foreground);
          font-size: 0.75rem;
        }
        .driver-popover.afc-sponsor-tour .driver-popover-arrow-side-left.driver-popover-arrow { border-left-color: var(--card); }
        .driver-popover.afc-sponsor-tour .driver-popover-arrow-side-right.driver-popover-arrow { border-right-color: var(--card); }
        .driver-popover.afc-sponsor-tour .driver-popover-arrow-side-top.driver-popover-arrow { border-top-color: var(--card); }
        .driver-popover.afc-sponsor-tour .driver-popover-arrow-side-bottom.driver-popover-arrow { border-bottom-color: var(--card); }
        .driver-popover.afc-sponsor-tour .driver-popover-footer button {
          border-radius: 0.375rem;
          font-size: 0.8125rem;
          font-weight: 500;
          text-shadow: none;
          padding: 0.35rem 0.7rem;
          transition: background-color 0.15s ease, opacity 0.15s ease;
        }
        .driver-popover.afc-sponsor-tour .driver-popover-next-btn,
        .driver-popover.afc-sponsor-tour .driver-popover-footer button.driver-popover-next-btn {
          background-color: var(--primary);
          color: var(--primary-foreground);
          border: 1px solid var(--primary);
        }
        .driver-popover.afc-sponsor-tour .driver-popover-next-btn:hover { opacity: 0.9; }
        .driver-popover.afc-sponsor-tour .driver-popover-prev-btn {
          background-color: transparent;
          color: var(--card-foreground);
          border: 1px solid var(--border);
        }
        .driver-popover.afc-sponsor-tour .driver-popover-prev-btn:hover {
          background-color: rgba(255, 255, 255, 0.06);
        }
        .driver-popover.afc-sponsor-tour .driver-popover-close-btn { color: var(--muted-foreground); }
        .driver-popover.afc-sponsor-tour .driver-popover-close-btn:hover { color: var(--card-foreground); }
      `,
      }}
    />
  );
}
