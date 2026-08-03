"use client";

// MatchEvidencePanel - surfaces the STORED evidence for one map so an admin or organizer can re-check a
// disputed result later (owner 2026-07-07 "store the match files ... so it can be checked later if
// needed"). For the selected map it fetches:
//   • the .log RESULT FILES the scoring upload retained  -> POST /events/match-result-logs/ {match_id}
//     (backend get_match_result_logs, model MatchResultLog),
//   • the OCR / manual SCREENSHOTS                        -> POST /events/get-match-result-images/ {match_id}
//     (backend get_match_result_images, model MatchResultImage).
// Both reads use the same event-scoped auth as the rest of the results editor (AFC event admin OR an org
// member with can_upload_results). Delete is gated behind `canManage` and hits the matching delete
// endpoints. Renders NOTHING when a map has no stored files (the common manual-entry case) so the editor
// stays clean; the card only appears when there is evidence to show (or while loading).
//
// Mounted under <MatchResultsGrid> by BOTH result editors:
//   • admin     app/(a)/a/leaderboards/[id]/edit/page.tsx      (selectedMatchId, English defaults)
//   • organizer app/(organizer)/organizer/events/[slug]/leaderboard/page.tsx (gridMatchId, t() labels)

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  IconDownload,
  IconFileText,
  IconLoader2,
  IconPhoto,
  IconTrash,
} from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";

// i18n copy. The admin passes none (English defaults below); the organizer passes t()-resolved strings.
export interface MatchEvidenceLabels {
  title: string;
  logsHeading: string;
  imagesHeading: string;
  download: string;
  deleteLabel: string;
  deleted: string;
  loadError: string;
  deleteError: string;
}

const DEFAULT_LABELS: MatchEvidenceLabels = {
  title: "Stored match files",
  logsHeading: "Result files",
  imagesHeading: "Screenshots",
  download: "Download",
  deleteLabel: "Delete",
  deleted: "File deleted.",
  loadError: "Failed to load stored files",
  deleteError: "Failed to delete file",
};

interface LogRow {
  log_id: number;
  file_url: string | null;
  file_name: string;
  uploaded_by: string | null;
  uploaded_at: string;
}
interface ImgRow {
  image_id: number;
  image_url: string;
  note: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface MatchEvidencePanelProps {
  /** Numeric id of the selected map (null = none selected -> renders nothing). */
  matchId: number | null;
  /** Session token for the Bearer header (same token the editor already holds; null before auth). */
  token: string | null;
  /** Show the per-file Delete control (managers only). */
  canManage?: boolean;
  labels?: Partial<MatchEvidenceLabels>;
}

// Short, locale-agnostic "DD Mon YYYY, HH:MM" so the audit row is readable without pulling in a date lib
// (the editor is admin/organizer surface; the viewer-timezone LocalTime rule targets player-facing UI).
function fmt(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MatchEvidencePanel({
  matchId,
  token,
  canManage = false,
  labels,
}: MatchEvidencePanelProps) {
  const L: MatchEvidenceLabels = { ...DEFAULT_LABELS, ...labels };
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [images, setImages] = useState<ImgRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Load both evidence lists whenever the selected map changes. Parallel fetch; a failed side just
  // shows empty (the panel is best-effort read-only history, never blocks the editor).
  const load = useCallback(async () => {
    if (matchId === null || !token) {
      setLogs([]);
      setImages([]);
      return;
    }
    setLoading(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
      const [logRes, imgRes] = await Promise.all([
        fetch(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/match-result-logs/`, {
          method: "POST",
          headers,
          body: JSON.stringify({ match_id: matchId }),
        }),
        fetch(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-match-result-images/`, {
          method: "POST",
          headers,
          body: JSON.stringify({ match_id: matchId }),
        }),
      ]);
      setLogs(logRes.ok ? ((await logRes.json()).logs ?? []) : []);
      setImages(imgRes.ok ? ((await imgRes.json()).images ?? []) : []);
    } catch {
      toast.error(L.loadError);
    } finally {
      setLoading(false);
    }
    // L intentionally omitted: it is derived from a prop each render and would re-fetch needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const deleteLog = async (logId: number) => {
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/match-result-logs/delete/`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ log_id: logId }),
        },
      );
      if (!res.ok) throw new Error();
      toast.success(L.deleted);
      setLogs((prev) => prev.filter((l) => l.log_id !== logId));
    } catch {
      toast.error(L.deleteError);
    }
  };

  const deleteImage = async (imageId: number) => {
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/delete-match-result-image/`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ image_id: imageId }),
        },
      );
      if (!res.ok) throw new Error();
      toast.success(L.deleted);
      setImages((prev) => prev.filter((i) => i.image_id !== imageId));
    } catch {
      toast.error(L.deleteError);
    }
  };

  // No map selected / not authed, or the map has no stored evidence at all: render nothing.
  if (matchId === null || !token) return null;
  if (!loading && logs.length === 0 && images.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <IconFileText size={16} className="text-primary" />
          {L.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <IconLoader2 size={14} className="animate-spin" />
          </div>
        )}

        {/* Result .log files (the scoring source of truth for this map). */}
        {logs.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {L.logsHeading}
            </p>
            <ul className="space-y-1">
              {logs.map((lg) => (
                <li
                  key={lg.log_id}
                  className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs"
                >
                  <IconFileText size={14} className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate" title={lg.file_name}>
                    {lg.file_name}
                  </span>
                  <span className="hidden shrink-0 text-muted-foreground sm:inline">
                    {fmt(lg.uploaded_at)}
                    {lg.uploaded_by ? ` · ${lg.uploaded_by}` : ""}
                  </span>
                  {lg.file_url && (
                    <a
                      href={lg.file_url}
                      download={lg.file_name}
                      className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
                    >
                      <IconDownload size={14} />
                      {L.download}
                    </a>
                  )}
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-destructive hover:bg-destructive/10"
                      onClick={() => deleteLog(lg.log_id)}
                      title={L.deleteLabel}
                    >
                      <IconTrash size={13} />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* OCR / manual screenshots retained for this map. */}
        {images.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {L.imagesHeading}
            </p>
            <div className="flex flex-wrap gap-2">
              {images.map((img) => (
                <div key={img.image_id} className="group relative">
                  <a href={img.image_url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.image_url}
                      alt={img.note || "match screenshot"}
                      className="h-20 w-20 rounded-md border object-cover transition hover:opacity-80"
                    />
                  </a>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0.5 top-0.5 h-5 w-5 bg-background/80 text-destructive opacity-0 transition group-hover:opacity-100"
                      onClick={() => deleteImage(img.image_id)}
                      title={L.deleteLabel}
                    >
                      <IconTrash size={12} />
                    </Button>
                  )}
                </div>
              ))}
              <span className="sr-only">
                <IconPhoto size={12} />
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
