// components/leaderboards/MatchResultsGrid.tsx
// ─────────────────────────────────────────────────────────────────────────────
// <MatchResultsGrid> (owner 2026-07-04)
//
// The always-editable per-map "Match Results" grid, extracted VERBATIM from the AFC
// admin leaderboard editor (app/(a)/a/leaderboards/[id]/edit/page.tsx, the
// TabsContent value="matches" block) so the organizer leaderboard editor can mount
// the SAME grid. Presentational + fully CONTROLLED: it owns no editing state of its
// own. The parent supplies the loaded rows, the update handlers, the save handlers,
// and the derived match-leaderboard preview; this component only renders them and
// calls back. That contract is what lets the ADMIN keep byte-identical behaviour
// (its Match Results state is shared with its Total Leaderboard + Scoring tabs, so
// the state MUST stay on the admin page and be passed in here) while the ORGANIZER
// wires the same grid to its own equivalent state.
//
// ── WHAT IT RENDERS (top to bottom) ──
//   • a map-selector button row (one button per map in the group)
//   • the Team/Solo placement table (placement + kills/bonus/penalty + Played)
//   • (team mode) the per-team expandable Player Stats section (kills/damage/assists
//     per player + an optional "Add player" control)
//   • the live "Match Leaderboard" preview (calculated standings, editable bonus/penalty)
//   • the Save row: "Redo this map" (destructive confirm), "Save all maps", "Save this map"
//
// ── CONSUMERS ──
//   • app/(a)/a/leaderboards/[id]/edit/page.tsx  - admin editor (English defaults; passes
//     its shared selectedMatchId / editRows / playerGroups state + handlers, and the two
//     admin-tour data-tour anchors). No `labels` passed = the English defaults below, so
//     the admin surface is unchanged.
//   • app/(organizer)/organizer/events/[slug]/leaderboard/page.tsx - organizer editor
//     (passes i18n `labels` from next-intl + its own group-scoped state). Gated by the
//     organizer page's can_upload_results baseline (the same permission the underlying
//     /events/edit-match-result & /events/edit-solo-match-result endpoints enforce), with
//     the per-team "Add player" control gated on can_manage_registrations via canAddPlayer.
//
// ── SAVE CONTRACT ──
//   The parent's onSaveMatch / onSaveAllMaps POST to /events/edit-match-result/ (team) or
//   /events/edit-solo-match-result/ (solo); onRedoMap POSTs /events/clear-match-result/.
//   This component never calls the API directly, so the auth token + endpoint choice stay
//   with the parent (mirrors how the admin page already builds those requests).
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  IconChevronDown,
  IconChevronRight,
  IconDeviceFloppy,
  IconLoader2,
  IconRefresh,
  IconUserPlus,
} from "@tabler/icons-react";
// Team country flag beside team names (solo/blank -> renders nothing) + advisory watchlist badge.
// Same two shared components the admin edit page uses inline, so the grid looks identical on both.
import { CountryFlag } from "@/lib/countryFlag";
import { WatchTag } from "@/components/WatchTag";
// Absent-vs-zero for every score box (owner bug 2026-08-06). Rendering a stored 0 as "" and
// reading "" back as 0 is what made a typed zero vanish and a blank placement save silently at
// zero points. See lib/scoreInput.ts for the full write-up.
import {
  parseScoreInput,
  scoreInputValue,
  scoreOrZero,
  type ScoreValue,
} from "@/lib/scoreInput";

// ── Row shapes (structurally identical to the admin page's inline types so the admin can
// pass its existing state straight through; the organizer builds the same shapes). ──
// Every numeric cell is a ScoreValue (number | null) so "left empty" survives all the way to the
// save handler instead of being laundered into 0 by the input.
export interface EditRow {
  id: number;
  name: string;
  // Team country for the flag (undefined/null for solo rows -> no flag).
  teamCountry?: string | null;
  placement: ScoreValue;
  kills: ScoreValue;
  bonus_points: ScoreValue;
  penalty_points: ScoreValue;
  played: boolean;
}

export interface PlayerEditRow {
  player_id: number;
  username: string;
  kills: ScoreValue;
  damage: ScoreValue;
  assists: ScoreValue;
  played: boolean;
}

export interface TeamPlayerGroup {
  teamId: number;
  teamName: string;
  teamCountry?: string | null;
  players: PlayerEditRow[];
}

