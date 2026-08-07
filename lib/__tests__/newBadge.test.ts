/**
 * lib/__tests__/newBadge.test.ts
 * ──────────────────────────────
 * Unit tests for the NEW tag's expiry maths in lib/newBadge.ts (owner rule: "Every new
 * feature or page wears a NEW tag for 5 days").
 *
 * Run with:  node --test lib/__tests__/newBadge.test.ts
 * (Node 25 strips the TypeScript types natively, so no build step and no test runner is
 * needed. The module under test is deliberately free of React and next-intl so it imports
 * here cleanly - the same arrangement as lib/prizeSuggestion.ts and its suite.)
 *
 * The one behaviour that has to be right, because everything else about the rule depends on
 * it: the badge goes away BY ITSELF, at the same moment for everybody, and it is not
 * possible to leave one on the site by forgetting about it.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  isNew,
  newBadgeWindow,
  parseGoLive,
  NEW_BADGE_DAYS,
} from "../newBadge.ts";

// ── helpers ──────────────────────────────────────────────────────────────────
/** Absolute instant for a UTC wall-clock reading, so the tests can name a boundary exactly. */
const utc = (iso: string) => Date.parse(iso);

/** The go-live date every case below hangs off: the day the Help Center shipped. */
const LIVE = "2026-08-06";

// ── 1. the constant is the single dial ───────────────────────────────────────
test("the default window is the 5 days the owner asked for", () => {
  assert.equal(NEW_BADGE_DAYS, 5);
  console.log(`    NEW_BADGE_DAYS = ${NEW_BADGE_DAYS}`);
});

// ── 2. inside the window it renders ──────────────────────────────────────────
test("inside the window: visible on the go-live day and on every day up to the 5th", () => {
  // Day 1 is the go-live day itself, so days 1..5 are 6th, 7th, 8th, 9th, 10th August.
  const insideDays = [
    ["2026-08-06T00:00:00Z", "day 1, the very first instant"],
    ["2026-08-06T12:00:00Z", "day 1, midday"],
    ["2026-08-07T09:30:00Z", "day 2"],
    ["2026-08-08T23:59:59Z", "day 3"],
    ["2026-08-09T06:00:00Z", "day 4"],
    ["2026-08-10T23:59:59Z", "day 5, the last second"],
  ] as const;

  for (const [instant, label] of insideDays) {
    const visible = isNew(LIVE, NEW_BADGE_DAYS, utc(instant));
    assert.equal(visible, true, `${label} (${instant}) should still show the badge`);
    console.log(`    ${instant}  ${label.padEnd(28)} -> visible`);
  }
});

// ── 3. the boundary, to the millisecond ──────────────────────────────────────
test("the boundary: alive at the last millisecond, gone at the first millisecond after", () => {
  const window = newBadgeWindow(LIVE)!;

  // The window is half-open [start, end): the end instant itself is already expired.
  assert.equal(isNew(LIVE, NEW_BADGE_DAYS, window.end - 1), true, "one ms before end: visible");
  assert.equal(isNew(LIVE, NEW_BADGE_DAYS, window.end), false, "exactly at end: gone");
  assert.equal(isNew(LIVE, NEW_BADGE_DAYS, window.end + 1), false, "one ms after end: gone");

  // And that end instant is exactly midnight UTC five days on, not some drifted value.
  assert.equal(new Date(window.end).toISOString(), "2026-08-11T00:00:00.000Z");
  console.log(`    window = [${new Date(window.start).toISOString()}, ${new Date(window.end).toISOString()})`);
  console.log(`    end - 1ms -> visible   |   end -> gone   |   end + 1ms -> gone`);
});

// ── 4. after 5 days it renders NOTHING ───────────────────────────────────────
test("after the window: renders nothing, on the 6th day and forever after", () => {
  const afterDays = [
    ["2026-08-11T00:00:00Z", "day 6, first instant"],
    ["2026-08-11T12:00:00Z", "day 6, midday"],
    ["2026-08-20T00:00:00Z", "two weeks later"],
    ["2027-03-01T00:00:00Z", "the following March"],
  ] as const;

  for (const [instant, label] of afterDays) {
    const visible = isNew(LIVE, NEW_BADGE_DAYS, utc(instant));
    assert.equal(visible, false, `${label} (${instant}) must render nothing`);
    console.log(`    ${instant}  ${label.padEnd(28)} -> nothing`);
  }
});

// ── 5. a date in the future is not new YET ───────────────────────────────────
test("a go-live date that has not arrived yet stays hidden", () => {
  assert.equal(isNew("2026-08-20", NEW_BADGE_DAYS, utc("2026-08-06T00:00:00Z")), false);
  // ...and switches on the moment that day begins, in UTC.
  assert.equal(isNew("2026-08-20", NEW_BADGE_DAYS, utc("2026-08-19T23:59:59Z")), false);
  assert.equal(isNew("2026-08-20", NEW_BADGE_DAYS, utc("2026-08-20T00:00:00Z")), true);
});

