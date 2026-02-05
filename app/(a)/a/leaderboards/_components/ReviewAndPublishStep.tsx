"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconEdit, IconTrash, IconLoader2 } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  onNext: () => void;
  onBack: () => void;
  formData: any;
}

interface TeamLeaderboardEntry {
  rank: number;
  team: string;
  placement: number;
  kills: number;
  assists: number;
  damage: number;
  points: number;
}

interface PlayerLeaderboardEntry {
  rank: number;
  player: string;
  team: string;
  kills: number;
  assists: number;
  damage: number;
  deaths: number;
  points: number;
}

export function ReviewAndPublishStep({ onNext, onBack, formData }: Props) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [teamLeaderboard, setTeamLeaderboard] = useState<TeamLeaderboardEntry[]>([]);
  const [playerLeaderboard, setPlayerLeaderboard] = useState<PlayerLeaderboardEntry[]>([]);

  useEffect(() => {
    // Fetch the generated leaderboards
    const fetchLeaderboards = async () => {
      try {
        setLoading(true);
        // Fetch team leaderboard
        const teamRes = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-team-leaderboard/?group_id=${formData.group_id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const teamData = await teamRes.json();
        setTeamLeaderboard(teamData.leaderboard || []);

        // Fetch player leaderboard
        const playerRes = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-player-leaderboard/?group_id=${formData.group_id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const playerData = await playerRes.json();
        setPlayerLeaderboard(playerData.leaderboard || []);
      } catch (error) {
        console.error("Error fetching leaderboards:", error);
        toast.error("Failed to load leaderboards");
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboards();
  }, [formData.group_id, token]);

  const handlePublish = async () => {
    try {
      setPublishing(true);
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/publish-leaderboard/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            group_id: formData.group_id,
          }),
        }
      );

      if (res.ok) {
        toast.success("Leaderboard published successfully!");
        onNext();
      } else {
        throw new Error("Failed to publish leaderboard");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to publish leaderboard");
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveToDrafts = async () => {
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/save-leaderboard-draft/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            group_id: formData.group_id,
          }),
        }
      );

      if (res.ok) {
        toast.success("Leaderboard saved to drafts!");
      } else {
        throw new Error("Failed to save draft");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to save draft");
    }
  };

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle>Review Generated Leaderboards</CardTitle>
        <CardDescription>
          Review and edit before publishing
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <IconLoader2 className="animate-spin" size={32} />
          </div>
        ) : (
          <Tabs defaultValue="team" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="team">Team Leaderboard</TabsTrigger>
              <TabsTrigger value="player">Player Leaderboard</TabsTrigger>
            </TabsList>

            <TabsContent value="team" className="mt-4">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Placement</TableHead>
                      <TableHead>Kills</TableHead>
                      <TableHead>Assists</TableHead>
                      <TableHead>Damage</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamLeaderboard.map((entry) => (
                      <TableRow key={entry.rank}>
                        <TableCell className="font-medium">
                          #{entry.rank}
                        </TableCell>
                        <TableCell>{entry.team}</TableCell>
                        <TableCell>{entry.placement}</TableCell>
                        <TableCell>{entry.kills}</TableCell>
                        <TableCell>{entry.assists}</TableCell>
                        <TableCell>{entry.damage}</TableCell>
                        <TableCell className="font-semibold">
                          {entry.points}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon">
                              <IconEdit size={16} />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <IconTrash size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="player" className="mt-4">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Kills</TableHead>
                      <TableHead>Assists</TableHead>
                      <TableHead>Damage</TableHead>
                      <TableHead>Deaths</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {playerLeaderboard.map((entry) => (
                      <TableRow key={entry.rank}>
                        <TableCell className="font-medium">
                          #{entry.rank}
                        </TableCell>
                        <TableCell>{entry.player}</TableCell>
                        <TableCell>{entry.team}</TableCell>
                        <TableCell>{entry.kills}</TableCell>
                        <TableCell>{entry.assists}</TableCell>
                        <TableCell>{entry.damage}</TableCell>
                        <TableCell>{entry.deaths}</TableCell>
                        <TableCell className="font-semibold">
                          {entry.points}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon">
                              <IconEdit size={16} />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <IconTrash size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        )}

        <div className="flex justify-between pt-6">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSaveToDrafts}>
              Save to Drafts
            </Button>
            <Button onClick={handlePublish} disabled={publishing}>
              {publishing ? (
                <>
                  <IconLoader2 className="mr-2 animate-spin" size={16} />
                  Publishing...
                </>
              ) : (
                "Publish Leaderboard"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
