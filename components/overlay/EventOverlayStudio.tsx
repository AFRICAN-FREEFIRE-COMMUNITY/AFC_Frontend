"use client";

// ── EventOverlayStudio (owner 2026-07-02) ────────────────────────────────────
// The SHARED per-event overlay studio, mounted by BOTH:
//   • admin:     app/(a)/a/overlays/[eventId]/page.tsx      (any event)
//   • organizer: app/(organizer)/organizer/overlays/[eventId]/page.tsx (THEIR org's events only —
//     the backend gate (views_overlays._broadcast_gate: org must can_edit_events on the event's org)
//     403s anything else, and the design library is scoped to organizationId, so an organizer only
//     ever sees + edits their OWN designs and data. Owner 2026-07-02.)
//
// Overlays are saved, named entities (EventOverlay): created from a design (or a timer scene), each
// with ONE permanent link (/overlay/view/<token>/<id>) — edits here (design, stage/group, animations,
// live 3D-room mode, timer trigger) update what the SAME Browser Source renders. Cards support
// rename / duplicate / delete / copy link, with a live scaled preview of the real link.
//
// i18n: organizer-facing → next-intl keys under organizer.studio.* (en authored,
// fr/pt via pnpm i18n:translate). The admin mount shows the same (English) strings.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import axios from "axios";
import Cookies from "js-cookie";
import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { FullLoader } from "@/components/Loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconArrowLeft,
  IconChartBar,
  IconCheck,
  IconClock,
  IconCopy,
  IconExternalLink,
  IconKey,
  IconLayoutGrid,
  IconPencil,
  IconPlayerPlay,
  IconPlayerStop,
  IconPlus,
  IconSwords,
  IconTrash,
  IconTrophy,
  IconCopyPlus,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import {
  leaderboardDesignsApi,
  type LeaderboardDesign,
} from "@/lib/leaderboardDesigns";
import {
  overlayTokenApi,
  uploadTokenApi,
  broadcastApi,
  overlaysApi,
  type EventOverlayRow,
} from "@/lib/overlay";
import { BroadcastControl } from "@/components/overlay/BroadcastControl";
// Media hygiene (owner 2026-07-02): missing/bad team logos + player esport images for this event.
import { MediaAuditCard } from "@/components/overlay/MediaAuditCard";
import { BroadcastKitCard } from "@/components/overlay/BroadcastKitCard";
import { useLiveTick } from "@/hooks/useLiveTick";

const PREVIEW_W = 380; // card preview width; the overlay renders 1920x1080 and is scaled to fit

interface StageNode {
  stage_id: number | string;
  stage_name?: string;
  groups?: Array<{ group_id: number | string; group_name?: string }>;
}

