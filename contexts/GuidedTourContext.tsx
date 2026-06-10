"use client";

// ─────────────────────────────────────────────────────────────────────────────
// GuidedTourContext.tsx  —  the cross-page orchestrator for the INTERACTIVE
//                           guided welcome tour
// ----------------------------------------------------------------------------
// PURPOSE
//   The welcome tour is no longer a single modal carousel. It is now a multi-stop
//   GUIDED tour: at each stop the user clicks "Show me on the <page>", which
//   NAVIGATES to that real page, runs a driver.js on-page spotlight of the key
//   controls, and when that page guide finishes the hub modal POPS BACK UP asking
//   "Ready for the next stop?" (Continue / Skip). This context is the brain that
//   coordinates that flow ACROSS a full page navigation: it owns active / index /
//   phase and mirrors them into localStorage so a router.push to another route does
//   not lose the place.
//
// THE THREE PIECES (this is piece 1 of 3)
//   1. GuidedTourContext (THIS FILE)            — orchestrator state + API.
//   2. WelcomeTour.tsx (the hub modal)          — reads this context; renders the
//        animated intro, the per-stop "Show me" launchers, the "Continue?" return
//        prompt, and the celebratory outro.
//   3. PageGuide.tsx (the on-page driver)       — reads this context; on every route
//        change, if phase==="onpage" and the path matches the current stop, runs a
//        driver.js spotlight over that stop's [data-tour] anchors, then calls
//        finishPageGuide() so the hub returns.
//   Pieces 2 and 3 are both mounted once in app/(user)/layout.tsx, INSIDE this
//   provider (which is also mounted there).
//
// HOW IT CONNECTS (data + callers)
//   - AUTH: reads { user, token } from contexts/AuthContext (useAuth). The backend
//     User.has_seen_welcome flag (mapped in AuthContext) decides first-run for a
//     logged-in user; finish/skip POSTs /auth/mark-welcome-seen/ best-effort, the
//     exact same call the old WelcomeTour already made.
//   - NAVIGATION: uses next/navigation useRouter to push to a stop's route in
//     goToPageGuide(); PageGuide uses usePathname to know when it has arrived.
//   - PERSISTENCE (orchestration): the whole run lives in localStorage key
//     STATE_KEY ("afc_guided_tour_state", JSON { active, index, phase }) so it
//     survives the navigation between hub and page. Cleared on finish/skip.
//   - PERSISTENCE (seen): on finish/skip we set the anonymous localStorage seen flag
//     WELCOME_SEEN_KEY ("afc_welcome_seen_v1") AND (logged in) POST mark-welcome-seen,
//     matching the original WelcomeTour persistence idiom one-for-one.
//   - REPLAY: the Header sparkles button dispatches the existing window event
//     "afc:open-welcome-tour" (openWelcomeTour() in WelcomeTour.tsx). This provider
//     listens for it and force-starts the tour, so the Header needs no change.
//
// COPY RULES: NO em or en dashes in any user-facing string. (Box-drawing dashes in
// these comments never render to the user.)
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { GUIDED_STOPS, type GuidedStop } from "@/app/(user)/_components/guided-tour-stops";

// ── Storage keys + window event (shared with WelcomeTour.tsx) ────────────────
// The orchestration state (which stop, hub vs on-page) survives a navigation here.
const STATE_KEY = "afc_guided_tour_state";
// The permanent "the user has seen the welcome tour" flag for anonymous visitors.
// Logged-in users additionally use the backend has_seen_welcome flag. Versioned so
// the tour can be re-introduced later by bumping the suffix. MUST match the key the
// original WelcomeTour used so existing dismissals carry over.
const WELCOME_SEEN_KEY = "afc_welcome_seen_v1";
// The window event the Header's replay button dispatches (openWelcomeTour()).
const OPEN_EVENT = "afc:open-welcome-tour";

// ── Phase ────────────────────────────────────────────────────────────────────
// "hub"    -> the animated hub modal is the active surface (intro, a stop launcher,
//             a "Continue?" return prompt, or the outro).
// "onpage" -> the hub is hidden; PageGuide is (or is about to be) running a driver.js
//             spotlight on the current stop's real page.
export type GuidedPhase = "hub" | "onpage";

