/**
 * lib/letterScope.ts
 * ──────────────────
 * The "which teams, which lobbies, which letter" maths behind the Registered Teams letter scope
 * (AFC inbox #602, owner 2026-11-16: "i need to be able to do this only teams in certains groups or
 * per stage"). Pure, so it runs under `node --test` (lib/__tests__/letterScope.test.ts).
 *
 * THE RULE IT MIRRORS (server: afc_tournament_and_scrims/letter_rooms.py)
 *   A letter only has to be distinct between teams that share a ROOM (lobby) in a stage. A team's
 *   letter in a stage is its stage letter if it has one, else its all-stages letter. An event with
 *   no stages at all keeps the old rule: the whole event is one room.
 *
 * HOW IT CONNECTS
 *   Data: GET /events/event-team-letters/ (backend get_event_team_letters) -> LetterTeam[] and
 *   LetterStage[]. Callers: RegisteredTeamsTab.tsx (filtering, the per-row Select's "taken" letters,
 *   the clash text) and LetterSuggestPanel.tsx (rooms + fixed letters for lib/letterSuggest.ts).
 */

export type LetterTeam = {
  tournament_team_id: number;
  team_id: number | null;
  team_name: string;
  available_letters: string[];
  /** The ALL STAGES letter (kept across stages). */
  assigned_letter: string | null;
  /** Per-stage letters, keyed by stage id as a string; each overrides assigned_letter there. */
  stage_letters: Record<string, string>;
  member_count: number;
};

export type LetterRoom = {
  group_id: number | null;
  group_name: string;
  tournament_team_ids: number[];
};

export type LetterStage = {
  stage_id: number;
  stage_name: string;
  rooms: LetterRoom[];
};

/** null = "Whole event" (the all-stages letter). */
export type ScopeStage = number | null;

/** The team's letter in a stage (its stage letter, else its all-stages letter); null stage = all-stages letter. */
export function letterIn(team: LetterTeam | undefined, stageId: ScopeStage): string | null {
  if (!team) return null;
  if (stageId != null) return team.stage_letters[String(stageId)] ?? team.assigned_letter ?? null;
  return team.assigned_letter ?? null;
}

/** Where the team's letter in that stage comes from: its own stage letter, the all-stages one, or none. */
export function letterSource(team: LetterTeam | undefined, stageId: ScopeStage): "stage" | "all" | null {
  if (!team) return null;
  if (stageId != null && team.stage_letters[String(stageId)]) return "stage";
  return team.assigned_letter ? "all" : null;
}

/** Rooms that bind a letter for the given stages, each tagged with the stage it belongs to. */
export function roomsFor(
  stages: LetterStage[],
  stageIds: number[] | null,
  allTeamIds: number[],
): { stageId: number | null; room: LetterRoom }[] {
  if (stages.length === 0) {
    // No stages yet: the old one-letter-per-event rule (the server checks the same).
    return [{ stageId: null, room: { group_id: null, group_name: "", tournament_team_ids: allTeamIds } }];
  }
  const wanted = stageIds ?? stages.map((s) => s.stage_id);
  return stages
    .filter((s) => wanted.includes(s.stage_id))
    .flatMap((s) => s.rooms.map((room) => ({ stageId: s.stage_id, room })));
}

/** tournament_team_ids shown for a scope: everyone, a stage's teams, or one lobby's teams. */
export function teamsInScope(
  stages: LetterStage[],
  stageId: ScopeStage,
  groupId: number | null,
  allTeamIds: number[],
): Set<number> {
  if (stageId == null) return new Set(allTeamIds);
  const stage = stages.find((s) => s.stage_id === stageId);
  if (!stage) return new Set();
  const rooms = groupId == null ? stage.rooms : stage.rooms.filter((r) => r.group_id === groupId);
  return new Set(rooms.flatMap((r) => r.tournament_team_ids));
}

/**
 * Letters a team may NOT take, with the room mate holding each, for an assignment that applies to
 * `stageIds` (null = all stages). In each of those stages, every room the team is in contributes the
 * letters its room mates hold there.
 */
export function takenFor(
  ttId: number,
  teams: Record<number, LetterTeam>,
  stages: LetterStage[],
  stageIds: number[] | null,
): Map<string, number> {
  const taken = new Map<string, number>();
  const allIds = Object.keys(teams).map(Number);
  for (const { stageId, room } of roomsFor(stages, stageIds, allIds)) {
    if (!room.tournament_team_ids.includes(ttId)) continue;
    for (const other of room.tournament_team_ids) {
      if (other === ttId) continue;
      const l = letterIn(teams[other], stageId);
      if (l && !taken.has(l)) taken.set(l, other);
    }
  }
  return taken;
}

/** For the stage being viewed (null = all stages), each team that shares its letter in a room -> the other team. */
export function clashes(
  teams: Record<number, LetterTeam>,
  stages: LetterStage[],
  stageId: ScopeStage,
): Map<number, number> {
  const out = new Map<number, number>();
  const allIds = Object.keys(teams).map(Number);
  for (const { stageId: sid, room } of roomsFor(stages, stageId == null ? null : [stageId], allIds)) {
    const holder = new Map<string, number>();
    for (const id of room.tournament_team_ids) {
      const l = letterIn(teams[id], sid);
      if (!l) continue;
      const other = holder.get(l);
      if (other != null) {
        if (!out.has(id)) out.set(id, other);
        if (!out.has(other)) out.set(other, id);
      } else {
        holder.set(l, id);
      }
    }
  }
  return out;
}
