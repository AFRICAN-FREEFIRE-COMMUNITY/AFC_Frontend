"use client";

// ── GroupResultsEditor ────────────────────────────────────────────────────────
// Self-contained "edit a whole stage GROUP at once" editor: map tabs across the
// group's maps + a per-map editable results table, with "Save this map" AND
// "Save all maps". It mirrors the AFC admin leaderboard editor's Match Results tab
// (app/(a)/a/leaderboards/[id]/edit/page.tsx) but is packaged as one component so the
// ORGANIZER leaderboard page (which is built on per-map step components, with no
// whole-group state of its own) gets the same whole-group capability without
// duplicating the editor.
//
// Saving reuses the EXISTING per-map endpoints (no new backend):
//   solo  -> POST /events/edit-solo-match-result/  { match_id, rows[] }
//   team  -> POST /events/edit-match-result/        { match_id, results[] with players[] }
// "Save all maps" fans these out across every map via Promise.allSettled and reports
// an "X of Y saved" summary (same idiom as the admin editor's scoring fan-out). Org
// members with can_upload_results are already authorized on these endpoints.
//
// Props:
//   participantType - "solo" | "duo" | "squad" (anything non-solo is treated as team).
//   group           - { group_id, group_name, matches:[{ match_id, match_number,
//                       match_map, stats:[RawStat] }] }.
//   apiBase, token  - backend base URL + Bearer token (AuthContext).
//   onSaved         - called after a save so the parent refetches the leaderboard.
//   onClose         - optional: render a "Back" button that calls this.

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GroupBulkUploadPanel } from "./GroupBulkUploadPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  IconChevronDown,
  IconChevronRight,
  IconArrowLeft,
} from "@tabler/icons-react";

// ── Shapes (subset of the leaderboard-details API rows) ──────────────────────
interface RawPlayer {
  player_id: number;
  username: string;
  kills: number;
  damage: number;
  assists: number;
}
interface RawStat {
  competitor_id?: number;
  tournament_team_id?: number;
  username?: string;
  team_name?: string;
  placement: number;
  kills: number;
  bonus_points?: number;
  penalty_points?: number;
  players?: RawPlayer[];
}
interface MapData {
  match_id: number;
  match_number: number;
  match_map: string;
  stats?: RawStat[];
}
interface GroupData {
  group_id: number;
  group_name: string;
  matches?: MapData[];
}

interface EditRow {
  id: number;
  name: string;
  placement: number;
  kills: number;
  bonus_points: number;
  penalty_points: number;
  played: boolean;
}
interface PlayerEditRow {
  player_id: number;
  username: string;
  kills: number;
  damage: number;
  assists: number;
  played: boolean;
}
interface TeamPlayerGroup {
  teamId: number;
  teamName: string;
  players: PlayerEditRow[];
}

// Same row builders the admin editor uses, kept identical so behaviour matches.
function statToEditRow(stat: RawStat): EditRow {
  return {
    id: stat.competitor_id ?? stat.tournament_team_id ?? 0,
    name: stat.username ?? stat.team_name ?? "-",
    placement: stat.placement,
    kills: stat.kills,
    bonus_points: stat.bonus_points ?? 0,
    penalty_points: stat.penalty_points ?? 0,
    played: true,
  };
}
function statToTeamPlayerGroup(stat: RawStat): TeamPlayerGroup {
  return {
    teamId: stat.tournament_team_id ?? 0,
    teamName: stat.team_name ?? "-",
    players: (stat.players ?? []).map((p) => ({
      player_id: p.player_id,
      username: p.username,
      kills: p.kills ?? 0,
      damage: p.damage ?? 0,
      assists: p.assists ?? 0,
      played: true,
    })),
  };
}

