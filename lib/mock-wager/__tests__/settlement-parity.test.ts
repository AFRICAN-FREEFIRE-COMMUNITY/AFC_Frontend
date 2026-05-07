import { describe, it, expect } from "vitest";
import scenarios from "../../../shared-fixtures/wager-scenarios.json";
import { settle } from "../settlement-engine";

describe("settlement engine — shared fixture parity", () => {
  for (const s of scenarios) {
    it(`${s.name}: ${s.description}`, () => {
      const result = settle({
        pool_kobo: s.pool_kobo,
        rake_bps: s.rake_bps,
        winning_lines: s.winning_lines,
        loser_total_kobo: s.loser_total_kobo,
      });

      expect(result.resolution).toBe(s.expected.resolution);

      if (s.expected.resolution === "WINNER") {
        expect(result.rake_kobo).toBe(s.expected.rake_kobo);
        expect(result.net_pool).toBe(s.expected.net_pool);
        expect(result.dust_kobo).toBe(s.expected.dust_kobo);
        expect(result.house_total).toBe(s.expected.house_total);
        for (const [user, expected] of Object.entries(s.expected.payouts)) {
          expect(result.payouts[user]).toBe(expected);
        }

        // Invariant: payouts + house = pool
        const sum =
          Object.values(result.payouts).reduce((a, b) => a + b, 0) +
          result.house_total;
        expect(sum).toBe(s.pool_kobo);
      } else {
        expect(result.rake_kobo).toBe(0);
        expect(result.refund_all_kobo).toBe(s.expected.refund_all_kobo);
      }
    });
  }
});
