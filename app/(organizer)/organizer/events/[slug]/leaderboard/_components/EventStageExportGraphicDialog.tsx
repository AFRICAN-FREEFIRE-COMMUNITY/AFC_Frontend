"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EventStageExportGraphicDialog
// ----------------------------------------------------------------------------
// "Export graphic" dialog for the organizer event leaderboard page. Lets a user
// pick a branded design + size and download a PNG of the selected stage's
// cumulative standings.
//
// FLOW: open -> fetch the org's design library (leaderboardDesignsApi.list) ->
// user picks design + size (YouTube default for events) + optional title/subtitle
// (prefilled with event name / stage name) -> Download calls
// leaderboardDesignsApi.downloadEventStageGraphic(eventId, stageId, {...}),
// which hits GET events/<eventId>/stages/<stageId>/graphic/ (auth Bearer, PNG
// response) -> object-URL the Blob, click a hidden <a download> to save it,
// then revoke the URL.
//
// AUTH: the request goes through axios with the auth_token cookie Bearer (set by
// authHeaders() in lib/http.ts). A plain <a href> would omit the token and 403.
//
// STRUCTURE: mirrors ExportGraphicButton in
// app/(a)/a/leaderboards/standalone/_components/ExportGraphicDialog.tsx exactly
// (same reset-on-open gate, same blob error decoder, same design dropdown + size
// picker + title/subtitle inputs, same AFC shadcn/sonner style).
//
// CONSUMED BY: app/(organizer)/organizer/events/[slug]/leaderboard/page.tsx
// (the "Export graphic" button in the Rankings card, visible when overall
// standings are shown). The page passes eventId + stageId (from the selected
// stage) + organizationId (the org that owns the event, for library scoping) +
// default title (event name) + default subtitle (stage name).
//
// DATA: leaderboardDesignsApi.list(organizationId) for the dropdown;
//       leaderboardDesignsApi.downloadEventStageGraphic(eventId, stageId, opts)
//       for the PNG fetch. Both live in lib/leaderboardDesigns.ts.
//
// Design: AFC constants - shadcn Dialog + Select + Input + Label, sonner toasts,
// Tabler icons, DM Sans, dark/green theme. No em dashes or en dashes.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { IconDownload, IconLoader2, IconPhoto } from "@tabler/icons-react";
import {
  leaderboardDesignsApi,
  type LeaderboardDesign,
  type GraphicSize,
} from "@/lib/leaderboardDesigns";

// Sentinel Select value meaning "let the backend use the library default design".
// A real design id is a stringified number; this distinguishes "none chosen" from id=0.
const AUTO = "auto";

