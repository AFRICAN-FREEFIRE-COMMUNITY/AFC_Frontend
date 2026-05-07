/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PoolBreakdownChart } from "../PoolBreakdownChart";
import type { MarketOption } from "@/lib/mock-wager/types";

const fx = {
  id: "fx_test",
  captured_at: new Date().toISOString(),
  ngn_per_usd: 1500,
  source: "test",
};

const options: MarketOption[] = [
  {
    id: "o1",
    market_id: "m",
    label: "Team Alpha",
    ref_team_id: null,
    ref_player_id: null,
    ref_numeric: null,
    image: null,
    sort_order: 0,
    cached_pool_kobo: 60_000_000,
    cached_wager_count: 3,
  },
  {
    id: "o2",
    market_id: "m",
    label: "Team Beta",
    ref_team_id: null,
    ref_player_id: null,
    ref_numeric: null,
    image: null,
    sort_order: 1,
    cached_pool_kobo: 40_000_000,
    cached_wager_count: 2,
  },
];

describe("PoolBreakdownChart", () => {
  it("renders the card with title", () => {
    render(
      <PoolBreakdownChart
        options={options}
        total_pool_kobo={100_000_000}
        fx={fx}
      />,
    );
    expect(screen.getByTestId("pool-breakdown-chart")).toBeInTheDocument();
    expect(screen.getByText(/pool breakdown/i)).toBeInTheDocument();
  });

  it("renders the empty state when pool is zero", () => {
    render(<PoolBreakdownChart options={options} total_pool_kobo={0} fx={fx} />);
    expect(screen.getByText(/no coins in the pool yet/i)).toBeInTheDocument();
  });

  it("lists each option with a percent", () => {
    render(
      <PoolBreakdownChart
        options={options}
        total_pool_kobo={100_000_000}
        fx={fx}
      />,
    );
    expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    expect(screen.getByText("Team Beta")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });
});
