"use client";

// ── ResultFileDialog ──────────────────────────────────────────────────────────
// The "upload result file" option for standalone leaderboards (owner 2026-06-12: every upload
// option the event flow has must exist here too). The admin/organizer picks the game's match-log
// TEXT export, the backend parses it synchronously (no Gemini, no background job) into the SAME
// review rows the OCR flow produces - players resolve EXACTLY by their UID at 100% confidence -
// and the proven OcrReviewTable handles correction + "Apply this map" exactly like a screenshot read.
//
// HOW IT CONNECTS
//   - POST /<id>/results-file/ (standaloneLeaderboardsApi.resultsFileExtract) -> review rows.
//   - OcrReviewTable renders the rows (per-player panel, points preview via `scoring`).
//   - Apply goes through the existing POST /<id>/ocr/apply/ (ocrApply) with the chosen map label,
//     then onApplied(result) merges the map + participants into the wizard (same as OcrBatchDialog).
//   - Opened from ParticipantsStep's "Upload result file" button. TEAM leaderboards only (the file
//     format is team-shaped; the backend 400s solo, and ParticipantsStep hides the button for solo).
// DESIGN: AFC constants - rounded-md panels, text-xs, outline badges. No em/en dashes.

import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconCircleCheck, IconFileText, IconLoader2, IconX } from "@tabler/icons-react";
import {
  standaloneLeaderboardsApi,
  type OcrApplyResponse,
  type OcrApplyRow,
  type OcrExtractRow,
} from "@/lib/standaloneLeaderboards";
import { OcrReviewTable, type OcrScoring } from "./OcrReviewTable";
import { FF_MAPS } from "./OcrBatchDialog";

export function ResultFileDialog({
  open,
  onOpenChange,
  leaderboardId,
  scoring,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaderboardId: number;
  // Scoring config for the review table's Points preview (same thread as OcrBatchDialog).
  scoring?: OcrScoring;
  // Fired after the reviewed rows are applied as a map (the wizard merges match + participants).
  onApplied: (result: OcrApplyResponse) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [mapLabel, setMapLabel] = useState("");
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<OcrExtractRow[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  // Reset everything so "upload another file" starts clean (also runs when the dialog closes).
  const reset = () => {
    setFileName("");
    setRows(null);
    setApplying(false);
    setApplied(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  // Parse on file pick: the endpoint is synchronous (regex parse, no OCR engine), so no job/poll.
  const handleFile = async (file: File | null) => {
    if (!file) return;
    setParsing(true);
    setFileName(file.name);
    try {
      const res = await standaloneLeaderboardsApi.resultsFileExtract(leaderboardId, file);
      setRows(res.rows);
      setApplied(false);
      toast.success(`Parsed ${res.rows.length} placements from ${file.name}.`);
    } catch (err: any) {
      setRows(null);
      toast.error(err?.response?.data?.message || "Could not parse this file.");
    } finally {
      setParsing(false);
    }
  };

  // Same apply contract as the OCR dialogs: one map + participants + results in one call.
  const handleApply = async (applyRows: OcrApplyRow[]) => {
    setApplying(true);
    try {
      const result = await standaloneLeaderboardsApi.ocrApply(leaderboardId, {
        ...(mapLabel ? { match_map: mapLabel } : {}),
        rows: applyRows,
      });
      setApplied(true);
      toast.success("Map applied from the result file.");
      onApplied(result);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to apply the reviewed rows.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Same wide shell as OcrBatchDialog: the review table needs every column visible. */}
      <DialogContent className="w-[95vw] sm:max-w-7xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconFileText size={18} className="text-muted-foreground" />
            Upload a result file
          </DialogTitle>
          <DialogDescription>
            Pick the match-log file the game exports for a match. Players are identified exactly by
            their in-game ID, so most rows arrive pre-matched; review and apply like a screenshot read.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Map label + file pick row. */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={mapLabel} onValueChange={setMapLabel}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select map (optional)" />
              </SelectTrigger>
              <SelectContent>
                {FF_MAPS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.log,text/plain"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={parsing}
              onClick={() => fileInputRef.current?.click()}
            >
              {parsing ? (
                <span className="flex items-center gap-2">
                  <IconLoader2 size={14} className="animate-spin" />
                  Parsing...
                </span>
              ) : (
                "Choose result file"
              )}
            </Button>

            {fileName && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <IconFileText size={13} />
                {fileName}
                {!applied && (
                  <button
                    type="button"
                    aria-label="Clear file"
                    className="rounded-full p-0.5 hover:bg-muted"
                    onClick={reset}
                  >
                    <IconX size={12} />
                  </button>
                )}
              </span>
            )}
            {applied && (
              <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                <IconCircleCheck size={14} />
                Applied
              </span>
            )}
          </div>

          {/* Review + apply: the SAME table the OCR flow uses (per-player panel, points preview). */}
          {rows && (
            <OcrReviewTable
              key={fileName}
              format="team"
              rows={rows}
              applied={applied}
              applying={applying}
              scoring={scoring}
              onApply={handleApply}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