export function GroupResultsEditor({
  participantType,
  group,
  apiBase,
  token,
  onSaved,
  onClose,
}: {
  participantType: string;
  group: GroupData;
  apiBase: string;
  token: string | null | undefined;
  onSaved: () => void;
  onClose?: () => void;
}) {
  const isSolo = participantType === "solo";
  const matches = useMemo(() => group.matches ?? [], [group]);

  // Per-map editable state, seeded once from the group's current stats.
  const [editRows, setEditRows] = useState<Record<number, EditRow[]>>(() => {
    const init: Record<number, EditRow[]> = {};
    for (const m of matches) init[m.match_id] = (m.stats ?? []).map(statToEditRow);
    return init;
  });
  const [playerGroups, setPlayerGroups] = useState<
    Record<number, TeamPlayerGroup[]>
  >(() => {
    const init: Record<number, TeamPlayerGroup[]> = {};
    for (const m of matches)
      init[m.match_id] = (m.stats ?? []).map(statToTeamPlayerGroup);
    return init;
  });

  const [activeMatchId, setActiveMatchId] = useState<number | null>(
    matches[0]?.match_id ?? null,
  );
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});
  const [savingMatch, setSavingMatch] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  // Re-seed the editable tables from the group's CURRENT stats. Used after a bulk
  // upload (below) replaces a map's results server-side, so the manual tables show the
  // freshly-uploaded data. We DON'T reseed on every parent refetch (that would clobber
  // in-progress manual edits to other maps) - only when pendingReseed is set, which the
  // bulk-upload onComplete turns on right before triggering the parent refetch.
  const [pendingReseed, setPendingReseed] = useState(false);
  useEffect(() => {
    if (!pendingReseed) return;
    const r: Record<number, EditRow[]> = {};
    const pg: Record<number, TeamPlayerGroup[]> = {};
    for (const m of group.matches ?? []) {
      r[m.match_id] = (m.stats ?? []).map(statToEditRow);
      pg[m.match_id] = (m.stats ?? []).map(statToTeamPlayerGroup);
    }
    setEditRows(r);
    setPlayerGroups(pg);
    setPendingReseed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  const currentRows = activeMatchId !== null ? editRows[activeMatchId] ?? [] : [];
  const currentPlayerGroups =
    activeMatchId !== null ? playerGroups[activeMatchId] ?? [] : [];
  const matchIds = matches.map((m) => m.match_id);

  // ── Row mutators (match-keyed, so they work for any map) ──
  const updateRow = (
    matchId: number,
    idx: number,
    field: keyof Omit<EditRow, "id" | "name">,
    value: number | boolean,
  ) =>
    setEditRows((prev) => {
      const rows = [...(prev[matchId] ?? [])];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...prev, [matchId]: rows };
    });

  const updatePlayerRow = (
    matchId: number,
    teamIdx: number,
    playerIdx: number,
    field: keyof Omit<PlayerEditRow, "player_id" | "username">,
    value: number | boolean,
  ) =>
    setPlayerGroups((prev) => {
      const groups = (prev[matchId] ?? []).map((g, ti) => {
        if (ti !== teamIdx) return g;
        const players = g.players.map((p, pi) =>
          pi === playerIdx ? { ...p, [field]: value } : p,
        );
        return { ...g, players };
      });
      return { ...prev, [matchId]: groups };
    });

  const toggleTeam = (key: string) =>
    setExpandedTeams((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Build + send one map's save (identical bodies to the admin editor) ──
  const buildRequest = (matchId: number): { endpoint: string; body: any } | null => {
    const rows = editRows[matchId] ?? [];
    if (rows.length === 0) return null;
    if (isSolo) {
      return {
        endpoint: `${apiBase}/events/edit-solo-match-result/`,
        body: {
          match_id: matchId.toString(),
          rows: rows.map((r) => ({
            competitor_id: r.id,
            placement: r.placement,
            kills: r.kills,
            played: r.played,
            bonus_points: r.bonus_points,
            penalty_points: r.penalty_points,
          })),
        },
      };
    }
    const groups = playerGroups[matchId] ?? [];
    return {
      endpoint: `${apiBase}/events/edit-match-result/`,
      body: {
        match_id: matchId,
        results: rows.map((r) => {
          const teamGroup = groups.find((g) => g.teamId === r.id);
          return {
            tournament_team_id: r.id,
            placement: r.placement,
            played: r.played,
            bonus_points: r.bonus_points,
            penalty_points: r.penalty_points,
            players: (teamGroup?.players ?? []).map((p) => ({
              user_id: p.player_id,
              kills: p.kills,
              damage: p.damage,
              assists: p.assists,
              played: p.played,
            })),
          };
        }),
      },
    };
  };

  const saveMatchById = async (matchId: number): Promise<void> => {
    const req = buildRequest(matchId);
    if (!req) return;
    const res = await fetch(req.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(req.body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.detail || "Save failed");
    }
  };

  const handleSaveMatch = async () => {
    if (activeMatchId === null) return;
    setSavingMatch(true);
    try {
      await saveMatchById(activeMatchId);
      toast.success("Map results saved!");
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to save map results");
    } finally {
      setSavingMatch(false);
    }
  };

  const handleSaveAll = async () => {
    const saveable = matchIds.filter((mid) => (editRows[mid] ?? []).length > 0);
    if (saveable.length === 0) {
      toast.error("No map results to save in this group yet.");
      return;
    }
    setSavingAll(true);
    try {
      const results = await Promise.allSettled(saveable.map((mid) => saveMatchById(mid)));
      const failed = results.filter((r) => r.status === "rejected").length;
      const ok = saveable.length - failed;
      if (failed > 0)
        toast.warning(`Saved ${ok} of ${saveable.length} maps. ${failed} failed.`);
      else toast.success(`Saved all ${ok} map${ok !== 1 ? "s" : ""} in this group.`);
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to save the group's maps");
    } finally {
      setSavingAll(false);
    }
  };

  const mapTabLabel = (m: MapData) => m.match_map || `Match ${m.match_number}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base">
              Edit whole group: {group.group_name}
            </CardTitle>
            <CardDescription>
              Edit every map below, then save one map or all maps at once.
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <IconArrowLeft size={16} className="mr-1" /> Back
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {matches.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No maps found for this group.
          </p>
        ) : (
          <>
            {/* Upload results (whole group) - drop screenshots, assign each to a map,
                upload + OCR all at once. Lives INSIDE the whole-group editor so this
                surface does both: upload AND manual edit, all scoped to this group.
                On completion we mark a reseed so the manual tables below refresh with
                the uploaded data. */}
            <GroupBulkUploadPanel
              matches={matches.map((m) => ({
                match_id: m.match_id,
                match_number: m.match_number,
                match_map: m.match_map,
              }))}
              groupName={group.group_name}
              apiBase={apiBase}
              token={token}
              onComplete={() => {
                setPendingReseed(true);
                onSaved();
              }}
            />

            {/* Divider into the manual editor. */}
            <div className="flex items-center gap-3 pt-1">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground uppercase">
                Or edit maps manually
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Map tabs */}
            <div className="flex gap-2 flex-wrap">
              {matches.map((m) => (
                <Button
                  key={m.match_id}
                  variant={activeMatchId === m.match_id ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setActiveMatchId(m.match_id)}
                >
                  {mapTabLabel(m)}
                </Button>
              ))}
            </div>

            {currentRows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                No results entered for this map yet. Use the per-map editor or bulk
                upload to enter them first.
              </p>
            ) : (
              <>
                {/* Placement table */}
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isSolo ? "Player" : "Team"}</TableHead>
                        <TableHead className="w-28">Placement</TableHead>
                        {isSolo && <TableHead className="w-24">Kills</TableHead>}
                        <TableHead className="w-24">Bonus</TableHead>
                        <TableHead className="w-24">Penalty</TableHead>
                        <TableHead className="w-16 text-center">Played</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentRows.map((row, idx) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>
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
                          {isSolo && (
                            <TableCell>
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
                          )}
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              className="h-8 w-20"
                              value={row.bonus_points || ""}
                              onChange={(e) =>
                                updateRow(
                                  activeMatchId!,
                                  idx,
                                  "bonus_points",
                                  parseInt(e.target.value) || 0,
                                )
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              className="h-8 w-20"
                              value={row.penalty_points || ""}
                              onChange={(e) =>
                                updateRow(
                                  activeMatchId!,
                                  idx,
                                  "penalty_points",
                                  parseInt(e.target.value) || 0,
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={row.played}
                              onCheckedChange={(v) =>
                                updateRow(activeMatchId!, idx, "played", !!v)
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Player stats (team mode) */}
                {!isSolo && currentPlayerGroups.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Player Stats</p>
                    {currentPlayerGroups.map((tg, teamIdx) => {
                      const key = `${activeMatchId}-${tg.teamId}`;
                      const isExpanded = expandedTeams[key] ?? false;
                      return (
                        <div
                          key={tg.teamId}
                          className="border rounded-lg overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => toggleTeam(key)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <IconChevronDown size={16} className="text-muted-foreground" />
                              ) : (
                                <IconChevronRight size={16} className="text-muted-foreground" />
                              )}
                              <span className="font-medium text-sm">{tg.teamName}</span>
                            </div>
                            <Badge variant="secondary">
                              {tg.players.length} player
                              {tg.players.length !== 1 ? "s" : ""}
                            </Badge>
                          </button>
                          {isExpanded && (
                            <div className="border-t">
                              {tg.players.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  No player data for this team.
                                </p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Player</TableHead>
                                      <TableHead className="w-24">Kills</TableHead>
                                      <TableHead className="w-24">Damage</TableHead>
                                      <TableHead className="w-24">Assists</TableHead>
                                      <TableHead className="w-16 text-center">Played</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {tg.players.map((player, playerIdx) => (
                                      <TableRow key={player.player_id}>
                                        <TableCell className="font-medium">
                                          {player.username}
                                        </TableCell>
                                        <TableCell>
                                          <Input
                                            type="number"
                                            min="0"
                                            className="h-8 w-20"
                                            value={player.kills || ""}
                                            onChange={(e) =>
                                              updatePlayerRow(
                                                activeMatchId!,
                                                teamIdx,
                                                playerIdx,
                                                "kills",
                                                parseInt(e.target.value) || 0,
                                              )
                                            }
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <Input
                                            type="number"
                                            min="0"
                                            className="h-8 w-20"
                                            value={player.damage || ""}
                                            onChange={(e) =>
                                              updatePlayerRow(
                                                activeMatchId!,
                                                teamIdx,
                                                playerIdx,
                                                "damage",
                                                parseInt(e.target.value) || 0,
                                              )
                                            }
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <Input
                                            type="number"
                                            min="0"
                                            className="h-8 w-20"
                                            value={player.assists || ""}
                                            onChange={(e) =>
                                              updatePlayerRow(
                                                activeMatchId!,
                                                teamIdx,
                                                playerIdx,
                                                "assists",
                                                parseInt(e.target.value) || 0,
                                              )
                                            }
                                          />
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <Checkbox
                                            checked={player.played}
                                            onCheckedChange={(v) =>
                                              updatePlayerRow(
                                                activeMatchId!,
                                                teamIdx,
                                                playerIdx,
                                                "played",
                                                !!v,
                                              )
                                            }
                                          />
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Save actions */}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleSaveAll}
                disabled={savingAll || savingMatch}
              >
                {savingAll ? (
                  <span className="flex items-center gap-2">
                    <IconLoader2 size={14} className="animate-spin" /> Saving all maps…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <IconDeviceFloppy size={14} /> Save all maps ({matchIds.length})
                  </span>
                )}
              </Button>
              <Button
                onClick={handleSaveMatch}
                disabled={savingMatch || savingAll || currentRows.length === 0}
              >
                {savingMatch ? (
                  <span className="flex items-center gap-2">
                    <IconLoader2 size={14} className="animate-spin" /> Saving…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <IconDeviceFloppy size={14} /> Save this map
                  </span>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
