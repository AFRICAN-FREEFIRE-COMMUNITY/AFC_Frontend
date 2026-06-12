"use client";

// ── OcrReviewTable ────────────────────────────────────────────────────────────
// The editable per-MAP review table for OCR results: one row per competitor the screenshot read, each
// with an editable placement + kills and a resolution control (pick a matched team/player, free-search
// another, or create a ghost). When every row is resolved, the parent's onApply is called with the
// apply-shape rows ({placement, kills, resolution}).
//
// EXTRACTED from the original single-shot OcrUploadDialog so the async multi-image OcrBatchDialog can
// render ONE of these per map without duplicating the (proven) review logic. The row handlers + the
// confidence ladder + the candidate/free-search/ghost controls are unchanged from that dialog.
//
// 2026-06-12 (owner): three additions on top of the original table -
//   1. PER-PLAYER matching (team format): each row expands into a players panel where every OCR-read
//      player shows their kills + a platform-user match (candidate Select + free search), mirroring
//      the row-level team matching. The approved names ride into ghost resolutions as the roster.
//   2. GHOST team candidates: the suggestion dropdown also lists EXISTING ghost teams (value
//      "ghost:<uuid>" -> kind=ghost_existing), so a ghost created on an earlier map is reused, not
//      duplicated. The backend appends any missing approved players to that ghost's roster.
//   3. POINTS preview: when the parent passes the leaderboard's scoring config, each row shows the
//      points this map would award (placement_points[placement] + kills * kill_point), live with edits.
//
// CONSUMED BY: OcrBatchDialog (one table per "done" map). DESIGN: AFC constants - rounded-md panels,
// compact text-xs table, outline rounded-full badges, green/orange Real/Ghost. No em/en dashes.

import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TeamSearchSelect,
  type PickedTeam,
} from "@/components/ui/team-search-select";
import {
  UserSearchSelect,
  type PickedUser,
} from "@/components/ui/user-search-select";
import {
  IconLoader2,
  IconUpload,
  IconUserPlus,
  IconAlertTriangle,
  IconCircleCheck,
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  type LeaderboardFormat,
  type OcrExtractRow,
  type OcrPlayerDetail,
  type OcrRowResolution,
  type OcrApplyRow,
} from "@/lib/standaloneLeaderboards";

// Sentinel <Select> values (Radix Select forbids an empty-string item).
const FREE_MATCH = "__free_match__";
const MAKE_GHOST = "__make_ghost__";
// Per-player sentinels: open the inline user search / explicitly mark "not on the platform".
const PLAYER_SEARCH = "__player_search__";
const PLAYER_NONE = "__player_none__";
// Ghost-team candidates are encoded as "ghost:<uuid>" Select values (real teams use the bare int id).
const GHOST_VALUE_PREFIX = "ghost:";

// The leaderboard's scoring config, passed down from the wizard so each row can preview the points
// this map would award. Optional: older callers without it simply hide the Points column.
export interface OcrScoring {
  placementPoints: Record<string, number>;
  killPoint: number;
}

// One OCR-read player inside a row (team format), with the admin's match decision. chosenUserId /
// chosenUsername start from the backend's best match (players_detail) and the admin can re-pick a
// candidate, free-search any platform user, or mark the player as not-on-platform (ghost).
interface EditablePlayer {
  name: string; // the IGN exactly as the OCR read it (immutable display)
  kills: number;
  confidence: number;
  candidates: OcrPlayerDetail["top_candidates"];
  chosenUserId: number | null;
  chosenUsername: string | null;
  // The chosen player's CURRENT platform team (owner 2026-06-12: "should be able to see the teams
  // each of the suggested players are currently in"). From matched_team_name / candidate team_name;
  // null for free agents and free-search picks (the search endpoint does not return a team).
  chosenTeamName: string | null;
  searchOpen: boolean;
}

// Local, per-row editable state. Starts from the extracted row; `resolution` is null until resolved.
interface ReviewRow {
  row_id: string;
  raw_name: string;
  playersRead: string[]; // team format: the player names the OCR saw in this placement
  players: EditablePlayer[]; // team format: the same players with kills + match decisions
  playersOpen: boolean; // whether the per-player panel row is expanded
  placement: number;
  kills: number;
  confidence: number;
  matchedId: number | null;
  matchedName: string | null;
  candidates: OcrExtractRow["top_candidates"];
  isUnmatched: boolean;
  resolution: OcrRowResolution | null;
  showFreeMatch: boolean;
  showGhostForm: boolean;
  resolutionLabel: string | null;
  ghostName: string;
  ghostCountry: string;
}

