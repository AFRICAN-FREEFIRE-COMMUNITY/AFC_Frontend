"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";
// Shared advisory-watchlist badge + client (components/WatchTag.tsx, lib/watchlist.ts). On load we
// ask watchlistApi.tags once which of the visible team_ids / member player_ids are actively watched,
// then render <WatchTag> next to those names so staff see the flag right on the registered roster.
import { WatchTag } from "@/components/WatchTag";
import { watchlistApi } from "@/lib/watchlist";
import { IconChevronDown, IconUser } from "@tabler/icons-react";
import { DisqualifyModal } from "../../../_components/DisqualifyModal";
import { ReactivateModal } from "../../../_components/ReactivateModal";
import { AddTeamsModal } from "../../../_components/AddTeamsModal";
// Admin roster corrector: lets staff fix a registered team's event lineup (even after
// registration closes) by POSTing /events/edit-roster/. Reopens the team for sponsor
// re-approval when the roster changes. See EditRosterModal.tsx for the full contract.
import { EditRosterModal } from "../../../_components/EditRosterModal";

// A single player on a registered team's roster (from get_event_details
// tournament_teams[].members). username is the in-game name; uid + full_name give full
// identity; status is the per-member roster snapshot status.
interface TeamMember {
  player_id: number;
  username: string;
  uid?: string | null;
  full_name?: string | null;
  status?: string;
}

interface RegisteredTeamsTabProps {
  eventDetails: {
    event_id: number;
    event_name: string;
    participant_type: string;
    // Whether the event requires sponsor IDs. Threaded from the parent edit page's
    // eventDetails (get_event_details exposes is_sponsored; see edit/types.tsx). The
    // EditRosterModal needs it to collect per-player sponsor IDs on a sponsored event.
    is_sponsored?: boolean;
    registered_competitors: Array<{
      player_id: number;
      username: string;
      uid?: string | null;
      full_name?: string | null;
      status: string;
      is_waitlisted?: boolean;
    }>;
    tournament_teams: any[];
  };
  updateCompetitorStatus: (playerId: number, newStatus: string) => void;
  // In-place refresh (owner 2026-06-13 "no manual refresh"): the edit page passes its
  // fetchEventDetails here so the Add-Teams + Edit-Roster modals can re-pull + re-render
  // the registered roster instead of forcing a window.location.reload().
  onRefresh?: () => void;
}

