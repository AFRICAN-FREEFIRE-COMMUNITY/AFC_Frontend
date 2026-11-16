/**
 * lib/__tests__/letterSuggest.test.ts
 * ───────────────────────────────────
 * Unit tests for the letter suggester in lib/letterSuggest.ts (AFC inbox #602, owner 2026-11-16:
 * "there should also be a part that suggests what each team should use, based off what they have in
 * each group or if its per stage").
 *
 * Run with:  node --test lib/__tests__/letterSuggest.test.ts
 *
 * The invariant every case re-checks: no two teams that share a room ever get the same letter, and
 * every suggested letter is one the team owns.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { suggestLetters, type SuggestInput, type SuggestResult } from "../letterSuggest.ts";

function assertValid(input: SuggestInput, out: SuggestResult) {
  const owned = new Map(input.teams.map((t) => [t.id, new Set(t.owned)]));
  for (const [id, letter] of Object.entries(out.letters)) {
    assert.ok(owned.get(Number(id))?.has(letter), `team ${id} got ${letter}, which it does not own`);
  }
  for (const room of input.rooms) {
    const seen = new Map<string, number>();
    for (const id of room) {
      const letter = out.letters[id] ?? input.fixed?.[id] ?? null;
      if (!letter) continue;
      assert.ok(!seen.has(letter), `room ${room} repeats ${letter} (${seen.get(letter)} and ${id})`);
      seen.set(letter, id);
    }
  }
}

test("teams in different rooms may share a letter", () => {
  const input: SuggestInput = {
    teams: [
      { id: 1, owned: ["A"], current: null },
      { id: 2, owned: ["A"], current: null },
    ],
    rooms: [[1], [2]],
  };
  const out = suggestLetters(input);
  assertValid(input, out);
  assert.deepEqual(out.letters, { 1: "A", 2: "A" });
  assert.deepEqual(out.impossible, []);
});

test("one room never repeats a letter, and the most constrained team is served first", () => {
  // Team 1 owns only A; team 2 owns A and B. A greedy pass in id order works, the reverse would
  // not, so the suggester must not depend on the order teams arrive in.
  const input: SuggestInput = {
    teams: [
      { id: 2, owned: ["A", "B"], current: null },
      { id: 1, owned: ["A"], current: null },
    ],
    rooms: [[1, 2]],
  };
  const out = suggestLetters(input);
  assertValid(input, out);
  assert.deepEqual(out.letters, { 1: "A", 2: "B" });
});

test("a team that owns no letter is listed as impossible with its reason", () => {
  const input: SuggestInput = {
    teams: [
      { id: 1, owned: [], current: null },
      { id: 2, owned: ["C"], current: null },
    ],
    rooms: [[1, 2]],
  };
  const out = suggestLetters(input);
  assert.deepEqual(out.impossible, [1]);
  assert.equal(out.reasons[1], "owns_none");
  assert.equal(out.letters[2], "C");
});

test("a letter that already works is kept", () => {
  const input: SuggestInput = {
    teams: [
      { id: 1, owned: ["A", "B", "C"], current: "C" },
      { id: 2, owned: ["A", "B", "C"], current: null },
    ],
    rooms: [[1, 2]],
  };
  const out = suggestLetters(input);
  assertValid(input, out);
  assert.equal(out.letters[1], "C");
  assert.deepEqual(out.kept, [1]);
});

test("a swap is found when keeping a current letter would leave a team without one", () => {
  // Team 1 holds B but also owns A; team 2 owns only B. Keeping 1 on B starves 2, so the suggester
  // moves 1 to A.
  const input: SuggestInput = {
    teams: [
      { id: 1, owned: ["A", "B"], current: "B" },
      { id: 2, owned: ["B"], current: null },
    ],
    rooms: [[1, 2]],
  };
  const out = suggestLetters(input);
  assertValid(input, out);
  assert.deepEqual(out.letters, { 1: "A", 2: "B" });
});

test("letters held by teams outside the scope are respected", () => {
  // Team 9 is in the room but not being suggested for: its letter A is fixed.
  const input: SuggestInput = {
    teams: [{ id: 1, owned: ["A", "B"], current: null }],
    rooms: [[1, 9]],
    fixed: { 9: "A" },
  };
  const out = suggestLetters(input);
  assertValid(input, out);
  assert.equal(out.letters[1], "B");
});

test("more teams than letters in one room: some are impossible, none repeat", () => {
  const all = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const teams = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, owned: all, current: null }));
  const input: SuggestInput = { teams, rooms: [teams.map((t) => t.id)] };
  const out = suggestLetters(input);
  assertValid(input, out);
  assert.equal(Object.keys(out.letters).length, 26);
  assert.equal(out.impossible.length, 4);
  for (const id of out.impossible) assert.equal(out.reasons[id], "all_taken");
});

test("overlapping round robin rooms (A+B, A+C, B+C) behave like one room", () => {
  const groupA = [1, 2];
  const groupB = [3, 4];
  const groupC = [5, 6];
  const teams = [1, 2, 3, 4, 5, 6].map((id) => ({ id, owned: ["A", "B", "C", "D", "E", "F"], current: null }));
  const input: SuggestInput = {
    teams,
    rooms: [[...groupA, ...groupB], [...groupA, ...groupC], [...groupB, ...groupC]],
  };
  const out = suggestLetters(input);
  assertValid(input, out);
  assert.equal(new Set(Object.values(out.letters)).size, 6);
});

test("a large hard case returns a valid answer quickly", () => {
  // 48 teams in 4 rooms of 12, each team owning 3 random-ish letters. Must finish well under a second.
  const all = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const teams = Array.from({ length: 48 }, (_, i) => ({
    id: i + 1,
    owned: [all[i % 26], all[(i * 7) % 26], all[(i * 11 + 3) % 26]],
    current: null,
  }));
  const rooms = [0, 1, 2, 3].map((r) => teams.slice(r * 12, r * 12 + 12).map((t) => t.id));
  const started = Date.now();
  const out = suggestLetters({ teams, rooms });
  assert.ok(Date.now() - started < 1000);
  assertValid({ teams, rooms }, out);
});
