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
import { useTranslations } from "next-intl";
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
// Sentinel Select value for the Group dropdown meaning "the WHOLE stage (all groups combined)",
// as opposed to a single group's id. Sent to the backend as no group_id (stage-wide standings).
const ALL_GROUPS = "all_groups";

// ── Props ─────────────────────────────────────────────────────────────────────
interface EventStageExportGraphicDialogProps {
  // The numeric (or string) event_id, passed to downloadEventStageGraphic.
  eventId: number | string;
  // The numeric (or string) stage_id for the stage whose standings to render.
  stageId: number | string;
  // The selected group_id (owner 2026-06-16): the DEFAULT group selection. The dialog also lets the
  // user re-pick stage/group (see `stages`), so this is just the initial value; null = whole stage.
  groupId?: number | string | null;
  // The event's stages + their groups (owner 2026-06-16): lets the admin/organizer choose EXACTLY
  // which stage and group of the event to render on the export, instead of being locked to the page's
  // current view. Shape: [{ stage_id, stage_name, groups: [{ group_id, group_name }] }]. When
  // omitted or single, the dialog just uses the passed stageId/groupId.
  stages?: Array<{
    stage_id: number | string;
    stage_name?: string;
    groups?: Array<{ group_id: number | string; group_name?: string }>;
  }>;
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
  groupId,
  stages = [],
  organizationId,
  defaultTitle = "",
  defaultSubtitle = "",
  trigger,
}: EventStageExportGraphicDialogProps) {
  // i18n: organizer-facing dialog, keys under the "organizer" namespace (exportGraphic.*).
  const t = useTranslations("organizer");
  const [open, setOpen] = useState(false);
  const [designs, setDesigns] = useState<LeaderboardDesign[]>([]);
  const [loadingDesigns, setLoadingDesigns] = useState(false);

  // ── Form state ────────────────────────────────────────────────────────────
  const [designId, setDesignId] = useState<string>(AUTO);
  // Which stage + group of the event to render (owner 2026-06-16). selGroup === ALL_GROUPS means
  // the WHOLE stage (all groups combined); otherwise a single group's "Overall Leaderboard".
  const [selStage, setSelStage] = useState<string>(String(stageId ?? ""));
  const [selGroup, setSelGroup] = useState<string>(groupId != null ? String(groupId) : ALL_GROUPS);
  // Events default to YouTube (landscape, 1920x1080) - better for broadcast/stream
  // graphics than standalone leaderboards which default to Instagram portrait.
  const [size, setSize] = useState<GraphicSize>("youtube");
  const [title, setTitle] = useState(defaultTitle);
  const [subtitle, setSubtitle] = useState(defaultSubtitle);
  const [downloading, setDownloading] = useState(false);

  // Groups available for the currently-selected stage (drives the Group dropdown).
  const stageGroups =
    stages.find((s) => String(s.stage_id) === selStage)?.groups ?? [];

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
      toast.error(
        err?.response?.data?.message || t("exportGraphic.loadDesignsError"),
      );
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
      // Default the stage/group pickers to the page's current view (the passed stageId/groupId).
      setSelStage(String(stageId ?? stages[0]?.stage_id ?? ""));
      setSelGroup(groupId != null ? String(groupId) : ALL_GROUPS);
      loadDesigns();
    }
    prevOpenRef.current = open;
    // stageId/groupId are primitives; `stages` is only read at open so it is intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultTitle, defaultSubtitle, loadDesigns, stageId, groupId]);

  // ── Download: fetch PNG blob via auth-gated axios call + save ─────────────
  // downloadEventStageGraphic hits GET events/<eventId>/stages/<stageId>/graphic/
  // with the params serialised as query strings. The backend returns a PNG blob.
  // We object-URL it and click a hidden <a download> to trigger save-as.
  const onDownload = async () => {
    setDownloading(true);
    try {
      const selectedDesign = designs.find((d) => String(d.id) === designId);
      const pageCount = selectedDesign?.pages?.length ?? 0;
      const safe = (defaultTitle || "leaderboard").replace(
        /[^a-z0-9\-_ ]/gi,
        "",
      );
      // Save one blob to disk via a transient <a download>.
      const saveBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      };
      // Shared params; the USER-CHOSEN stage + group (owner 2026-06-16), not just the page's view.
      const baseOpts = {
        designId: designId === AUTO ? null : Number(designId),
        size,
        title: "",
        subtitle: "",
        groupId: selGroup === ALL_GROUPS ? null : selGroup,
      };

      if (pageCount > 1) {
        // Multi-page (owner 2026-06-16): download each page as a SEPARATE image, not a ZIP. We fetch
        // ?page=N per page and save each PNG, with a short gap so the browser queues every download.
        for (let p = 1; p <= pageCount; p++) {
          const blob = await leaderboardDesignsApi.downloadEventStageGraphic(
            eventId,
            selStage || stageId,
            { ...baseOpts, page: p },
          );
          saveBlob(blob, `${safe}-${size}-page${p}.png`);
          if (p < pageCount) await new Promise((r) => setTimeout(r, 400));
        }
        toast.success(t("exportGraphic.downloadedImages", { count: pageCount }));
      } else {
        const blob = await leaderboardDesignsApi.downloadEventStageGraphic(
          eventId,
          selStage || stageId,
          baseOpts,
        );
        saveBlob(blob, `${safe}-${size}.png`);
        toast.success(t("exportGraphic.graphicDownloaded"));
      }
    } catch (err: any) {
      // Blob error responses carry JSON inside the blob body, not as parsed JSON.
      // We decode the blob text manually to read the backend's message field.
      let message = t("exportGraphic.exportError");
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
          <IconDownload className="size-4" /> {t("exportGraphic.button")}
        </Button>
      )}

      <Dialog open={open} onOpenChange={(o) => !downloading && setOpen(o)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{t("exportGraphic.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("exportGraphic.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* ── Stage + Group pickers (owner 2026-06-16) ──────────────────
                Choose EXACTLY which stage + group of the event to render, instead of
                being locked to whatever the page is currently showing. "Whole stage"
                renders every group combined; a specific group renders just that group's
                Overall Leaderboard (the backend's group_id vs stage-wide path). */}
            {stages.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label>{t("exportGraphic.stage")}</Label>
                  <Select
                    value={selStage}
                    onValueChange={(v) => {
                      setSelStage(v);
                      setSelGroup(ALL_GROUPS); // groups are stage-specific; reset to whole-stage
                      const st = stages.find((s) => String(s.stage_id) === v);
                      if (st?.stage_name) setSubtitle(st.stage_name); // keep subtitle in sync
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("exportGraphic.selectStage")} />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={String(s.stage_id)} value={String(s.stage_id)}>
                          {s.stage_name ||
                            t("exportGraphic.stageFallback", { id: s.stage_id })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {stageGroups.length > 0 && (
                  <div className="space-y-2">
                    <Label>{t("exportGraphic.group")}</Label>
                    <Select value={selGroup} onValueChange={setSelGroup}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_GROUPS}>
                          {t("exportGraphic.wholeStage")}
                        </SelectItem>
                        {stageGroups.map((g) => (
                          <SelectItem key={String(g.group_id)} value={String(g.group_id)}>
                            {g.group_name ||
                              t("exportGraphic.groupFallback", { id: g.group_id })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {/* ── Design picker ────────────────────────────────────────────
                Lists the org's design library. "Default / plain background"
                lets the backend choose the library default (or plain dark). */}
            <div className="space-y-2">
              <Label>{t("exportGraphic.design")}</Label>
              <Select value={designId} onValueChange={setDesignId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("exportGraphic.selectDesign")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO}>
                    {t("exportGraphic.defaultDesign")}
                  </SelectItem>
                  {designs.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                      {d.is_default ? t("exportGraphic.defaultSuffix") : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingDesigns ? (
                <p className="text-xs text-muted-foreground">
                  {t("exportGraphic.loadingDesigns")}
                </p>
              ) : designs.length === 0 ? (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <IconPhoto className="size-3" />
                  {t("exportGraphic.noDesigns")}
                </p>
              ) : null}
              {/* Note shown when the selected design has multiple pages: one image per page. */}
              {(designs.find((d) => String(d.id) === designId)?.pages?.length ??
                0) > 1 && (
                <p className="text-xs text-muted-foreground">
                  {t("exportGraphic.multiPageNote")}
                </p>
              )}
            </div>

            {/* ── Size picker - YouTube landscape vs Instagram portrait ─── */}
            <div className="space-y-2">
              <Label>{t("exportGraphic.size")}</Label>
              <Select
                value={size}
                onValueChange={(v) => setSize(v as GraphicSize)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">
                    {t("exportGraphic.sizeYoutube")}
                  </SelectItem>
                  <SelectItem value="instagram">
                    {t("exportGraphic.sizeInstagram")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title/subtitle inputs REMOVED (owner 2026-07-02): headers are authored as freeform
                TEXT elements inside the design (WYSIWYG), so the export draws no separate header. */}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={downloading}
              onClick={() => setOpen(false)}
            >
              {t("exportGraphic.cancel")}
            </Button>
            <Button disabled={downloading} onClick={onDownload}>
              {downloading ? (
                <IconLoader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <IconDownload className="mr-1 size-4" />
              )}
              {t("exportGraphic.download")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