export default function RegisteredTeamsTab({
  eventDetails,
  updateCompetitorStatus,
  onRefresh,
}: RegisteredTeamsTabProps) {
  // Which registered teams are expanded to show their player roster. Keyed by
  // tournament_team_id (falls back to team_id) so each team toggles independently.
  // Lets an admin see the PLAYERS inside each registered team, not just the team name
  // (owner request 2026-06-09); the players come from team.members on get_event_details.
  const [expandedTeams, setExpandedTeams] = useState<Record<number, boolean>>(
    {},
  );
  const toggleTeam = (key: number) =>
    setExpandedTeams((prev) => ({ ...prev, [key]: !prev[key] }));

  // No-show toggle (owner 2026-06-17): mark an active competitor absent so a waitlist team can take
  // the slot (Promote on the Waitlist tab). value flips the current is_no_show. Refreshes after.
  const { token } = useAuth();
  const [noShowBusy, setNoShowBusy] = useState<number | null>(null);
  const markNoShow = async (
    opts: { competitorId?: number; tournamentTeamId?: number; current?: boolean; key: number },
  ) => {
    if (!token) return;
    setNoShowBusy(opts.key);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/mark-no-show/`,
        {
          event_id: eventDetails.event_id,
          value: !opts.current,
          ...(opts.tournamentTeamId
            ? { tournament_team_id: opts.tournamentTeamId }
            : { competitor_id: opts.competitorId }),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(opts.current ? "No-show cleared." : "Marked as no-show.");
      onRefresh?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to update no-show.");
    } finally {
      setNoShowBusy(null);
    }
  };

  // ── F1 no-show reputation (owner 2026-06-19) ──
  // Pull the repeat-no-show warning status for every visible team/player so a "⚠ Repeat no-show"
  // badge can flag teams that no-showed >= 2 times in the last 7 days (across ALL events). Bulk
  // call mirrors the blacklist-counts pattern.
  type Warn = { recent_count: number; total: number; is_warning: boolean };
  const [warnings, setWarnings] = useState<{
    teams: Record<number, Warn>;
    users: Record<number, Warn>;
  }>({ teams: {}, users: {} });
  // Pending no-show MARK awaiting confirmation (clearing a no-show skips the dialog).
  const [confirmTarget, setConfirmTarget] = useState<{
    competitorId?: number;
    tournamentTeamId?: number;
    key: number;
    name: string;
  } | null>(null);
  const [detectBusy, setDetectBusy] = useState(false);

  // A "team event" is anything that registers TEAMS (tournament_teams): both squad AND duo. The old
  // `=== "squad"` checks left duo events rendering an empty table and built warning ids from the wrong
  // collection. get_event_details populates tournament_teams for duo + squad alike. (Adversarial-review
  // fix, owner 2026-06-19.)
  const isTeamEvent = eventDetails.participant_type !== "solo";

  const fetchWarnings = useCallback(async () => {
    if (!token) return;
    const team_ids = isTeamEvent
      ? eventDetails.tournament_teams.map((t: any) => t.team_id).filter(Boolean)
      : [];
    const user_ids = !isTeamEvent
      ? (eventDetails.registered_competitors ?? []).map((c) => c.player_id)
      : [];
    if (team_ids.length === 0 && user_ids.length === 0) return;
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/no-show-warnings/`,
        { team_ids, user_ids },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setWarnings({ teams: res.data?.teams ?? {}, users: res.data?.users ?? {} });
    } catch {
      /* badges are best-effort; ignore */
    }
  }, [token, isTeamEvent, eventDetails]);

  useEffect(() => {
    fetchWarnings();
  }, [fetchWarnings]);

  // ── Watchlist tags (owner 2026-06-21) ──
  // One bulk "which of these ids are actively watched" call per load (and again whenever the team
  // list changes), collecting EVERY visible team id + member/competitor player id. Drives the
  // <WatchTag> badge next to flagged team + player names. Best-effort: failures leave it empty.
  const [watched, setWatched] = useState<{
    teamIds: Set<number>;
    playerIds: Set<number>;
  }>({ teamIds: new Set(), playerIds: new Set() });

  const fetchWatchTags = useCallback(async () => {
    // Teams: the registered teams' site team_id. Players: solo competitors OR every team member.
    const teamIds = isTeamEvent
      ? eventDetails.tournament_teams.map((t: any) => t.team_id).filter(Boolean)
      : [];
    const playerIds = isTeamEvent
      ? eventDetails.tournament_teams.flatMap((t: any) =>
          (t.members ?? []).map((m: TeamMember) => m.player_id),
        )
      : (eventDetails.registered_competitors ?? []).map((c) => c.player_id);
    if (teamIds.length === 0 && playerIds.length === 0) return;
    try {
      const res = await watchlistApi.tags({ teamIds, playerIds });
      setWatched({
        teamIds: new Set(res.watched_team_ids),
        playerIds: new Set(res.watched_player_ids),
      });
    } catch {
      /* badges are best-effort; ignore */
    }
  }, [isTeamEvent, eventDetails]);

  useEffect(() => {
    fetchWatchTags();
  }, [fetchWatchTags]);

  // Warning lookup for a row. Squad rows key on team_id; solo rows on the user id (player_id).
  const teamWarning = (teamId?: number) =>
    teamId != null ? warnings.teams[teamId] : undefined;
  const userWarning = (userId?: number) =>
    userId != null ? warnings.users[userId] : undefined;
  // Amber "⚠ Repeat no-show (N)" chip shown next to a flagged team/player (>=2 no-shows / 7 days).
  const warnBadge = (w?: Warn) =>
    w?.is_warning ? (
      <Badge
        variant="outline"
        className="rounded-full px-2 py-0.5 text-[10px] border-amber-500/60 text-amber-500 inline-flex items-center gap-1"
        title={`${w.recent_count} no-show(s) in the last 7 days (${w.total} total)`}
      >
        <IconAlertTriangle size={11} /> Repeat no-show ({w.recent_count})
      </Badge>
    ) : null;

  // Mark requires confirmation (it counts against the team's reputation + frees their slot);
  // clearing is reversible/safe so it fires straight away.
  const requestNoShow = (opts: {
    competitorId?: number;
    tournamentTeamId?: number;
    current?: boolean;
    key: number;
    name: string;
  }) => {
    if (opts.current) {
      markNoShow(opts);
      return;
    }
    setConfirmTarget({
      competitorId: opts.competitorId,
      tournamentTeamId: opts.tournamentTeamId,
      key: opts.key,
      name: opts.name,
    });
  };

  const confirmAndMark = async () => {
    if (!confirmTarget) return;
    await markNoShow({ ...confirmTarget, current: false });
    setConfirmTarget(null);
    fetchWarnings();
  };

  // Suggest-only detection: ask the backend which registered competitors have NO results entered
  // (look like no-shows). We surface the names; the admin confirms each via the row's No-show button.
  const runDetect = async () => {
    if (!token) return;
    setDetectBusy(true);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/detect-no-shows/`,
        { event_id: eventDetails.event_id },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const names = (res.data?.suggestions ?? []).map((s: any) => s.name);
      if (names.length === 0) {
        toast.success("No likely no-shows: every registered competitor has results entered.");
      } else {
        toast.warning(
          `${names.length} registered ${isTeamEvent ? "team" : "player"}(s) have no results entered`,
          {
            description: `${names.join(", ")}. Review and mark any that didn't show using the No-show button.`,
            duration: 15000,
          },
        );
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to check for no-shows.");
    } finally {
      setDetectBusy(false);
    }
  };

  const teamCount =
    isTeamEvent
      ? eventDetails.tournament_teams.filter((t: any) => !t.is_waitlisted)
          .length
      : eventDetails?.registered_competitors?.filter((c) => !c.is_waitlisted)
          .length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span>
            Registered{" "}
            {isTeamEvent ? "Teams" : "Players"} (
            {teamCount})
          </span>
          <span className="inline-flex items-center gap-2 flex-wrap">
            {/* F1 suggest-only no-show detection: lists registered competitors with no results entered. */}
            <Button
              size="sm"
              variant="outline"
              onClick={runDetect}
              disabled={detectBusy}
            >
              {detectBusy && <IconLoader2 className="size-4 animate-spin mr-1" />}
              Check for no-shows
            </Button>
            {isTeamEvent && (
              <span className="inline-flex items-center gap-1">
                <AddTeamsModal
                  mode="event"
                  targetId={eventDetails.event_id}
                  targetName={eventDetails.event_name}
                  existingTeamIds={eventDetails.tournament_teams.map(
                    (t: any) => t.team_id,
                  )}
                  // Re-pull + re-render in place after teams are added (no reload).
                  onSuccess={() => onRefresh?.()}
                />
                {/* Edit-only: manually placing teams into the event. */}
                <InfoTip id="events.edit.add_teams" />
              </span>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="overflow-x-auto rounded-md border max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {isTeamEvent ? "Teams" : "Players"}
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Logic for Solo Players */}
              {eventDetails.participant_type === "solo" &&
                eventDetails?.registered_competitors
                  ?.filter((c) => !c.is_waitlisted)
                  .map((comp) => (
                  <TableRow key={comp.player_id}>
                    <TableCell className="capitalize font-medium">
                      <span className="inline-flex items-center gap-2 flex-wrap">
                        {comp.username}
                        {/* Advisory watchlist flag for this player. */}
                        {watched.playerIds.has(comp.player_id) && (
                          <WatchTag reason="On the advisory watchlist" />
                        )}
                        {warnBadge(userWarning(comp.player_id))}
                      </span>
                    </TableCell>
                    <TableCell className="capitalize">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-xs",
                          comp.status === "registered"
                            ? "bg-green-100 text-green-700"
                            : comp.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700",
                        )}
                      >
                        {comp.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* No-show toggle (owner 2026-06-17): frees the slot for a waitlist promote. */}
                        <Button
                          size="sm"
                          variant={(comp as any).is_no_show ? "secondary" : "outline"}
                          disabled={noShowBusy === comp.player_id}
                          onClick={() =>
                            requestNoShow({
                              competitorId: comp.player_id,
                              current: !!(comp as any).is_no_show,
                              key: comp.player_id,
                              name: comp.username,
                            })
                          }
                        >
                          {(comp as any).is_no_show ? "No-show ✓" : "No-show"}
                        </Button>
                        {comp.status === "registered" ? (
                          <DisqualifyModal
                            competitor_id={comp.player_id}
                            event_id={eventDetails.event_id}
                            name={comp.username}
                            showLabel
                            onSuccess={() =>
                              updateCompetitorStatus(
                                comp.player_id,
                                "disqualified",
                              )
                            }
                          />
                        ) : (
                          <ReactivateModal
                            competitor_id={comp.player_id}
                            event_id={eventDetails.event_id}
                            name={comp.username}
                            showLabel
                            onSuccess={() =>
                              updateCompetitorStatus(comp.player_id, "registered")
                            }
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

              {/* Logic for Squads/Teams. Each team row is now EXPANDABLE: clicking the
                  team name (or its chevron) reveals a sub-row listing the team's PLAYERS
                  (in-game name, UID, status) from team.members, so an admin can see who
                  is on each registered team without leaving this tab. */}
              {isTeamEvent &&
                eventDetails?.tournament_teams
                  ?.filter((t: any) => !t.is_waitlisted)
                  .map((team) => {
                  const key = team.tournament_team_id || team.team_id || team.player_id;
                  const members: TeamMember[] = team.members || [];
                  const isOpen = !!expandedTeams[key];
                  return (
                  <Fragment key={key}>
                  <TableRow>
                    <TableCell className="font-medium">
                      {/* Click the name to expand the roster; chevron rotates when open. */}
                      <button
                        type="button"
                        onClick={() => toggleTeam(key)}
                        className="flex items-center gap-1.5 text-left hover:text-primary transition-colors"
                        aria-expanded={isOpen}
                      >
                        <IconChevronDown
                          size={16}
                          className={cn(
                            "shrink-0 text-muted-foreground transition-transform",
                            isOpen && "rotate-180",
                          )}
                        />
                        <span className="capitalize">{team.team_name}</span>
                        <Badge
                          variant="outline"
                          className="ml-1 rounded-full px-2 py-0.5 text-[10px]"
                        >
                          {members.length} player{members.length === 1 ? "" : "s"}
                        </Badge>
                      </button>
                      {/* Advisory watchlist flag for this team (keyed on its site team_id). */}
                      {watched.teamIds.has(team.team_id) && (
                        <span className="ml-2 inline-flex">
                          <WatchTag reason="On the advisory watchlist" />
                        </span>
                      )}
                      {warnBadge(teamWarning(team.team_id)) && (
                        <span className="ml-2 inline-flex">
                          {warnBadge(teamWarning(team.team_id))}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-xs",
                          team.status === "registered"
                            ? "bg-green-100 text-green-700"
                            : team.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700",
                        )}
                      >
                        {team.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {/* Squad-only actions: correct the roster, then disqualify /
                          reactivate. EditRosterModal POSTs /events/edit-roster/ for THIS
                          team and reopens it for sponsor re-approval on change. */}
                      <div className="flex items-center justify-end gap-2">
                        {/* No-show toggle (owner 2026-06-17): frees the slot for a waitlist promote. */}
                        <Button
                          size="sm"
                          variant={team.is_no_show ? "secondary" : "outline"}
                          disabled={noShowBusy === key}
                          onClick={() =>
                            requestNoShow({
                              tournamentTeamId: team.tournament_team_id,
                              current: !!team.is_no_show,
                              key,
                              name: team.team_name,
                            })
                          }
                        >
                          {team.is_no_show ? "No-show ✓" : "No-show"}
                        </Button>
                        <EditRosterModal
                          event_id={eventDetails.event_id}
                          team_id={team.team_id || team.player_id}
                          team_name={team.team_name}
                          participant_type={eventDetails.participant_type}
                          is_sponsored={!!eventDetails.is_sponsored}
                          currentRoster={members}
                          // Re-pull + re-render in place after the roster is corrected
                          // (no reload): the team's new lineup + reopened status show.
                          onSuccess={() => onRefresh?.()}
                        />
                        {team.status === "active" ? (
                          <DisqualifyModal
                            competitor_id={team.team_id || team.player_id}
                            event_id={eventDetails.event_id}
                            name={team.team_name}
                            showLabel
                            onSuccess={() =>
                              updateCompetitorStatus(
                                team.team_id || team.player_id,
                                "disqualified",
                              )
                            }
                          />
                        ) : (
                          <ReactivateModal
                            competitor_id={team.team_id || team.player_id}
                            event_id={eventDetails.event_id}
                            name={team.team_name}
                            showLabel
                            onSuccess={() =>
                              updateCompetitorStatus(
                                team.team_id || team.player_id,
                                "registered",
                              )
                            }
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {/* Expanded roster: the players on this registered team. */}
                  {isOpen && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={3} className="p-0">
                        {members.length === 0 ? (
                          <p className="px-6 py-3 text-xs text-muted-foreground">
                            No players on this team's roster.
                          </p>
                        ) : (
                          <div className="px-6 py-2 divide-y divide-border/50">
                            {members.map((m) => (
                              <div
                                key={m.player_id}
                                className="flex items-center gap-2 py-1.5 text-xs"
                              >
                                <IconUser
                                  size={14}
                                  className="shrink-0 text-muted-foreground"
                                />
                                <span className="font-medium">{m.username}</span>
                                {/* Advisory watchlist flag for this roster player. */}
                                {watched.playerIds.has(m.player_id) && (
                                  <WatchTag reason="On the advisory watchlist" />
                                )}
                                {m.uid && (
                                  <span className="text-muted-foreground">
                                    UID {m.uid}
                                  </span>
                                )}
                                {m.full_name && (
                                  <span className="text-muted-foreground">
                                    ({m.full_name})
                                  </span>
                                )}
                                {m.status && (
                                  <Badge
                                    variant="outline"
                                    className="ml-auto rounded-full px-2 py-0.5 text-[10px] capitalize"
                                  >
                                    {m.status}
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* F1: confirm marking a no-show (it counts against the team's reputation + frees their slot
          for the waitlist). Clearing a no-show skips this and fires immediately. */}
      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(o) => !o && setConfirmTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mark {confirmTarget?.name} as a no-show?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This frees their slot for a waitlisted{" "}
              {isTeamEvent ? "team" : "player"} and counts toward their no-show
              record. Two or more no-shows in a week flags them with a warning
              other organizers can see. You can undo this later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={noShowBusy !== null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmAndMark();
              }}
              disabled={noShowBusy !== null}
            >
              {noShowBusy !== null && (
                <IconLoader2 className="size-4 animate-spin mr-1" />
              )}
              Mark no-show
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
