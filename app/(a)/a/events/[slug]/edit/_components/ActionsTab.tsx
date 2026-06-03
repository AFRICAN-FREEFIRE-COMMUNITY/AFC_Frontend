"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
import {
  CheckCircle2,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Megaphone,
  Play,
  Radio,
  RefreshCw,
  Users,
  XCircle,
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
  };
  onStartTournament: () => void;
  onRefresh?: () => void;
}

export default function ActionsTab({
  eventDetails,
  onStartTournament,
  onRefresh,
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

  // dialogs
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);

  // selectors
  const [seedStageId, setSeedStageId] = useState("");
  const [advanceStageId, setAdvanceStageId] = useState("");
  const [advanceGroupId, setAdvanceGroupId] = useState("");
  const [syncGroupId, setSyncGroupId] = useState("");

  // announcement form
  const [annTitle, setAnnTitle] = useState("");
  const [annMessage, setAnnMessage] = useState("");

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
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Advance failed");
    } finally {
      setLoadingAdvance(false);
    }
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

  async function handleBroadcast() {
    if (!annTitle.trim() || !annMessage.trim())
      return toast.error("Title and message are required");
    setLoadingAnnouncement(true);
    try {
      const res = await axios.post(
        `${API}/events/broadcast-announcement/`,
        { event_id: eventDetails.event_id, title: annTitle, message: annMessage },
        { headers: authHeader },
      );
      toast.success(res.data.message);
      setAnnouncementOpen(false);
      setAnnTitle("");
      setAnnMessage("");
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
                Seed registered players into Stage 1.
              </p>
            </div>
            <Button
              size="sm"
              onClick={onStartTournament}
              disabled={
                status !== "upcoming" ||
                eventDetails.stages[0]?.stage_status === "ongoing"
              }
            >
              <Play className="h-4 w-4 mr-1" /> Start
            </Button>
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAnnouncementOpen(true)}
            >
              <Megaphone className="h-4 w-4 mr-1" /> Broadcast
            </Button>
          </div>

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
                      <SelectItem key={g.group_id} value={String(g.group_id)}>
                        {s.stage_name} — {g.group_name}
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
    </div>
  );
}
