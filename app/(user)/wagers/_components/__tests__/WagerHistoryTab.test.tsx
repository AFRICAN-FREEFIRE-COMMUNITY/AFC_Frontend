/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { WagerHistoryTab } from "../WagerHistoryTab";
import { runSeed } from "@/lib/mock-wager/seed";

describe("WagerHistoryTab", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders empty state for users with no wagers", async () => {
    render(<WagerHistoryTab userId="user_no_wagers" />);
    await waitFor(
      () =>
        expect(
          screen.getByText(/haven't placed any wagers/i),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });

  it("renders the seeded user's wagers as cards", async () => {
    render(<WagerHistoryTab userId="player_1" />);
    await waitFor(
      () => expect(screen.getByTestId("wager-history-tab")).toBeInTheDocument(),
      { timeout: 4000 },
    );
    const cards = screen.getAllByTestId("market-card");
    expect(cards.length).toBeGreaterThan(0);
  });

  it("uses my-wager variant on each card", async () => {
    render(<WagerHistoryTab userId="player_1" />);
    await waitFor(
      () => expect(screen.getByTestId("wager-history-tab")).toBeInTheDocument(),
      { timeout: 4000 },
    );
    const cards = screen.getAllByTestId("market-card");
    for (const c of cards) {
      expect(c).toHaveAttribute("data-variant", "my-wager");
    }
  });

  it("respects custom title prop", async () => {
    render(<WagerHistoryTab userId="user_no_wagers" title="History" />);
    await waitFor(() => {
      expect(screen.getByText("History")).toBeInTheDocument();
    });
  });
});
