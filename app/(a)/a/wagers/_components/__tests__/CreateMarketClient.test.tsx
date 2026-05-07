/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import CreateMarketClient from "../CreateMarketClient";
import { runSeed } from "@/lib/mock-wager/seed";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

describe("CreateMarketClient", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders the Create Market form", async () => {
    render(<CreateMarketClient />);
    await waitFor(() =>
      expect(screen.getByTestId("create-market-client")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("title-input")).toBeInTheDocument();
    expect(screen.getByTestId("event-select")).toBeInTheDocument();
    expect(screen.getByTestId("template-select")).toBeInTheDocument();
  });

  it("starts with two option rows", async () => {
    render(<CreateMarketClient />);
    await waitFor(() =>
      expect(screen.queryAllByTestId("option-row").length).toBe(2),
    );
  });

  it("adds option rows on Add button click", async () => {
    const { getByTestId, queryAllByTestId } = render(<CreateMarketClient />);
    await waitFor(() => expect(getByTestId("add-option")).toBeInTheDocument());
    const before = queryAllByTestId("option-row").length;
    getByTestId("add-option").click();
    await waitFor(() =>
      expect(queryAllByTestId("option-row").length).toBe(before + 1),
    );
  });

  it("disables save & publish until title + description filled", async () => {
    render(<CreateMarketClient />);
    await waitFor(() =>
      expect(screen.getByTestId("save-draft")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("save-draft")).toBeDisabled();
    expect(screen.getByTestId("publish")).toBeDisabled();
  });
});
