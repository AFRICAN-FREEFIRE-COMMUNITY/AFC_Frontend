"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AdminTour.tsx  —  the interactive guided walkthrough for the admin area
// ----------------------------------------------------------------------------
// PURPOSE
//   This is the "Take a tour" guide the owner asked about ("where is the guide /
//   helper for the admin section, I don't see it"). It is a STEP-BY-STEP TOUR that
//   highlights the real controls on an admin page one at a time, with Next / Back /
//   Skip. It is SEPARATE from the per-element ⓘ InfoTip tooltips (info-tip.tsx +
//   lib/help-content.ts) that already sit next to individual fields — the tooltips
//   explain one control on hover; the tour walks you through the whole page.
//
// WHAT THIS FILE EXPORTS
//   - useAdminTour(pageKey): the underlying hook. Returns { start, isReady,
//     markDone, hasSeen } and owns the driver.js instance + localStorage flag.
//   - <AdminTour pageKey>: a thin wrapper that runs the hook and auto-shows the
//     tour on the user's FIRST visit to that page.
//   - <AdminTourButton pageKey>: the visible "Take a tour" launcher (an outline
//     Button with a help icon) the user can click any time to replay the tour.
//
// HOW IT CONNECTS (data + callers)
//   - STEPS come from app/(a)/a/_components/admin-tour-steps.ts
//     (ADMIN_TOUR_STEPS[pageKey]). Each step targets a real control by CSS selector
//     — mostly the [data-tour="…"] hooks we added on the admin pages.
//   - The LAUNCHER + AUTO-SHOW are mounted from the persistent admin header,
//     components/site-header.tsx → <AdminTourLauncher/>, which reads the current
//     pathname (usePathname), resolves it to a pageKey via resolveAdminTourPageKey,
//     and renders <AdminTourButton/> + <AdminTour/> when a tour exists for that page.
//     site-header.tsx is rendered by app/(a)/a/layout.tsx, so the launcher shows on
//     every admin page.
//   - TOUR LIBRARY: driver.js (1.4.x), a tiny dependency-free walkthrough lib. We
//     import its base CSS once and override the popover styling to AFC's dark/green
//     theme via the .afc-admin-tour popoverClass below.
//
// PERSISTENCE
//   - Completion is stored per page in localStorage under the key
//       afc_admin_tour_<pageKey>_done   (value "1")
//     It is set when the user finishes the tour, clicks Skip/close, or ticks the
//     "Don't show this again" affordance. Once set, the tour NEVER auto-opens again
//     for that page (the user can still replay it from the "Take a tour" button).
//
// SAFETY / NON-INTERFERENCE (per the brief)
//   - Auto-show fires once, only if the flag is unset, only after the target
//     elements have had a tick to mount (so we never highlight nothing).
//   - Selectors that match no element are dropped before driving, so a tour never
//     throws if a page's layout changed (guarded in buildSteps()).
//   - If a page has zero resolvable steps, start() no-ops instead of opening an
//     empty overlay.
//   - allowClose + Escape + overlay click all end the tour and mark it done.
//
// COPY RULES: NO em or en dashes in any user-facing string. (Comments may use the
// box-drawing dash above — that never renders to the user.)
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { Button } from "@/components/ui/button";
import { IconHelpCircle } from "@tabler/icons-react";
import {
  ADMIN_TOUR_STEPS,
  type AdminTourPageKey,
  type AdminTourStep,
} from "./admin-tour-steps";

// localStorage key for "this page's tour has been seen/dismissed". Centralised so
// the key format is defined in exactly one place.
const doneStorageKey = (pageKey: AdminTourPageKey) =>
  `afc_admin_tour_${pageKey}_done`;

// Read the "already seen" flag. Wrapped in try/catch because localStorage can throw
// in private-mode / SSR-edge cases; we fail safe to "seen" so we never nag on error.
function hasSeenTour(pageKey: AdminTourPageKey): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(doneStorageKey(pageKey)) === "1";
  } catch {
    return true;
  }
}

// Persist the "seen" flag. Swallows storage errors (quota / disabled) silently —
// failing to remember is harmless, it just means the tour might auto-show again.
function setSeenTour(pageKey: AdminTourPageKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(doneStorageKey(pageKey), "1");
  } catch {
    /* storage unavailable — ignore */
  }
}

