/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SendPanel } from "../SendPanel";
import { runSeed } from "@/lib/mock-wager/seed";
import { getBalance } from "@/lib/mock-wager/handlers/wallet";
import type { Balance } from "@/lib/mock-wager/types";

const fx = {
  id: "fx_test",
  captured_at: new Date().toISOString(),
  ngn_per_usd: 1500,
  source: "test",
};

async function loadBalance(uid: string): Promise<Balance> {
  return await getBalance(uid);
}

describe("SendPanel", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("shows the gated card for TIER_0 users", async () => {
    const balance = await loadBalance("player_2"); // TIER_0
    render(<SendPanel userId="player_2" fx={fx} balance={balance} />);
    await waitFor(() =>
      expect(screen.getByTestId("send-panel-gated")).toBeInTheDocument(),
    );
    expect(screen.getByText(/Verify to unlock send/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /verify now/i }),
    ).toHaveAttribute("href", "/wallet/verify");
  });

  it("renders the form for TIER_LITE users", async () => {
    const balance = await loadBalance("player_1"); // TIER_LITE
    render(<SendPanel userId="player_1" fx={fx} balance={balance} />);
    await waitFor(() =>
      expect(screen.getByTestId("send-panel")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("recipient-input")).toBeInTheDocument();
    expect(screen.getByTestId("amount-input")).toBeInTheDocument();
    expect(screen.getByTestId("send-submit")).toBeInTheDocument();
  });

  it("disables submit until recipient + amount are valid", async () => {
    const balance = await loadBalance("player_1");
    render(<SendPanel userId="player_1" fx={fx} balance={balance} />);
    await waitFor(() =>
      expect(screen.getByTestId("send-submit")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("send-submit")).toBeDisabled();
  });

  it("shows daily-cap text", async () => {
    const balance = await loadBalance("player_1");
    render(<SendPanel userId="player_1" fx={fx} balance={balance} />);
    await waitFor(() =>
      expect(screen.getByTestId("send-panel")).toBeInTheDocument(),
    );
    expect(screen.getByText(/₦25M daily limit/i)).toBeInTheDocument();
  });
});
