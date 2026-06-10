"use client";

// ─────────────────────────────────────────────────────────────────────────────
// WelcomeTour.tsx  —  the cheerful, VERY animated HUB modal of the guided tour
// ----------------------------------------------------------------------------
// PURPOSE
//   The hub modal of the interactive guided welcome tour. It is piece 2 of 3:
//     1. contexts/GuidedTourContext.tsx  — the cross-page orchestrator (state + API).
//     2. THIS FILE                        — the animated hub modal that reads the
//          orchestrator and renders the intro, each stop's "Show me on the <page>"
//          launcher, the "Ready for the next stop?" return prompt, and the outro.
//     3. app/(user)/_components/PageGuide.tsx — the on-page driver.js spotlight.
//
//   The tour is no longer a self-contained carousel. For a GUIDE stop the hub shows
//   a "Show me on the <page>" button; clicking it calls goToPageGuide(route), which
//   navigates to the real page where PageGuide runs a driver.js spotlight of the key
//   controls. When that page guide ends, the orchestrator flips the hub back open in
//   RETURN MODE for the same stop, showing "Nice work! Ready for the next stop?"
//   with Continue + Skip. Intro and outro are modal-only moments.
//
// WHAT THIS FILE EXPORTS
//   - <WelcomeTour/>: the hub overlay. Mount ONCE in app/(user)/layout.tsx (inside
//     the GuidedTourProvider). It reads the orchestrator and renders the hub only
//     when isHubOpen is true; renders nothing otherwise.
//   - openWelcomeTour(): dispatches the "afc:open-welcome-tour" window event the
//     Header's replay button already calls. The GuidedTourProvider listens for it and
//     force-starts the tour, so the Header needs NO change.
//   - useWelcomeTour(): tiny hook exposing { open } (kept for API compatibility).
//
// HOW IT CONNECTS (data + callers)
//   - ORCHESTRATOR: useGuidedTour() (contexts/GuidedTourContext.tsx) supplies the
//     current index, phase, returnMode, the stop list, and the API (start,
//     goToPageGuide, continueTour, skip, finish).
//   - STOPS: app/(user)/_components/guided-tour-stops.ts (GUIDED_STOPS) defines each
//     stop's icon, copy, route, launcher label, and on-page driver steps.
//   - AUTH + PERSISTENCE: handled inside the orchestrator (has_seen_welcome,
//     mark-welcome-seen, the localStorage seen flag). The hub itself is pure UI.
//   - REPLAY: Header.tsx imports openWelcomeTour and wires it to its sparkles button.
//   - NAVIGATION: the outro's glossary CTA + each guide launcher navigate via the
//     orchestrator / next router; the hub does not push routes directly except the
//     glossary link.
//
// ANIMATION (framer-motion only, NO new dependency) — UNCHANGED from the original:
//   spring pop-in, per-step slide+fade, looping idle icon animation, animated
//   progress dots, and the outro sparkle/confetti burst.
//
// IDLE AUTO-LEAD (refinement 1b)
//   The hub never dead-ends. Every timed hub state runs a visible "continuing in Ns"
//   countdown (HUB_AUTO_ADVANCE_MS ~6s) and then auto-proceeds, so a user who clicks
//   NOTHING is still carried all the way through:
//     - intro            -> after the countdown, advance to the first stop (as if the
//                           user clicked Start the tour).
//     - guide launcher   -> after the countdown, AUTO-LAUNCH that stop's page guide
//                           (as if the user clicked Show me on the <page>), so the
//                           passive user actually visits each page.
//     - return prompt     -> after the countdown, advance to the next stop (Continue).
//   The outro is terminal (no countdown). The countdown resets whenever the hub state
//   changes, and any manual click (Continue / Show me / Skip) naturally pre-empts it.
//   An active user just clicks and never waits; a passive user gets walked end to end.
//
// COPY RULES: NO em or en dashes in any user-facing string. (Box-drawing dashes in
// these comments never render to the user.)
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
  type TargetAndTransition,
} from "framer-motion";
import {
  IconConfetti,
  IconArrowRight,
  IconX,
  IconSparkles,
  IconCircleCheck,
  IconPlayerPlay,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGuidedTour } from "@/contexts/GuidedTourContext";
