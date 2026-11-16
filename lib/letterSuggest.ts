/**
 * lib/letterSuggest.ts
 * ────────────────────
 * Suggest an in-game letter for each team so that no two teams in the same ROOM (lobby) share one,
 * using only letters each team owns (AFC inbox #602, owner 2026-11-16: "there should also be a part
 * that suggests what each team should use, based off what they have in each group or if its per
 * stage").
 *
 * PURE LOGIC ONLY. No React, no next-intl, no network, so it runs under `node --test`
 * (lib/__tests__/letterSuggest.test.ts).
 *
 * HOW IT CONNECTS TO THE REST OF THE SYSTEM
 *   Called by  app/(a)/a/events/[slug]/edit/_components/LetterSuggestPanel.tsx  (the only caller),
 *   which RegisteredTeamsTab mounts for the admin and organizer event edit pages.
 *   Its input comes from GET /events/event-team-letters/ (backend get_event_team_letters):
 *     - teams[].available_letters -> SuggestTeam.owned
 *     - the team's letter in the scope -> SuggestTeam.current
 *     - stages[].rooms[].tournament_team_ids -> rooms (the SAME rooms the server checks, built by
 *       afc_tournament_and_scrims/letter_rooms.py stage_rooms)
 *   Its output is POSTed by the panel to /events/assign-team-letters/ (assign_team_letters_bulk),
 *   which re-checks every room server side, so a wrong suggestion can never be saved.
 *
 * THE METHOD
 *   Two teams "conflict" when they share any room. That is list colouring on the conflict graph:
 *   in general a hard problem, but AFC rooms hold at most a few dozen teams, so a backtracking
 *   search finishes instantly. It:
 *     1. starts from a greedy answer (keep letters that already work, then fill), so even a search
 *        cut short by the step cap returns something valid;
 *     2. always expands the team with the FEWEST letters left (most constrained first);
 *     3. tries the team's current letter first, then letters its neighbours want least;
 *     4. maximises the number of teams lettered, then the number of letters kept as they were.
 */

export type SuggestTeam = {
  /** tournament_team_id */
  id: number;
  /** A-Z letters the team owns (its members' letter avatars plus the team's manual extras). */
  owned: string[];
  /** The team's letter in this scope today, or null. Kept when it still works. */
  current: string | null;
};

export type SuggestInput = {
  /** The teams to suggest for (the scope the organizer picked). */
  teams: SuggestTeam[];
  /** Every room that matters, as tournament_team_id lists. May include teams outside `teams`. */
  rooms: number[][];
  /** Letters held by teams in a room but OUTSIDE the scope: they stay as they are. */
  fixed?: Record<number, string | null>;
};

export type ImpossibleReason = "owns_none" | "all_taken";

export type SuggestResult = {
  /** tournament_team_id -> suggested letter, for every team that can get one. */
  letters: Record<number, string>;
  /** Teams whose suggestion equals their current letter. */
  kept: number[];
  /** Teams that get no letter, with why: owns no letter at all, or every letter it owns is taken. */
  impossible: number[];
  reasons: Record<number, ImpossibleReason>;
};

/** Search budget. Rooms are small; this only guards against a pathological input. */
const STEP_CAP = 200_000;

const AZ = /^[A-Z]$/;

