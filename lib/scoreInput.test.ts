// lib/scoreInput.test.ts
// ─────────────────────────────────────────────────────────────────────────────
// Regression tests for the manual result-entry bug the owner reported on 2026-08-06:
//   "if they put 0 as score for a particular player it glitches and does not calculate the
//    results well, and they can leave score blank for certain players."
//
// Every case below FAILS against the code this replaced, which rendered with `value || ""`
// and parsed with `parseInt(value) || 0`. Those two lines made 0 and "empty" the same thing,
// so a typed zero disappeared from the box and an empty box was posted as the number 0
// (which slipped past the backend's blank-placement guard and scored 0 points).
//
// No test framework is installed in this app, and none is added for this: the file runs on
// the Node test runner with Node's built-in type stripping.
//
//   cd frontend && node --test lib/scoreInput.test.ts
// ─────────────────────────────────────────────────────────────────────────────
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  hasScore,
  parseScoreInput,
  rowsMissingPlacement,
  scoreInputValue,
  scoreOrZero,
  type ScoreValue,
} from "./scoreInput.ts";

// ── What the box SHOWS ────────────────────────────────────────────────────────

test("a score of 0 stays visible in the box", () => {
  // The reported "glitch": typing 0 used to redraw the box empty, so the entry looked lost.
  assert.equal(scoreInputValue(0), "0");
});

test("an empty box stays empty, so it can still be cleared and retyped", () => {
  assert.equal(scoreInputValue(null), "");
});

test("an ordinary score renders unchanged", () => {
  assert.equal(scoreInputValue(7), "7");
});

// ── What the box READS BACK ───────────────────────────────────────────────────

test("typing 0 reads back as the number 0, not as empty", () => {
  assert.equal(parseScoreInput("0"), 0);
  assert.equal(hasScore(parseScoreInput("0")), true);
});

test("an empty box reads back as null, NOT as 0", () => {
  // This is the half that let a blank placement save silently: `parseInt("") || 0` gave 0,
  // so the backend's "left blank" guard (which rejects null) could never fire.
  assert.equal(parseScoreInput(""), null);
  assert.equal(parseScoreInput("   "), null);
});

test("a part-typed value that is not a number reads back as empty, not 0", () => {
  // A number input hands back "" or "-" mid-typing; neither is a score of zero.
  assert.equal(parseScoreInput("-"), null);
  assert.equal(parseScoreInput("abc"), null);
});

// ── What goes to the API ──────────────────────────────────────────────────────

test("a blank COUNT box means zero, because no kills is a real result", () => {
  assert.equal(scoreOrZero(null), 0);
  assert.equal(scoreOrZero(0), 0);
  assert.equal(scoreOrZero(5), 5);
});

// ── The three scenarios from the bug report ───────────────────────────────────

test("0 kills entered for ONE player is kept, and totals the same as any other score", () => {
  const players: ScoreValue[] = [4, 0, 3, 2]; // one player went scoreless
  assert.deepEqual(players.map(scoreInputValue), ["4", "0", "3", "2"]);
  assert.equal(players.reduce<number>((sum, k) => sum + scoreOrZero(k), 0), 9);
});

test("0 kills entered for EVERY player totals 0 and no box goes blank", () => {
  const players: ScoreValue[] = [0, 0, 0, 0]; // a wiped lobby
  assert.deepEqual(players.map(scoreInputValue), ["0", "0", "0", "0"]);
  assert.equal(players.reduce<number>((sum, k) => sum + scoreOrZero(k), 0), 0);
});

test("a placement left blank in the middle of a lobby is caught, and named", () => {
  // The exact shape of the reported save: eleven teams entered, one placement box empty.
  const rows = [
    { name: "Alpha", placement: 1 as ScoreValue, played: true },
    { name: "Bravo", placement: null as ScoreValue, played: true }, // left blank
    { name: "Charlie", placement: 3 as ScoreValue, played: true },
  ];
  assert.deepEqual(rowsMissingPlacement(rows), ["Bravo"]);
});

test("a placement of 0 is a real entry, so it is not reported as blank", () => {
  // Distinguishing these two is the whole point: 0 was typed, null never was.
  const rows = [{ name: "Alpha", placement: 0 as ScoreValue, played: true }];
  assert.deepEqual(rowsMissingPlacement(rows), []);
});

test("a row that did not play needs no placement", () => {
  // Unticking Played is how an organizer says a team sat this map out.
  const rows = [{ name: "Alpha", placement: null as ScoreValue, played: false }];
  assert.deepEqual(rowsMissingPlacement(rows), []);
});
