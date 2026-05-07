/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { WithdrawPanel } from "../WithdrawPanel";
import { runSeed } from "@/lib/mock-wager/seed";
import { getBalance } from "@/lib/mock-wager/handlers/wallet";

const fx = {
  id: "fx_test",
  captured_at: new Date().toISOString(),
  ngn_per_usd: 1500,
  source: "test",
};

describe("WithdrawPanel", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("shows the gated card for TIER_0 users", async () => {
    const balance = await getBalance("player_2");
    render(<WithdrawPanel userId="player_2" fx={fx} balance={balance} />);
    await waitFor(() =>
      expect(screen.getByTestId("withdraw-panel-gated")).toBeInTheDocument(),
    );
    expect(screen.getByText(/Verify to unlock withdraw/i)).toBeInTheDocument();
  });

  it("renders the form with both rail tabs for TIER_LITE", async () => {
    const balance = await getBalance("player_1");
    render(<WithdrawPanel userId="player_1" fx={fx} balance={balance} />);
    await waitFor(() =>
      expect(screen.getByTestId("withdraw-panel")).toBeInTheDocument(),
    );
    expect(screen.getByRole("tab", { name: /bank/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /crypto/i })).toBeInTheDocument();
  });

  it("shows the cashable balance label", async () => {
    const balance = await getBalance("player_1");
    render(<WithdrawPanel userId="player_1" fx={fx} balance={balance} />);
    await waitFor(() =>
      expect(screen.getByTestId("withdraw-panel")).toBeInTheDocument(),
    );
    expect(screen.getByText(/Cashable balance/i)).toBeInTheDocument();
  });

  it("disables submit until amount + bank fields populated", async () => {
    const balance = await getBalance("player_1");
    render(<WithdrawPanel userId="player_1" fx={fx} balance={balance} />);
    await waitFor(() =>
      expect(screen.getByTestId("withdraw-submit")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("withdraw-submit")).toBeDisabled();
  });

  it("renders the bank account input on the Bank tab", async () => {
    const balance = await getBalance("player_1");
    render(<WithdrawPanel userId="player_1" fx={fx} balance={balance} />);
    await waitFor(() =>
      expect(screen.getByTestId("account-input")).toBeInTheDocument(),
    );
  });
});
