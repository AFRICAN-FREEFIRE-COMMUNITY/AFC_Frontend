/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BalanceCard } from "../BalanceCard";
import type { Balance } from "@/lib/mock-wager/types";

const fx = {
  id: "fx_test",
  captured_at: new Date().toISOString(),
  ngn_per_usd: 1500,
  source: "test",
};

const balance: Balance = {
  total_kobo: 25_000_000, // 500 coins, ₦250k, $166.67
  purchased_kobo: 15_000_000,
  won_kobo: 8_000_000,
  gift_kobo: 2_000_000,
  locked_kobo: 1_500_000,
  fx,
};

describe("BalanceCard", () => {
  it("renders the total balance hero", () => {
    render(<BalanceCard balance={balance} />);
    expect(screen.getByTestId("balance-card")).toBeInTheDocument();
    expect(screen.getByTestId("balance-total-coins").textContent).toContain(
      "500.00",
    );
  });

  it("renders all 4 sub-balances", () => {
    render(<BalanceCard balance={balance} />);
    expect(screen.getByText("Purchased")).toBeInTheDocument();
    expect(screen.getByText("Won")).toBeInTheDocument();
    expect(screen.getByText("Gift")).toBeInTheDocument();
    expect(screen.getByText("Locked in wagers")).toBeInTheDocument();
  });

  it("formats Naira amounts in each bucket", () => {
    render(<BalanceCard balance={balance} />);
    // Purchased = 15M kobo = ₦150,000 → "₦150,000.00"
    expect(screen.getByText(/₦150,000\.00/)).toBeInTheDocument();
  });

  it("renders zero values gracefully", () => {
    const empty: Balance = {
      total_kobo: 0,
      purchased_kobo: 0,
      won_kobo: 0,
      gift_kobo: 0,
      locked_kobo: 0,
      fx,
    };
    render(<BalanceCard balance={empty} />);
    expect(screen.getByTestId("balance-total-coins").textContent).toContain(
      "0.00",
    );
  });
});
