/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import WithdrawalsClient from "../WithdrawalsClient";
import { runSeed } from "@/lib/mock-wager/seed";
import { startWithdrawal } from "@/lib/mock-wager/handlers/wallet";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

describe("WithdrawalsClient", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders the Withdrawals page header", async () => {
    render(<WithdrawalsClient />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /withdrawals/i }),
      ).toBeInTheDocument(),
    );
  });

  it("renders the table even when no withdrawals exist", async () => {
    render(<WithdrawalsClient />);
    await waitFor(() =>
      expect(screen.getByTestId("withdrawals-table")).toBeInTheDocument(),
    );
    expect(screen.getByText(/No withdrawals match/i)).toBeInTheDocument();
  });

  it("renders rows after a withdrawal is created", async () => {
    await startWithdrawal({
      user_id: "player_1",
      amount_kobo: 500_000,
      rail: "PAYSTACK_TRANSFER",
      destination: { account_number: "0123456789", bank_code: "058", bank_name: "GTBank" },
    });
    render(<WithdrawalsClient />);
    await waitFor(() =>
      expect(screen.getByTestId("withdrawal-row")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("approve-btn")).toBeInTheDocument();
  });

  it("renders the status filter", async () => {
    render(<WithdrawalsClient />);
    await waitFor(() =>
      expect(screen.getByTestId("status-filter")).toBeInTheDocument(),
    );
  });
});