// Turn our AdminTourStep[] into driver.js DriveStep[], DROPPING any step whose
// target element is not currently in the DOM. This is the core "never throw on a
// missing selector" guard: driver.js would otherwise error or highlight nothing.
function buildSteps(steps: AdminTourStep[]): DriveStep[] {
  if (typeof document === "undefined") return [];
  return steps
    .filter((s) => {
      try {
        return !!document.querySelector(s.element);
      } catch {
        // An invalid selector (should not happen) is treated as "not present".
        return false;
      }
    })
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

// ── useAdminTour: the reusable hook the brief asks for ───────────────────────
// Owns one driver.js instance (lazily created), the "seen" flag, and start/stop.
// Returns the handful of things callers need; everything else stays internal.
export function useAdminTour(pageKey: AdminTourPageKey) {
  const driverRef = React.useRef<Driver | null>(null);
  // We track "seen" in state too so the button copy can react ("Take a tour" stays
  // the same either way, but consumers may want it). Initialised from storage.
  const [hasSeen, setHasSeen] = React.useState<boolean>(true);

  React.useEffect(() => {
    setHasSeen(hasSeenTour(pageKey));
  }, [pageKey]);

  // Mark the page's tour as done (used by finish, skip, close, and "don't show again").
  const markDone = React.useCallback(() => {
    setSeenTour(pageKey);
    setHasSeen(true);
  }, [pageKey]);

  // Tear down any live driver instance (used on unmount / route change).
  const destroy = React.useCallback(() => {
    if (driverRef.current?.isActive()) {
      driverRef.current.destroy();
    }
    driverRef.current = null;
  }, []);

  // Start (or replay) the tour. Builds steps fresh each time so it always reflects
  // the CURRENT DOM (tabs, async tables, etc. may have changed). No-ops if nothing
  // on the page can be highlighted.
  const start = React.useCallback(() => {
    const steps = buildSteps(ADMIN_TOUR_STEPS[pageKey] ?? []);
    if (steps.length === 0) return; // nothing to show — do not open an empty overlay

    // Destroy a previous run before starting a new one.
    destroy();

    const d = driver({
      // AFC look: smooth highlight, dark scrim, rounded stage to match rounded-md.
      animate: true,
      smoothScroll: true,
      overlayColor: "#09090b", // near-black, matches the dark admin background
      overlayOpacity: 0.7,
      stagePadding: 6,
      stageRadius: 8,
      allowClose: true, // Escape / overlay click can dismiss
      showProgress: true,
      progressText: "Step {{current}} of {{total}}",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Done",
      popoverClass: "afc-admin-tour", // themed in <AdminTourStyles/> below
      steps,
      // Fired whenever the tour ends for ANY reason (Done, Skip/close, Escape,
      // overlay click). This is where we persist "seen" so it never auto-nags again.
      onDestroyed: () => {
        markDone();
        driverRef.current = null;
      },
    });

    driverRef.current = d;
    d.drive();
  }, [pageKey, destroy, markDone]);

  // Clean up if the component using the hook unmounts mid-tour.
  React.useEffect(() => destroy, [destroy]);

  return { start, markDone, hasSeen };
}

// ── <AdminTourButton>: the always-available "Take a tour" launcher ───────────
// An outline button with a help icon, sized to sit in the admin header next to the
// theme toggle. Clicking it (re)starts the tour for the given page.
export function AdminTourButton({
  pageKey,
  className,
}: {
  pageKey: AdminTourPageKey;
  className?: string;
}) {
  const { start } = useAdminTour(pageKey);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={start}
      className={className}
      // aria-label so the icon-led button is clear to screen readers.
      aria-label="Take a guided tour of this admin page"
    >
      <IconHelpCircle className="h-4 w-4" />
      {/* Label hides on very small screens to keep the header tidy; the icon + aria
          stay, so the control is never lost. */}
      <span className="hidden sm:inline">Take a tour</span>
    </Button>
  );
}

