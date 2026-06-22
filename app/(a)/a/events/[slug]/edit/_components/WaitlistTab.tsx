"use client";

import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatDate } from "@/lib/utils";
import { IconLoader2 } from "@tabler/icons-react";

export interface WaitlistForm {
  is_waitlist_enabled: boolean;
  waitlist_capacity: string;
  waitlist_discord_role_id: string;
  // Slot-assignment mode (owner 2026-06-17): how a no-show's slot is filled.
  waitlist_mode: string;
  // F3 registration requirements (owner 2026-06-19): per-event gates enforced at registration.
  require_team_logo?: boolean;
  require_esport_images?: boolean;
  require_player_uid?: boolean;
  require_player_profile_image?: boolean;
}

// NOTE (owner correction 2026-06-22): the registration-requirement toggles (team logo /
// esport image / profile image / Free Fire UID) MOVED off this tab to Basic Info
// (BasicInfoTab), where ALL registration requirements now sit together. They are still
// stored in the edit page's waitlistForm + persisted by saveWaitlistSettings (so the save
// is unchanged); only the rendering location moved. This tab is now waitlist-only.

// One waitlist roster row from get_event_details.waitlist_competitors (owner 2026-06-17).
interface WaitlistEntry {
  position?: number;
  name?: string;
  registration_date?: string | null;
  // ids used to promote: solo carries registered_competitor_id, squad carries tournament_team_id
  registered_competitor_id?: number;
  tournament_team_id?: number;
}

// The 3 modes, with short admin-facing copy. Admin surface = English (i18n-exempt).
const MODE_OPTIONS: { value: string; label: string; help: string }[] = [
  {
    value: "first_registered",
    label: "Earliest registered",
    help: "The team/player who joined the waitlist first gets the open slot.",
  },
  {
    value: "fcfs_room",
    label: "First to join room",
    help: "All waitlist teams get the room ID + password; first to join the room claims the slot. You confirm who got in.",
  },
  {
    value: "manual_admin",
    label: "You pick",
    help: "You manually choose which waitlist team/player takes each open slot.",
  },
];

interface WaitlistTabProps {
  waitlistForm: WaitlistForm;
  setWaitlistForm: React.Dispatch<React.SetStateAction<WaitlistForm>>;
  onSave: () => void;
  saving: boolean;
  // event id + a refetch callback so the promote actions can refresh the roster.
  eventId?: number;
  onRefresh?: () => void;
  eventDetails?: {
    participant_type: string;
    // The waitlist roster (positions + ids) the backend now returns. Falls back to deriving from
    // registered_competitors / tournament_teams for older payloads.
    waitlist_competitors?: WaitlistEntry[];
    registered_competitors: Array<{
      player_id: number;
      username: string;
      is_waitlisted?: boolean;
      registered_at?: string;
    }>;
    tournament_teams: any[];
  };
  hideDiscord?: boolean;
}