// ── 6. the boundary is the SAME instant in every timezone ────────────────────
test("every viewer loses the badge at the same absolute moment, whatever their zone", () => {
  // The failure this guards against: a badge that expires at local midnight dies at a
  // different absolute moment per zone, so it can come back when the same account opens a
  // device set elsewhere. AFC spans about UTC-1 (Cabo Verde) to UTC+3 (East Africa).
  const window = newBadgeWindow(LIVE)!;

  // One single instant in time, written as the local wall clock in five AFC-relevant zones.
  // All five are the SAME epoch number, so all five must agree the badge is gone.
  const sameInstantExpired = [
    ["2026-08-10T23:00:00-01:00", "Cabo Verde  UTC-1"],
    ["2026-08-11T00:00:00Z", "Accra       UTC+0"],
    ["2026-08-11T01:00:00+01:00", "Lagos       UTC+1"],
    ["2026-08-11T02:00:00+02:00", "Johannesburg UTC+2"],
    ["2026-08-11T03:00:00+03:00", "Nairobi     UTC+3"],
  ] as const;

  const epochs = new Set(sameInstantExpired.map(([iso]) => Date.parse(iso)));
  assert.equal(epochs.size, 1, "the five readings must be one and the same instant");
  assert.equal([...epochs][0], window.end, "and that instant is exactly the window end");

  for (const [iso, zone] of sameInstantExpired) {
    assert.equal(isNew(LIVE, NEW_BADGE_DAYS, Date.parse(iso)), false, `${zone} must agree it is gone`);
    console.log(`    ${zone.padEnd(20)} local ${iso}  -> gone`);
  }

  // One millisecond earlier, that same single instant, every zone still shows it.
  for (const [iso, zone] of sameInstantExpired) {
    assert.equal(isNew(LIVE, NEW_BADGE_DAYS, Date.parse(iso) - 1), true, `${zone} must agree it is alive`);
  }
  console.log(`    one ms earlier: all five zones agree it is still visible`);
});

// ── 7. an unusable date is a hidden badge, never a crash ─────────────────────
test("a malformed or impossible go-live date renders nothing instead of throwing", () => {
  const rejected = [
    ["", "empty string"],
    ["not-a-date", "prose"],
    ["2026-8-6", "unpadded parts"],
    ["06/08/2026", "the other date order"],
    ["2026-02-31", "31 February, which Date.UTC would roll to 3 March"],
    ["2026-13-01", "month 13"],
    ["2026-08-06T12:00:00Z", "a full timestamp, refused so no local/UTC ambiguity creeps in"],
  ] as const;

  for (const [value, why] of rejected) {
    assert.equal(parseGoLive(value), null, `${why} should not parse`);
    assert.equal(isNew(value, NEW_BADGE_DAYS, utc("2026-08-06T12:00:00Z")), false, `${why} should render nothing`);
    console.log(`    ${JSON.stringify(value).padEnd(24)} ${why.padEnd(52)} -> nothing`);
  }
});

// ── 8. the window is exactly N x 24h, at any N ───────────────────────────────
test("changing NEW_BADGE_DAYS re-times the badge exactly, with no off-by-one", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  for (const days of [1, 3, 5, 7, 14]) {
    const window = newBadgeWindow(LIVE, days)!;
    assert.equal(window.end - window.start, days * DAY_MS, `${days} days must be ${days} x 24h`);
    // Alive right up to the end, gone at it.
    assert.equal(isNew(LIVE, days, window.end - 1), true);
    assert.equal(isNew(LIVE, days, window.end), false);
    console.log(`    ${String(days).padStart(2)} days -> expires ${new Date(window.end).toISOString()}`);
  }
});

// ── 9. the dates actually shipped in this batch expire when they should ──────
test("the real go-live dates used across the site expire on the day they should", () => {
  // Every date passed to a <NewBadge since="..."> in this batch. If one of these ever starts
  // failing, a call site was written with a date the maths cannot read.
  const shipped = [
    ["2026-08-05", "team invite link for several people"],
    ["2026-08-06", "Help Center, two step sign-in, event team invitations"],
    ["2026-08-07", "Education Updates, prize split, Booyah design, UID/email repair, partner API guide"],
  ] as const;

  for (const [since, what] of shipped) {
    const window = newBadgeWindow(since);
    assert.ok(window, `${since} must parse`);
    const expires = new Date(window!.end).toISOString().slice(0, 10);
    // Sanity: it is live on its own go-live day and dead five days later.
    assert.equal(isNew(since, NEW_BADGE_DAYS, window!.start), true);
    assert.equal(isNew(since, NEW_BADGE_DAYS, window!.end), false);
    console.log(`    since ${since} -> gone at ${expires}T00:00Z  (${what})`);
  }
});
