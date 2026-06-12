"use client";

// ── ResultsStep (wizard step 3) ───────────────────────────────────────────────
// Add the "maps" (matches) and enter per-map results for every participant. Mirrors the per-map
// manual-entry idiom from the event flow's ManualMatchResultStep (per-team card: placement + the
// roster with a kills input per player; team kills = SUM of player kills, computed server-side),
// but works over standalone participants and the standalone endpoints:
//   • add a map     -> POST /leaderboards/standalone/<id>/matches/        (addMatch)
//   • remove a map  -> DELETE /leaderboards/standalone/matches/<mid>/     (removeMatch)
//   • save a map    -> POST /leaderboards/standalone/matches/<mid>/results/ {results:[...]} (saveResults)
//   • roster        -> GET /leaderboards/standalone/<id>/participants/<pid>/roster/ (participantRoster)
//
// 2026-06-12 (owner) MANUAL-ENTRY v2 on top of the original table:
//   1. The selected teams/players list is ALWAYS visible (it used to appear only inside map
//      tables, so picks made before any map existed were invisible).
//   2. TEAM format: each team card lists its PLAYERS (real roster from TeamMembers, ghost roster
//      from GhostPlayer slots) with a kills input PER PLAYER; the team's overall kills is the
//      live sum, "just like the manual input for the main leaderboard". The breakdown rides to
//      the backend as results[].players and is re-summed + stored there (server authority).
//   3. The pickers ALSO search existing GHOST teams/players (includeGhosts on the shared search
//      selects); a picked ghost is added via the kind=ghost_existing participant contract.
//
// CONSUMED BY: StandaloneCreateWizard. Reads/writes the shared participants + matches lists via
// props and reports newly-created/removed maps back up so Review can re-fetch fresh standings.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconDeviceFloppy,
  IconLoader2,
  IconMapPin,
  IconPlus,
  IconTrash,
  IconUserPlus,
} from "@tabler/icons-react";
import { InfoTip } from "@/components/ui/info-tip";
import {
  TeamSearchSelect,
  type PickedTeam,
  type PickedGhostTeam,
} from "@/components/ui/team-search-select";
import {
  UserSearchSelect,
  type PickedUser,
  type PickedGhostPlayer,
} from "@/components/ui/user-search-select";
import { GhostCreateInline } from "./GhostCreateInline";
import {
  standaloneLeaderboardsApi,
  type ParticipantRosterEntry,
  type StandaloneMatch,
  type StandaloneParticipant,
} from "@/lib/standaloneLeaderboards";

// One player's kills inside a team's result row (team format). user_id links real members back to
// platform users in the stored breakdown; ghost roster names carry null.
interface PlayerKillRow {
  name: string;
  user_id: number | null;
  kills: number;
}

// One editable result-set per participant, per map. `players` is seeded from the participant's
// roster (fetched once, cached) and drives the per-player kills inputs; when it is non-empty the
// team's kills DERIVE as the sum of player kills. The team total stays DIRECTLY editable too
// (owner 2026-06-12: "should be able to edit the team's kills... results where we cannot get the
// data of the players, just the teams"): typing into it flips manualKills on (the typed total
// wins, the breakdown is not sent), and editing any player kill flips back to the derived sum.
interface ResultRow {
  participant_id: number;
  name: string;
  is_ghost: boolean;
  placement: number;
  kills: number; // the manually-typed team total (authoritative when manualKills, or no roster)
  manualKills: boolean; // true once the admin typed the team total directly
  players: PlayerKillRow[];
}

