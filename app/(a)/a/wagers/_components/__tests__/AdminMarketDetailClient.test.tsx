/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AdminMarketDetailClient from "../AdminMarketDetailClient";
import { runSeed } from "@/lib/mock-wager/seed";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

describe("AdminMarketDetailClient", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders market detail for a seed market", async () => {
    render(<AdminMarketDetailClient marketId="m_match5_winner" />);
    await waitFor(() =>
      expect(screen.getByTestId("admin-market-detail")).toBeInTheDocument(),
    );
    expect(screen.getByText(/Match 5 Winner/i)).toBeInTheDocument();
  });

  it("renders the options table headers", async () => {
    render(<AdminMarketDetailClient marketId="m_match5_winner" />);
    await waitFor(() =>
      expect(
        screen.getByRole("columnheader", { name: /label/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("columnheader", { name: /^wagers$/i })).toBeInTheDocument();
  });

  it("shows 'Market not found' for an unknown id", async () => {
    render(<AdminMarketDetailClient marketId="m_does_not_exist" />);
    await waitFor(() =>
      expect(screen.getByText(/Market not found/i)).toBeInTheDocument(),
    );
  });

  it("shows Lock-now button on OPEN markets", async () => {
    render(<AdminMarketDetailClient marketId="m_match5_winner" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /lock now/i })).toBeInTheDocument(),
    );
  });
});
