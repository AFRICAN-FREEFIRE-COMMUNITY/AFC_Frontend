"use client";

import { Fragment, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const teamCount =
    eventDetails.participant_type === "squad"
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
            {eventDetails.participant_type === "squad" ? "Teams" : "Players"} (
            {teamCount})
          </span>
          {eventDetails.participant_type === "squad" && (
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
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="overflow-x-auto rounded-md border max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {eventDetails.participant_type === "squad"
                    ? "Teams"
                    : "Players"}
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
                      {comp.username}
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
                    </TableCell>
                  </TableRow>
                ))}

              {/* Logic for Squads/Teams. Each team row is now EXPANDABLE: clicking the
                  team name (or its chevron) reveals a sub-row listing the team's PLAYERS
                  (in-game name, UID, status) from team.members, so an admin can see who
                  is on each registered team without leaving this tab. */}
              {eventDetails.participant_type === "squad" &&
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
    </Card>
  );
}
