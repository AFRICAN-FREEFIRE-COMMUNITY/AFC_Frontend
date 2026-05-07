/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import WagersClient from "../WagersClient";
import { runSeed } from "@/lib/mock-wager/seed";

describe("WagersClient", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders the page header", async () => {
    render(<WagersClient />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /wagers/i }),
      ).toBeInTheDocument(),
    );
  });

  it("renders all 4 status tabs", async () => {
    render(<WagersClient />);
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /open/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("tab", { name: /locked/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /settled/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /my wagers/i })).toBeInTheDocument();
  });

  it("renders OPEN markets in a grid", async () => {
    render(<WagersClient />);
    await waitFor(
      () => expect(screen.getByTestId("markets-grid")).toBeInTheDocument(),
      { timeout: 3000 },
    );
    const cards = screen.getAllByTestId("market-card");
    expect(cards.length).toBeGreaterThan(0);
  });
});
