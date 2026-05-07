/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LockCountdown } from "../LockCountdown";

describe("LockCountdown", () => {
  it("renders Awaiting Result when lock is in the past", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    render(<LockCountdown lockAt={past} />);
    await waitFor(() =>
      expect(screen.getByTestId("lock-countdown")).toHaveAttribute(
        "data-status",
        "locked",
      ),
    );
  });

  it("renders countdown text when lock is in the future", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1h
    render(<LockCountdown lockAt={future} />);
    expect(screen.getByTestId("lock-countdown")).toBeInTheDocument();
    expect(screen.getByTestId("lock-countdown-text").textContent).toBeTruthy();
  });

  it("uses 'hot' status when below 60s", () => {
    const future = new Date(Date.now() + 30_000).toISOString(); // +30s
    render(<LockCountdown lockAt={future} />);
    expect(screen.getByTestId("lock-countdown")).toHaveAttribute(
      "data-status",
      "hot",
    );
  });

  it("fires onLocked exactly once when countdown ends", async () => {
    const onLocked = vi.fn();
    const past = new Date(Date.now() - 1000).toISOString();
    render(<LockCountdown lockAt={past} onLocked={onLocked} />);
    await waitFor(() => expect(onLocked).toHaveBeenCalledTimes(1));
  });
});
