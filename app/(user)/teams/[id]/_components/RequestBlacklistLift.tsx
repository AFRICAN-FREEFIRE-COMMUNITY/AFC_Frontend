// ─────────────────────────────────────────────────────────────────────────────
// RequestBlacklistLift - the team-side "Request blacklist lift" surface.
//
// WHAT THIS DOES:
// An organizer can blacklist a team for a duration; while it is active the team AND
// the players snapshotted on it cannot register for that organizer's events. The
// AFFECTED PARTY (a team manager, or a snapshotted player) can ASK the organizer to
// lift it. The organizer-side review lives at /organizer/blacklists; THIS is the
// other half - where the team raises the request.
//
// AUTO-DISCOVERY (no more manual blacklist-id entry):
// On mount this calls GET /organizers/blacklists/mine/?team_id=<teamId>
// (organizersApi.myBlacklists). That endpoint is NOT org-permission-gated - the
// backend scopes the results to the CALLER, returning every blacklist that affects
// them on this team, each with the per-action flags this UI keys off:
//   • can_request_team_lift  - the caller manages this team -> offer "whole team".
//   • can_request_self_lift  - the caller is an active snapshot player on it ->
//                              offer "for myself" (scope="player", target = me).
//   • my_pending_request      - the caller's already-pending lift request (or null).
//                              When set, the action is disabled and reads "pending".
// So all permission logic comes from the backend flags; the FE only renders them.
//
// REQUEST MAPPING (handed to organizersApi.requestBlacklistLift):
//   • "whole team"  -> { scope: "team" }                         (needs can_request_team_lift)
//   • "for myself"  -> { scope: "player", target_user_id: me }   (needs can_request_self_lift)
// The backend re-validates everything (manager role, snapshot-player check, duplicate
// guard) and returns a human message we surface verbatim via a sonner toast.
//
// CONNECTS TO:
//   - organizersApi.myBlacklists + organizersApi.requestBlacklistLift (lib/organizers.ts).
//   - Rendered by app/(user)/teams/[id]/page.tsx (Overview tab) for team members,
//     given this team's numeric teamId, the current user's user_id, and a
//     canManageTeam hint (used only to show a tiny "no blacklists" line to managers).
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconLoader2, IconShieldOff } from "@tabler/icons-react";
import { cn, formatDate } from "@/lib/utils";
import { organizersApi } from "@/lib/organizers";

// One blacklist affecting the caller, exactly as GET /organizers/blacklists/mine/
// serializes it. The three trailing fields are the per-action flags the UI keys off.
interface MyBlacklist {
  id: number;
  team_id: number;
  team_name: string | null;
  organization_id: number;
  organization_name: string | null;
  reason: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  can_request_team_lift: boolean;
  can_request_self_lift: boolean;
  // The caller's own pending request, if any (we only need its scope to label the
  // disabled state; null when the caller has no pending request on this blacklist).
  my_pending_request: { id: number; scope: "team" | "player"; status: string } | null;
}

interface Props {
  // This team's numeric id (scopes the auto-discovery call to one team).
  teamId: number | undefined;
  // The current user's user_id (the target for a "for myself" player-scope request).
  currentUserId: number | undefined;
  // Hint used ONLY to decide whether to show the tiny "no active blacklists" line to
  // managers. All real per-action gating comes from each blacklist's backend flags.
  canManageTeam: boolean;
}

// The lift kinds the per-blacklist <Select> can offer, driven by the backend flags.
//   team -> scope "team"; self -> scope "player" with the caller as target.
type LiftKind = "team" | "self";

