"use client";

import { useState, useEffect, useTransition, use } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
// import { useToast } from "@/components/ui/use-toast";

import axios from "axios";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { FullLoader } from "@/components/Loader";
import { BanModal } from "../../_components/BanModal";
import { PageHeader } from "@/components/PageHeader";

type Params = Promise<{
  id: string;
}>;

const page = ({ params }: { params: Params }) => {
  const { id } = use(params);
  const router = useRouter();
  // const { toast } = useToast();
  const [teamData, setTeamData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<any>(true);
  const [banModalOpen, setBanModalOpen] = useState<any>(false);
  const [banDuration, setBanDuration] = useState<any>(7);
  const [banReasons, setBanReasons] = useState<string[]>([]);

  const [pending, startTransition] = useTransition();
  const [teamDetails, setTeamDetails] = useState<any>();

  useEffect(() => {
    if (!id) return; // Don't run if id is not available yet

    startTransition(async () => {
      try {
        const decodedId = decodeURIComponent(id);
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
          { team_name: decodedId }
        );
        setTeamDetails(res.data.team);
      } catch (error: any) {
        toast.error(error.response.data.message);
      }
    });
  }, [id]);

  if (pending) return <FullLoader />;

  if (teamDetails)
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
          <Card>
            <CardHeader>
              <CardTitle>Team Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>
                  <strong>Tier:</strong> {teamDetails.team_tier}
                </p>
                <p>
                  <strong>Total Wins:</strong>{" "}
                  {teamDetails.total_wins ? teamDetails.total_wins : 0}
                </p>
                <p>
                  <strong>Total Losses:</strong>{" "}
                  {teamDetails.total_losses ? teamDetails.total_losses : 0}
                </p>
                <p>
                  <strong>Win Rate:</strong>{" "}
                  {teamDetails.win_rate ? teamDetails.win_rate : 0}
                </p>
                <p>
                  <strong>Total Earnings:</strong>$
                  {teamDetails.total_earnings ? teamDetails.total_earnings : 0}
                </p>
                <p>
                  <strong>Average Kills:</strong>{" "}
                  {teamDetails.average_kills ? teamDetails.average_kills : 0}
                </p>
                <p>
                  <strong>Average Placement:</strong>{" "}
                  {teamDetails.average_placement
                    ? teamDetails.average_placement
                    : 0}
                </p>
                <div className="flex items-center justify-start gap-2">
                  <p>
                    <strong>Status:</strong>
                  </p>
                  {teamDetails.isBanned ? (
                    <Badge variant="destructive">Banned</Badge>
                  ) : (
                    <Badge variant="secondary">Active</Badge>
                  )}
                </div>
                {teamDetails.is_banned && (
                  <p>
                    <strong>Ban Reason:</strong> {teamDetails.ban_reason}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamDetails?.members?.map((member: any) => (
                    <TableRow key={member.id}>
                      <TableCell>{member.username}</TableCell>
                      <TableCell>{member.in_game_role}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {teamDetails?.members === undefined && (
                <p className="italic py-4 text-center text-sm">
                  No team member yet
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tournament Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tournament</TableHead>
                    <TableHead>Placement</TableHead>
                    <TableHead>Earnings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamDetails?.tournament_performance?.map(
                    (tournament: any, index: any) => (
                      <TableRow key={index}>
                        <TableCell>{tournament.name}</TableCell>
                        <TableCell>{tournament.placement}</TableCell>
                        <TableCell>{tournament.earnings}</TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
              {teamDetails?.tournament_performance === undefined && (
                <p className="italic py-4 text-center text-sm">
                  No performance metrics yet
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Matches</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Opponent</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamDetails?.recent_matches?.map(
                    (match: any, index: any) => (
                      <TableRow key={index}>
                        <TableCell>{match.opponent}</TableCell>
                        <TableCell>{match.result}</TableCell>
                        <TableCell>{match.score}</TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
              {teamDetails?.recent_matches === undefined && (
                <p className="italic py-4 text-center text-sm">
                  No matches yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
};

export default page;