export default function WaitlistTab({
  waitlistForm,
  setWaitlistForm,
  onSave,
  saving,
  eventId,
  onRefresh,
  eventDetails,
  hideDiscord = false,
}: WaitlistTabProps) {
  const { token } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);

  const mode = waitlistForm.waitlist_mode || "first_registered";
  const roster: WaitlistEntry[] = eventDetails?.waitlist_competitors ?? [];
  const isSquad = eventDetails?.participant_type === "squad";

  // Promote a specific waitlist entry (manual_admin pick + fcfs_room confirm).
  const promote = async (entry: WaitlistEntry) => {
    if (!eventId || !token) return;
    const key = String(entry.tournament_team_id ?? entry.registered_competitor_id);
    setBusyId(key);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/promote-from-waitlist/`,
        {
          event_id: eventId,
          ...(entry.tournament_team_id
            ? { tournament_team_id: entry.tournament_team_id }
            : { competitor_id: entry.registered_competitor_id }),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(`${entry.name ?? "Competitor"} promoted into the event.`);
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to promote.");
    } finally {
      setBusyId(null);
    }
  };

  // Promote the earliest-registered waitlist entry (first_registered convenience).
  const promoteNext = async () => {
    if (!eventId || !token) return;
    setBusyId("next");
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/promote-next-waitlist/`,
        { event_id: eventId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(res.data?.message || "Next waitlist entry promoted.");
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to promote next.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Registration requirements moved to Basic Info (owner 2026-06-22) — see the note at
          the top of this file. This tab is waitlist-only now. */}
      <Card>
        <CardHeader>
          <CardTitle>Waitlist</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Allow players to join a waitlist when the event reaches max
            capacity, so a no-show's slot can be filled by a backup.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="waitlist-toggle">Enable Waitlist</Label>
              <p className="text-xs text-muted-foreground">
                Players can join the waitlist when the event is full and be
                admitted if spots open up.
              </p>
            </div>
            <Switch
              id="waitlist-toggle"
              checked={waitlistForm.is_waitlist_enabled}
              onCheckedChange={(v) =>
                setWaitlistForm((p) => ({ ...p, is_waitlist_enabled: v }))
              }
            />
          </div>

          {waitlistForm.is_waitlist_enabled && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="waitlist-capacity">Waitlist Capacity</Label>
                <Input
                  id="waitlist-capacity"
                  type="number"
                  min={1}
                  placeholder="e.g. 20"
                  value={waitlistForm.waitlist_capacity}
                  onChange={(e) =>
                    setWaitlistForm((p) => ({
                      ...p,
                      waitlist_capacity: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of players allowed on the waitlist.
                </p>
              </div>

              {/* Slot-assignment MODE (owner 2026-06-17): how a no-show's slot is filled. Shown to
                  players on the event page so they know the rule. */}
              <div className="space-y-2">
                <Label>How open slots are filled</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {MODE_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() =>
                        setWaitlistForm((p) => ({ ...p, waitlist_mode: opt.value }))
                      }
                      className={cn(
                        "rounded-md border p-3 text-left text-xs transition-colors",
                        mode === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "hover:bg-muted",
                      )}
                    >
                      <span className="block font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {MODE_OPTIONS.find((o) => o.value === mode)?.help}
                </p>
              </div>

              {/* Waitlist Discord Role ID — hidden in the organizer flow (hideDiscord). */}
              {!hideDiscord && (
                <div className="space-y-1.5">
                  <Label htmlFor="waitlist-discord-role">
                    Waitlist Discord Role ID
                  </Label>
                  <Input
                    id="waitlist-discord-role"
                    placeholder="e.g. 123456789012345678"
                    value={waitlistForm.waitlist_discord_role_id}
                    onChange={(e) =>
                      setWaitlistForm((p) => ({
                        ...p,
                        waitlist_discord_role_id: e.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Discord role assigned to players on the waitlist.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving}>
          {saving && <IconLoader2 className="size-4 animate-spin mr-2" />}
          {saving ? "Saving..." : "Save Waitlist Settings"}
        </Button>
      </div>

      {eventDetails && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>People on Waitlist ({roster.length})</CardTitle>
            {/* first_registered convenience: promote the earliest-registered in one click. */}
            {eventId && roster.length > 0 && mode === "first_registered" && (
              <Button
                size="sm"
                variant="outline"
                onClick={promoteNext}
                disabled={busyId === "next"}
              >
                {busyId === "next" && (
                  <IconLoader2 className="size-4 animate-spin mr-1" />
                )}
                Promote next
              </Button>
            )}
          </CardHeader>
          <CardContent className="overflow-x-auto rounded-md border max-h-96 overflow-y-auto">
            {mode === "fcfs_room" && roster.length > 0 && (
              <p className="mb-3 rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                Release room details to the group (Event Actions {">"} Broadcast {">"} room details)
                so the waitlist can see them, then Promote whoever joined the room first.
              </p>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>{isSquad ? "Team" : "Player"}</TableHead>
                  <TableHead>Registered At</TableHead>
                  {eventId && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.map((entry, i) => {
                  const key = String(
                    entry.tournament_team_id ?? entry.registered_competitor_id ?? i,
                  );
                  return (
                    <TableRow key={key}>
                      <TableCell className="text-muted-foreground">
                        {entry.position ?? i + 1}
                      </TableCell>
                      <TableCell className="font-medium capitalize">
                        {entry.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {entry.registration_date
                          ? formatDate(entry.registration_date)
                          : "-"}
                      </TableCell>
                      {eventId && (
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => promote(entry)}
                            disabled={busyId === key}
                          >
                            {busyId === key && (
                              <IconLoader2 className="size-4 animate-spin mr-1" />
                            )}
                            Promote
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}

                {roster.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={eventId ? 4 : 3}
                      className="text-center text-muted-foreground py-8"
                    >
                      No one on the waitlist yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
