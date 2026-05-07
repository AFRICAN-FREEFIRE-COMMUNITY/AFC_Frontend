/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mock env BEFORE importing anything that pulls in lib/env (transitive
// through OrdersClient -> AuthContext / axios).
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_BACKEND_API_URL: "https://api.test.local",
    NEXT_PUBLIC_URL: "https://test.local",
    NEXT_PUBLIC_WAGER_MOCK: false,
  },
}));

import { WalletTopupsTab } from "../_components/WalletTopupsTab";
import { runSeed } from "@/lib/mock-wager/seed";
import { credit } from "@/lib/mock-wager/handlers/wallet";

describe("WalletTopupsTab", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders the empty state when the user has no wallet at all", async () => {
    // A user_id that doesn't exist in the seed has no wallet, so listTxns
    // returns [] for every kind.
    render(<WalletTopupsTab userId="fresh_user_no_wallet" />);
    await waitFor(
      () =>
        expect(screen.getByTestId("wallet-topups-empty")).toBeInTheDocument(),
      { timeout: 4000 },
    );
  });

  it("lists the seeded player_1 deposits (PAYSTACK + VOUCHER)", async () => {
    render(<WalletTopupsTab userId="player_1" />);
    await waitFor(
      () =>
        expect(screen.getByTestId("wallet-topups-tab")).toBeInTheDocument(),
      { timeout: 4000 },
    );
    // player_1 seed contains 1 DEPOSIT_PAYSTACK + 1 DEPOSIT_VOUCHER.
    const rows = screen.getAllByTestId("wallet-topup-row");
    expect(rows.length).toBe(2);
    expect(screen.getByText("Paystack")).toBeInTheDocument();
    expect(screen.getByText("Voucher")).toBeInTheDocument();
  });

  it("includes new STRIPE / CRYPTO deposits and never the WAGER kinds", async () => {
    // Add deposits across all four rails to player_3 (has 1 seeded
    // PAYSTACK so total 5 deposits expected).
    await credit({
      user_id: "player_3",
      amount_kobo: 10_000_00,
      kind: "DEPOSIT_STRIPE",
      source_tag: "PURCHASED",
      ref_type: "test",
      ref_id: "test_stripe_1",
      idempotency_key: "test_stripe_1",
    });
    await credit({
      user_id: "player_3",
      amount_kobo: 25_000_00,
      kind: "DEPOSIT_CRYPTO",
      source_tag: "PURCHASED",
      ref_type: "test",
      ref_id: "test_crypto_1",
      idempotency_key: "test_crypto_1",
    });
    // A WAGER_PAYOUT must NOT show up in the topups tab.
    await credit({
      user_id: "player_3",
      amount_kobo: 8_000_00,
      kind: "WAGER_PAYOUT",
      source_tag: "WON",
      ref_type: "test",
      ref_id: "test_payout_1",
      idempotency_key: "test_payout_1",
    });

    render(<WalletTopupsTab userId="player_3" />);
    await waitFor(
      () =>
        expect(screen.getByTestId("wallet-topups-tab")).toBeInTheDocument(),
      { timeout: 4000 },
    );
    expect(screen.getByText("Stripe")).toBeInTheDocument();
    expect(screen.getByText("Crypto")).toBeInTheDocument();
    // WAGER_PAYOUT should not be listed.
    expect(screen.queryByText(/WAGER_PAYOUT/i)).not.toBeInTheDocument();
  });
});
