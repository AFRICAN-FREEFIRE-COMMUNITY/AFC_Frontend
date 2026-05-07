/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import CosignQueueClient from "../CosignQueueClient";
import { runSeed } from "@/lib/mock-wager/seed";
import { startWithdrawal } from "@/lib/mock-wager/handlers/wallet";
import { credit } from "@/lib/mock-wager/handlers/wallet";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

// Mock the AuthContext: dev-mode pass-through (no user) is allowed.
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

describe("CosignQueueClient", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders the Cosign queue header when no auth gate hits", async () => {
    render(<CosignQueueClient />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /cosign queue/i }),
      ).toBeInTheDocument(),
    );
  });

  it("renders the empty state when no items pending", async () => {
    render(<CosignQueueClient />);
    await waitFor(() =>
      expect(screen.getByText(/no withdrawals awaiting cosign/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/no adjustments awaiting cosign/i)).toBeInTheDocument();
  });

  it("renders a withdrawal row when a >₦5M withdrawal exists", async () => {
    // Top up player_3 first to fund a big withdrawal
    await credit({
      user_id: "player_3",
      amount_kobo: 600_000_00,
      kind: "DEPOSIT_PAYSTACK",
      source_tag: "PURCHASED",
      ref_type: "test",
      ref_id: "test_topup",
      idempotency_key: "test_topup_key",
    });
    await startWithdrawal({
      user_id: "player_3",
      amount_kobo: 600_000_00, // ₦6M — over cosign threshold
      rail: "PAYSTACK_TRANSFER",
      destination: { account_number: "0123456789", bank_code: "058", bank_name: "GTBank" },
    });
    render(<CosignQueueClient />);
    await waitFor(() =>
      expect(screen.getByTestId("cosign-w-row")).toBeInTheDocument(),
    );
  });

  it("renders both withdrawal + adjustment tables", async () => {
    render(<CosignQueueClient />);
    await waitFor(() =>
      expect(screen.getByTestId("cosign-withdrawals-table")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("cosign-adjustments-table")).toBeInTheDocument();
  });
});

