"use client";

// ── GroupBulkUploadPanel ──────────────────────────────────────────────────────
// Bulk "upload multiple results for several maps at once" for one stage GROUP.
//
// Flow (the layout the user picked): ONE dropzone for many screenshots, then assign
// each dropped file to a map via a per-file Map selector, then "Upload + OCR all".
// On submit we group the assigned files by map and fire ONE existing per-map call
// (POST /events/upload-match-result-image/, multipart {match_id, images[]}) per map
// via Promise.allSettled. That endpoint already runs the full OCR -> name-match ->
// score -> save pipeline server-side per map (afc_tournament_and_scrims.views.
// upload_match_result_image), so a single call per map fully enters that map's
// results. No new backend endpoint is needed; org members with can_upload_results are
// already authorized on that endpoint (the gating shipped earlier).
//
// Used by BOTH the AFC admin leaderboard editor (a/leaderboards/[id]/edit Upload tab)
// and the organizer leaderboard page (organizer/events/[slug]/leaderboard), so the
// two surfaces share one bulk-upload implementation.
//
// Props:
//   matches    - the group's maps ({ match_id, match_number, match_map }).
//   apiBase    - NEXT_PUBLIC_BACKEND_API_URL.
//   token      - Bearer token (AuthContext) for authorization.
//   onComplete - called after a successful (or partial) upload so the parent refetches.

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconUpload,
  IconLoader2,
  IconX,
  IconPhoto,
} from "@tabler/icons-react";

interface MapOption {
  match_id: number;
  match_number: number;
  match_map: string;
}

// One queued screenshot + the map the admin assigned it to ("" = unassigned).
interface PendingFile {
  id: string;
  file: File;
  matchId: string; // stringified match_id, "" until assigned
}

export function GroupBulkUploadPanel({
  matches,
  apiBase,
  token,
  onComplete,
  groupName,
}: {
  matches: MapOption[];
  apiBase: string;
  token: string | null | undefined;
  onComplete: () => void;
  // The group these uploads belong to. Shown in the header so it is unmistakably
  // GROUP-scoped (not stage-scoped) - the maps in the assign dropdown are only this
  // group's maps.
  groupName?: string;
}) {
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mapLabel = (m: MapOption) =>
    `Match ${m.match_number}${m.match_map ? ` (${m.match_map})` : ""}`;

  // Add dropped/selected files to the queue. If there is exactly one map in the group,
  // pre-assign every file to it (the common single-map case) to save clicks.
  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const defaultMatch = matches.length === 1 ? String(matches[0].match_id) : "";
    const next: PendingFile[] = Array.from(files).map((file, i) => ({
      id: `${file.name}-${file.size}-${i}-${pending.length}`,
      file,
      matchId: defaultMatch,
    }));
    setPending((prev) => [...prev, ...next]);
  };

  const assignMap = (id: string, matchId: string) =>
    setPending((prev) =>
      prev.map((p) => (p.id === id ? { ...p, matchId } : p)),
    );

  const removeFile = (id: string) =>
    setPending((prev) => prev.filter((p) => p.id !== id));

  const handleUploadAll = async () => {
    const assigned = pending.filter((p) => p.matchId);
    if (assigned.length === 0) {
      toast.error("Assign each screenshot to a map first.");
      return;
    }

    // Group the assigned files by map so each map gets ONE multipart upload call.
    const byMatch = new Map<string, File[]>();
    for (const p of assigned) {
      const list = byMatch.get(p.matchId) ?? [];
      list.push(p.file);
      byMatch.set(p.matchId, list);
    }

    setUploading(true);
    try {
      const entries = Array.from(byMatch.entries());
      const results = await Promise.allSettled(
        entries.map(async ([matchId, files]) => {
          const fd = new FormData();
          fd.append("match_id", matchId);
          files.forEach((f) => fd.append("images", f));
          const res = await fetch(`${apiBase}/events/upload-match-result-image/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || err.detail || "Upload failed");
          }
          return res.json();
        }),
      );

      const failed = results.filter((r) => r.status === "rejected").length;
      const ok = entries.length - failed;
      // Sum any OCR rows the backend could not match to a registered player/team so the
      // admin knows to fix those by hand.
      const unmatched = results.reduce((acc, r) => {
        if (r.status === "fulfilled") {
          const u = (r.value as any)?.unmatched;
          return acc + (Array.isArray(u) ? u.length : 0);
        }
        return acc;
      }, 0);

      if (failed > 0) {
        toast.warning(
          `Uploaded ${ok} of ${entries.length} maps. ${failed} failed.` +
            (unmatched ? ` ${unmatched} name(s) need manual matching.` : ""),
        );
      } else {
        toast.success(
          `Uploaded + scored ${ok} map${ok !== 1 ? "s" : ""}.` +
            (unmatched ? ` ${unmatched} name(s) need manual matching.` : ""),
        );
      }
      setPending([]);
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "Bulk upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const unassignedCount = pending.filter((p) => !p.matchId).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Upload results{groupName ? ` for group: ${groupName}` : " (this group)"}
        </CardTitle>
        <CardDescription>
          Drop result screenshots for this group&apos;s maps, assign each to its map,
          then upload them all at once. Each map is read by OCR and scored
          automatically. This only affects {groupName ? `group ${groupName}` : "this group"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dropzone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
          className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-10 cursor-pointer hover:bg-muted/40 transition-colors text-center"
        >
          <IconUpload size={26} className="text-muted-foreground" />
          <p className="text-sm font-medium">
            Drop screenshots here, or click to choose
          </p>
          <p className="text-xs text-muted-foreground">
            One or more images per map. PNG or JPG.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              // allow re-selecting the same file again later
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
        </div>

        {/* Queued files, each with a map assignment */}
        {pending.length > 0 && (
          <div className="space-y-2">
            {pending.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 border rounded-md p-2"
              >
                <IconPhoto size={18} className="text-muted-foreground shrink-0" />
                <span className="text-sm truncate flex-1" title={p.file.name}>
                  {p.file.name}
                </span>
                <Select
                  value={p.matchId}
                  onValueChange={(v) => assignMap(p.id, v)}
                >
                  <SelectTrigger className="h-8 w-44">
                    <SelectValue placeholder="Assign to map" />
                  </SelectTrigger>
                  <SelectContent>
                    {matches.map((m) => (
                      <SelectItem key={m.match_id} value={String(m.match_id)}>
                        {mapLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => removeFile(p.id)}
                  aria-label="Remove file"
                >
                  <IconX size={16} />
                </Button>
              </div>
            ))}

            {unassignedCount > 0 && (
              <p className="text-xs text-orange-500">
                {unassignedCount} file{unassignedCount !== 1 ? "s" : ""} still need a
                map assignment.
              </p>
            )}

            <div className="flex justify-end">
              <Button onClick={handleUploadAll} disabled={uploading}>
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <IconLoader2 size={14} className="animate-spin" />
                    Uploading…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <IconUpload size={14} />
                    Upload + OCR all maps
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
