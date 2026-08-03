// ─────────────────────────────────────────────────────────────────────────────
// useEventCreateDraft - auto-save the multi-step event CREATE wizard to localStorage
// so an organizer/admin who navigates Back (or refreshes / crashes) does NOT lose
// their in-progress work (owner 2026-07-01: "was in step 5, pressed back, all my
// work disappeared").
//
// WHY localStorage (not a backend draft): the backend create-event endpoint requires
// ALL core fields even for is_draft=True, so a server draft can't hold "half-finished
// at step 2" work. localStorage persists the exact in-progress form state per surface.
//
// WHAT IT PERSISTS: the whole React-Hook-Form value tree (form.getValues(), including
// the stages[]/groups[] array) + the wizard's extra useState (currentStep, stageNames,
// rulesInputMethod). NON-serializable File states (banner / rules document + their
// object-URL previews) are NOT saved - the resume dialog tells the user to re-attach
// those. Everything else round-trips as JSON.
//
// HOW IT CONNECTS: consumed by both event CREATE pages
//   app/(a)/a/events/create/page.tsx (key "afc:event-create-draft:admin")
//   app/(organizer)/organizer/events/create/page.tsx (key ".../org:<orgId>")
// paired with <EventDraftResumeDialog/>. The page provides a snapshot() of the current
// state; this hook debounces + writes it, reads any prior draft ONCE on mount (so the
// page can offer Resume / Start-fresh), and exposes clear() to wipe the draft on a
// successful submit. Autosave stays OFF until the prior draft is resolved (resume or
// discard) so the freshly-mounted empty form never overwrites a saved draft; it is also
// OFF while `active` is false (e.g. during the ?duplicate= prefill).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";

export interface EventCreateDraftBody {
  values: Record<string, unknown>; // form.getValues()
  currentStep: number;
  stageNames: string[];
  rulesInputMethod: string;
}

export interface EventCreateDraft extends EventCreateDraftBody {
  savedAt: number; // epoch ms, for the "you have a draft from …" prompt
}

export function useEventCreateDraft(opts: {
  storageKey: string;
  active: boolean; // false disables autosave + restore (e.g. duplicate-prefill running)
  snapshot: () => EventCreateDraftBody; // current state, read at each debounced save
  deps: unknown[]; // change triggers (the watched form values + the extra useState)
  debounceMs?: number;
  // Only persist when the in-progress form has real content (e.g. an event name entered). Without
  // this an EMPTY freshly-mounted form would autosave a blank draft, and the next visit would then
  // wrongly prompt "resume your unsaved event?" for nothing. Defaults to always-save.
  shouldSave?: (body: EventCreateDraftBody) => boolean;
}) {
  const { storageKey, active, snapshot, deps, debounceMs = 800, shouldSave } = opts;

  // The prior draft found on mount (null = none). While non-null and unresolved the page
  // shows the resume dialog; autosave is suppressed so it can't clobber this draft.
  const [savedDraft, setSavedDraft] = useState<EventCreateDraft | null>(null);
  const [resolved, setResolved] = useState(false);

  // Keep the latest snapshot fn in a ref so the debounced writer always reads current state.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  // ── Read any existing draft ONCE on mount. No draft (or inactive) => autosave right away. ──
  useEffect(() => {
    if (!active) {
      setResolved(true);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as EventCreateDraft) : null;
      // Only surface a draft that actually has content; a blank leftover is cleaned + ignored so the
      // resume prompt never appears for an empty form.
      if (parsed && (!shouldSave || shouldSave(parsed))) {
        setSavedDraft(parsed);
      } else {
        if (raw) {
          try {
            localStorage.removeItem(storageKey);
          } catch {
            /* ignore */
          }
        }
        setResolved(true);
      }
    } catch {
      setResolved(true);
    }
    // storageKey/active are stable for the page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Debounced autosave, only once the prior draft is resolved + the surface is active. ──
  const enabled = resolved && active;
  useEffect(() => {
    if (!enabled) return;
    const id = setTimeout(() => {
      try {
        const body = snapshotRef.current();
        // Don't persist an empty form (would wrongly trigger the resume prompt next visit).
        if (shouldSave && !shouldSave(body)) return;
        localStorage.setItem(
          storageKey,
          JSON.stringify({ ...body, savedAt: Date.now() }),
        );
      } catch {
        /* quota / disabled storage -> silently skip (never block the form) */
      }
    }, debounceMs);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, storageKey, debounceMs, ...deps]);

  // Remove the saved draft (call on successful submit).
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  // "Start fresh": wipe the draft + enable autosave for the empty form.
  const discard = useCallback(() => {
    clear();
    setSavedDraft(null);
    setResolved(true);
  }, [clear]);

  // "Resume": the page applies savedDraft to its state, then calls this to hide the dialog
  // and (re)enable autosave. The key is kept (it will be overwritten by the next autosave).
  const markResumed = useCallback(() => {
    setSavedDraft(null);
    setResolved(true);
  }, []);

  return { savedDraft, clear, discard, markResumed };
}
