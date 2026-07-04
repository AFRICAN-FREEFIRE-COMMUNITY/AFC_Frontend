"use client";

// ── CheckinSettingsCard (owner 2026-07-04) ───────────────────────────────────────
// Admin/organizer control to turn CHECK-IN on for an event and set its window. When on, every
// registered competitor must log in and tap "check in" (user event page) inside the window; a squad
// is eligible only when ALL its roster check in, and whoever doesn't is relegated to the waitlist.
// The window must OPEN after registration ends and CLOSE before the event starts (enforced server
// side too). Shows live per-team / per-solo check-in progress and a "Relegate now" button once the
// window has closed. DATA: GET events/checkin/status/?event_id= (status + manager breakdown),
// PATCH events/checkin/settings/ (save), POST events/checkin/relegate/ (force the sweep) -
// afc_tournament_and_scrims/views_checkin.py. Mounted by WaitlistTab (shared admin + organizer).

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { IconLoader2, IconUserCheck } from "@tabler/icons-react";

// ISO string (from the backend) -> a value for <input type="datetime-local"> in the viewer's local
// time. Returns "" for null. datetime-local wants "YYYY-MM-DDTHH:MM" with NO timezone.
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// datetime-local value (viewer local time) -> a tz-aware ISO string the backend parses correctly.
function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

interface TeamStat {
  tournament_team_id: number;
  team_name: string;
  is_waitlisted: boolean;
  roster_total: number;
  roster_checked_in: number;
  eligible: boolean;
}
interface SoloStat {
  user_id: number;
  username: string;
  is_waitlisted: boolean;
  checked_in: boolean;
}

export default function CheckinSettingsCard({ eventId }: { eventId?: number }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [relegating, setRelegating] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [windowOpen, setWindowOpen] = useState(false);
  const [teams, setTeams] = useState<TeamStat[]>([]);
  const [solos, setSolos] = useState<SoloStat[]>([]);

  const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });
  const base = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events`;

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const r = await axios.get(`${base}/checkin/status/?event_id=${eventId}`, { headers: authHeaders() });
      const d = r.data ?? {};
      setEnabled(!!d.checkin_enabled);
      setStart(isoToLocalInput(d.checkin_start ?? null));
      setEnd(isoToLocalInput(d.checkin_end ?? null));
      setWindowOpen(!!d.window_open);
      setTeams(d.teams ?? []);
      setSolos(d.solos ?? []);
    } catch {
      /* best-effort: the card just shows defaults if status can't load */
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!eventId) return;
    setSaving(true);
    try {
      await axios.patch(
        `${base}/checkin/settings/`,
        {
          event_id: eventId,
          checkin_enabled: enabled,
          checkin_start: enabled ? localInputToIso(start) : null,
          checkin_end: enabled ? localInputToIso(end) : null,
        },
        { headers: authHeaders() },
      );
      toast.success("Check-in settings saved.");
      load();
    } catch (err: any) {
      // The backend returns the specific window-rule violation as its message.
      toast.error(err?.response?.data?.message || "Could not save check-in settings.");
    } finally {
      setSaving(false);
    }
  };

  const relegateNow = async () => {
    if (!eventId) return;
    setRelegating(true);
    try {
      const r = await axios.post(`${base}/checkin/relegate/`, { event_id: eventId }, { headers: authHeaders() });
      toast.success(r?.data?.message || "Competitors relegated.");
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not relegate.");
    } finally {
      setRelegating(false);
    }
  };

  const windowClosed = enabled && !!end && new Date(end).getTime() < Date.now();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconUserCheck className="text-primary size-5" /> Check-in
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">When on, every registered competitor must log in and tap Check-in inside the window. A squad is eligible only when all its players check in; anyone who does not is moved to the waitlist.</p>

        <div className="flex items-center justify-between rounded-md border p-3">
          <Label htmlFor="checkin-enabled" className="text-sm">Enable check-in</Label>
          <Switch id="checkin-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={loading} />
        </div>

        {enabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Opens</Label>
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Closes</Label>
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              />
            </div>
            <p className="text-muted-foreground col-span-full text-xs">Check-in opens after registration ends and closes before the event starts.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={save} disabled={saving || loading}>
            {saving ? <IconLoader2 className="mr-1 size-4 animate-spin" /> : null}
            Save check-in settings
          </Button>
          {enabled && windowOpen && <Badge variant="outline" className="border-green-600/60 text-green-500">Open now</Badge>}
          {windowClosed && (
            <Button size="sm" variant="outline" onClick={relegateNow} disabled={relegating}>
              {relegating ? <IconLoader2 className="mr-1 size-4 animate-spin" /> : null}
              Move un-checked-in to waitlist
            </Button>
          )}
        </div>

        {/* Live progress once enabled: who has / hasn't checked in. */}
        {enabled && (teams.length > 0 || solos.length > 0) && (
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
            {teams.map((tm) => (
              <div key={tm.tournament_team_id} className="flex items-center justify-between text-xs">
                <span className="truncate font-medium">
                  {tm.team_name}
                  {tm.is_waitlisted ? <span className="text-amber-500"> · waitlisted</span> : null}
                </span>
                <span className={tm.eligible ? "text-green-500" : "text-muted-foreground"}>
                  {tm.roster_checked_in}/{tm.roster_total}
                </span>
              </div>
            ))}
            {solos.map((s) => (
              <div key={s.user_id} className="flex items-center justify-between text-xs">
                <span className="truncate font-medium">
                  {s.username}
                  {s.is_waitlisted ? <span className="text-amber-500"> · waitlisted</span> : null}
                </span>
                <span className={s.checked_in ? "text-green-500" : "text-muted-foreground"}>
                  {s.checked_in ? "In" : "Not yet"}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
