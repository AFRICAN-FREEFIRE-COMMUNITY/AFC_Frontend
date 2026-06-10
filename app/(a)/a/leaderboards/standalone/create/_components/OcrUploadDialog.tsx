"use client";

// ── OcrUploadDialog (Stream P2) ───────────────────────────────────────────────
// The "read a results screenshot" dialog for the standalone-leaderboard create wizard. It turns a
// single screenshot into a finished map in two moves:
//   1. Pick a screenshot -> POST /leaderboards/standalone/<id>/ocr/ (standaloneLeaderboardsApi
//      .ocrExtract). The backend reads it and hands back one draft row per competitor, each
//      pre-matched to a real team/user where it could, with a confidence and a few alternative
//      candidates.
//   2. Review/correct each row, then "Apply" -> POST /<id>/ocr/apply/ (ocrApply). The backend
//      creates one map + the participants (minting ghosts for any "create as ghost" rows) + the
//      results in one call, and returns {match, participants, standings}. We hand that to onApplied
//      so the wizard can merge the new participants and advance to the Results step pre-filled.
//
// WHERE IT SITS / HOW IT CONNECTS:
//   ParticipantsStep.tsx renders this behind an "Upload screenshot" button and passes leaderboardId
//   + format. On apply it calls onApplied(result); ParticipantsStep merges result.participants into
//   the wizard's participant state and advances to Results carrying result.match (the page-level
//   onMatchCreated callback threaded through create/page.tsx).
//
// IDIOM SOURCES (mirrored, not reinvented):
//   - The editable review table adapts app/(a)/a/leaderboards/_components/OCRReviewTable.tsx
//     (top_candidates <Select> + confidence Badge + editable cells, compact text-xs density).
//   - Free re-match reuses components/ui/{team,user}-search-select.tsx (the same pickers the
//     Participants step uses).
//   - The per-row "create as ghost" affordance reuses the GhostCreateInline field shape
//     (team name + country, or solo ign) to build a {kind:"ghost_new", ...} resolution.
//   - The file picker reuses MapSelectionStep's dropzone idiom (drag + click, object-URL preview).
//   - Dialog primitive: components/ui/dialog.tsx (same usage as ProductFormDialog).
//
// DESIGN: AFC constants - rounded-md panels, compact text-xs table, outline rounded-full badges,
// the green/orange Real/Ghost badge idiom. No em/en dashes in any copy or comment.

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  IconX,
  IconUserPlus,
  IconScan,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  standaloneLeaderboardsApi,
  type LeaderboardFormat,
  type OcrExtractResponse,
  type OcrExtractRow,
  type OcrRowResolution,
  type OcrApplyResponse,
} from "@/lib/standaloneLeaderboards";

// Sentinel <Select> value for "re-match by free search" (Radix Select forbids an empty-string item).
const FREE_MATCH = "__free_match__";
// Sentinel <Select> value for "create this row as a ghost".
const MAKE_GHOST = "__make_ghost__";

// Local, per-row editable state. We start from the extracted row and let the admin edit placement +
// kills and pick a resolution. `resolution` is null until the row is resolved (Apply stays blocked).
interface ReviewRow {
  row_id: string;
  raw_name: string;
  placement: number;
  kills: number;
  confidence: number;
  // The id the backend pre-matched this row to (team_id for team format, user_id for solo), if any.
  matchedId: number | null;
  matchedName: string | null;
  candidates: OcrExtractRow["top_candidates"];
  isUnmatched: boolean;
  // Exactly one resolution per row once chosen (see OcrRowResolution).
  resolution: OcrRowResolution | null;
  // UI flags: which control is currently expanded for this row.
  showFreeMatch: boolean;
  showGhostForm: boolean;
  // Label to show for the current resolution (so the admin can read what each row will become).
  resolutionLabel: string | null;
  // Local ghost-form fields (team name + country, or solo ign) - reused GhostCreateInline shape.
  ghostName: string;
  ghostCountry: string;
}

// Turn an extract row into editable local state. A confidently matched row arrives pre-resolved as
// {kind:"real", id} so the admin only has to touch the unmatched / wrong ones.
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

