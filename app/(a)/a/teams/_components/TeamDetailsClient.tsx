"use client";

import { useState, useEffect } from "react";
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
import { toast } from "sonner";
import { FullLoader } from "@/components/Loader";
import { BanModal } from "../../_components/BanModal";
import { PageHeader } from "@/components/PageHeader";
import { Separator } from "@/components/ui/separator";
import { NothingFound } from "@/components/NothingFound";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";

type TeamDetailsClientProps = {
  teamId: string;
  initialData?: any; // Server-fetched team data
};

export function TeamDetailsClient({
  teamId,
  initialData,
}: TeamDetailsClientProps) {
  const { token } = useAuth();
  const [teamDetails, setTeamDetails] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialData);

  // Only fetch if we don't have initialData
  useEffect(() => {
    if (!initialData && teamId && token) {
      fetchTeamDetails();
    }
  }, [teamId, token, initialData]);

  const fetchTeamDetails = async () => {
    if (!teamId) return;

    setLoading(true);
    try {
      const decodedId = decodeURIComponent(teamId);
      const response = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ team_name: decodedId }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch team details");
      }

      const data = await response.json();
      setTeamDetails(data.team);
    } catch (error: any) {
      console.error("Error fetching team details:", error);
      toast.error(error.message || "Failed to load team details");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <FullLoader />;
  }

  if (!teamDetails) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Team Not Found</h1>
        <p className="text-muted-foreground">
          The team you're looking for doesn't exist or has been removed.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <PageHeader title={`${teamDetails.team_name} Details`} back />
        <BanModal
          isBanned={teamDetails.is_banned}
          teamName={teamDetails.team_name}
          team_id={teamDetails.team_id}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Team Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle>Team Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 font-medium text-sm">
              <p>Tier: {teamDetails.team_tier}</p>
              <Separator />
              <p>Total Wins: {teamDetails.total_wins || 0}</p>
              <Separator />
              <p>Total Losses: {teamDetails.total_losses || 0}</p>
              <Separator />
              <p>Win Rate: {teamDetails.win_rate || 0}%</p>
              <Separator />
              <p>Total Earnings: ${teamDetails.total_earnings || 0}</p>
              <Separator />
              <p>Average Kills: {teamDetails.average_kills || 0}</p>
              <Separator />
              <p>Average Placement: {teamDetails.average_placement || 0}</p>
              <Separator />
              <div className="flex items-center justify-start gap-2">
                <p>Status:</p>
                {teamDetails.is_banned ? (
                  <Badge variant="destructive">Banned</Badge>
                ) : (
                  <Badge variant="secondary">Active</Badge>
                )}
              </div>
              {teamDetails.is_banned && (
                <>
                  <Separator />
                  <p>Ban Reason: {teamDetails.ban_reason}</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Team Members Card */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            {teamDetails?.members && teamDetails.members.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamDetails.members.map((member: any) => (
                    <TableRow key={member.id || member.username}>
                      <TableCell>{member.username}</TableCell>
                      <TableCell className="capitalize">
                        {member.in_game_role || "Member"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <NothingFound text="No team members yet" />
            )}
          </CardContent>
        </Card>

        {/* Tournament Performance Card */}
        <Card>
          <CardHeader>
            <CardTitle>Tournament Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {teamDetails?.tournament_performance &&
            teamDetails.tournament_performance.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tournament</TableHead>
                    <TableHead>Placement</TableHead>
                    <TableHead>Earnings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamDetails.tournament_performance.map(
                    (tournament: any, index: number) => (
                      <TableRow key={tournament.id || index}>
                        <TableCell>{tournament.name}</TableCell>
                        <TableCell>#{tournament.placement}</TableCell>
                        <TableCell>${tournament.earnings || 0}</TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            ) : (
              <NothingFound text="No performance metrics yet" />
            )}
          </CardContent>
        </Card>

        {/* Recent Matches Card */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Matches</CardTitle>
          </CardHeader>
          <CardContent>
            {teamDetails?.recent_matches &&
            teamDetails.recent_matches.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Opponent</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamDetails.recent_matches.map(
                    (match: any, index: number) => (
                      <TableRow key={match.id || index}>
                        <TableCell>{match.opponent}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              match.result === "Win"
                                ? "default"
                                : match.result === "Loss"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {match.result}
                          </Badge>
                        </TableCell>
                        <TableCell>{match.score}</TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            ) : (
              <NothingFound text="No matches yet" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