// ── <AdminTour>: auto-show wrapper ───────────────────────────────────────────
// Mount this once per admin page (we mount it from the header). On the user's FIRST
// visit to a page (no "done" flag yet) it auto-opens the tour after a short delay so
// the page's async content has time to render. After that it does nothing on its own
// — the user replays via <AdminTourButton>.
export function AdminTour({ pageKey }: { pageKey: AdminTourPageKey }) {
  const { start } = useAdminTour(pageKey);

  React.useEffect(() => {
    // Respect the "already seen / dismissed" flag — never auto-show twice.
    if (hasSeenTour(pageKey)) return;

    // Wait a beat so PageHeaders, tables and tab content have mounted; otherwise
    // buildSteps() would drop steps whose targets are not in the DOM yet. 700ms is
    // comfortably after the typical dashboard/list fetch paints its skeleton-free UI.
    const t = window.setTimeout(() => {
      // Re-check the flag in case the user already launched + dismissed it manually
      // within the delay window.
      if (!hasSeenTour(pageKey)) start();
    }, 700);

    return () => window.clearTimeout(t);
    // pageKey changes when the user navigates to a different admin page; re-arm.
  }, [pageKey, start]);

  return <AdminTourStyles />;
}

// ── <AdminTourStyles>: scoped theme overrides for the driver.js popover ──────
// driver.css gives a plain white popover; this restyles ONLY our .afc-admin-tour
// popover to the AFC dark/green theme so it reads correctly on the dark admin
// background. Injected as a plain <style> tag (the rest of the app uses Tailwind,
// but driver.js renders its popover outside React into document.body, so a global
// style scoped by the popoverClass is the clean way to theme it). Uses the same
// CSS variables the app already defines in globals.css (--card, --primary, etc.),
// so it automatically tracks the theme.
function AdminTourStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
        /* Card body: dark surface, light text, rounded-md to match AFC cards. */
        .driver-popover.afc-admin-tour {
          background-color: var(--card);
          color: var(--card-foreground);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6);
          font-family: var(--font-dm-sans, "DM Sans", ui-sans-serif, system-ui, sans-serif);
          max-width: 320px;
        }
        /* Title: green/primary + bold, mirroring AFC page headings. */
        .driver-popover.afc-admin-tour .driver-popover-title {
          color: var(--primary);
          font-size: 1rem;
          font-weight: 700;
        }
        /* Body copy: readable muted-light, comfortable line height. */
        .driver-popover.afc-admin-tour .driver-popover-description {
          color: var(--card-foreground);
          opacity: 0.85;
          font-size: 0.8125rem;
          line-height: 1.5;
        }
        /* Step counter (Step X of Y): muted. */
        .driver-popover.afc-admin-tour .driver-popover-progress-text {
          color: var(--muted-foreground);
          font-size: 0.75rem;
        }
        /* The little arrow that points at the target inherits the card colour. */
        .driver-popover.afc-admin-tour .driver-popover-arrow-side-left.driver-popover-arrow { border-left-color: var(--card); }
        .driver-popover.afc-admin-tour .driver-popover-arrow-side-right.driver-popover-arrow { border-right-color: var(--card); }
        .driver-popover.afc-admin-tour .driver-popover-arrow-side-top.driver-popover-arrow { border-top-color: var(--card); }
        .driver-popover.afc-admin-tour .driver-popover-arrow-side-bottom.driver-popover-arrow { border-bottom-color: var(--card); }
        /* Footer buttons: Next/Done as the green primary, Back as a subtle outline. */
        .driver-popover.afc-admin-tour .driver-popover-footer button {
          border-radius: 0.375rem;
          font-size: 0.8125rem;
          font-weight: 500;
          text-shadow: none;
          padding: 0.35rem 0.7rem;
          transition: background-color 0.15s ease, opacity 0.15s ease;
        }
        .driver-popover.afc-admin-tour .driver-popover-next-btn,
        .driver-popover.afc-admin-tour .driver-popover-footer button.driver-popover-next-btn {
          background-color: var(--primary);
          color: var(--primary-foreground);
          border: 1px solid var(--primary);
        }
        .driver-popover.afc-admin-tour .driver-popover-next-btn:hover {
          opacity: 0.9;
        }
        .driver-popover.afc-admin-tour .driver-popover-prev-btn {
          background-color: transparent;
          color: var(--card-foreground);
          border: 1px solid var(--border);
        }
        .driver-popover.afc-admin-tour .driver-popover-prev-btn:hover {
          background-color: rgba(255, 255, 255, 0.06);
        }
        /* The close (x) control: muted, brightens on hover. */
        .driver-popover.afc-admin-tour .driver-popover-close-btn {
          color: var(--muted-foreground);
        }
        .driver-popover.afc-admin-tour .driver-popover-close-btn:hover {
          color: var(--card-foreground);
        }
      `,
      }}
    />
  );
}
