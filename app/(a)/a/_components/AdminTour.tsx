"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AdminTour.tsx  -  the interactive guided walkthrough for the admin area
// ----------------------------------------------------------------------------
// PURPOSE
//   This is the "Take a tour" guide the owner asked about ("where is the guide /
//   helper for the admin section, I don't see it"). It is a STEP-BY-STEP TOUR that
//   highlights the real controls on an admin page one at a time, with Next / Back /
//   Skip. It is SEPARATE from the per-element ⓘ InfoTip tooltips (info-tip.tsx +
//   lib/help-content.ts) that already sit next to individual fields - the tooltips
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
//     - mostly the [data-tour="…"] hooks we added on the admin pages.
//   - COPY is internationalized, exactly like the organizer tour
//     (app/(organizer)/organizer/_components/OrganizerTourLauncher.tsx): every title
//     and description is resolved through next-intl (useTranslations("adminTour"))
//     using the key  tour.<pageKey>.<stepId>.title / .description  (the shared sidebar
//     step uses tour.sidebar.title / .description). The popover chrome (Next / Back /
//     Done / "Step X of Y") and the launcher button label come from tour.driver.* and
//     tour.button / tour.buttonAria. English source: messages/en/adminTour.json, with
//     hand-written messages/fr/adminTour.json + messages/pt/adminTour.json beside it.
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
// box-drawing dash above - that never renders to the user.)
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useTranslations } from "next-intl";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { Button } from "@/components/ui/button";
import { IconHelpCircle } from "@tabler/icons-react";
import {
  ADMIN_TOUR_STEPS,
  type AdminTourPageKey,
  type AdminTourStep,
} from "./admin-tour-steps";

// A translator function shaped like next-intl's `t`. Captured at render time and
// handed to the imperative driver.js builder so it can resolve copy lazily.
// Mirrors OrganizerTourLauncher's `Translate` alias.
type Translate = ReturnType<typeof useTranslations>;

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

// Persist the "seen" flag. Swallows storage errors (quota / disabled) silently - 
// failing to remember is harmless, it just means the tour might auto-show again.
function setSeenTour(pageKey: AdminTourPageKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(doneStorageKey(pageKey), "1");
  } catch {
    /* storage unavailable - ignore */
  }
}

