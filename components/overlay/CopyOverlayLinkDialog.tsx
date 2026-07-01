"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CopyOverlayLinkDialog — "Copy OBS overlay link" picker.
// ----------------------------------------------------------------------------
// PURPOSE
//   Lets an organizer/admin build the public OBS Browser Source URL for an event's
//   live leaderboard overlay and copy it. Structurally mirrors
//   app/(organizer)/organizer/events/[slug]/leaderboard/_components/EventStageExportGraphicDialog.tsx
//   (same reset-on-open gate, same org-scoped design dropdown + stage/group pickers,
//   same AFC shadcn/sonner idiom) but instead of downloading a PNG it assembles the
//   overlay URL that the OBS page (app/overlay/leaderboard/[token]/page.tsx) reads.
//
// FLOW
//   open -> POST events/<id>/overlay/token/ to ENSURE the event's read-only overlay
//   token (lib/overlay.overlayTokenApi.ensure) + load the org's design library
//   (lib/leaderboardDesigns.leaderboardDesignsApi.list) -> user picks stage/group +
//   design + size + which COLUMNS to show (checkboxes seeded from the chosen design's
//   placed fields, all on, re-seeded when the design changes) + animation + reveal +
//   refresh seconds -> we render the URL live + Copy it (navigator.clipboard + toast).
//   A "Regenerate token" action rotates the token (POST ...?regenerate=1), invalidating
//   any link already in OBS.
//
// URL BUILT (points at THIS frontend, which serves the overlay route):
//   `${NEXT_PUBLIC_URL}/overlay/leaderboard/<token>?type=event&event=&stage=&group=
//     &design=&size=&anim=&reveal=&interval=&cols=`
//
// MOUNTED ON
//   - Admin event leaderboard edit page: app/(a)/a/leaderboards/[id]/edit/page.tsx (PageHeader).
//   - Organizer event leaderboard page:  app/(organizer)/organizer/events/[slug]/leaderboard/page.tsx.
//
// i18n: organizer-facing, keys under the "organizer" namespace (obsOverlay.*). The admin (a)/ mount
// is i18n-exempt but the shared NextIntl provider still resolves these keys there.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
import {
  IconBroadcast,
  IconCopy,
  IconLoader2,
  IconRefresh,
} from "@tabler/icons-react";
import {
  leaderboardDesignsApi,
  type LeaderboardDesign,
  type GraphicSize,
  type FieldType,
} from "@/lib/leaderboardDesigns";
import { overlayTokenApi } from "@/lib/overlay";

// Sentinel Select values (mirror EventStageExportGraphicDialog): "let the backend pick the library
// default design" and "the whole stage (all groups)".
const AUTO = "auto";
const ALL_GROUPS = "all_groups";

// Friendly labels for the column checkboxes (mirror DesignFieldsEditor.FIELD_LABELS). Only used to
// render a readable checkbox per placed field_type; the URL carries the raw field_type tokens.
const FIELD_LABELS: Record<string, string> = {
  pos: "POS",
  team_name: "TEAM NAME",
  team_logo: "TEAM LOGO",
  booyah: "BOOYAH",
  placement_points: "PP",
  kill_points: "KP",
  total_points: "TP",
  rush_points: "RUSH",
  kills: "KILLS",
  matches: "MATCHES",
  base_total: "BASE TOTAL",
  bonus: "BONUS",
  penalty: "PENALTY",
  // Rich LIVE-only stats (owner 2026-07-01, spec §12): a design can place these; list them here so the
  // streamer can toggle each on/off in the column chooser. They only populate while Live is on.
  deaths: "DEATHS",
  knockdowns: "KNOCKDOWNS",
  headshots: "HEADSHOTS",
  most_used_weapon: "MOST-USED WEAPON",
  survival_time: "SURVIVAL TIME",
  revives_received: "REVIVES RECEIVED",
  gloowall_used: "GLOOWALL USED",
  medkit_used: "MEDKIT USED",
};
// Canonical order so the checkboxes read the same way every time (mirror the editor palette order:
// per-round standings columns first, rich live-only stats last).
const FIELD_ORDER: FieldType[] = [
  "pos", "team_name", "team_logo", "booyah", "placement_points", "kill_points",
  "total_points", "rush_points", "kills", "matches", "base_total", "bonus", "penalty",
  "deaths", "knockdowns", "headshots", "most_used_weapon", "survival_time",
  "revives_received", "gloowall_used", "medkit_used",
];

