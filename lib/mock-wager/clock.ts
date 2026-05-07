const STORAGE_KEY = "afc-wager-mock:clock-offset-ms";

type ClockEvent = "clock:ticked" | "clock:jumped" | "clock:reset";
type Listener = (kind: ClockEvent, payload?: { delta_ms?: number }) => void;

const listeners = new Set<Listener>();
let tickInterval: ReturnType<typeof setInterval> | null = null;

// Memory fallback for SSR / test environments where localStorage is unavailable
// (happy-dom 20 requires a CLI flag for localStorage; node has no window).
const memoryStore = new Map<string, string>();

function safeStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  if (typeof window !== "undefined") {
    const ls = window.localStorage;
    if (ls && typeof ls.setItem === "function") return ls;
  }
  return {
    getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k)! : null),
    setItem: (k, v) => {
      memoryStore.set(k, v);
    },
    removeItem: (k) => {
      memoryStore.delete(k);
    },
  };
}

function getOffset(): number {
  const raw = safeStorage().getItem(STORAGE_KEY);
  return raw ? parseInt(raw, 10) || 0 : 0;
}

function setOffset(ms: number): void {
  safeStorage().setItem(STORAGE_KEY, String(ms));
}

export function mockNow(): number {
  return Date.now() + getOffset();
}

export function advanceClock(ms: number): void {
  setOffset(getOffset() + ms);
  emit("clock:jumped", { delta_ms: ms });
}

export function resetClock(): void {
  setOffset(0);
  emit("clock:reset");
}

export function addClockListener(fn: Listener): () => void {
  listeners.add(fn);
  if (!tickInterval && typeof window !== "undefined") {
    tickInterval = setInterval(() => emit("clock:ticked"), 1000);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  };
}

function emit(kind: ClockEvent, payload?: { delta_ms?: number }): void {
  for (const fn of listeners) fn(kind, payload);
}

export function isPastLockAt(lock_at: string): boolean {
  return mockNow() >= new Date(lock_at).getTime();
}
