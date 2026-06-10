"use client";

/**
 * ClaimGhostDialog: the logged-in user's "request to claim a ghost" dialog.
 *
 * WHAT IT IS
 *   A ghost row in the public rankings ladders (app/(user)/rankings/page.tsx) is a placeholder for
 *   an off-platform squad/player that already holds results. This dialog lets a logged-in user ASK
 *   to map that ghost onto a real entity. An admin then reviews the request in the claim queue on
 *   /a/rankings (the other half of this feature). This is only the REQUEST step, nothing is moved
 *   until an admin approves.
 *
 * TWO MODES (driven by the `kind` prop, set by the row that opened it)
 *   - kind="team":   the user picks one of THEIR owned/captained/managed teams + optional evidence,
 *                    then POSTs { team_id, evidence } to ghost-teams/<uuid>/request-claim/.
 *   - kind="player": the user confirms "this is me" + optional evidence, then POSTs { evidence } to
 *                    ghost-players/<int>/request-claim/ (a self-claim, the requester is the target).
 *
 * DATA IT TALKS TO
 *   - rankingsClaimApi.myTeam()           → afc_team get-user-current-team (the team dropdown source)
 *   - rankingsClaimApi.requestTeamClaim() → POST ghost-teams/<uuid>/request-claim/
 *   - rankingsClaimApi.requestPlayerClaim() → POST ghost-players/<int>/request-claim/
 *   (all in lib/rankings.ts; Bearer token from the auth_token cookie via AuthContext)
 *
 * ERRORS
 *   The backend 403s a team claim if the user does not run the team, and 400s if the ghost is not
 *   unclaimed or a leaderboard conflict exists. We surface the returned `message` verbatim in a toast
 *   (the caller already hides the Claim button when claim_status != "unclaimed", but the backend is
 *   the source of truth, so we still relay its message).
 *
 * CALLER: app/(user)/rankings/page.tsx, the RankingsView renders a "Claim" button on each is_ghost
 * row (logged-in only) that opens this dialog with the ghost's id + kind.
 */

import React, { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { IconGhost2, IconUsersGroup, IconUser, IconAlertTriangle } from "@tabler/icons-react";
import { toast } from "sonner";
import { rankingsClaimApi, MyTeam } from "@/lib/rankings";

// What the caller hands in. `kind` decides team-vs-player; `ghostId` is the UUID (team) or int
// (player) the request endpoint is keyed on; `ghostName` is the already-prefixed "[Ghost] ..." label
// shown in the header.
export interface ClaimGhostTarget {
  kind: "team" | "player";
  ghostId: string | number;
  ghostName: string;
}

export function ClaimGhostDialog({
  target,
  onOpenChange,
  onSubmitted,
}: {
  target: ClaimGhostTarget | null;       // null = closed
  onOpenChange: (open: boolean) => void; // close handler (parent owns the target state)
  onSubmitted?: () => void;              // optional refetch hook after a successful request
}) {
  const open = target !== null;
  const isTeam = target?.kind === "team";

  // team-mode: the user's manageable team(s) + the picked id. A user belongs to at most one team,
  // so this is usually a single option, but we keep the picker shape for clarity + future multi-team.
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  const [evidence, setEvidence] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset the form each time the dialog opens, and (team mode) fetch the user's team for the dropdown.
  useEffect(() => {
    if (!open) return;
    setEvidence("");
    setSubmitting(false);
    setSelectedTeamId("");
    setTeams([]);
    if (isTeam) {
      setTeamsLoading(true);
      rankingsClaimApi
        .myTeam()
        .then((t) => {
          const list = t ? [t] : [];
          setTeams(list);
          // auto-select when there's exactly one team (the common case).
          if (list.length === 1) setSelectedTeamId(String(list[0].team_id));
        })
        .finally(() => setTeamsLoading(false));
    }
  }, [open, isTeam]);

  // team mode needs a picked team; player mode (self-claim) is always submittable.
  const canSubmit = isTeam ? !!selectedTeamId : true;

  async function submit() {
    if (!target || submitting) return;
    setSubmitting(true);
    try {
      if (target.kind === "team") {
        // POST ghost-teams/<uuid>/request-claim/ { team_id, evidence }
        await rankingsClaimApi.requestTeamClaim(
          String(target.ghostId),
          Number(selectedTeamId),
          evidence.trim() || undefined,
        );
      } else {
        // POST ghost-players/<int>/request-claim/ { evidence }
        await rankingsClaimApi.requestPlayerClaim(Number(target.ghostId), evidence.trim() || undefined);
      }
      toast.success("Claim submitted for admin review");
      onOpenChange(false);
      onSubmitted?.();
    } catch (err: any) {
      // 403 (not your team) / 400 (not unclaimed / conflict) come back with a `message`. Relay it.
      toast.error(err?.response?.data?.message || "Failed to submit the claim. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconGhost2 className="size-5 text-primary" />
            {isTeam ? "Claim this ghost team" : "Claim this ghost player"}
          </DialogTitle>
          <DialogDescription>
            {isTeam ? (
              <>
                Ask an admin to map{" "}
                <span className="font-medium text-foreground">{target?.ghostName}</span> onto one of
                your teams. If approved, its history and points transfer to your team.
              </>
            ) : (
              <>
                Confirm that{" "}
                <span className="font-medium text-foreground">{target?.ghostName}</span> is you. If an
                admin approves, its history and points transfer to your account.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isTeam ? (
            // ── team claim: pick one of the user's teams ──
            <div className="space-y-2">
              <Label htmlFor="claim-team" className="flex items-center gap-1.5">
                <IconUsersGroup className="size-4" /> Claim for team
              </Label>
              {teamsLoading ? (
                <p className="text-sm text-muted-foreground">Loading your teams...</p>
              ) : teams.length === 0 ? (
                // No team = nothing to claim for. The backend would 403, so block here with a clear note.
                <div className="flex items-start gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-300">
                  <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    You are not the owner, captain, or a manager of any team. Only a team&apos;s manager
                    can claim a ghost on its behalf.
                  </span>
                </div>
              ) : (
                <Select value={selectedTeamId || undefined} onValueChange={setSelectedTeamId}>
                  <SelectTrigger id="claim-team" className="w-full">
                    <SelectValue placeholder="Select your team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.team_id} value={String(t.team_id)}>
                        {t.team_name}
                        {t.user_role_in_team ? ` · ${t.user_role_in_team}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : (
            // ── player claim: a self-confirmation note (no picker, the requester is the target) ──
            <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm">
              <IconUser className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">
                You are claiming this ghost player as{" "}
                <span className="font-medium text-foreground">yourself</span>. An admin will verify
                before any history moves.
              </span>
            </div>
          )}

          {/* optional evidence the admin reads when reviewing (stored as claim_note) */}
          <div className="space-y-2">
            <Label htmlFor="claim-evidence">
              Evidence <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="claim-evidence"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="Links, screenshots, or anything that helps an admin confirm this is you / your team."
              className="min-h-24"
            />
            <p className="text-[11px] text-muted-foreground">
              An admin reviews every claim before any results are transferred.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? "Submitting..." : "Submit claim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Small reusable "Ghost" pill kept here so the ladder + this dialog share one badge style.
// (The ladder already renders its own inline badge; this is exported for any future co-located use.)
export function GhostBadge() {
  return (
    <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] text-muted-foreground">
      Ghost
    </Badge>
  );
}
