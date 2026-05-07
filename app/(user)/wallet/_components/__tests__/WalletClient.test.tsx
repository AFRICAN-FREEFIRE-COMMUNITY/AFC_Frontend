/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import WalletClient from "../WalletClient";
import { runSeed } from "@/lib/mock-wager/seed";

describe("WalletClient", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders all 6 pill tabs", async () => {
    render(<WalletClient />);
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("tab", { name: /^deposit$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /withdraw/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^send$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /history/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /vouchers/i })).toBeInTheDocument();
  });

  it("shows the Wallet page header", async () => {
    render(<WalletClient />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /wallet/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders BalanceCard once balance loads", async () => {
    render(<WalletClient />);
    await waitFor(
      () => expect(screen.getByTestId("balance-card")).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });
});
