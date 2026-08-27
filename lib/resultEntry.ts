// lib/resultEntry.ts
// ─────────────────────────────────────────────────────────────────────────────
// The rules behind manual result entry, with no React in them.
//
// WHY THIS EXISTS (owner brief 2026-08-27)
//   Entering results by hand is too much work, "most especially for those using their phone",
//   because per-player entry is required and "teams swap players between maps". The rebuild that
//   answers that is a UI rebuild: the same numbers must end up in the same tables afterwards.
//
//   The only way to PROVE that with no component test framework in this repo is to make the data
//   flow testable without rendering anything. So both ends of it live here:
//
//       API response  ->  buildEntryTeams  ->  [ what the boxes show ]  ->  buildTeamPayload  ->  body
//
//   ManualMatchResultStep decides WHEN to seed and what the screen looks like. It does not decide
//   WHAT to seed or what to post. Those are these functions, and they are replayed in
//   lib/resultEntry.test.ts against lib/__fixtures__/manual-entry-golden.json, a real 14-team map
//   captured from the component BEFORE this rebuild began.
//
// THE SHAPES THIS TALKS TO, AND THEIR TRAPS
//   `savedStats` is `match.stats` from the leaderboard API. Two things about it are easy to get
//   wrong and both were confirmed in that capture rather than assumed:
//
//     • a player row carries `player_id` on some paths and `user_id` on others;
//     • a player row carries NO `played` key at all. PRESENCE in `players` is the record that the
//       member played. Filtering on a `played` flag would seed every lineup empty.
//
//   A team row likewise has no `played` key when the API built it, so absent means played, which
//   is what the component has always done (`stat?.played ?? true`).
//
// USED BY
//   • app/(a)/a/leaderboards/_components/ManualMatchResultStep.tsx  - the screen being rebuilt
//   • app/(a)/a/leaderboards/_components/_result-entry/*            - its per-team pieces
//
// RELATED
//   • lib/scoreInput.ts - absent-vs-zero for a single box (owner bug 2026-08-06). Every count
//     field here goes through its scoreOrZero, and placement deliberately does not.
// ─────────────────────────────────────────────────────────────────────────────
import { scoreOrZero, type ScoreValue } from "./scoreInput.ts";

/** One roster member's row on one map. `kills: null` means the box is empty, which is NOT 0. */
export type EntryPlayer = {
  user_id: number;
  username: string;
  kills: ScoreValue;
  played: boolean;
};

/** One team's whole entry for one map. */
export type EntryTeam = {
  tournament_team_id: number;
  team_name: string;
  team_logo: string | null;
  placement: ScoreValue;
  played: boolean;
  players: EntryPlayer[];
};

/**
 * Which roster members start the map selected.
 *
 * Precedence, most specific first. Rule 1 is the one that matters: the carry-forward is a DEFAULT
 * for an empty map, never a correction applied to a map somebody has already filled in.
 *
 *   1. this map's own saved lineup, if the map has been entered before
 *   2. the same team's lineup in the PREVIOUS map of this stage
 *   3. the registered roster, first `maxPlayed`
 *
 * Rule 3 is a deliberate CHANGE, not today's behaviour: today a member is ticked only if they have
 * a saved row for this map, so a fresh map opens with nobody selected and the organizer ticks four
 * by hand on every single map. That is most of the reported pain.
 *
 * `savedPlayedIds: []` is a real answer ("entered, nobody played") and must not fall through to
 * rule 2. The question is whether the value is present, never whether it contains anything.
 */
export function resolveLineup(args: {
  savedPlayedIds: number[] | null;
  previousPlayedIds: number[] | null;
  rosterIds: number[];
  maxPlayed: number;
}): number[] {
  const { savedPlayedIds, previousPlayedIds, rosterIds, maxPlayed } = args;
  const onRoster = (ids: number[]) => ids.filter((id) => rosterIds.includes(id));

  // Presence, not truthiness. `[]` is entered-and-empty; `null` is never-entered.
  if (savedPlayedIds !== null) return onRoster(savedPlayedIds).slice(0, maxPlayed);

  // A player can leave the event roster between maps, so a carried lineup is filtered before use:
  // posting a user_id the team no longer has would be rejected by the backend.
  if (previousPlayedIds !== null) return onRoster(previousPlayedIds).slice(0, maxPlayed);

  return rosterIds.slice(0, maxPlayed);
}

/**
 * A stored finishing position, as a value the picker can hold.
 *
 * `0` becomes null. Written as an explicit comparison rather than `|| null`, because gating a
 * number on truthiness is how the zero bugs in this codebase have always started. The point here
 * is that 0 is not a POSSIBLE placement, not that it is falsy.
 */
function normalisePlacement(stored: unknown): ScoreValue {
  if (stored === null || stored === undefined) return null;
  const n = Number(stored);
  if (Number.isNaN(n)) return null;
  return n === 0 ? null : n;
}

/** A saved player row's id, whichever key this particular path used. */
function savedPlayerId(row: any): number | null {
  const id = row?.player_id ?? row?.user_id;
  return id == null ? null : id;
}

/** The ids a saved team row records as having played. Presence in `players` IS the record. */
function playedIdsOf(row: any): number[] {
  return ((row?.players ?? []) as any[])
    .map(savedPlayerId)
    .filter((id): id is number => id !== null);
}

