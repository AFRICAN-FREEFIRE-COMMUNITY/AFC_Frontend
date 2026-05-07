import { describe, it, expect, beforeEach } from "vitest";
import { mockNow, advanceClock, resetClock, addClockListener } from "../clock";

describe("mock clock", () => {
  beforeEach(() => {
    resetClock();
  });

  it("starts at real-time when not advanced", () => {
    const real = Date.now();
    expect(Math.abs(mockNow() - real)).toBeLessThan(250);
  });

  it("advances by milliseconds and persists offset", () => {
    const start = mockNow();
    advanceClock(60_000);
    expect(mockNow() - start).toBeGreaterThanOrEqual(60_000);
  });

  it("emits clock:jumped when advanced", () => {
    const events: string[] = [];
    const unsub = addClockListener((kind) => events.push(kind));
    advanceClock(5_000);
    unsub();
    expect(events).toContain("clock:jumped");
  });

  it("resets cleanly", () => {
    advanceClock(10_000);
    resetClock();
    const real = Date.now();
    expect(Math.abs(mockNow() - real)).toBeLessThan(250);
  });
});
