// ─────────────────────────────────────────────────────────────────────────────
// killDuel: the maths of the player duel overlay (inbox #385 / #421b), kept out of the page so it can be
// read, and tested, on its own.
//
// Input: the event-wide answer of AFC-B GET events/kill-stats/ (KillStats: players by uid with their team)
// and the answer of ?pair=<teamA>-<teamB> (PairFights: every fight of the two teams, every kill and knock in
// order). Output: the two players, their kills and knocks on each other, and the ordered feed of what
// happened between exactly those two, each knock marked "revived" when the victim was not finished off
// later in the same fight. Consumed by app/overlay/duel/[slug]/page.tsx.
// ─────────────────────────────────────────────────────────────────────────────
import type { KillStats, PairFights } from "@/lib/killStats";

export type DuelPlayer = { uid: string; name: string; teamId: number; team: string };

export type DuelEvent = {
  /** Stable id of this event: the page animates ids it has not seen before. */
  key: string;
  matchNumber: number | null;
  /** In-game clock seconds of the map. */
  t: number;
  kind: "kill" | "knock";
  /** "a" or "b": who did it. */
  by: "a" | "b";
  /** A knock whose victim got up again (no kill of that victim followed in the fight). */
  revived: boolean;
};

export type Duel = {
  a: DuelPlayer;
  b: DuelPlayer;
  killsA: number;
  killsB: number;
  knocksA: number;
  knocksB: number;
  events: DuelEvent[];
};

const norm = (s: string) => s.trim().toLowerCase();

/** A player of the answer by the name in the link (a username, any case); null if nobody has that name. */
export function findPlayer(data: KillStats, name: string): DuelPlayer | null {
  const want = norm(name);
  if (!want) return null;
  for (const [uid, p] of Object.entries(data.players)) {
    if (norm(p.name) === want) {
      return { uid, name: p.name, teamId: p.team_id, team: data.teams[String(p.team_id)] || "" };
    }
  }
  return null;
}

/** Every player that fought somebody, for the studio's pickers, by name. */
export function duelists(data: KillStats): DuelPlayer[] {
  const ids = new Set<string>();
  data.player_pairs.forEach(([x, y]) => ids.add(x).add(y));
  return [...ids]
    .map((uid) => {
      const p = data.players[uid];
      return p ? { uid, name: p.name, teamId: p.team_id, team: data.teams[String(p.team_id)] || "" } : null;
    })
    .filter((p): p is DuelPlayer => !!p)
    .sort((x, y) => x.name.localeCompare(y.name));
}

/** The duel between two players from a pair answer (fights of their two teams). */
export function buildDuel(a: DuelPlayer, b: DuelPlayer, fights: PairFights | null): Duel {
  const out: Duel = { a, b, killsA: 0, killsB: 0, knocksA: 0, knocksB: 0, events: [] };
  if (!fights) return out;
  const ordered = [...fights.fights].sort(
    (x, y) => (x.match_number ?? 0) - (y.match_number ?? 0) || x.match_id - y.match_id || x.start - y.start,
  );
  for (const f of ordered) {
    f.events.forEach((e, i) => {
      const [t, kind, killer, victim] = e;
      const aDid = killer === a.uid && victim === b.uid;
      const bDid = killer === b.uid && victim === a.uid;
      if (!aDid && !bDid) return;
      if (aDid) kind === "kill" ? out.killsA++ : out.knocksA++;
      else kind === "kill" ? out.killsB++ : out.knocksB++;
      // Revived: a knock after which nobody finished that victim in this fight, and the fight went on
      // past it (an in-progress last knock is not called revived yet).
      const finished = f.events.slice(i + 1).some((x) => x[1] === "kill" && x[3] === victim);
      const revived = kind === "knock" && !finished && f.end > t;
      out.events.push({
        key: `${f.match_id}|${t}|${kind}|${killer}|${victim}`,
        matchNumber: f.match_number,
        t,
        kind,
        by: aDid ? "a" : "b",
        revived,
      });
    });
  }
  return out;
}

// Game seconds -> "mm:ss".
export const clock = (s: number) => {
  const total = Math.max(0, Math.round(s));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
