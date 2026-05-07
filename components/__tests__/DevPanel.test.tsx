/// <reference types="@testing-library/jest-dom" />
import React from "react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";

// Mock env BEFORE importing DevPanel
const envMock = vi.hoisted(() => ({ NEXT_PUBLIC_WAGER_MOCK: true }));
vi.mock("@/lib/env", () => ({ env: envMock }));

// Spy on advanceClock so we can assert call args without poking storage
const clockMocks = vi.hoisted(() => ({
  advanceClock: vi.fn(),
  resetClock: vi.fn(),
  addClockListener: vi.fn(() => () => {}),
  mockNow: vi.fn(() => Date.UTC(2026, 4, 7, 12, 0, 0)),
}));
vi.mock("@/lib/mock-wager/clock", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mock-wager/clock")>(
    "@/lib/mock-wager/clock",
  );
  return {
    ...actual,
    advanceClock: clockMocks.advanceClock,
    resetClock: clockMocks.resetClock,
    addClockListener: clockMocks.addClockListener,
    mockNow: clockMocks.mockNow,
  };
});

const storeMocks = vi.hoisted(() => ({
  resetDB: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/mock-wager/store", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mock-wager/store")>(
    "@/lib/mock-wager/store",
  );
  return { ...actual, resetDB: storeMocks.resetDB };
});

import { DevPanel } from "@/components/DevPanel";
import { runSeed } from "@/lib/mock-wager/seed";

function expandPanel() {
  const fab = screen.getByTestId("dev-panel-fab");
  fireEvent.click(fab);
}

// happy-dom (without --localstorage-file CLI flag) ships a partial Storage —
// some methods are missing. Our DevPanel reads the clock offset directly from
// localStorage; install a working in-memory polyfill before the suite runs.
function installLocalStoragePolyfill() {
  const memory = new Map<string, string>();
  const stub: Storage = {
    get length() {
      return memory.size;
    },
    clear: () => memory.clear(),
    getItem: (k: string) => (memory.has(k) ? memory.get(k)! : null),
    setItem: (k: string, v: string) => {
      memory.set(k, v);
    },
    removeItem: (k: string) => {
      memory.delete(k);
    },
    key: (i: number) => Array.from(memory.keys())[i] ?? null,
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: stub,
  });
}

if (typeof window.confirm !== "function") {
  Object.defineProperty(window, "confirm", {
    configurable: true,
    value: () => true,
  });
}

describe("DevPanel", () => {
  beforeEach(async () => {
    envMock.NEXT_PUBLIC_WAGER_MOCK = true;
    clockMocks.advanceClock.mockClear();
    clockMocks.resetClock.mockClear();
    storeMocks.resetDB.mockClear();
    installLocalStoragePolyfill();
    await act(async () => {
      indexedDB.deleteDatabase("afc-wager-mock");
      await runSeed();
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("does not render when MOCK=0", () => {
    envMock.NEXT_PUBLIC_WAGER_MOCK = false;
    const { container } = render(<DevPanel />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a collapsed FAB by default and expands on click", async () => {
    render(<DevPanel />);
    expect(screen.getByTestId("dev-panel-fab")).toBeInTheDocument();
    expandPanel();
    await waitFor(() =>
      expect(screen.getByTestId("dev-panel")).toBeInTheDocument(),
    );
  });

  it("loads seeded users into the user dropdown", async () => {
    render(<DevPanel />);
    expandPanel();
    await waitFor(() =>
      expect(screen.getByTestId("dev-user-select")).toBeInTheDocument(),
    );
    const select = screen.getByTestId("dev-user-select") as HTMLSelectElement;
    // Wait for users to populate (async useEffect)
    await waitFor(() => {
      expect(select.querySelectorAll("option").length).toBeGreaterThan(1);
    });
    // Should include at least the seeded house + player_1 personae.
    const text = select.textContent ?? "";
    expect(text).toMatch(/StormBreaker|stormbreaker/);
  });

  it("clock buttons advance by the correct number of ms", async () => {
    render(<DevPanel />);
    expandPanel();
    await waitFor(() =>
      expect(screen.getByTestId("dev-clock-1m")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("dev-clock-1m"));
    fireEvent.click(screen.getByTestId("dev-clock-5m"));
    fireEvent.click(screen.getByTestId("dev-clock-15m"));
    expect(clockMocks.advanceClock).toHaveBeenNthCalledWith(1, 60_000);
    expect(clockMocks.advanceClock).toHaveBeenNthCalledWith(2, 5 * 60_000);
    expect(clockMocks.advanceClock).toHaveBeenNthCalledWith(3, 15 * 60_000);
  });

  it("Reset DB calls resetDB after user confirms", async () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });
    const confirmSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(window, "confirm", {
      configurable: true,
      value: confirmSpy,
    });
    render(<DevPanel />);
    expandPanel();
    await waitFor(() =>
      expect(screen.getByTestId("dev-reset-db")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("dev-reset-db"));
    await waitFor(() => {
      expect(storeMocks.resetDB).toHaveBeenCalled();
    });
    expect(confirmSpy).toHaveBeenCalled();
  });

  it("Export JSON downloads a payload using a Blob URL", async () => {
    const createObjUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock");
    const revokeObjUrl = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});

    render(<DevPanel />);
    expandPanel();
    await waitFor(() =>
      expect(screen.getByTestId("dev-export-json")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("dev-export-json"));
    await waitFor(() => {
      expect(createObjUrl).toHaveBeenCalled();
    });
    expect(revokeObjUrl).toHaveBeenCalled();
  });

  it("Trigger settle is callable and resolves without throwing", async () => {
    render(<DevPanel />);
    expandPanel();
    await waitFor(() =>
      expect(screen.getByTestId("dev-clock-trigger-settle")).toBeInTheDocument(),
    );
    // Call it — even with no PENDING_SETTLEMENT markets it must not throw.
    expect(() =>
      fireEvent.click(screen.getByTestId("dev-clock-trigger-settle")),
    ).not.toThrow();
  });
});
