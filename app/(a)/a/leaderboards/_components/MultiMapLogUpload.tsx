"use client";

// MultiMapLogUpload — upload ALL maps' Free Fire match-log (.log) files for an event at once
// (owner 2026-06-22; SOLO support + drag-and-drop added 2026-06-25). Each .log file is ONE map;
// the game exports one per map.
//
// FLOW (owner decisions): PER-FILE MAP PICKER + REVIEW-EACH-THEN-APPLY.
//   1. DROP (or click) N .log files. Each is auto-assigned to the next free match in the current
//      group; the admin can re-pick the match per file (the .log filename is only a timestamp, so
//      the map can't be auto-detected from it).
//   2. "Review" runs a DRY-RUN per file (dry_run=true) that parses + attributes WITHOUT saving, so
//      each map shows a summary (teams/rows found, players credited, flagged/unmatched) first.
//   3. "Apply all" re-posts each file WITHOUT dry_run (the real, idempotent save), then calls
//      onChanged() so the leaderboard + standings + Flagged-kills panel refresh.
//
// REUSE: the entire parse/attribute/flag/score pipeline is the existing single-map endpoint
// (upload_team_match_result for team events, upload_solo_match_result for solo). This component just
// drives the right one once per file. No new backend beyond the dry_run flag (both endpoints now
// support it). English copy (operational admin/organizer tool, like FileUploadStep) — not i18n'd.
//
// COMPONENTS:
//   • MultiMapLogPanel  — the reusable inner UI (dropzone + per-file rows + Review/Apply), NO Dialog.
//     Reused inline inside FileUploadStep's "All maps at once" mode (the 3D Room File picker option).
//   • MultiMapLogUpload — a thin Dialog+button wrapper around the panel; mounted standalone on the
//     admin event leaderboard (app/(a)/a/leaderboards/[id]) and the organizer one
//     (app/(organizer)/.../leaderboard), fed the current group's matches.
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconUpload,
  IconFile,
  IconX,
  IconLoader2,
  IconCircleCheck,
  IconAlertTriangle,
  IconStack2,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";
import { toast } from "sonner";

export interface MatchOption {
  match_id: number;
  match_number: number;
  match_map?: string | null;
}

type RowStatus =
  | "pending"
  | "reviewing"
  | "reviewed"
  | "applying"
  | "applied"
  | "error";

interface FileRow {
  id: string; // stable per-file id (React key) so mid-list removal doesn't shift keys
  file: File;
  matchId: string; // selected match_id as string (Select value); "" = unassigned
  status: RowStatus;
  preview?: {
    // Normalised across team + solo response shapes (see uploadOne). `parsed` = teams (team) or
    // rows (solo); `saved` = players credited/saved; `unmatched` = flagged/unknown (team) or
    // missing registered competitors (solo).
    parsed: number;
    saved: number;
    unmatched: number;
  };
  error?: string;
}

const matchLabel = (m: MatchOption) =>
  `Match ${m.match_number}${m.match_map ? ` (${m.match_map})` : ""}`;

