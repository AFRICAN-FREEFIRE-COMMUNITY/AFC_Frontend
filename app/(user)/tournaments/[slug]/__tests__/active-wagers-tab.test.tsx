/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ActiveWagersTab } from "../_components/ActiveWagersTab";
import { runSeed } from "@/lib/mock-wager/seed";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

describe("ActiveWagersTab", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders the section header", async () => {
    render(<ActiveWagersTab eventIdOrSlug="afc-champs-finals" />);
    await waitFor(() =>
      expect(screen.getByTestId("active-wagers-tab")).toBeInTheDocument(),
    );
    // CardTitle is a div in shadcn/ui, not a semantic heading.
    expect(screen.getByText(/^active wagers$/i)).toBeInTheDocument();
  });

  it("renders MarketCards for an event with seeded OPEN markets (slug lookup)", async () => {
    render(<ActiveWagersTab eventIdOrSlug="afc-champs-finals" />);
    await waitFor(
      () => expect(screen.getByTestId("active-wagers-tab")).toBeInTheDocument(),
      { timeout: 4000 },
    );
    await waitFor(
      () => {
        const cards = screen.queryAllByTestId("market-card");
        expect(cards.length).toBeGreaterThan(0);
      },
      { timeout: 4000 },
    );
  });

  it("also accepts a direct event_id", async () => {
    render(<ActiveWagersTab eventIdOrSlug="e_champs_finals" />);
    await waitFor(
      () => {
        const cards = screen.queryAllByTestId("market-card");
        expect(cards.length).toBeGreaterThan(0);
      },
      { timeout: 4000 },
    );
  });

  it("renders empty state when no OPEN markets match the event", async () => {
    // e_last_week_cup is seeded with SETTLED markets only (no OPEN).
    render(<ActiveWagersTab eventIdOrSlug="afc-last-week-cup" />);
    await waitFor(
      () =>
        expect(
          screen.getByText(/no active wagers for this event yet/i),
        ).toBeInTheDocument(),
      { timeout: 4000 },
    );
  });

  it("renders empty state when slug doesn't resolve to any wager-mock event", async () => {
    render(<ActiveWagersTab eventIdOrSlug="some-real-afc-tournament-no-wagers" />);
    await waitFor(
      () =>
        expect(
          screen.getByText(/no active wagers for this event yet/i),
        ).toBeInTheDocument(),
      { timeout: 4000 },
    );
  });
});
