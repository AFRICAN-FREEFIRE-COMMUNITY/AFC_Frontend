/// <reference types="@testing-library/jest-dom" />
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { WalletProvider } from "@/contexts/WalletContext";
import { WalletPill } from "@/components/WalletPill";
import { runSeed } from "@/lib/mock-wager/seed";

function setup(userId: string | null, hasUser: boolean = true) {
  return render(
    <WalletProvider userId={userId}>
      <WalletPill hasUser={hasUser} />
    </WalletProvider>,
  );
}

describe("WalletPill", () => {
  beforeEach(async () => {
    await act(async () => {
      indexedDB.deleteDatabase("afc-wager-mock");
      await runSeed();
    });
  });

  it("renders nothing when user is not signed in", () => {
    const { container } = setup(null, false);
    expect(container.firstChild).toBeNull();
  });

  it("shows a skeleton while the balance is loading", () => {
    setup("player_1");
    // First synchronous render is the loading state — balance hasn't resolved yet.
    expect(screen.getByTestId("wallet-pill-skeleton")).toBeInTheDocument();
  });

  it("renders the coin + naira balance once loaded", async () => {
    setup("player_1");
    await waitFor(() => {
      expect(screen.getByTestId("wallet-pill")).toBeInTheDocument();
    });
    const pill = screen.getByTestId("wallet-pill");
    // Balance triple — coins label and naira sign should both be present.
    expect(pill).toHaveTextContent(/coins/);
    expect(pill).toHaveTextContent(/₦/);
  });

  it("exposes all six shortcut links via the dropdown trigger", async () => {
    setup("player_1");
    await waitFor(() => {
      expect(screen.getByTestId("wallet-pill")).toBeInTheDocument();
    });
    const trigger = screen.getByTestId("wallet-pill");
    // Radix DropdownMenuTrigger opens on keyDown(Enter) reliably in JSDOM/HappyDOM
    // where pointer events are flaky.
    fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(screen.getByTestId("wallet-pill-link-wallet")).toBeInTheDocument();
    });
    expect(screen.getByTestId("wallet-pill-link-wallet")).toHaveAttribute(
      "href",
      "/wallet",
    );
    expect(screen.getByTestId("wallet-pill-link-deposit")).toHaveAttribute(
      "href",
      "/wallet?tab=deposit",
    );
    expect(screen.getByTestId("wallet-pill-link-send")).toHaveAttribute(
      "href",
      "/wallet?tab=send",
    );
    expect(screen.getByTestId("wallet-pill-link-withdraw")).toHaveAttribute(
      "href",
      "/wallet?tab=withdraw",
    );
    expect(screen.getByTestId("wallet-pill-link-my-wagers")).toHaveAttribute(
      "href",
      "/wagers/my-wagers",
    );
    expect(screen.getByTestId("wallet-pill-link-verify-kyc")).toHaveAttribute(
      "href",
      "/wallet/verify",
    );
  });
});
