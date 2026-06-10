"use client";

// ──────────────────────────────────────────────────────────────────────────
// EditRosterModal (ADMIN)
//
// What it does:
//   Lets an AFC admin / organizer correct a registered TEAM's event roster from
//   the event-edit "Registered Teams" tab (RegisteredTeamsTab.tsx). It mirrors the
//   CAPTAIN's roster editor in
//   app/(user)/tournaments/[slug]/_components/EventDetailsWrapper.tsx, but is driven
//   by the admin token so staff can fix a lineup even AFTER registration closes.
//
// Which endpoints it hits:
//   1. POST /team/get-team-details/  { team_name }
//        -> loads the team's FULL member pool (TeamMembers), so an admin can ADD
//           players who are not currently on the event roster. Same source the
//           captain flow reads via userTeam.members. Returns team.members[] with
//           { id (= user_id), username, uid }.
//   2. POST /events/get-all-competitors-and-their-sponsor-id/  { event_id }   (sponsored only)
//        -> every TournamentTeamMember in this event with their current sponsor_id +
//           status. We filter to this team_id to PRE-FILL each selected player's
//           sponsor-id input with the value already on record.
//   3. POST /events/edit-roster/  { event_id, team_id, roster_member_ids, sponsor_ids }
//        -> the SAME contract the captain uses. roster_member_ids is the array of
//           chosen user_ids; sponsor_ids is { String(user_id): value } for sponsored
//           events only. Sent with the admin Bearer token (useAuth().token).
//
// IMPORTANT side effect (surfaced in the copy + success toast):
//   Changing a roster REOPENS the team for sponsor re-approval. The backend resets
//   added/changed members to "pending" and re-derives the team's approval state, so a
//   previously approved team goes back to "pending" until the sponsor re-reviews.
//
// How it connects to the rest of the system:
//   - Rendered by RegisteredTeamsTab.tsx in each SQUAD team row's action cell, next to
//     DisqualifyModal / ReactivateModal. It receives event_id, team_id, team_name,
//     participant_type, is_sponsored, and the current event roster (team.members) so it
//     can pre-check the players already on the lineup.
//   - is_sponsored is threaded from eventDetails (get_event_details exposes is_sponsored;
//     see edit/types.tsx EventDetails.is_sponsored), passed down through
//     RegisteredTeamsTabProps.
//   - onSuccess() is wired to a full reload of the edit page so the tab reflects the new
//     roster + the team's reopened status.
// ──────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/Loader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { IconLoader2, IconUsersGroup } from "@tabler/icons-react";

// A player already on the team's EVENT roster (passed from RegisteredTeamsTab's
// team.members). player_id is the user_id; we use it to pre-check the lineup.
interface CurrentRosterMember {
  player_id: number;
  username: string;
  uid?: string | null;
  status?: string;
}

// A player in the team's FULL member pool, returned by /team/get-team-details/.
// id is the user_id; uid is the in-game UID.
interface PoolMember {
  id: number;
  username: string;
  uid?: string | null;
}

interface EditRosterModalProps {
  event_id: number;
  team_id: number;
  team_name: string;
  // "squad" (4-6) or "duo" (exactly 2). Drives the size rule + helper copy.
  participant_type: "squad" | "duo" | string;
  // When true, each selected player needs a unique sponsor id (re-approval resets them).
  is_sponsored: boolean;
  // The team's CURRENT event roster (team.members from get_event_details). Used to
  // pre-check the players already on the lineup when the modal opens.
  currentRoster: CurrentRosterMember[];
  // Reload callback (the tab passes window.location.reload) so the new roster +
  // reopened team status show after a successful edit.
  onSuccess?: () => void;
}

