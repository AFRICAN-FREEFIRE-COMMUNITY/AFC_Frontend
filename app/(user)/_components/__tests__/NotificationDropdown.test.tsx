/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_BACKEND_API_URL: "https://api.test.local",
    NEXT_PUBLIC_URL: "https://test.local",
    NEXT_PUBLIC_WAGER_MOCK: false,
  },
}));

vi.mock("axios", () => ({
  default: { post: vi.fn().mockResolvedValue({ data: {} }) },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ token: "fake-token" }),
}));

import { NotificationDropdown } from "../NotificationDropdown";

function openSheet() {
  // Open the bell sheet so the notification list mounts.
  const trigger = screen.getByRole("button");
  fireEvent.click(trigger);
}

describe("NotificationDropdown — wager kinds (M13.4)", () => {
  it("renders WAGER_LOCK_SOON with the market title", () => {
    const notifs = [
      {
        id: 1,
        is_read: false,
        kind: "WAGER_LOCK_SOON",
        payload: { market: { title: "Match 5 Winner" } },
        message: "fallback string ignored",
      },
    ];
    render(
      <NotificationDropdown
        notifications={notifs}
        unreadCount={1}
        onNotificationUpdate={vi.fn()}
      />,
    );
    openSheet();
    expect(
      screen.getByTestId("notification-WAGER_LOCK_SOON"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/wager locks soon: match 5 winner/i),
    ).toBeInTheDocument();
  });

  it("renders WAGER_SETTLED with the amount + outcome", () => {
    const notifs = [
      {
        id: 2,
        is_read: false,
        kind: "WAGER_SETTLED",
        payload: { amount: "₦50,000", outcome: "won" },
      },
    ];
    render(
      <NotificationDropdown
        notifications={notifs}
        unreadCount={1}
        onNotificationUpdate={vi.fn()}
      />,
    );
    openSheet();
    expect(
      screen.getByTestId("notification-WAGER_SETTLED"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/wager settled: ₦50,000 won/i),
    ).toBeInTheDocument();
  });

  it("renders WAGER_SETTLED with 'lost' when outcome is lost", () => {
    const notifs = [
      {
        id: 3,
        is_read: false,
        kind: "WAGER_SETTLED",
        payload: { amount: "₦10,000", outcome: "lost" },
      },
    ];
    render(
      <NotificationDropdown
        notifications={notifs}
        unreadCount={1}
        onNotificationUpdate={vi.fn()}
      />,
    );
    openSheet();
    expect(
      screen.getByText(/wager settled: ₦10,000 lost/i),
    ).toBeInTheDocument();
  });

  it("renders P2P_RECEIVED with sender + amount", () => {
    const notifs = [
      {
        id: 4,
        is_read: false,
        kind: "P2P_RECEIVED",
        payload: { sender: "GhostKid", amount: "₦5,000" },
      },
    ];
    render(
      <NotificationDropdown
        notifications={notifs}
        unreadCount={1}
        onNotificationUpdate={vi.fn()}
      />,
    );
    openSheet();
    expect(
      screen.getByTestId("notification-P2P_RECEIVED"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ghostkid sent you ₦5,000/i),
    ).toBeInTheDocument();
  });

  it("renders WITHDRAW_APPROVED with the amount", () => {
    const notifs = [
      {
        id: 5,
        is_read: false,
        kind: "WITHDRAW_APPROVED",
        payload: { amount: "₦100,000" },
      },
    ];
    render(
      <NotificationDropdown
        notifications={notifs}
        unreadCount={1}
        onNotificationUpdate={vi.fn()}
      />,
    );
    openSheet();
    expect(
      screen.getByTestId("notification-WITHDRAW_APPROVED"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/withdrawal approved: ₦100,000/i),
    ).toBeInTheDocument();
  });

  it("falls back to notification.message for non-wager kinds", () => {
    const notifs = [
      {
        id: 6,
        is_read: false,
        message: "Welcome to AFC, please verify your email",
      },
    ];
    render(
      <NotificationDropdown
        notifications={notifs}
        unreadCount={1}
        onNotificationUpdate={vi.fn()}
      />,
    );
    openSheet();
    expect(
      screen.getByText(/welcome to afc, please verify your email/i),
    ).toBeInTheDocument();
    // No kind-specific test-id should be present.
    expect(
      screen.queryByTestId(/^notification-WAGER_/),
    ).not.toBeInTheDocument();
  });
});
