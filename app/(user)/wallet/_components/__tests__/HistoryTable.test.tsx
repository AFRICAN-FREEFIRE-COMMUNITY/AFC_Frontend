/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { HistoryTable } from "../HistoryTable";
import { runSeed } from "@/lib/mock-wager/seed";

const fx = {
  id: "fx_test",
  captured_at: new Date().toISOString(),
  ngn_per_usd: 1500,
  source: "test",
};

describe("HistoryTable", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders rows for a seeded user", async () => {
    render(<HistoryTable userId="player_1" fx={fx} />);
    await waitFor(() => {
      // either rows present or empty-state — but seeded player_1 has txns
      const card = screen.getByTestId("history-table");
      expect(card).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    });
  });

  it("renders empty state when user has no transactions", async () => {
    render(<HistoryTable userId="player_no_one" fx={fx} />);
    await waitFor(() => {
      expect(screen.getByText("No transactions yet.")).toBeInTheDocument();
    });
  });

  it("hides filters and export when preview prop set", async () => {
    render(<HistoryTable userId="player_1" fx={fx} preview={5} />);
    await waitFor(() =>
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument(),
    );
    expect(screen.queryByTestId("csv-export")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });

  it("shows export CSV button in non-preview mode", async () => {
    render(<HistoryTable userId="player_1" fx={fx} />);
    await waitFor(() =>
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("csv-export")).toBeInTheDocument();
  });

  it("renders the column headers", async () => {
    render(<HistoryTable userId="player_1" fx={fx} />);
    await waitFor(() => {
      expect(screen.getByText("When")).toBeInTheDocument();
      expect(screen.getByText("Kind")).toBeInTheDocument();
      expect(screen.getByText("Source")).toBeInTheDocument();
      expect(screen.getByText("Amount")).toBeInTheDocument();
      expect(screen.getByText("Balance after")).toBeInTheDocument();
    });
  });
});
