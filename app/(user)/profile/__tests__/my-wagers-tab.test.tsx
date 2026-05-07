/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

// Mock env BEFORE importing ProfileContent — keeps t3-env from blowing up.
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_BACKEND_API_URL: "https://api.test.local",
    NEXT_PUBLIC_URL: "https://test.local",
    NEXT_PUBLIC_WAGER_MOCK: false,
  },
}));

// Make axios calls in ProfileContent no-op so we don't hit a real backend.
vi.mock("axios", () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

import { ProfileContent } from "../_components/ProfileContent";
import { runSeed } from "@/lib/mock-wager/seed";

// Stub the AuthContext with a fake user so ProfileContent renders past its gate.
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "1",
      user_id: 1,
      full_name: "Test User",
      country: "NG",
      in_game_name: "tester",
      uid: "1234",
      team: null,
      role: "user",
      roles: [],
      email: "test@example.com",
      is_banned: false,
      stats: {
        solo: { kills: 0, wins: 0, matches_played: 0 },
        team: { kills: 0, wins: 0, matches_played: 0 },
        total_booyahs: 0,
        total_earnings: 0,
        total_kills: 0,
        total_mvps: 0,
        total_scrims_played: 0,
        total_tournaments_played: 0,
        total_wins: 0,
      },
    },
    token: "fake-token",
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: true,
    isAdmin: false,
    isAdminByRoleOrRoles: false,
    hasRole: () => false,
    hasAnyRole: () => false,
    signalSessionExpired: vi.fn(),
  }),
}));

describe("Profile / My Wagers tab", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders a 'My Wagers' tab trigger", async () => {
    render(<ProfileContent />);
    await waitFor(
      () => {
        expect(
          screen.getByRole("tab", { name: /my wagers/i }),
        ).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
  });

  it("renders the WagerHistoryTab content when activated", async () => {
    render(<ProfileContent />);
    const trigger = await screen.findByRole("tab", { name: /my wagers/i });
    fireEvent.pointerDown(trigger);
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    // Container surfaces after the click.
    await waitFor(
      () => {
        const pane = screen.queryByTestId("profile-my-wagers");
        expect(pane).not.toBeNull();
        // Expect *something* rendered — either Loading text, the
        // history pane shell, or the empty-state copy.
        expect(pane!.textContent ?? "").toMatch(
          /haven't placed any wagers|my wagers|loading/i,
        );
      },
      { timeout: 10000 },
    );
  }, 15000);
});
