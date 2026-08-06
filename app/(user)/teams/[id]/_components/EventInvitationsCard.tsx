"use client";

// EventInvitationsCard.tsx - THE TEAM'S SIDE of an event invitation (owner backlog item 34).
//
// WHAT IT IS
//   "An organizer wants your team in their event. Yes or no?" Whoever may register the team
//   (owner, captain, vice-captain, manager, coach) accepts by picking a roster, or declines with an
//   optional reason. Everybody else on the team sees the invitation but gets no buttons, which
//   mirrors the backend gate exactly rather than letting somebody press into a 403.
//
// WHERE IT RENDERS
//   On the team page (app/(user)/teams/[id]/page.tsx), directly above the tabs, so it is the first
//   thing a captain sees rather than something buried in a tab. It is also where the "Take me
//   there" deep link on the invitation notification lands (the backend sets target_type "team").
//   It renders NOTHING when the team has no invitations at all, so it costs an uninvited team no
//   screen space.
//
// WHY ACCEPT ASKS FOR A ROSTER
//   Accepting IS registering: the backend replays the answer through /events/register-for-event/,
//   which requires roster_member_ids for duo and squad events. The picker offers only PLAYING
//   members (staff are support-only and the registration endpoint rejects them on a roster), and
//   any refusal the registration path returns is shown verbatim, because the invited team is held
//   to exactly the rules a self-registering team is.
//
// WHICH ENDPOINTS IT HITS (afc_tournament_and_scrims/event_invites.py)
//   GET  /events/team-invitations/mine/?team_id=      the team's invitations + can_respond
//   POST /events/team-invitations/<id>/accept/        {roster_member_ids}
//   POST /events/team-invitations/<id>/decline/       {reason}
//
// i18n: namespace messages/*/eventInvites.json via useTranslations("eventInvites").

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IconCalendarEvent,
  IconExternalLink,
  IconLoader2,
  IconMailForward,
} from "@tabler/icons-react";
// Dates render in the VIEWER's timezone + language, never a raw toLocale* call.
import { LocalTime } from "@/components/LocalTime";

// One row of /events/team-invitations/mine/ (event_invites._serialize with for_team=True).
interface TeamInvitation {
  id: number;
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  message: string;
  decline_reason: string;
  created_at: string;
  invited_by: string | null;
  event_id: number;
  event_name: string;
  event_slug: string | null;
  participant_type: string;
  start_date: string | null;
  registration_open: boolean;
  event_status: string;
  team_registered: boolean;
}

// A member as get-team-details returns them (teamDetails.members). Only PLAYING roles can go on an
// event roster; the three staff roles are filtered out below.
interface TeamMemberRow {
  id: number;
  username: string;
  management_role: string;
}

const STAFF_ROLES = ["coach", "manager", "analyst"];

const STATUS_CLASS: Record<TeamInvitation["status"], string> = {
  pending: "text-yellow-400 border-yellow-800",
  accepted: "text-green-400 border-green-800",
  declined: "text-red-400 border-red-800",
  cancelled: "text-muted-foreground",
  expired: "text-muted-foreground",
};

interface EventInvitationsCardProps {
  teamId?: number;
  /** teamDetails.members, already fetched by the page: no second request for the roster picker. */
  members?: TeamMemberRow[];
  teamName?: string;
}