// ── Props (mirror EventStageExportGraphicDialog's target/scope props) ─────────
interface CopyOverlayLinkDialogProps {
  eventId: number | string;
  // Default stage/group selection (the page's current view); the dialog lets the user re-pick.
  stageId?: number | string | null;
  groupId?: number | string | null;
  // The event's stages + groups, same shape EventStageExportGraphicDialog takes.
  stages?: Array<{
    stage_id: number | string;
    stage_name?: string;
    groups?: Array<{ group_id: number | string; group_name?: string }>;
  }>;
  // Org that owns the event — scopes the design library (null/undefined => AFC-native library).
  organizationId?: number | null;
  // Custom trigger; when omitted a default outline "Copy OBS overlay link" button is rendered.
  trigger?: React.ReactNode;
}

export function CopyOverlayLinkDialog({
  eventId,
  stageId,
  groupId,
  stages = [],
  organizationId,
  trigger,
}: CopyOverlayLinkDialogProps) {
  const t = useTranslations("organizer");
  const [open, setOpen] = useState(false);

  // ── Token + design library (loaded on open) ────────────────────────────────
  const [overlayToken, setOverlayToken] = useState<string>("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [designs, setDesigns] = useState<LeaderboardDesign[]>([]);
  const [loadingDesigns, setLoadingDesigns] = useState(false);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [selStage, setSelStage] = useState<string>(String(stageId ?? ""));
  const [selGroup, setSelGroup] = useState<string>(
    groupId != null ? String(groupId) : ALL_GROUPS,
  );
  const [designId, setDesignId] = useState<string>(AUTO);
  const [size, setSize] = useState<GraphicSize>("youtube"); // broadcast default = landscape
  const [anim, setAnim] = useState<string>("fade");
  const [reveal, setReveal] = useState<string>("staggered");
  const [interval, setIntervalSec] = useState<number>(10);
  // Live (in-round) mode: when on we append &live=1 so the overlay asks the feed for the Tier-2
  // in-round snapshot (Redis) and polls at 2s. Requires the capture client running on the observer PC;
  // the rich-stat columns (deaths/knockdowns/...) only populate while live.
  const [live, setLive] = useState<boolean>(false);
  // "Follow the site's broadcast selection" (owner 2026-07-01): when ON, the built URL OMITS stage &
  // group so the overlay resolves the event's LIVE broadcast selection (chosen in <BroadcastControl>)
  // instead of a fixed stage/group. The organizer then switches stage/group live from that control with
  // NO OBS change. When OFF, the explicit stage/group pickers below are used (original behaviour).
  const [followBroadcast, setFollowBroadcast] = useState<boolean>(false);
  // Which columns (field_types) to show. Seeded from the chosen design's placed fields; all on.
  const [selectedCols, setSelectedCols] = useState<string[]>([]);

  // Groups for the currently-selected stage (drives the Group dropdown).
  const stageGroups =
    stages.find((s) => String(s.stage_id) === selStage)?.groups ?? [];

  // The chosen design object (null when AUTO / not found) — drives the column checkboxes.
  const selectedDesign = designs.find((d) => String(d.id) === designId) ?? null;

  // The unique placed field_types of the chosen design, in canonical order (the AVAILABLE columns).
  const placedFieldTypes = useMemo<string[]>(() => {
    if (!selectedDesign) return [];
    const present = new Set(selectedDesign.fields.map((f) => f.field_type));
    return FIELD_ORDER.filter((ft) => present.has(ft));
  }, [selectedDesign]);

  // ── Ensure the token + load the design library on the false->true open transition. ──
  const ensureTokenAndDesigns = useCallback(async () => {
    setTokenLoading(true);
    setLoadingDesigns(true);
    try {
      const tok = await overlayTokenApi.ensure(eventId);
      setOverlayToken(tok);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("obsOverlay.tokenError"));
    } finally {
      setTokenLoading(false);
    }
    try {
      const res = await leaderboardDesignsApi.list(organizationId ?? null);
      const rows = res?.results ?? [];
      setDesigns(rows);
      const def = rows.find((d) => d.is_default);
      setDesignId(def ? String(def.id) : AUTO);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("obsOverlay.loadDesignsError"));
    } finally {
      setLoadingDesigns(false);
    }
  }, [eventId, organizationId, t]);

  // Reset + load ONLY on open (prevOpen ref), so a parent re-render never wipes what the user is
  // configuring mid-session. Mirror of EventStageExportGraphicDialog's gate.
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setSelStage(String(stageId ?? stages[0]?.stage_id ?? ""));
      setSelGroup(groupId != null ? String(groupId) : ALL_GROUPS);
      setSize("youtube");
      setAnim("fade");
      setReveal("staggered");
      setIntervalSec(10);
      setLive(false);
      setFollowBroadcast(false);
      ensureTokenAndDesigns();
    }
    prevOpenRef.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stageId, groupId, ensureTokenAndDesigns]);

  // Re-seed the column selection to ALL placed fields whenever the chosen design changes (spec: the
  // checkboxes re-populate on design change, all on by default).
  useEffect(() => {
    setSelectedCols(placedFieldTypes);
  }, [placedFieldTypes]);

  const toggleCol = (ft: string, on: boolean) =>
    setSelectedCols((prev) =>
      on ? [...new Set([...prev, ft])] : prev.filter((c) => c !== ft),
    );

  // ── Build the overlay URL from the current form. ────────────────────────────
  const overlayUrl = useMemo(() => {
    if (!overlayToken) return "";
    const qp = new URLSearchParams();
    qp.set("type", "event");
    qp.set("event", String(eventId));
    // Follow-broadcast: OMIT stage & group so the overlay feed resolves the event's live broadcast
    // selection (BroadcastControl) instead of a fixed stage/group. Design/cols/size/anim still apply.
    if (!followBroadcast) {
      if (selStage) qp.set("stage", selStage);
      if (selGroup && selGroup !== ALL_GROUPS) qp.set("group", selGroup);
    }
    if (designId && designId !== AUTO) qp.set("design", designId);
    qp.set("size", size);
    qp.set("anim", anim);
    qp.set("reveal", reveal);
    qp.set("interval", String(interval));
    // Live (in-round) opt-in: the overlay page reads &live=1 to request the Tier-2 snapshot + poll 2s.
    if (live) qp.set("live", "1");
    // Only send `cols` when a STRICT SUBSET is chosen; sending all placed fields is redundant (the
    // overlay defaults to every design field), so omit it to keep the URL clean.
    if (
      placedFieldTypes.length > 0 &&
      selectedCols.length > 0 &&
      selectedCols.length < placedFieldTypes.length
    ) {
      const ordered = placedFieldTypes.filter((ft) => selectedCols.includes(ft));
      qp.set("cols", ordered.join(","));
    }
    return `${env.NEXT_PUBLIC_URL}/overlay/leaderboard/${overlayToken}?${qp.toString()}`;
  }, [
    overlayToken, eventId, selStage, selGroup, designId, size, anim, reveal,
    interval, live, followBroadcast, selectedCols, placedFieldTypes,
  ]);

  // ── Copy the URL. ───────────────────────────────────────────────────────────
  const onCopy = async () => {
    if (!overlayUrl) return;
    try {
      await navigator.clipboard.writeText(overlayUrl);
      toast.success(t("obsOverlay.copied"));
    } catch {
      toast.error(t("obsOverlay.copyError"));
    }
  };

  // ── Rotate the token (invalidates any link already pasted into OBS). ─────────
  const onRegenerate = async () => {
    setRegenerating(true);
    try {
      const tok = await overlayTokenApi.ensure(eventId, { regenerate: true });
      setOverlayToken(tok);
      toast.success(t("obsOverlay.regenerated"));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("obsOverlay.tokenError"));
    } finally {
      setRegenerating(false);
    }
  };

  const busy = tokenLoading || regenerating;

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)} className="contents">
          {trigger}
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <IconBroadcast className="size-4" /> {t("obsOverlay.button")}
        </Button>
      )}

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-[480px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("obsOverlay.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("obsOverlay.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* ── Follow the site's broadcast selection ──
                When ON, the built URL OMITS stage & group, so the overlay resolves whatever the
                Broadcast control has set live (a group, a stage cumulative, an event cumulative, or a
                custom set). The organizer then switches stage/group live from that control, with no OBS
                change. When OFF, the explicit stage/group pickers below are used. */}
            <div className="flex items-start justify-between gap-3 rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="overlay-follow">{t("obsOverlay.follow")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("obsOverlay.followHelp")}
                </p>
              </div>
              <Switch
                id="overlay-follow"
                checked={followBroadcast}
                onCheckedChange={setFollowBroadcast}
                className="mt-0.5"
              />
            </div>

            {/* ── Stage + Group ── (hidden while following the broadcast selection) */}
            {!followBroadcast && stages.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label>{t("obsOverlay.stage")}</Label>
                  <Select
                    value={selStage}
                    onValueChange={(v) => {
                      setSelStage(v);
                      setSelGroup(ALL_GROUPS);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("obsOverlay.selectStage")} />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={String(s.stage_id)} value={String(s.stage_id)}>
                          {s.stage_name ||
                            t("obsOverlay.stageFallback", { id: s.stage_id })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {stageGroups.length > 0 && (
                  <div className="space-y-2">
                    <Label>{t("obsOverlay.group")}</Label>
                    <Select value={selGroup} onValueChange={setSelGroup}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_GROUPS}>
                          {t("obsOverlay.wholeStage")}
                        </SelectItem>
                        {stageGroups.map((g) => (
                          <SelectItem key={String(g.group_id)} value={String(g.group_id)}>
                            {g.group_name ||
                              t("obsOverlay.groupFallback", { id: g.group_id })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {/* ── Design ── */}
            <div className="space-y-2">
              <Label>{t("obsOverlay.design")}</Label>
              <Select value={designId} onValueChange={setDesignId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("obsOverlay.selectDesign")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO}>{t("obsOverlay.defaultDesign")}</SelectItem>
                  {designs.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                      {d.is_default ? t("obsOverlay.defaultSuffix") : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingDesigns && (
                <p className="text-xs text-muted-foreground">
                  {t("obsOverlay.loadingDesigns")}
                </p>
              )}
            </div>

            {/* ── Columns (checkboxes seeded from the chosen design's placed fields) ── */}
            {placedFieldTypes.length > 0 && (
              <div className="space-y-2">
                <Label>{t("obsOverlay.columns")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("obsOverlay.columnsHint")}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border p-3">
                  {placedFieldTypes.map((ft) => (
                    <label
                      key={ft}
                      className="flex cursor-pointer items-center gap-2 text-xs"
                    >
                      <Checkbox
                        checked={selectedCols.includes(ft)}
                        onCheckedChange={(v) => toggleCol(ft, v === true)}
                      />
                      {FIELD_LABELS[ft] ?? ft}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ── Size ── */}
            <div className="space-y-2">
              <Label>{t("obsOverlay.size")}</Label>
              <Select value={size} onValueChange={(v) => setSize(v as GraphicSize)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">{t("obsOverlay.sizeYoutube")}</SelectItem>
                  <SelectItem value="instagram">
                    {t("obsOverlay.sizeInstagram")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ── Animation + Reveal ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("obsOverlay.animation")}</Label>
                <Select value={anim} onValueChange={setAnim}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fade">{t("obsOverlay.animFade")}</SelectItem>
                    <SelectItem value="slide">{t("obsOverlay.animSlide")}</SelectItem>
                    <SelectItem value="flash">{t("obsOverlay.animFlash")}</SelectItem>
                    <SelectItem value="none">{t("obsOverlay.animNone")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("obsOverlay.reveal")}</Label>
                <Select value={reveal} onValueChange={setReveal}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staggered">
                      {t("obsOverlay.revealStaggered")}
                    </SelectItem>
                    <SelectItem value="all">{t("obsOverlay.revealAll")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Refresh seconds ── */}
            <div className="space-y-2">
              <Label htmlFor="overlay-interval">{t("obsOverlay.refresh")}</Label>
              <Input
                id="overlay-interval"
                type="number"
                min={2}
                max={120}
                value={interval}
                onChange={(e) =>
                  setIntervalSec(
                    Math.max(2, Math.min(120, Number(e.target.value) || 10)),
                  )
                }
                className="w-28"
              />
            </div>

            {/* ── Live (in-round) toggle ──
                Appends &live=1 so the overlay asks the feed for the Tier-2 in-round snapshot and polls
                fast (2s). Requires the desktop capture client running on the observer PC; the rich-stat
                columns (deaths/knockdowns/...) only fill while live. Switch mirrors the shadcn idiom. */}
            <div className="flex items-start justify-between gap-3 rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="overlay-live">{t("obsOverlay.live")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("obsOverlay.liveHelp")}
                </p>
              </div>
              <Switch
                id="overlay-live"
                checked={live}
                onCheckedChange={setLive}
                className="mt-0.5"
              />
            </div>

            {/* ── The built URL (read-only) + Copy ── */}
            <div className="space-y-2">
              <Label>{t("obsOverlay.link")}</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={tokenLoading ? t("obsOverlay.preparing") : overlayUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!overlayUrl}
                  onClick={onCopy}
                  title={t("obsOverlay.copyTitle")}
                >
                  <IconCopy className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("obsOverlay.obsHint")}
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            {/* Regenerate rotates the token (breaks any link already in OBS). */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || !overlayToken}
              onClick={onRegenerate}
              className="text-muted-foreground"
            >
              {regenerating ? (
                <IconLoader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <IconRefresh className="mr-1 size-4" />
              )}
              {t("obsOverlay.regenerate")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
                {t("obsOverlay.close")}
              </Button>
              <Button disabled={busy || !overlayUrl} onClick={onCopy}>
                <IconCopy className="mr-1 size-4" />
                {t("obsOverlay.copyLink")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
