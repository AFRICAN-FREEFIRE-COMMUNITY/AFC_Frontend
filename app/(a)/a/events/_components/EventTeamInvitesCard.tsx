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
// THE THREE KINDS + DELIVERY (owner 2026-08-08)
//   The dialog now asks two more things before it sends, because the owner asked for both:
//     WHAT KIND      per team (one invitation each), first come first served (more teams than
//                    places, quickest in), or one general invitation (a single open offer).
//     WHERE TO SEND  in-app notification, email, WhatsApp, in any combination. Every channel goes
//                    to EVERYONE who can answer for the team (owner, captain, vice-captain,
//                    manager, coach), not only the captain.
//   A "first come, first served" send also takes a places count, and a general invitation writes no
//   per-team rows at all, which is why the table below lists CAMPAIGNS as well as invitations: a
//   general invitation would otherwise be invisible on the screen that sent it.
//
// WHICH ENDPOINTS IT HITS (afc_tournament_and_scrims/event_invites.py)
//   GET  /events/team-invitations/?event_id=       this event's invitations, campaigns and counts
//   POST /events/team-invitations/create/          {event_id, team_ids[], kind, delivery, slots,
//                                                   message}
//   POST /events/team-invitations/<id>/cancel/     take back a pending one
//   POST /events/invitation-campaigns/<id>/close/  stop an offer taking new answers
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Shared, self-expiring NEW tag (owner rule: any new surface wears one for 5 days).
import { NewBadge } from "@/components/NewBadge";
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

// The three kinds an invitation can be sent as, and the channels it can go out on. Both vocabularies
// are the BACKEND's: `kind` matches EventInvitationCampaign.KIND_CHOICES and the channel tokens are
// afc_auth.audience's, comma-joined into the `delivery` field. Kept as literal unions so a typo is
// a compile error here rather than a 400 at send time.
type InviteKind = "per_team" | "fcfs" | "bulk";
type Channel = "push" | "email" | "whatsapp";

const KINDS: InviteKind[] = ["per_team", "fcfs", "bulk"];
const CHANNELS: Channel[] = ["push", "email", "whatsapp"];

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
  kind: InviteKind;
  campaign_id: number | null;
}