// One row of the live Match Leaderboard preview. A superset of this (the admin's RawStat /
// the organizer's match.stats element) is assignable here - it only reads these fields.
export interface MatchStatLite {
  competitor_id?: number;
  tournament_team_id?: number;
  username?: string;
  team_name?: string;
  placement: number;
  placement_points: number;
  kill_points: number;
  bonus_points: number;
  penalty_points: number;
  effective_total: number;
}

// A map in the selected group (the selector row). match_number is optional (unused here).
export interface GridMatch {
  match_id: number;
  match_map: string;
  match_number?: number;
}

// All user-facing copy, so the admin can keep English (its surface is i18n-exempt) while the
// organizer passes next-intl strings. Every field is optional and falls back to the exact
// English the admin tab used, so the admin mount can omit `labels` entirely and render 1:1.
export interface MatchResultsGridLabels {
  noMatches: string;
  noResults: string;
  teamPlacementsTitle: string;
  playerResultsTitle: string;
  teamPlacementsDesc: string;
  playerResultsDesc: string;
  team: string;
  player: string;
  placement: string;
  kills: string;
  bonusPts: string;
  penaltyPts: string;
  played: string;
  playerStatsTitle: string;
  playerStatsDesc: string;
  noPlayerData: string;
  damage: string;
  assists: string;
  /** Pluralized "N players" badge. */
  playerCount: (n: number) => string;
  addPlayer: string;
  matchLeaderboardTitle: string;
  matchLeaderboardDesc: string;
  rank: string;
  placePts: string;
  killPts: string;
  bonus: string;
  penalty: string;
  total: string;
  redoButton: string;
  redoClearing: string;
  redoTitle: string;
  redoDescription: string;
  redoCancel: string;
  redoConfirm: string;
  /** "Redo all maps" bulk-clear controls (owner 2026-07-07). */
  redoAllButton: string;
  redoAllClearing: string;
  redoAllTitle: string;
  redoAllDescription: string;
  redoAllConfirm: string;
  /** "Save all maps (N)". */
  saveAllMaps: (n: number) => string;
  savingAllMaps: string;
  saveThisMap: string;
  saving: string;
  /** Watchlist badge label (defaults to the WatchTag default "Watch"). */
  watchLabel?: string;
  watchReason: string;
}

// Exact English the admin tab shipped with. The admin passes no `labels`, so it renders these.
const DEFAULT_LABELS: MatchResultsGridLabels = {
  noMatches: "No matches found for this group.",
  noResults: "No results have been entered for this map yet.",
  teamPlacementsTitle: "Team Placements",
  playerResultsTitle: "Player Results",
  teamPlacementsDesc: "Edit team placement and participation for this map.",
  playerResultsDesc: "Edit placement, kills, and bonus/penalty points.",
  team: "Team",
  player: "Player",
  placement: "Placement",
  kills: "Kills",
  bonusPts: "Bonus Pts",
  penaltyPts: "Penalty Pts",
  played: "Played",
  playerStatsTitle: "Player Stats",
  playerStatsDesc:
    "Edit individual player kills, damage, and assists for each team. Click a team to expand.",
  noPlayerData: "No player data available for this team.",
  damage: "Damage",
  assists: "Assists",
  playerCount: (n: number) => `${n} player${n !== 1 ? "s" : ""}`,
  addPlayer: "Add player",
  matchLeaderboardTitle: "Match Leaderboard",
  matchLeaderboardDesc:
    "Calculated standings for this map. Edit bonus and penalty points, then save above.",
  rank: "Rank",
  placePts: "Place Pts",
  killPts: "Kill Pts",
  bonus: "Bonus",
  penalty: "Penalty",
  total: "Total",
  redoButton: "Redo this map",
  redoClearing: "Clearing…",
  redoTitle: "Redo this map?",
  redoDescription:
    "This clears all results for this map. Other maps are not affected. You can then re-enter the results.",
  redoCancel: "Cancel",
  redoConfirm: "Redo map",
  redoAllButton: "Redo all maps",
  redoAllClearing: "Clearing all…",
  redoAllTitle: "Redo all maps in this group?",
  redoAllDescription:
    "This clears the results for EVERY map in this group so you can re-enter them. Maps in other groups are not affected.",
  redoAllConfirm: "Redo all maps",
  saveAllMaps: (n: number) => `Save all maps (${n})`,
  savingAllMaps: "Saving all maps…",
  saveThisMap: "Save this map",
  saving: "Saving…",
  watchReason: "On the advisory watchlist",
};

