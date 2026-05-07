/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AdminWagersClient from "../AdminWagersClient";
import { runSeed } from "@/lib/mock-wager/seed";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

describe("AdminWagersClient", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders the Wager Markets page header", async () => {
    render(<AdminWagersClient />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /wager markets/i }),
      ).toBeInTheDocument(),
    );
  });

  it("renders the markets table after seed loads", async () => {
    render(<AdminWagersClient />);
    await waitFor(() =>
      expect(screen.getByTestId("markets-table")).toBeInTheDocument(),
    );
    const rows = await screen.findAllByTestId("market-row");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("links to /a/wagers/new from the header CTA", async () => {
    render(<AdminWagersClient />);
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /new market/i }),
      ).toHaveAttribute("href", "/a/wagers/new"),
    );
  });

  it("renders status filter dropdown", async () => {
    render(<AdminWagersClient />);
    await waitFor(() =>
      expect(screen.getByTestId("status-filter")).toBeInTheDocument(),
    );
  });
});
