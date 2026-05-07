/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import KYCQueueClient from "../KYCQueueClient";
import { runSeed } from "@/lib/mock-wager/seed";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

describe("KYCQueueClient", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders the KYC page header", async () => {
    render(<KYCQueueClient />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /kyc/i })).toBeInTheDocument(),
    );
  });

  it("renders Tier-0 and Tier-Lite stat cards", async () => {
    render(<KYCQueueClient />);
    await waitFor(() =>
      expect(screen.getByTestId("tier-0-stat")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("tier-lite-stat")).toBeInTheDocument();
  });

  it("renders one row per non-house user", async () => {
    render(<KYCQueueClient />);
    await waitFor(() =>
      expect(screen.getAllByTestId("kyc-row").length).toBeGreaterThan(0),
    );
  });

  it("shows Force-verify button for TIER_0 users", async () => {
    render(<KYCQueueClient />);
    await waitFor(() =>
      expect(screen.getAllByTestId("manual-verify").length).toBeGreaterThan(0),
    );
  });
});
