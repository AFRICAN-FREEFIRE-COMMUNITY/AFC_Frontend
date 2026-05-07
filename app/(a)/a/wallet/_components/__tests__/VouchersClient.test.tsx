/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import VouchersClient from "../VouchersClient";
import { runSeed } from "@/lib/mock-wager/seed";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

describe("VouchersClient", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders the Vouchers page header + table", async () => {
    render(<VouchersClient />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /vouchers/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByTestId("vouchers-table")).toBeInTheDocument();
  });

  it("renders the seeded WELCOME500 voucher", async () => {
    render(<VouchersClient />);
    await waitFor(() =>
      expect(screen.getAllByTestId("voucher-row").length).toBeGreaterThan(0),
    );
  });

  it("renders the Generate trigger button", async () => {
    render(<VouchersClient />);
    await waitFor(() =>
      expect(screen.getByTestId("generate-trigger")).toBeInTheDocument(),
    );
  });
});
