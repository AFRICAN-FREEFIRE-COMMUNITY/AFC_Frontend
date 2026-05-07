import type { SettlementResolution } from "./types";

export interface SettleInput {
  pool_kobo: number;
  rake_bps: number;
  winning_lines: { user: string; stake_kobo: number }[];
  loser_total_kobo: number;
}

export interface SettleResult {
  resolution: SettlementResolution;
  rake_kobo: number;
  net_pool: number;
  payouts: Record<string, number>;
  dust_kobo: number;
  house_total: number;
  refund_all_kobo?: number;
}

export function settle(input: SettleInput): SettleResult {
  const { pool_kobo, rake_bps, winning_lines, loser_total_kobo } = input;

  const winner_total = winning_lines.reduce((a, l) => a + l.stake_kobo, 0);

  // No winners: full refund
  if (winner_total === 0) {
    return {
      resolution: "VOID_NO_WINNER",
      rake_kobo: 0,
      net_pool: 0,
      payouts: {},
      dust_kobo: 0,
      house_total: 0,
      refund_all_kobo: pool_kobo,
    };
  }

  // All stakes on winning option (no losers): refund 100%
  if (loser_total_kobo === 0) {
    return {
      resolution: "VOID_SOLO_WAGER",
      rake_kobo: 0,
      net_pool: 0,
      payouts: {},
      dust_kobo: 0,
      house_total: 0,
      refund_all_kobo: pool_kobo,
    };
  }

  const rake = Math.floor((pool_kobo * rake_bps) / 10000);
  const net_pool = pool_kobo - rake;

  const payouts: Record<string, number> = {};
  let paid_total = 0;
  for (const line of winning_lines) {
    const share = Math.floor((net_pool * line.stake_kobo) / winner_total);
    payouts[line.user] = (payouts[line.user] ?? 0) + share;
    paid_total += share;
  }

  const dust = net_pool - paid_total;
  const house_total = rake + dust;

  return {
    resolution: "WINNER",
    rake_kobo: rake,
    net_pool,
    payouts,
    dust_kobo: dust,
    house_total,
  };
}
