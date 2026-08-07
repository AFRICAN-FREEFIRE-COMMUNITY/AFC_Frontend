/**
 * lib/prizeSuggestion.ts
 * ──────────────────────
 * Suggest a prize-money split across N places for a given prize pool (owner backlog item 24:
 * "When an admin or organizer enters a prize pool value, suggest a distribution based on the
 * number of available positions").
 *
 * PURE MATHS ONLY. No React, no next-intl, no network. That is deliberate: it lets the maths be
 * unit-tested on its own (see lib/__tests__/prizeSuggestion.test.ts, run with `node --test`) and
 * keeps the rounding rule in one place instead of once per screen.
 *
 * HOW IT CONNECTS TO THE REST OF THE SYSTEM
 *   Called by  app/(a)/a/events/create/_components/PrizeSuggestionDialog.tsx  (the only caller).
 *   That dialog is rendered from BOTH prize surfaces, the same way PrizeDistributionSummary is:
 *     - create wizard  -> Step5PrizePool.tsx   (admin + organizer create pages both mount it)
 *     - edit prize tab -> PrizeRulesTab.tsx    (admin + organizer edit pages both mount it)
 *   The shape it returns, Record<"1".."N", string>, is exactly the `prize_distribution` map the
 *   event form already holds and POSTs to create_event / edit_event, and which the backend stores
 *   on Event.prize_distribution (afc_tournament_and_scrims/models.py). prize_sync.py later reads
 *   that map to write EventPrizePayout rows per finishing team, so the numbers suggested here are
 *   the numbers that eventually get paid out.
 *
 *   Nothing here converts currency. The amounts in prize_distribution are denominated in the
 *   event's own `prize_currency` field, and the multi-currency display layer (lib/money.ts +
 *   <Money from={prize_currency}>) converts them for VIEWERS at render time. So splitting a pool is
 *   currency-agnostic arithmetic: we split whatever number the organizer typed, in whatever
 *   currency they picked, and let the existing layer do the rest.
 *
 * ── THE CURVE, AND THE EVIDENCE FOR IT ──────────────────────────────────────────────────────
 * The shapes below are not invented. They were fitted to every prize distribution in the AFC
 * database that has real money in it (surveyed 2026-08-06). There are three:
 *
 *   Event #53  DETTY DECEMBER SOLOS         3 places   1000 / 500 / 250
 *   Event #172 DYNASTY CUP GRAND FINALS SSA  6 places   200 / 100 / 50 / 30 / 10 / 10
 *   Event #184 DECA CUP SEASON 5            12 places   300k/150k/120k/90k/90k/60k/60k/60k/20k/20k/15k/15k
 *
 * THE STRONGEST SIGNAL IN THE DATA: AFC pays 2nd place EXACTLY half of 1st in all three events,
 * at 3, 6 and 12 places alike (500/1000, 100/200, 150000/300000). Both real shapes below preserve
 * that exactly; it is the one property the curve is never allowed to break.
 *
 * THE SECOND SIGNAL: AFC FLATTENS AS PLACES GROW. Fitting each event:
 *   3 places  -> halving (each place half the one above) is an EXACT match, 0.00pp error
 *   6 places  -> halving again, within 1.15pp per place (the best fit of any curve tried)
 *   12 places -> halving is badly wrong (it would pay last place 0.02% of the pool, and AFC
 *                visibly declined to do that). A HARMONIC curve, where place i gets a share
 *                proportional to 1/i, fits within 2.56pp per place, the best of any curve tried,
 *                and still pays 2nd exactly half of 1st.
 *
 * So the two real shapes are halving (top heavy) and harmonic (balanced), and which one is
 * preselected depends on the place count, mirroring what AFC itself chose at each event size. A
 * harmonic curve also keeps the tail alive where halving cannot: at 12 places last place gets
 * 2.69% of the pool rather than 0.02%, and at 24 places 1.10% rather than nothing.
 *
 * HONEST CAVEAT: that is three distributions. It is enough to establish that the curve is top
 * heavy, that 2nd is half of 1st, and that a flat split would be wrong as a default, but it is a
 * small sample. These are SUGGESTIONS the organizer can accept, re-shape, or edit line by line.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */

/** The three shapes offered. Kept to three on purpose: a wall of options is worse than a good default. */
export type PrizeShapeId = "top_heavy" | "balanced" | "flat";

/** Render order for the shape picker. */
export const PRIZE_SHAPE_IDS: PrizeShapeId[] = ["top_heavy", "balanced", "flat"];

/**
 * Relative weight of place `index` (0-based, so index 0 is 1st place). Weights are normalised
 * against their own total, so only their RATIOS matter, not their scale.
 *
 *   top_heavy  halving,  weight 0.5^i   -> 1, 1/2, 1/4, 1/8 ...  (fits AFC at 3 and 6 places)
 *   balanced   harmonic, weight 1/(i+1) -> 1, 1/2, 1/3, 1/4 ...  (fits AFC at 12 places)
 *   flat       equal
 *
 * Note both real shapes start 1, 1/2: that is AFC's universal "2nd gets half of 1st" rule, and it
 * holds at every place count for free rather than being special-cased.
 */
function placeWeight(shape: PrizeShapeId, index: number): number {
  switch (shape) {
    case "top_heavy":
      return Math.pow(0.5, index);
    case "balanced":
      return 1 / (index + 1);
    case "flat":
      return 1;
  }
}

/**
 * Above this many places, halving starves the tail (place 12 would get 0.02% of the pool), and
 * AFC's own 12-place event used a much flatter curve. 6 is the boundary because AFC's 6-place
 * event still used halving while its 12-place one did not.
 */
const FLATTEN_ABOVE_PLACES = 6;

/** Sensible ceiling for the places input. Well past any real AFC event, but stops absurd values. */
export const MAX_SUGGESTED_PLACES = 50;

/**
 * Which shape to preselect for a given number of places, mirroring what AFC actually chose at each
 * event size (see the evidence block above). The organizer can override it with one press.
 */
export function defaultShapeForPlaces(places: number): PrizeShapeId {
  return places > FLATTEN_ABOVE_PLACES ? "balanced" : "top_heavy";
}

/**
 * ROUNDING GRANULARITY. Two levels only, and accuracy wins the tie.
 *
 * A prize table reads better in whole currency units (500, 250) than in cents (500.79, 250.39), so
 * we round to whole units WHEN THAT IS ESSENTIALLY FREE, and to the cent otherwise. "Free" means
 * the smallest line is at least MIN_UNITS_FOR_WHOLE units, so dropping its fractional part costs
 * it under 1%. Below that the pool is small enough that whole units would visibly bend the curve
 * (a flat split of 10 across 4 places must be able to say 2.50, not 2), so we keep the cent.
 *
 * An earlier draft rounded to a much coarser ladder (multiples of 1,000 on a big pool). It was
 * removed because it did the opposite of the job: on the real DETTY DECEMBER SOLOS pool of 1750
 * across 3 places it turned the exact historical answer of 1000/500/250 into 1050/500/200, and it
 * pushed 2nd place down to 0.385 of 1st when every AFC event on record pays exactly 0.5. Tidy
 * numbers are not worth distorting the evidence-based curve.
 */
const CENTS_PER_UNIT = 100;
/**
 * Whole units are used only when the rounding they push onto 1st place stays under this share of
 * the pool. Rounding places 2..N down costs at most one unit each, so the worst case 1st can
 * absorb is (N-1) units; measuring THAT against the pool is what keeps the curve honest. On a
 * 400 pool across 6 places that is 5 units, 1.25%, so the table comes out whole (206/101/50/25/
 * 12/6, close to the 200/100/50/30/10/10 AFC actually paid). On a pool of 10 across 4 places it
 * would be 30%, so that one keeps cents and can say 2.50 rather than being forced into 4/2/2/2.
 */
const MAX_WHOLE_UNIT_REMAINDER_SHARE = 0.02;

/** A suggested split, ready to drop into the form. */
export interface PrizeSplit {
  /** Amount per place, index 0 = 1st. Whole-number strings where possible, else 2dp. */
  lines: string[];
  /** Amount per place in cents, index 0 = 1st. Exposed so callers can compare/diff without reparsing. */
  linesCents: number[];
  /** How much the rounding handed to 1st place on top of its own rounded share, in major units. */
  remainderToFirst: number;
}