// The shape persisted to localStorage so navigation does not lose the place.
interface GuidedState {
  active: boolean;
  index: number; // current stop index into GUIDED_STOPS
  phase: GuidedPhase;
}

const INACTIVE_STATE: GuidedState = { active: false, index: 0, phase: "hub" };

// ── localStorage helpers (guarded: storage can throw in private mode / SSR) ──
function readState(): GuidedState {
  if (typeof window === "undefined") return INACTIVE_STATE;
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    if (!raw) return INACTIVE_STATE;
    const parsed = JSON.parse(raw) as Partial<GuidedState>;
    // Validate the index against the current stop list so a stale/corrupt value can
    // never index out of bounds.
    const index =
      typeof parsed.index === "number" &&
      parsed.index >= 0 &&
      parsed.index < GUIDED_STOPS.length
        ? parsed.index
        : 0;
    return {
      active: !!parsed.active,
      index,
      phase: parsed.phase === "onpage" ? "onpage" : "hub",
    };
  } catch {
    return INACTIVE_STATE;
  }
}

function writeState(state: GuidedState): void {
  if (typeof window === "undefined") return;
  try {
    if (!state.active) {
      window.localStorage.removeItem(STATE_KEY);
    } else {
      window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
    }
  } catch {
    /* storage unavailable - ignore */
  }
}

// Persist the anonymous "welcome seen" flag (read by the auto-start gate below and
// by the original WelcomeTour idiom).
function hasSeenAnon(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(WELCOME_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}
function setSeenAnon(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WELCOME_SEEN_KEY, "1");
  } catch {
    /* storage unavailable - ignore */
  }
}

// ── Context shape ─────────────────────────────────────────────────────────────
interface GuidedTourContextValue {
  // Raw orchestration state (consumed by WelcomeTour + PageGuide).
  active: boolean;
  index: number;
  phase: GuidedPhase;
  // True right after a page guide finishes: the hub should render the "Nice work!
  // Ready for the next stop?" return prompt for THIS index instead of its normal
  // launcher. Cleared when the user advances (continueTour) or the tour ends.
  returnMode: boolean;
  // Derived convenience: the hub modal should be visible.
  isHubOpen: boolean;
  // The current stop definition (null when index points at a modal-only step handled
  // entirely inside the hub, but here every index resolves to a stop so it is non-null
  // while active).
  currentStop: GuidedStop | null;
  // The full ordered stop list (so the hub can render progress dots etc.).
  stops: GuidedStop[];

  // API.
  start: () => void; // open the hub at the intro (index 0, phase hub)
  goToPageGuide: (route: string) => void; // persist phase=onpage + navigate
  finishPageGuide: () => void; // called by PageGuide when its driver ends
  continueTour: () => void; // advance from a return prompt to the next stop
  skip: () => void; // end the whole tour early (same as finish)
  finish: () => void; // end the whole tour (outro complete)
}

const GuidedTourContext = React.createContext<GuidedTourContextValue | undefined>(
  undefined,
);