// One campaign of /events/team-invitations/ (event_invites._serialize_campaign): the invitation as
// the organizer authored it. Listed alongside the rows because a BULK send writes no rows.
interface Campaign {
  campaign_id: number;
  kind: InviteKind;
  status: "open" | "closed" | "cancelled";
  message: string;
  delivery: string;
  slots: number | null;
  slots_remaining: number | null;
  audience_size: number;
  accepted_count: number;
  created_at: string;
  created_by: string | null;
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

// GET /events/team-invitations/reach/ (event_invites.invitation_reach): how many PEOPLE the
// current selection would reach, per channel, deduplicated across teams.
interface Reach {
  recipients: number;
  email: number;
  whatsapp: number;
  teams: number;
}

interface EventTeamInvitesCardProps {
  eventId: number;
  eventName: string;
  /** team_ids already registered for the event: shown as "Registered" and not selectable. */
  registeredTeamIds?: number[];
}

// Every error body the invitation endpoints return carries a human-readable `message`
// (afc_tournament_and_scrims/event_invites.py returns {"message": ...} on every refusal). Narrowing
// through axios's own type guard states that shape once and checks it, instead of reaching through
// an `any` at four separate call sites.
function errorMessage(err: unknown): string | undefined {
  return axios.isAxiosError<{ message?: string }>(err)
    ? err.response?.data?.message
    : undefined;
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
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [closingId, setClosingId] = useState<number | null>(null);

  // Invite dialog state.
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<PickableTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  // The two new choices (owner 2026-08-08). Defaults are deliberately the OLD behaviour: one
  // invitation per team, delivered in-app and by email, so an organizer who changes nothing gets
  // exactly what this card did before, and "both" is what the backend defaults to as well.
  const [kind, setKind] = useState<InviteKind>("per_team");
  const [channels, setChannels] = useState<Channel[]>(["push", "email"]);
  const [slots, setSlots] = useState("");
  // How many people the CURRENT selection would actually reach, per channel. Fetched live rather
  // than written into the copy, because the WhatsApp figure is the whole point and a number typed
  // into a translation string is wrong the day after it is written.
  const [reach, setReach] = useState<Reach | null>(null);

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
      setCampaigns(res.data.campaigns ?? []);
      setCounts(res.data.counts ?? {});
    } catch {
      toast.error(t("organizer.toastLoadFailed"));
    } finally {
      setLoading(false);
    }
    // `t` is listed even though it is only read in the failure toast. It is safe to list: use-intl
    // memoises the translator on the intl context, so its identity does not change between renders
    // (measured in the browser, 2026-08-06: stable across 30 consecutive renders including typing).
    // Listing it therefore costs nothing and keeps this callback honest with exhaustive-deps.
  }, [token, eventId, t]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  // The picker's team list is only fetched when the dialog opens (the whole roster is a big list
  // and most visits to this tab never invite anybody). Mirrors AddTeamsModal.
  //
  // This effect RESETS the form (selected / search / message), so it must fire on OPEN and not on
  // an ordinary re-render: if it re-ran while the dialog was open, an organizer's ticked teams
  // would vanish as they typed their note. That is safe with `t` listed, because use-intl memoises
  // the translator on the intl context (verified in the browser: `t` identity stable across 30
  // renders, and typing into the message box does not re-run this effect). The locale itself can
  // only change on the profile page, which navigates away, so it can never swap under an open
  // dialog either.
  useEffect(() => {
    if (!open || !token) return;
    setTeamsLoading(true);
    setSelected([]);
    setSearch("");
    setMessage("");
    setKind("per_team");
    setChannels(["push", "email"]);
    setSlots("");
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-all-teams/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setTeams(res.data.teams ?? []))
      .catch(() => toast.error(t("organizer.toastTeamsFailed")))
      .finally(() => setTeamsLoading(false));
  }, [open, token, t]);

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

  const toggleChannel = (channel: Channel) =>
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel],
    );

  // ── Live reach for the current selection ─────────────────────────────────────────────────
  // Re-asked whenever the ticked teams change, so the WhatsApp line under the tick box says
  // "reaches 2 of these 14 people" about THIS send rather than quoting a site-wide average.
  // Debounced by 300ms because ticking several teams in a row would otherwise fire a request per
  // click, and aborted on change so a slow earlier answer cannot overwrite a newer one.
  useEffect(() => {
    if (!open || !token) return;
    if (selected.length === 0) {
      setReach(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      axios
        .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/team-invitations/reach/`, {
          params: { event_id: eventId, team_ids: selected.join(",") },
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        .then((res) => setReach(res.data))
        // Silent: reach is advisory. A failed lookup must not block a send or nag the organizer,
        // it just means the line is not shown.
        .catch(() => undefined);
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, token, eventId, selected]);

  const handleSend = async () => {
    if (selected.length === 0 || channels.length === 0) return;
    setSending(true);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/team-invitations/create/`,
        {
          event_id: eventId,
          team_ids: selected,
          message: message.trim(),
          kind,
          // The backend speaks afc_auth.audience's comma-joined vocabulary, so the tick boxes are
          // joined rather than sent as a list. parse_delivery accepts either, but matching the
          // stored form keeps the request readable in a log.
          delivery: channels.join(","),
          // Only meaningful for first come, first served, and the backend REFUSES it on the other
          // kinds rather than ignoring it, so it must not be sent otherwise.
          ...(kind === "fcfs" && slots.trim() ? { slots: Number(slots) } : {}),
        },
        authHeader,
      );
      const invited = res.data.invited?.length ?? 0;
      const skipped = res.data.skipped ?? [];
      const delivered = res.data.delivered ?? {};
      // What actually went out, per channel. Worth showing because the channels are a choice now:
      // an organizer who ticked WhatsApp needs to see that it reached two people, not twenty.
      const deliveryLine = t("organizer.toastDelivered", {
        recipients: delivered.recipients ?? 0,
        pushed: delivered.pushed ?? 0,
        emailed: delivered.emailed ?? 0,
        whatsapp: delivered.whatsapp ?? 0,
      });
      // A partly-skipped batch is normal (a team registered itself an hour ago), so it is reported
      // rather than hidden: the toast names how many went out and, per skipped team, why not.
      const skipLine =
        skipped.length > 0
          ? skipped
              .map(
                (s: { team_name: string | null; reason: string }) =>
                  `${s.team_name ?? s.reason}: ${t(`skipReason.${s.reason}` as never)}`,
              )
              .join(", ")
          : "";
      // A bulk send addresses nobody, so "3 teams invited" would be wrong: it is one invitation
      // that N teams were told about.
      const headline =
        kind === "bulk"
          ? t("organizer.toastSentBulk", { count: res.data.campaign?.audience_size ?? 0 })
          : skipped.length > 0
            ? t("organizer.toastSentWithSkips", { count: invited, skipped: skipped.length })
            : t("organizer.toastSent", { count: invited });

      toast.success(headline, {
        description: skipLine ? `${deliveryLine} ${skipLine}` : deliveryLine,
        duration: 10000,
      });
      setOpen(false);
      fetchInvitations();
    } catch (err) {
      toast.error(errorMessage(err) || t("organizer.toastSendFailed"));
    } finally {
      setSending(false);
    }
  };

  // Close an offer so it stops taking new answers. Answers already given stand: teams that accepted
  // are in the bracket, which is why this is "close", not "cancel".
  const handleClose = async (campaignId: number) => {
    setClosingId(campaignId);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/invitation-campaigns/${campaignId}/close/`,
        {},
        authHeader,
      );
      toast.success(t("organizer.toastClosed"));
      fetchInvitations();
    } catch (err) {
      toast.error(errorMessage(err) || t("organizer.toastCloseFailed"));
    } finally {
      setClosingId(null);
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
    } catch (err) {
      toast.error(errorMessage(err) || t("organizer.toastCancelFailed"));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          {/* Title + NEW tag grouped in their own flex row so the CardTitle's
              justify-between still puts the title left and the button right. Inviting a
              team to an event shipped 2026-08-06; the badge expires by itself 5 days on. */}
          <span className="flex items-center gap-2">
            {t("organizer.title")}
            <NewBadge since="2026-08-06" />
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            <IconMailForward className="size-4 mr-1.5" />
            {t("organizer.inviteButton")}
          </Button>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("organizer.description")}</p>
      </CardHeader>

      <CardContent>
        {/* ── Campaigns: the invitations AS SENT ────────────────────────────────────────────
            Listed above the per-team rows because a BULK send writes no per-team rows at all:
            without this an organizer would press Send, see nothing appear, and send again. It
            also carries the only place a first-come race is visible ("2 of 5 places left"). */}
        {campaigns.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium mb-2 flex items-center gap-2">
              {t("organizer.campaignsTitle")}
              <NewBadge since="2026-08-08" />
            </p>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("organizer.colKind")}</TableHead>
                    <TableHead>{t("organizer.colStatus")}</TableHead>
                    <TableHead>{t("organizer.colAudience")}</TableHead>
                    <TableHead>{t("organizer.colPlaces")}</TableHead>
                    <TableHead>{t("organizer.colAccepted")}</TableHead>
                    <TableHead>{t("organizer.colSent")}</TableHead>
                    <TableHead>{t("organizer.colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.campaign_id}>
                      <TableCell className="text-xs font-medium">
                        {t(`kind.${campaign.kind}` as never)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            campaign.status === "open"
                              ? "text-green-400 border-green-800"
                              : "text-muted-foreground"
                          }`}
                        >
                          {t(`campaignStatus.${campaign.status}` as never)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {campaign.audience_size}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {/* Only a first-come send has a places ceiling of its own. For the other
                            kinds the event's own capacity is the limit, so a number here would be
                            a number we do not actually enforce. */}
                        {campaign.slots === null
                          ? t("organizer.noPlaceLimit")
                          : t("organizer.placesLeft", {
                              left: campaign.slots_remaining ?? 0,
                              total: campaign.slots,
                            })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {campaign.accepted_count}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <LocalTime value={campaign.created_at} mode="date" />
                      </TableCell>
                      <TableCell>
                        {campaign.status === "open" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={closingId === campaign.campaign_id}
                            onClick={() => handleClose(campaign.campaign_id)}
                          >
                            {closingId === campaign.campaign_id && (
                              <IconLoader2 className="size-4 animate-spin mr-1" />
                            )}
                            {closingId === campaign.campaign_id
                              ? t("organizer.closing")
                              : t("organizer.closeCampaign")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
            <IconLoader2 className="size-4 animate-spin" />
            {t("organizer.loadingTeams")}
          </div>
        ) : invitations.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            {campaigns.length > 0 ? t("organizer.emptyRowsWithCampaign") : t("organizer.empty")}
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
        {/* max-h + overflow-y-auto because this dialog GREW: the kind picker, its three
            explanations, the channel tick boxes and (on a first come, first served send) the
            places field push it to ~971px, and a 390x844 phone then cut off BOTH the title and
            the Send button, so an organizer could not send that kind of invitation at all.
            Measured on the 390px pass, not guessed. dvh rather than vh so a mobile browser's
            retracting address bar does not re-clip it. */}
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
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

            {/* ── What kind of invitation (owner 2026-08-08) ──────────────────────────────
                Stacked rather than in a row: each option needs its one-line explanation next to
                it, because "first come, first served" and "one general invitation" are not
                self-evident from three words, and on a 390px phone three side-by-side radios with
                captions do not fit. */}
            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-2">
                {t("organizer.kindLabel")}
                <NewBadge since="2026-08-08" />
              </Label>
              <RadioGroup
                value={kind}
                onValueChange={(value) => setKind(value as InviteKind)}
                className="flex flex-col gap-2"
              >
                {KINDS.map((option) => (
                  <div key={option} className="flex items-start gap-2">
                    <RadioGroupItem
                      value={option}
                      id={`event-invite-kind-${option}`}
                      className="mt-0.5 shrink-0"
                    />
                    {/* A NATIVE label, not the shared <Label>: that one is `uppercase` and
                        `items-center`, which centred this column away from its radio and shouted
                        a full explanatory sentence in capitals. Both were visible on the 390px
                        pass. htmlFor still ties the whole row to the radio, so the tap target is
                        the 44px row rather than the 15px dot. */}
                    <label
                      htmlFor={`event-invite-kind-${option}`}
                      className="flex flex-col gap-0.5 cursor-pointer select-none flex-1 min-w-0"
                    >
                      <span className="text-sm font-medium">{t(`kind.${option}` as never)}</span>
                      <span className="text-xs text-muted-foreground">
                        {t(`kindHint.${option}` as never)}
                      </span>
                    </label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Places only exist for a first-come send: on the other kinds the backend REFUSES a
                slots value rather than ignoring it, so the field is not just hidden, it is not
                sent. Leaving it empty means the event's own capacity is the only limit. */}
            {kind === "fcfs" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="event-invite-slots">{t("organizer.slotsLabel")}</Label>
                <Input
                  id="event-invite-slots"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={slots}
                  onChange={(e) => setSlots(e.target.value)}
                  placeholder={t("organizer.slotsPlaceholder")}
                />
                <p className="text-xs text-muted-foreground">{t("organizer.slotsHint")}</p>
              </div>
            )}

            {/* ── Where it goes (owner 2026-08-08) ────────────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-2">
                {t("organizer.deliveryLabel")}
                <NewBadge since="2026-08-08" />
              </Label>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {CHANNELS.map((channel) => (
                  // py-1.5 is not decoration: the bare row is 19px tall, which is a poor tap
                  // target on a phone. The padding takes the whole label past 30px, and the label
                  // (not the 16px box) is what a thumb actually hits.
                  <label
                    key={channel}
                    className="flex items-center gap-2 py-1.5 cursor-pointer select-none"
                  >
                    <Checkbox
                      checked={channels.includes(channel)}
                      onCheckedChange={() => toggleChannel(channel)}
                    />
                    <span className="text-sm">{t(`channel.${channel}` as never)}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t("organizer.deliveryHint")}</p>

              {/* THE NUMBERS, said before the send rather than after. Every AFC account has an
                  email address; WhatsApp only reaches somebody who saved a number and left the
                  opt-in on, which site-wide is under 4% of the people who can answer an
                  invitation. An organizer who ticks WhatsApp and assumes the teams were told is
                  exactly what this prevents, so the real count for THIS selection is printed
                  under the tick boxes. Live from the reach endpoint, never a number in the copy. */}
              {reach && reach.recipients > 0 && (
                <div className="text-xs flex flex-col gap-0.5">
                  <span className="text-muted-foreground">
                    {t("organizer.reachRecipients", {
                      people: reach.recipients,
                      teams: reach.teams,
                    })}
                  </span>
                  {channels.includes("email") && (
                    <span className="text-muted-foreground">
                      {t("organizer.reachEmail", {
                        reached: reach.email,
                        people: reach.recipients,
                      })}
                    </span>
                  )}
                  {channels.includes("whatsapp") && (
                    // Amber when it would reach nobody, because that is the case an organizer
                    // most needs to notice before pressing Send.
                    <span className={reach.whatsapp === 0 ? "text-red-400" : "text-yellow-400"}>
                      {t("organizer.reachWhatsapp", {
                        reached: reach.whatsapp,
                        people: reach.recipients,
                      })}
                    </span>
                  )}
                </div>
              )}

              {channels.includes("whatsapp") && (
                <p className="text-xs text-yellow-400">{t("organizer.deliveryWhatsappHint")}</p>
              )}
              {channels.length === 0 && (
                <p className="text-xs text-red-400">{t("organizer.deliveryNoneSelected")}</p>
              )}
            </div>

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
                <Button
                  onClick={handleSend}
                  disabled={sending || selected.length === 0 || channels.length === 0}
                >
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
