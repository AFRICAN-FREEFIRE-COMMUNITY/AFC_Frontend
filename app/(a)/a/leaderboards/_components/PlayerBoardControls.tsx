"use client";

// ── PlayerBoardControls (owner 2026-07-05, complaints G + H) ─────────────────────────────────────
// The SHARED scope selector + "Download" (through-a-design PNG export) bar for the two PLAYER-driven
// boards: the MVP tab (MvpTab.tsx) and the Top Killers tab (TopKillersTab.tsx). Both boards rank
// PLAYERS and both can be scoped to the WHOLE EVENT or COMBINED across selected whole stages +
// individual groups — the SAME combine idea the leaderboard overlay card + export dialog use
// (complaints B/C). This component owns the combine selection UI and reports the resolved
// {groupIds, stageIds} up to the parent tab (which re-fetches its ranking through that scope), and
// hosts the Download dialog (design + size -> events/<id>/player-board-graphic/, downloadPlayerBoardGraphic).
//
// CONNECTS TO:
//   • broadcastApi.get(eventId) (lib/overlay.ts)         -> the event's stage/group structure for the tree.
//   • leaderboardDesignsApi.list(organizationId)          -> the design library for the Download picker.
//   • downloadPlayerBoardGraphic(eventId, {kind, ...})    -> the PNG blob (esports_image drawn as an image).
// Reuses the leaderboard COMBINE path: whole stages expand to their groups on the backend, so a stage
// checkbox implicitly checks (and disables) its group checkboxes here — identical to the export dialog.
//
// This is a reused ADMIN _component (mounted on the admin editor AND the organizer leaderboard page via
// MvpTab/TopKillersTab); it keeps its English copy, matching the MvpTab / ManualMatchResultStep precedent.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { IconDownload, IconLayersSubtract, IconLoader2, IconPhoto } from "@tabler/icons-react";

import { broadcastApi, downloadPlayerBoardGraphic } from "@/lib/overlay";
import {
  leaderboardDesignsApi,
  type LeaderboardDesign,
  type GraphicSize,
} from "@/lib/leaderboardDesigns";

interface StageNode {
  stage_id: number;
  stage_name: string;
  groups: { group_id: number; group_name: string }[];
}

const AUTO = "auto"; // "let the backend pick the library default design"

