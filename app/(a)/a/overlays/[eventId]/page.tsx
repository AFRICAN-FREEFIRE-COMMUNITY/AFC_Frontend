"use client";

// ── Admin · Live Overlays · EVENT STUDIO (/a/overlays/[eventId]) ─────────────
// Owner 2026-07-02 (studio v2): overlays are SAVED, NAMED entities under an event.
//   • Create a new overlay FROM A DESIGN (or a Timer scene) — as many as you want.
//   • Each overlay card shows a LIVE preview (its real, STABLE link /overlay/view/<token>/<id> in a
//     scaled iframe) + its own controls: design, stage/group or follow-broadcast, animations, page
//     interval, LIVE in-round mode (the capture client / 3D-room debugger feed) — every change SAVES
//     to the overlay, and the SAME link updates in OBS. No re-copying.
//   • Rename (inline), Duplicate, Delete, Copy link, Open — per overlay.
//   • Timer overlays: duration/end-clock/label + Trigger/Hide (transparent while hidden).
// The Broadcast control (for overlays set to "follow") + capture key live here too.
// DATA: overlaysApi (CRUD) + overlayTokenApi + leaderboardDesignsApi.list + broadcastApi.get (stage
// tree) + get-all-events (name). BE: afc_tournament_and_scrims/views_overlays.py.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import axios from "axios";

import { PageHeader } from "@/components/PageHeader";
import { FullLoader } from "@/components/Loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  IconTrash,
  IconCopyPlus,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
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
      toast.error(err?.response?.data?.message || "Could not save the overlay.");
    } finally {
      setBusy(false);
    }
  };

  // Merge one config change into the FULL config (the backend replaces config wholesale).
  const saveCfg = (patch: Record<string, unknown>) => save({ config: { ...cfg, ...patch } });

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(url);
      toast.success(`Copied "${row.name}" - the link stays the same forever.`);
    } catch {
      toast.error("Could not copy the link.");
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
      toast.success(`Duplicated as "${copyRow.name}".`);
    } catch {
      toast.error("Could not duplicate the overlay.");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!window.confirm(`Delete overlay "${row.name}"? Its link will go blank in OBS.`)) return;
    setBusy(true);
    try {
      await overlaysApi.remove(eventId, row.id);
      onDeleted(row.id);
      toast.success("Overlay deleted.");
    } catch {
      toast.error("Could not delete the overlay.");
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
      toast.error("Set a duration or an end clock first.");
      return;
    }
    await save({ active: true, config: { ...cfg, end_at, label: label.trim() } });
    toast.success("Timer is live.");
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
              aria-label="Rename overlay"
            >
              <IconPencil className="size-3.5" />
            </button>
            <Badge variant="outline" className="ml-auto rounded-full px-2 py-0.5 text-xs capitalize">
              {row.kind}
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
        {row.kind === "timer" && !row.active ? (
          <span className="text-muted-foreground absolute inset-x-0 bottom-1.5 text-center text-[0.65rem]">
            Hidden - transparent until triggered.
          </span>
        ) : null}
      </div>

      {/* ── Per-kind controls. Every change SAVES; the same link updates live. ── */}
      {row.kind === "leaderboard" ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Design</Label>
            <Select
              value={String(cfg.design_id ?? "")}
              onValueChange={(v) => saveCfg({ design_id: Number(v) })}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder="Pick a design" />
              </SelectTrigger>
              <SelectContent>
                {designs.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                    {d.is_default ? " (default)" : ""}
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
              Follow the broadcast selection
            </Label>
          </div>

          {!cfg.follow ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Stage</Label>
                <Select
                  value={String(cfg.stage_id ?? "")}
                  onValueChange={(v) => saveCfg({ stage_id: Number(v), group_id: null })}
                >
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue placeholder="Stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.stage_id} value={String(s.stage_id)}>
                        {s.stage_name || `Stage ${s.stage_id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Group</Label>
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
                    <SelectItem value="__all__">All groups</SelectItem>
                    {stageGroups.map((g) => (
                      <SelectItem key={g.group_id} value={String(g.group_id)}>
                        {g.group_name || `Group ${g.group_id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}

          <div className="space-y-1">
            <Label className="text-xs">Animation</Label>
            <Select value={String(cfg.anim || "fade")} onValueChange={(v) => saveCfg({ anim: v })}>
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fade">Fade</SelectItem>
                <SelectItem value="slide">Slide</SelectItem>
                <SelectItem value="flash">Flash</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Row reveal</Label>
            <Select
              value={String(cfg.reveal || "staggered")}
              onValueChange={(v) => saveCfg({ reveal: v })}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staggered">Staggered</SelectItem>
                <SelectItem value="all">All at once</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Page interval</Label>
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
          {/* LIVE in-round mode (owner): standings from the capture client / 3D-room debugger push
              (2s Redis snapshot) instead of upload-only - the board updates MID-ROUND. */}
          <div className="flex items-center gap-2 pt-4">
            <Switch
              id={`live-${row.id}`}
              checked={!!cfg.live}
              onCheckedChange={(v) => saveCfg({ live: v })}
            />
            <Label htmlFor={`live-${row.id}`} className="text-xs">
              Live 3D-room data
            </Label>
          </div>
        </div>
      ) : (
        /* ── Timer controls ── */
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Minutes</Label>
            <Input
              type="number"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, e.target.valueAsNumber || 0))}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Seconds</Label>
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
            <Label className="text-xs">Or end clock (local)</Label>
            <Input
              type="time"
              value={endClock}
              onChange={(e) => setEndClock(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Label (optional)</Label>
            <Input
              placeholder="e.g. NEXT MATCH"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={40}
              className="h-8 text-xs"
            />
          </div>
          <div className="col-span-2 flex gap-2">
            <Button size="sm" onClick={trigger} disabled={busy}>
              <IconPlayerPlay className="size-4" />
              Trigger
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => save({ active: false })}
              disabled={busy || !row.active}
            >
              <IconPlayerStop className="size-4" />
              Hide
            </Button>
          </div>
        </div>
      )}

      {/* ── Actions: the stable link + duplicate/delete. ── */}
      <div className="flex items-center gap-1 border-t pt-2">
        <Button variant="outline" size="sm" className="h-7 px-2" onClick={copy}>
          <IconCopy className="size-3.5" />
          Copy link
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

