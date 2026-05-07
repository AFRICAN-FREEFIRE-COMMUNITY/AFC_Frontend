/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlaceWagerSheet } from "../PlaceWagerSheet";
import { runSeed } from "@/lib/mock-wager/seed";
import type { Balance, Market } from "@/lib/mock-wager/types";

const fx = {
  id: "fx_test",
  captured_at: new Date().toISOString(),
  ngn_per_usd: 1500,
  source: "test",
};

const balance: Balance = {
  total_kobo: 100_000_000,
  purchased_kobo: 100_000_000,
  won_kobo: 0,
  gift_kobo: 0,
  locked_kobo: 0,
  fx,
};

const openMarket: Market = {
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
  total_pool_kobo: 10_000_000,
  total_lines: 1,
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
      cached_pool_kobo: 6_000_000,
      cached_wager_count: 1,
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
      cached_pool_kobo: 4_000_000,
      cached_wager_count: 1,
    },
  ],
  created_by_admin_id: "wager_admin_jane",
};

describe("PlaceWagerSheet", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("afc-wager-mock");
    await runSeed();
  });

  it("renders the sheet with the market title", () => {
    render(
      <PlaceWagerSheet
        open
        onOpenChange={() => {}}
        market={openMarket}
        fx={fx}
        userId="player_5"
        balance={balance}
      />,
    );
    expect(screen.getByTestId("place-wager-sheet")).toBeInTheDocument();
    expect(screen.getByText(openMarket.title)).toBeInTheDocument();
  });

  it("renders one stake input per option", () => {
    render(
      <PlaceWagerSheet
        open
        onOpenChange={() => {}}
        market={openMarket}
        fx={fx}
        userId="player_5"
        balance={balance}
      />,
    );
    expect(screen.getByTestId("stake-input-0")).toBeInTheDocument();
    expect(screen.getByTestId("stake-input-1")).toBeInTheDocument();
  });

  it("disables submit when no stake entered", () => {
    render(
      <PlaceWagerSheet
        open
        onOpenChange={() => {}}
        market={openMarket}
        fx={fx}
        userId="player_5"
        balance={balance}
      />,
    );
    expect(screen.getByTestId("place-wager-submit")).toBeDisabled();
  });

  it("disables submit when stake is below minimum", () => {
    render(
      <PlaceWagerSheet
        open
        onOpenChange={() => {}}
        market={openMarket}
        fx={fx}
        userId="player_5"
        balance={balance}
      />,
    );
    const stake = screen.getByTestId("stake-input-0");
    fireEvent.change(stake, { target: { value: "0.05" } });
    expect(screen.getByTestId("place-wager-submit")).toBeDisabled();
  });

  it("enables submit when stake meets the minimum", () => {
    render(
      <PlaceWagerSheet
        open
        onOpenChange={() => {}}
        market={openMarket}
        fx={fx}
        userId="player_5"
        balance={balance}
      />,
    );
    const stake = screen.getByTestId("stake-input-0");
    // 1 coin = 50,000 kobo > min of 10,000
    fireEvent.change(stake, { target: { value: "1" } });
    expect(screen.getByTestId("place-wager-submit")).not.toBeDisabled();
  });

  it("shows locked warning when market not OPEN", () => {
    render(
      <PlaceWagerSheet
        open
        onOpenChange={() => {}}
        market={{ ...openMarket, status: "LOCKED" }}
        fx={fx}
        userId="player_5"
        balance={balance}
      />,
    );
    expect(screen.getByText(/can't be placed/i)).toBeInTheDocument();
  });
});
