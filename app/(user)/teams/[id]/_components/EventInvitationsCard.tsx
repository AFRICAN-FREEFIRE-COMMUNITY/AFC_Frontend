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
// THREE KINDS OF ASK (owner 2026-08-08)
//   An organizer now chooses how they invite, and the difference matters to whoever is deciding:
//     per team   the place is held for this team alone. Answer whenever.
//     fcfs       more teams were asked than there are places. Answering fast is the whole game, so
//                the card says how many places are left.
//     bulk       ONE open invitation, not addressed to anybody. It arrives here as an "offer" row
//                and is answered through the CAMPAIGN endpoints, because the backend writes no
//                per-team row for it until somebody answers.
//   Offers and addressed invitations arrive in the same list and carry the same keys (the backend
//   serializes them to one shape on purpose), so this renders one list and branches only where the
//   two genuinely differ: which endpoint the buttons post to.
//
// WHICH ENDPOINTS IT HITS (afc_tournament_and_scrims/event_invites.py)
//   GET  /events/team-invitations/mine/?team_id=          the team's invitations, offers, can_respond
//   POST /events/team-invitations/<id>/accept/            {roster_member_ids}
//   POST /events/team-invitations/<id>/decline/           {reason}
//   POST /events/invitation-campaigns/<id>/accept/        {team_id, roster_member_ids}   (offers)
//   POST /events/invitation-campaigns/<id>/decline/       {team_id, reason}              (offers)
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
// Shared, self-expiring NEW tag (owner rule: any new surface wears one for 5 days).
import { NewBadge } from "@/components/NewBadge";
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
import {
  RosterRequirementsList,
  parseRequirementIssues,
  type RosterRequirementIssue,
} from "@/components/events/RosterRequirementsList";

// One row of /events/team-invitations/mine/. Two shapes arrive in this one list and they carry the
// same keys on purpose (event_invites._serialize with for_team=True, and _serialize_campaign with
// for_team=True):
//   * an ADDRESSED invitation: `is_offer` absent, answered through /team-invitations/<id>/...
//   * an OPEN OFFER from a bulk campaign: `is_offer` true, answered through
//     /invitation-campaigns/<campaign_id>/..., because no per-team row exists until it is answered.
// `id` is negative for an offer so the two id spaces cannot collide as React keys.
interface TeamInvitation {
  id: number;
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired" | "open" | "closed";
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
  kind: "per_team" | "fcfs" | "bulk";
  /** true only on a bulk offer: the buttons post to the campaign endpoints instead. */
  is_offer?: boolean;
  campaign_id: number | null;
  /** first come, first served only: places left in THIS invitation. null when uncapped. */
  slots_remaining: number | null;
  /** places left in the EVENT itself. null when the event is uncapped. */
  event_places_left: number | null;
}

// A member as get-team-details returns them (teamDetails.members). Only PLAYING roles can go on an
// event roster; the three staff roles are filtered out below.
interface TeamMemberRow {
  id: number;
  username: string;
  management_role: string;
}

const STAFF_ROLES = ["coach", "manager", "analyst"];

// The accept endpoint forwards register-for-event's refusal verbatim, and every refusal body on
// both paths carries a human-readable `message`. Narrowing through axios's own type guard states
// that shape once and checks it, instead of reaching through an `any` at each call site.
function errorMessage(err: unknown): string | undefined {
  return axios.isAxiosError<{ message?: string }>(err)
    ? err.response?.data?.message
    : undefined;
}

/** The WHOLE refusal body, not just its first sentence.
 *
 *  register_for_event answers an unmet requirement with a structured 403 naming every player and
 *  every missing field, and the accept endpoint hands that back untouched. This card read
 *  `message` alone and threw the rest away, so a captain saw "Some players are missing required
 *  profile info before this registration can proceed" and had no way to learn who, or what
 *  (owner 2026-09-02). */
function errorBody(err: unknown): unknown {
  return axios.isAxiosError(err) ? err.response?.data : undefined;
}

