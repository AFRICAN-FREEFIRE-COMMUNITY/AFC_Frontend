/**
 * lib/__tests__/prizeSuggestion.test.ts
 * ─────────────────────────────────────
 * Unit tests for the prize-split maths in lib/prizeSuggestion.ts (owner backlog item 24).
 *
 * Run with:  node --test lib/__tests__/prizeSuggestion.test.ts
 * (Node 25 strips the TypeScript types natively, so no build step and no test runner is needed.
 * The module under test is deliberately free of React and next-intl so it can be imported here.)
 *
 * The invariants that matter, and that every case below re-checks:
 *   1. the lines sum to the pool EXACTLY, at every pool size and place count
 *   2. 1st place is never smaller than any other place
 *   3. no place is handed a negative amount
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  suggestPrizeSplit,
  buildSuggestedDistribution,
  defaultShapeForPlaces,
  PRIZE_SHAPE_IDS,
  type PrizeShapeId,
} from "../prizeSuggestion.ts";

// ── helpers ──────────────────────────────────────────────────────────────────
// Sum the produced lines the way the form will: parse the strings back to numbers.
const sumLines = (lines: string[]) => lines.reduce((s, v) => s + parseFloat(v), 0);

/** Assert the three universal invariants for one split. */
function assertInvariants(pool: number, places: number, shape: PrizeShapeId) {
  const split = suggestPrizeSplit(pool, places, shape);
  assert.ok(split, `expected a split for pool=${pool} places=${places} shape=${shape}`);

  const label = `pool=${pool} places=${places} shape=${shape}`;

  // 1. exact sum. Compared in CENTS so the assertion itself cannot be defeated by float noise.
  const totalCents = split.linesCents.reduce((s, c) => s + c, 0);
  assert.equal(totalCents, Math.round(pool * 100), `${label}: lines must sum to the pool exactly`);
  // and the same holds after the numbers have been through the string round-trip the form does
  assert.ok(
    Math.abs(sumLines(split.lines) - pool) < 0.000001,
    `${label}: string round-trip must still sum to the pool`,
  );

  // 2. 1st place is the largest line
  for (let i = 1; i < split.linesCents.length; i++) {
    assert.ok(
      split.linesCents[0] >= split.linesCents[i],
      `${label}: 1st (${split.linesCents[0]}) must be >= place ${i + 1} (${split.linesCents[i]})`,
    );
  }

  // 3. nothing negative
  for (const c of split.linesCents) {
    assert.ok(c >= 0, `${label}: no line may be negative, saw ${c}`);
  }

  // and there is exactly one line per place
  assert.equal(split.lines.length, places, `${label}: one line per place`);
}

// ── 1. the sum is exact across a wide sweep ──────────────────────────────────
test("sums to the pool exactly across many pools, place counts and shapes", () => {
  const pools = [1, 7, 100, 333, 999, 1000, 1750, 5000, 12345.67, 400, 1_000_000, 0.5];
  const placeCounts = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 24, 50];

  let checked = 0;
  for (const pool of pools) {
    for (const places of placeCounts) {
      for (const shape of PRIZE_SHAPE_IDS) {
        // Skip only the genuinely impossible combos (pool too small to give each place a cent).
        if (Math.round(pool * 100) < places) continue;
        assertInvariants(pool, places, shape);
        checked++;
      }
    }
  }
  assert.ok(checked > 400, `expected a broad sweep, only checked ${checked}`);
  console.log(`    swept ${checked} pool/places/shape combinations, all exact`);
});

// ── 2. the awkward number the brief called out ───────────────────────────────
test("333 across 7 places sums to 333 exactly, in every shape", () => {
  for (const shape of PRIZE_SHAPE_IDS) {
    const split = suggestPrizeSplit(333, 7, shape)!;
    // Assert in CENTS: 333 is not representable as a clean sum of parsed floats, and the point of
    // doing the arithmetic in integer cents is that the exactness survives regardless.
    assert.equal(split.linesCents.reduce((s, c) => s + c, 0), 33300);
    console.log(`    ${shape.padEnd(9)} -> [${split.lines.join(", ")}]  sum=${sumLines(split.lines).toFixed(2)}`);
  }
});

// ── 3. edge cases ────────────────────────────────────────────────────────────
test("one place takes the whole pool", () => {
  const split = suggestPrizeSplit(5000, 1, "top_heavy")!;
  assert.deepEqual(split.lines, ["5000"]);
});

test("a pool of zero produces no suggestion", () => {
  assert.equal(suggestPrizeSplit(0, 8, "top_heavy"), null);
});

