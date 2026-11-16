/**
 * lib/__tests__/letterScope.test.ts
 * ─────────────────────────────────
 * Unit tests for lib/letterScope.ts (AFC inbox #602): the site's copy of the server's "a letter is
 * distinct per lobby" rule, used to grey taken letters, flag clashes and filter by stage / group.
 *
 * Run with:  node --test lib/__tests__/letterScope.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  clashes,
  letterIn,
  letterSource,
  takenFor,
  teamsInScope,
  type LetterStage,
  type LetterTeam,
} from "../letterScope.ts";

const team = (id: number, assigned: string | null, stage: Record<string, string> = {}): LetterTeam => ({
  tournament_team_id: id,
  team_id: id * 10,
  team_name: `T${id}`,
  available_letters: [],
  assigned_letter: assigned,
  stage_letters: stage,
  member_count: 4,
});

// Stage 1: Group 1 = 1, 2 ; Group 2 = 3, 4. Stage 2 (one lobby): 1, 3.
const stages: LetterStage[] = [
  {
    stage_id: 1,
    stage_name: "Groups",
    rooms: [
      { group_id: 11, group_name: "Group 1", tournament_team_ids: [1, 2] },
      { group_id: 12, group_name: "Group 2", tournament_team_ids: [3, 4] },
    ],
  },
  { stage_id: 2, stage_name: "Final", rooms: [{ group_id: 21, group_name: "Final", tournament_team_ids: [1, 3] }] },
];

test("a stage letter wins over the all-stages letter in that stage only", () => {
  const t = team(1, "A", { "1": "Q" });
  assert.equal(letterIn(t, 1), "Q");
  assert.equal(letterIn(t, 2), "A");
  assert.equal(letterIn(t, null), "A");
  assert.equal(letterSource(t, 1), "stage");
  assert.equal(letterSource(t, 2), "all");
});

test("scope filters to a stage or one lobby", () => {
  assert.deepEqual([...teamsInScope(stages, 1, 12, [1, 2, 3, 4])].sort(), [3, 4]);
  assert.deepEqual([...teamsInScope(stages, 2, null, [1, 2, 3, 4])].sort(), [1, 3]);
  assert.deepEqual([...teamsInScope(stages, null, null, [1, 2, 3, 4])].sort(), [1, 2, 3, 4]);
});

test("taken letters come only from room mates, in the stages the letter applies to", () => {
  const teams = { 1: team(1, null), 2: team(2, "B"), 3: team(3, "C"), 4: team(4, "D") };
  // Stage 1 only: team 1 meets team 2 -> B is taken, C and D are free.
  assert.deepEqual([...takenFor(1, teams, stages, [1]).keys()], ["B"]);
  // All stages: also meets team 3 in the final -> B and C.
  assert.deepEqual([...takenFor(1, teams, stages, null).keys()].sort(), ["B", "C"]);
});

test("an event with no stages is one room", () => {
  const teams = { 1: team(1, null), 2: team(2, "B") };
  assert.deepEqual([...takenFor(1, teams, [], null).keys()], ["B"]);
});

test("clashes are reported inside a lobby, never across lobbies", () => {
  const teams = { 1: team(1, "A"), 2: team(2, "A"), 3: team(3, "A"), 4: team(4, null) };
  const c = clashes(teams, stages, 1);
  assert.equal(c.get(1), 2);
  assert.equal(c.get(2), 1);
  assert.equal(c.has(3), false);
});
