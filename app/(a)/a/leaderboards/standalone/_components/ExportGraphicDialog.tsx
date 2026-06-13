"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ExportGraphicButton - the "Export graphic" picker on the standalone leaderboard view.
// ----------------------------------------------------------------------------
// A button + dialog that lets a manager render the live standings onto one of their
// branded designs and download it as a PNG. Mounted in the PageHeader action slot of
// the shared StandaloneLeaderboardView, so BOTH the admin and organizer view pages get it.
//
// FLOW: open -> fetch the leaderboard's design LIBRARY (org-scoped, or AFC-native when the
// leaderboard has no org) -> the user picks a design + a size (Instagram 1080x1350 or YouTube
// 1920x1080) + an optional title (prefilled with the leaderboard name) + an optional subtitle
// (the stage/group played) -> Download calls leaderboardDesignsApi.downloadGraphic, which hits
// GET leaderboards/standalone/<id>/graphic/ (manager-gated, so it goes through axios with the
// Bearer + responseType blob, NOT a plain <a href> that would omit the token) -> we object-URL the
// blob and click a hidden <a download> to save it.
//
// DATA: leaderboardDesignsApi (lib/leaderboardDesigns.ts). The design list reuses the same library
// CRUD the LeaderboardDesignsManager card writes to, so a design added there shows up here.
//
// Design: AFC constants - shadcn Dialog + Select, outline buttons, sonner toasts. No em/en dashes.
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

// Sentinel Select value for "let the backend use the library default". A real design id is the
// stringified number; this constant is the catch-all so the user need not have a design at all.
const AUTO = "auto";

export function ExportGraphicButton({
  lbId,
  organizationId,
  defaultTitle,
}: {
  lbId: number | string;
  // The leaderboard's org id (null for AFC-native) - picks which design library to offer.
  organizationId: number | null;
  // Prefills the title field (the leaderboard name). The user can edit or clear it.
  defaultTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [designs, setDesigns] = useState<LeaderboardDesign[]>([]);
  const [loadingDesigns, setLoadingDesigns] = useState(false);

  // Form state.
  const [designId, setDesignId] = useState<string>(AUTO);
  const [size, setSize] = useState<GraphicSize>("instagram");
  const [title, setTitle] = useState(defaultTitle);
  const [subtitle, setSubtitle] = useState("");
  const [downloading, setDownloading] = useState(false);

  // ── Load the library when the dialog opens; default-select the library default. ──
  const loadDesigns = useCallback(async () => {
    setLoadingDesigns(true);
    try {
      const res = await leaderboardDesignsApi.list(organizationId);
      const rows = res?.results ?? [];
      setDesigns(rows);
      // Preselect the marked-default design so the common case is one click.
      const def = rows.find((d) => d.is_default);
      setDesignId(def ? String(def.id) : AUTO);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to load designs.",
      );
    } finally {
      setLoadingDesigns(false);
    }
  }, [organizationId]);

  // Reset + load ONLY on the false->true open transition (a prevOpen ref), not on every
  // defaultTitle/loadDesigns change - otherwise a parent re-render with a new leaderboard name
  // would wipe the title/subtitle/size the user is typing mid-export.
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setTitle(defaultTitle);
      setSubtitle("");
      setSize("instagram");
      loadDesigns();
    }
    prevOpenRef.current = open;
  }, [open, defaultTitle, loadDesigns]);

  // ── Download: fetch the PNG blob (auth header) and save it via a hidden anchor. ──
  const onDownload = async () => {
    setDownloading(true);
    try {
      const blob = await leaderboardDesignsApi.downloadGraphic(lbId, {
        designId: designId === AUTO ? null : Number(designId),
        size,
        title: title.trim(),
        subtitle: subtitle.trim(),
      });
      // Object-URL the blob and click a transient <a download> to save it. We control the
      // filename here (the endpoint also sets Content-Disposition, but a blob fetch ignores it).
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe = (title.trim() || defaultTitle || "leaderboard").replace(
        /[^a-z0-9-_ ]/gi,
        "",
      );
      a.download = `${safe}-${size}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Graphic downloaded.");
    } catch (err: any) {
      // A blob error response needs decoding to read the message the API put in JSON.
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

  // Disable a size whose background is not uploaded on the chosen design? No - the backend
  // falls back to a plain dark background, so both sizes always produce a valid graphic.

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <IconDownload className="size-4" /> Export graphic
      </Button>

      <Dialog open={open} onOpenChange={(o) => !downloading && setOpen(o)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Export leaderboard graphic</DialogTitle>
            <DialogDescription>
              Render the current standings onto a branded design and download it as
              an image.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Design picker - the library + an "Auto" fallback (library default). */}
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
                <p className="text-xs text-muted-foreground">Loading designs...</p>
              ) : designs.length === 0 ? (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <IconPhoto className="size-3" />
                  No designs yet. Add one in the Leaderboard designs section to brand
                  the export.
                </p>
              ) : null}
            </div>

            {/* Size picker - Instagram portrait vs YouTube landscape. */}
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
                  <SelectItem value="instagram">
                    Instagram (1080 x 1350)
                  </SelectItem>
                  <SelectItem value="youtube">YouTube (1920 x 1080)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title (prefilled with the leaderboard name) + subtitle (stage/group). */}
            <div className="space-y-2">
              <Label htmlFor="export-title">Title</Label>
              <Input
                id="export-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Leaderboard title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="export-subtitle">
                Subtitle{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="export-subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. Grand Finals - Group A"
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