export interface MatchResultsGridProps {
  participantType: "solo" | "team";
  /** The maps of the selected group (the selector button row). */
  groupMatches: GridMatch[];
  /** The map currently being edited (null = none loaded yet). */
  selectedMatchId: number | null;
  onSelectMatch: (matchId: number) => void;
  /** Editable placement rows for the selected map (parent-owned, seeded from saved stats). */
  currentRows: EditRow[];
  /** Per-team player rows for the selected map (team mode only). */
  currentPlayerGroups: TeamPlayerGroup[];
  /** The selected map's calculated standings, feeding the live preview (sorted by the parent). */
  matchLeaderboard: MatchStatLite[];
  /** Which per-team player groups are expanded (keyed `${selectedMatchId}-${teamId}`). */
  expandedTeams: Record<string, boolean>;
  onToggleTeam: (key: string) => void;
  // `value` is a ScoreValue for the numeric fields (null = the box was emptied) and a boolean for
  // the Played checkbox. Handlers must keep null as null - see lib/scoreInput.ts.
  onUpdateRow: (
    matchId: number,
    idx: number,
    field: keyof Omit<EditRow, "id" | "name">,
    value: ScoreValue | boolean,
  ) => void;
  onUpdatePlayerRow: (
    matchId: number,
    teamIdx: number,
    playerIdx: number,
    field: keyof Omit<PlayerEditRow, "player_id" | "username">,
    value: ScoreValue | boolean,
  ) => void;
  /** Is this standings-row entity (team in team mode, player in solo mode) watched? */
  isEntityWatched: (id?: number) => boolean;
  /** Watched team ids (team-header badge) + watched player ids (player-row badge). */
  watchedTeamIds: Set<number>;
  watchedPlayerIds: Set<number>;
  /** Show the per-team "Add player" control (gate on the add-player endpoint's permission). */
  canAddPlayer?: boolean;
  onOpenAddPlayer?: (teamId: number, teamName: string) => void;
  onSaveMatch: () => void;
  savingMatch: boolean;
  onSaveAllMaps: () => void;
  savingAllMaps: boolean;
  /** Count shown on the "Save all maps (N)" button. */
  groupMatchCount: number;
  onRedoMap: () => void;
  redoingMap: boolean;
  /** Redo ALL maps in the group (owner 2026-07-07): clears every map's result for re-entry. */
  onRedoAllMaps: () => void;
  redoingAllMaps: boolean;
  /** When false, all inputs are disabled and the Save/Redo/Add controls are hidden (read-only). */
  canEdit?: boolean;
  /** i18n copy; omit for the admin (renders the English defaults above). */
  labels?: Partial<MatchResultsGridLabels>;
  /** Optional data-tour anchors (admin tour only; the organizer omits them). */
  dataTourMatchList?: string;
  dataTourSave?: string;
}

