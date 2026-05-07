/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import TransactionsClient from "../TransactionsClient";
import { runSeed } from "@/lib/mock-wager/seed";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

describe("TransactionsClient", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders the Transactions page header", async () => {
    render(<TransactionsClient />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /transactions/i }),
      ).toBeInTheDocument(),
    );
  });

  it("renders the global txns table with seed data", async () => {
    render(<TransactionsClient />);
    await waitFor(() =>
      expect(screen.getByTestId("transactions-table")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("kind-filter")).toBeInTheDocument();
  });

  it("renders the CSV export button", async () => {
    render(<TransactionsClient />);
    await waitFor(() =>
      expect(screen.getByTestId("csv-export")).toBeInTheDocument(),
    );
  });

  it("renders kind + source + date filters", async () => {
    render(<TransactionsClient />);
    await waitFor(() =>
      expect(screen.getByTestId("kind-filter")).toBeInTheDocument(),
    );
    expect(screen.getByPlaceholderText(/Min ₦/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Max ₦/i)).toBeInTheDocument();
  });
});
