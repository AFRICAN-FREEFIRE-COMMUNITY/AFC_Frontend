"use client";

// ─────────────────────────────────────────────────────────────────────────────
// First-visit layers, one at a time.
//
// Apple design fix 14 (owner approved the mockup 24 Oct 2026, inbox #381; mockup
// mockups/apple-design-fixes/ section 14). On a first visit several things used to open over the
// first screen at once: the "New access" card under the menu button, the welcome tour, and the Help
// button on top of both. Apple's rule is "don't interrupt; one thing at a time". This tiny queue
// is how the layers take turns: each asks for a turn while it has something to show, the lowest
// order goes first, and a layer that is already showing keeps its turn until it is done.
//
// Who takes part (lowest order first):
//   1  the "New access" card      app/(user)/_components/DashboardIntroCoachmark.tsx
//   2  the welcome tour (hub)     contexts/GuidedTourContext.tsx (auto-start waits for its turn)
// And who steps aside while any of them shows: the Help button (components/help/HelpBot.tsx), which
// also steps aside while a driver.js page tour is running (body.driver-active).
//
// Module state, not React context: the layers live in different parts of the tree (the header, the
// tour provider, the root layout), and a turn must survive any one of them re-rendering. Nothing is
// stored anywhere; a reload starts the queue empty and each layer asks again if it still has to show.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useSyncExternalStore } from "react";

/** The order layers take their turn in. Lower goes first. */
export const FIRST_VISIT_ORDER = {
  dashboardIntro: 1,
  welcomeTour: 2,
} as const;

const wanting = new Map<string, number>();
let showing: string | null = null;
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = () => version;

/** Whose turn it is: the layer already showing, else the lowest order waiting. */
function currentTurn(): string | null {
  if (showing && wanting.has(showing)) return showing;
  let best: string | null = null;
  let bestOrder = Infinity;
  for (const [id, order] of wanting) {
    if (order < bestOrder) {
      best = id;
      bestOrder = order;
    }
  }
  return best;
}

/**
 * Ask for a turn while `wants` is true. Returns true while it is this layer's turn; render the
 * layer only then. Set `wants` false (or unmount) when the layer is done, and the next one goes.
 */
export function useFirstVisitTurn(id: string, order: number, wants: boolean): boolean {
  useSyncExternalStore(subscribe, snapshot, snapshot);

  useEffect(() => {
    if (!wants) return;
    wanting.set(id, order);
    emit();
    return () => {
      wanting.delete(id);
      if (showing === id) showing = null;
      emit();
    };
  }, [id, order, wants]);

  const mine = wants && currentTurn() === id;
  // Once shown, the layer keeps its turn even if a lower order asks later (it is never cut off).
  useEffect(() => {
    if (mine) showing = id;
  }, [mine, id]);
  return mine;
}

/** True while any first-visit layer has the floor (the Help button steps aside). */
export function useAnyFirstVisitLayer(): boolean {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return currentTurn() !== null;
}