export function OcrUploadDialog({
  open,
  onOpenChange,
  leaderboardId,
  format,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaderboardId: number;
  format: LeaderboardFormat;
  // Fired after a successful apply. The wizard merges result.participants and advances to Results
  // carrying result.match (see ParticipantsStep / create/page.tsx).
  onApplied: (result: OcrApplyResponse) => void;
}) {
  // ── File + extract state ────────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Review state (populated after a successful extract) ─────────────────────
  const [draftId, setDraftId] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [applying, setApplying] = useState(false);

  // Revoke the object URL when the preview changes / on unmount (MapSelectionStep idiom).
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Reset everything whenever the dialog is closed so a re-open starts clean.
  useEffect(() => {
    if (!open) {
      if (preview) URL.revokeObjectURL(preview);
      setFile(null);
      setPreview(null);
      setDraftId(null);
      setRows([]);
      setExtracting(false);
      setApplying(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Apply-readiness: every row must carry exactly one resolution. ───────────
  const unresolvedCount = useMemo(
    () => rows.filter((r) => r.resolution == null).length,
    [rows],
  );
  const canApply = rows.length > 0 && unresolvedCount === 0 && !applying;

  // ── Local-state helpers ─────────────────────────────────────────────────────
  const setRow = (rowId: string, patch: Partial<ReviewRow>) =>
    setRows((prev) =>
      prev.map((r) => (r.row_id === rowId ? { ...r, ...patch } : r)),
    );

  // ── File handling (MapSelectionStep dropzone idiom) ─────────────────────────
  const acceptFile = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = Array.from(files).find((x) => x.type.startsWith("image/"));
    if (!f) {
      toast.error("Only image files are allowed (PNG, JPG, WEBP).");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clearFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Extract: send the screenshot, build the review rows from the response. ──
  const handleExtract = async () => {
    if (!file) {
      toast.error("Add a screenshot to read first.");
      return;
    }
    setExtracting(true);
    try {
      const res: OcrExtractResponse = await standaloneLeaderboardsApi.ocrExtract(
        leaderboardId,
        file,
      );
      setDraftId(res.draft_id);
      setRows((res.rows ?? []).map((r) => toReviewRow(r, format)));
      toast.success(
        `Read ${res.rows?.length ?? 0} row${
          (res.rows?.length ?? 0) !== 1 ? "s" : ""
        } from the screenshot.`,
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Could not read that screenshot. Try again.",
      );
    } finally {
      setExtracting(false);
    }
  };

  // ── Per-row resolution handlers ─────────────────────────────────────────────

  // The matched-entity <Select> handles three things: pick a candidate (real), open the free-search
  // re-match, or open the ghost form. Picking a candidate resolves the row to {kind:"real", id}.
  const handleSelectChange = (row: ReviewRow, value: string) => {
    if (value === FREE_MATCH) {
      setRow(row.row_id, { showFreeMatch: true, showGhostForm: false });
      return;
    }
    if (value === MAKE_GHOST) {
      setRow(row.row_id, { showGhostForm: true, showFreeMatch: false });
      return;
    }
    // Otherwise the value is a candidate id (team_id or user_id depending on format).
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

  // Free re-match to any existing team (team format). TeamSearchSelect emits team_id directly.
  const handleFreeTeamPick = (row: ReviewRow, teamId: number | null, team?: PickedTeam) => {
    if (teamId == null) return;
    setRow(row.row_id, {
      resolution: { kind: "real", id: teamId },
      resolutionLabel: team?.team_name ?? `Team #${teamId}`,
      matchedId: teamId,
      showFreeMatch: false,
    });
  };

  // Free re-match to any existing user (solo format). UserSearchSelect emits the username, but we
  // need the numeric user_id (captured from the 2nd onChange arg, same as ParticipantsStep).
  const handleFreeUserPick = (row: ReviewRow, _username: string | null, user?: PickedUser) => {
    if (!user) return;
    setRow(row.row_id, {
      resolution: { kind: "real", id: user.user_id },
      resolutionLabel: user.username,
      matchedId: user.user_id,
      showFreeMatch: false,
    });
  };

  // Create-as-ghost: build a {kind:"ghost_new"} resolution from the inline fields. For team format
  // we collect name + optional country; for solo the ign is the ghost's name (GhostCreateInline
  // sends solo ghosts as {ign}, but the apply contract names the field `name`, so the ign IS name).
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
        ? { kind: "ghost_new", name, ...(country ? { country } : {}) }
        : { kind: "ghost_new", name };
    setRow(row.row_id, {
      resolution,
      resolutionLabel: `${name} (new ghost)`,
      showGhostForm: false,
    });
  };

  // Editable kills / placement. Stored as numbers; blank -> 0.
  const handlePlacementChange = (row: ReviewRow, v: string) =>
    setRow(row.row_id, { placement: parseInt(v, 10) || 0 });
  const handleKillsChange = (row: ReviewRow, v: string) =>
    setRow(row.row_id, { kills: parseInt(v, 10) || 0 });

  // ── Apply: write map + participants + results in one backend call. ──────────
  const handleApply = async () => {
    if (!canApply) return;
    setApplying(true);
    try {
      // match_map is omitted so the backend names the new map by its default (Map N). The draft is
      // identified server-side by the leaderboard's pending OCR state, so draft_id is not resent.
      const result = await standaloneLeaderboardsApi.ocrApply(leaderboardId, {
        rows: rows.map((r) => ({
          placement: r.placement,
          kills: r.kills,
          // canApply guarantees resolution is set; the ! is safe here.
          resolution: r.resolution!,
        })),
      });
      toast.success("Map created from the screenshot.");
      onApplied(result);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to apply the screenshot results.",
      );
    } finally {
      setApplying(false);
    }
  };

  // ── Confidence badge (same ladder as OCRReviewTable) ────────────────────────
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

  // The current <Select> value for a row: a candidate id when the resolution is a real id that is one
  // of the listed candidates, else the free-match sentinel (so a free pick / ghost reads as "Other").
  // We capture the real id in a local first (the kind === "real" narrowing is lost inside the .some
  // closure), then check it against the candidate ids for the active format.
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

  const hasDraft = draftId != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Wide content so the review table breathes; scroll inside on small viewports. */}
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconScan size={18} className="text-muted-foreground" />
            Read results from a screenshot
          </DialogTitle>
          <DialogDescription>
            {hasDraft
              ? "Check each competitor the screenshot read, fix any wrong matches, then apply to create the map."
              : format === "team"
                ? "Upload a results screenshot. We read each team's placement and kills, then you confirm the matches."
                : "Upload a results screenshot. We read each player's placement and kills, then you confirm the matches."}
          </DialogDescription>
        </DialogHeader>

        {/* ── STAGE 1: file picker (until we have a draft) ── */}
        {!hasDraft && (
          <div className="space-y-4">
            {!file ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  acceptFile(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-md p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/20",
                )}
              >
                <IconUpload size={28} className="text-muted-foreground" />
                <p className="text-sm text-center text-muted-foreground">
                  Drag and drop a screenshot here, or{" "}
                  <span className="text-primary font-medium">click to browse</span>
                </p>
                <p className="text-xs text-muted-foreground">PNG, JPG, WEBP supported</p>
              </div>
            ) : (
              // Single-file preview with a remove affordance (MapSelectionStep idiom).
              <div className="relative group rounded-md overflow-hidden border aspect-video bg-muted/20 max-w-md">
                {preview && (
                  <img
                    src={preview}
                    alt={file.name}
                    className="w-full h-full object-contain"
                  />
                )}
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 text-white text-[10px] truncate">
                  {file.name}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="absolute top-1.5 right-1.5 size-6 rounded-full bg-destructive/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                  aria-label="Remove screenshot"
                >
                  <IconX size={12} className="text-white" />
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={(e) => acceptFile(e.target.files)}
            />
          </div>
        )}

        {/* ── STAGE 2: editable review table (after extract) ── */}
        {hasDraft && (
          <div className="space-y-3">
            {/* Readiness hint (mirrors OCRReviewTable's guard banner). */}
            {unresolvedCount > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <IconAlertTriangle className="size-4 shrink-0" />
                <span>
                  {unresolvedCount} row{unresolvedCount !== 1 ? "s" : ""} still need a
                  match. Pick a {format === "team" ? "team" : "player"} or create a ghost
                  for each.
                </span>
              </div>
            )}

            {rows.length === 0 ? (
              <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                No rows were read from this screenshot. Close and try a clearer image.
              </p>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="h-10">
                      <TableHead className="text-xs text-foreground">Raw name</TableHead>
                      <TableHead className="w-24 text-xs text-foreground">
                        Placement
                      </TableHead>
                      <TableHead className="w-20 text-xs text-foreground">Kills</TableHead>
                      <TableHead className="w-24 text-xs text-foreground">
                        Confidence
                      </TableHead>
                      <TableHead className="text-xs text-foreground">
                        {format === "team" ? "Matched team" : "Matched player"}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow
                        key={row.row_id}
                        className={cn(row.resolution == null && "bg-destructive/5")}
                      >
                        {/* Raw OCR name (monospace so glyph errors are obvious) */}
                        <TableCell className="p-2">
                          <span className="font-mono text-xs">{row.raw_name}</span>
                        </TableCell>

                        {/* Editable placement */}
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            min="0"
                            value={row.placement || ""}
                            className="h-8 w-16 text-xs"
                            onChange={(e) => handlePlacementChange(row, e.target.value)}
                          />
                        </TableCell>

                        {/* Editable kills */}
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            min="0"
                            value={row.kills || ""}
                            className="h-8 w-16 text-xs"
                            onChange={(e) => handleKillsChange(row, e.target.value)}
                          />
                        </TableCell>

                        {/* Confidence badge */}
                        <TableCell className="p-2">{confidenceBadge(row)}</TableCell>

                        {/* Matched entity: candidate dropdown + free-search + create-ghost */}
                        <TableCell className="p-2">
                          <div className="flex flex-col gap-1.5">
                            <Select
                              value={selectValueFor(row)}
                              onValueChange={(v) => handleSelectChange(row, v)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue
                                  placeholder={
                                    format === "team"
                                      ? "Pick a team"
                                      : "Pick a player"
                                  }
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
                                {/* Free re-match + create-ghost markers */}
                                <SelectItem value={FREE_MATCH}>
                                  Search for another {format === "team" ? "team" : "player"}
                                </SelectItem>
                                <SelectItem value={MAKE_GHOST}>
                                  Create as ghost
                                </SelectItem>
                              </SelectContent>
                            </Select>

                            {/* Free re-match picker (team or solo), shown on demand. */}
                            {row.showFreeMatch &&
                              (format === "team" ? (
                                <TeamSearchSelect
                                  value={null}
                                  onChange={(id, team) =>
                                    handleFreeTeamPick(row, id, team)
                                  }
                                  placeholder="Search a team..."
                                />
                              ) : (
                                <UserSearchSelect
                                  value={null}
                                  onChange={(u, user) =>
                                    handleFreeUserPick(row, u, user)
                                  }
                                  placeholder="Search a player..."
                                />
                              ))}

                            {/* Inline ghost create (GhostCreateInline field shape). */}
                            {row.showGhostForm && (
                              <div className="space-y-2 rounded-md border bg-muted/30 p-2.5">
                                <div className="space-y-1">
                                  <Label className="text-xs">
                                    {format === "team"
                                      ? "Ghost team name"
                                      : "In-game name (IGN)"}
                                  </Label>
                                  <Input
                                    value={row.ghostName}
                                    onChange={(e) =>
                                      setRow(row.row_id, { ghostName: e.target.value })
                                    }
                                    placeholder={
                                      format === "team"
                                        ? "e.g. Team Phoenix"
                                        : "e.g. SkullKing"
                                    }
                                    className="h-8 text-xs"
                                  />
                                </div>
                                {format === "team" && (
                                  <div className="space-y-1">
                                    <Label className="text-xs">Country (optional)</Label>
                                    <Input
                                      value={row.ghostCountry}
                                      onChange={(e) =>
                                        setRow(row.row_id, {
                                          ghostCountry: e.target.value,
                                        })
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
                                    onClick={() =>
                                      setRow(row.row_id, { showGhostForm: false })
                                    }
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleSaveGhost(row)}
                                  >
                                    <IconUserPlus size={14} className="mr-1" />
                                    Use ghost
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Resolution summary chip: what this row will become on apply. */}
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
            )}
          </div>
        )}

        {/* ── Footer actions: Extract on stage 1, Apply on stage 2 ── */}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={extracting || applying}
          >
            Cancel
          </Button>

          {!hasDraft ? (
            <Button
              type="button"
              onClick={handleExtract}
              disabled={!file || extracting}
            >
              {extracting ? (
                <span className="flex items-center gap-2">
                  <IconLoader2 size={14} className="animate-spin" />
                  Reading screenshot...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <IconScan size={14} />
                  Read screenshot
                </span>
              )}
            </Button>
          ) : (
            <Button type="button" onClick={handleApply} disabled={!canApply}>
              {applying ? (
                <span className="flex items-center gap-2">
                  <IconLoader2 size={14} className="animate-spin" />
                  Applying...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <IconUpload size={14} />
                  Apply and create map
                </span>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