export function PlayerBoardControls({
  eventId,
  organizationId,
  kind,
  onScopeChange,
}: {
  eventId: number | string;
  organizationId: number | null;
  kind: "mvp" | "top_killers";
  // Reports the resolved combine scope so the parent tab can re-fetch its ranking. Empty arrays =
  // whole event. Whole-stage picks are sent as stage ids (the backend expands them to their groups).
  onScopeChange: (scope: { groupIds: number[]; stageIds: number[] }) => void;
}) {
  const [stages, setStages] = useState<StageNode[]>([]);
  // Combine selection: OFF => whole event; ON => merge the checked whole stages + individual groups.
  const [combineMode, setCombineMode] = useState(false);
  const [stageIds, setStageIds] = useState<Set<number>>(new Set());
  const [groupIds, setGroupIds] = useState<Set<number>>(new Set());

  // The event's stage/group structure (reused from the broadcast selection endpoint the studio uses).
  useEffect(() => {
    broadcastApi
      .get(eventId)
      .then((sel) =>
        setStages(
          (sel.stages ?? []).map((s) => ({
            stage_id: Number(s.stage_id),
            stage_name: s.stage_name,
            groups: (s.groups ?? []).map((g) => ({
              group_id: Number(g.group_id),
              group_name: g.group_name,
            })),
          })),
        ),
      )
      .catch(() => {});
  }, [eventId]);

  // Report the resolved scope up whenever it changes. combineMode OFF => whole event ([], []).
  useEffect(() => {
    onScopeChange(
      combineMode
        ? { groupIds: [...groupIds], stageIds: [...stageIds] }
        : { groupIds: [], stageIds: [] },
    );
    // onScopeChange is a stable setter from the parent; scope state drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combineMode, groupIds, stageIds]);

  // Toggling a WHOLE stage drops its individual group picks (redundant — the backend expands a stage
  // to all its groups). Group checkboxes are disabled while their stage is selected (mirrors the export dialog).
  const toggleStage = (sid: number) => {
    setStageIds((prev) => {
      const next = new Set(prev);
      next.has(sid) ? next.delete(sid) : next.add(sid);
      return next;
    });
    setGroupIds((prev) => {
      const st = stages.find((s) => s.stage_id === sid);
      if (!st?.groups.length) return prev;
      const next = new Set(prev);
      for (const g of st.groups) next.delete(g.group_id);
      return next;
    });
  };
  const toggleGroup = (gid: number) => {
    setGroupIds((prev) => {
      const next = new Set(prev);
      next.has(gid) ? next.delete(gid) : next.add(gid);
      return next;
    });
  };
  const combineCount = stageIds.size + groupIds.size;

  // ── Download (through a design) ────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [designs, setDesigns] = useState<LeaderboardDesign[]>([]);
  const [loadingDesigns, setLoadingDesigns] = useState(false);
  const [designId, setDesignId] = useState<string>(AUTO);
  const [size, setSize] = useState<GraphicSize>("youtube");
  const [downloading, setDownloading] = useState(false);

  const loadDesigns = useCallback(async () => {
    setLoadingDesigns(true);
    try {
      const res = await leaderboardDesignsApi.list(organizationId ?? null);
      const rows = res?.results ?? [];
      setDesigns(rows);
      const def = rows.find((d) => d.is_default);
      setDesignId(def ? String(def.id) : AUTO);
    } catch {
      toast.error("Could not load the design library.");
    } finally {
      setLoadingDesigns(false);
    }
  }, [organizationId]);

  const onOpenChange = (o: boolean) => {
    if (downloading) return;
    setOpen(o);
    if (o) loadDesigns();
  };

  const onDownload = async () => {
    setDownloading(true);
    try {
      const blob = await downloadPlayerBoardGraphic(eventId, {
        kind,
        designId: designId === AUTO ? null : Number(designId),
        size,
        // Only carry a scope when combining; whole event otherwise.
        groupIds: combineMode ? [...groupIds] : [],
        stageIds: combineMode ? [...stageIds] : [],
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${kind === "top_killers" ? "top-killers" : "mvp"}-${size}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Board downloaded.");
      setOpen(false);
    } catch (err: any) {
      // Blob error bodies carry JSON — decode to read the backend message.
      let message = "Could not download the board.";
      const data = err?.response?.data;
      if (data instanceof Blob) {
        try {
          message = JSON.parse(await data.text())?.message || message;
        } catch {
          /* keep default */
        }
      } else if (data?.message) {
        message = data.message;
      }
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      {/* ── Scope: whole event (default) or combine selected whole stages + groups. ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <IconLayersSubtract className="text-primary size-4" />
          <Label className="text-sm font-medium">Scope</Label>
          <Select
            value={combineMode ? "combine" : "event"}
            onValueChange={(v) => setCombineMode(v === "combine")}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="event">Whole event</SelectItem>
              <SelectItem value="combine">Combine selected</SelectItem>
            </SelectContent>
          </Select>
          {combineMode && combineCount > 0 ? (
            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
              {combineCount} selected
            </Badge>
          ) : null}
        </div>

        {/* Combine checklist: whole STAGES + individual GROUPS. A checked stage auto-includes its
            groups (shown checked + disabled), matching the leaderboard export dialog. */}
        {combineMode && stages.length > 0 ? (
          <div className="max-h-48 w-72 space-y-2 overflow-y-auto rounded-md border p-2">
            {stages.map((s) => {
              const stageOn = stageIds.has(s.stage_id);
              return (
                <div key={s.stage_id} className="space-y-1">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                    <Checkbox checked={stageOn} onCheckedChange={() => toggleStage(s.stage_id)} />
                    {s.stage_name || `Stage ${s.stage_id}`}
                    <span className="text-muted-foreground">(whole stage)</span>
                  </label>
                  <div className="ml-5 space-y-1">
                    {s.groups.map((g) => (
                      <label
                        key={g.group_id}
                        className="flex cursor-pointer items-center gap-2 text-xs"
                      >
                        <Checkbox
                          checked={groupIds.has(g.group_id) || stageOn}
                          disabled={stageOn}
                          onCheckedChange={() => toggleGroup(g.group_id)}
                        />
                        {g.group_name || `Group ${g.group_id}`}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* ── Download the board through a design (PNG). ── */}
      <Button variant="outline" size="sm" onClick={() => onOpenChange(true)}>
        <IconDownload className="size-4" /> Download
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Download board</DialogTitle>
            <DialogDescription>
              Render the {kind === "top_killers" ? "top killers" : "MVP"} board onto a design and save
              it as an image.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Design</Label>
              <Select value={designId} onValueChange={setDesignId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a design" />
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
                <p className="text-muted-foreground text-xs">Loading designs...</p>
              ) : designs.length === 0 ? (
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <IconPhoto className="size-3" /> No designs yet. A plain background is used.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Size</Label>
              <Select value={size} onValueChange={(v) => setSize(v as GraphicSize)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">YouTube (1920 x 1080)</SelectItem>
                  <SelectItem value="instagram">Instagram (1080 x 1350)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={downloading} onClick={() => setOpen(false)}>
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
    </div>
  );
}
