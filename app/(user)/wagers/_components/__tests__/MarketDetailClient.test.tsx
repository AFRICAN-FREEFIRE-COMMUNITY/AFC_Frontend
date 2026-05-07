/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MarketDetailClient from "../MarketDetailClient";
import { runSeed } from "@/lib/mock-wager/seed";
import { listMarkets } from "@/lib/mock-wager/handlers/markets";

describe("MarketDetailClient", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders the market title", async () => {
    const markets = await listMarkets({ status: "OPEN" });
    const m = markets[0];
    render(<MarketDetailClient marketId={m.id} />);
    await waitFor(
      () => expect(screen.getByText(m.title)).toBeInTheDocument(),
      { timeout: 4000 },
    );
  });

  it("renders the Options section", async () => {
    const markets = await listMarkets({ status: "OPEN" });
    const m = markets[0];
    render(<MarketDetailClient marketId={m.id} />);
    await waitFor(
      () => expect(screen.getByText(/options/i)).toBeInTheDocument(),
      { timeout: 4000 },
    );
  });

  it("shows the Place Wager button on OPEN markets", async () => {
    const markets = await listMarkets({ status: "OPEN" });
    const m = markets[0];
    render(<MarketDetailClient marketId={m.id} />);
    await waitFor(
      () => expect(screen.getByTestId("open-sheet")).toBeInTheDocument(),
      { timeout: 4000 },
    );
  });

  it("renders the winner badge for SETTLED markets", async () => {
    const markets = await listMarkets({ status: "SETTLED" });
    const m = markets.find((x) => x.winning_option_id);
    if (!m) return; // seed may have no settled markets
    render(<MarketDetailClient marketId={m.id} />);
    await waitFor(
      () => {
        expect(screen.getByTestId("winning-option")).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
  });
});
