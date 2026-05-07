/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KYCBanner } from "@/components/KYCBanner";

describe("KYCBanner", () => {
  it("renders for TIER_0", () => {
    render(<KYCBanner tier="TIER_0" />);
    expect(screen.getByTestId("kyc-banner")).toBeInTheDocument();
    expect(
      screen.getByText(/Verify your account to send & withdraw/i),
    ).toBeInTheDocument();
  });

  it("renders nothing for TIER_LITE", () => {
    const { container } = render(<KYCBanner tier="TIER_LITE" />);
    expect(container.firstChild).toBeNull();
  });

  it("links to /wallet/verify", () => {
    render(<KYCBanner tier="TIER_0" />);
    const link = screen.getByRole("link", { name: /verify/i });
    expect(link).toHaveAttribute("href", "/wallet/verify");
  });
});