export function RequestBlacklistLift({
  teamId,
  currentUserId,
  canManageTeam,
}: Props) {
  const [blacklists, setBlacklists] = useState<MyBlacklist[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Auto-discover the blacklists affecting this team/caller. ──
  // GET /organizers/blacklists/mine/?team_id=<teamId>. Failures fall back to an empty
  // list (the section then renders nothing for a plain member), with a toast so the
  // user knows the lookup failed rather than silently assuming "no blacklists".
  const load = useCallback(async () => {
    if (!teamId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await organizersApi.myBlacklists({ team_id: teamId });
      setBlacklists(res?.results ?? []);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to check for blacklists.",
      );
      setBlacklists([]);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  // While loading, render nothing (this is a passive section on the Overview tab; a
  // spinner here would be noise next to the rest of the tab).
  if (loading) return null;

  // No blacklist affects this team/caller. Show a tiny reassurance line to managers
  // (who might be looking for it); render nothing at all for a plain member.
  if (blacklists.length === 0) {
    if (!canManageTeam) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconShieldOff className="size-4 text-muted-foreground" />
            Organizer blacklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No active blacklists affect this team.
          </p>
        </CardContent>
      </Card>
    );
  }

  // One or more blacklists affect the caller: list them, each with its own lift action.
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconShieldOff className="size-4 text-muted-foreground" />
          Organizer blacklist
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          An organizer has blacklisted this team. You can ask them to lift it; the
          organizer reviews and decides.
        </p>
        {blacklists.map((bl) => (
          <BlacklistRow
            key={bl.id}
            blacklist={bl}
            currentUserId={currentUserId}
            onRequested={load}
          />
        ))}
      </CardContent>
    </Card>
  );
}

// ── BlacklistRow ──────────────────────────────────────────────────────────────
// One affecting blacklist: org name + reason + "until <end_date>", then the lift
// action. The action's scope options are driven purely by the backend flags. A
// pending request disables the action and shows "Lift request pending".
function BlacklistRow({
  blacklist: bl,
  currentUserId,
  onRequested,
}: {
  blacklist: MyBlacklist;
  currentUserId: number | undefined;
  onRequested: () => void;
}) {
  // Which lift kinds the backend says the caller may raise on THIS blacklist.
  const canTeam = bl.can_request_team_lift;
  const canSelf = bl.can_request_self_lift;
  const hasAnyAction = canTeam || canSelf;

  const [open, setOpen] = useState(false);
  // Default the picker to whatever is allowed (team lift first, else self).
  const [kind, setKind] = useState<LiftKind>(canTeam ? "team" : "self");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setKind(canTeam ? "team" : "self");
    setReason("");
  };

  const handleSubmit = async () => {
    // Map the chosen kind onto the backend's { scope, target_user_id }.
    let scope: "team" | "player";
    let target: number | undefined;
    if (kind === "team") {
      scope = "team";
    } else {
      scope = "player";
      target = currentUserId;
      if (!target) {
        toast.error("Could not resolve your account. Try reloading.");
        return;
      }
    }

    setSubmitting(true);
    try {
      // POST /organizers/blacklists/<id>/request-lift/. The backend enforces the real
      // rules and returns a human message we surface; then we refresh so the row picks
      // up its new my_pending_request and disables the action.
      const res = await organizersApi.requestBlacklistLift(bl.id, {
        scope,
        target_user_id: target,
        reason: reason.trim(),
      });
      toast.success(res?.message || "Lift request submitted.");
      setOpen(false);
      reset();
      onRequested();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to submit the lift request.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            {bl.organization_name ?? `Organization #${bl.organization_id}`}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "rounded-full px-2 py-0.5 text-xs capitalize",
              bl.status === "active"
                ? "border-red-500 text-red-600"
                : "border-muted-foreground/40 text-muted-foreground",
            )}
          >
            {bl.status}
          </Badge>
        </div>
        {bl.reason && (
          <p className="whitespace-pre-wrap text-xs text-foreground">
            {bl.reason}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {bl.end_date ? `Until ${formatDate(bl.end_date)}` : "No end date"}
        </p>
      </div>

      {/* Action: pending state wins; otherwise offer the allowed lift kinds. */}
      <div className="shrink-0">
        {bl.my_pending_request ? (
          <Badge
            variant="outline"
            className="rounded-full border-amber-500 px-2 py-0.5 text-xs text-amber-600"
          >
            Lift request pending
          </Badge>
        ) : hasAnyAction ? (
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) reset();
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <IconShieldOff className="size-4" />
                Request lift
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request a blacklist lift</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                {/* Only render the scope picker when BOTH kinds are available; if just
                    one is allowed the kind is already fixed, so we skip the chooser. */}
                {canTeam && canSelf && (
                  <div className="flex flex-col gap-2">
                    <Label>Request</Label>
                    <Select
                      value={kind}
                      onValueChange={(v) => setKind(v as LiftKind)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="What do you want lifted?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="team">
                          Lift for the whole team
                        </SelectItem>
                        <SelectItem value="self">Lift for me only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Reason for the organizer (optional but encouraged). */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`lift-reason-${bl.id}`}>Reason</Label>
                  <Textarea
                    id={`lift-reason-${bl.id}`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain why the organizer should lift the blacklist."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <span className="flex items-center gap-1.5">
                      <IconLoader2 className="size-4 animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    "Submit request"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </div>
  );
}