import type { GuidedStop, StopIdle } from "./guided-tour-stops";

// Window event the Header's replay button dispatches to force-open the tour. Kept on
// this module (unchanged signature) so Header.tsx's existing import keeps working.
const OPEN_EVENT = "afc:open-welcome-tour";

// Idle auto-advance window (refinement 1b). After this long with no click, a timed
// hub state auto-proceeds. ~6 seconds reads as "we will move on, but you have a beat".
const HUB_AUTO_ADVANCE_MS = 6000;

// Fire the "open the welcome tour" event. Imported by Header.tsx so the replay icon
// button can force-open the tour without prop drilling. The GuidedTourProvider
// listens for this event and calls start().
export function openWelcomeTour(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

// ── Motion variants (unchanged from the original WelcomeTour) ────────────────
// Overlay: simple fade. Card: spring pop-in with a gentle scale.
const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.85, y: 24 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 22, mass: 0.9 },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 16,
    transition: { duration: 0.18 },
  },
};

// Per-step content slide+fade. `direction` is +1 forward, -1 back, so the content
// slides in from the correct side. Custom passes the direction in.
const stepVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
  center: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 300, damping: 28 },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? -60 : 60,
    transition: { duration: 0.2 },
  }),
};

// The looping "idle" animation for each stop's big icon. Keyed by stop.idle so each
// stop feels distinct (a wave, a bounce, a pulse, a slow spin, a pop, a party shake).
const iconIdle = (
  kind: StopIdle,
  reduced: boolean | null,
): TargetAndTransition => {
  if (reduced) return {}; // respect prefers-reduced-motion: keep the icon still
  switch (kind) {
    case "wave":
      return {
        rotate: [0, 14, -8, 14, 0],
        transition: { duration: 1.6, repeat: Infinity, repeatDelay: 0.6 },
      };
    case "bounce":
      return {
        y: [0, -10, 0],
        transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
      };
    case "pulse":
      return {
        scale: [1, 1.12, 1],
        transition: { duration: 1.4, repeat: Infinity, ease: "easeInOut" },
      };
    case "spin":
      return {
        rotate: [0, 360],
        transition: { duration: 6, repeat: Infinity, ease: "linear" },
      };
    case "pop":
      return {
        scale: [1, 1.08, 0.96, 1.05, 1],
        transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
      };
    case "party":
      return {
        rotate: [0, -10, 10, -6, 6, 0],
        scale: [1, 1.06, 1, 1.06, 1],
        transition: { duration: 1.8, repeat: Infinity },
      };
    default:
      return {};
  }
};

// ── Celebratory sparkle/confetti burst (pure framer-motion, NO dependency) ───
// A ring of small coloured shards that fly outward + fade on the outro. Built once
// from a deterministic set of angles so it is SSR-safe (no Math.random at render).
// Brand colours only (green, gold, white) so it reads as AFC. (Unchanged.)
const BURST_PIECES = Array.from({ length: 18 }).map((_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  const distance = 90 + (i % 3) * 28; // staggered rings
  const colors = ["var(--primary)", "var(--gold)", "#ffffff"];
  return {
    id: i,
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    color: colors[i % colors.length],
    delay: (i % 6) * 0.04,
    size: 6 + (i % 3) * 3,
  };
});

function SparkleBurst({ reduced }: { reduced: boolean | null }) {
  if (reduced) return null; // no burst under prefers-reduced-motion
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible"
    >
      {BURST_PIECES.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-[2px]"
          style={{ width: p.size, height: p.size, backgroundColor: p.color }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
          animate={{
            x: p.x,
            y: p.y,
            scale: [0, 1.2, 0.4],
            opacity: [1, 1, 0],
            rotate: [0, 180],
          }}
          transition={{
            duration: 1.1,
            delay: p.delay,
            ease: "easeOut",
            repeat: Infinity,
            repeatDelay: 1.4,
          }}
        />
      ))}
    </div>
  );
}