test("a negative pool produces no suggestion", () => {
  assert.equal(suggestPrizeSplit(-100, 8, "top_heavy"), null);
});

test("zero or fewer places produces no suggestion", () => {
  assert.equal(suggestPrizeSplit(1000, 0, "top_heavy"), null);
  assert.equal(suggestPrizeSplit(1000, -3, "top_heavy"), null);
});

test("a pool too small to give every place a cent produces no suggestion", () => {
  // 0.05 is 5 cents, which cannot cover 12 places.
  assert.equal(suggestPrizeSplit(0.05, 12, "top_heavy"), null);
  // but 12 cents across 12 places is fine (a cent each)
  const split = suggestPrizeSplit(0.12, 12, "flat")!;
  assert.equal(split.linesCents.reduce((s, c) => s + c, 0), 12);
});

test("non-finite input produces no suggestion", () => {
  assert.equal(suggestPrizeSplit(NaN, 8, "top_heavy"), null);
  assert.equal(suggestPrizeSplit(1000, Infinity, "top_heavy"), null);
});

// ── 4. the curve matches what AFC actually paid ──────────────────────────────
// These are the three real distributions in the AFC database (surveyed 2026-08-06). The suggestion
// does not have to reproduce them to the cent, it has to land in the same place. Tolerance is
// stated per case in percentage points of the pool.
test("top_heavy reproduces DETTY DECEMBER SOLOS (#53): 1000 / 500 / 250", () => {
  const split = suggestPrizeSplit(1750, 3, "top_heavy")!;
  console.log(`    suggested: [${split.lines.join(", ")}]   actual: [1000, 500, 250]`);
  assert.deepEqual(split.lines, ["1000", "500", "250"], "should match the real payout exactly");
});

test("top_heavy lands within 2pp per place of DYNASTY CUP GRAND FINALS SSA (#172)", () => {
  const actual = [200, 100, 50, 30, 10, 10];
  const pool = 400;
  const split = suggestPrizeSplit(pool, 6, "top_heavy")!;
  console.log(`    suggested: [${split.lines.join(", ")}]   actual: [${actual.join(", ")}]`);
  split.lines.forEach((line, i) => {
    const diffPp = Math.abs(parseFloat(line) - actual[i]) / pool * 100;
    assert.ok(diffPp <= 2, `place ${i + 1}: ${line} vs ${actual[i]} is ${diffPp.toFixed(2)}pp off`);
  });
});

test("balanced (harmonic) lands within 3pp per place of DECA CUP SEASON 5 (#184)", () => {
  const actual = [300000, 150000, 120000, 90000, 90000, 60000, 60000, 60000, 20000, 20000, 15000, 15000];
  const pool = 1_000_000;
  const split = suggestPrizeSplit(pool, 12, "balanced")!;
  console.log(`    suggested: [${split.lines.join(", ")}]`);
  console.log(`    actual:    [${actual.join(", ")}]`);
  split.lines.forEach((line, i) => {
    const diffPp = Math.abs(parseFloat(line) - actual[i]) / pool * 100;
    assert.ok(diffPp <= 3, `place ${i + 1}: ${line} vs ${actual[i]} is ${diffPp.toFixed(2)}pp off`);
  });
});

test("2nd place gets half of 1st in BOTH real shapes, the strongest signal in the AFC data", () => {
  // AFC paid 2nd exactly half of 1st in all three of its real events, at 3, 6 and 12 places.
  // Halving and harmonic both encode that, so it must hold at every place count and pool size.
  for (const shape of ["top_heavy", "balanced"] as PrizeShapeId[]) {
    for (const places of [2, 3, 4, 6, 8, 12, 24, 50]) {
      for (const pool of [100000, 1750, 400, 5000]) {
        const split = suggestPrizeSplit(pool, places, shape)!;
        const ratio = split.linesCents[1] / split.linesCents[0];
        assert.ok(
          Math.abs(ratio - 0.5) < 0.02,
          `${shape} @ ${places} places, pool ${pool}: 2nd/1st was ${ratio.toFixed(3)}, expected 0.5`,
        );
      }
    }
  }
  console.log("    2nd/1st stayed at 0.500 across both shapes, 8 place counts and 4 pool sizes");
});

