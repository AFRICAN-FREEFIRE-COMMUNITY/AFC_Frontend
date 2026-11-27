// lib/fuzzyMatch.test.ts
// Tests for lib/fuzzyMatch.ts (the forgiving creator search, owner 27 Nov 2026, inbox #654 / #655).
// No framework in this app: run on the Node test runner, as lib/scoreInput.test.ts does.
//   node --test lib/fuzzyMatch.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { fuzzyFilter, fuzzyScore, normalizeForSearch } from "./fuzzyMatch.ts";

test("normalizeForSearch folds case, accents, symbols and repeated letters", () => {
  assert.equal(normalizeForSearch("@Jokkie"), "jokie");
  assert.equal(normalizeForSearch("Jook"), "jok");
  assert.equal(normalizeForSearch("Zoë  K-Dee!"), "zoekde");
});

test("the nearest names are found", () => {
  assert.ok(fuzzyScore("jook", ["Jokie", "jokie"]) > 0);
  assert.ok(fuzzyScore("jook", ["jokkie"]) > 0);
  assert.ok(fuzzyScore("abdale", ["Abdalle gamer"]) > 0);
  assert.ok(fuzzyScore("army kidd", ["Army Kid"]) > 0);
});

test("unrelated and very short queries do not match", () => {
  assert.equal(fuzzyScore("zz", ["Jokie"]), 0);
  assert.equal(fuzzyScore("xavier", ["Jokie", "jokie"]), 0);
  assert.equal(fuzzyScore("jx", ["Jokie"]), 0);
});

test("a transposed or wrong letter falls to the typo tier, below the exact rules", () => {
  assert.ok(fuzzyScore("jokei", ["Jokie"]) > 0);
  assert.ok(fuzzyScore("jokei", ["Jokie"]) < fuzzyScore("jok", ["Jokie"]));
});

test("stronger rules outrank weaker ones, ties keep their order, an empty query keeps the list", () => {
  assert.ok(fuzzyScore("jokie", ["Jokie"]) > fuzzyScore("jok", ["Jokie"]));
  assert.ok(fuzzyScore("jok", ["Jokie"]) > fuzzyScore("okie", ["Jokie"]));
  const list = ["Maria", "Okie", "Jokie", "Jokkie"];
  assert.deepEqual(fuzzyFilter(list, "jokie", (n) => [n]), ["Jokie", "Jokkie", "Okie"].filter((n) => fuzzyScore("jokie", [n]) > 0));
  assert.equal(fuzzyFilter(list, "jokie", (n) => [n])[0], "Jokie");
  assert.deepEqual(fuzzyFilter(list, "  ", (n) => [n]), list);
});