/* ── One overlay card: live preview + per-overlay controls + actions. ───────── */
function OverlayCard({
  eventId,
  overlayToken,
  row,
  designs,
  stages,
  onChanged,
  onDeleted,
  onDuplicated,
}: {
  eventId: number;
  overlayToken: string;
  row: EventOverlayRow;
  designs: LeaderboardDesign[];
  stages: StageNode[];
  onChanged: (row: EventOverlayRow) => void;
  onDeleted: (id: number) => void;
  onDuplicated: (row: EventOverlayRow) => void;
}) {
  const t = useTranslations("organizer");
  const cfg = (row.config || {}) as Record<string, any>;
  const [busy, setBusy] = useState(false);

  // Inline rename state.
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(row.name);

  // Timer config drafts (saved on Trigger).
  const [minutes, setMinutes] = useState(3);
  const [seconds, setSeconds] = useState(0);
  const [endClock, setEndClock] = useState("");
  const [label, setLabel] = useState((cfg.label as string) || "");

  // Booyah drafts (owner 2026-07-02): manual trigger needs a team pick (fetched lazily from the
  // media-audit endpoint, which already lists this event's registered teams + logos) + map + duration.
  const [booyahTeams, setBooyahTeams] = useState<
    { team_id: number; team_name: string; logo_url: string | null }[]
  >([]);
  const [booyahTeamId, setBooyahTeamId] = useState("");
  const [booyahMap, setBooyahMap] = useState((cfg.match_map as string) || "");
  // H2H competitor options (owner 2026-07-02): teams OR players of this event, from the media-audit
  // endpoint (it already lists both, gated). Only fetched for h2h cards.
  const [h2hPlayers, setH2hPlayers] = useState<
    { user_id: number; in_game_name: string }[]
  >([]);
  useEffect(() => {
    if (row.kind !== "h2h") return;
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/${eventId}/media-audit/`, {
        headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` },
      })
      .then((res) => {
        setBooyahTeams(res.data.teams ?? []);
        setH2hPlayers(res.data.players ?? []);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.kind, eventId]);

  useEffect(() => {
    if (row.kind !== "booyah") return;
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/${eventId}/media-audit/`, {
        headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` },
      })
      .then((res) => setBooyahTeams(res.data.teams ?? []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.kind, eventId]);

  const triggerBooyah = async () => {
    const team = booyahTeams.find((x) => String(x.team_id) === booyahTeamId);
    if (!team) {
      toast.error(t("studio.booyahNeedsTeam"));
      return;
    }
    await save({
      active: true,
      config: {
        ...cfg,
        team_name: team.team_name,
        team_logo: team.logo_url,
        match_map: booyahMap.trim(),
        shown_at: new Date().toISOString(),
      },
    });
    toast.success(t("studio.booyahLive"));
  };

  // Preview remount nonce: bumped after every save so the stable link re-renders immediately
  // instead of waiting out the view page's own 3s poll.
  const [nonce, setNonce] = useState(0);

  const url = `${env.NEXT_PUBLIC_URL}/overlay/view/${overlayToken}/${row.id}`;

  const save = async (patch: {
    name?: string;
    config?: Record<string, unknown>;
    active?: boolean;
  }) => {
    setBusy(true);
    try {
      const updated = await overlaysApi.update(eventId, row.id, patch);
      onChanged(updated);
      setNonce((n) => n + 1);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("studio.saveError"));
    } finally {
      setBusy(false);
    }
  };

  // Merge one config change into the FULL config (the backend replaces config wholesale).
  const saveCfg = (patch: Record<string, unknown>) => save({ config: { ...cfg, ...patch } });

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(url);
      toast.success(t("studio.copied", { name: row.name }));
    } catch {
      toast.error(t("studio.copyError"));
    }
  };

  const doRename = async () => {
    const name = nameDraft.trim();
    setRenaming(false);
    if (name && name !== row.name) await save({ name });
  };

  const doDuplicate = async () => {
    setBusy(true);
    try {
      const copyRow = await overlaysApi.duplicate(eventId, row.id);
      onDuplicated(copyRow);
      toast.success(t("studio.duplicated", { name: copyRow.name }));
    } catch {
      toast.error(t("studio.duplicateError"));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!window.confirm(t("studio.deleteConfirm", { name: row.name }))) return;
    setBusy(true);
    try {
      await overlaysApi.remove(eventId, row.id);
      onDeleted(row.id);
      toast.success(t("studio.deleted"));
    } catch {
      toast.error(t("studio.deleteError"));
    } finally {
      setBusy(false);
    }
  };

  // Timer: resolve duration/end-clock to an ISO end_at, save + activate.
  const trigger = async () => {
    let end_at: string | null = null;
    if (endClock) {
      const [h, m] = endClock.split(":").map(Number);
      if (Number.isFinite(h) && Number.isFinite(m)) {
        const d = new Date();
        d.setHours(h, m, 0, 0);
        if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
        end_at = d.toISOString();
      }
    } else {
      const total = (minutes || 0) * 60 + (seconds || 0);
      if (total > 0) end_at = new Date(Date.now() + total * 1000).toISOString();
    }
    if (!end_at) {
      toast.error(t("studio.timerNeedsDuration"));
      return;
    }
    await save({ active: true, config: { ...cfg, end_at, label: label.trim() } });
    toast.success(t("studio.timerLive"));
  };

  const stageGroups =
    stages.find((s) => String(s.stage_id) === String(cfg.stage_id ?? ""))?.groups ?? [];

  return (
    <div className="bg-card space-y-3 rounded-md border p-3 shadow-sm" style={{ width: PREVIEW_W + 26 }}>
      {/* ── Name row: inline rename + kind badge. ── */}
      <div className="flex items-center gap-2">
        {renaming ? (
          <>
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doRename()}
              className="h-7 text-xs"
              maxLength={80}
              autoFocus
            />
            <Button variant="outline" size="sm" className="h-7 px-2" onClick={doRename}>
              <IconCheck className="size-3.5" />
            </Button>
          </>
        ) : (
          <>
            <span className="text-foreground truncate text-sm font-semibold">{row.name}</span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => {
                setNameDraft(row.name);
                setRenaming(true);
              }}
              aria-label={t("studio.rename")}
            >
              <IconPencil className="size-3.5" />
            </button>
            <Badge variant="outline" className="ml-auto rounded-full px-2 py-0.5 text-xs capitalize">
              {row.kind === "timer" ? t("studio.kindTimer") : row.kind === "booyah" ? t("studio.kindBooyah") : row.kind === "h2h" ? t("studio.kindH2h") : t("studio.kindLeaderboard")}
            </Badge>
          </>
        )}
      </div>

      {/* ── Live preview: the overlay's REAL stable link, scaled. ── */}
      <div
        className="relative overflow-hidden rounded-md border bg-black"
        style={{ width: PREVIEW_W, height: PREVIEW_W * (9 / 16) }}
      >
        <iframe
          key={nonce}
          src={url}
          title={row.name}
          loading="lazy"
          className="origin-top-left border-0"
          style={{
            width: 1920,
            height: 1080,
            transform: `scale(${PREVIEW_W / 1920})`,
            pointerEvents: "none",
          }}
        />
        {row.kind !== "leaderboard" && !row.active ? (
          <span className="text-muted-foreground absolute inset-x-0 bottom-1.5 text-center text-[0.65rem]">
            {t("studio.timerHiddenHint")}
          </span>
        ) : null}
      </div>

      {/* ── Per-kind controls. Every change SAVES; the same link updates live. ── */}
      {row.kind === "leaderboard" ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">{t("studio.design")}</Label>
            <Select
              value={String(cfg.design_id ?? "")}
              onValueChange={(v) => saveCfg({ design_id: Number(v) })}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder={t("studio.pickDesign")} />
              </SelectTrigger>
              <SelectContent>
                {designs.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                    {d.is_default ? ` ${t("studio.defaultSuffix")}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 flex items-center gap-2">
            <Switch
              id={`follow-${row.id}`}
              checked={!!cfg.follow}
              onCheckedChange={(v) => saveCfg({ follow: v })}
            />
            <Label htmlFor={`follow-${row.id}`} className="text-xs">
              {t("studio.followBroadcast")}
            </Label>
          </div>

          {!cfg.follow ? (
            <>
              {/* Standings SCOPE (owner 2026-07-05, complaint C): a single group/stage, or COMBINE
                  many whole stages + individual groups into one cumulative board. Combine rides the
                  ONE stable link as config {scope:"combine", group_ids, stage_ids}; no link change. */}
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">{t("studio.scope")}</Label>
                <Select
                  value={String(cfg.scope || "single")}
                  onValueChange={(v) => saveCfg({ scope: v })}
                >
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">{t("studio.scopeSingle")}</SelectItem>
                    <SelectItem value="combine">{t("studio.scopeCombine")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {cfg.scope === "combine" ? (
                /* COMBINE picker: any mix of whole STAGES + individual GROUPS. Each toggle SAVES, so
                   the same link re-renders the merged board. A whole-stage pick implicitly includes
                   its groups (backend _expand_overlay_combine), so they show checked + disabled. */
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">{t("studio.combineUnits")}</Label>
                  <p className="text-muted-foreground text-[0.65rem]">{t("studio.combineHint")}</p>
                  <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border p-2">
                    {(() => {
                      const stageIds: number[] = Array.isArray(cfg.stage_ids)
                        ? cfg.stage_ids.map(Number)
                        : [];
                      const groupIds: number[] = Array.isArray(cfg.group_ids)
                        ? cfg.group_ids.map(Number)
                        : [];
                      return stages.map((s) => {
                        const sid = Number(s.stage_id);
                        const stageOn = stageIds.includes(sid);
                        return (
                          <div key={sid} className="space-y-1">
                            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                              <Checkbox
                                checked={stageOn}
                                onCheckedChange={(v) =>
                                  saveCfg({
                                    stage_ids:
                                      v === true
                                        ? [...new Set([...stageIds, sid])]
                                        : stageIds.filter((x) => x !== sid),
                                  })
                                }
                              />
                              {s.stage_name || `${t("studio.stage")} ${s.stage_id}`}
                              <span className="text-muted-foreground">
                                ({t("studio.wholeStage")})
                              </span>
                            </label>
                            <div className="ml-5 space-y-1">
                              {(s.groups ?? []).map((g) => {
                                const gid = Number(g.group_id);
                                return (
                                  <label
                                    key={gid}
                                    className="flex cursor-pointer items-center gap-2 text-xs"
                                  >
                                    <Checkbox
                                      checked={groupIds.includes(gid) || stageOn}
                                      disabled={stageOn}
                                      onCheckedChange={(v) =>
                                        saveCfg({
                                          group_ids:
                                            v === true
                                              ? [...new Set([...groupIds, gid])]
                                              : groupIds.filter((x) => x !== gid),
                                        })
                                      }
                                    />
                                    {g.group_name || `${t("studio.group")} ${g.group_id}`}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("studio.stage")}</Label>
                    <Select
                      value={String(cfg.stage_id ?? "")}
                      onValueChange={(v) => saveCfg({ stage_id: Number(v), group_id: null })}
                    >
                      <SelectTrigger className="h-8 w-full text-xs">
                        <SelectValue placeholder={t("studio.stage")} />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((s) => (
                          <SelectItem key={s.stage_id} value={String(s.stage_id)}>
                            {s.stage_name || `${t("studio.stage")} ${s.stage_id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("studio.group")}</Label>
                    <Select
                      value={cfg.group_id ? String(cfg.group_id) : "__all__"}
                      onValueChange={(v) =>
                        saveCfg({ group_id: v === "__all__" ? null : Number(v) })
                      }
                    >
                      <SelectTrigger className="h-8 w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{t("studio.allGroups")}</SelectItem>
                        {stageGroups.map((g) => (
                          <SelectItem key={g.group_id} value={String(g.group_id)}>
                            {g.group_name || `${t("studio.group")} ${g.group_id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </>
          ) : null}

          <div className="space-y-1">
            <Label className="text-xs">{t("studio.animation")}</Label>
            <Select value={String(cfg.anim || "fade")} onValueChange={(v) => saveCfg({ anim: v })}>
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fade">{t("studio.animFade")}</SelectItem>
                <SelectItem value="slide">{t("studio.animSlide")}</SelectItem>
                <SelectItem value="flash">{t("studio.animFlash")}</SelectItem>
                <SelectItem value="none">{t("studio.animNone")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("studio.reveal")}</Label>
            <Select
              value={String(cfg.reveal || "staggered")}
              onValueChange={(v) => saveCfg({ reveal: v })}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staggered">{t("studio.revealStaggered")}</SelectItem>
                <SelectItem value="all">{t("studio.revealAll")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            {/* Per-OVERLAY background behaviour (owner 2026-07-02: set inside the overlay, not the
                design): Always on = bg pre-paints, never animates; Animates in = bg fades in with
                the content on every load/refresh. Rides the stable link as &bg=. */}
            <Label className="text-xs">{t("studio.bgBehavior")}</Label>
            <Select
              value={String(cfg.bg_behavior || "persistent")}
              onValueChange={(v) => saveCfg({ bg_behavior: v })}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="persistent">{t("studio.bgPersistent")}</SelectItem>
                <SelectItem value="animate">{t("studio.bgAnimate")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("studio.interval")}</Label>
            <Select
              value={String(cfg.interval || 10)}
              onValueChange={(v) => saveCfg({ interval: Number(v) })}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 15, 20, 30].map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}s
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* LIVE in-round mode: standings from the capture client / 3D-room debugger push (2s
              snapshot) instead of upload-only - the board updates MID-ROUND. */}
          <div className="flex items-center gap-2 pt-4">
            <Switch
              id={`live-${row.id}`}
              checked={!!cfg.live}
              onCheckedChange={(v) => saveCfg({ live: v })}
            />
            <Label htmlFor={`live-${row.id}`} className="text-xs">
              {t("studio.live3d")}
            </Label>
          </div>
        </div>
      ) : row.kind === "timer" ? (
        /* ── Timer controls ── */
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{t("studio.minutes")}</Label>
            <Input
              type="number"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, e.target.valueAsNumber || 0))}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("studio.seconds")}</Label>
            <Input
              type="number"
              min={0}
              max={59}
              value={seconds}
              onChange={(e) => setSeconds(Math.min(59, Math.max(0, e.target.valueAsNumber || 0)))}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("studio.endClock")}</Label>
            <Input
              type="time"
              value={endClock}
              onChange={(e) => setEndClock(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("studio.timerLabel")}</Label>
            <Input
              placeholder={t("studio.timerLabelPh")}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={40}
              className="h-8 text-xs"
            />
          </div>
          <div className="col-span-2 flex gap-2">
            <Button size="sm" onClick={trigger} disabled={busy}>
              <IconPlayerPlay className="size-4" />
              {t("studio.trigger")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => save({ active: false })}
              disabled={busy || !row.active}
            >
              <IconPlayerStop className="size-4" />
              {t("studio.hide")}
            </Button>
          </div>
        </div>
      ) : row.kind === "h2h" ? (
        /* Head-to-head controls (owner 2026-07-02, v1): 2-3 teams OR players compared on their
           this-event stats; the picked design drives the bg + colors. Every change saves - the
           same link updates. */
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{t("studio.h2hMode")}</Label>
            <Select
              value={String(cfg.mode || "team")}
              onValueChange={(v) => saveCfg({ mode: v, competitor_ids: [] })}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">{t("studio.h2hTeams")}</SelectItem>
                <SelectItem value="player">{t("studio.h2hPlayers")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("studio.design")}</Label>
            <Select
              value={String(cfg.design_id ?? "")}
              onValueChange={(v) => saveCfg({ design_id: Number(v) })}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder={t("studio.pickDesign")} />
              </SelectTrigger>
              <SelectContent>
                {designs.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {[0, 1, 2].map((slot) => {
            const ids: number[] = Array.isArray(cfg.competitor_ids) ? cfg.competitor_ids : [];
            const setSlot = (v: string) => {
              const next = [...ids];
              next[slot] = Number(v);
              saveCfg({ competitor_ids: next.filter(Boolean).slice(0, 3) });
            };
            const options =
              (cfg.mode || "team") === "player"
                ? h2hPlayers.map((x) => ({ id: x.user_id, label: x.in_game_name }))
                : booyahTeams.map((x) => ({ id: x.team_id, label: x.team_name }));
            return (
              <div key={slot} className="space-y-1">
                <Label className="text-xs">
                  {t("studio.h2hSlot", { n: slot + 1 })}
                  {slot === 2 ? ` ${t("studio.h2hOptional")}` : ""}
                </Label>
                <Select value={ids[slot] ? String(ids[slot]) : ""} onValueChange={setSlot}>
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue placeholder={t("studio.h2hPick")} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
          <div className="col-span-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => save({ active: true })}
              disabled={busy || (Array.isArray(cfg.competitor_ids) ? cfg.competitor_ids : []).length < 2}
            >
              <IconPlayerPlay className="size-4" />
              {t("studio.trigger")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => save({ active: false })}
              disabled={busy || !row.active}
            >
              <IconPlayerStop className="size-4" />
              {t("studio.hide")}
            </Button>
          </div>
        </div>
      ) : (
        /* Booyah banner controls (owner 2026-07-02): auto-fires on each map's result upload, or
           trigger manually for a picked team. Auto-hides after the chosen duration. */
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2 flex items-center gap-2">
            <Switch
              id={`booyah-auto-${row.id}`}
              checked={!!cfg.auto}
              onCheckedChange={(v) => saveCfg({ auto: v })}
            />
            <Label htmlFor={`booyah-auto-${row.id}`} className="text-xs">
              {t("studio.booyahAuto")}
            </Label>
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">{t("studio.design")}</Label>
            <Select
              value={String(cfg.design_id ?? "")}
              onValueChange={(v) => saveCfg({ design_id: Number(v) })}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder={t("studio.pickDesign")} />
              </SelectTrigger>
              <SelectContent>
                {designs.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* LIVE mode (owner 2026-07-02): follow the leaderboard - the banner resolves the event's
              LATEST booyah on every poll and updates itself as new results land. Team/map picks are
              irrelevant while on (the feed overrides them), so they hide. */}
          <div className="col-span-2 flex items-center gap-2">
            <Switch
              id={`booyah-live-${row.id}`}
              checked={!!cfg.live}
              onCheckedChange={(v) => saveCfg({ live: v })}
            />
            <Label htmlFor={`booyah-live-${row.id}`} className="text-xs">
              {t("studio.booyahFollow")}
            </Label>
          </div>
          {cfg.live ? null : (
          <>
          <div className="space-y-1">
            <Label className="text-xs">{t("studio.booyahTeam")}</Label>
            <Select value={booyahTeamId} onValueChange={setBooyahTeamId}>
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder={t("studio.booyahPickTeam")} />
              </SelectTrigger>
              <SelectContent>
                {booyahTeams.map((x) => (
                  <SelectItem key={x.team_id} value={String(x.team_id)}>
                    {x.team_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("studio.booyahMap")}</Label>
            <Input
              placeholder="Bermuda"
              value={booyahMap}
              onChange={(e) => setBooyahMap(e.target.value)}
              className="h-8 text-xs"
              maxLength={20}
            />
          </div>
          </>
          )}
          <div className="col-span-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => (cfg.live ? save({ active: true }) : triggerBooyah())}
              disabled={busy}
            >
              <IconPlayerPlay className="size-4" />
              {t("studio.trigger")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => save({ active: false })}
              disabled={busy || !row.active}
            >
              <IconPlayerStop className="size-4" />
              {t("studio.hide")}
            </Button>
          </div>
        </div>
      )}

      {/* ── Actions: the stable link + duplicate/delete. ── */}
      <div className="flex items-center gap-1 border-t pt-2">
        <Button variant="outline" size="sm" className="h-7 px-2" onClick={copy}>
          <IconCopy className="size-3.5" />
          {t("studio.copyLink")}
        </Button>
        <Button variant="outline" size="sm" className="h-7 px-2" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <IconExternalLink className="size-3.5" />
          </a>
        </Button>
        <div className="ml-auto flex gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={doDuplicate} disabled={busy}>
            <IconCopyPlus className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="hover:text-destructive h-7 px-2"
            onClick={doDelete}
            disabled={busy}
          >
            <IconTrash className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── The studio body. ────────────────────────────────────────────────────────
   Props:
     eventId        - the event whose overlays are managed
     eventName      - display title (the wrapper page resolves it)
     organizationId - scopes the design library (null = the AFC-native library)
     backHref       - "all events" link of the host portal
     leaderboardHref- the host portal's leaderboard page for this event (null = hide the button)
*/
export function EventOverlayStudio({
  eventId,
  eventName,
  organizationId,
  backHref,
  leaderboardHref,
}: {
  eventId: number;
  eventName: string;
  organizationId: number | null;
  backHref: string;
  leaderboardHref?: string | null;
}) {
  const t = useTranslations("organizer");
  const [loading, setLoading] = useState(true);
  const [overlayToken, setOverlayToken] = useState("");
  const [designs, setDesigns] = useState<LeaderboardDesign[]>([]);
  const [stages, setStages] = useState<StageNode[]>([]);
  const [overlays, setOverlays] = useState<EventOverlayRow[]>([]);
  const [newDesignId, setNewDesignId] = useState("");

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const [tok, bc, rows, res] = await Promise.all([
        overlayTokenApi.ensure(eventId),
        broadcastApi.get(eventId).catch(() => null),
        overlaysApi.list(eventId),
        // Org-scoped library: an organizer only ever gets THEIR designs here.
        leaderboardDesignsApi.list(organizationId ?? null),
      ]);
      setOverlayToken(tok);
      setStages((bc?.stages ?? []) as StageNode[]);
      setOverlays(rows);
      const lib = res?.results ?? [];
      setDesigns(lib);
      const def = lib.find((d) => d.is_default) ?? lib[0];
      setNewDesignId(def ? String(def.id) : "");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("studio.loadError"));
    } finally {
      setLoading(false);
    }
  }, [eventId, organizationId, t]);

  useEffect(() => {
    load();
  }, [load]);

  // Live refresh (owner 2026-07-02): on the site-wide tick, re-pull ONLY the saved-overlays list
  // (never the full `load` - that would flash the FullLoader and reset the "New overlay" design
  // pick; designs/stages/token change rarely and stay as loaded). Cards keep stable row.id keys,
  // so per-card local state (inline rename draft, timer/booyah drafts) survives the row refresh.
  // Silent on failure - no toasts from a background poll.
  const tick = useLiveTick();
  useEffect(() => {
    if (tick === 0 || !eventId) return;
    overlaysApi
      .list(eventId)
      .then(setOverlays)
      .catch(() => {});
  }, [tick, eventId]);

  // ── Create: a leaderboard overlay FROM the picked design, or a timer scene. ──
  const addLeaderboard = async () => {
    const design = designs.find((d) => String(d.id) === newDesignId);
    if (!design) {
      toast.error(t("studio.pickDesignFirst"));
      return;
    }
    try {
      const row = await overlaysApi.create(eventId, {
        name: design.name,
        kind: "leaderboard",
        config: {
          design_id: design.id,
          follow: false,
          // Standings scope: "single" (one stage/group, the default) or "combine" (merge many).
          scope: "single",
          stage_id: stages[0]?.stage_id ?? null,
          group_id: null,
          group_ids: [],
          stage_ids: [],
          anim: "fade",
          reveal: "staggered",
          interval: 10,
          live: false,
        },
      });
      setOverlays((prev) => [...prev, row]);
      toast.success(t("studio.created", { name: row.name }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("studio.createError"));
    }
  };

  const addBooyah = async () => {
    try {
      const row = await overlaysApi.create(eventId, {
        name: t("studio.kindBooyah"),
        kind: "booyah",
        config: { auto: true, live: true, design_id: designs[0]?.id ?? null },
      });
      setOverlays((prev) => [...prev, row]);
      toast.success(t("studio.booyahCreated"));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("studio.createError"));
    }
  };

  const addH2h = async () => {
    try {
      const row = await overlaysApi.create(eventId, {
        name: t("studio.kindH2h"),
        kind: "h2h",
        config: { mode: "team", competitor_ids: [], design_id: designs[0]?.id ?? null },
      });
      setOverlays((prev) => [...prev, row]);
      toast.success(t("studio.h2hCreated"));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("studio.createError"));
    }
  };

  const addTimer = async () => {
    try {
      const row = await overlaysApi.create(eventId, {
        name: t("studio.kindTimer"),
        kind: "timer",
        config: { label: "" },
      });
      setOverlays((prev) => [...prev, row]);
      toast.success(t("studio.timerCreated"));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("studio.createError"));
    }
  };

  const copyCaptureKey = async () => {
    try {
      const k = await uploadTokenApi.ensure(eventId);
      await navigator.clipboard?.writeText(k);
      toast.success(t("studio.captureKeyCopied"));
    } catch {
      toast.error(t("studio.captureKeyError"));
    }
  };

  if (loading) return <FullLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title={eventName} description={t("studio.pageDescription")} />
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={backHref}>
              <IconArrowLeft className="size-4" />
              {t("studio.allEvents")}
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={copyCaptureKey}>
            <IconKey className="size-4" />
            {t("studio.captureKey")}
          </Button>
          {leaderboardHref ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={leaderboardHref}>
                <IconChartBar className="size-4" />
                {t("studio.leaderboard")}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {/* ── New overlay: from a design, or a timer scene. ── */}
      <div
        className="bg-card flex flex-wrap items-end gap-3 rounded-md border p-4 shadow-sm"
        data-tour="studio-new-overlay"
      >
        <div className="flex items-center gap-2">
          <IconLayoutGrid className="text-primary size-4" />
          <h3 className="text-primary text-sm font-semibold">{t("studio.newOverlay")}</h3>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("studio.fromDesign")}</Label>
          <Select value={newDesignId} onValueChange={setNewDesignId}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue placeholder={t("studio.pickDesign")} />
            </SelectTrigger>
            <SelectContent>
              {designs.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                  {d.is_default ? ` ${t("studio.defaultSuffix")}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={addLeaderboard} disabled={!newDesignId}>
          <IconPlus className="size-4" />
          {t("studio.addLeaderboard")}
        </Button>
        <Button variant="outline" size="sm" onClick={addTimer}>
          <IconClock className="size-4" />
          {t("studio.addTimer")}
        </Button>
        <Button variant="outline" size="sm" onClick={addBooyah}>
          <IconTrophy className="size-4" />
          {t("studio.addBooyah")}
        </Button>
        <Button variant="outline" size="sm" onClick={addH2h}>
          <IconSwords className="size-4" />
          {t("studio.addH2h")}
        </Button>
      </div>

      {/* ── The overlay cards. ── */}
      {overlays.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {t("studio.empty")}
        </p>
      ) : (
        <div className="flex flex-wrap gap-4" data-tour="studio-cards">
          {overlays.map((row) => (
            <OverlayCard
              key={row.id}
              eventId={eventId}
              overlayToken={overlayToken}
              row={row}
              designs={designs}
              stages={stages}
              onChanged={(u) =>
                setOverlays((prev) => prev.map((r) => (r.id === u.id ? u : r)))
              }
              onDeleted={(id) => setOverlays((prev) => prev.filter((r) => r.id !== id))}
              onDuplicated={(u) => setOverlays((prev) => [...prev, u])}
            />
          ))}
        </div>
      )}

      {/* ── Broadcast control + media hygiene, side by side. ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div data-tour="studio-broadcast">
          <BroadcastControl eventId={eventId} />
        </div>
        <MediaAuditCard eventId={eventId} />
        {/* Broadcast Kit (owner 2026-07-03): download the customized FF PC client files. */}
        <BroadcastKitCard eventId={eventId} />
      </div>
    </div>
  );
}
