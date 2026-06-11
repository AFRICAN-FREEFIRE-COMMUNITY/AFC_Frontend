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
// CONSUMED BY: OcrBatchDialog (one table per "done" map). DESIGN: AFC constants - rounded-md panels,
// compact text-xs table, outline rounded-full badges, green/orange Real/Ghost. No em/en dashes.

import { useMemo, useState } from "react";
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
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  type LeaderboardFormat,
  type OcrExtractRow,
  type OcrRowResolution,
  type OcrApplyRow,
} from "@/lib/standaloneLeaderboards";

// Sentinel <Select> values (Radix Select forbids an empty-string item).
const FREE_MATCH = "__free_match__";
const MAKE_GHOST = "__make_ghost__";

// Local, per-row editable state. Starts from the extracted row; `resolution` is null until resolved.
interface ReviewRow {
  row_id: string;
  raw_name: string;
  playersRead: string[]; // team format: the player names the OCR saw in this placement
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
  return {
    row_id: r.row_id,
    raw_name: r.raw_name,
    playersRead: r.players_read ?? [],
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

export function OcrReviewTable({
  format,
  rows: extractRows,
  applied,
  applying,
  onApply,
}: {
  format: LeaderboardFormat;
  rows: OcrExtractRow[];
  applied: boolean;
  applying: boolean;
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

  // The matched-entity <Select>: pick a candidate (real), open free-search, or open the ghost form.
  const handleSelectChange = (row: ReviewRow, value: string) => {
    if (value === FREE_MATCH) {
      setRow(row.row_id, { showFreeMatch: true, showGhostForm: false });
      return;
    }
    if (value === MAKE_GHOST) {
      setRow(row.row_id, { showGhostForm: true, showFreeMatch: false });
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
    const resolution: OcrRowResolution =
      format === "team"
        ? {
            kind: "ghost_new",
            name,
            ...(country ? { country } : {}),
            // Seed the new ghost team with the roster the OCR read, so the ghost carries its players.
            ...(row.playersRead.length ? { players: row.playersRead } : {}),
          }
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
      rows.map((r) => ({
        placement: r.placement,
        kills: r.kills,
        resolution: r.resolution!, // canApply guarantees it is set
      })),
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
              <TableHead className="w-24 text-xs text-foreground">Confidence</TableHead>
              <TableHead className="text-xs text-foreground">
                {format === "team" ? "Matched team" : "Matched player"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.row_id}
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
                    {/* The player names the OCR saw in this placement (the "full name it sees"). Helps
                        the admin identify the team when only a short tag or nothing was read. */}
                    {row.playersRead.length > 0 && (
                      <span
                        className="max-w-[200px] truncate text-[10px] text-muted-foreground"
                        title={row.playersRead.join(", ")}
                      >
                        saw: {row.playersRead.join(", ")}
                      </span>
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
                            row.resolution.kind === "ghost_new"
                              ? "border-orange-500 text-orange-600"
                              : "border-green-500 text-green-600",
                          )}
                        >
                          {row.resolution.kind === "ghost_new" ? "Ghost" : "Real"}
                        </Badge>
                        <span className="truncate text-xs text-muted-foreground">
                          {row.resolutionLabel}
                        </span>
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
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