export function ResultsStep({
  leaderboardId,
  format,
  participants,
  onParticipantsChange,
  matches,
  onMatchesChange,
  onBack,
  onNext,
}: {
  leaderboardId: number;
  // Needed by the INLINE participant add below (team -> TeamSearchSelect, solo -> UserSearchSelect).
  format: "team" | "solo";
  participants: StandaloneParticipant[];
  // Writes back to the wizard's shared participants list, exactly like ParticipantsStep does, so
  // a participant added here also shows up if the admin steps back to step 2.
  onParticipantsChange: (next: StandaloneParticipant[]) => void;
  matches: StandaloneMatch[];
  onMatchesChange: (next: StandaloneMatch[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [activeMatchId, setActiveMatchId] = useState<number | null>(
    matches[0]?.id ?? null,
  );
  // Per-map editable rows, keyed by match id. Seeded from the participant list + rosters.
  const [rowsByMatch, setRowsByMatch] = useState<Record<number, ResultRow[]>>({});
  const [addingMap, setAddingMap] = useState(false);
  const [savingMatch, setSavingMatch] = useState(false);
  // ── Inline participant add (owner 2026-06-12) ── "Enter results manually" jumps straight here
  // from step 2, so this step is self-contained: the same search + ghost-create controls as
  // ParticipantsStep live behind this toggle, and every add appends a scoreable row to every map.
  const [showAdd, setShowAdd] = useState(false);
  const [showGhost, setShowGhost] = useState(false);
  const [adding, setAdding] = useState(false);

  // ── Rosters (team format) ── participant id -> player list, fetched lazily from the roster
  // endpoint and cached so switching maps never refetches. inFlight guards duplicate fetches
  // (effects can re-run while a request is still pending).
  const [rosterByPid, setRosterByPid] = useState<Record<number, ParticipantRosterEntry[]>>({});
  const rosterInFlight = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (format !== "team") return;
    for (const p of participants) {
      if (rosterByPid[p.id] !== undefined || rosterInFlight.current.has(p.id)) continue;
      rosterInFlight.current.add(p.id);
      standaloneLeaderboardsApi
        .participantRoster(leaderboardId, p.id)
        .then((res) =>
          setRosterByPid((prev) => ({ ...prev, [p.id]: res.players ?? [] })),
        )
        .catch(() =>
          // Failed roster read degrades to the manual team-kills input (empty roster).
          setRosterByPid((prev) => ({ ...prev, [p.id]: [] })),
        )
        .finally(() => rosterInFlight.current.delete(p.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, format, leaderboardId]);

  const blankRow = (p: StandaloneParticipant): ResultRow => ({
    participant_id: p.id,
    name: p.name,
    is_ghost: p.is_ghost,
    placement: 0,
    kills: 0,
    manualKills: false,
    players: (rosterByPid[p.id] ?? []).map((r) => ({ ...r, kills: 0 })),
  });

  // Ensure every map has a row-set, every participant has a row on every map (incl. ones added
  // AFTER maps existed), and rows gain their players panel once the roster arrives. Entered
  // placements/kills are never overwritten - only missing pieces are appended/filled.
  useEffect(() => {
    setRowsByMatch((prev) => {
      const next = { ...prev };
      for (const m of matches) {
        const existing = next[m.id] ?? [];
        const have = new Set(existing.map((r) => r.participant_id));
        const appended = participants.filter((p) => !have.has(p.id)).map(blankRow);
        let changed = !next[m.id] || appended.length > 0;
        let rows = changed ? [...existing, ...appended] : existing;
        // Late roster arrival: seed the players panel on rows created before the roster loaded.
        rows = rows.map((r) => {
          if (r.players.length === 0) {
            const roster = rosterByPid[r.participant_id];
            if (roster && roster.length > 0) {
              changed = true;
              return { ...r, players: roster.map((x) => ({ ...x, kills: 0 })) };
            }
          }
          return r;
        });
        if (changed) next[m.id] = rows;
      }
      return next;
    });
    if (activeMatchId === null && matches.length > 0) {
      setActiveMatchId(matches[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, participants, rosterByPid]);

  const currentRows =
    activeMatchId !== null ? rowsByMatch[activeMatchId] ?? [] : [];

  const updateRow = (
    matchId: number,
    idx: number,
    field: "placement" | "kills",
    value: number,
  ) =>
    setRowsByMatch((prev) => {
      const rows = [...(prev[matchId] ?? [])];
      // Typing the team total DIRECTLY switches the row to manual mode: the typed value wins
      // over the player sum (team-only result data, owner 2026-06-12).
      rows[idx] = {
        ...rows[idx],
        [field]: value,
        ...(field === "kills" ? { manualKills: true } : {}),
      };
      return { ...prev, [matchId]: rows };
    });

  // Back to the derived sum after a manual override (the small "Use player sum" action).
  const useDerivedKills = (matchId: number, idx: number) =>
    setRowsByMatch((prev) => {
      const rows = [...(prev[matchId] ?? [])];
      rows[idx] = { ...rows[idx], manualKills: false };
      return { ...prev, [matchId]: rows };
    });

  // Per-player kills edit (team format). Editing a player returns the row to DERIVED mode -
  // entering player data means the breakdown is the source of truth again.
  const updatePlayerKills = (matchId: number, rowIdx: number, playerIdx: number, kills: number) =>
    setRowsByMatch((prev) => {
      const rows = [...(prev[matchId] ?? [])];
      const row = rows[rowIdx];
      if (!row) return prev;
      const players = row.players.map((p, i) => (i === playerIdx ? { ...p, kills } : p));
      rows[rowIdx] = { ...row, players, manualKills: false };
      return { ...prev, [matchId]: rows };
    });

  const playersSum = (row: ResultRow): number =>
    row.players.reduce((acc, p) => acc + (p.kills || 0), 0);

  // The team's overall kills: the manually-typed total when overridden (or no roster), else the
  // live SUM of the player kills.
  const teamKills = (row: ResultRow): number =>
    row.manualKills || row.players.length === 0 ? row.kills : playersSum(row);

  // ── Add a participant from THIS step (mirrors ParticipantsStep.add: POST .../participants/,
  // append the returned row to the shared list; the effects above then seed roster + map rows). ──
  const addParticipant = async (body: Record<string, any>) => {
    setAdding(true);
    try {
      const res = await standaloneLeaderboardsApi.addParticipant(leaderboardId, body);
      onParticipantsChange([...participants, res.participant]);
      toast.success(`Added ${res.participant.name}.`);
      setShowGhost(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to add the participant.");
    } finally {
      setAdding(false);
    }
  };

  const handleTeamPick = (teamId: number | null, team?: PickedTeam) => {
    if (teamId == null) return;
    if (participants.some((p) => p.team_id === teamId)) {
      toast.info(`${team?.team_name ?? "That team"} is already added.`);
      return;
    }
    addParticipant({ kind: "real", team_id: teamId });
  };

  const handleUserPick = (_username: string | null, user?: PickedUser) => {
    if (!user) return;
    if (participants.some((p) => p.user_id === user.user_id)) {
      toast.info(`${user.username} is already added.`);
      return;
    }
    addParticipant({ kind: "real", user_id: user.user_id });
  };

  // ── Existing-ghost picks (owner 2026-06-12: "let ghost teams and players be searchable") ──
  // The search selects surface ghosts when includeGhosts is set; a pick lands here and is added
  // through the SAME kind=ghost_existing contract the OCR review uses, so nothing is duplicated.
  const handleGhostTeamPick = (g: PickedGhostTeam) => {
    if (participants.some((p) => p.ghost_team_id === g.ghost_team_id)) {
      toast.info(`${g.team_name} is already added.`);
      return;
    }
    addParticipant({ kind: "ghost_existing", ghost_team_id: g.ghost_team_id });
  };

  const handleGhostPlayerPick = (g: PickedGhostPlayer) => {
    if (participants.some((p) => p.ghost_player_id === g.ghost_player_id)) {
      toast.info(`${g.ign} is already added.`);
      return;
    }
    addParticipant({ kind: "ghost_existing", ghost_player_id: g.ghost_player_id });
  };

  // Remove a participant (also drops their rows from every map's editable set).
  const removeParticipant = async (p: StandaloneParticipant) => {
    try {
      await standaloneLeaderboardsApi.removeParticipant(leaderboardId, p.id);
      onParticipantsChange(participants.filter((x) => x.id !== p.id));
      setRowsByMatch((prev) => {
        const next: Record<number, ResultRow[]> = {};
        for (const [mid, rows] of Object.entries(prev)) {
          next[Number(mid)] = rows.filter((r) => r.participant_id !== p.id);
        }
        return next;
      });
      toast.success(`Removed ${p.name}.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to remove the participant.");
    }
  };

  // ── Add a map (next match_number). ──
  const addMap = async () => {
    setAddingMap(true);
    try {
      const nextNumber = matches.length + 1;
      const res = await standaloneLeaderboardsApi.addMatch(leaderboardId, {
        match_number: nextNumber,
      });
      const updated = [...matches, res.match];
      onMatchesChange(updated);
      setActiveMatchId(res.match.id);
      toast.success(`Added map ${res.match.match_number}.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to add a map.");
    } finally {
      setAddingMap(false);
    }
  };

  const removeMap = async (m: StandaloneMatch) => {
    try {
      await standaloneLeaderboardsApi.removeMatch(m.id);
      const updated = matches.filter((x) => x.id !== m.id);
      onMatchesChange(updated);
      setRowsByMatch((prev) => {
        const next = { ...prev };
        delete next[m.id];
        return next;
      });
      if (activeMatchId === m.id) setActiveMatchId(updated[0]?.id ?? null);
      toast.success(`Removed map ${m.match_number}.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to remove the map.");
    }
  };

  // ── Save the active map's results. ──
  // Team rows with a roster send the per-player breakdown; the backend re-sums it into the team
  // kills (server authority) and stores it on ParticipantMatchResult.player_kills.
  const saveMap = async () => {
    if (activeMatchId === null) return;
    const rows = rowsByMatch[activeMatchId] ?? [];
    if (rows.length === 0) {
      toast.error("No participants to score on this map.");
      return;
    }
    setSavingMatch(true);
    try {
      await standaloneLeaderboardsApi.saveResults(activeMatchId, {
        results: rows.map((r) => ({
          participant_id: r.participant_id,
          placement: r.placement,
          kills: teamKills(r),
          // The breakdown only rides along in DERIVED mode - a manually-typed team total wins
          // outright (the server would re-sum any players sent, overriding the override).
          ...(format === "team" && r.players.length > 0 && !r.manualKills
            ? {
                players: r.players.map((p) => ({
                  name: p.name,
                  user_id: p.user_id,
                  kills: p.kills,
                })),
              }
            : {}),
        })),
      });
      toast.success("Map results saved.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save results.");
    } finally {
      setSavingMatch(false);
    }
  };

  const ghostBadge = (
    <Badge
      variant="outline"
      className="rounded-full border-orange-500 px-2 py-0.5 text-xs text-orange-600"
    >
      Ghost
    </Badge>
  );
  const realBadge = (
    <Badge
      variant="outline"
      className="rounded-full border-green-500 px-2 py-0.5 text-xs text-green-600"
    >
      Real
    </Badge>
  );

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle className="flex items-center">
          Results per map
          <InfoTip
            text="Add the competing teams or players, add a map for each match played, then enter placement and per-player kills. Points are computed automatically from your scoring config."
            className="ml-1.5"
          />
        </CardTitle>
        <CardDescription>
          {format === "team"
            ? "Add teams, then enter placement and each player's kills per map. Team kills are the sum of player kills."
            : "Add players, then enter placement and kills per map."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── Inline participant add ── manual entry is self-contained: teams/players (real,
            existing-ghost via search, or new ghost) can be added right here. Always visible when
            there are no participants yet; collapsible behind a button otherwise. */}
        {(participants.length === 0 || showAdd) && (
          <div className="space-y-3 rounded-md border bg-muted/20 p-3">
            <Label>
              {format === "team" ? "Add a team to score" : "Add a player to score"}
              <InfoTip
                text="Anyone you add here joins the leaderboard and gets a result row on every map. The search also finds existing ghost teams and players."
                className="ml-1"
              />
            </Label>
            {format === "team" ? (
              <TeamSearchSelect
                value={null}
                onChange={handleTeamPick}
                disabled={adding}
                placeholder="Search a team (real or ghost)..."
                includeGhosts
                onPickGhost={handleGhostTeamPick}
              />
            ) : (
              <UserSearchSelect
                value={null}
                onChange={handleUserPick}
                disabled={adding}
                placeholder="Search a player (real or ghost)..."
                includeGhosts
                onPickGhost={handleGhostPlayerPick}
              />
            )}
            {showGhost ? (
              <GhostCreateInline
                format={format}
                submitting={adding}
                onCreate={addParticipant}
                onCancel={() => setShowGhost(false)}
              />
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowGhost(true)}
              >
                <IconUserPlus size={14} className="mr-1" />
                Not found? Create as ghost
              </Button>
            )}
          </div>
        )}
        {participants.length > 0 && !showAdd && (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(true)}>
            <IconUserPlus size={14} className="mr-1" />
            Add another {format === "team" ? "team" : "player"}
          </Button>
        )}

        {/* ── Selected participants ── ALWAYS visible (owner 2026-06-12: picks made before any
            map existed were invisible until a map was added). Same list idiom as step 2. */}
        <div className="space-y-2">
          <Label>
            {format === "team" ? "Teams" : "Players"} added ({participants.length})
          </Label>
          {participants.length === 0 ? (
            <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
              No {format === "team" ? "teams" : "players"} yet. Add them above; they appear here
              and get a result row on every map.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{p.name}</span>
                    {p.is_ghost ? ghostBadge : realBadge}
                    {/* Roster size hint once the roster has loaded (team format). */}
                    {format === "team" && rosterByPid[p.id] !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {rosterByPid[p.id].length} player
                        {rosterByPid[p.id].length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeParticipant(p)}
                    aria-label={`Remove ${p.name}`}
                  >
                    <IconTrash size={15} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map tabs + add. Mirrors the GroupResultsEditor map-tab row (button pills). */}
        <div className="flex flex-wrap items-center gap-2">
          {matches.map((m) => (
            <div key={m.id} className="flex items-center">
              <Button
                variant={activeMatchId === m.id ? "default" : "secondary"}
                size="sm"
                onClick={() => setActiveMatchId(m.id)}
              >
                <IconMapPin size={14} className="mr-1" />
                {m.match_map || `Map ${m.match_number}`}
              </Button>
              <button
                type="button"
                onClick={() => removeMap(m)}
                className="ml-1 text-muted-foreground hover:text-destructive"
                aria-label={`Remove map ${m.match_number}`}
              >
                <IconTrash size={14} />
              </button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={addMap}
            disabled={addingMap}
          >
            <IconPlus size={14} className="mr-1" />
            {addingMap ? "Adding..." : "Add map"}
          </Button>
        </div>

        {matches.length === 0 ? (
          <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            No maps yet. Add a map to start entering results.
          </p>
        ) : currentRows.length === 0 ? (
          // A map exists but nobody to score yet: point at the add panel above instead of
          // rendering an empty editor.
          <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            No {format === "team" ? "teams" : "players"} to score yet. Add them above and they
            will appear here with placement and kills inputs.
          </p>
        ) : format === "team" ? (
          // ── TEAM format: one card per team (the ManualMatchResultStep idiom) ── placement +
          // the roster with per-player kills; the team's overall kills is the live sum.
          <div className="space-y-3">
            {currentRows.map((row, idx) => (
              <div key={row.participant_id} className="space-y-2.5 rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{row.name}</span>
                    {row.is_ghost ? ghostBadge : realBadge}
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Placement</Label>
                      <Input
                        type="number"
                        min="0"
                        className="h-8 w-20"
                        value={row.placement || ""}
                        onChange={(e) =>
                          updateRow(activeMatchId!, idx, "placement", parseInt(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Team kills</Label>
                      {/* ALWAYS editable (owner 2026-06-12: some results only have team data).
                          Derived mode shows the live player sum; typing here overrides it. */}
                      <Input
                        type="number"
                        min="0"
                        className="h-8 w-20"
                        value={teamKills(row) || ""}
                        onChange={(e) =>
                          updateRow(activeMatchId!, idx, "kills", parseInt(e.target.value) || 0)
                        }
                      />
                      {row.manualKills && row.players.length > 0 && (
                        // Manual override active: the player kills below are not counted. One
                        // click returns to the derived sum.
                        <button
                          type="button"
                          onClick={() => useDerivedKills(activeMatchId!, idx)}
                          className="block text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                          manual total, use player sum ({playersSum(row)})
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Per-player kills (owner 2026-06-12: "the players must show... input kills for
                    each player which should show for the team's overall kills"). */}
                {row.players.length > 0 && (
                  <div className="space-y-1.5 border-t pt-2.5">
                    {row.players.map((p, pi) => (
                      <div
                        key={`${row.participant_id}-${pi}`}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate text-xs font-medium" title={p.name}>
                          {p.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-[10px] text-muted-foreground">Kills</Label>
                          <Input
                            type="number"
                            min="0"
                            className="h-7 w-16 text-xs"
                            value={p.kills || ""}
                            onChange={(e) =>
                              updatePlayerKills(
                                activeMatchId!,
                                idx,
                                pi,
                                parseInt(e.target.value) || 0,
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          // ── SOLO format: the compact per-player table (placement + kills per participant). ──
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="p-2 text-xs text-foreground">Participant</TableHead>
                  <TableHead className="w-28 p-2 text-xs text-foreground">Placement</TableHead>
                  <TableHead className="w-28 p-2 text-xs text-foreground">Kills</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentRows.map((row, idx) => (
                  <TableRow key={row.participant_id}>
                    <TableCell className="p-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{row.name}</span>
                        {row.is_ghost && ghostBadge}
                      </div>
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        type="number"
                        min="0"
                        className="h-8 w-20"
                        value={row.placement || ""}
                        onChange={(e) =>
                          updateRow(
                            activeMatchId!,
                            idx,
                            "placement",
                            parseInt(e.target.value) || 0,
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        type="number"
                        min="0"
                        className="h-8 w-20"
                        value={row.kills || ""}
                        onChange={(e) =>
                          updateRow(
                            activeMatchId!,
                            idx,
                            "kills",
                            parseInt(e.target.value) || 0,
                          )
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {matches.length > 0 && currentRows.length > 0 && (
          <div className="flex justify-end">
            <Button onClick={saveMap} disabled={savingMatch}>
              {savingMatch ? (
                <span className="flex items-center gap-2">
                  <IconLoader2 size={14} className="animate-spin" /> Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <IconDeviceFloppy size={14} /> Save this map
                </span>
              )}
            </Button>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext}>Continue to review</Button>
        </div>
      </CardContent>
    </Card>
  );
}
