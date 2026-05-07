/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import SettlementQueueClient from "../SettlementQueueClient";
import { runSeed } from "@/lib/mock-wager/seed";
import { getDB } from "@/lib/mock-wager/store";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

describe("SettlementQueueClient", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders the empty state when no markets are pending", async () => {
    render(<SettlementQueueClient />);
    await waitFor(() =>
      expect(screen.getByTestId("settlement-queue-empty")).toBeInTheDocument(),
    );
    expect(screen.getByText(/queue is clear/i)).toBeInTheDocument();
  });

  it("renders pending market cards once a market enters PENDING_SETTLEMENT", async () => {
    const db = await getDB();
    const m = await db.get("markets", "m_match4_winner_finals");
    if (m) {
      m.status = "PENDING_SETTLEMENT";
      await db.put("markets", m);
    }
    render(<SettlementQueueClient />);
    await waitFor(() =>
      expect(screen.getByTestId("settlement-queue-grid")).toBeInTheDocument(),
    );
    expect(
      await screen.findByTestId("pending-market-card"),
    ).toBeInTheDocument();
  });

  it("renders the page header with the count", async () => {
    render(<SettlementQueueClient />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /settlement queue/i }),
      ).toBeInTheDocument(),
    );
  });
});
