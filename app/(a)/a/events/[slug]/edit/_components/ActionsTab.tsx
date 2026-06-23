"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader } from "@/components/Loader";
import { InfoTip } from "@/components/ui/info-tip";
// Shared "what is this about?" deep-link picker. broadcast-announcement accepts
// target_type + target_id, so we pass the selector's value straight through.
import {
  NotificationTargetSelector,
  EMPTY_TARGET,
  type NotificationTarget,
  type EventOption,
} from "@/app/(a)/a/_components/NotificationTargetSelector";
// Broadcast history list (event-scoped). Shown in a dialog from the Communication card.
import { BroadcastHistory } from "@/app/(a)/a/_components/BroadcastHistory";
import {
  CheckCircle2,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Megaphone,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Users,
  XCircle,
  Undo2,
  Shuffle,
  Trash2,
  AlertTriangle,
} from "lucide-react";

interface Group {
  group_id: number;
  group_name: string;
}

interface Stage {
  stage_id: number;
  stage_name: string;
  stage_status?: string;
  groups: Group[];
}

interface ActionsTabProps {
  eventDetails: {
    event_status: string;
    event_name: string;
    event_id: number;
    participant_type: string;
    is_public: boolean;
    stages: Stage[];
    // Event end date (YYYY-MM-DD) — caps the roster-edit window picker. From get-event-details.
    end_date?: string;
    // Roster-edit window (owner 2026-06-15): current state for the Roster Editing card.
    roster_edit_until?: string | null;
    roster_edit_open?: boolean;
  };
  onStartTournament: () => void;
  onRefresh?: () => void;
  // ── Discord omission (organizer reuse) ──────────────────────────────────────
  // When true, the "Sync Discord Roles" control is hidden (organizers don't manage
  // AFC's Discord automation). Every other action - start/cancel/complete/seed/
  // advance/broadcast/visibility/export - stays available. The admin edit page
  // leaves this undefined (defaults false), so its Actions tab is unchanged.
  hideDiscord?: boolean;
}