// A confidently matched row arrives pre-resolved as {kind:"real", id} so the admin only touches the
// unmatched / wrong ones.
function toReviewRow(r: OcrExtractRow, format: LeaderboardFormat): ReviewRow {
  const matchedId =
    format === "team" ? r.matched_team_id ?? null : r.matched_user_id ?? null;
  const resolved =
    !r.is_unmatched && matchedId != null
      ? ({ kind: "real", id: matchedId } as OcrRowResolution)
      : null;
  // Per-player edit state from the backend's players_detail; fall back to the plain players_read
  // names (no kills / no matches) for rows produced before players_detail existed.
  const players: EditablePlayer[] = (
    r.players_detail ??
    (r.players_read ?? []).map((name) => ({
      name,
      kills: 0,
      matched_user_id: null,
      matched_username: null,
      matched_team_name: null,
      confidence: 0,
      top_candidates: [] as OcrPlayerDetail["top_candidates"],
      is_unmatched: true,
    }))
  ).map((p) => ({
    name: p.name,
    kills: p.kills,
    confidence: p.confidence,
    candidates: p.top_candidates ?? [],
    // AUTO-pick only confident matches (>= 75%). Below that the best guess was actively
    // misleading (owner 2026-06-12: "NOXY CVS" auto-showed teammate "PUNKY CVS" at 67%) - the
    // weak candidates stay one click away in the Select, but the row starts "not on platform".
    chosenUserId: p.confidence >= 0.75 ? p.matched_user_id : null,
    chosenUsername: p.confidence >= 0.75 ? p.matched_username : null,
    chosenTeamName: p.confidence >= 0.75 ? p.matched_team_name ?? null : null,
    searchOpen: false,
  }));
  return {
    row_id: r.row_id,
    raw_name: r.raw_name,
    playersRead: r.players_read ?? [],
    players,
    // OPEN by default (owner 2026-06-12: "all the player names and their kills should show") -
    // the toggle only lets the admin COLLAPSE a row they are done with.
    playersOpen: players.length > 0,
    placement: r.placement,
    kills: r.kills,
    confidence: r.confidence,
    matchedId,
    matchedName: r.matched_name,
    candidates: r.top_candidates ?? [],
    isUnmatched: r.is_unmatched,
    resolution: resolved,
    showFreeMatch: false,
    showGhostForm: false,
    resolutionLabel: resolved ? r.matched_name ?? `#${matchedId}` : null,
    ghostName: "",
    ghostCountry: "",
  };
}

// The roster a ghost resolution carries: the admin-approved platform username where one was picked,
// else the OCR-read name. The backend dedupes case-insensitively and, for ghost_existing, appends
// only the slots the ghost team does not already have.
function approvedNames(row: ReviewRow): string[] {
  return row.players
    .map((p) => (p.chosenUsername ?? p.name).trim())
    .filter(Boolean);
}

