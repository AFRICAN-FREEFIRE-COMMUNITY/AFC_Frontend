/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import VerifyClient from "../VerifyClient";
import { runSeed } from "@/lib/mock-wager/seed";
import { login } from "@/lib/mock-wager/handlers/auth";

describe("VerifyClient", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
    await login("ghostkid"); // player_2 — TIER_0
  });

  it("renders with the WhatsApp + Discord steps", async () => {
    render(<VerifyClient />);
    await waitFor(() =>
      expect(screen.getByTestId("verify-client")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("step-phone")).toBeInTheDocument();
    expect(screen.getByTestId("step-discord")).toBeInTheDocument();
  });

  it("shows progress bar at 0/2 for an unverified user", async () => {
    render(<VerifyClient />);
    await waitFor(() =>
      expect(screen.getByTestId("verify-progress")).toBeInTheDocument(),
    );
    expect(screen.getByText(/0\/2 verified/i)).toBeInTheDocument();
  });

  it("disables Send OTP until phone is E.164-shaped", async () => {
    render(<VerifyClient />);
    await waitFor(() =>
      expect(screen.getByTestId("phone-input")).toBeInTheDocument(),
    );
    const send = screen.getByTestId("send-otp");
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByTestId("phone-input"), {
      target: { value: "+2348012345678" },
    });
    expect(send).not.toBeDisabled();
  });

  it("shows OTP input after Send OTP click", async () => {
    render(<VerifyClient />);
    await waitFor(() =>
      expect(screen.getByTestId("phone-input")).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByTestId("phone-input"), {
      target: { value: "+2348012345678" },
    });
    fireEvent.click(screen.getByTestId("send-otp"));
    await waitFor(() =>
      expect(screen.getByTestId("otp-input")).toBeInTheDocument(),
    );
  });

  it("shows back-to-wallet success card when both verified (Tier-Lite user)", async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
    await login("stormbreaker"); // player_1 — TIER_LITE
    render(<VerifyClient />);
    await waitFor(() =>
      expect(screen.getByTestId("verify-success")).toBeInTheDocument(),
    );
    expect(screen.getAllByText(/Tier-Lite unlocked/i).length).toBeGreaterThan(0);
  });
});
