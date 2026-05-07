/// <reference types="@testing-library/jest-dom" />
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { WalletProvider, useWallet } from "@/contexts/WalletContext";
import { runSeed } from "@/lib/mock-wager/seed";
import { credit } from "@/lib/mock-wager/handlers/wallet";

function Probe() {
  const { balance, loading } = useWallet();
  if (loading) return <div data-testid="status">loading</div>;
  if (!balance) return <div data-testid="status">empty</div>;
  return (
    <div>
      <div data-testid="status">ready</div>
      <div data-testid="total">{balance.total_kobo}</div>
      <div data-testid="purchased">{balance.purchased_kobo}</div>
    </div>
  );
}

describe("WalletContext", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("loads balance for authenticated user", async () => {
    render(
      <WalletProvider userId="player_1">
        <Probe />
      </WalletProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("ready"),
    );
    expect(screen.getByTestId("total").textContent).not.toBe("");
  });

  it("returns null balance when userId is null", async () => {
    render(
      <WalletProvider userId={null}>
        <Probe />
      </WalletProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("empty"),
    );
  });

  it("refreshes when wallet:credited fires", async () => {
    render(
      <WalletProvider userId="player_1">
        <Probe />
      </WalletProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("ready"),
    );
    const initial = Number(screen.getByTestId("purchased").textContent);

    await act(async () => {
      await credit({
        user_id: "player_1",
        amount_kobo: 100_000,
        kind: "DEPOSIT_PAYSTACK",
        source_tag: "PURCHASED",
        ref_type: "deposit_intent",
        ref_id: "test-credit-1",
        idempotency_key: "test-credit-key-1",
      });
    });

    await waitFor(() => {
      const cur = Number(screen.getByTestId("purchased").textContent);
      expect(cur).toBe(initial + 100_000);
    });
  });

  it("throws when used outside provider", () => {
    function Bad() {
      useWallet();
      return null;
    }
    expect(() => render(<Bad />)).toThrow(/WalletProvider/);
  });
});
