/// <reference types="@testing-library/jest-dom" />
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";

// Hoisted vi.mock requires factories to declare their own mocks. We re-import
// the seed module spy after each mock so toHaveBeenCalled checks work cleanly.
const runSeedMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/mock-wager/seed", () => ({
  runSeed: runSeedMock,
}));

const envMock = vi.hoisted(() => ({
  NEXT_PUBLIC_WAGER_MOCK: true,
}));

vi.mock("@/lib/env", () => ({
  env: envMock,
}));

import { MockBootstrap } from "@/components/MockBootstrap";

describe("MockBootstrap", () => {
  beforeEach(() => {
    runSeedMock.mockClear();
    runSeedMock.mockResolvedValue(undefined);
    envMock.NEXT_PUBLIC_WAGER_MOCK = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls runSeed once on mount when MOCK=1", () => {
    const { container } = render(<MockBootstrap />);
    expect(runSeedMock).toHaveBeenCalledTimes(1);
    // Renders null
    expect(container.firstChild).toBeNull();
  });

  it("does not call runSeed when MOCK=0", () => {
    envMock.NEXT_PUBLIC_WAGER_MOCK = false;
    render(<MockBootstrap />);
    expect(runSeedMock).not.toHaveBeenCalled();
  });

  it("swallows seed errors so the app never crashes on bootstrap", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    runSeedMock.mockRejectedValueOnce(new Error("idb gone"));
    render(<MockBootstrap />);
    // Allow the swallowed promise rejection to settle
    await new Promise((r) => setTimeout(r, 10));
    expect(runSeedMock).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("re-mount re-invokes seed (runSeed is itself idempotent via isSeeded check)", () => {
    const { unmount } = render(<MockBootstrap />);
    unmount();
    render(<MockBootstrap />);
    expect(runSeedMock).toHaveBeenCalledTimes(2);
  });
});