// ── MultiMapLogPanel ───────────────────────────────────────────────────────────
// The reusable upload surface (no Dialog chrome). Used both inside the standalone dialog
// (MultiMapLogUpload) and inline inside FileUploadStep's "All maps at once" mode. participantType
// selects the backend endpoint + tunes the summary labels.
export function MultiMapLogPanel({
  matches,
  token,
  participantType = "team",
  canManage = true,
  onChanged,
  onClose,
}: {
  /** The current group's matches (map slots) the files can be assigned to. */
  matches: MatchOption[];
  token: string | null;
  /** "team" -> upload-team-match-result; "solo" -> upload-solo-match-result. */
  participantType?: "team" | "solo";
  canManage?: boolean;
  onChanged?: () => void;
  /** Called after a fully-successful apply (the dialog wrapper uses it to close itself). */
  onClose?: () => void;
}) {
  const [rows, setRows] = useState<FileRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isSolo = participantType === "solo";

  const validMatches = (matches || []).filter(
    (m) => typeof m?.match_id === "number",
  );

  // Add files, auto-assigning each to the next match not already used by another row.
  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setRows((prev) => {
      const used = new Set(prev.map((r) => r.matchId).filter(Boolean));
      const avail = validMatches.filter((m) => !used.has(String(m.match_id)));
      let ai = 0;
      const added: FileRow[] = Array.from(fileList).map((f) => {
        const m = avail[ai++];
        return {
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `${f.name}-${f.size}-${f.lastModified}-${ai}`,
          file: f,
          matchId: m ? String(m.match_id) : "",
          status: "pending" as RowStatus,
        };
      });
      return [...prev, ...added];
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  // Native HTML5 file drop (no library). Mirrors the OCR image dropzones (ImageUploadStep). We do
  // NOT filter by type here — .log/.txt exports have no reliable MIME, and the backend validates.
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (busy || validMatches.length === 0) return;
    addFiles(e.dataTransfer.files);
  };

  const setRowMatch = (idx: number, matchId: string) =>
    setRows((rs) =>
      rs.map((r, i) =>
        i === idx
          ? { ...r, matchId, status: "pending", preview: undefined, error: undefined }
          : r,
      ),
    );

  const removeRow = (idx: number) =>
    setRows((rs) => rs.filter((_, i) => i !== idx));

  // Validate every row has a match + no two files target the same match.
  const validate = (): string | null => {
    if (rows.length === 0) return "Add at least one .log file.";
    if (rows.some((r) => !r.matchId)) return "Assign a match to every file.";
    const ids = rows.map((r) => r.matchId);
    if (new Set(ids).size !== ids.length)
      return "Two files target the same match. Each map needs its own match.";
    return null;
  };

  const uploadOne = async (row: FileRow, dryRun: boolean) => {
    const fd = new FormData();
    fd.append("match_id", row.matchId);
    fd.append("file", row.file);
    fd.append("file_type", "match_result_file");
    if (dryRun) fd.append("dry_run", "true");
    // Solo + team use different endpoints but the SAME multipart shape + dry_run contract.
    const endpoint = isSolo
      ? `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/upload-solo-match-result/`
      : `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/upload-team-match-result/`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.detail || "Upload failed");
    return data;
  };

  // Normalise the two response shapes into the row preview. Team returns parsed_teams/saved_players/
  // unmatched_count; solo returns parsed_rows/saved_rows/missing_count.
  const toPreview = (d: any) => ({
    parsed: (isSolo ? d.parsed_rows : d.parsed_teams) ?? 0,
    saved: (isSolo ? d.saved_rows : d.saved_players) ?? 0,
    unmatched: (isSolo ? d.missing_count : d.unmatched_count) ?? 0,
  });

  // Run a sequential pass over every row (dry-run preview OR real apply), updating each row's status.
  const runPass = async (dryRun: boolean) => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    let ok = 0;
    for (let i = 0; i < rows.length; i++) {
      // On a re-run of "Apply all" (after fixing an errored row) don't re-POST maps that already
      // applied — the backend is idempotent per match, but this skips redundant writes + autocomplete.
      // Review always re-runs every row.
      if (!dryRun && rows[i].status === "applied") {
        ok++;
        continue;
      }
      setRows((rs) =>
        rs.map((r, j) =>
          j === i ? { ...r, status: dryRun ? "reviewing" : "applying" } : r,
        ),
      );
      try {
        const d = await uploadOne(rows[i], dryRun);
        ok++;
        setRows((rs) =>
          rs.map((r, j) =>
            j === i
              ? {
                  ...r,
                  status: dryRun ? "reviewed" : "applied",
                  error: undefined,
                  preview: toPreview(d),
                }
              : r,
          ),
        );
      } catch (e: any) {
        setRows((rs) =>
          rs.map((r, j) =>
            j === i
              ? { ...r, status: "error", error: e?.message || "Upload failed" }
              : r,
          ),
        );
      }
    }
    setBusy(false);
    const failed = rows.length - ok;
    if (!dryRun && ok > 0) {
      toast.success(
        `Applied ${ok} map${ok === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}.`,
      );
      onChanged?.();
      if (failed === 0) {
        setRows([]);
        onClose?.();
      }
    } else if (dryRun && ok > 0) {
      toast.success(
        `Reviewed ${ok}/${rows.length} map${rows.length === 1 ? "" : "s"}${
          failed ? `, ${failed} failed` : ""
        }. Check each, then Apply all.`,
      );
    }
  };

  const allReviewed = rows.length > 0 && rows.every((r) => r.status === "reviewed");

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-3">
        {/* File picker + drag-and-drop zone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (!busy && validMatches.length > 0) fileRef.current?.click();
          }}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !busy && validMatches.length > 0) {
              e.preventDefault();
              fileRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy && validMatches.length > 0) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex w-full flex-col items-center gap-1 rounded-lg border border-dashed p-5 text-muted-foreground transition-colors",
            busy || validMatches.length === 0
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer",
            isDragging
              ? "border-primary bg-primary/5 text-primary"
              : "hover:border-primary/60 hover:text-primary",
          )}
        >
          <IconUpload size={22} />
          <span className="text-sm font-medium">
            Drag &amp; drop .log files here, or click to browse
          </span>
          <span className="text-xs">One file per map, add several at once</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".log,.txt,text/plain"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />

        {/* Rows: one per file */}
        {rows.map((row, idx) => (
          <div key={row.id} className="rounded-lg border p-3 text-xs">
            <div className="flex items-center gap-2">
              <IconFile size={16} className="shrink-0 text-primary" />
              <span className="flex-1 truncate font-medium">{row.file.name}</span>
              <RowStatusBadge status={row.status} />
              {!busy && (
                <button
                  onClick={() => removeRow(idx)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove file"
                >
                  <IconX size={14} />
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-muted-foreground">Map / match:</span>
              <Select
                value={row.matchId}
                onValueChange={(v) => setRowMatch(idx, v)}
                disabled={busy}
              >
                <SelectTrigger className="h-8 w-[220px] text-xs">
                  <SelectValue placeholder="Select a match" />
                </SelectTrigger>
                <SelectContent>
                  {validMatches.map((m) => (
                    <SelectItem key={m.match_id} value={String(m.match_id)}>
                      {matchLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Per-map review summary (after dry-run). Labels adapt to team vs solo. */}
            {row.preview && row.status !== "error" && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="rounded-full">
                  {row.preview.parsed} {isSolo ? "rows" : "teams"} in file
                </Badge>
                <Badge variant="outline" className="rounded-full border-primary text-primary">
                  {row.preview.saved} players {isSolo ? "saved" : "matched"}
                </Badge>
                {row.preview.unmatched > 0 && (
                  <Badge
                    variant="outline"
                    className="rounded-full border-amber-500 text-amber-600"
                  >
                    {row.preview.unmatched} {isSolo ? "unmatched" : "flagged / unknown"}
                  </Badge>
                )}
              </div>
            )}

            {row.status === "error" && row.error && (
              <p className="mt-2 flex items-center gap-1 text-destructive">
                <IconAlertTriangle size={13} /> {row.error}
              </p>
            )}
          </div>
        ))}

        {rows.length === 0 && (
          <p className="py-2 text-center text-xs text-muted-foreground">
            No files added yet.
          </p>
        )}
        {validMatches.length === 0 && (
          <p className="text-center text-xs text-amber-600">
            This group has no match slots yet. Create the maps first, then upload.
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
        <span className="text-xs text-muted-foreground">
          {rows.length} file{rows.length === 1 ? "" : "s"}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => runPass(true)}
            disabled={busy || rows.length === 0 || !canManage || validMatches.length === 0}
          >
            {busy ? <IconLoader2 size={16} className="animate-spin" /> : "Review"}
          </Button>
          <Button
            onClick={() => runPass(false)}
            disabled={busy || rows.length === 0 || !canManage || validMatches.length === 0}
            title={allReviewed ? "" : "Tip: Review first to preview matches"}
          >
            {busy ? (
              <span className="flex items-center gap-2">
                <IconLoader2 size={16} className="animate-spin" /> Applying…
              </span>
            ) : (
              <>
                <IconCircleCheck size={16} /> Apply all
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── MultiMapLogUpload ────────────────────────────────────────────────────────
// Standalone Dialog + trigger button wrapper around MultiMapLogPanel. Mounted on the admin +
// organizer leaderboard surfaces as a top-level "Upload all maps (.log)" shortcut.
export function MultiMapLogUpload({
  matches,
  token,
  participantType = "team",
  canManage = true,
  onChanged,
}: {
  matches: MatchOption[];
  token: string | null;
  participantType?: "team" | "solo";
  canManage?: boolean;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!canManage}>
          <IconStack2 size={16} /> Upload all maps (.log)
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Upload all maps at once</DialogTitle>
          <DialogDescription>
            Drop every map&apos;s match-log (.log) file. Assign each to its match, review what
            matched, then apply them all. Kills are attributed by in-game UID and standings recompute.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {/* key=open remounts the panel each time the dialog opens, so a previous session's rows
              are cleared. onClose closes the dialog after a fully-successful apply. */}
          <MultiMapLogPanel
            key={open ? "open" : "closed"}
            matches={matches}
            token={token}
            participantType={participantType}
            canManage={canManage}
            onChanged={onChanged}
            onClose={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RowStatusBadge({ status }: { status: RowStatus }) {
  const map: Record<RowStatus, { label: string; cls: string }> = {
    pending: { label: "Ready", cls: "text-muted-foreground" },
    reviewing: { label: "Reviewing…", cls: "text-muted-foreground" },
    reviewed: { label: "Reviewed", cls: "border-primary text-primary" },
    applying: { label: "Applying…", cls: "text-muted-foreground" },
    applied: { label: "Applied", cls: "border-primary text-primary" },
    error: { label: "Error", cls: "border-destructive text-destructive" },
  };
  const s = map[status];
  return (
    <Badge variant="outline" className={`rounded-full text-[10px] ${s.cls}`}>
      {s.label}
    </Badge>
  );
}
