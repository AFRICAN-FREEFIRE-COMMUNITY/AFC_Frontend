"use client";

// EventTeamInvitesCard.tsx - INVITE TEAMS TO AN EVENT, organizer/admin side (backlog item 34).
//
// WHAT IT IS
//   The polite sibling of AddTeamsModal. AddTeamsModal force-registers a team without asking it;
//   this card ASKS. Pick teams, add an optional note, send. Each team gets a notification and can
//   accept or decline, and the table below shows where every invitation stands, including the
//   reason a team gave for saying no.
//
// WHERE IT RENDERS
//   Inside RegisteredTeamsTab, which is SHARED by the admin event-edit page
//   (app/(a)/a/events/[slug]/edit) and the organizer one (app/(organizer)/organizer/events/[slug]/
//   edit), so both surfaces get it from one component. Team events only: solo events have no teams
//   to invite, and the backend refuses that case anyway.
//
// WHICH ENDPOINTS IT HITS (afc_tournament_and_scrims/event_invites.py)
//   GET  /events/team-invitations/?event_id=       list this event's invitations + status counts
//   POST /events/team-invitations/create/          {event_id, team_ids[], message}
//   POST /events/team-invitations/<id>/cancel/     take back a pending one
//   The team picker reuses /team/get-all-teams/, exactly as AddTeamsModal does.
//
// i18n: namespace messages/*/eventInvites.json (admin surfaces are in scope since the owner's
// 2026-08-03 override), resolved through useTranslations("eventInvites").

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { env } from "@/lib/env";
import { matchesSearch } from "@/lib/search";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IconLoader2, IconMailForward, IconSearch } from "@tabler/icons-react";
// Timestamps render in the VIEWER's timezone + language, never a raw toLocale* call.
import { LocalTime } from "@/components/LocalTime";

// One row of /events/team-invitations/ (event_invites._serialize).
interface Invitation {
  id: number;
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  message: string;
  decline_reason: string;
  created_at: string;
  responded_at: string | null;
  team_id: number;
  team_name: string | null;
  team_tag: string | null;
  invited_by: string | null;
  responded_by: string | null;
}

// One row of /team/get-all-teams/ (the same shape AddTeamsModal reads).
interface PickableTeam {
  team_id: number;
  team_name: string;
  team_tag: string | null;
  member_count: number;
  country: string;
  is_banned: boolean;
}

interface EventTeamInvitesCardProps {
  eventId: number;
  eventName: string;
  /** team_ids already registered for the event: shown as "Registered" and not selectable. */
  registeredTeamIds?: number[];
}

// Badge colouring per status. Outline badges with a coloured border are the AFC idiom for a state
// pill (see the tier badges), so a status reads at a glance without inventing a new shape.
const STATUS_CLASS: Record<Invitation["status"], string> = {
  pending: "text-yellow-400 border-yellow-800",
  accepted: "text-green-400 border-green-800",
  declined: "text-red-400 border-red-800",
  cancelled: "text-muted-foreground",
  expired: "text-muted-foreground",
};

