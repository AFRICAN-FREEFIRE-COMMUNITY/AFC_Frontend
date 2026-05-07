/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { runSeed } from "@/lib/mock-wager/seed";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

// Mock useAuth to return a non-head_admin user.
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { user_id: 1, role: "user", roles: ["user"] },
  }),
}));

import CosignQueueClient from "../CosignQueueClient";

describe("CosignQueueClient — head_admin gate", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders 403 for non-head_admin users", async () => {
    render(<CosignQueueClient />);
    await waitFor(() =>
      expect(screen.getByTestId("cosign-403")).toBeInTheDocument(),
    );
    expect(screen.getByText(/head_admin only/i)).toBeInTheDocument();
  });
});
