/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DepositPanel } from "../DepositPanel";
import { runSeed } from "@/lib/mock-wager/seed";

const fx = {
  id: "fx_test",
  captured_at: new Date().toISOString(),
  ngn_per_usd: 1500,
  source: "test",
};

describe("DepositPanel", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders with all 4 rail tabs", () => {
    render(<DepositPanel userId="player_1" fx={fx} />);
    expect(screen.getByTestId("deposit-panel")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /paystack/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /card/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /crypto/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /voucher/i })).toBeInTheDocument();
  });

  it("disables submit when amount below minimum", () => {
    render(<DepositPanel userId="player_1" fx={fx} />);
    const submit = screen.getByTestId("deposit-submit");
    expect(submit).toBeDisabled();
  });

  it("renders quick-chips for common amounts", () => {
    render(<DepositPanel userId="player_1" fx={fx} />);
    expect(screen.getByRole("button", { name: /₦500/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /₦1,000/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /₦5,000/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /₦10,000/ })).toBeInTheDocument();
  });

  it("renders voucher tab with the correct label", () => {
    render(<DepositPanel userId="player_1" fx={fx} />);
    const voucherTab = screen.getByRole("tab", { name: /voucher/i });
    expect(voucherTab).toBeInTheDocument();
    expect(voucherTab.getAttribute("data-state")).toBe("inactive");
  });
});
