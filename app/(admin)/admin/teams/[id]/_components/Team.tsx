"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
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
import { BanModal } from "./BanModal";

// Mock function to fetch team data (modified to include banReason)
const fetchTeamData = async (id: string) => {
  // In a real app, this would be an API call
  await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API delay
  return {
    id,
    name: "Team Alpha",
    tier: 1,
    members: [
      { id: "1", name: "Player 1", role: "Captain" },
      { id: "2", name: "Player 2", role: "Fragger" },
      { id: "3", name: "Player 3", role: "Support" },
      { id: "4", name: "Player 4", role: "Sniper" },
      { id: "5", name: "Player 5", role: "Flex" },
    ],
    totalWins: 20,
    totalLosses: 5,
    winRate: "80%",
    totalEarnings: "$50,000",
    tournamentPerformance: [
      { name: "Summer Showdown 2023", placement: 1, earnings: "$20,000" },
      { name: "Fall Classic 2023", placement: 3, earnings: "$10,000" },
      { name: "Winter Cup 2023", placement: 2, earnings: "$15,000" },
    ],
    recentMatches: [
      { opponent: "Team Beta", result: "Win", score: "13-8" },
      { opponent: "Team Gamma", result: "Win", score: "13-10" },
      { opponent: "Team Delta", result: "Loss", score: "10-13" },
    ],
    averageKills: 45,
    averagePlacement: 2.5,
    isBanned: false,
    banReason: "", // Added banReason
  };
};

export function Team({ id }: { id: string }) {
  const params: any = useParams();
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
        console.log(res.data);
      } catch (error: any) {
        console.log(error);
        toast.error(error.response.data.message);
      }
    });
  }, [id]);

  useEffect(() => {
    const loadTeamData = async () => {
      try {
        const data = await fetchTeamData(params.id);
        setTeamData(data);
      } catch (error) {
        console.error("Failed to load team data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTeamData();
  }, [params.id]);

  if (pending) return <FullLoader text="details" />;

  if (teamDetails)
    return (
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Teams
        </Button>

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">
            {teamDetails.team_name} Details
          </h1>
          <BanModal
            isBanned={teamDetails.is_banned}
            teamName={teamDetails.team_name}
            team_id={teamDetails.team_id}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                      <TableCell>{member.name}</TableCell>
                      <TableCell>{member.role}</TableCell>
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
}
