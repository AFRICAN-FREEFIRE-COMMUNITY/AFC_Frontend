/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import UserWalletClient from "../UserWalletClient";
import { runSeed } from "@/lib/mock-wager/seed";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

describe("UserWalletClient", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders the user header for an existing user", async () => {
    render(<UserWalletClient userId="player_1" />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /stormbreaker/i }),
      ).toBeInTheDocument(),
    );
  });

  it("renders the 4-bucket balance grid", async () => {
    render(<UserWalletClient userId="player_1" />);
    await waitFor(() =>
      expect(screen.getByTestId("user-wallet-balances")).toBeInTheDocument(),
    );
  });

  it("renders Freeze + Manual adjust buttons", async () => {
    render(<UserWalletClient userId="player_1" />);
    await waitFor(() =>
      expect(screen.getByTestId("freeze-toggle")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("manual-adjust")).toBeInTheDocument();
  });

  it("shows User-not-found for unknown id", async () => {
    render(<UserWalletClient userId="ghost_user_xyz" />);
    await waitFor(() =>
      expect(screen.getByText(/user not found/i)).toBeInTheDocument(),
    );
  });
});
