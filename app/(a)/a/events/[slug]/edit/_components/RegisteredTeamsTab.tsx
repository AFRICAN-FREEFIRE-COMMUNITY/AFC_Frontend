"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { DisqualifyModal } from "../../../_components/DisqualifyModal";
import { ReactivateModal } from "../../../_components/ReactivateModal";

interface RegisteredTeamsTabProps {
  eventDetails: {
    event_id: number;
    participant_type: string;
    registered_competitors: Array<{
      player_id: number;
      username: string;
      status: string;
    }>;
    tournament_teams: any[];
  };
  updateCompetitorStatus: (playerId: number, newStatus: string) => void;
}

export default function RegisteredTeamsTab({
  eventDetails,
  updateCompetitorStatus,
}: RegisteredTeamsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Registered{" "}
          {eventDetails.participant_type === "squad" ? "Teams" : "Players"}{" "}
          (
          {eventDetails?.registered_competitors?.length ||
            eventDetails.tournament_teams.length}
          )
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
                eventDetails?.registered_competitors?.map((comp) => (
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

              {/* Logic for Squads/Teams */}
              {eventDetails.participant_type === "squad" &&
                eventDetails?.tournament_teams?.map((team) => (
                  <TableRow key={team.team_id || team.player_id}>
                    <TableCell className="capitalize font-medium">
                      {team.team_name}
                    </TableCell>
                    <TableCell className="capitalize">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-xs",
                          team.status === "registered"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700",
                        )}
                      >
                        {team.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