/**
 * Split `pool` across `places` positions using `shape`.
 *
 * ROUNDING, AND WHERE THE REMAINDER GOES
 *   All arithmetic runs in integer cents, so there is no floating-point drift to accumulate.
 *   Places 2..N are each rounded DOWN to the granularity chosen above; 1st place is then given
 *   whatever is left of the pool. That is one rule, it is easy to state to an organizer ("rounding
 *   goes to 1st place"), and it makes two guarantees hold for free:
 *     - the lines sum to the pool EXACTLY, always, with no leftover cent to explain
 *     - 1st place is never undercut, because rounding the others DOWN can only ever leave 1st more
 *       than its own raw share, and its raw share was already the largest
 *
 * Returns null when there is nothing sensible to suggest: a pool of zero or less, fewer than one
 * place, or a pool too small to give every place at least one cent. Callers show a hint instead of
 * a table in that case.
 */
export function suggestPrizeSplit(
  pool: number,
  places: number,
  shape: PrizeShapeId,
): PrizeSplit | null {
  if (!Number.isFinite(pool) || !Number.isFinite(places)) return null;
  const n = Math.floor(places);
  if (n < 1) return null;

  // Work in cents from here on. Math.round (not floor) so a pool carrying float dust lands on the
  // cent the organizer meant.
  const poolCents = Math.round(pool * 100);
  if (poolCents <= 0) return null;
  // Cannot give every place at least one cent, so any split would print zeroes. Refuse instead.
  if (poolCents < n) return null;

  // ── weights -> raw share per place ──
  const weights: number[] = [];
  for (let i = 0; i < n; i++) weights.push(placeWeight(shape, i));
  const weightTotal = weights.reduce((sum, w) => sum + w, 0);
  const rawCents = weights.map((w) => (poolCents * w) / weightTotal);

  // ── granularity: whole currency units when the rounding stays negligible, else cents ──
  // Two conditions, both required: no line may round away to nothing (so the smallest raw line
  // has to be worth at least a whole unit), and the worst-case remainder pushed onto 1st has to
  // stay under MAX_WHOLE_UNIT_REMAINDER_SHARE of the pool.
  const smallestRaw = rawCents[rawCents.length - 1];
  const worstCaseRemainderShare = ((n - 1) * CENTS_PER_UNIT) / poolCents;
  const useWholeUnits =
    smallestRaw >= CENTS_PER_UNIT &&
    worstCaseRemainderShare <= MAX_WHOLE_UNIT_REMAINDER_SHARE;
  const stepCents = useWholeUnits ? CENTS_PER_UNIT : 1;

  // ── places 2..N round down to the step; 1st takes the remainder ──
  const linesCents = new Array<number>(n).fill(0);
  let assigned = 0;
  for (let i = 1; i < n; i++) {
    linesCents[i] = Math.floor(rawCents[i] / stepCents) * stepCents;
    assigned += linesCents[i];
  }
  linesCents[0] = poolCents - assigned;

  return {
    lines: linesCents.map(centsToInputValue),
    linesCents,
    remainderToFirst: (linesCents[0] - Math.floor(rawCents[0] / stepCents) * stepCents) / 100,
  };
}

/**
 * Turn a suggested split into the `prize_distribution` map the event form holds: keys are the
 * contiguous numeric strings "1".."N" that lib/eventFormats.ts renumberPrizeDistribution produces,
 * values are plain number strings (no thousands separators, because the amount fields are
 * <Input type="number"> and a separator would blank them).
 */
export function buildSuggestedDistribution(split: PrizeSplit): Record<string, string> {
  const out: Record<string, string> = {};
  split.lines.forEach((amount, index) => {
    out[`${index + 1}`] = amount;
  });
  return out;
}

/**
 * Cents -> the string the amount input should hold. Whole amounts lose the ".00" so the table reads
 * "300000" and not "300000.00"; sub-unit amounts keep two decimals.
 */
function centsToInputValue(cents: number): string {
  return cents % 100 === 0 ? `${cents / 100}` : (cents / 100).toFixed(2);
}