export function EventInvitationsCard({
  teamId,
  members = [],
  teamName = "",
}: EventInvitationsCardProps) {
  const t = useTranslations("eventInvites");
  const { token } = useAuth();

  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [canRespond, setCanRespond] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Which invitation each dialog is about (null = closed).
  const [acceptTarget, setAcceptTarget] = useState<TeamInvitation | null>(null);
  const [declineTarget, setDeclineTarget] = useState<TeamInvitation | null>(null);
  const [roster, setRoster] = useState<number[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchInvitations = useCallback(async () => {
    if (!token || !teamId) return;
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/team-invitations/mine/?team_id=${teamId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setInvitations(res.data.invitations ?? []);
      setCanRespond(!!res.data.can_respond);
    } catch {
      // Silent on load: this card is secondary to the team page, and a failed background fetch
      // must not nag somebody who only came to look at the roster. Actions below DO report errors.
    } finally {
      setLoaded(true);
    }
  }, [token, teamId]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  // Only PLAYING members can be rostered. Filtering here (rather than letting the backend refuse)
  // means a captain never picks a coach and then reads an error explaining they cannot.
  const playingMembers = useMemo(
    () => members.filter((m) => !STAFF_ROLES.includes(m.management_role)),
    [members],
  );

  const openAccept = (invitation: TeamInvitation) => {
    // Pre-select the whole playing side up to the squad maximum: for the common four-player team
    // this means the captain confirms rather than re-picks what they already know.
    const max = invitation.participant_type === "duo" ? 2 : 6;
    setRoster(playingMembers.slice(0, max).map((m) => m.id));
    setAcceptTarget(invitation);
  };

  const toggleRoster = (id: number) =>
    setRoster((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleAccept = async () => {
    if (!acceptTarget) return;
    setBusy(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/team-invitations/${acceptTarget.id}/accept/`,
        { roster_member_ids: roster },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t("team.toastAccepted", { event: acceptTarget.event_name }));
      setAcceptTarget(null);
      fetchInvitations();
    } catch (err: any) {
      // The message comes from register-for-event itself ("Registration limit reached.",
      // "Roster must contain 4 to 6 players.", the per-player requirements body, and so on). It is
      // shown as-is because the invited team is judged by the same rules as everybody else, and
      // the hint says plainly that nothing was accepted.
      toast.error(err?.response?.data?.message || t("team.toastAcceptFailed"), {
        description: t("team.acceptBlockedHint"),
        duration: 10000,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!declineTarget) return;
    setBusy(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/team-invitations/${declineTarget.id}/decline/`,
        { reason: reason.trim() },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t("team.toastDeclined"));
      setDeclineTarget(null);
      setReason("");
      fetchInvitations();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("team.toastDeclineFailed"));
    } finally {
      setBusy(false);
    }
  };

  // A team nobody has invited sees nothing at all: no empty card taking up the top of the page.
  if (!loaded || invitations.length === 0) return null;

  const pendingCount = invitations.filter((i) => i.status === "pending").length;
  const rosterMin = acceptTarget?.participant_type === "duo" ? 2 : 4;
  const rosterMax = acceptTarget?.participant_type === "duo" ? 2 : 6;
  const rosterValid = roster.length >= rosterMin && roster.length <= rosterMax;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          <IconMailForward className="size-5 text-primary" />
          <span>{t("team.title")}</span>
          {pendingCount > 0 && (
            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs text-yellow-400 border-yellow-800">
              {t("team.pendingCount", { count: pendingCount })}
            </Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("team.description")}</p>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {!canRespond && pendingCount > 0 && (
          <p className="text-xs text-muted-foreground">{t("team.cannotRespond")}</p>
        )}

        {invitations.map((invitation) => {
          // Accepting is only offered when it can actually succeed: the window has to be open and
          // the team must not already be in. Saying so up front beats a refusal after the press.
          const blockedReason = invitation.team_registered
            ? t("team.alreadyRegistered")
            : !invitation.registration_open
              ? t("team.registrationClosed")
              : null;

          return (
            <div
              key={invitation.id}
              className="rounded-md border p-3 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                    <IconCalendarEvent className="size-4 text-primary shrink-0" />
                    {invitation.event_name}
                    <Badge
                      variant="outline"
                      className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[invitation.status]}`}
                    >
                      {t(`status.${invitation.status}` as never)}
                    </Badge>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {invitation.invited_by
                      ? t("team.invitedBy", { name: invitation.invited_by })
                      : null}
                    {invitation.start_date && (
                      <>
                        {invitation.invited_by ? " | " : ""}
                        {t("team.startsOn")}{" "}
                        <LocalTime value={invitation.start_date} mode="date" />
                      </>
                    )}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" asChild>
                  <Link href={`/tournaments/${invitation.event_slug || invitation.event_id}`}>
                    <IconExternalLink className="size-4 mr-1.5" />
                    {t("team.openEvent")}
                  </Link>
                </Button>
              </div>

              {invitation.message && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">{t("team.noteLabel")}: </span>
                  {invitation.message}
                </p>
              )}

              {invitation.status === "pending" && (
                <>
                  {blockedReason && (
                    <p className="text-xs text-red-400">{blockedReason}</p>
                  )}
                  {canRespond && (
                    // Buttons stay full-width on a phone and inline from sm up, so both tap
                    // targets are comfortable on mobile without a cramped two-up row.
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        size="sm"
                        className="w-full sm:w-auto"
                        disabled={!!blockedReason}
                        onClick={() => openAccept(invitation)}
                      >
                        {t("team.accept")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setReason("");
                          setDeclineTarget(invitation);
                        }}
                      >
                        {t("team.decline")}
                      </Button>
                    </div>
                  )}
                </>
              )}

              {invitation.status === "declined" && invitation.decline_reason && (
                <p className="text-xs text-muted-foreground">
                  {invitation.decline_reason}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>

      {/* ── Accept: pick who plays, then register through the normal path ──────────────── */}
      <Dialog open={!!acceptTarget} onOpenChange={(o) => !o && setAcceptTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            {/* pr-6 keeps a long event name clear of the dialog's absolutely-positioned close X.
                Found on the 390px pass: "Accept the invitation to Invite Demo Cup" ran under it. */}
            <DialogTitle className="pr-6">
              {t("team.acceptTitle", { event: acceptTarget?.event_name ?? "" })}
            </DialogTitle>
            <DialogDescription>
              {t("team.acceptDescription", {
                event: acceptTarget?.event_name ?? "",
                team: teamName,
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label>{t("team.rosterLabel")}</Label>
            <p className="text-xs text-muted-foreground">
              {acceptTarget?.participant_type === "duo"
                ? t("team.rosterHintDuo")
                : t("team.rosterHintSquad")}
            </p>
            {playingMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">{t("team.noPlayers")}</p>
            ) : (
              <ScrollArea className="h-56 rounded-md border">
                <div className="p-1">
                  {playingMembers.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md select-none hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={roster.includes(member.id)}
                        onCheckedChange={() => toggleRoster(member.id)}
                      />
                      <span className="text-sm truncate">{member.username}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
            <p className="text-xs text-muted-foreground">
              {t("team.rosterSelected", { count: roster.length })}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptTarget(null)} disabled={busy}>
              {t("team.cancelDialog")}
            </Button>
            <Button onClick={handleAccept} disabled={busy || !rosterValid}>
              {busy && <IconLoader2 className="size-4 animate-spin mr-2" />}
              {busy ? t("team.accepting") : t("team.confirmAccept")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Decline: optional reason, sent to the inviter ──────────────────────────────── */}
      <Dialog open={!!declineTarget} onOpenChange={(o) => !o && setDeclineTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="pr-6">
              {t("team.declineTitle", { event: declineTarget?.event_name ?? "" })}
            </DialogTitle>
            <DialogDescription>{t("team.declineDescription")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="decline-reason">{t("team.reasonLabel")}</Label>
            <Textarea
              id="decline-reason"
              value={reason}
              maxLength={280}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("team.reasonPlaceholder")}
              className="min-h-20"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineTarget(null)} disabled={busy}>
              {t("team.cancelDialog")}
            </Button>
            <Button variant="destructive" onClick={handleDecline} disabled={busy}>
              {busy && <IconLoader2 className="size-4 animate-spin mr-2" />}
              {busy ? t("team.declining") : t("team.confirmDecline")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