// ── useAutoAdvance: the idle countdown that carries a passive user forward ────
// Given a stable `key` (which timed hub state we are on), an `enabled` flag, and an
// `onElapsed` callback, it counts DOWN from HUB_AUTO_ADVANCE_MS once per second and
// fires onElapsed at zero. It restarts whenever `key` changes (a new stop / state),
// and stops cleanly when disabled or unmounted. Returns `remaining` (whole seconds
// left) so the UI can render "continuing in Ns", or null when no countdown is active.
//
// `onElapsed` is read through a ref so a changing callback identity does not restart
// the countdown (only `key`/`enabled` do), which keeps the timer stable across the
// parent's re-renders.
function useAutoAdvance(
  key: string,
  enabled: boolean,
  onElapsed: () => void,
): number | null {
  const reduced = useReducedMotion();
  const totalSeconds = Math.round(HUB_AUTO_ADVANCE_MS / 1000);
  // Start null; the effect below sets the visible count when a countdown is running.
  // This avoids a one-frame "Continuing in 6s" flash for reduced-motion users (who
  // never show a ticker) or disabled states.
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const onElapsedRef = React.useRef(onElapsed);
  React.useEffect(() => {
    onElapsedRef.current = onElapsed;
  }, [onElapsed]);

  React.useEffect(() => {
    if (!enabled) {
      setRemaining(null);
      return;
    }
    // Respect prefers-reduced-motion users the SAME way (we still auto-advance so the
    // tour does not dead-end), but we do not need a visible per-second ticker; we run
    // a single timeout and leave `remaining` null so no countdown text renders.
    if (reduced) {
      setRemaining(null);
      const t = window.setTimeout(() => {
        onElapsedRef.current();
      }, HUB_AUTO_ADVANCE_MS);
      return () => window.clearTimeout(t);
    }

    // Visible countdown: tick down once per second; fire onElapsed at zero.
    setRemaining(totalSeconds);
    const interval = window.setInterval(() => {
      setRemaining((prev) => {
        const next = (prev ?? totalSeconds) - 1;
        if (next <= 0) {
          // Defer the callback out of the state updater so we never call a parent
          // setState during this component's render commit.
          window.setTimeout(() => onElapsedRef.current(), 0);
          window.clearInterval(interval);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
    // Restart only when the state we are on changes, or enabled flips.
  }, [key, enabled, reduced, totalSeconds]);

  return remaining;
}

// ── The hub overlay ───────────────────────────────────────────────────────────
// Rendered only while the orchestrator says isHubOpen. Reads the current stop +
// returnMode and decides what the card body shows: the intro, a guide-stop launcher,
// the "Continue?" return prompt, or the outro. Handles focus trap + Escape (Escape
// counts as Skip / ending the whole tour).
function HubOverlay() {
  const {
    index,
    stops,
    currentStop,
    returnMode,
    goToPageGuide,
    continueTour,
    skip,
    finish,
  } = useGuidedTour();
  const router = useRouter();
  const reduced = useReducedMotion();
  const cardRef = React.useRef<HTMLDivElement>(null);

  // currentStop is non-null whenever isHubOpen is true, but guard anyway so this
  // component is robust if it ever renders a tick before state settles.
  const stop: GuidedStop | null = currentStop ?? null;

  // Slide direction for the AnimatePresence step transition: advancing a stop or
  // returning from a page guide both read as "forward" (+1); intro -> first stop is
  // forward too. We only ever move forward in this flow, so +1 is correct.
  const direction = 1;

  // ── Skip / finish the whole tour ──
  const endTour = React.useCallback(() => {
    skip();
  }, [skip]);

  // ── Keyboard: Escape ends the tour (counts as Skip); focus trap inside the card. ──
  React.useEffect(() => {
    const card = cardRef.current;
    card?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        endTour();
        return;
      }
      // Simple focus trap: keep Tab within the card's focusable controls.
      if (e.key === "Tab" && card) {
        const focusables = card.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    // Lock background scroll while the modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [endTour]);

  // ── State derivation (null-safe so the hooks below run on EVERY render) ──
  // Rules of Hooks: useAutoAdvance + the useCallback under it must be called before
  // any early return, so every value they read is computed defensively against a
  // possibly-null `stop` here, ABOVE the `if (!stop) return null` guard.
  const stopKind = stop?.kind ?? null;
  const isIntro = stopKind === "intro";
  const isOutro = stopKind === "outro";
  const isGuide = stopKind === "guide";

  // ── Idle auto-advance wiring (refinement 1b) ──
  // Which states run the countdown: the intro, a guide launcher, and a guide return
  // prompt. The outro is terminal (no countdown). What "elapsed" does, per state:
  //   intro            -> continueTour() (advance to the first stop)
  //   guide launcher   -> goToPageGuide(route) (auto-visit the page)
  //   guide return     -> continueTour() (advance to the next stop)
  const isLauncher = isGuide && !returnMode && !!stop?.route;
  const isReturn = isGuide && returnMode;
  const autoEnabled = !!stop && (isIntro || isLauncher || isReturn);

  // A stable key per timed state so the countdown restarts on each new state but does
  // not reset on unrelated re-renders.
  const autoKey = `${stop?.id ?? "none"}-${returnMode ? "return" : "main"}`;
  const autoRoute = stop?.route;

  const handleAutoElapsed = React.useCallback(() => {
    if (isLauncher && autoRoute) {
      goToPageGuide(autoRoute);
    } else {
      // intro + return prompt both just advance.
      continueTour();
    }
  }, [isLauncher, autoRoute, goToPageGuide, continueTour]);

  const remaining = useAutoAdvance(autoKey, autoEnabled, handleAutoElapsed);

  // Past this point we need a concrete stop. (Defensive: currentStop is non-null
  // whenever isHubOpen is true, but a render could land a tick before state settles.)
  if (!stop) return null;

  const Icon = stop.icon;
  const accentVar = stop.accent === "gold" ? "var(--gold)" : "var(--primary)";
  const titleId = `welcome-step-title-${stop.id}`;
  // The motion key changes per render-state so the card animates between the launcher
  // and its return prompt (a small but satisfying flip), and between stops.
  const motionKey = `${stop.id}-${returnMode ? "return" : "main"}`;

  // For the return prompt we override the headline + body to the celebratory copy.
  const headline =
    isGuide && returnMode ? "Nice work!" : stop.title;
  const bodyText =
    isGuide && returnMode
      ? "That is one stop done. Ready for the next one?"
      : stop.body;

  // The countdown line shown under the primary button while a timer is ticking.
  const countdownText =
    remaining !== null && remaining > 0
      ? `Continuing in ${remaining}s`
      : null;

  return (
    <motion.div
      // ── Overlay scrim ──
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Dark scrim with a subtle brand gradient. Clicking it ends the tour (Skip). */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={endTour}
        aria-hidden
      />

      {/* ── The card ── */}
      <motion.div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={cn(
          "relative z-10 w-full max-w-md overflow-hidden rounded-md border bg-card py-6 shadow-2xl outline-none",
          "shadow-primary/10",
        )}
      >
        {/* Soft brand glow behind the card content (tints to the stop accent). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-gold/10"
        />

        {/* ── Skip (top corner) ends the whole tour ── */}
        <button
          type="button"
          onClick={endTour}
          aria-label="Skip the welcome tour"
          className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip
          <IconX className="h-3.5 w-3.5" />
        </button>

        {/* ── Animated content (slides between states) ── */}
        <div className="relative px-6 pt-4">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={motionKey}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="flex flex-col items-center text-center"
            >
              {/* Big animated icon inside a glowing accent halo. In return mode a
                  green check overlays so completion reads instantly. */}
              <div className="relative mb-5 flex h-24 w-24 items-center justify-center">
                {/* Pulsing halo ring. */}
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: accentVar, opacity: 0.15 }}
                  animate={
                    reduced
                      ? {}
                      : { scale: [1, 1.18, 1], opacity: [0.15, 0.05, 0.15] }
                  }
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                <div
                  className="relative flex h-20 w-20 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${accentVar}1f` }}
                >
                  {isGuide && returnMode ? (
                    // Completion check on the return prompt.
                    <motion.div
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 320, damping: 18 }}
                    >
                      <IconCircleCheck
                        className="h-10 w-10"
                        style={{ color: "var(--primary)" }}
                      />
                    </motion.div>
                  ) : (
                    <motion.div animate={iconIdle(stop.idle, reduced)}>
                      <Icon className="h-10 w-10" style={{ color: accentVar }} />
                    </motion.div>
                  )}
                </div>
                {/* The outro's celebratory burst sits behind the icon. */}
                {isOutro && <SparkleBurst reduced={reduced} />}
              </div>

              {/* Headline (green/gold primary, bold) + body. */}
              <h2
                id={titleId}
                className="text-2xl font-bold text-primary"
                style={
                  stop.accent === "gold" && !(isGuide && returnMode)
                    ? { color: "var(--gold)" }
                    : undefined
                }
              >
                {headline}
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                {bodyText}
              </p>

              {/* ── Primary action area, by state ── */}

              {/* Intro: start the tour (advance to the first guide stop). */}
              {isIntro && (
                <Button
                  type="button"
                  variant="gradient"
                  size="md"
                  className="mt-5"
                  onClick={continueTour}
                >
                  <IconPlayerPlay className="h-4 w-4" />
                  Start the tour
                </Button>
              )}

              {/* Guide stop, normal mode: launch the on-page spotlight. */}
              {isGuide && !returnMode && stop.route && (
                <Button
                  type="button"
                  variant="gradient"
                  size="md"
                  className="mt-5"
                  onClick={() => goToPageGuide(stop.route!)}
                >
                  <IconSparkles className="h-4 w-4" />
                  {stop.launchLabel ?? "Show me on the page"}
                </Button>
              )}

              {/* Guide stop, return mode: continue to the next stop. */}
              {isGuide && returnMode && (
                <Button
                  type="button"
                  variant="gradient"
                  size="md"
                  className="mt-5"
                  onClick={continueTour}
                >
                  Continue
                  <IconArrowRight className="h-4 w-4" />
                </Button>
              )}

              {/* Outro: glossary CTA + finish. */}
              {isOutro && (
                <div className="mt-5 flex flex-col items-center gap-2">
                  {stop.outroCta && (
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={() => {
                        // Navigate to the glossary, then end the tour.
                        const href = stop.outroCta!.href;
                        finish();
                        router.push(href);
                      }}
                    >
                      {stop.outroCta.label}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="gradient"
                    size="md"
                    onClick={finish}
                  >
                    Finish
                    <IconConfetti className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* ── Idle auto-advance countdown (refinement 1b) ──
                  A subtle "Continuing in Ns" line under the primary button on every
                  timed state (intro, launcher, return prompt). It tells the user the
                  tour will move on by itself so a passive user is never stranded; an
                  active user just clicks and never sees it reach zero. */}
              {countdownText && (
                <p
                  className="mt-3 text-xs font-medium text-muted-foreground"
                  aria-live="polite"
                >
                  {countdownText}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Progress dots (one per stop) ── */}
        <div className="relative mt-6 flex items-center justify-center gap-2">
          {stops.map((s, i) => {
            const isActive = i === index;
            return (
              <span key={s.id} className="flex h-4 items-center" aria-hidden>
                <motion.span
                  className="block rounded-full"
                  animate={{
                    width: isActive ? 22 : 8,
                    backgroundColor: isActive
                      ? "var(--primary)"
                      : "var(--muted-foreground)",
                    opacity: isActive ? 1 : i < index ? 0.7 : 0.4,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  style={{ height: 8 }}
                />
              </span>
            );
          })}
        </div>

        {/* ── Footer: stop counter + Skip the whole tour ── */}
        <div className="relative mt-6 flex items-center justify-between gap-3 px-6">
          <span className="text-xs font-medium text-muted-foreground">
            Stop {index + 1} of {stops.length}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={endTour}>
            Skip tour
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── useWelcomeTour: the small hook the replay button uses (kept for compatibility) ──
export function useWelcomeTour() {
  return { open: openWelcomeTour };
}

// ── <WelcomeTour>: the hub wrapper (mount once in (user)/layout.tsx) ──────────
// Reads the orchestrator and shows the hub overlay only when isHubOpen. The
// auto-start, replay, and persistence all live in the GuidedTourProvider, so this is
// now a thin presentational wrapper.
export function WelcomeTour() {
  const { isHubOpen } = useGuidedTour();
  return (
    <AnimatePresence>{isHubOpen && <HubOverlay />}</AnimatePresence>
  );
}

export default WelcomeTour;