export function suggestLetters(input: SuggestInput): SuggestResult {
  const teams = input.teams;
  const n = teams.length;
  const index = new Map(teams.map((t, i) => [t.id, i]));
  const fixed = input.fixed ?? {};

  // ── conflict graph among the teams in scope, and letters blocked by fixed room mates ──
  const neighbours: Set<number>[] = teams.map(() => new Set<number>());
  const blocked: Set<string>[] = teams.map(() => new Set<string>());
  for (const room of input.rooms) {
    const inScope = room.filter((id) => index.has(id)).map((id) => index.get(id)!);
    const fixedLetters = room
      .filter((id) => !index.has(id))
      .map((id) => fixed[id])
      .filter((l): l is string => !!l);
    for (const i of inScope) {
      for (const j of inScope) if (i !== j) neighbours[i].add(j);
      for (const l of fixedLetters) blocked[i].add(l);
    }
  }

  // Rooms as in-scope team indices, for the room-capacity bound in the search.
  const roomIdx = input.rooms
    .map((room) => room.filter((id) => index.has(id)).map((id) => index.get(id)!))
    .filter((r) => r.length > 1);

  const domain: string[][] = teams.map((t, i) =>
    [...new Set(t.owned.map((l) => l.toUpperCase()).filter((l) => AZ.test(l)))]
      .filter((l) => !blocked[i].has(l))
      .sort(),
  );
  const current = teams.map((t) => (t.current ? t.current.toUpperCase() : null));
  const nbrList = neighbours.map((s) => [...s]);

  // ── greedy start: keep working current letters, then most constrained first ──
  const greedy: (string | null)[] = new Array(n).fill(null);
  const takenBy = (i: number, l: string, a: (string | null | undefined)[]) =>
    nbrList[i].some((j) => a[j] === l);
  for (let i = 0; i < n; i++) {
    const c = current[i];
    if (c && domain[i].includes(c) && !takenBy(i, c, greedy)) greedy[i] = c;
  }
  const order = [...Array(n).keys()].sort((a, b) => domain[a].length - domain[b].length || teams[a].id - teams[b].id);
  for (const i of order) {
    if (greedy[i]) continue;
    greedy[i] = domain[i].find((l) => !takenBy(i, l, greedy)) ?? null;
  }

  const score = (a: (string | null | undefined)[]) => {
    let count = 0;
    let kept = 0;
    for (let i = 0; i < n; i++) {
      if (a[i]) {
        count++;
        if (a[i] === current[i]) kept++;
      }
    }
    return { count, kept };
  };

  let best = greedy.slice();
  let { count: bestCount, kept: bestKept } = score(best);
  const maxCount = domain.filter((d) => d.length > 0).length;
  const maxKept = current.filter((c, i) => c !== null && domain[i].includes(c)).length;

  // ── branch and bound ──
  const assign: (string | null | undefined)[] = new Array(n).fill(undefined);
  let steps = 0;
  const done = () => steps > STEP_CAP || (bestCount === maxCount && bestKept === maxKept);

  const available = (i: number) => domain[i].filter((l) => !takenBy(i, l, assign));

  const search = (count: number, kept: number, visited: number) => {
    steps++;
    if (done()) return;
    if (visited === n) {
      if (count > bestCount || (count === bestCount && kept > bestKept)) {
        best = assign.slice() as (string | null)[];
        bestCount = count;
        bestKept = kept;
      }
      return;
    }

    // Most constrained unvisited team (fewest letters left), ties: most neighbours. The same pass
    // counts how many unvisited teams can still get ANY letter: the bound for pruning.
    let pick = -1;
    let pickAvail: string[] = [];
    let canStill = 0;
    let canKeep = 0;
    const avail: (string[] | null)[] = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      if (assign[i] !== undefined) continue;
      const av = available(i);
      avail[i] = av;
      if (av.length > 0) canStill++;
      if (current[i] && av.includes(current[i]!)) canKeep++;
      if (
        pick === -1 ||
        av.length < pickAvail.length ||
        (av.length === pickAvail.length && nbrList[i].length > nbrList[pick].length)
      ) {
        pick = i;
        pickAvail = av;
      }
    }
    // Room capacity: inside one room, the unvisited teams can take at most as many letters as
    // their available letters cover between them, so the surplus is certain to go without. The
    // largest surplus over all rooms is a valid deduction (rooms overlap, so they are not summed).
    let surplus = 0;
    for (const room of roomIdx) {
      let teamsLeft = 0;
      const letters = new Set<string>();
      for (const i of room) {
        const av = avail[i];
        if (!av || av.length === 0) continue;
        teamsLeft++;
        for (const l of av) letters.add(l);
      }
      surplus = Math.max(surplus, teamsLeft - letters.size);
    }
    const bound = count + canStill - surplus;
    if (bound < bestCount) return;
    if (bound === bestCount && kept + canKeep <= bestKept) return;

    // Current letter first, then the letters the unvisited neighbours want least.
    const demand = (l: string) =>
      nbrList[pick].filter((j) => assign[j] === undefined && domain[j].includes(l)).length;
    const tries = pickAvail.slice().sort((a, b) => {
      if (a === current[pick]) return -1;
      if (b === current[pick]) return 1;
      return demand(a) - demand(b) || a.localeCompare(b);
    });

    for (const l of tries) {
      assign[pick] = l;
      search(count + 1, kept + (l === current[pick] ? 1 : 0), visited + 1);
      if (done()) {
        assign[pick] = undefined;
        return;
      }
    }
    assign[pick] = null; // leave this team without a letter
    search(count, kept, visited + 1);
    assign[pick] = undefined;
  };
  search(0, 0, 0);

  // ── result ──
  const letters: Record<number, string> = {};
  const kept: number[] = [];
  const impossible: number[] = [];
  const reasons: Record<number, ImpossibleReason> = {};
  teams.forEach((t, i) => {
    const l = best[i];
    if (l) {
      letters[t.id] = l;
      if (l === current[i]) kept.push(t.id);
    } else {
      impossible.push(t.id);
      reasons[t.id] = t.owned.length === 0 ? "owns_none" : "all_taken";
    }
  });
  return { letters, kept, impossible, reasons };
}
