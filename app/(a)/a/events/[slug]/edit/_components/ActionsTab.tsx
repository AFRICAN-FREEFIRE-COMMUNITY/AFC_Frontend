"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";
import { formatLocalTime } from "@/lib/i18n/time";
// Shared organizer broadcast rate-limit UI (5/hour + 5-min cooldown). The notice renders nothing for
// admins (exempt); the hook keeps the counter live across this composer's sends. See lib/broadcasts.tsx.
import { useBroadcastRate, BroadcastRateNotice } from "@/lib/broadcasts";
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

// One branching-advancement rule echoed per stage (feature #9) by the event-detail endpoints.
// Presence of >=1 rule on a stage = "branching mode" -> the Branching Advancement card below runs
// advance-stage-by-rules/ for it (instead of the per-group legacy advance).
interface AdvancementRule {
  id: number;
  position_from: number;
  position_to: number;
  source_group_id: number | null;
  source_group_name: string | null;
  target_stage_id: number;
  target_stage_name: string | null;
}

interface Stage {
  stage_id: number;
  stage_name: string;
  stage_status?: string;
  groups: Group[];
  // Branching advancement rules (feature #9); [] / absent for a legacy linear-advance stage.
  advancement_rules?: AdvancementRule[];
}

interface ActionsTabProps {
  eventDetails: {
    event_status: string;
    event_name: string;
    event_id: number;
    participant_type: string;
    is_public: boolean;
    stages: Stage[];
    // Event end date (YYYY-MM-DD) - caps the roster-edit window picker. From get-event-details.
    end_date?: string;
    // Roster-edit window (owner 2026-06-15): current state for the Roster Editing card.
    roster_edit_until?: string | null;
    roster_edit_open?: boolean;
    // Per-event results visibility (owner 2026-06-29): whether the PUBLIC standings are published.
    // Defaults true (absent => treated as published). Drives the "Results Visibility" toggle below;
    // the value is set by set_results_visibility and echoed by get_event_details(_for_admin/_not_logged_in).
    results_published?: boolean;
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
  // Rate-limit copy lives in the `broadcast` i18n namespace (this Actions tab is reused by organizers).
  // Named bcT (not t) so it doesn't shadow the existing `(t) => ...` closures elsewhere in this file.
  const bcT = useTranslations("broadcast");
  // All of this Actions tab's own copy (buttons, card titles, toasts, confirm dialogs) is in the
  // "evEditTabs" namespace. Named etT (not t) for the same shadow-avoidance reason as bcT above.
  const etT = useTranslations("evEditTabs");
  const API = env.NEXT_PUBLIC_BACKEND_API_URL;
  const status = eventDetails.event_status;
  const isTeam = eventDetails.participant_type !== "solo";
  const authHeader = { Authorization: `Bearer ${token}` };

  // loading
  const [loadingCancel, setLoadingCancel] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  // Reopen a completed event (owner 2026-06-25): admins + organizers flip it back to active.
  const [loadingReopen, setLoadingReopen] = useState(false);
  const [loadingSeed, setLoadingSeed] = useState(false);
  const [loadingAdvance, setLoadingAdvance] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);
  const [loadingAnnouncement, setLoadingAnnouncement] = useState(false);
  const [loadingVisibility, setLoadingVisibility] = useState(false);
  // Results visibility (owner 2026-06-29): publish/hide the PUBLIC standings (social-reveal timing).
  // resultsPublished defaults TRUE when the flag is absent (legacy events stay visible). The confirm
  // dialog (resultsVisOpen) guards the flip since hiding mid-event suddenly removes players' standings.
  const [loadingResultsVis, setLoadingResultsVis] = useState(false);
  const [resultsVisOpen, setResultsVisOpen] = useState(false);
  const resultsPublished = eventDetails.results_published !== false;
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
  // tick every 30s so an idle panel flips to "Closed" the moment the deadline passes - no refetch
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
  const [reopenOpen, setReopenOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  // Organizer broadcast budget for the announcement composer: fetched each time the dialog opens and
  // kept live on send. Admins are exempt → the notice renders nothing and behaviour is unchanged.
  const { rate: bcRate, applySuccess: bcApplySuccess, apply429: bcApply429 } =
    useBroadcastRate(announcementOpen);

  // selectors
  const [seedStageId, setSeedStageId] = useState("");
  const [advanceStageId, setAdvanceStageId] = useState("");
  const [advanceGroupId, setAdvanceGroupId] = useState("");
  const [syncGroupId, setSyncGroupId] = useState("");

  // ── Branching advancement (feature #9): run a stage's StageAdvancementRule rows (split its
  //    finishers into different later stages). Only stages WITH rules appear here; the engine +
  //    permission live in afc_tournament_and_scrims.advancement_routing (advance-stage-by-rules/).
  //    A Preview (dry_run) shows who routes where before the real Advance writes anything. ──
  const branchingStages = eventDetails.stages.filter(
    (s) => (s.advancement_rules?.length ?? 0) > 0,
  );
  const [branchStageId, setBranchStageId] = useState("");
  const [loadingBranchPreview, setLoadingBranchPreview] = useState(false);
  const [loadingBranchAdvance, setLoadingBranchAdvance] = useState(false);
  // The dry_run preview result (routed blocks) for the currently-selected stage, or null.
  const [branchPreview, setBranchPreview] = useState<any | null>(null);

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
      toast.error(e.response?.data?.message || etT("actions.toastCancelFailed"));
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
          toast.error(etT("actions.toastPickRosterClose"));
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
          ? etT("actions.toastRosterOpened")
          : etT("actions.toastRosterClosed"),
      );
      onRefresh?.();
    } catch (e: any) {
      toast.error(
        e.response?.data?.message || etT("actions.toastRosterWindowFailed"),
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
      toast.error(e.response?.data?.message || etT("actions.toastCompleteFailed"));
    } finally {
      setLoadingComplete(false);
    }
  }

  // Reopen a completed event (owner 2026-06-25). POST /events/reopen-event/ flips event_status back
  // to active (ongoing/upcoming by date) so results/rosters can be fixed; the backend gates this to
  // AFC admins OR organizers with can_edit_events, so this same button works on the organizer page.
  async function handleReopen() {
    setLoadingReopen(true);
    try {
      const res = await axios.post(
        `${API}/events/reopen-event/`,
        { event_id: eventDetails.event_id },
        { headers: authHeader },
      );
      toast.success(res.data.message);
      setReopenOpen(false);
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || etT("actions.toastReopenFailed"));
    } finally {
      setLoadingReopen(false);
    }
  }

  async function handleSeedToGroups() {
    if (!seedStageId) return toast.error(etT("actions.toastSelectStage"));
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
      toast.error(e.response?.data?.message || etT("actions.toastSeedFailed"));
    } finally {
      setLoadingSeed(false);
    }
  }

  async function handleAdvanceStage() {
    if (!advanceGroupId) return toast.error(etT("actions.toastSelectStageGroup"));
    setLoadingAdvance(true);
    try {
      const res = await axios.post(
        `${API}/events/advance-group-competitors-to-next-stage/`,
        { event_id: eventDetails.event_id, group_id: advanceGroupId },
        { headers: authHeader },
      );
      toast.success(res.data.message || etT("actions.toastAdvanced"));
      // Advancing moves competitors into the next stage; refetch so the updated stage
      // composition shows in place (no manual reload). onRefresh = fetchEventDetails.
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || etT("actions.toastAdvanceFailed"));
    } finally {
      setLoadingAdvance(false);
    }
  }

  // ── Branching advancement (feature #9): preview (dry_run) then advance a stage's rules. ──
  // POST /events/advance-stage-by-rules/ (advancement_routing.advance_stage_by_rules). Preview
  // returns the routed blocks WITHOUT writing; Advance seeds the finishers into their target stages.
  async function handleBranchPreview() {
    if (!branchStageId) return toast.error(etT("actions.toastSelectStage"));
    setLoadingBranchPreview(true);
    setBranchPreview(null);
    try {
      const res = await axios.post(
        `${API}/events/advance-stage-by-rules/`,
        {
          event_id: eventDetails.event_id,
          stage_id: branchStageId,
          dry_run: true,
        },
        { headers: authHeader },
      );
      setBranchPreview(res.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || etT("actions.toastPreviewFailed"));
    } finally {
      setLoadingBranchPreview(false);
    }
  }

  async function handleBranchAdvance() {
    if (!branchStageId) return toast.error(etT("actions.toastSelectStage"));
    setLoadingBranchAdvance(true);
    try {
      const res = await axios.post(
        `${API}/events/advance-stage-by-rules/`,
        { event_id: eventDetails.event_id, stage_id: branchStageId },
        { headers: authHeader },
      );
      toast.success(res.data.message || etT("actions.toastBranchingDone"));
      setBranchPreview(null);
      // Routing seeds finishers into later stages; refetch so the updated stages show in place.
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || etT("actions.toastAdvanceFailed"));
    } finally {
      setLoadingBranchAdvance(false);
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
      toast.success(res.data.message || etT("actions.toastDone"));
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
        toast.error(data?.message || etT("actions.toastActionFailed"));
      }
    } finally {
      opts.setLoading(false);
    }
  }

  function handleUndoSeeding() {
    if (!mgmtStageId) return toast.error(etT("actions.toastSelectStage"));
    runSeedingAction({
      url: `${API}/events/seeding/undo/`,
      body: { stage_id: mgmtStageId },
      setLoading: setLoadingUndo,
    });
  }

  function handleReseed() {
    if (!mgmtStageId) return toast.error(etT("actions.toastSelectStage"));
    runSeedingAction({
      url: `${API}/events/seeding/reseed/`,
      body: { stage_id: mgmtStageId, shuffle: reseedShuffle, clear_existing: true },
      setLoading: setLoadingReseed,
    });
  }

  function handleDeleteGroup() {
    if (!delGroupId) return toast.error(etT("actions.toastSelectGroup"));
    setDelGroupOpen(false);
    runSeedingAction({
      url: `${API}/events/seeding/delete-group/`,
      body: { group_id: delGroupId, mode: delGroupMode },
      setLoading: setLoadingDelGroup,
    });
  }

  function handleDeleteStage() {
    if (!delStageId) return toast.error(etT("actions.toastSelectStage"));
    if (delStageMode !== "delete_all" && !delStageTargetId)
      return toast.error(etT("actions.toastSelectTargetStage"));
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
    if (!syncGroupId) return toast.error(etT("actions.toastSelectGroup"));
    setLoadingSync(true);
    try {
      const res = await axios.post(
        `${API}/events/sync-group-discord-roles/`,
        { group_id: syncGroupId },
        { headers: authHeader },
      );
      toast.success(res.data.message || etT("actions.toastDiscordSynced"));
    } catch (e: any) {
      toast.error(e.response?.data?.message || etT("actions.toastSyncFailed"));
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
      toast.error(e.response?.data?.message || etT("actions.toastStageUpdateFailed"));
    } finally {
      setLoadingStageStatus(false);
    }
  }

  async function handleBroadcast() {
    if (!annTitle.trim() || !annMessage.trim())
      return toast.error(etT("actions.toastTitleMessageRequired"));
    if (annScope === "stage" && !annStageId)
      return toast.error(etT("actions.toastPickStageBroadcast"));
    if (annScope === "group" && !annGroupId)
      return toast.error(etT("actions.toastPickGroupBroadcast"));
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
      // Keep the "N of 5 left this hour" counter live from the send response (rate_remaining/_limit).
      bcApplySuccess(res.data);
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
      // 429 = organizer hit the hourly cap or the 5-min cooldown. Reflect the new block in the counter
      // and toast the server's reason + when sending re-opens (resets_at, rendered in viewer timezone).
      if (e.response?.status === 429) {
        const data = e.response.data || {};
        bcApply429(data);
        const when = formatLocalTime(data.resets_at, "time");
        toast.error(
          `${data.message || bcT("rate.limitReached")}${
            when ? ` ${bcT("rate.sendAgainAt")} ${when}` : ""
          }`,
        );
      } else {
        toast.error(e.response?.data?.message || etT("actions.toastBroadcastFailed"));
      }
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
        !eventDetails.is_public
          ? etT("actions.toastNowPublic")
          : etT("actions.toastNowPrivate"),
      );
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || etT("actions.toastVisibilityFailed"));
    } finally {
      setLoadingVisibility(false);
    }
  }

  // Publish or hide this event's PUBLIC standings (owner 2026-06-29). POSTs the flipped value to
  // set_results_visibility (gate: admin OR organizer-with-can_edit_events, same as this whole tab).
  // When hidden, the public tournament Results/Structure view shows "Results not published yet" and
  // the detail endpoints withhold each group's overall_leaderboard. onRefresh re-pulls so the shown
  // state updates in place. Staff result-entry surfaces are unaffected (not gated server-side).
  async function handleToggleResultsVisibility() {
    setLoadingResultsVis(true);
    try {
      const res = await axios.post(
        `${API}/events/set-results-visibility/`,
        {
          event_id: eventDetails.event_id,
          results_published: !resultsPublished,
        },
        { headers: authHeader },
      );
      toast.success(res.data.message);
      setResultsVisOpen(false);
      onRefresh?.();
    } catch (e: any) {
      toast.error(
        e.response?.data?.message || etT("actions.toastResultsVisFailed"),
      );
    } finally {
      setLoadingResultsVis(false);
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
      toast.success(etT("actions.toastExportDownloaded"));
    } catch {
      toast.error(etT("actions.toastExportFailed"));
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
          <CardTitle>{etT("actions.lifecycleTitle")}</CardTitle>
          <CardDescription>
            {etT("actions.lifecycleDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium inline-flex items-center">
                {etT("actions.startTournament")}
                <InfoTip id="events.edit.start_tournament" className="ml-1" />
              </p>
              <p className="text-xs text-muted-foreground">
                {eventDetails.stages[0]?.stage_status === "paused"
                  ? etT("actions.stagePausedDesc")
                  : eventDetails.stages[0]?.stage_status === "ongoing"
                    ? etT("actions.stageOngoingDesc")
                    : etT("actions.stageSeedDesc")}
              </p>
            </div>
            {/* Before start: the Start button. After start (ongoing/paused): a "Started"
                marker + a Pause/Resume toggle (owner 2026-06-13). */}
            {eventDetails.stages[0]?.stage_status === "ongoing" ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> {etT("actions.started")}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingStageStatus}
                  onClick={() => handleSetStageStatus("paused")}
                >
                  <Pause className="h-4 w-4 mr-1" /> {etT("actions.pause")}
                </Button>
              </div>
            ) : eventDetails.stages[0]?.stage_status === "paused" ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-500">
                  <Pause className="h-4 w-4" /> {etT("actions.paused")}
                </span>
                <Button
                  size="sm"
                  disabled={loadingStageStatus}
                  onClick={() => handleSetStageStatus("ongoing")}
                >
                  <Play className="h-4 w-4 mr-1" /> {etT("actions.resume")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1">
                {/* Day-of start fix (owner 2026-07-03): the daily date-sweep flips events to
                    "ongoing" ON their start date, so gating Start on status==="upcoming" made the
                    button permanently faded exactly on match day with no explanation. Start now
                    stays enabled for upcoming AND ongoing events (the seed endpoint has its own
                    guards); only finished/cancelled events lock it, WITH the reason shown. */}
                <Button
                  size="sm"
                  onClick={onStartTournament}
                  disabled={status === "completed" || status === "cancelled"}
                >
                  <Play className="h-4 w-4 mr-1" /> {etT("actions.start")}
                </Button>
                {(status === "completed" || status === "cancelled") && (
                  <p className="text-muted-foreground text-[0.7rem]">
                    {etT("actions.reopenBeforeStart", { status })}
                  </p>
                )}
              </div>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium inline-flex items-center">
                {etT("actions.cancelEvent")}
                <InfoTip id="events.edit.cancel_event" className="ml-1" />
              </p>
              <p className="text-xs text-muted-foreground">
                {etT("actions.cancelEventDesc")}
              </p>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setCancelOpen(true)}
              disabled={status === "cancelled" || status === "completed"}
            >
              <XCircle className="h-4 w-4 mr-1" /> {etT("actions.cancel")}
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium inline-flex items-center">
                {etT("actions.markComplete")}
                <InfoTip id="events.edit.complete_event" className="ml-1" />
              </p>
              <p className="text-xs text-muted-foreground">
                {etT("actions.markCompleteDesc")}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCompleteOpen(true)}
              disabled={status === "completed" || status === "cancelled"}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> {etT("actions.complete")}
            </Button>
          </div>

          {/* Reopen (owner 2026-06-25): only relevant once an event is completed. Admins + organizers
              (the backend gate allows can_edit_events) flip it back to active to fix/add results. */}
          {status === "completed" && (
            <>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium inline-flex items-center">
                    {etT("actions.reopenEvent")}
                    <InfoTip id="events.edit.reopen_event" className="ml-1" />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {etT("actions.reopenEventDesc")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReopenOpen(true)}
                >
                  <Undo2 className="h-4 w-4 mr-1" /> {etT("actions.reopen")}
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground italic">
                {etT("actions.endedLocked")}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* 2 ── Seeding & Progression ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{etT("actions.seedingTitle")}</CardTitle>
          <CardDescription>
            {etT("actions.seedingDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium inline-flex items-center">
              {etT("actions.seedToGroups")}
              <InfoTip id="events.edit.seed_to_groups" className="ml-1" />
            </p>
            <p className="text-xs text-muted-foreground">
              {etT("actions.seedToGroupsDesc")}
            </p>
            <div className="flex gap-2">
              <Select value={seedStageId} onValueChange={setSeedStageId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={etT("actions.selectStage")} />
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
                  <Loader text={etT("actions.seeding")} />
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-1" /> {etT("actions.seed")}
                  </>
                )}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium inline-flex items-center">
              {etT("actions.advanceToNext")}
              <InfoTip id="events.edit.advance_stage" className="ml-1" />
            </p>
            <p className="text-xs text-muted-foreground">
              {etT("actions.advanceToNextDesc")}
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
                  <SelectValue placeholder={etT("actions.stagePlaceholder")} />
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
                  <SelectValue placeholder={etT("actions.groupPlaceholder")} />
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
                    <ChevronRight className="h-4 w-4 mr-1" /> {etT("actions.advance")}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Branching advancement (feature #9): only shown when at least one stage has routing
              rules. Picks a rule-stage, PREVIEWS (dry_run) who routes where, then ADVANCES (seeds
              the finishers into their target stages). Backend: events/advance-stage-by-rules/
              (advancement_routing.advance_stage_by_rules). The per-group advance above stays for
              rule-less stages. */}
          {branchingStages.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium inline-flex items-center">
                  {etT("actions.branchingTitle")}
                  <InfoTip id="events.edit.branching_advance" className="ml-1" />
                </p>
                <p className="text-xs text-muted-foreground">
                  {etT("actions.branchingDesc")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={branchStageId}
                    onValueChange={(v) => {
                      setBranchStageId(v);
                      setBranchPreview(null);
                    }}
                  >
                    <SelectTrigger className="flex-1 min-w-[160px]">
                      <SelectValue placeholder={etT("actions.stageWithRules")} />
                    </SelectTrigger>
                    <SelectContent>
                      {branchingStages.map((s) => (
                        <SelectItem key={s.stage_id} value={String(s.stage_id)}>
                          {s.stage_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBranchPreview}
                    disabled={loadingBranchPreview || !branchStageId}
                  >
                    {loadingBranchPreview ? <Loader text="..." /> : etT("actions.preview")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleBranchAdvance}
                    disabled={loadingBranchAdvance || !branchStageId}
                  >
                    {loadingBranchAdvance ? (
                      <Loader text="..." />
                    ) : (
                      <>
                        <ChevronRight className="h-4 w-4 mr-1" /> {etT("actions.advance")}
                      </>
                    )}
                  </Button>
                </div>

                {/* dry_run preview: one block per rule, listing who routes into which stage. */}
                {branchPreview && Array.isArray(branchPreview.routed) && (
                  <div className="mt-2 space-y-2 rounded-md border bg-muted/30 p-3">
                    {branchPreview.routed.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        {etT("actions.noRouteYet")}
                      </p>
                    )}
                    {branchPreview.routed.map((blk: any, bi: number) => (
                      <div key={bi} className="text-xs">
                        <p className="font-medium text-foreground">
                          {blk.scope === "group" && blk.source_group_name
                            ? `${blk.source_group_name} `
                            : ""}
                          #{blk.from}{etT("actions.rangeConnector")}#{blk.to}
                          {"  ->  "}
                          {blk.target_stage_name}
                        </p>
                        <p className="text-muted-foreground">
                          {blk.competitors.length === 0
                            ? etT("actions.nobodyInRange")
                            : blk.competitors
                                .map(
                                  (c: any) => `#${c.placement} ${c.name}`,
                                )
                                .join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 2b ── Seeding Management (owner 2026-06-15) ──────────────────────
          Undo/redo group seeding and delete a group/stage with a disposition
          choice. Backend: events/seeding/* (seeding_management.py). */}
      <Card>
        <CardHeader>
          <CardTitle>{etT("actions.seedingMgmtTitle")}</CardTitle>
          <CardDescription>
            {etT("actions.seedingMgmtDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Undo + Reseed a stage's group distribution */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{etT("actions.undoReseedTitle")}</p>
            <p className="text-xs text-muted-foreground">
              {etT("actions.undoReseedDesc")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Select value={mgmtStageId} onValueChange={setMgmtStageId}>
                <SelectTrigger className="flex-1 min-w-[140px]">
                  <SelectValue placeholder={etT("actions.selectStage")} />
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
{reseedShuffle ? etT("actions.shuffleOn") : etT("actions.shuffleOff")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleUndoSeeding}
                disabled={loadingUndo || !mgmtStageId}
              >
                {loadingUndo ? (
                  <Loader text={etT("actions.undoing")} />
                ) : (
                  <>
                    <Undo2 className="h-4 w-4 mr-1" /> {etT("actions.undo")}
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={handleReseed}
                disabled={loadingReseed || !mgmtStageId}
              >
                {loadingReseed ? (
                  <Loader text={etT("actions.reseeding")} />
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1" /> {etT("actions.reseed")}
                  </>
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Delete a group (with disposition for its competitors) */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{etT("actions.deleteGroupTitle")}</p>
            <p className="text-xs text-muted-foreground">
              {etT("actions.deleteGroupDesc")}
            </p>
            <div className="flex gap-2">
              <Select value={delGroupId} onValueChange={setDelGroupId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={etT("actions.selectGroup")} />
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
                  if (!delGroupId) return toast.error(etT("actions.toastSelectGroup"));
                  setDelGroupMode("auto");
                  setDelGroupOpen(true);
                }}
                disabled={loadingDelGroup || !delGroupId}
              >
                <Trash2 className="h-4 w-4 mr-1" /> {etT("actions.deleteEllipsis")}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Delete a stage (with disposition for its competitors) */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{etT("actions.deleteStageTitle")}</p>
            <p className="text-xs text-muted-foreground">
              {etT("actions.deleteStageDesc")}
            </p>
            <div className="flex gap-2">
              <Select value={delStageId} onValueChange={setDelStageId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={etT("actions.selectStage")} />
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
                  if (!delStageId) return toast.error(etT("actions.toastSelectStage"));
                  setDelStageMode("auto");
                  setDelStageTargetId("");
                  setDelStageOpen(true);
                }}
                disabled={loadingDelStage || !delStageId}
              >
                <Trash2 className="h-4 w-4 mr-1" /> {etT("actions.deleteEllipsis")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3 ── Communication ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{etT("actions.communicationTitle")}</CardTitle>
          <CardDescription>
            {etT("actions.communicationDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{etT("actions.broadcastAnnouncement")}</p>
              <p className="text-xs text-muted-foreground">
                {etT("actions.broadcastAnnouncementDesc")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setHistoryOpen(true)}
              >
                {etT("actions.history")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAnnouncementOpen(true)}
              >
                <Megaphone className="h-4 w-4 mr-1" /> {etT("actions.broadcast")}
              </Button>
            </div>
          </div>

          {/* Sync Discord Roles - hidden in the organizer flow (hideDiscord), since
              organizers don't manage AFC's Discord automation. The leading Separator
              is hidden with it so the card doesn't end on a dangling divider. */}
          {!hideDiscord && (
            <>
              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium inline-flex items-center">
                  {etT("actions.syncDiscord")}
                  <InfoTip id="events.edit.sync_discord" className="ml-1" />
                </p>
                <p className="text-xs text-muted-foreground">
                  {etT("actions.syncDiscordDesc")}
                </p>
                <div className="flex gap-2">
                  <Select value={syncGroupId} onValueChange={setSyncGroupId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={etT("actions.selectGroup")} />
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
                      <Loader text={etT("actions.syncing")} />
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1" /> {etT("actions.sync")}
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
          <CardTitle>{etT("actions.rosterEditingTitle")}</CardTitle>
          <CardDescription>
            {etT("actions.rosterEditingDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium">{etT("actions.status")}</p>
              <p className="text-xs text-muted-foreground">
                {rosterEditOpen ? (
                  <>
                    {etT("actions.openUntil")}{" "}
                    <span className="font-semibold text-foreground">
                      {(eventDetails as any).roster_edit_until
                        ? new Date(
                            (eventDetails as any).roster_edit_until,
                          ).toLocaleString()
                        : ""}
                    </span>
                  </>
                ) : (
                  <span className="font-semibold">{etT("actions.closed")}</span>
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
                {loadingRosterWindow ? <Loader text={etT("actions.saving")} /> : etT("actions.closeNow")}
              </Button>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium">{etT("actions.openUntil")}</p>
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
                  <Loader text={etT("actions.saving")} />
                ) : rosterEditOpen ? (
                  etT("actions.updateWindow")
                ) : (
                  etT("actions.openWindow")
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {etT("actions.notLaterThanEnd", {
                date: eventDetails.end_date
                  ? ` (${String(eventDetails.end_date).slice(0, 10)})`
                  : "",
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 4 ── Visibility & Export ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{etT("actions.visibilityTitle")}</CardTitle>
          <CardDescription>
            {etT("actions.visibilityDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{etT("actions.eventVisibility")}</p>
              <p className="text-xs text-muted-foreground">
                {etT("actions.currently")}{" "}
                <span className="font-semibold">
                  {eventDetails.is_public ? etT("actions.public") : etT("actions.private")}
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
                <Loader text={etT("actions.saving")} />
              ) : eventDetails.is_public ? (
                <>
                  <EyeOff className="h-4 w-4 mr-1" /> {etT("actions.makePrivate")}
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" /> {etT("actions.makePublic")}
                </>
              )}
            </Button>
          </div>

          <Separator />

          {/* Results Visibility (owner 2026-06-29): publish or HIDE the public leaderboard so the
              organizer can time the social reveal. Hiding withholds the standings from the public
              tournament page (Results/Structure shows "Results not published yet"); staff can still
              enter/manage results. Confirm-gated since hiding mid-event removes players' standings. */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{etT("actions.resultsVisibility")}</p>
              <p className="text-xs text-muted-foreground">
                {etT("actions.currently")}{" "}
                <span className="font-semibold">
                  {resultsPublished ? etT("actions.published") : etT("actions.hidden")}
                </span>
                {resultsPublished
                  ? etT("actions.resultsPublishedNote")
                  : etT("actions.resultsHiddenNote")}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setResultsVisOpen(true)}
              disabled={loadingResultsVis}
            >
              {loadingResultsVis ? (
                <Loader text={etT("actions.saving")} />
              ) : resultsPublished ? (
                <>
                  <EyeOff className="h-4 w-4 mr-1" /> {etT("actions.hideResults")}
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" /> {etT("actions.publishResults")}
                </>
              )}
            </Button>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium mb-1 inline-flex items-center">
              {etT("actions.exportParticipants")}
              <InfoTip id="events.edit.export_participants" className="ml-1" />
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              {etT("actions.exportParticipantsDesc")}
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
                  <Loader text={etT("actions.exporting")} />
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1" /> {etT("actions.csv")}
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
                  <Loader text={etT("actions.exporting")} />
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1" /> {etT("actions.excel")}
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
            <DialogTitle className="text-xl">{etT("actions.confirmCancelTitle")}</DialogTitle>
            <DialogDescription className="mt-2">
              <b>&quot;{eventDetails.event_name}&quot;</b>{" "}
              {etT("actions.confirmCancelDesc")}
            </DialogDescription>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                disabled={loadingCancel}
                onClick={() => setCancelOpen(false)}
              >
                {etT("actions.back")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleCancel}
                disabled={loadingCancel}
              >
                {loadingCancel ? (
                  <Loader text={etT("actions.cancelling")} />
                ) : (
                  etT("actions.yesCancelEvent")
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
            <DialogTitle className="text-xl">{etT("actions.confirmCompleteTitle")}</DialogTitle>
            <DialogDescription className="mt-2">
              <b>&quot;{eventDetails.event_name}&quot;</b>{" "}
              {etT("actions.confirmCompleteDesc")}
            </DialogDescription>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                disabled={loadingComplete}
                onClick={() => setCompleteOpen(false)}
              >
                {etT("actions.back")}
              </Button>
              <Button
                className="flex-1"
                onClick={handleComplete}
                disabled={loadingComplete}
              >
                {loadingComplete ? (
                  <Loader text={etT("actions.completing")} />
                ) : (
                  etT("actions.yesMarkComplete")
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Reopen (owner 2026-06-25) ──────────────────────────── */}
      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <div className="text-center">
            <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
              <Undo2 className="h-7 w-7 text-blue-600" />
            </div>
            <DialogTitle className="text-xl">{etT("actions.confirmReopenTitle")}</DialogTitle>
            <DialogDescription className="mt-2">
              <b>&quot;{eventDetails.event_name}&quot;</b>{" "}
              {etT("actions.confirmReopenDesc")}
            </DialogDescription>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                disabled={loadingReopen}
                onClick={() => setReopenOpen(false)}
              >
                {etT("actions.back")}
              </Button>
              <Button
                className="flex-1"
                onClick={handleReopen}
                disabled={loadingReopen}
              >
                {loadingReopen ? <Loader text={etT("actions.reopening")} /> : etT("actions.yesReopenEvent")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Results Visibility toggle (owner 2026-06-29) ────────── */}
      <Dialog open={resultsVisOpen} onOpenChange={setResultsVisOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <div className="text-center">
            <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
              {resultsPublished ? (
                <EyeOff className="h-7 w-7 text-blue-600" />
              ) : (
                <Eye className="h-7 w-7 text-blue-600" />
              )}
            </div>
            <DialogTitle className="text-xl">
              {resultsPublished
                ? etT("actions.confirmHideResultsTitle")
                : etT("actions.confirmPublishResultsTitle")}
            </DialogTitle>
            <DialogDescription className="mt-2">
              {/* etT.rich embeds the bold event name inline so each sentence stays one unit. */}
              {resultsPublished
                ? etT.rich("actions.confirmHideResultsDesc", {
                    name: () => <b>&quot;{eventDetails.event_name}&quot;</b>,
                  })
                : etT.rich("actions.confirmPublishResultsDesc", {
                    name: () => <b>&quot;{eventDetails.event_name}&quot;</b>,
                  })}
            </DialogDescription>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                disabled={loadingResultsVis}
                onClick={() => setResultsVisOpen(false)}
              >
                {etT("actions.back")}
              </Button>
              <Button
                className="flex-1"
                onClick={handleToggleResultsVisibility}
                disabled={loadingResultsVis}
              >
                {loadingResultsVis ? (
                  <Loader text={etT("actions.saving")} />
                ) : resultsPublished ? (
                  etT("actions.yesHideResults")
                ) : (
                  etT("actions.yesPublishResults")
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Broadcast Announcement ────────────────────────────────────── */}
      <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
        <DialogContent className="sm:max-w-[460px] max-h-[85vh] overflow-y-auto">
          <DialogTitle>{etT("actions.broadcastAnnouncement")}</DialogTitle>
          <DialogDescription>
            {/* etT.rich embeds the bold event name inline. */}
            {etT.rich("actions.broadcastDialogDesc", {
              name: () => <b>{eventDetails.event_name}</b>,
            })}
          </DialogDescription>
          <div className="space-y-4 mt-2">
            {/* Organizer rate-limit budget ("N of 5 left this hour" + cooldown countdown). Hidden for
                admins (exempt) so their composer is unchanged. */}
            <BroadcastRateNotice rate={bcRate} />

            {/* Scope (owner 2026-06-17): whole event, a stage, or a single group. */}
            <div className="space-y-2">
              <Label>{etT("actions.sendTo")}</Label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: "event", label: etT("actions.scopeEvent") },
                    { value: "stage", label: etT("actions.scopeStage") },
                    { value: "group", label: etT("actions.scopeGroup") },
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
                    <SelectValue placeholder={etT("actions.chooseStage")} />
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
                    <SelectValue placeholder={etT("actions.chooseGroup")} />
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
              <Label htmlFor="ann-title">{etT("actions.title_")}</Label>
              <Input
                id="ann-title"
                placeholder={etT("actions.titlePlaceholder")}
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ann-message">{etT("actions.message")}</Label>
              <Textarea
                id="ann-message"
                placeholder={etT("actions.messagePlaceholder")}
                rows={4}
                value={annMessage}
                onChange={(e) => setAnnMessage(e.target.value)}
              />
            </div>
            {/* Delivery channel: app push / email (branded) / both. */}
            <div className="space-y-2">
              <Label>{etT("actions.sendTo")}</Label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: "both", label: etT("actions.deliveryBoth") },
                    { value: "push", label: etT("actions.deliveryPush") },
                    { value: "email", label: etT("actions.deliveryEmail") },
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
                {etT("actions.emailBrandedNote")}
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
                {etT("actions.cancel")}
              </Button>
              <Button
                className="flex-1"
                onClick={handleBroadcast}
                disabled={loadingAnnouncement}
              >
                {loadingAnnouncement ? (
                  <Loader text={etT("actions.sending")} />
                ) : (
                  <>
                    <Radio className="h-4 w-4 mr-1" /> {etT("actions.send")}
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
          <DialogTitle>{etT("actions.broadcastHistoryTitle")}</DialogTitle>
          <DialogDescription>
            {/* etT.rich embeds the bold event name inline. */}
            {etT.rich("actions.broadcastHistoryDesc", {
              name: () => <b>{eventDetails.event_name}</b>,
            })}
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
          <DialogTitle>{etT("actions.deleteGroupDialogTitle")}</DialogTitle>
          <DialogDescription>
            {etT("actions.deleteGroupDialogDesc")}
          </DialogDescription>
          <div className="space-y-3 mt-2">
            {(
              [
                {
                  value: "auto",
                  label: etT("actions.dispAutoLabel"),
                  desc: etT("actions.dispGroupAutoDesc"),
                },
                {
                  value: "manual",
                  label: etT("actions.dispManualLabel"),
                  desc: etT("actions.dispGroupManualDesc"),
                },
                {
                  value: "delete_all",
                  label: etT("actions.dispDeleteAllLabel"),
                  desc: etT("actions.dispGroupDeleteAllDesc"),
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
                {etT("actions.cancel")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDeleteGroup}
                disabled={loadingDelGroup}
              >
                {loadingDelGroup ? (
                  <Loader text={etT("actions.deleting")} />
                ) : (
                  etT("actions.deleteGroupBtn")
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete stage: disposition choice (+ target for move) ───────── */}
      <Dialog open={delStageOpen} onOpenChange={setDelStageOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogTitle>{etT("actions.deleteStageDialogTitle")}</DialogTitle>
          <DialogDescription>
            {etT("actions.deleteStageDialogDesc")}
          </DialogDescription>
          <div className="space-y-3 mt-2">
            {(
              [
                {
                  value: "auto",
                  label: etT("actions.dispAutoLabel"),
                  desc: etT("actions.dispStageAutoDesc"),
                },
                {
                  value: "manual",
                  label: etT("actions.dispManualLabel"),
                  desc: etT("actions.dispStageManualDesc"),
                },
                {
                  value: "delete_all",
                  label: etT("actions.dispDeleteAllLabel"),
                  desc: etT("actions.dispStageDeleteAllDesc"),
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
                <Label>{etT("actions.moveCompetitorsTo")}</Label>
                <Select
                  value={delStageTargetId}
                  onValueChange={setDelStageTargetId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={etT("actions.selectTargetStage")} />
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
                {etT("actions.cancel")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDeleteStage}
                disabled={loadingDelStage}
              >
                {loadingDelStage ? (
                  <Loader text={etT("actions.deleting")} />
                ) : (
                  etT("actions.deleteStageBtn")
                )}
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
            <DialogTitle className="text-xl">{etT("actions.forceTitle")}</DialogTitle>
            <DialogDescription className="mt-2">
              {forceConfirm.message}
            </DialogDescription>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setForceConfirm((s) => ({ ...s, open: false }))}
              >
                {etT("actions.back")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={forceConfirm.onConfirm}
              >
                {etT("actions.proceedAnyway")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