/**
 * Seed one map's editable state from the roster, this map's saved stats, and the previous map.
 *
 * The INPUT end of the pipeline, extracted for the same reason as buildTeamPayload: with both ends
 * pure, the golden captured from the old screen can be replayed as a test instead of compared by
 * eye.
 *
 * `savedStats` and `previousStats` are the leaderboard API's `match.stats` shape: one row per team
 * carrying `tournament_team_id`, `placement`, and a `players` array. `null` means this map has
 * never been entered, which is a different thing from an empty array.
 */
export function buildEntryTeams(args: {
  teams: Array<{
    tournament_team_id: number;
    team_name: string;
    team_logo: string | null;
    members: Array<{ player_id: number; username: string }>;
  }>;
  savedStats: any[] | null;
  previousStats: any[] | null;
  maxPlayed: number;
}): EntryTeam[] {
  const { teams, savedStats, previousStats, maxPlayed } = args;

  const index = (rows: any[] | null) => {
    const m = new Map<number, any>();
    for (const r of rows ?? []) {
      if (r?.tournament_team_id != null) m.set(r.tournament_team_id, r);
    }
    return m;
  };
  const saved = index(savedStats);
  const previous = index(previousStats);

  return teams.map((team) => {
    const savedRow = saved.get(team.tournament_team_id) ?? null;
    const previousRow = previous.get(team.tournament_team_id) ?? null;

    const rosterIds = team.members.map((m) => m.player_id);
    const lineup = resolveLineup({
      savedPlayedIds: savedRow ? playedIdsOf(savedRow) : null,
      previousPlayedIds: previousRow ? playedIdsOf(previousRow) : null,
      rosterIds,
      maxPlayed,
    });

    const savedKills = new Map<number, ScoreValue>();
    for (const row of (savedRow?.players ?? []) as any[]) {
      const id = savedPlayerId(row);
      if (id !== null) savedKills.set(id, row.kills ?? null);
    }

    return {
      tournament_team_id: team.tournament_team_id,
      team_name: team.team_name,
      team_logo: team.team_logo ?? null,
      // A placement nobody has entered stays null so the backend refuses the save, rather than
      // being collapsed to 0 and scoring a played team zero points (owner bug 2026-08-06).
      //
      // A STORED 0 is read back as null, and that is a semantic call rather than a truthiness
      // one: there is no 0th place, so 0 can only mean the box was empty when it was saved. The
      // backend's own duplicate-placement message says the same thing.
      //
      // Reproduced on a real map 2026-08-27: save a map with two teams marked as not playing,
      // and the API stores placement 0 for both. Reopen it and every seeded 0 posts back as 0, so
      // validate_placements refuses the save for "two or more teams at the same finishing
      // position (0)" and the map can never be saved again. The pre-rebuild component seeded
      // `stat?.placement ?? null`, which reads a stored 0 as 0 in exactly the same way, so this
      // is an old bug being closed here rather than a new one being avoided.
      placement: normalisePlacement(savedRow?.placement),
      // The API's team row usually carries no `played` key, and absent means played.
      played: savedRow ? (savedRow.played ?? true) : true,
      players: team.members.map((m) => ({
        user_id: m.player_id,
        username: m.username,
        kills: savedKills.has(m.player_id) ? (savedKills.get(m.player_id) as ScoreValue) : null,
        played: lineup.includes(m.player_id),
      })),
    };
  });
}

/**
 * The `results` array for enter-team-match-result-manual / edit-match-result.
 *
 * The OUTPUT end. This body is unchanged by the rebuild apart from damage and assists, which were
 * dropped in Task 2, and the golden replay in the test file asserts exactly that.
 *
 * Two rules, both of them scars:
 *   • placement goes out RAW, so a blank one reaches the backend as null and its guard rejects the
 *     save. Collapsing it to 0 stored a played team at zero placement points (bug 2026-08-06).
 *   • only players who played are sent. Omitting the bench keeps a squad within the backend's cap
 *     of 4 and stops substitutes re-appearing as played on the next load, since the API carries no
 *     per-player played flag (bug 2026-06-15).
 */
export function buildTeamPayload(teams: EntryTeam[]): Array<{
  tournament_team_id: number;
  placement: ScoreValue;
  played: boolean;
  players: Array<{ user_id: number; kills: number; played: true }>;
}> {
  return teams.map((t) => ({
    tournament_team_id: t.tournament_team_id,
    placement: t.placement,
    played: t.played,
    players: t.players
      .filter((p) => p.played)
      .map((p) => ({
        user_id: p.user_id,
        // A blank kills box legitimately means none.
        kills: scoreOrZero(p.kills),
        played: true as const,
      })),
  }));
}

/**
 * Finishing positions already used by OTHER teams on this map.
 *
 * The backend refuses duplicates (validate_placements), but only at SAVE, after all twelve teams
 * have been entered. Showing it at entry turns a rejected save into a number that cannot be picked
 * in the first place. A team never counts its own placement, or it could not keep it.
 */
export function takenPlacements(teams: EntryTeam[], exceptTeamId: number): number[] {
  return teams
    .filter((t) => t.tournament_team_id !== exceptTeamId && t.played && t.placement !== null)
    .map((t) => t.placement as number);
}

/**
 * Whether the progress rail should mark this team done.
 *
 * A team that did not play counts as done: it has been dealt with, and the save does not want a
 * placement from it. Anything else needs a finishing position, which is the same thing the submit
 * guard checks, so the rail cannot disagree with the error message.
 */
export function teamIsComplete(team: EntryTeam): boolean {
  if (!team.played) return true;
  return team.placement !== null;
}