// ── Props ─────────────────────────────────────────────────────────────────────
interface EventStageExportGraphicDialogProps {
  // The numeric (or string) event_id, passed to downloadEventStageGraphic.
  eventId: number | string;
  // The numeric (or string) stage_id for the stage whose standings to render.
  stageId: number | string;
  // The organization that owns this event. Used to scope the design library call
  // (leaderboardDesignsApi.list(organizationId)). Pass null/undefined to use the
  // AFC-native library (organization_id omitted from the query string).
  organizationId?: number | null;
  // Prefills the title field (typically the event name). User can edit or clear it.
  defaultTitle?: string;
  // Prefills the subtitle field (typically the stage name). User can edit or clear.
  defaultSubtitle?: string;
  // The element that opens the dialog. If omitted a default "Export graphic" button
  // is rendered. Providing a trigger lets the mount site control the button style.
  trigger?: React.ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function EventStageExportGraphicDialog({
  eventId,
  stageId,
  organizationId,
  defaultTitle = "",
  defaultSubtitle = "",
  trigger,
}: EventStageExportGraphicDialogProps) {
  const [open, setOpen] = useState(false);
  const [designs, setDesigns] = useState<LeaderboardDesign[]>([]);
  const [loadingDesigns, setLoadingDesigns] = useState(false);

  // ── Form state ────────────────────────────────────────────────────────────
  const [designId, setDesignId] = useState<string>(AUTO);
  // Events default to YouTube (landscape, 1920x1080) - better for broadcast/stream
  // graphics than standalone leaderboards which default to Instagram portrait.
  const [size, setSize] = useState<GraphicSize>("youtube");
  const [title, setTitle] = useState(defaultTitle);
  const [subtitle, setSubtitle] = useState(defaultSubtitle);
  const [downloading, setDownloading] = useState(false);

  // ── Load the org's design library when the dialog opens ───────────────────
  // Pre-selects the library-default design so the common case is one click.
  const loadDesigns = useCallback(async () => {
    setLoadingDesigns(true);
    try {
      const res = await leaderboardDesignsApi.list(organizationId ?? null);
      const rows = res?.results ?? [];
      setDesigns(rows);
      // Preselect the marked-default design (is_default: true). If none, fall back
      // to AUTO so the backend uses its own fallback (dark background).
      const def = rows.find((d) => d.is_default);
      setDesignId(def ? String(def.id) : AUTO);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load designs.");
    } finally {
      setLoadingDesigns(false);
    }
  }, [organizationId]);

  // ── Reset + load ONLY on the false->true open transition ──────────────────
  // A prevOpen ref guards against a parent re-render wiping form state the user
  // is editing mid-export. Mirror of ExportGraphicButton's gate pattern.
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      // Reset all form fields to their defaults on each new open.
      setTitle(defaultTitle);
      setSubtitle(defaultSubtitle);
      setSize("youtube");
      loadDesigns();
    }
    prevOpenRef.current = open;
  }, [open, defaultTitle, defaultSubtitle, loadDesigns]);

  // ── Download: fetch PNG blob via auth-gated axios call + save ─────────────
  // downloadEventStageGraphic hits GET events/<eventId>/stages/<stageId>/graphic/
  // with the params serialised as query strings. The backend returns a PNG blob.
  // We object-URL it and click a hidden <a download> to trigger save-as.
  const onDownload = async () => {
    setDownloading(true);
    try {
      const blob = await leaderboardDesignsApi.downloadEventStageGraphic(
        eventId,
        stageId,
        {
          designId: designId === AUTO ? null : Number(designId),
          size,
          title: title.trim(),
          subtitle: subtitle.trim(),
        },
      );

      // Object-URL the blob and trigger a save-as via a transient anchor element.
      // Revoke the URL immediately after the click to avoid memory leaks.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe = (title.trim() || defaultTitle || "leaderboard").replace(
        /[^a-z0-9\-_ ]/gi,
        "",
      );
      a.download = `${safe}-${size}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("Graphic downloaded.");
    } catch (err: any) {
      // Blob error responses carry JSON inside the blob body, not as parsed JSON.
      // We decode the blob text manually to read the backend's message field.
      let message = "Failed to export the graphic.";
      const data = err?.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          message = JSON.parse(text)?.message || message;
        } catch {
          /* keep the default message */
        }
      } else if (data?.message) {
        message = data.message;
      }
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Trigger element - either the caller's custom node or a default button. */}
      {trigger ? (
        <div onClick={() => setOpen(true)} className="contents">
          {trigger}
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <IconDownload className="size-4" /> Export graphic
        </Button>
      )}

      <Dialog open={open} onOpenChange={(o) => !downloading && setOpen(o)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Export leaderboard graphic</DialogTitle>
            <DialogDescription>
              Render the current stage standings onto a branded design and
              download it as an image.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* ── Design picker ────────────────────────────────────────────
                Lists the org's design library. "Default / plain background"
                lets the backend choose the library default (or plain dark). */}
            <div className="space-y-2">
              <Label>Design</Label>
              <Select value={designId} onValueChange={setDesignId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a design" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO}>Default / plain background</SelectItem>
                  {designs.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                      {d.is_default ? " (default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingDesigns ? (
                <p className="text-xs text-muted-foreground">
                  Loading designs...
                </p>
              ) : designs.length === 0 ? (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <IconPhoto className="size-3" />
                  No designs yet. Add one in the Leaderboard designs section to
                  brand the export.
                </p>
              ) : null}
            </div>

            {/* ── Size picker - YouTube landscape vs Instagram portrait ─── */}
            <div className="space-y-2">
              <Label>Size</Label>
              <Select
                value={size}
                onValueChange={(v) => setSize(v as GraphicSize)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">YouTube (1920 x 1080)</SelectItem>
                  <SelectItem value="instagram">
                    Instagram (1080 x 1350)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ── Title (prefilled with event name) ───────────────────────
                The backend uses this as the graphic's headline text. */}
            <div className="space-y-2">
              <Label htmlFor="event-export-title">Title</Label>
              <Input
                id="event-export-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title"
              />
            </div>

            {/* ── Subtitle (prefilled with stage name) ────────────────────
                Shown beneath the title; identifies the stage/round. */}
            <div className="space-y-2">
              <Label htmlFor="event-export-subtitle">
                Subtitle{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="event-export-subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. Group Stage - Round 1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={downloading}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button disabled={downloading} onClick={onDownload}>
              {downloading ? (
                <IconLoader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <IconDownload className="mr-1 size-4" />
              )}
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
