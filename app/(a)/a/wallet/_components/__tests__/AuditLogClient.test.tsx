/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AuditLogClient from "../AuditLogClient";
import { runSeed } from "@/lib/mock-wager/seed";
import { writeAudit } from "@/lib/mock-wager/handlers/markets";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

describe("AuditLogClient", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders the Audit log header", async () => {
    render(<AuditLogClient />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /audit log/i }),
      ).toBeInTheDocument(),
    );
  });

  it("renders the audit table", async () => {
    render(<AuditLogClient />);
    await waitFor(() =>
      expect(screen.getByTestId("audit-table")).toBeInTheDocument(),
    );
  });

  it("renders rows after a synthetic audit event", async () => {
    await writeAudit({
      admin_user_id: "head_admin_jay",
      action_kind: "TEST_ACTION",
      target_type: "test",
      target_id: "t_xyz",
      payload: { hello: "world" },
    });
    render(<AuditLogClient />);
    await waitFor(() =>
      expect(screen.getAllByTestId("audit-row").length).toBeGreaterThan(0),
    );
  });

  it("renders both admin and kind filters", async () => {
    render(<AuditLogClient />);
    await waitFor(() =>
      expect(screen.getByTestId("admin-filter")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("kind-filter")).toBeInTheDocument();
  });
});
