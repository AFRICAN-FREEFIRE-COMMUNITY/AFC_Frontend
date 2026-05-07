import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { settle } from "../settlement-engine";

describe("settlement engine — property invariants", () => {
  it("payouts + house always equal pool when there's a winner and losers", () => {
    fc.assert(
      fc.property(
        fc.record({
          winners: fc.array(
            fc.record({
              user: fc.string({ minLength: 1, maxLength: 10 }),
              stake_kobo: fc.integer({ min: 100, max: 1_000_000_000 }),
            }),
            { minLength: 1, maxLength: 50 },
          ),
          loser_total_kobo: fc.integer({ min: 1, max: 1_000_000_000 }),
          rake_bps: fc.constantFrom(100, 250, 500, 1000),
        }),
        ({ winners, loser_total_kobo, rake_bps }) => {
          const winner_total = winners.reduce((a, w) => a + w.stake_kobo, 0);
          const pool = winner_total + loser_total_kobo;
          const r = settle({
            pool_kobo: pool,
            rake_bps,
            winning_lines: winners,
            loser_total_kobo,
          });
          if (r.resolution !== "WINNER") return; // void cases handled separately
          const sum = Object.values(r.payouts).reduce((a, b) => a + b, 0) + r.house_total;
          expect(sum).toBe(pool);
          expect(r.dust_kobo).toBeGreaterThanOrEqual(0);
          expect(r.dust_kobo).toBeLessThanOrEqual(winners.length);
          for (const v of Object.values(r.payouts)) expect(v).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 200 },
    );
  });
});