// ── 5. no place is starved: the tail still gets paid ─────────────────────────
test("the preselected shape never starves the bottom of the table", () => {
  // The brief's requirement, stated as a test: the curve must not be so steep that the middle of
  // the table (places 5 to 8) gets nothing, and no place may be paid zero.
  // At each place count we use the shape defaultShapeForPlaces picks, on a realistic 5000 pool.
  const pool = 5000;
  for (const places of [4, 6, 8, 10, 12, 16]) {
    const shape = defaultShapeForPlaces(places);
    const split = suggestPrizeSplit(pool, places, shape)!;
    const shareOf = (i: number) => (split.linesCents[i] / (pool * 100)) * 100;

    // no place paid nothing
    for (let i = 0; i < places; i++) {
      assert.ok(split.linesCents[i] > 0, `${places} places (${shape}): place ${i + 1} got nothing`);
    }
    // places 5 to 8, where they exist, each keep a meaningful share
    for (let i = 4; i < Math.min(8, places); i++) {
      assert.ok(
        shareOf(i) >= 1,
        `${places} places (${shape}): place ${i + 1} got ${shareOf(i).toFixed(2)}% of the pool, too thin`,
      );
    }
    const mid = places > 4 ? ` places5-8=[${[4, 5, 6, 7].filter((i) => i < places).map((i) => shareOf(i).toFixed(1) + "%").join(", ")}]` : "";
    console.log(
      `    ${String(places).padStart(2)} places -> ${shape.padEnd(9)} last=${shareOf(places - 1).toFixed(2)}%${mid}`,
    );
  }
});

test("defaultShapeForPlaces flattens past 6 places, as AFC's own events did", () => {
  assert.equal(defaultShapeForPlaces(3), "top_heavy");   // matches event #53
  assert.equal(defaultShapeForPlaces(6), "top_heavy");   // matches event #172
  assert.equal(defaultShapeForPlaces(7), "balanced");
  assert.equal(defaultShapeForPlaces(12), "balanced");   // matches event #184
});

// ── 6. rounding granularity: whole units when free, cents when not ───────────
test("a big pool is split into whole currency units, no ragged cents", () => {
  const split = suggestPrizeSplit(1_000_000, 12, "balanced")!;
  for (const line of split.lines) {
    assert.ok(!line.includes("."), `"${line}" should be a whole number on a pool this size`);
  }
  console.log(`    [${split.lines.join(", ")}]  remainder to 1st = ${split.remainderToFirst}`);
});

test("a modest whole-number pool still comes out in whole units", () => {
  // The real DYNASTY CUP pool. Cents here (203.21 / 101.58 / 50.79 ...) would read as a worse
  // suggestion than whole units, and AFC's actual table for this event was entirely whole.
  const split = suggestPrizeSplit(400, 6, "top_heavy")!;
  for (const line of split.lines) {
    assert.ok(!line.includes("."), `"${line}" should be whole on a 400 pool across 6 places`);
  }
  console.log(`    400 across 6 top_heavy -> [${split.lines.join(", ")}]`);
});

test("a small pool keeps cent accuracy rather than bending the curve", () => {
  // A flat split of 10 across 4 must be able to say 2.50. Whole units would force 2/2/2/4.
  const split = suggestPrizeSplit(10, 4, "flat")!;
  assert.equal(split.linesCents.reduce((s, c) => s + c, 0), 1000);
  assert.deepEqual(split.lines, ["2.50", "2.50", "2.50", "2.50"]);
  console.log(`    10 across 4 flat -> [${split.lines.join(", ")}]`);
});

test("the rounding remainder that lands on 1st is small, not a dumping ground", () => {
  // Rounding places 2..N down can hand 1st at most (N-1) units. On any realistic pool that is
  // negligible; this pins it so a future change to the granularity cannot quietly inflate 1st.
  for (const [pool, places] of [[5000, 12], [1_000_000, 12], [333, 7], [400, 6]] as const) {
    const split = suggestPrizeSplit(pool, places, defaultShapeForPlaces(places))!;
    const share = (split.remainderToFirst / pool) * 100;
    assert.ok(share < 1, `pool ${pool} / ${places}: remainder to 1st was ${share.toFixed(3)}% of pool`);
    console.log(`    pool ${String(pool).padStart(9)} / ${String(places).padStart(2)} places -> remainder to 1st = ${split.remainderToFirst} (${share.toFixed(4)}% of pool)`);
  }
});

// ── 7. the output plugs straight into the form ───────────────────────────────
test("buildSuggestedDistribution produces the contiguous 1..N map the form holds", () => {
  const split = suggestPrizeSplit(1750, 3, "top_heavy")!;
  assert.deepEqual(buildSuggestedDistribution(split), { "1": "1000", "2": "500", "3": "250" });
});

test("amounts are plain number strings with no thousands separators", () => {
  // The amount fields are <Input type="number">; a separator would blank them.
  const split = suggestPrizeSplit(1_000_000, 12, "balanced")!;
  for (const line of split.lines) {
    assert.ok(/^\d+(\.\d{2})?$/.test(line), `"${line}" is not a plain number string`);
  }
});
