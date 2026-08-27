// lib/resultEntry.test.ts
// ─────────────────────────────────────────────────────────────────────────────
// Run: node --test lib/resultEntry.test.ts        (from frontend/, Node's own runner,
//                                                  type stripping, no test framework)
//
// Two kinds of test live here and they do different jobs.
//
//   UNIT TESTS pin the rules that are NEW, because a wrong answer in the lineup precedence would
//   be silent: the boxes would simply show the wrong four players and nobody would know which
//   rule had misfired.
//
//   THE GOLDEN REPLAY pins the rules that are OLD. lib/__fixtures__/manual-entry-golden.json was
//   captured from the UNCHANGED screen before this rebuild started, on a real 14-team map, and
//   replaying it is what turns "I believe the rebuild posts the same thing" into an assertion.
//   This is the same device that made the event contract conversion safe.
// ─────────────────────────────────────────────────────────────────────────────
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildEntryTeams,
  buildTeamPayload,
  resolveLineup,
  takenPlacements,
  teamIsComplete,
  type EntryTeam,
} from "./resultEntry.ts";
// Captured in Task 1 from code nobody had touched. import attributes are how the Node test runner
// loads JSON.
import golden from "./__fixtures__/manual-entry-golden.json" with { type: "json" };

// ── resolveLineup: the one piece of new logic that can be silently wrong ──────

test("a map already entered keeps its OWN lineup", () => {
  // The rule that matters most: a carry-forward is a default for an EMPTY map, never a correction
  // applied to a map somebody has already filled in.
  const got = resolveLineup({
    savedPlayedIds: [10, 11, 12, 13],
    previousPlayedIds: [20, 21, 22, 23],
    rosterIds: [10, 11, 12, 13, 20, 21],
    maxPlayed: 4,
  });
  assert.deepEqual(got, [10, 11, 12, 13]);
});

test("an EMPTY saved lineup is a real answer, not a missing one", () => {
  // [] means "this map was entered and nobody played". Gating on truthiness here would fall
  // through to the previous map and silently resurrect four players. Same shape as the
  // required_connections outage on 2026-08-26.
  const got = resolveLineup({
    savedPlayedIds: [],
    previousPlayedIds: [20, 21, 22, 23],
    rosterIds: [20, 21, 22, 23],
    maxPlayed: 4,
  });
  assert.deepEqual(got, []);
});

test("an un-entered map inherits the PREVIOUS map's lineup", () => {
  const got = resolveLineup({
    savedPlayedIds: null,
    previousPlayedIds: [20, 21, 22, 23],
    rosterIds: [10, 20, 21, 22, 23, 30],
    maxPlayed: 4,
  });
  assert.deepEqual(got, [20, 21, 22, 23]);
});

test("a carried lineup drops anyone no longer on the roster", () => {
  // A player can be removed from the event roster between maps. Carrying them forward would post
  // a user_id the backend will not accept for this team.
  const got = resolveLineup({
    savedPlayedIds: null,
    previousPlayedIds: [20, 21, 22, 99],
    rosterIds: [20, 21, 22, 23],
    maxPlayed: 4,
  });
  assert.deepEqual(got, [20, 21, 22]);
});

// NOT today's behaviour, deliberately. Today a member is ticked only if they have a saved row for
// this map (`played: sp != null` in the component), so a fresh map opens with NOBODY selected and
// the organizer ticks four by hand every time. See results-entry-redesign.md 4.3.
test("with no previous map it falls back to the roster's first four", () => {
  const got = resolveLineup({
    savedPlayedIds: null,
    previousPlayedIds: null,
    rosterIds: [1, 2, 3, 4, 5, 6],
    maxPlayed: 4,
  });
  assert.deepEqual(got, [1, 2, 3, 4]);
});

test("a roster smaller than the cap is taken whole", () => {
  const got = resolveLineup({
    savedPlayedIds: null,
    previousPlayedIds: null,
    rosterIds: [1, 2],
    maxPlayed: 4,
  });
  assert.deepEqual(got, [1, 2]);
});

test("a saved lineup longer than the cap is trimmed", () => {
  // The backend refuses more than 4 played players in a squad match, so the UI must not be able
  // to present five as the starting state.
  const got = resolveLineup({
    savedPlayedIds: [1, 2, 3, 4, 5],
    previousPlayedIds: null,
    rosterIds: [1, 2, 3, 4, 5],
    maxPlayed: 4,
  });
  assert.deepEqual(got, [1, 2, 3, 4]);
});

// ── buildTeamPayload ─────────────────────────────────────────────────────────

function team(over: Partial<EntryTeam> = {}): EntryTeam {
  return {
    tournament_team_id: 1,
    team_name: "T",
    team_logo: null,
    placement: 3,
    played: true,
    players: [
      { user_id: 10, username: "a", kills: 2, played: true },
      { user_id: 11, username: "b", kills: null, played: true },
      { user_id: 12, username: "c", kills: 7, played: false },
    ],
    ...over,
  };
}