const STATUS_CLASS: Record<TeamInvitation["status"], string> = {
  pending: "text-yellow-400 border-yellow-800",
  accepted: "text-green-400 border-green-800",
  declined: "text-red-400 border-red-800",
  cancelled: "text-muted-foreground",
  expired: "text-muted-foreground",
  // A bulk OFFER carries the campaign's own status rather than an invitation's, so these two
  // exist here as well. "open" is the offer waiting to be taken, and reads like "pending".
  open: "text-yellow-400 border-yellow-800",
  closed: "text-muted-foreground",
};

// An offer is answerable while it is "open"; an addressed invitation while it is "pending". One
// predicate rather than two branches at every call site.
const isAnswerable = (invitation: TeamInvitation) =>
  invitation.is_offer ? invitation.status === "open" : invitation.status === "pending";

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
  const { token, user } = useAuth();

  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [canRespond, setCanRespond] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Which invitation each dialog is about (null = closed).
  const [acceptTarget, setAcceptTarget] = useState<TeamInvitation | null>(null);
  const [declineTarget, setDeclineTarget] = useState<TeamInvitation | null>(null);
  const [roster, setRoster] = useState<number[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  // The structured refusal, kept so the DIALOG can show who is missing what instead of a toast
  // that vanishes. Null means "no refusal on screen"; a value flips the dialog into its blocked
  // view, which is the flow the tournament page has had since 2026-08-02.
  const [blocked, setBlocked] = useState<{
    issues: RosterRequirementIssue[];
    teamLogoMissing: boolean;
    message: string;
  } | null>(null);

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

  // An OFFER has no per-team row yet, so it is answered on the campaign and has to name which team
  // is answering. An addressed invitation already knows its team, so it does not.
  const answerUrl = (invitation: TeamInvitation, action: "accept" | "decline") =>
    invitation.is_offer
      ? `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/invitation-campaigns/${invitation.campaign_id}/${action}/`
      : `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/team-invitations/${invitation.id}/${action}/`;

  const handleAccept = async () => {
    if (!acceptTarget) return;
    setBusy(true);
    try {
      await axios.post(
        answerUrl(acceptTarget, "accept"),
        {
          roster_member_ids: roster,
          ...(acceptTarget.is_offer ? { team_id: teamId } : {}),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t("team.toastAccepted", { event: acceptTarget.event_name }));
      setAcceptTarget(null);
      fetchInvitations();
    } catch (err) {
      // A refusal that NAMES its cause is shown in the dialog, not in a toast. The per-player
      // requirements body lists every player and every missing field; a toast can hold none of
      // that, cannot be re-read, and on a phone is easy to miss entirely (owner 2026-09-02:
      // "it should show the exact flow and issues as to why they cant register and what
      // players and their issues"). The dialog STAYS OPEN so the roster picker is still there
      // when they come back from fixing it.
      const parsed = parseRequirementIssues(errorBody(err), user?.user_id);
      if (parsed) {
        setBlocked({ ...parsed, message: errorMessage(err) || t("team.toastAcceptFailed") });
        return;
      }
      // Everything else keeps the toast: those refusals are ONE sentence that says the whole
      // thing ("Registration limit reached.", "Roster must contain 4 to 6 players."), and a
      // panel would add ceremony without adding information.
      toast.error(errorMessage(err) || t("team.toastAcceptFailed"), {
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
        answerUrl(declineTarget, "decline"),
        {
          reason: reason.trim(),
          ...(declineTarget.is_offer ? { team_id: teamId } : {}),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t("team.toastDeclined"));
      setDeclineTarget(null);
      setReason("");
      fetchInvitations();
    } catch (err) {
      toast.error(errorMessage(err) || t("team.toastDeclineFailed"));
    } finally {
      setBusy(false);
    }
  };

  // A team nobody has invited sees nothing at all: no empty card taking up the top of the page.
  if (!loaded || invitations.length === 0) return null;

  const pendingCount = invitations.filter(isAnswerable).length;
  const rosterMin = acceptTarget?.participant_type === "duo" ? 2 : 4;
  const rosterMax = acceptTarget?.participant_type === "duo" ? 2 : 6;
  const rosterValid = roster.length >= rosterMin && roster.length <= rosterMax;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          <IconMailForward className="size-5 text-primary" />
          <span>{t("team.title")}</span>
          {/* NEW tag: being invited to an event as a team, and answering for yourself, is a
              thing captains could not do before 2026-08-06. The badge expires by itself
              5 days on. It sits inside the title's existing flex-wrap row, so on a phone it
              wraps with the pending-count pill instead of stretching the card. */}
          <NewBadge since="2026-08-06" />
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
                      {/* An OFFER carries its campaign's status ("open"/"closed"), which lives in
                          a different key group from an invitation's ("pending"/"accepted"/...).
                          Reading the wrong group would render a missing-key error in the badge. */}
                      {invitation.is_offer
                        ? t(`campaignStatus.${invitation.status}` as never)
                        : t(`status.${invitation.status}` as never)}
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

              {/* The inviter's own words. Given its own filled surface (never a stroke, house
                  rule) so a long note reads as THEIRS rather than as more of the card, and
                  whitespace-pre-line so the line breaks they typed survive: since the note grew to
                  2000 characters on 2026-09-01 it commonly carries a date on one line and a
                  schedule under it, which a plain <p> would run into one paragraph. */}
              {invitation.message && (
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground whitespace-pre-line break-words">
                    <span className="font-medium">{t("team.noteLabel")}: </span>
                    {invitation.message}
                  </p>
                </div>
              )}

              {/* WHAT KIND of ask this is, said plainly, because it changes how fast the team
                  should answer. A first come, first served invitation that does not say so is
                  just an invitation the team answers next week, by which time it is gone. */}
              {isAnswerable(invitation) && invitation.kind !== "per_team" && (
                <p className="text-xs text-yellow-400 flex items-center gap-2 flex-wrap">
                  <NewBadge since="2026-08-08" />
                  <span>
                    {invitation.kind === "fcfs"
                      ? t("team.fcfsNotice")
                      : t("team.bulkNotice")}
                    {/* The concrete number, when there is one. The campaign's own places take
                        precedence over the event's, because that is the ceiling this team hits
                        first. */}
                    {invitation.slots_remaining !== null
                      ? ` ${t("team.placesLeft", { count: invitation.slots_remaining })}`
                      : invitation.event_places_left !== null
                        ? ` ${t("team.eventPlacesLeft", { count: invitation.event_places_left })}`
                        : ""}
                  </span>
                </p>
              )}

              {isAnswerable(invitation) && (
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

          {/* BLOCKED: the refusal named players and fields, so show them here rather than in a
              toast. Same panel the tournament page renders, from one component. */}
          {blocked ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-destructive">{blocked.message}</p>
              <RosterRequirementsList
                issues={blocked.issues}
                teamLogoMissing={blocked.teamLogoMissing}
                actionHint={t("team.blockedAction")}
              />
              <p className="text-xs text-muted-foreground">{t("team.acceptBlockedHint")}</p>
            </div>
          ) : (
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
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setAcceptTarget(null); setBlocked(null); }} disabled={busy}>
              {t("team.cancelDialog")}
            </Button>
            {blocked ? (
              // Back to the picker rather than straight into another attempt: nothing has been
              // fixed yet, and re-firing the same request would fail identically.
              <Button onClick={() => setBlocked(null)} disabled={busy}>
                {t("team.blockedBack")}
              </Button>
            ) : (
              <Button onClick={handleAccept} disabled={busy || !rosterValid}>
                {busy && <IconLoader2 className="size-4 animate-spin mr-2" />}
                {busy ? t("team.accepting") : t("team.confirmAccept")}
              </Button>
            )}
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