export default function ActionsTab({
  eventDetails,
  onStartTournament,
  onRefresh,
  hideDiscord = false,
}: ActionsTabProps) {
  const { token } = useAuth();
  const API = env.NEXT_PUBLIC_BACKEND_API_URL;
  const status = eventDetails.event_status;
  const isTeam = eventDetails.participant_type !== "solo";
  const authHeader = { Authorization: `Bearer ${token}` };

  // loading
  const [loadingCancel, setLoadingCancel] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [loadingSeed, setLoadingSeed] = useState(false);
  const [loadingAdvance, setLoadingAdvance] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);
  const [loadingAnnouncement, setLoadingAnnouncement] = useState(false);
  const [loadingVisibility, setLoadingVisibility] = useState(false);
  const [loadingExport, setLoadingExport] = useState<"csv" | "xlsx" | null>(null);
  // Roster-edit window (owner 2026-06-15): admin/organizer opens team roster-editing for a set
  // period that auto-closes; the picker is capped at the event end date. Backed by
  // POST /events/roster-edit-window/ (set_roster_edit_window) + enforced in edit_roster.
  const [loadingRosterWindow, setLoadingRosterWindow] = useState(false);
  const [rosterUntilInput, setRosterUntilInput] = useState("");
  // The roster window AUTO-CLOSES purely by time (server: Event.roster_edit_open = now <=
  // roster_edit_until). The eventDetails.roster_edit_open we received is only a SNAPSHOT from the
  // last fetch, so a panel left open past the deadline kept showing "Open until ..." (owner
  // 2026-06-23). Derive the live open/closed state from roster_edit_until vs the wall clock, and
  // tick every 30s so an idle panel flips to "Closed" the moment the deadline passes — no refetch
  // needed. The backend stays the enforcement authority (edit_roster recomputes on every call).
  const [, setRosterNowTick] = useState(0);
  const rosterUntilMs = (eventDetails as any).roster_edit_until
    ? new Date((eventDetails as any).roster_edit_until).getTime()
    : null;
  const rosterEditOpen = rosterUntilMs != null && Date.now() < rosterUntilMs;
  useEffect(() => {
    if (rosterUntilMs == null) return;
    const id = setInterval(() => setRosterNowTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [rosterUntilMs]);

  // dialogs
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);

  // selectors
  const [seedStageId, setSeedStageId] = useState("");
  const [advanceStageId, setAdvanceStageId] = useState("");
  const [advanceGroupId, setAdvanceGroupId] = useState("");
  const [syncGroupId, setSyncGroupId] = useState("");

  // ── Seeding management (owner 2026-06-15): undo/redo group seeding + delete group/stage
  //    with a disposition choice. Calls events/seeding/* (afc_tournament_and_scrims.seeding_management).
  //    Shown to admins AND organizers (this component is reused on the organizer event-edit page);
  //    the backend gate (event admin OR can_manage_registrations) is the real authority. ──
  const [mgmtStageId, setMgmtStageId] = useState("");        // stage for undo / reseed
  const [reseedShuffle, setReseedShuffle] = useState(true);  // fresh shuffle on reseed
  const [loadingUndo, setLoadingUndo] = useState(false);
  const [loadingReseed, setLoadingReseed] = useState(false);

  const [delGroupId, setDelGroupId] = useState("");
  const [delGroupMode, setDelGroupMode] = useState<"auto" | "manual" | "delete_all">("auto");
  const [delGroupOpen, setDelGroupOpen] = useState(false);
  const [loadingDelGroup, setLoadingDelGroup] = useState(false);

  const [delStageId, setDelStageId] = useState("");
  const [delStageMode, setDelStageMode] = useState<"auto" | "manual" | "delete_all">("auto");
  const [delStageTargetId, setDelStageTargetId] = useState("");
  const [delStageOpen, setDelStageOpen] = useState(false);
  const [loadingDelStage, setLoadingDelStage] = useState(false);

  // Played-results guard: when an endpoint returns 400 {requires_force}, we surface this confirm
  // and re-run the SAME request with force=true on confirm.
  const [forceConfirm, setForceConfirm] = useState<{
    open: boolean;
    message: string;
    onConfirm: () => void;
  }>({ open: false, message: "", onConfirm: () => {} });

  // announcement form
  const [annTitle, setAnnTitle] = useState("");
  const [annMessage, setAnnMessage] = useState("");
  // Delivery channel (owner 2026-06-13): app push / email (branded) / both. Default both.
  const [annDelivery, setAnnDelivery] = useState<"both" | "push" | "email">("both");
  // Optional deep link for the broadcast's "Take me there" button. Defaults to
  // "none" so an unset link never breaks the existing broadcast behavior.
  const [annTarget, setAnnTarget] = useState<NotificationTarget>(EMPTY_TARGET);
  // Multi-event link selection (owner 2026-06-17): when the link type is "event", the admin can
  // search + pick several events; these become the broadcast `targets` array.
  const [annEvents, setAnnEvents] = useState<EventOption[]>([]);
  // Broadcast SCOPE (owner 2026-06-17): whole event / a stage / a group. Drives which endpoint the
  // send hits (broadcast-announcement / broadcast-to-stage / broadcast-to-group).
  const [annScope, setAnnScope] = useState<"event" | "stage" | "group">("event");
  const [annStageId, setAnnStageId] = useState<string>("");
  const [annGroupId, setAnnGroupId] = useState<string>("");
  // Broadcast history dialog (event-scoped SentBroadcast list).
  const [historyOpen, setHistoryOpen] = useState(false);

  const advanceStage = eventDetails.stages.find(
    (s) => s.stage_id === Number(advanceStageId),
  );

  // ── handlers ──────────────────────────────────────────────────────────

  async function handleCancel() {
    setLoadingCancel(true);
    try {
      const res = await axios.post(
        `${API}/events/cancel-event/`,
        { event_id: eventDetails.event_id },
        { headers: authHeader },
      );
      toast.success(res.data.message);
      setCancelOpen(false);
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to cancel event");
    } finally {
      setLoadingCancel(false);
    }
  }

  // Open or close the team roster-edit window. `open=true` sends the picked datetime as `until`
  // (ISO); the backend rejects a past time or one later than the event end date, and the window
  // auto-closes once that instant passes. `open=false` clears it. onRefresh re-pulls so the shown
  // state + "open until" updates. (owner 2026-06-15)
  async function handleSetRosterWindow(open: boolean) {
    setLoadingRosterWindow(true);
    try {
      const body: Record<string, any> = { event_id: eventDetails.event_id };
      if (open) {
        if (!rosterUntilInput) {
          toast.error("Pick the date & time the roster-edit window should close.");
          setLoadingRosterWindow(false);
          return;
        }
        body.until = new Date(rosterUntilInput).toISOString();
      } else {
        body.open = false;
      }
      const res = await axios.post(`${API}/events/roster-edit-window/`, body, {
        headers: authHeader,
      });
      toast.success(
        open
          ? "Roster editing is now open for teams."
          : "Roster editing closed for teams.",
      );
      onRefresh?.();
    } catch (e: any) {
      toast.error(
        e.response?.data?.message || "Failed to update the roster-edit window",
      );
    } finally {
      setLoadingRosterWindow(false);
    }
  }

  async function handleComplete() {
    setLoadingComplete(true);
    try {
      const res = await axios.post(
        `${API}/events/complete-event/`,
        { event_id: eventDetails.event_id },
        { headers: authHeader },
      );
      toast.success(res.data.message);
      setCompleteOpen(false);
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to complete event");
    } finally {
      setLoadingComplete(false);
    }
  }

  async function handleSeedToGroups() {
    if (!seedStageId) return toast.error("Select a stage first");
    setLoadingSeed(true);
    try {
      const endpoint = isTeam
        ? `${API}/events/seed-stage-competitors-to-groups-team/`
        : `${API}/events/seed-stage-competitors-to-groups/`;
      const res = await axios.post(
        endpoint,
        { stage_id: seedStageId },
        { headers: authHeader },
      );
      toast.success(res.data.message);
      // Seeding repopulates the stage's groups; refetch so the new group rosters show
      // in place (no manual reload). onRefresh = the edit page's fetchEventDetails.
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Seeding failed");
    } finally {
      setLoadingSeed(false);
    }
  }

  async function handleAdvanceStage() {
    if (!advanceGroupId) return toast.error("Select a stage and group first");
    setLoadingAdvance(true);
    try {
      const res = await axios.post(
        `${API}/events/advance-group-competitors-to-next-stage/`,
        { event_id: eventDetails.event_id, group_id: advanceGroupId },
        { headers: authHeader },
      );
      toast.success(res.data.message || "Stage advanced successfully");
      // Advancing moves competitors into the next stage; refetch so the updated stage
      // composition shows in place (no manual reload). onRefresh = fetchEventDetails.
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Advance failed");
    } finally {
      setLoadingAdvance(false);
    }
  }

  // ── Seeding-management runner ───────────────────────────────────────────
  // Generic POST for the events/seeding/* endpoints. On a 400 {requires_force} (a group/stage
  // that already has entered results), opens the force-confirm dialog and re-runs with force=true.
  async function runSeedingAction(opts: {
    url: string;
    body: Record<string, any>;
    setLoading: (b: boolean) => void;
  }) {
    opts.setLoading(true);
    try {
      const res = await axios.post(opts.url, opts.body, { headers: authHeader });
      toast.success(res.data.message || "Done");
      onRefresh?.();
    } catch (e: any) {
      const data = e.response?.data;
      if (e.response?.status === 400 && data?.requires_force) {
        setForceConfirm({
          open: true,
          message: data.message,
          onConfirm: () => {
            setForceConfirm((s) => ({ ...s, open: false }));
            runSeedingAction({ ...opts, body: { ...opts.body, force: true } });
          },
        });
      } else {
        toast.error(data?.message || "Action failed");
      }
    } finally {
      opts.setLoading(false);
    }
  }

  function handleUndoSeeding() {
    if (!mgmtStageId) return toast.error("Select a stage first");
    runSeedingAction({
      url: `${API}/events/seeding/undo/`,
      body: { stage_id: mgmtStageId },
      setLoading: setLoadingUndo,
    });
  }

  function handleReseed() {
    if (!mgmtStageId) return toast.error("Select a stage first");
    runSeedingAction({
      url: `${API}/events/seeding/reseed/`,
      body: { stage_id: mgmtStageId, shuffle: reseedShuffle, clear_existing: true },
      setLoading: setLoadingReseed,
    });
  }

  function handleDeleteGroup() {
    if (!delGroupId) return toast.error("Select a group first");
    setDelGroupOpen(false);
    runSeedingAction({
      url: `${API}/events/seeding/delete-group/`,
      body: { group_id: delGroupId, mode: delGroupMode },
      setLoading: setLoadingDelGroup,
    });
  }

  function handleDeleteStage() {
    if (!delStageId) return toast.error("Select a stage first");
    if (delStageMode !== "delete_all" && !delStageTargetId)
      return toast.error("Select a target stage to move competitors into");
    setDelStageOpen(false);
    runSeedingAction({
      url: `${API}/events/seeding/delete-stage/`,
      body: {
        stage_id: delStageId,
        mode: delStageMode,
        ...(delStageMode !== "delete_all" ? { target_stage_id: delStageTargetId } : {}),
      },
      setLoading: setLoadingDelStage,
    });
  }

  async function handleSyncDiscord() {
    if (!syncGroupId) return toast.error("Select a group first");
    setLoadingSync(true);
    try {
      const res = await axios.post(
        `${API}/events/sync-group-discord-roles/`,
        { group_id: syncGroupId },
        { headers: authHeader },
      );
      toast.success(res.data.message || "Discord roles synced");
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Sync failed");
    } finally {
      setLoadingSync(false);
    }
  }

  // Pause / resume a started Stage 1 (owner 2026-06-13). After Start seeds the stage to
  // ongoing, the Start button becomes "Started" and this toggles ongoing <-> paused.
  const [loadingStageStatus, setLoadingStageStatus] = useState(false);
  async function handleSetStageStatus(nextStatus: "ongoing" | "paused") {
    const stageId = eventDetails.stages[0]?.stage_id;
    if (!stageId) return;
    setLoadingStageStatus(true);
    try {
      const res = await axios.post(
        `${API}/events/set-stage-status/`,
        { event_id: eventDetails.event_id, stage_id: stageId, status: nextStatus },
        { headers: authHeader },
      );
      toast.success(res.data.message);
      // The page owns the stage status; refetch so the badge + this control re-render
      // in place (no manual page reload). onRefresh = the edit page's fetchEventDetails.
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Could not update the stage.");
    } finally {
      setLoadingStageStatus(false);
    }
  }

  async function handleBroadcast() {
    if (!annTitle.trim() || !annMessage.trim())
      return toast.error("Title and message are required");
    if (annScope === "stage" && !annStageId)
      return toast.error("Pick a stage to broadcast to");
    if (annScope === "group" && !annGroupId)
      return toast.error("Pick a group to broadcast to");
    setLoadingAnnouncement(true);
    try {
      // Build the deep-link target(s): for the "event" link type the admin may have selected
      // several events (multi) -> send a `targets` array; for any other single type send the
      // legacy target_type/target_id. "none" sends nothing.
      const linkPayload: Record<string, unknown> = {};
      if (annTarget.target_type === "event" && annEvents.length > 0) {
        linkPayload.targets = annEvents.map((e) => ({
          target_type: "event",
          target_id: e.slug,
        }));
      } else if (annTarget.target_type !== "none") {
        linkPayload.target_type = annTarget.target_type;
        linkPayload.target_id = annTarget.target_id.trim();
      }

      // Route by scope: whole event / one stage / one group.
      let url = `${API}/events/broadcast-announcement/`;
      const body: Record<string, unknown> = {
        event_id: eventDetails.event_id,
        title: annTitle,
        message: annMessage,
        delivery: annDelivery,
        ...linkPayload,
      };
      if (annScope === "stage") {
        url = `${API}/events/broadcast-to-stage/`;
        body.stage_id = annStageId;
        body.mode = "custom";
      } else if (annScope === "group") {
        url = `${API}/events/broadcast-to-group/`;
        body.group_id = annGroupId;
        body.mode = "custom";
      }

      const res = await axios.post(url, body, { headers: authHeader });
      toast.success(res.data.message);
      setAnnouncementOpen(false);
      setAnnTitle("");
      setAnnMessage("");
      setAnnDelivery("both");
      setAnnTarget(EMPTY_TARGET);
      setAnnEvents([]);
      setAnnScope("event");
      setAnnStageId("");
      setAnnGroupId("");
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Broadcast failed");
    } finally {
      setLoadingAnnouncement(false);
    }
  }

  async function handleToggleVisibility() {
    setLoadingVisibility(true);
    try {
      await axios.post(
        `${API}/events/edit-event/`,
        { event_id: eventDetails.event_id, is_public: !eventDetails.is_public },
        { headers: authHeader },
      );
      toast.success(
        `Event is now ${!eventDetails.is_public ? "public" : "private"}`,
      );
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to update visibility");
    } finally {
      setLoadingVisibility(false);
    }
  }

  async function handleExport(fmt: "csv" | "xlsx") {
    setLoadingExport(fmt);
    try {
      const res = await axios.get(`${API}/events/export-participants/`, {
        params: { event_id: eventDetails.event_id, format: fmt },
        headers: authHeader,
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${eventDetails.event_name}_participants.${fmt}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setLoadingExport(null);
    }
  }

  // ── render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* 1 ── Event Lifecycle ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Event Lifecycle</CardTitle>
          <CardDescription>
            Control the current state of this tournament.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium inline-flex items-center">
                Start Tournament
                <InfoTip id="events.edit.start_tournament" className="ml-1" />
              </p>
              <p className="text-xs text-muted-foreground">
                {eventDetails.stages[0]?.stage_status === "paused"
                  ? "Stage 1 is paused. Resume when you are ready to continue."
                  : eventDetails.stages[0]?.stage_status === "ongoing"
                    ? "Stage 1 is running. You can pause it anytime."
                    : "Seed registered players into Stage 1."}
              </p>
            </div>
            {/* Before start: the Start button. After start (ongoing/paused): a "Started"
                marker + a Pause/Resume toggle (owner 2026-06-13). */}
            {eventDetails.stages[0]?.stage_status === "ongoing" ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Started
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingStageStatus}
                  onClick={() => handleSetStageStatus("paused")}
                >
                  <Pause className="h-4 w-4 mr-1" /> Pause
                </Button>
              </div>
            ) : eventDetails.stages[0]?.stage_status === "paused" ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-500">
                  <Pause className="h-4 w-4" /> Paused
                </span>
                <Button
                  size="sm"
                  disabled={loadingStageStatus}
                  onClick={() => handleSetStageStatus("ongoing")}
                >
                  <Play className="h-4 w-4 mr-1" /> Resume
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={onStartTournament}
                disabled={status !== "upcoming"}
              >
                <Play className="h-4 w-4 mr-1" /> Start
              </Button>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium inline-flex items-center">
                Cancel Event
                <InfoTip id="events.edit.cancel_event" className="ml-1" />
              </p>
              <p className="text-xs text-muted-foreground">
                Mark as cancelled and notify all registered players.
              </p>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setCancelOpen(true)}
              disabled={status === "cancelled" || status === "completed"}
            >
              <XCircle className="h-4 w-4 mr-1" /> Cancel
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium inline-flex items-center">
                Mark as Complete
                <InfoTip id="events.edit.complete_event" className="ml-1" />
              </p>
              <p className="text-xs text-muted-foreground">
                Finalise the event and lock all results.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCompleteOpen(true)}
              disabled={status === "completed" || status === "cancelled"}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Complete
            </Button>
          </div>

          {status === "completed" && (
            <p className="text-xs text-center text-muted-foreground italic">
              This tournament has ended. Results are now locked.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 2 ── Seeding & Progression ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Seeding & Progression</CardTitle>
          <CardDescription>
            Distribute competitors into groups and advance stages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium inline-flex items-center">
              Seed Competitors to Groups
              <InfoTip id="events.edit.seed_to_groups" className="ml-1" />
            </p>
            <p className="text-xs text-muted-foreground">
              Randomly distribute stage competitors into groups.
            </p>
            <div className="flex gap-2">
              <Select value={seedStageId} onValueChange={setSeedStageId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {eventDetails.stages.map((s) => (
                    <SelectItem key={s.stage_id} value={String(s.stage_id)}>
                      {s.stage_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleSeedToGroups}
                disabled={loadingSeed || !seedStageId}
              >
                {loadingSeed ? (
                  <Loader text="Seeding..." />
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-1" /> Seed
                  </>
                )}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium inline-flex items-center">
              Advance to Next Stage
              <InfoTip id="events.edit.advance_stage" className="ml-1" />
            </p>
            <p className="text-xs text-muted-foreground">
              Push top competitors from a group into the next stage.
            </p>
            <div className="flex gap-2">
              <Select
                value={advanceStageId}
                onValueChange={(v) => {
                  setAdvanceStageId(v);
                  setAdvanceGroupId("");
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  {eventDetails.stages.map((s) => (
                    <SelectItem key={s.stage_id} value={String(s.stage_id)}>
                      {s.stage_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={advanceGroupId}
                onValueChange={setAdvanceGroupId}
                disabled={!advanceStageId}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Group" />
                </SelectTrigger>
                <SelectContent>
                  {advanceStage?.groups.map((g) => (
                    <SelectItem key={g.group_id} value={String(g.group_id)}>
                      {g.group_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleAdvanceStage}
                disabled={loadingAdvance || !advanceGroupId}
              >
                {loadingAdvance ? (
                  <Loader text="..." />
                ) : (
                  <>
                    <ChevronRight className="h-4 w-4 mr-1" /> Advance
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2b ── Seeding Management (owner 2026-06-15) ──────────────────────
          Undo/redo group seeding and delete a group/stage with a disposition
          choice. Backend: events/seeding/* (seeding_management.py). */}
      <Card>
        <CardHeader>
          <CardTitle>Seeding Management</CardTitle>
          <CardDescription>
            Undo a seed and reseed, or delete a group or stage and reseed the
            remaining ones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Undo + Reseed a stage's group distribution */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Undo or reseed group seeding</p>
            <p className="text-xs text-muted-foreground">
              Undo clears a stage's group assignments (competitors stay
              registered). Reseed redistributes them, optionally with a fresh
              shuffle.
            </p>
            <div className="flex flex-wrap gap-2">
              <Select value={mgmtStageId} onValueChange={setMgmtStageId}>
                <SelectTrigger className="flex-1 min-w-[140px]">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {eventDetails.stages.map((s) => (
                    <SelectItem key={s.stage_id} value={String(s.stage_id)}>
                      {s.stage_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Shuffle toggle for reseed */}
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => setReseedShuffle((v) => !v)}
                className={cn(reseedShuffle && "border-primary text-primary")}
              >
                <Shuffle className="h-4 w-4 mr-1" />
                Shuffle: {reseedShuffle ? "On" : "Off"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleUndoSeeding}
                disabled={loadingUndo || !mgmtStageId}
              >
                {loadingUndo ? (
                  <Loader text="Undoing..." />
                ) : (
                  <>
                    <Undo2 className="h-4 w-4 mr-1" /> Undo
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={handleReseed}
                disabled={loadingReseed || !mgmtStageId}
              >
                {loadingReseed ? (
                  <Loader text="Reseeding..." />
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1" /> Reseed
                  </>
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Delete a group (with disposition for its competitors) */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Delete a group</p>
            <p className="text-xs text-muted-foreground">
              Remove a group and choose what happens to its competitors.
            </p>
            <div className="flex gap-2">
              <Select value={delGroupId} onValueChange={setDelGroupId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {eventDetails.stages.flatMap((s) =>
                    s.groups.map((g) => (
                      <SelectItem key={g.group_id} value={String(g.group_id)}>
                        {s.stage_name} - {g.group_name}
                      </SelectItem>
                    )),
                  )}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (!delGroupId) return toast.error("Select a group first");
                  setDelGroupMode("auto");
                  setDelGroupOpen(true);
                }}
                disabled={loadingDelGroup || !delGroupId}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete...
              </Button>
            </div>
          </div>

          <Separator />

          {/* Delete a stage (with disposition for its competitors) */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Delete a stage</p>
            <p className="text-xs text-muted-foreground">
              Remove a stage and choose what happens to its competitors.
            </p>
            <div className="flex gap-2">
              <Select value={delStageId} onValueChange={setDelStageId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {eventDetails.stages.map((s) => (
                    <SelectItem key={s.stage_id} value={String(s.stage_id)}>
                      {s.stage_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (!delStageId) return toast.error("Select a stage first");
                  setDelStageMode("auto");
                  setDelStageTargetId("");
                  setDelStageOpen(true);
                }}
                disabled={loadingDelStage || !delStageId}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete...
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3 ── Communication ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Communication</CardTitle>
          <CardDescription>
            Send notifications and sync roles for registered players.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Broadcast Announcement</p>
              <p className="text-xs text-muted-foreground">
                Send an in-app notification to all registered players.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setHistoryOpen(true)}
              >
                History
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAnnouncementOpen(true)}
              >
                <Megaphone className="h-4 w-4 mr-1" /> Broadcast
              </Button>
            </div>
          </div>

          {/* Sync Discord Roles — hidden in the organizer flow (hideDiscord), since
              organizers don't manage AFC's Discord automation. The leading Separator
              is hidden with it so the card doesn't end on a dangling divider. */}
          {!hideDiscord && (
            <>
              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium inline-flex items-center">
                  Sync Discord Roles
                  <InfoTip id="events.edit.sync_discord" className="ml-1" />
                </p>
                <p className="text-xs text-muted-foreground">
                  Re-assign missing Discord group roles for a specific group.
                </p>
                <div className="flex gap-2">
                  <Select value={syncGroupId} onValueChange={setSyncGroupId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      {eventDetails.stages.flatMap((s) =>
                        s.groups.map((g) => (
                          <SelectItem
                            key={g.group_id}
                            value={String(g.group_id)}
                          >
                            {s.stage_name} - {g.group_name}
                          </SelectItem>
                        )),
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSyncDiscord}
                    disabled={loadingSync || !syncGroupId}
                  >
                    {loadingSync ? (
                      <Loader text="Syncing..." />
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1" /> Sync
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Roster Editing Window (owner 2026-06-15) ──────────────────────
          Open team roster-editing for a set period that auto-closes (capped at the event end date).
          While open, captains can edit their roster even after registration closes; the backend
          (set_roster_edit_window + edit_roster) is the real authority. */}
      <Card>
        <CardHeader>
          <CardTitle>Roster Editing</CardTitle>
          <CardDescription>
            Open team roster editing for a set period. It closes automatically and can&apos;t run past
            the event end date. While open, team captains can edit their roster even after registration
            has closed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium">Status</p>
              <p className="text-xs text-muted-foreground">
                {rosterEditOpen ? (
                  <>
                    Open until{" "}
                    <span className="font-semibold text-foreground">
                      {(eventDetails as any).roster_edit_until
                        ? new Date(
                            (eventDetails as any).roster_edit_until,
                          ).toLocaleString()
                        : ""}
                    </span>
                  </>
                ) : (
                  <span className="font-semibold">Closed</span>
                )}
              </p>
            </div>
            {rosterEditOpen && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSetRosterWindow(false)}
                disabled={loadingRosterWindow}
              >
                {loadingRosterWindow ? <Loader text="Saving..." /> : "Close now"}
              </Button>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium">Open until</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={rosterUntilInput}
                max={
                  eventDetails.end_date
                    ? `${String(eventDetails.end_date).slice(0, 10)}T23:59`
                    : undefined
                }
                onChange={(e) => setRosterUntilInput(e.target.value)}
              />
              <Button
                size="sm"
                onClick={() => handleSetRosterWindow(true)}
                disabled={loadingRosterWindow}
              >
                {loadingRosterWindow ? (
                  <Loader text="Saving..." />
                ) : rosterEditOpen ? (
                  "Update window"
                ) : (
                  "Open window"
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Cannot be later than the event end date
              {eventDetails.end_date
                ? ` (${String(eventDetails.end_date).slice(0, 10)})`
                : ""}
              .
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 4 ── Visibility & Export ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Visibility & Data</CardTitle>
          <CardDescription>
            Control event visibility and export participant data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Event Visibility</p>
              <p className="text-xs text-muted-foreground">
                Currently:{" "}
                <span className="font-semibold">
                  {eventDetails.is_public ? "Public" : "Private"}
                </span>
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleVisibility}
              disabled={loadingVisibility}
            >
              {loadingVisibility ? (
                <Loader text="Saving..." />
              ) : eventDetails.is_public ? (
                <>
                  <EyeOff className="h-4 w-4 mr-1" /> Make Private
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" /> Make Public
                </>
              )}
            </Button>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium mb-1 inline-flex items-center">
              Export Participants
              <InfoTip id="events.edit.export_participants" className="ml-1" />
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Download a list of all registered players/teams.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => handleExport("csv")}
                disabled={loadingExport !== null}
              >
                {loadingExport === "csv" ? (
                  <Loader text="Exporting..." />
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1" /> CSV
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => handleExport("xlsx")}
                disabled={loadingExport !== null}
              >
                {loadingExport === "xlsx" ? (
                  <Loader text="Exporting..." />
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1" /> Excel
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Confirm Cancel ────────────────────────────────────────────── */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <div className="text-center">
            <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-7 w-7 text-red-600" />
            </div>
            <DialogTitle className="text-xl">Cancel this event?</DialogTitle>
            <DialogDescription className="mt-2">
              <b>"{eventDetails.event_name}"</b> will be marked as cancelled.
              Registrations will be frozen and all registered players will be
              notified.
            </DialogDescription>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                disabled={loadingCancel}
                onClick={() => setCancelOpen(false)}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleCancel}
                disabled={loadingCancel}
              >
                {loadingCancel ? (
                  <Loader text="Cancelling..." />
                ) : (
                  "Yes, Cancel Event"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Complete ──────────────────────────────────────────── */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <div className="text-center">
            <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <DialogTitle className="text-xl">Mark as complete?</DialogTitle>
            <DialogDescription className="mt-2">
              <b>"{eventDetails.event_name}"</b> will be finalised. Results will
              be locked and all registered players will be notified.
            </DialogDescription>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                disabled={loadingComplete}
                onClick={() => setCompleteOpen(false)}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleComplete}
                disabled={loadingComplete}
              >
                {loadingComplete ? (
                  <Loader text="Completing..." />
                ) : (
                  "Yes, Mark Complete"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Broadcast Announcement ────────────────────────────────────── */}
      <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogTitle>Broadcast Announcement</DialogTitle>
          <DialogDescription>
            Send an in-app notification to all registered players in{" "}
            <b>{eventDetails.event_name}</b>.
          </DialogDescription>
          <div className="space-y-4 mt-2">
            {/* Scope (owner 2026-06-17): whole event, a stage, or a single group. */}
            <div className="space-y-2">
              <Label>Send to</Label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: "event", label: "Whole event" },
                    { value: "stage", label: "A stage" },
                    { value: "group", label: "A group" },
                  ] as const
                ).map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => {
                      setAnnScope(opt.value);
                      setAnnStageId("");
                      setAnnGroupId("");
                    }}
                    className={cn(
                      "border rounded-md p-2.5 text-xs text-center transition-colors",
                      annScope === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-muted",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {annScope === "stage" && (
                <Select value={annStageId} onValueChange={setAnnStageId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventDetails.stages.map((s: any) => (
                      <SelectItem key={s.stage_id} value={String(s.stage_id)}>
                        {s.stage_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {annScope === "group" && (
                <Select value={annGroupId} onValueChange={setAnnGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a group" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventDetails.stages.flatMap((s: any) =>
                      (s.groups || []).map((g: any) => (
                        <SelectItem
                          key={g.group_id}
                          value={String(g.group_id)}
                        >
                          {s.stage_name} {">"} {g.group_name}
                        </SelectItem>
                      )),
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="ann-title">Title</Label>
              <Input
                id="ann-title"
                placeholder="e.g. Room details for tonight"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ann-message">Message</Label>
              <Textarea
                id="ann-message"
                placeholder="Your message..."
                rows={4}
                value={annMessage}
                onChange={(e) => setAnnMessage(e.target.value)}
              />
            </div>
            {/* Delivery channel: app push / email (branded) / both. */}
            <div className="space-y-2">
              <Label>Send to</Label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: "both", label: "App + Email" },
                    { value: "push", label: "App only" },
                    { value: "email", label: "Email only" },
                  ] as const
                ).map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setAnnDelivery(opt.value)}
                    className={cn(
                      "border rounded-md p-2.5 text-xs text-center transition-colors",
                      annDelivery === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-muted",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Emails are sent in the standard AFC branded design.
              </p>
            </div>
            {/* Optional deep link: adds a "Take me there" button on the
                recipient's notification. Defaults to no link. */}
            <NotificationTargetSelector
              value={annTarget}
              onChange={(t) => {
                setAnnTarget(t);
                // Clear the multi-event selection when switching away from the event type.
                if (t.target_type !== "event") setAnnEvents([]);
              }}
              enableEventSearch
              selectedEvents={annEvents}
              onSelectedEventsChange={setAnnEvents}
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                disabled={loadingAnnouncement}
                onClick={() => setAnnouncementOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleBroadcast}
                disabled={loadingAnnouncement}
              >
                {loadingAnnouncement ? (
                  <Loader text="Sending..." />
                ) : (
                  <>
                    <Radio className="h-4 w-4 mr-1" /> Send
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Broadcast history (event-scoped) ──────────────────────────── */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogTitle>Broadcast history</DialogTitle>
          <DialogDescription>
            Every announcement, stage/group message and room-details push sent for{" "}
            <b>{eventDetails.event_name}</b>.
          </DialogDescription>
          <div className="mt-2 max-h-[60vh] overflow-auto pr-1">
            {historyOpen && (
              <BroadcastHistory scope="event" eventId={eventDetails.event_id} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete group: disposition choice ──────────────────────────── */}
      <Dialog open={delGroupOpen} onOpenChange={setDelGroupOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogTitle>Delete this group?</DialogTitle>
          <DialogDescription>
            Choose what happens to the competitors in this group.
          </DialogDescription>
          <div className="space-y-3 mt-2">
            {(
              [
                {
                  value: "auto",
                  label: "Auto reseed",
                  desc: "Move its competitors into the stage's remaining groups.",
                },
                {
                  value: "manual",
                  label: "Manual",
                  desc: "Keep them registered but unassigned. You place them yourself.",
                },
                {
                  value: "delete_all",
                  label: "Delete all",
                  desc: "Remove the group and its competitors from the stage.",
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDelGroupMode(opt.value)}
                className={cn(
                  "w-full text-left border rounded-md p-3 transition-colors",
                  delGroupMode === opt.value
                    ? "border-primary bg-primary/10"
                    : "hover:bg-muted",
                )}
              >
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </button>
            ))}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDelGroupOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDeleteGroup}
                disabled={loadingDelGroup}
              >
                {loadingDelGroup ? <Loader text="Deleting..." /> : "Delete group"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete stage: disposition choice (+ target for move) ───────── */}
      <Dialog open={delStageOpen} onOpenChange={setDelStageOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogTitle>Delete this stage?</DialogTitle>
          <DialogDescription>
            Choose what happens to the competitors in this stage.
          </DialogDescription>
          <div className="space-y-3 mt-2">
            {(
              [
                {
                  value: "auto",
                  label: "Auto reseed",
                  desc: "Move competitors to another stage and distribute into its groups.",
                },
                {
                  value: "manual",
                  label: "Manual",
                  desc: "Move competitors to another stage; you place them later.",
                },
                {
                  value: "delete_all",
                  label: "Delete all",
                  desc: "Remove the stage and everything in it.",
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDelStageMode(opt.value)}
                className={cn(
                  "w-full text-left border rounded-md p-3 transition-colors",
                  delStageMode === opt.value
                    ? "border-primary bg-primary/10"
                    : "hover:bg-muted",
                )}
              >
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </button>
            ))}
            {/* Target stage is required only when MOVING competitors (auto / manual). */}
            {delStageMode !== "delete_all" && (
              <div className="space-y-1">
                <Label>Move competitors to</Label>
                <Select
                  value={delStageTargetId}
                  onValueChange={setDelStageTargetId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventDetails.stages
                      .filter((s) => String(s.stage_id) !== delStageId)
                      .map((s) => (
                        <SelectItem key={s.stage_id} value={String(s.stage_id)}>
                          {s.stage_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDelStageOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDeleteStage}
                disabled={loadingDelStage}
              >
                {loadingDelStage ? <Loader text="Deleting..." /> : "Delete stage"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Played-results force confirm (shared by all seeding actions) ─ */}
      <Dialog
        open={forceConfirm.open}
        onOpenChange={(o) => setForceConfirm((s) => ({ ...s, open: o }))}
      >
        <DialogContent className="sm:max-w-[420px]">
          <div className="text-center">
            <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-orange-600" />
            </div>
            <DialogTitle className="text-xl">Entered results affected</DialogTitle>
            <DialogDescription className="mt-2">
              {forceConfirm.message}
            </DialogDescription>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setForceConfirm((s) => ({ ...s, open: false }))}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={forceConfirm.onConfirm}
              >
                Proceed anyway
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