export function EventTeamInvitesCard({
  eventId,
  eventName,
  registeredTeamIds = [],
}: EventTeamInvitesCardProps) {
  const t = useTranslations("eventInvites");
  const { token } = useAuth();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  // Invite dialog state.
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<PickableTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const fetchInvitations = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/team-invitations/?event_id=${eventId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setInvitations(res.data.invitations ?? []);
      setCounts(res.data.counts ?? {});
    } catch {
      toast.error(t("organizer.toastLoadFailed"));
    } finally {
      setLoading(false);
    }
    // `t` is deliberately NOT a dependency, and this is not laziness - see the note on the dialog
    // effect below. With it in the list this callback is rebuilt on every render, and the effect
    // that calls it re-fires, so the list refetches continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, eventId]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  // The picker's team list is only fetched when the dialog opens (the whole roster is a big list
  // and most visits to this tab never invite anybody). Mirrors AddTeamsModal.
  //
  // `t` MUST NOT be in the dependency list, even though the effect calls it (found in the browser,
  // 2026-08-06). useTranslations returns a NEW function identity on every render, so listing it
  // makes this effect re-run on every render while the dialog is open - and this effect resets
  // selected / search / message. The symptom was brutal and silent: an organizer ticked three
  // teams, typed a note, and the act of typing (one setMessage -> one render) cleared the three
  // ticks, so "Send invitations" was permanently disabled and nothing said why. The effect must
  // fire on OPEN, which is exactly what these two dependencies express.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open || !token) return;
    setTeamsLoading(true);
    setSelected([]);
    setSearch("");
    setMessage("");
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-all-teams/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setTeams(res.data.teams ?? []))
      .catch(() => toast.error(t("organizer.toastTeamsFailed")))
      .finally(() => setTeamsLoading(false));
  }, [open, token]);

  // Teams that already hold a PENDING invitation cannot be invited twice (the backend skips them,
  // and the picker greys them out so an organizer never selects a no-op).
  const pendingTeamIds = new Set(
    invitations.filter((i) => i.status === "pending").map((i) => i.team_id),
  );
  const registered = new Set(registeredTeamIds);

  // Same search helper the rest of the admin surface uses: punctuation/accent insensitive and it
  // folds stylized fancy-font team names, so "V-E" is found by typing "ve".
  const filteredTeams = teams.filter((team) =>
    matchesSearch([team.team_name, team.team_tag], search),
  );

  const toggle = (id: number) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const handleSend = async () => {
    if (selected.length === 0) return;
    setSending(true);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/team-invitations/create/`,
        { event_id: eventId, team_ids: selected, message: message.trim() },
        authHeader,
      );
      const invited = res.data.invited?.length ?? 0;
      const skipped = res.data.skipped ?? [];
      // A partly-skipped batch is normal (a team registered itself an hour ago), so it is reported
      // rather than hidden: the toast names how many went out and, per skipped team, why not.
      if (skipped.length > 0) {
        toast.success(
          t("organizer.toastSentWithSkips", { count: invited, skipped: skipped.length }),
          {
            description: skipped
              .map(
                (s: { team_name: string | null; reason: string }) =>
                  `${s.team_name ?? s.reason}: ${t(`skipReason.${s.reason}` as never)}`,
              )
              .join(", "),
            duration: 10000,
          },
        );
      } else {
        toast.success(t("organizer.toastSent", { count: invited }));
      }
      setOpen(false);
      fetchInvitations();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || t("organizer.toastSendFailed"),
      );
    } finally {
      setSending(false);
    }
  };

  const handleCancel = async (invitationId: number) => {
    setCancellingId(invitationId);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/team-invitations/${invitationId}/cancel/`,
        {},
        authHeader,
      );
      toast.success(t("organizer.toastCancelled"));
      fetchInvitations();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || t("organizer.toastCancelFailed"),
      );
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span>{t("organizer.title")}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            <IconMailForward className="size-4 mr-1.5" />
            {t("organizer.inviteButton")}
          </Button>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("organizer.description")}</p>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
            <IconLoader2 className="size-4 animate-spin" />
            {t("organizer.loadingTeams")}
          </div>
        ) : invitations.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            {t("organizer.empty")}
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2">
              {t("organizer.summary", {
                pending: counts.pending ?? 0,
                accepted: counts.accepted ?? 0,
                declined: counts.declined ?? 0,
              })}
            </p>
            {/* Scrolls INSIDE its own container so a long list never pushes the page sideways
                on a phone (the mobile rule for every table on this surface). */}
            <div className="overflow-x-auto rounded-md border max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("organizer.colTeam")}</TableHead>
                    <TableHead>{t("organizer.colStatus")}</TableHead>
                    <TableHead>{t("organizer.colInvitedBy")}</TableHead>
                    <TableHead>{t("organizer.colSent")}</TableHead>
                    <TableHead>{t("organizer.colAnswer")}</TableHead>
                    <TableHead>{t("organizer.colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium text-xs">
                        {invitation.team_name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[invitation.status]}`}
                        >
                          {t(`status.${invitation.status}` as never)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {invitation.invited_by ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <LocalTime value={invitation.created_at} mode="date" />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[16rem]">
                        {invitation.status === "pending" ? (
                          t("organizer.noAnswerYet")
                        ) : invitation.status === "declined" ? (
                          <span>
                            {invitation.decline_reason || t("organizer.noReasonGiven")}
                            {invitation.responded_by && (
                              <span className="block opacity-70">
                                {t("organizer.answeredBy", { name: invitation.responded_by })}
                              </span>
                            )}
                          </span>
                        ) : invitation.responded_by ? (
                          t("organizer.answeredBy", { name: invitation.responded_by })
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {/* Only a PENDING invitation can be taken back. An accepted one is undone
                            by removing the team from the event, not by rewriting history. */}
                        {invitation.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={cancellingId === invitation.id}
                            onClick={() => handleCancel(invitation.id)}
                          >
                            {cancellingId === invitation.id && (
                              <IconLoader2 className="size-4 animate-spin mr-1" />
                            )}
                            {cancellingId === invitation.id
                              ? t("organizer.cancelling")
                              : t("organizer.cancelInvite")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>

      {/* ── Invite dialog: pick teams, add a note, send ─────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            {/* pr-6 keeps a long event name clear of the dialog's absolutely-positioned close X. */}
            <DialogTitle className="pr-6">
              {t("organizer.dialogTitle", { event: eventName })}
            </DialogTitle>
            <DialogDescription>{t("organizer.dialogDescription")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder={t("organizer.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {teamsLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-sm">
                <IconLoader2 className="size-4 animate-spin" />
                {t("organizer.loadingTeams")}
              </div>
            ) : filteredTeams.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                {teams.length === 0 ? t("organizer.noTeams") : t("organizer.noMatch")}
              </p>
            ) : (
              <ScrollArea className="h-64 rounded-md border">
                <div className="p-1">
                  {filteredTeams.map((team) => {
                    const isRegistered = registered.has(team.team_id);
                    const isInvited = pendingTeamIds.has(team.team_id);
                    const disabled = isRegistered || isInvited || team.is_banned;
                    return (
                      <label
                        key={team.team_id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-md select-none transition-colors ${
                          disabled
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-muted cursor-pointer"
                        }`}
                      >
                        <Checkbox
                          checked={selected.includes(team.team_id)}
                          disabled={disabled}
                          onCheckedChange={() => !disabled && toggle(team.team_id)}
                        />
                        <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 uppercase">
                          {team.team_name.charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-medium truncate">{team.team_name}</span>
                          <span className="text-xs text-muted-foreground">{team.country}</span>
                        </div>
                        {isRegistered && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {t("organizer.registeredBadge")}
                          </Badge>
                        )}
                        {!isRegistered && isInvited && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {t("organizer.invitedBadge")}
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-invite-message">{t("organizer.messageLabel")}</Label>
              <Textarea
                id="event-invite-message"
                value={message}
                maxLength={280}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("organizer.messagePlaceholder")}
                className="min-h-20"
              />
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
              <span className="text-sm text-muted-foreground">
                {selected.length > 0
                  ? t("organizer.selectedCount", { count: selected.length })
                  : t("organizer.noneSelected")}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
                  {t("organizer.cancel")}
                </Button>
                <Button onClick={handleSend} disabled={sending || selected.length === 0}>
                  {sending && <IconLoader2 className="size-4 animate-spin mr-2" />}
                  {sending ? t("organizer.sending") : t("organizer.send")}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
