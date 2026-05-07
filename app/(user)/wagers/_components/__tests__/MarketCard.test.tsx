/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketCard } from "../MarketCard";
import type { Market, Wager } from "@/lib/mock-wager/types";

const fx = {
  id: "fx_test",
  captured_at: new Date().toISOString(),
  ngn_per_usd: 1500,
  source: "test",
};

const baseMarket: Market = {
  id: "m_test",
  event_id: "e_test",
  match_id: null,
  template_code: "match_winner",
  title: "Match 5 Winner",
  description: "Pick the team that wins.",
  status: "OPEN",
  opens_at: new Date().toISOString(),
  lock_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  min_stake_kobo: 10_000,
  max_per_user_kobo: 5_000_000,
  cancel_fee_bps: 100,
  rake_bps: 500,
  suggested_option_id: null,
  winning_option_id: null,
  total_pool_kobo: 200_000_000,
  total_lines: 5,
  options: [
    {
      id: "o_a",
      market_id: "m_test",
      label: "Team Alpha",
      ref_team_id: null,
      ref_player_id: null,
      ref_numeric: null,
      image: null,
      sort_order: 0,
      cached_pool_kobo: 120_000_000,
      cached_wager_count: 3,
    },
    {
      id: "o_b",
      market_id: "m_test",
      label: "Team Beta",
      ref_team_id: null,
      ref_player_id: null,
      ref_numeric: null,
      image: null,
      sort_order: 1,
      cached_pool_kobo: 80_000_000,
      cached_wager_count: 2,
    },
  ],
  created_by_admin_id: "wager_admin_jane",
};

describe("MarketCard", () => {
  it("renders the market title", () => {
    render(<MarketCard market={baseMarket} fx={fx} />);
    expect(screen.getByText("Match 5 Winner")).toBeInTheDocument();
  });

  it("derives 'open' variant from OPEN status", () => {
    render(<MarketCard market={baseMarket} fx={fx} />);
    const card = screen.getByTestId("market-card");
    expect(card).toHaveAttribute("data-variant", "open");
  });

  it("derives 'locked' variant from LOCKED status", () => {
    render(
      <MarketCard market={{ ...baseMarket, status: "LOCKED" }} fx={fx} />,
    );
    expect(screen.getByTestId("market-card")).toHaveAttribute(
      "data-variant",
      "locked",
    );
  });

  it("derives 'settled' variant from SETTLED status", () => {
    render(
      <MarketCard market={{ ...baseMarket, status: "SETTLED" }} fx={fx} />,
    );
    expect(screen.getByTestId("market-card")).toHaveAttribute(
      "data-variant",
      "settled",
    );
  });

  it("uses 'my-wager' variant when wager prop set", () => {
    const wager: Wager = {
      id: "w1",
      user_id: "u1",
      market_id: baseMarket.id,
      total_stake_kobo: 25_000_000,
      status: "ACTIVE",
      placed_at: new Date().toISOString(),
      cancelled_at: null,
      debit_txn_id: "tx1",
      lines: [],
    };
    render(<MarketCard market={baseMarket} fx={fx} wager={wager} />);
    expect(screen.getByTestId("market-card")).toHaveAttribute(
      "data-variant",
      "my-wager",
    );
  });

  it("renders pool bars for top options", () => {
    render(<MarketCard market={baseMarket} fx={fx} />);
    expect(screen.getByText("Team Alpha")).toBeInTheDocument();
    expect(screen.getByText("Team Beta")).toBeInTheDocument();
  });

  it("links to the market detail page", () => {
    render(<MarketCard market={baseMarket} fx={fx} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/wagers/m_test");
  });

  it("renders empty-state copy when no wagers", () => {
    render(
      <MarketCard
        market={{ ...baseMarket, total_pool_kobo: 0 }}
        fx={fx}
      />,
    );
    expect(
      screen.getByText(/no wagers placed yet/i),
    ).toBeInTheDocument();
  });
});
