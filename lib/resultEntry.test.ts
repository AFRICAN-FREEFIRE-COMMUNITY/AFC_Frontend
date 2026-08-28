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
  previousMatchStats,
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

// ── a stored placement of 0 ──────────────────────────────────────────────────

test("a stored placement of 0 is read back as NOT ENTERED", () => {
  // Reproduced on a real map 2026-08-27. Save a map with two teams marked as not playing and the
  // API stores placement 0 for both. Seed that back as 0 and the next save posts 0 twice, so
  // validate_placements refuses it for duplicate position 0 and the map can never be saved again.
  // There is no 0th place, so a stored 0 can only mean the box was empty.
  const [seeded] = buildEntryTeams({
    teams: [
      { tournament_team_id: 7, team_name: "T", team_logo: null, members: [{ player_id: 1, username: "a" }] },
    ],
    savedStats: [{ tournament_team_id: 7, placement: 0, played: false, players: [] }],
    previousStats: null,
    maxPlayed: 4,
  });
  assert.equal(seeded.placement, null);
  assert.equal(seeded.played, false);
});

test("a real placement still survives seeding, including position 1", () => {
  // The guard against over-correcting: only 0 is special, and 1 must not be swept up with it.
  const [seeded] = buildEntryTeams({
    teams: [
      { tournament_team_id: 7, team_name: "T", team_logo: null, members: [{ player_id: 1, username: "a" }] },
    ],
    savedStats: [{ tournament_team_id: 7, placement: 1, players: [{ player_id: 1, kills: 0 }] }],
    previousStats: null,
    maxPlayed: 4,
  });
  assert.equal(seeded.placement, 1);
  // A stored 0 KILLS is a real answer and must not be swept up either.
  assert.equal(seeded.players[0].kills, 0);
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

// ── previousMatchStats: which map the lineup carries FROM ────────────────────

const MAPS = [
  { match_id: 11, match_number: 1, stats: [{ tournament_team_id: 1, players: [{ player_id: 5 }] }] },
  { match_id: 12, match_number: 2, stats: [{ tournament_team_id: 1, players: [{ player_id: 6 }] }] },
  { match_id: 13, match_number: 3, stats: [] },
];

test("map 2 carries from map 1", () => {
  assert.equal(previousMatchStats(MAPS, 12)?.[0].players[0].player_id, 5);
});

test("the FIRST map has no previous, so the lineup falls back to the roster", () => {
  assert.equal(previousMatchStats(MAPS, 11), null);
});

test("previous is chosen by match_number, NOT by position in the array", () => {
  // The API happens to return these in order today. If that ever changes, position would carry the
  // wrong map's lineup and nobody would notice, so the rule is the number.
  const shuffled = [MAPS[2], MAPS[0], MAPS[1]];
  assert.equal(previousMatchStats(shuffled, 12)?.[0].players[0].player_id, 5);
});

test("it skips no maps: map 3 carries from map 2, not from map 1", () => {
  assert.equal(previousMatchStats(MAPS, 13)?.[0].players[0].player_id, 6);
});

test("a previous map that was never entered yields null, not an empty lineup", () => {
  // [] would mean "entered, nobody played" and would pin every lineup empty on the next map.
  const maps = [
    { match_id: 21, match_number: 1, stats: [] },
    { match_id: 22, match_number: 2, stats: [] },
  ];
  assert.equal(previousMatchStats(maps, 22), null);
});

test("an unknown match id yields null rather than guessing", () => {
  assert.equal(previousMatchStats(MAPS, 999), null);
  assert.equal(previousMatchStats([], 11), null);
});

test("the carry-forward NEVER overwrites a map that was already entered", () => {
  // The end-to-end version of precedence rule 1, through the two functions the component actually
  // calls. This is the failure that would be worst: an organizer's finished map silently replaced
  // by the previous map's lineup.
  const teams = [
    {
      tournament_team_id: 1,
      team_name: "T",
      team_logo: null,
      members: [1, 2, 3, 4, 5, 6].map((n) => ({ player_id: n, username: `p${n}` })),
    },
  ];
  const seeded = buildEntryTeams({
    teams,
    savedStats: [{ tournament_team_id: 1, placement: 3, players: [{ player_id: 5, kills: 2 }] }],
    previousStats: [
      { tournament_team_id: 1, players: [1, 2, 3, 4].map((n) => ({ player_id: n, kills: 0 })) },
    ],
    maxPlayed: 4,
  });
  assert.deepEqual(
    seeded[0].players.filter((p) => p.played).map((p) => p.user_id),
    [5],
  );
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