test("only players who PLAYED are posted, and a blank kills box is 0", () => {
  const [row] = buildTeamPayload([team()]);
  assert.deepEqual(row.players, [
    { user_id: 10, kills: 2, played: true },
    { user_id: 11, kills: 0, played: true },
  ]);
});

test("placement is posted RAW so an empty one is refused rather than scored as zero", () => {
  const [row] = buildTeamPayload([team({ placement: null })]);
  assert.equal(row.placement, null);
});

test("a team marked not played still posts, carrying its played flag", () => {
  const [row] = buildTeamPayload([team({ played: false })]);
  assert.equal(row.played, false);
});

// ── the GOLDEN replay: the thing that makes this rebuild provable ────────────
//
// The fixture carries the inputs the old screen was seeded from (`seedInput`), its own state at
// submit time (`teamResults`), the exact body it posted (`postedResults`), and that same body with
// damage and assists removed (`postedResultsAfterFieldDrop`), derived by script in Task 2.

test("GOLDEN: the payload builder reproduces what the old screen posted", () => {
  assert.deepEqual(
    buildTeamPayload(golden.teamResults as unknown as EntryTeam[]),
    golden.postedResultsAfterFieldDrop,
  );
});

test("GOLDEN: seeding from the same inputs reproduces the same state", () => {
  // The other end. Without this the golden proves only the OUTPUT half, and the seeding could
  // reshape silently.
  //
  // Only meaningful because the capture is from a REOPENED map: everything on screen came from
  // savedStats, so what the old component seeded IS golden.teamResults. From a first submit the
  // state holds numbers a human typed that no seeding function could reproduce.
  const rebuilt = buildEntryTeams({
    teams: golden.seedInput.teams,
    savedStats: golden.seedInput.savedStats,
    previousStats: null,
    maxPlayed: 4,
  });

  // The two teams with NO saved row are excluded on purpose. Their seeding is exactly what this
  // work deliberately changes (today: nobody ticked; after: the roster's first four), so pinning
  // them to the old behaviour would pin the thing being removed. Everything else must match.
  const savedIds = new Set(golden.seedInput.savedStats.map((s: any) => s.tournament_team_id));
  const only = (rows: any[]) => rows.filter((r) => savedIds.has(r.tournament_team_id));

  assert.deepEqual(
    only(buildTeamPayload(rebuilt)),
    only(golden.postedResultsAfterFieldDrop),
  );

  // And the lineups themselves, which the payload's played-only filter would otherwise hide.
  assert.deepEqual(
    only(rebuilt).map((t: any) => t.players.filter((p: any) => p.played).map((p: any) => p.user_id)),
    only(golden.teamResults as any[]).map((t: any) =>
      t.players.filter((p: any) => p.played).map((p: any) => p.user_id),
    ),
  );
});

test("GOLDEN: the fixture actually contains the cases it claims to", () => {
  // A golden that quietly lost its interesting rows would still pass every assertion above while
  // proving much less, so the fixture's own shape is asserted rather than trusted.
  const posted = golden.postedResultsAfterFieldDrop;
  const zeroKills = posted.flatMap((t: any) => t.players).filter((p: any) => p.kills === 0).length;
  const bench = (golden.teamResults as any[])
    .flatMap((t: any) => t.players)
    .filter((p: any) => !p.played).length;

  assert.equal(golden.seedInput.teams.length, 14);
  assert.equal(golden.seedInput.savedStats.length, 12);
  assert.ok(zeroKills >= 5, `expected several zero-kill players, got ${zeroKills}`);
  assert.ok(bench >= 20, `expected many rostered players who did not play, got ${bench}`);
  assert.equal(posted.filter((t: any) => !t.played).length, 2);
  // No saved player row carries a `played` key: presence in `players` IS the record that they
  // played. Reading a `played` flag there would seed every lineup empty.
  const anyPlayedKey = golden.seedInput.savedStats.some((s: any) =>
    (s.players || []).some((p: any) => "played" in p),
  );
  assert.equal(anyPlayedKey, false);
});

// ── takenPlacements and teamIsComplete ───────────────────────────────────────

test("placements taken by OTHER teams are listed, excluding this one", () => {
  // The backend already refuses duplicate placements, but only at SAVE, after all twelve teams
  // have been entered. Showing it at entry turns a rejected save into something that cannot be
  // typed. A team must not see its own number as taken or it could never keep it.
  const teams = [
    team({ tournament_team_id: 1, placement: 1 }),
    team({ tournament_team_id: 2, placement: 2 }),
    team({ tournament_team_id: 3, placement: null }),
    team({ tournament_team_id: 4, placement: 4, played: false }),
  ];
  assert.deepEqual(takenPlacements(teams, 2), [1]);
});

test("a team that did not play does not hold a placement against anyone", () => {
  const teams = [team({ tournament_team_id: 1, placement: 5, played: false })];
  assert.deepEqual(takenPlacements(teams, 99), []);
});

test("a team is complete once it has a placement, and a skipped team counts as done", () => {
  assert.equal(teamIsComplete(team({ placement: 3 })), true);
  assert.equal(teamIsComplete(team({ placement: null })), false);
  assert.equal(teamIsComplete(team({ placement: null, played: false })), true);
});