export function OcrReviewTable({
  format,
  rows: extractRows,
  applied,
  applying,
  scoring,
  onApply,
}: {
  format: LeaderboardFormat;
  rows: OcrExtractRow[];
  applied: boolean;
  applying: boolean;
  // The leaderboard's scoring config (placement points + kill point) for the per-row Points preview.
  // Threaded from the wizard via OcrBatchDialog; optional so older callers are unaffected.
  scoring?: OcrScoring;
  // Fired when the admin presses "Apply this map" with every row resolved. Parent does the API call.
  onApply: (applyRows: OcrApplyRow[]) => void;
}) {
  const [rows, setRows] = useState<ReviewRow[]>(() =>
    (extractRows ?? []).map((r) => toReviewRow(r, format)),
  );

  const unresolvedCount = useMemo(
    () => rows.filter((r) => r.resolution == null).length,
    [rows],
  );
  const canApply = rows.length > 0 && unresolvedCount === 0 && !applying && !applied;

  const setRow = (rowId: string, patch: Partial<ReviewRow>) =>
    setRows((prev) =>
      prev.map((r) => (r.row_id === rowId ? { ...r, ...patch } : r)),
    );

  // The matched-entity <Select>: pick a candidate (real OR an existing ghost team), open free-search,
  // or open the ghost form. Ghost candidates arrive as "ghost:<uuid>" values and resolve as
  // kind=ghost_existing (the approved players are attached at apply time, see handleApplyClick).
  const handleSelectChange = (row: ReviewRow, value: string) => {
    if (value === FREE_MATCH) {
      setRow(row.row_id, { showFreeMatch: true, showGhostForm: false });
      return;
    }
    if (value === MAKE_GHOST) {
      setRow(row.row_id, { showGhostForm: true, showFreeMatch: false });
      return;
    }
    if (value.startsWith(GHOST_VALUE_PREFIX)) {
      const gid = value.slice(GHOST_VALUE_PREFIX.length);
      const cand = row.candidates.find((c) => c.ghost_team_id === gid);
      setRow(row.row_id, {
        resolution: { kind: "ghost_existing", id: gid },
        resolutionLabel: `${cand?.team_name ?? "Ghost team"} (existing ghost)`,
        showFreeMatch: false,
        showGhostForm: false,
      });
      return;
    }
    const id = parseInt(value, 10);
    const cand = row.candidates.find((c) =>
      format === "team" ? c.team_id === id : c.user_id === id,
    );
    const label =
      (format === "team" ? cand?.team_name : cand?.username) ??
      row.matchedName ??
      `#${id}`;
    setRow(row.row_id, {
      resolution: { kind: "real", id },
      resolutionLabel: label,
      matchedId: id,
      showFreeMatch: false,
      showGhostForm: false,
    });
  };

  // ── Per-player match decisions (team format, inside the expanded players panel) ──
  const setPlayer = (rowId: string, idx: number, patch: Partial<EditablePlayer>) =>
    setRows((prev) =>
      prev.map((r) =>
        r.row_id === rowId
          ? { ...r, players: r.players.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }
          : r,
      ),
    );

  const handlePlayerSelect = (row: ReviewRow, idx: number, value: string) => {
    if (value === PLAYER_SEARCH) {
      setPlayer(row.row_id, idx, { searchOpen: true });
      return;
    }
    if (value === PLAYER_NONE) {
      // Explicit "not on the platform": the read name itself becomes the approved roster entry.
      setPlayer(row.row_id, idx, {
        chosenUserId: null,
        chosenUsername: null,
        chosenTeamName: null,
        searchOpen: false,
      });
      return;
    }
    const uid = parseInt(value, 10);
    const cand = row.players[idx]?.candidates.find((c) => c.user_id === uid);
    setPlayer(row.row_id, idx, {
      chosenUserId: uid,
      chosenUsername: cand?.username ?? `#${uid}`,
      chosenTeamName: cand?.team_name ?? null,
      searchOpen: false,
    });
  };

  const handlePlayerFreePick = (
    row: ReviewRow,
    idx: number,
    _username: string | null,
    user?: PickedUser,
  ) => {
    if (!user) return;
    setPlayer(row.row_id, idx, {
      chosenUserId: user.user_id,
      chosenUsername: user.username,
      chosenTeamName: null, // the user-search endpoint does not return the team
      searchOpen: false,
    });
  };

  // Points this map would award the row, from the wizard's scoring config (live with edits).
  const rowPoints = (row: ReviewRow): number | null => {
    if (!scoring) return null;
    const placePts = scoring.placementPoints[String(row.placement)] ?? 0;
    return placePts + row.kills * scoring.killPoint;
  };

  const handleFreeTeamPick = (row: ReviewRow, teamId: number | null, team?: PickedTeam) => {
    if (teamId == null) return;
    setRow(row.row_id, {
      resolution: { kind: "real", id: teamId },
      resolutionLabel: team?.team_name ?? `Team #${teamId}`,
      matchedId: teamId,
      showFreeMatch: false,
    });
  };

  const handleFreeUserPick = (row: ReviewRow, _username: string | null, user?: PickedUser) => {
    if (!user) return;
    setRow(row.row_id, {
      resolution: { kind: "real", id: user.user_id },
      resolutionLabel: user.username,
      matchedId: user.user_id,
      showFreeMatch: false,
    });
  };

  const handleSaveGhost = (row: ReviewRow) => {
    const name = row.ghostName.trim();
    if (!name) {
      toast.error(
        format === "team" ? "Enter a ghost team name." : "Enter the player's IGN.",
      );
      return;
    }
    const country = row.ghostCountry.trim();
    // NOTE: the roster (players) is attached at APPLY time (handleApplyClick), not here, so player
    // match decisions made after this ghost was chosen still ride along.
    const resolution: OcrRowResolution =
      format === "team"
        ? { kind: "ghost_new", name, ...(country ? { country } : {}) }
        : { kind: "ghost_new", name };
    setRow(row.row_id, {
      resolution,
      resolutionLabel: `${name} (new ghost)`,
      showGhostForm: false,
    });
  };

  const handlePlacementChange = (row: ReviewRow, v: string) =>
    setRow(row.row_id, { placement: parseInt(v, 10) || 0 });
  const handleKillsChange = (row: ReviewRow, v: string) =>
    setRow(row.row_id, { kills: parseInt(v, 10) || 0 });

  const handleApplyClick = () => {
    if (!canApply) return;
    onApply(
      rows.map((r) => {
        let resolution = r.resolution!; // canApply guarantees it is set
        // Ghost resolutions (team format) carry the admin-approved roster: the backend seeds a NEW
        // ghost team with it, or APPENDS the missing names to an EXISTING ghost team's slots.
        if (
          format === "team" &&
          (resolution.kind === "ghost_new" || resolution.kind === "ghost_existing")
        ) {
          const players = approvedNames(r);
          if (players.length) resolution = { ...resolution, players };
        }
        return { placement: r.placement, kills: r.kills, resolution };
      }),
    );
  };

  const confidenceBadge = (row: ReviewRow) => {
    if (row.confidence == null) {
      return <span className="text-muted-foreground text-xs">-</span>;
    }
    const variant =
      row.confidence >= 0.8
        ? "default"
        : row.confidence >= 0.5
          ? "secondary"
          : "destructive";
    return (
      <Badge variant={variant} className="rounded-full">
        {Math.round(row.confidence * 100)}%
      </Badge>
    );
  };

  const selectValueFor = (row: ReviewRow): string => {
    // An existing-ghost pick shows as its "ghost:<uuid>" option when it came from the candidates.
    if (row.resolution?.kind === "ghost_existing") {
      const gid = String(row.resolution.id);
      return row.candidates.some((c) => c.ghost_team_id === gid)
        ? `${GHOST_VALUE_PREFIX}${gid}`
        : FREE_MATCH;
    }
    if (row.resolution?.kind !== "real") return FREE_MATCH;
    const realId = row.resolution.id;
    const isListed = row.candidates.some((c) =>
      format === "team" ? c.team_id === realId : c.user_id === realId,
    );
    return isListed ? String(realId) : FREE_MATCH;
  };

  const candId = (c: OcrExtractRow["top_candidates"][number]) =>
    format === "team" ? c.team_id : c.user_id;
  const candName = (c: OcrExtractRow["top_candidates"][number]) =>
    format === "team" ? c.team_name : c.username;

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
        No rows were read from this map. Remove it and try clearer screenshots.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Readiness hint */}
      {!applied && unresolvedCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <IconAlertTriangle className="size-4 shrink-0" />
          <span>
            {unresolvedCount} row{unresolvedCount !== 1 ? "s" : ""} still need a match. Pick a{" "}
            {format === "team" ? "team" : "player"} or create a ghost for each.
          </span>
        </div>
      )}

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="h-10">
              <TableHead className="text-xs text-foreground">Raw name</TableHead>
              <TableHead className="w-24 text-xs text-foreground">Placement</TableHead>
              <TableHead className="w-20 text-xs text-foreground">Kills</TableHead>
              {scoring && (
                <TableHead className="w-20 text-xs text-foreground">Points</TableHead>
              )}
              <TableHead className="w-24 text-xs text-foreground">Confidence</TableHead>
              <TableHead className="text-xs text-foreground">
                {format === "team" ? "Matched team" : "Matched player"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <Fragment key={row.row_id}>
              <TableRow
                className={cn(!applied && row.resolution == null && "bg-destructive/5")}
              >
                <TableCell className="p-2 align-top">
                  <div className="flex flex-col gap-0.5">
                    {row.raw_name ? (
                      <span className="font-mono text-xs">{row.raw_name}</span>
                    ) : (
                      <span className="text-xs italic text-muted-foreground">
                        (team name not read)
                      </span>
                    )}
                    {/* Players toggle (team format): expands the per-player panel under this row,
                        where each OCR-read player shows kills + their own platform match controls. */}
                    {row.players.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setRow(row.row_id, { playersOpen: !row.playersOpen })}
                        className="flex w-fit items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                        title={row.players.map((p) => p.name).join(", ")}
                      >
                        {row.playersOpen ? (
                          <IconChevronDown size={11} />
                        ) : (
                          <IconChevronRight size={11} />
                        )}
                        {row.players.length} player{row.players.length !== 1 ? "s" : ""}
                        {": "}
                        <span className="max-w-[160px] truncate">
                          {row.players.map((p) => p.name).join(", ")}
                        </span>
                      </button>
                    )}
                  </div>
                </TableCell>
                <TableCell className="p-2">
                  <Input
                    type="number"
                    min="0"
                    value={row.placement || ""}
                    disabled={applied}
                    className="h-8 w-16 text-xs"
                    onChange={(e) => handlePlacementChange(row, e.target.value)}
                  />
                </TableCell>
                <TableCell className="p-2">
                  <Input
                    type="number"
                    min="0"
                    value={row.kills || ""}
                    disabled={applied}
                    className="h-8 w-16 text-xs"
                    onChange={(e) => handleKillsChange(row, e.target.value)}
                  />
                </TableCell>
                {scoring && (
                  <TableCell className="p-2">
                    {/* Points preview: placement points + kills * kill point, live with edits. */}
                    <span className="text-xs font-medium tabular-nums">
                      {(rowPoints(row) ?? 0) % 1 === 0
                        ? rowPoints(row)
                        : (rowPoints(row) ?? 0).toFixed(1)}{" "}
                      pts
                    </span>
                  </TableCell>
                )}
                <TableCell className="p-2">{confidenceBadge(row)}</TableCell>
                <TableCell className="p-2">
                  <div className="flex flex-col gap-1.5">
                    {!applied && (
                      <Select
                        value={selectValueFor(row)}
                        onValueChange={(v) => handleSelectChange(row, v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue
                            placeholder={format === "team" ? "Pick a team" : "Pick a player"}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {row.candidates.length === 0 && (
                            <SelectItem value={FREE_MATCH} disabled>
                              No suggestions
                            </SelectItem>
                          )}
                          {row.candidates.map((c) => {
                            // Existing GHOST team candidate: encoded value, labelled as a ghost, and
                            // resolved as kind=ghost_existing (see handleSelectChange).
                            if (c.is_ghost && c.ghost_team_id) {
                              return (
                                <SelectItem
                                  key={`g-${c.ghost_team_id}`}
                                  value={`${GHOST_VALUE_PREFIX}${c.ghost_team_id}`}
                                >
                                  {c.team_name} (ghost, {Math.round(c.confidence * 100)}%)
                                </SelectItem>
                              );
                            }
                            const id = candId(c);
                            if (id == null) return null;
                            return (
                              <SelectItem key={id} value={String(id)}>
                                {candName(c)} ({Math.round(c.confidence * 100)}%)
                              </SelectItem>
                            );
                          })}
                          <SelectItem value={FREE_MATCH}>
                            Search for another {format === "team" ? "team" : "player"}
                          </SelectItem>
                          <SelectItem value={MAKE_GHOST}>Create as ghost</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {row.showFreeMatch &&
                      (format === "team" ? (
                        <TeamSearchSelect
                          value={null}
                          onChange={(id, team) => handleFreeTeamPick(row, id, team)}
                          placeholder="Search a team..."
                        />
                      ) : (
                        <UserSearchSelect
                          value={null}
                          onChange={(u, user) => handleFreeUserPick(row, u, user)}
                          placeholder="Search a player..."
                        />
                      ))}

                    {row.showGhostForm && (
                      <div className="space-y-2 rounded-md border bg-muted/30 p-2.5">
                        <div className="space-y-1">
                          <Label className="text-xs">
                            {format === "team" ? "Ghost team name" : "In-game name (IGN)"}
                          </Label>
                          <Input
                            value={row.ghostName}
                            onChange={(e) => setRow(row.row_id, { ghostName: e.target.value })}
                            placeholder={format === "team" ? "e.g. Team Phoenix" : "e.g. SkullKing"}
                            className="h-8 text-xs"
                          />
                        </div>
                        {format === "team" && (
                          <div className="space-y-1">
                            <Label className="text-xs">Country (optional)</Label>
                            <Input
                              value={row.ghostCountry}
                              onChange={(e) =>
                                setRow(row.row_id, { ghostCountry: e.target.value })
                              }
                              placeholder="e.g. Nigeria"
                              className="h-8 text-xs"
                            />
                          </div>
                        )}
                        <div className="flex justify-end gap-2 pt-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setRow(row.row_id, { showGhostForm: false })}
                          >
                            Cancel
                          </Button>
                          <Button type="button" size="sm" onClick={() => handleSaveGhost(row)}>
                            <IconUserPlus size={14} className="mr-1" />
                            Use ghost
                          </Button>
                        </div>
                      </div>
                    )}

                    {row.resolution && row.resolutionLabel && (
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            row.resolution.kind !== "real"
                              ? "border-orange-500 text-orange-600"
                              : "border-green-500 text-green-600",
                          )}
                        >
                          {row.resolution.kind !== "real" ? "Ghost" : "Real"}
                        </Badge>
                        <span className="truncate text-xs text-muted-foreground">
                          {row.resolutionLabel}
                        </span>
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>

              {/* ── Expanded players panel (team format) ── one line per OCR-read player: the read
                  name, their kills, and their own platform-user match controls (candidate Select,
                  free search, or explicit "not on platform"). The approved names become the roster
                  sent with ghost resolutions on apply. */}
              {row.playersOpen && row.players.length > 0 && (
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableCell colSpan={scoring ? 6 : 5} className="p-2 pl-6">
                    <div className="flex flex-col gap-1.5">
                      {row.players.map((p, idx) => (
                        <div key={`${row.row_id}-p${idx}`} className="flex flex-wrap items-center gap-2">
                          <span className="w-40 truncate font-mono text-xs" title={p.name}>
                            {p.name}
                          </span>
                          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                            {p.kills} kill{p.kills !== 1 ? "s" : ""}
                          </Badge>
                          {p.chosenUsername ? (
                            <Badge
                              variant="outline"
                              className="rounded-full border-green-500 px-2 py-0.5 text-xs text-green-600"
                            >
                              {p.chosenUsername}
                              {p.confidence > 0 && p.chosenUserId != null
                                ? ` (${Math.round(p.confidence * 100)}%)`
                                : ""}
                              {/* The matched player's CURRENT platform team, so same-named
                                  players are tellable apart at a glance. */}
                              {p.chosenTeamName ? ` - ${p.chosenTeamName}` : ""}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="rounded-full border-orange-500 px-2 py-0.5 text-xs text-orange-600"
                            >
                              not on platform
                            </Badge>
                          )}
                          {!applied && (
                            <Select
                              value={
                                p.chosenUserId != null &&
                                p.candidates.some((c) => c.user_id === p.chosenUserId)
                                  ? String(p.chosenUserId)
                                  : p.chosenUserId != null
                                    ? PLAYER_SEARCH
                                    : PLAYER_NONE
                              }
                              onValueChange={(v) => handlePlayerSelect(row, idx, v)}
                            >
                              <SelectTrigger className="h-7 w-44 text-xs">
                                <SelectValue placeholder="Match player" />
                              </SelectTrigger>
                              <SelectContent>
                                {p.candidates.map((c) =>
                                  c.user_id == null ? null : (
                                    <SelectItem key={c.user_id} value={String(c.user_id)}>
                                      {c.username} ({Math.round(c.confidence * 100)}%)
                                      {/* Candidate's current team, when they have one. */}
                                      {c.team_name ? ` - ${c.team_name}` : ""}
                                    </SelectItem>
                                  ),
                                )}
                                <SelectItem value={PLAYER_SEARCH}>
                                  Search platform players
                                </SelectItem>
                                <SelectItem value={PLAYER_NONE}>
                                  Not on the platform
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          {p.searchOpen && !applied && (
                            <div className="w-56">
                              <UserSearchSelect
                                value={null}
                                onChange={(u, user) => handlePlayerFreePick(row, idx, u, user)}
                                placeholder="Search a player..."
                              />
                            </div>
                          )}
                        </div>
                      ))}
                      <p className="text-[10px] text-muted-foreground">
                        Approved names are saved as the roster when this row is applied as a ghost
                        team (new or existing). Matching a player here does not change any real
                        team's roster.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Per-map apply */}
      <div className="flex items-center justify-end">
        {applied ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
            <IconCircleCheck size={15} />
            Applied as a map
          </span>
        ) : (
          <Button type="button" size="sm" onClick={handleApplyClick} disabled={!canApply}>
            {applying ? (
              <span className="flex items-center gap-2">
                <IconLoader2 size={14} className="animate-spin" />
                Applying...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <IconUpload size={14} />
                Apply this map
              </span>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
