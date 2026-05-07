/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PoolBar } from "../PoolBar";

describe("PoolBar", () => {
  it("renders 0 width when total pool is zero", () => {
    render(<PoolBar pool_kobo={0} total_pool_kobo={0} />);
    const fill = screen.getByTestId("pool-bar-fill");
    expect(fill).toBeInTheDocument();
  });

  it("renders label and badge", () => {
    render(
      <PoolBar
        pool_kobo={50}
        total_pool_kobo={100}
        label="Team Alpha"
        badge="3 wagers"
      />,
    );
    expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    expect(screen.getByText("3 wagers")).toBeInTheDocument();
  });

  it("computes percentage badge for >12% fill", () => {
    render(<PoolBar pool_kobo={50_000_000} total_pool_kobo={100_000_000} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("hides percentage badge when compact", () => {
    render(
      <PoolBar
        pool_kobo={50_000_000}
        total_pool_kobo={100_000_000}
        compact
      />,
    );
    expect(screen.queryByText("50%")).not.toBeInTheDocument();
  });
});