export function EditRosterModal({
  event_id,
  team_id,
  team_name,
  participant_type,
  is_sponsored,
  currentRoster,
  onSuccess,
}: EditRosterModalProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);

  // The team's full member pool (everyone we can put on the roster).
  const [pool, setPool] = useState<PoolMember[]>([]);
  const [loadingPool, setLoadingPool] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Selected user_ids (the new roster) + per-player sponsor ids keyed by String(user_id).
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sponsorIds, setSponsorIds] = useState<Record<string, string>>({});

  // Roster size rule: duo is exactly 2, squad is 4-6.
  const isDuo = participant_type === "duo";
  const minSize = isDuo ? 2 : 4;
  const maxSize = isDuo ? 2 : 6;

  // ── Open: load the member pool + pre-fill from the current roster ──────────
  const handleOpen = async () => {
    setOpen(true);
    setLoadingPool(true);
    setSelectedIds([]);
    setSponsorIds({});
    try {
      // 1. Full member pool for this team (public endpoint, keyed by team_name).
      const poolRes = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
        { team_name },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const members: PoolMember[] = poolRes.data?.team?.members ?? [];
      setPool(members);

      // Pre-check the players currently on the event roster (by user_id), keeping
      // only those still in the team pool.
      const poolIds = new Set(members.map((m) => m.id));
      const preselected = currentRoster
        .map((m) => m.player_id)
        .filter((id) => poolIds.has(id));
      setSelectedIds(preselected);

      // 2. Sponsored events: pre-fill each player's current sponsor id from the
      //    event-wide competitor list, filtered to THIS team.
      if (is_sponsored) {
        try {
          const spRes = await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-competitors-and-their-sponsor-id/`,
            { event_id },
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const map: Record<string, string> = {};
          (spRes.data?.competitors ?? []).forEach((c: any) => {
            if (c.team_id === team_id && c.sponsor_id) {
              map[String(c.user_id)] = c.sponsor_id;
            }
          });
          setSponsorIds(map);
        } catch {
          // Non-fatal: admin can still type the sponsor ids manually.
        }
      }
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to load the team's members.",
      );
      setOpen(false);
    } finally {
      setLoadingPool(false);
    }
  };

  // Toggle a player on/off the roster, capping at maxSize.
  const toggle = (userId: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      if (prev.length >= maxSize) {
        toast.error(`You can select at most ${maxSize} players.`);
        return prev;
      }
      return [...prev, userId];
    });
  };

  // ── Validation gates (mirror the captain flow) ────────────────────────────
  const sizeValid =
    selectedIds.length >= minSize && selectedIds.length <= maxSize;

  // Sponsored events: every selected player needs a non-empty sponsor id, and the
  // values must be unique within the roster.
  const selectedSponsorValues = is_sponsored
    ? selectedIds.map((id) => (sponsorIds[String(id)] || "").trim())
    : [];
  const allSponsorsFilled =
    !is_sponsored || selectedSponsorValues.every((v) => v !== "");
  const sponsorsUnique =
    !is_sponsored ||
    new Set(selectedSponsorValues).size === selectedSponsorValues.length;

  const canSubmit =
    sizeValid && allSponsorsFilled && sponsorsUnique && !submitting;

  // ── Submit: POST /events/edit-roster/ with the admin token ────────────────
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload: {
        event_id: number;
        team_id: number;
        roster_member_ids: number[];
        sponsor_ids?: Record<string, string>;
      } = {
        event_id,
        team_id,
        roster_member_ids: selectedIds,
      };

      if (is_sponsored) {
        // Build sponsor_ids as { String(user_id): value } for the selected players only.
        const sp: Record<string, string> = {};
        selectedIds.forEach((id) => {
          sp[String(id)] = (sponsorIds[String(id)] || "").trim();
        });
        payload.sponsor_ids = sp;
      }

      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-roster/`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      toast.success(
        res.data?.message ||
          "Roster updated. The team has been reopened for sponsor approval.",
      );
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      const status = err?.response?.status;
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        "Failed to update the roster.";
      // Surface permission failures clearly (e.g. organizer without can_manage_registrations).
      toast.error(status === 403 ? `Not allowed: ${message}` : message);
    } finally {
      setSubmitting(false);
    }
  };

  // Players currently selected, for the sponsor-id inputs.
  const selectedMembers = pool.filter((m) => selectedIds.includes(m.id));

  // Helper line describing the size rule + current count.
  const sizeHelper = isDuo
    ? `Select exactly ${minSize} players (${selectedIds.length} selected).`
    : `Select ${minSize} to ${maxSize} players (${selectedIds.length} selected).`;

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={handleOpen}>
        <IconUsersGroup className="size-4 mr-1.5" />
        Edit roster
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg flex flex-col max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Edit roster: {team_name}</DialogTitle>
            <DialogDescription>
              Correct this team's lineup for the event. You can add or remove
              players, including after registration has closed.
              {is_sponsored
                ? " Saving reopens the team for sponsor re-approval, so changed players go back to pending."
                : " Saving reopens the team for sponsor re-approval when the roster changes."}
            </DialogDescription>
          </DialogHeader>

          {loadingPool ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-sm">
              <IconLoader2 className="size-4 animate-spin" />
              Loading team members...
            </div>
          ) : pool.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              This team has no members to choose from.
            </p>
          ) : (
            <div className="flex flex-col gap-3 min-h-0">
              {/* Size helper line. */}
              <p
                className={`text-xs ${
                  sizeValid ? "text-muted-foreground" : "text-destructive"
                }`}
              >
                {sizeHelper}
              </p>

              {/* Member pool checklist. */}
              <ScrollArea className="h-64 rounded-md border">
                <div className="p-1">
                  {pool.map((member) => {
                    const checked = selectedIds.includes(member.id);
                    const wasOnRoster = currentRoster.some(
                      (r) => r.player_id === member.id,
                    );
                    return (
                      <label
                        key={member.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-md select-none transition-colors hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(member.id)}
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-medium truncate capitalize">
                            {member.username}
                          </span>
                          {member.uid && (
                            <span className="text-xs text-muted-foreground">
                              UID {member.uid}
                            </span>
                          )}
                        </div>
                        {wasOnRoster && (
                          <Badge
                            variant="outline"
                            className="text-[10px] rounded-full px-2 py-0.5 shrink-0"
                          >
                            Current
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Sponsor-id inputs for the SELECTED players (sponsored events only). */}
              {is_sponsored && selectedMembers.length > 0 && (
                <div className="rounded-md border p-3 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Each selected player needs a unique sponsor ID. Changing a
                    sponsor ID resets that player to pending for sponsor review.
                  </p>
                  {!sponsorsUnique && (
                    <p className="text-xs text-destructive">
                      Sponsor IDs must be unique within the roster.
                    </p>
                  )}
                  {selectedMembers.map((member) => (
                    <div key={member.id} className="space-y-1">
                      <Label className="text-xs capitalize">
                        {member.username}
                      </Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Enter sponsor ID"
                        value={sponsorIds[String(member.id)] || ""}
                        onChange={(e) =>
                          setSponsorIds((prev) => ({
                            ...prev,
                            [String(member.id)]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Footer. */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-muted-foreground">
                  {selectedIds.length} selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={!canSubmit}>
                    {submitting ? (
                      <Loader text="Saving..." />
                    ) : (
                      "Save roster"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