/* ── The studio page. ────────────────────────────────────────────────────────── */
export default function EventOverlayStudioPage() {
  const { token: authToken } = useAuth();
  const params = useParams<{ eventId: string }>();
  const eventId = Number(params?.eventId);

  const [loading, setLoading] = useState(true);
  const [eventName, setEventName] = useState("");
  const [overlayToken, setOverlayToken] = useState("");
  const [designs, setDesigns] = useState<LeaderboardDesign[]>([]);
  const [stages, setStages] = useState<StageNode[]>([]);
  const [overlays, setOverlays] = useState<EventOverlayRow[]>([]);
  const [newDesignId, setNewDesignId] = useState("");

  const load = useCallback(async () => {
    if (!authToken || !eventId) return;
    setLoading(true);
    try {
      const [evRes, tok, bc, rows] = await Promise.all([
        axios.get<{ events?: any[] } | any[]>(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
          { headers: { Authorization: `Bearer ${authToken}` } },
        ),
        overlayTokenApi.ensure(eventId),
        broadcastApi.get(eventId).catch(() => null),
        overlaysApi.list(eventId),
      ]);
      const all = Array.isArray(evRes.data) ? evRes.data : (evRes.data.events ?? []);
      const ev = all.find((e: any) => Number(e.event_id) === eventId);
      setEventName(ev?.event_name || `Event ${eventId}`);
      setOverlayToken(tok);
      setStages((bc?.stages ?? []) as StageNode[]);
      setOverlays(rows);
      // Design library is org-scoped (null = AFC-native).
      const org = ev?.organization ?? ev?.organization_id ?? null;
      const res = await leaderboardDesignsApi.list(org ?? null);
      const lib = res?.results ?? [];
      setDesigns(lib);
      const def = lib.find((d) => d.is_default) ?? lib[0];
      setNewDesignId(def ? String(def.id) : "");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not load the overlays.");
    } finally {
      setLoading(false);
    }
  }, [authToken, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Create: a leaderboard overlay FROM the picked design, or a timer scene. ──
  const addLeaderboard = async () => {
    const design = designs.find((d) => String(d.id) === newDesignId);
    if (!design) {
      toast.error("Pick a design first.");
      return;
    }
    try {
      const row = await overlaysApi.create(eventId, {
        name: design.name,
        kind: "leaderboard",
        config: {
          design_id: design.id,
          follow: false,
          stage_id: stages[0]?.stage_id ?? null,
          group_id: null,
          anim: "fade",
          reveal: "staggered",
          interval: 10,
          live: false,
        },
      });
      setOverlays((prev) => [...prev, row]);
      toast.success(`Overlay "${row.name}" created - copy its link once, edit it forever.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not create the overlay.");
    }
  };

  const addTimer = async () => {
    try {
      const row = await overlaysApi.create(eventId, {
        name: "Timer",
        kind: "timer",
        config: { label: "" },
      });
      setOverlays((prev) => [...prev, row]);
      toast.success("Timer overlay created.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not create the timer.");
    }
  };

  const copyCaptureKey = async () => {
    try {
      const k = await uploadTokenApi.ensure(eventId);
      await navigator.clipboard?.writeText(k);
      toast.success("Capture key copied. Paste it into AFC Capture.");
    } catch {
      toast.error("Could not generate the capture key.");
    }
  };

  if (loading) return <FullLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title={eventName}
          description="This event's saved overlays. Each has ONE permanent link: add it to OBS/vMix once, then change its design, stage or group, animations, or trigger it from here - the link updates by itself."
        />
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/a/overlays">
              <IconArrowLeft className="size-4" />
              All events
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={copyCaptureKey}>
            <IconKey className="size-4" />
            Capture key
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/a/leaderboards/${eventId}/edit`}>
              <IconChartBar className="size-4" />
              Leaderboard
            </Link>
          </Button>
        </div>
      </div>

      {/* ── New overlay: from a design, or a timer scene. ── */}
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-md border p-4 shadow-sm" data-tour="studio-new-overlay">
        <div className="flex items-center gap-2">
          <IconLayoutGrid className="text-primary size-4" />
          <h3 className="text-primary text-sm font-semibold">New overlay</h3>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From design</Label>
          <Select value={newDesignId} onValueChange={setNewDesignId}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue placeholder="Pick a design" />
            </SelectTrigger>
            <SelectContent>
              {designs.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                  {d.is_default ? " (default)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={addLeaderboard} disabled={!newDesignId}>
          <IconPlus className="size-4" />
          Add leaderboard overlay
        </Button>
        <Button variant="outline" size="sm" onClick={addTimer}>
          <IconClock className="size-4" />
          Add timer
        </Button>
      </div>

      {/* ── The overlay cards. ── */}
      {overlays.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          No overlays yet. Create one from a design above - you get a permanent link to drop into
          OBS, then manage everything from here.
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

      {/* ── Broadcast control: what "follow the broadcast selection" overlays show. ── */}
      <div className="max-w-2xl" data-tour="studio-broadcast">
        <BroadcastControl eventId={eventId} />
      </div>
    </div>
  );
}