export function MatchResultsGrid({
  participantType,
  groupMatches,
  selectedMatchId,
  onSelectMatch,
  currentRows,
  currentPlayerGroups,
  matchLeaderboard,
  expandedTeams,
  onToggleTeam,
  onUpdateRow,
  onUpdatePlayerRow,
  isEntityWatched,
  watchedTeamIds,
  watchedPlayerIds,
  canAddPlayer = false,
  onOpenAddPlayer,
  onSaveMatch,
  savingMatch,
  onSaveAllMaps,
  savingAllMaps,
  groupMatchCount,
  onRedoMap,
  redoingMap,
  onRedoAllMaps,
  redoingAllMaps,
  canEdit = true,
  labels,
  dataTourMatchList,
  dataTourSave,
}: MatchResultsGridProps) {
  // Merge caller labels over the English defaults so every string always resolves.
  const L: MatchResultsGridLabels = { ...DEFAULT_LABELS, ...labels };

  // No maps in this group at all.
  if (groupMatches.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {L.noMatches}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Map selector: one button per map in the selected group; click loads its editable rows. */}
      <div data-tour={dataTourMatchList} className="flex gap-2 flex-wrap">
        {groupMatches.map((m) => (
          <Button
            key={m.match_id}
            variant={selectedMatchId === m.match_id ? "default" : "secondary"}
            size="sm"
            onClick={() => onSelectMatch(m.match_id)}
          >
            {m.match_map}
          </Button>
        ))}
      </div>

      {selectedMatchId !== null && currentRows.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {L.noResults}
          </CardContent>
        </Card>
      )}

      {selectedMatchId !== null && currentRows.length > 0 && (
        <>
          {/* ── Team / Solo placement table ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {participantType === "team"
                  ? L.teamPlacementsTitle
                  : L.playerResultsTitle}
              </CardTitle>
              <CardDescription>
                {participantType === "team"
                  ? L.teamPlacementsDesc
                  : L.playerResultsDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {participantType === "team" ? L.team : L.player}
                      </TableHead>
                      <TableHead className="w-28">{L.placement}</TableHead>
                      {participantType === "solo" && (
                        <TableHead className="w-28">{L.kills}</TableHead>
                      )}
                      {participantType === "solo" && (
                        <TableHead className="w-28">{L.bonusPts}</TableHead>
                      )}
                      {participantType === "solo" && (
                        <TableHead className="w-28">{L.penaltyPts}</TableHead>
                      )}
                      <TableHead className="w-20 text-center">
                        {L.played}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentRows.map((row, idx) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-2">
                            {/* Flag beside the team name (team's country; solo -> none). */}
                            <CountryFlag country={row.teamCountry} />
                            {row.name}
                            {/* Advisory watchlist flag (team in team mode, player in solo). */}
                            {isEntityWatched(row.id) && (
                              <WatchTag
                                label={L.watchLabel}
                                reason={L.watchReason}
                              />
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            className="h-8 w-24"
                            value={scoreInputValue(row.placement)}
                            disabled={!canEdit}
                            onChange={(e) =>
                              onUpdateRow(
                                selectedMatchId,
                                idx,
                                "placement",
                                parseScoreInput(e.target.value),
                              )
                            }
                          />
                        </TableCell>
                        {participantType === "solo" && (
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              className="h-8 w-24"
                              value={scoreInputValue(row.kills)}
                              disabled={!canEdit}
                              onChange={(e) =>
                                onUpdateRow(
                                  selectedMatchId,
                                  idx,
                                  "kills",
                                  parseScoreInput(e.target.value),
                                )
                              }
                            />
                          </TableCell>
                        )}
                        {participantType === "solo" && (
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              className="h-8 w-24"
                              value={scoreInputValue(row.bonus_points)}
                              disabled={!canEdit}
                              onChange={(e) =>
                                onUpdateRow(
                                  selectedMatchId,
                                  idx,
                                  "bonus_points",
                                  parseScoreInput(e.target.value),
                                )
                              }
                            />
                          </TableCell>
                        )}
                        {participantType === "solo" && (
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              className="h-8 w-24"
                              value={scoreInputValue(row.penalty_points)}
                              disabled={!canEdit}
                              onChange={(e) =>
                                onUpdateRow(
                                  selectedMatchId,
                                  idx,
                                  "penalty_points",
                                  parseScoreInput(e.target.value),
                                )
                              }
                            />
                          </TableCell>
                        )}
                        <TableCell className="text-center">
                          <Checkbox
                            checked={row.played}
                            disabled={!canEdit}
                            onCheckedChange={(v) =>
                              onUpdateRow(selectedMatchId, idx, "played", !!v)
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ── Player Stats (team mode only) ── */}
          {participantType === "team" && currentPlayerGroups.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{L.playerStatsTitle}</CardTitle>
                <CardDescription>{L.playerStatsDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {currentPlayerGroups.map((group, teamIdx) => {
                  const key = `${selectedMatchId}-${group.teamId}`;
                  const isExpanded = expandedTeams[key] ?? false;
                  return (
                    <div
                      key={group.teamId}
                      className="border rounded-lg overflow-hidden"
                    >
                      {/* Team header */}
                      <button
                        onClick={() => onToggleTeam(key)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <IconChevronDown
                              size={16}
                              className="text-muted-foreground"
                            />
                          ) : (
                            <IconChevronRight
                              size={16}
                              className="text-muted-foreground"
                            />
                          )}
                          <span className="font-medium text-sm inline-flex items-center gap-2">
                            {/* Flag beside the team name in the per-team player group. */}
                            <CountryFlag country={group.teamCountry} />
                            {group.teamName}
                            {/* Advisory watchlist flag for this team. */}
                            {watchedTeamIds.has(group.teamId) && (
                              <WatchTag
                                label={L.watchLabel}
                                reason={L.watchReason}
                              />
                            )}
                          </span>
                        </div>
                        <Badge variant="secondary">
                          {L.playerCount(group.players.length)}
                        </Badge>
                      </button>

                      {/* Player rows */}
                      {isExpanded && (
                        <div className="border-t">
                          {group.players.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              {L.noPlayerData}
                            </p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>{L.player}</TableHead>
                                  <TableHead className="w-28">
                                    {L.kills}
                                  </TableHead>
                                  <TableHead className="w-28">
                                    {L.damage}
                                  </TableHead>
                                  <TableHead className="w-28">
                                    {L.assists}
                                  </TableHead>
                                  <TableHead className="w-20 text-center">
                                    {L.played}
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.players.map((player, playerIdx) => (
                                  <TableRow key={player.player_id}>
                                    <TableCell className="font-medium">
                                      <span className="inline-flex items-center gap-2">
                                        {player.username}
                                        {/* Advisory watchlist flag for this player. */}
                                        {watchedPlayerIds.has(
                                          player.player_id,
                                        ) && (
                                          <WatchTag
                                            label={L.watchLabel}
                                            reason={L.watchReason}
                                          />
                                        )}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min="0"
                                        className="h-8 w-24"
                                        value={scoreInputValue(player.kills)}
                                        disabled={!canEdit}
                                        onChange={(e) =>
                                          onUpdatePlayerRow(
                                            selectedMatchId,
                                            teamIdx,
                                            playerIdx,
                                            "kills",
                                            parseScoreInput(e.target.value),
                                          )
                                        }
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min="0"
                                        className="h-8 w-24"
                                        value={scoreInputValue(player.damage)}
                                        disabled={!canEdit}
                                        onChange={(e) =>
                                          onUpdatePlayerRow(
                                            selectedMatchId,
                                            teamIdx,
                                            playerIdx,
                                            "damage",
                                            parseScoreInput(e.target.value),
                                          )
                                        }
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min="0"
                                        className="h-8 w-24"
                                        value={scoreInputValue(player.assists)}
                                        disabled={!canEdit}
                                        onChange={(e) =>
                                          onUpdatePlayerRow(
                                            selectedMatchId,
                                            teamIdx,
                                            playerIdx,
                                            "assists",
                                            parseScoreInput(e.target.value),
                                          )
                                        }
                                      />
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Checkbox
                                        checked={player.played}
                                        disabled={!canEdit}
                                        onCheckedChange={(v) =>
                                          onUpdatePlayerRow(
                                            selectedMatchId,
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

                          {/* Add player to event roster: per-team picker of PLAYING-role members
                              not yet rostered; the parent adds via
                              /events/add-player-to-event-roster/ then refetches. Shown only when
                              the caller can manage registrations (canAddPlayer). */}
                          {canEdit && canAddPlayer && onOpenAddPlayer && (
                            <div className="px-4 py-3 border-t">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() =>
                                  onOpenAddPlayer(group.teamId, group.teamName)
                                }
                              >
                                <IconUserPlus size={14} className="mr-1" />
                                {L.addPlayer}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* ── Match Leaderboard (live preview) ── */}
          {matchLeaderboard.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {L.matchLeaderboardTitle}
                </CardTitle>
                <CardDescription>{L.matchLeaderboardDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">{L.rank}</TableHead>
                        <TableHead>
                          {participantType === "team" ? L.team : L.player}
                        </TableHead>
                        <TableHead className="text-right w-24">
                          {L.placement}
                        </TableHead>
                        <TableHead className="text-right w-24">
                          {L.placePts}
                        </TableHead>
                        <TableHead className="text-right w-24">
                          {L.killPts}
                        </TableHead>
                        <TableHead className="w-28">{L.bonus}</TableHead>
                        <TableHead className="w-28">{L.penalty}</TableHead>
                        <TableHead className="text-right w-24">
                          {L.total}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matchLeaderboard.map((stat, idx) => {
                        const statId =
                          stat.competitor_id ?? stat.tournament_team_id ?? 0;
                        const editIdx = currentRows.findIndex(
                          (r) => r.id === statId,
                        );
                        const editRow =
                          editIdx >= 0 ? currentRows[editIdx] : undefined;
                        // The edit row WINS whenever this stat has one, including when its box
                        // was cleared (null). Only fall back to the saved stat when the row is
                        // not loaded at all - otherwise clearing a bonus box would keep showing
                        // the old saved bonus and the preview would disagree with what saves.
                        const bonus: ScoreValue = editRow
                          ? editRow.bonus_points
                          : stat.bonus_points;
                        const penalty: ScoreValue = editRow
                          ? editRow.penalty_points
                          : stat.penalty_points;
                        // A blank bonus/penalty counts as zero in the running total (the save
                        // sends it as 0), so the preview matches the number that will be stored.
                        const liveTotal =
                          stat.placement_points +
                          stat.kill_points +
                          scoreOrZero(bonus) -
                          scoreOrZero(penalty);
                        return (
                          <TableRow key={statId || idx}>
                            <TableCell className="text-muted-foreground font-medium">
                              #{idx + 1}
                            </TableCell>
                            <TableCell className="font-medium">
                              <span className="inline-flex items-center gap-2">
                                {stat.username ?? stat.team_name ?? "-"}
                                {/* Advisory watchlist flag (statId is team in team mode, player in solo). */}
                                {isEntityWatched(statId) && (
                                  <WatchTag
                                    label={L.watchLabel}
                                    reason={L.watchReason}
                                  />
                                )}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {stat.placement}
                            </TableCell>
                            <TableCell className="text-right">
                              {stat.placement_points}
                            </TableCell>
                            <TableCell className="text-right">
                              {stat.kill_points}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                className="h-8 w-24"
                                value={scoreInputValue(bonus)}
                                disabled={editIdx < 0 || !canEdit}
                                onChange={(e) =>
                                  onUpdateRow(
                                    selectedMatchId,
                                    editIdx,
                                    "bonus_points",
                                    parseScoreInput(e.target.value),
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                className="h-8 w-24"
                                value={scoreInputValue(penalty)}
                                disabled={editIdx < 0 || !canEdit}
                                onChange={(e) =>
                                  onUpdateRow(
                                    selectedMatchId,
                                    editIdx,
                                    "penalty_points",
                                    parseScoreInput(e.target.value),
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="text-right font-semibold text-primary">
                              {liveTotal.toFixed(1)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Save row: this map only, all maps at once, or a destructive "Redo this map".
              Hidden entirely in read-only mode (canEdit=false). */}
          {canEdit && (
            <div
              data-tour={dataTourSave}
              className="flex flex-wrap justify-end gap-2"
            >
              {/* The two destructive redo controls, grouped left (mr-auto) so the Save buttons stay
                  right. "Redo this map" clears ONLY the selected map; "Redo all maps" clears every map
                  in this group (owner 2026-07-07). Both fan out to the same clear-match-result endpoint
                  in the parent (single vs Promise.allSettled over the group's match ids). */}
              <div className="mr-auto flex flex-wrap gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      disabled={redoingMap || redoingAllMaps || savingMatch || savingAllMaps}
                    >
                      {redoingMap ? (
                        <span className="flex items-center gap-2">
                          <IconLoader2 size={14} className="animate-spin" />
                          {L.redoClearing}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <IconRefresh size={14} />
                          {L.redoButton}
                        </span>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{L.redoTitle}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {L.redoDescription}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{L.redoCancel}</AlertDialogCancel>
                      <AlertDialogAction onClick={onRedoMap}>
                        {L.redoConfirm}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Redo ALL maps in the group. Only shown when there is more than one map. */}
                {groupMatches.length > 1 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="border-destructive/50 text-destructive hover:bg-destructive/10"
                        disabled={redoingMap || redoingAllMaps || savingMatch || savingAllMaps}
                      >
                        {redoingAllMaps ? (
                          <span className="flex items-center gap-2">
                            <IconLoader2 size={14} className="animate-spin" />
                            {L.redoAllClearing}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <IconRefresh size={14} />
                            {L.redoAllButton}
                          </span>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{L.redoAllTitle}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {L.redoAllDescription}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{L.redoCancel}</AlertDialogCancel>
                        <AlertDialogAction onClick={onRedoAllMaps}>
                          {L.redoAllConfirm}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              <Button
                variant="outline"
                onClick={onSaveAllMaps}
                disabled={savingAllMaps || savingMatch}
              >
                {savingAllMaps ? (
                  <span className="flex items-center gap-2">
                    <IconLoader2 size={14} className="animate-spin" />
                    {L.savingAllMaps}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <IconDeviceFloppy size={14} />
                    {L.saveAllMaps(groupMatchCount)}
                  </span>
                )}
              </Button>
              <Button onClick={onSaveMatch} disabled={savingMatch || savingAllMaps}>
                {savingMatch ? (
                  <span className="flex items-center gap-2">
                    <IconLoader2 size={14} className="animate-spin" />
                    {L.saving}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <IconDeviceFloppy size={14} />
                    {L.saveThisMap}
                  </span>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