// Safe querySelector: returns null instead of throwing on a bad selector. Used by
// every selector lookup below so a layout change can never blow up the tour.
function safeQuery(selector: string): HTMLElement | null {
  try {
    return document.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
}

// Click the INACTIVE Radix tab trigger inside the given tab-list container so the
// other tab's content mounts. Drives the both-tab coverage (Players / Leaderboards).
// Fully guarded: if the container or the inactive trigger is missing, it no-ops, so
// the tour never throws even if the tab markup changes. Radix renders each trigger
// as `[role="tab"]` with `data-state="active" | "inactive"`; clicking the inactive
// one flips the page's local tab state (see teams/page.tsx + events/page.tsx), which
// mounts the previously-unmounted <TabsContent>.
function activateInactiveTab(tabListSelector: string): void {
  const list = safeQuery(tabListSelector);
  if (!list) return;
  const inactive = list.querySelector<HTMLElement>(
    '[role="tab"][data-state="inactive"]',
  );
  inactive?.click();
}

// Resolve a step's i18n title + description from the "adminTour" namespace. The
// shared sidebar step reads the flat tour.sidebar.* keys; every other step reads
// tour.<pageKey>.<id>.*. Wrapped in try/catch so a missing key DROPS that one step
// rather than throwing the whole tour. Mirrors OrganizerTourLauncher.resolveCopy().
function resolveCopy(
  t: Translate,
  pageKey: AdminTourPageKey,
  step: AdminTourStep,
): { title: string; description: string } | null {
  const base =
    step.id === "sidebar" ? "tour.sidebar" : `tour.${pageKey}.${step.id}`;
  try {
    return { title: t(`${base}.title`), description: t(`${base}.description`) };
  } catch {
    return null;
  }
}

// Turn our AdminTourStep[] into driver.js DriveStep[], resolving the i18n copy for
// each step as we go.
//
// Three behaviours layered on top of the basic "title + description" mapping:
//
//   0. I18N LOOKUP. Copy comes from messages/*/adminTour.json via resolveCopy()
//      above; a step whose keys are missing is dropped, exactly like a step whose
//      selector is missing, so a half-translated catalogue can never throw.
//
//   1. MISSING-SELECTOR GUARD. A step whose target is not in the DOM is DROPPED so
//      driver.js never highlights nothing. EXCEPTION: steps flagged `lazy` live in a
//      tab that has not been activated yet, so their target is legitimately absent at
//      build time. We keep those and hand driver.js a lazy `() => Element` resolver
//      (driver.js v1.4 accepts a function for `element`) that resolves at highlight
//      time, AFTER the tab switch has mounted the content. If a lazy step's target is
//      still missing when it is reached, the resolver falls back to document.body so
//      driver.js shows the popover against the page rather than throwing.
//
//   2. TAB SWITCHING. A step carrying `activateInactiveTab` gets a custom
//      `popover.onNextClick`. Because we define onNextClick, driver.js stops
//      auto-advancing and hands control to us: we click the inactive tab trigger,
//      give React a tick to mount the new <TabsContent>, then call driver.moveNext().
//      `getDriver` lets this closure reach the live Driver instance created in start().
function buildSteps(
  pageKey: AdminTourPageKey,
  steps: AdminTourStep[],
  t: Translate,
  getDriver: () => Driver | null,
): DriveStep[] {
  if (typeof document === "undefined") return [];
  const out: DriveStep[] = [];

  for (const s of steps) {
    // Lazy steps are always kept (their target mounts later, after a tab switch).
    // Non-lazy steps must currently resolve to a real element, else drop them.
    if (!s.lazy && !safeQuery(s.element)) continue;

    const copy = resolveCopy(t, pageKey, s);
    if (!copy) continue; // missing translation → skip rather than throw

    const driveStep: DriveStep = {
      // Lazy steps resolve their selector at highlight time (post tab-switch);
      // eager steps keep the plain selector string.
      element: s.lazy ? () => safeQuery(s.element) ?? document.body : s.element,
      popover: {
        title: copy.title,
        description: copy.description,
        side: s.side,
        align: s.align,
      },
    };

    // Tab-switch step: take over Next so we can mount the other tab first.
    if (s.activateInactiveTab) {
      const tabList = s.activateInactiveTab;
      driveStep.popover!.onNextClick = () => {
        // Mount the other tab's content...
        activateInactiveTab(tabList);
        // ...then advance once React has had a tick to render it, so the next
        // (lazy) step's target exists when driver tries to highlight it.
        window.setTimeout(() => {
          getDriver()?.moveNext();
        }, 220);
      };
    }

    // Specific-tab switch: click one exact tab trigger (by selector), then advance.
    // Used to reach a 3rd/4th tab that activateInactiveTab (first-inactive) can't target.
    if (s.activateTab) {
      const target = s.activateTab;
      driveStep.popover!.onNextClick = () => {
        safeQuery(target)?.click();
        window.setTimeout(() => {
          getDriver()?.moveNext();
        }, 220);
      };
    }

    out.push(driveStep);
  }

  return out;
}

// ── useAdminTour: the reusable hook the brief asks for ───────────────────────
// Owns one driver.js instance (lazily created), the "seen" flag, and start/stop.
// Returns the handful of things callers need; everything else stays internal.
export function useAdminTour(pageKey: AdminTourPageKey) {
  const driverRef = React.useRef<Driver | null>(null);
  // The tour's own message namespace (messages/*/adminTour.json). Read here rather
  // than passed in, so the two existing callers (AdminTourButton + AdminTour) stay
  // unchanged and can never disagree about which namespace the copy comes from.
  const t = useTranslations("adminTour");
  // Keep the latest translator in a ref so the (stable) start() closure always
  // resolves copy with the current next-intl context, even though start() does not
  // list `t` as a dependency.
  const tRef = React.useRef<Translate>(t);
  React.useEffect(() => {
    tRef.current = t;
  }, [t]);
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
    // getDriver lets the tab-switch onNextClick closures reach the live instance
    // (created just below) so they can call moveNext() after mounting the new tab.
    const steps = buildSteps(
      pageKey,
      ADMIN_TOUR_STEPS[pageKey] ?? [],
      tRef.current,
      () => driverRef.current,
    );
    if (steps.length === 0) return; // nothing to show - do not open an empty overlay

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
      // Popover chrome, localized. progressText keeps driver.js's own
      // {{current}}/{{total}} mustache tokens: in the JSON value they are ICU-escaped
      // ('{{'current'}}') so next-intl emits them literally for driver.js to
      // substitute at runtime. Same trick as the user PageGuide (home.json).
      progressText: tRef.current("tour.driver.progress"),
      nextBtnText: tRef.current("tour.driver.next"),
      prevBtnText: tRef.current("tour.driver.back"),
      doneBtnText: tRef.current("tour.driver.done"),
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
  const t = useTranslations("adminTour");
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={start}
      className={className}
      // aria-label so the icon-led button is clear to screen readers.
      aria-label={t("tour.buttonAria")}
    >
      <IconHelpCircle className="h-4 w-4" />
      {/* Label hides on very small screens to keep the header tidy; the icon + aria
          stay, so the control is never lost. */}
      <span className="hidden sm:inline">{t("tour.button")}</span>
    </Button>
  );
}

// ── <AdminTour>: auto-show wrapper ───────────────────────────────────────────
// Mount this once per admin page (we mount it from the header). On the user's FIRST
// visit to a page (no "done" flag yet) it auto-opens the tour after a short delay so
// the page's async content has time to render. After that it does nothing on its own
// - the user replays via <AdminTourButton>.
export function AdminTour({ pageKey }: { pageKey: AdminTourPageKey }) {
  const { start } = useAdminTour(pageKey);

  React.useEffect(() => {
    // Respect the "already seen / dismissed" flag - never auto-show twice.
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