// ── Provider ──────────────────────────────────────────────────────────────────
export function GuidedTourProvider({ children }: { children: React.ReactNode }) {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [state, setState] = React.useState<GuidedState>(INACTIVE_STATE);
  const [returnMode, setReturnMode] = React.useState(false);
  // Guards the once-per-session auto-start evaluation so a later auth re-render does
  // not re-open a tour the user already closed.
  const autoEvaluatedRef = React.useRef(false);

  // Helper that updates React state AND mirrors it into localStorage in one place,
  // so the persisted copy never drifts from what the UI is showing.
  const commit = React.useCallback((next: GuidedState) => {
    setState(next);
    writeState(next);
  }, []);

  // ── Hydrate from localStorage on mount ──
  // A page navigation re-mounts the whole provider, so on mount we restore any
  // in-flight run. If we land mid run in phase "onpage", PageGuide takes it from
  // there; if "hub", the hub re-opens at the saved index. When we restore an
  // onpage->? boundary we leave returnMode false (PageGuide will set the hub into
  // return mode via finishPageGuide once its driver ends).
  React.useEffect(() => {
    const restored = readState();
    if (restored.active) {
      setState(restored);
    }
  }, []);

  // ── start(): open the hub at the intro ──
  const start = React.useCallback(() => {
    setReturnMode(false);
    commit({ active: true, index: 0, phase: "hub" });
  }, [commit]);

  // ── goToPageGuide(route): launch a stop's on-page spotlight ──
  // Persist phase=onpage for the CURRENT index, then navigate to the stop's route.
  // PageGuide (mounted in the layout) sees phase==="onpage" + the matching pathname
  // and runs the driver.js tour after a short mount delay.
  const goToPageGuide = React.useCallback(
    (route: string) => {
      setReturnMode(false);
      // Persist BEFORE navigating so the new route's mounted provider reads the
      // onpage phase from storage even if React state is reset by the navigation.
      const next: GuidedState = { ...state, active: true, phase: "onpage" };
      commit(next);
      router.push(route);
    },
    [state, commit, router],
  );

  // ── finishPageGuide(): the on-page driver ended ──
  // Called by PageGuide on driver onDestroyed (finish / skip / Esc / overlay) OR
  // immediately when a stop resolves zero steps. Return to the hub for the SAME
  // index in "return" mode so it shows the "Ready for the next stop?" prompt.
  const finishPageGuide = React.useCallback(() => {
    setReturnMode(true);
    commit({ ...readState(), active: true, phase: "hub" });
  }, [commit]);

  // ── continueTour(): advance from a return prompt (or a modal step) ──
  // Move to the next stop in hub phase. If we are already on the last stop, the hub
  // itself routes to the outro / finish; here we simply bump the index and clear
  // return mode so the next stop's launcher shows.
  const continueTour = React.useCallback(() => {
    setReturnMode(false);
    const current = readState();
    const nextIndex = Math.min(current.index + 1, GUIDED_STOPS.length - 1);
    commit({ active: true, index: nextIndex, phase: "hub" });
  }, [commit]);

  // ── end the whole tour (finish == skip behaviour) ──
  // Clear the orchestration state, set the anonymous seen flag, and (logged in) POST
  // mark-welcome-seen best-effort. Mirrors the original WelcomeTour persistence.
  const endTour = React.useCallback(() => {
    setReturnMode(false);
    commit(INACTIVE_STATE);
    setSeenAnon();
    if (user && token) {
      axios
        .post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/mark-welcome-seen/`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        )
        .catch(() => {});
    }
  }, [commit, user, token]);

  const skip = endTour;
  const finish = endTour;

  // ── Replay: listen for the Header's force-open event (ignores the seen flags) ──
  React.useEffect(() => {
    const onOpen = () => start();
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [start]);

  // ── Auto-start on first run ──
  // Logged in -> start when user.has_seen_welcome === false.
  // Anonymous -> start when the localStorage seen flag is unset.
  // Only once per session (autoEvaluatedRef), never while auth is still loading, and
  // ONLY if a run is not already in flight (a navigation mid-tour restores via the
  // hydrate effect above, and must not be clobbered by a fresh auto-start).
  React.useEffect(() => {
    if (loading) return;
    if (autoEvaluatedRef.current) return;
    autoEvaluatedRef.current = true;

    // If localStorage already has an active run (we navigated mid-tour), do not
    // auto-start over it; the hydrate effect handles continuation.
    if (readState().active) return;

    const shouldShow = user ? user.has_seen_welcome === false : !hasSeenAnon();
    if (shouldShow) {
      // Small delay so the landing page paints first, then the hub springs in.
      const t = window.setTimeout(() => start(), 700);
      return () => window.clearTimeout(t);
    }
  }, [loading, user, start]);

  const currentStop =
    state.active && state.index >= 0 && state.index < GUIDED_STOPS.length
      ? GUIDED_STOPS[state.index]
      : null;

  const value: GuidedTourContextValue = {
    active: state.active,
    index: state.index,
    phase: state.phase,
    returnMode,
    isHubOpen: state.active && state.phase === "hub",
    currentStop,
    stops: GUIDED_STOPS,
    start,
    goToPageGuide,
    finishPageGuide,
    continueTour,
    skip,
    finish,
  };

  return (
    <GuidedTourContext.Provider value={value}>
      {children}
    </GuidedTourContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────
export function useGuidedTour() {
  const ctx = React.useContext(GuidedTourContext);
  if (!ctx) {
    throw new Error("useGuidedTour must be used within a GuidedTourProvider");
  }
  return ctx;
}
