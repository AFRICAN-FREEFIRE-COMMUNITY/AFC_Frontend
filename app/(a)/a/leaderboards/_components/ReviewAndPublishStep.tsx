"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconLoader2, IconAlertCircle } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlayerStat {
  player_id: number;
  username: string;
  kills: number;
  damage: number;
  assists: number;
}

interface MatchStat {
  competitor_id?: number;
  tournament_team_id?: number;
  team_name?: string;
  placement: number;
  username?: string;
  kills: number;
  placement_points: number;
  kill_points: number;
  bonus_points: number;
  penalty_points: number;
  total_points: number;
  effective_total: number;
  players?: PlayerStat[];
}

interface MatchData {
  match_id: number;
  match_number: number;
  match_map: string;
  stats: MatchStat[];
}

interface OverallEntry {
  competitor_id?: number;
  tournament_team_id?: number;
  competitor__user__username?: string;
  team_name?: string;
  total_kills: number;
  total_booyah: number;
  total_points: number;
  effective_total: number;
}

interface PlayerEntry {
  player_id: number;
  username: string;
  team_name: string;
  total_kills: number;
  total_damage: number;
  total_assists: number;
}

interface Props {
  onNext: () => void;
  onBack: () => void;
  formData: any;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ReviewAndPublishStep({ onNext, onBack, formData }: Props) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [overall, setOverall] = useState<OverallEntry[]>([]);
  const [playerLeaderboard, setPlayerLeaderboard] = useState<PlayerEntry[]>([]);

  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);

  const [participantType, setParticipantType] = useState<"solo" | "team">(
    "solo",
  );
  const [matches, setMatches] = useState<MatchData[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-leaderboard-details-for-event/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ event_id: formData.event_id }),
        },
      );

      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.message || data.detail || "Failed to fetch leaderboard",
        );

      const targetGroupId = parseInt(formData.group_id);
      let targetGroup: any = null;
      for (const stage of data.stages ?? []) {
        const found = (stage.groups ?? []).find(
          (g: any) => g.group_id === targetGroupId,
        );
        if (found) {
          targetGroup = found;
          break;
        }
      }
      if (!targetGroup) throw new Error("Group not found in leaderboard data");

      setParticipantType(data.participant_type === "solo" ? "solo" : "team");

      const groupMatches: MatchData[] = targetGroup.matches ?? [];
      setMatches(groupMatches);
      setSelectedMatchId(groupMatches[0]?.match_id ?? null);
      setOverall(targetGroup.overall_leaderboard ?? []);

      // Aggregate all players across every match in this group
      const playerMap = new Map<number, PlayerEntry>();
      for (const match of (targetGroup.matches ?? []) as MatchData[]) {
        for (const teamStat of match.stats) {
          for (const player of teamStat.players ?? []) {
            const existing = playerMap.get(player.player_id);
            if (existing) {
              existing.total_kills += player.kills;
              existing.total_damage += player.damage;
              existing.total_assists += player.assists;
            } else {
              playerMap.set(player.player_id, {
                player_id: player.player_id,
                username: player.username,
                team_name: teamStat.team_name ?? "—",
                total_kills: player.kills,
                total_damage: player.damage,
                total_assists: player.assists,
              });
            }
          }
        }
      }

      setPlayerLeaderboard(
        [...playerMap.values()].sort((a, b) => b.total_kills - a.total_kills),
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getEntityName = (entry: OverallEntry) =>
    entry.competitor__user__username ?? entry.team_name ?? "—";
  const getEntityId = (entry: OverallEntry) =>
    entry.competitor_id ?? entry.tournament_team_id ?? 0;

  const selectedMatch = matches.find((m) => m.match_id === selectedMatchId);

  // ── Loading / Error ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card className="gap-0">
        <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
          <IconLoader2 className="animate-spin size-10 text-primary" />
          <p className="text-sm text-muted-foreground">Loading leaderboard…</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="gap-0">
        <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
          <IconAlertCircle className="size-10 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
            <Button onClick={fetchData}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedOverall = [...overall].sort(
    (a, b) => b.effective_total - a.effective_total,
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <Card className="gap-0">
        <CardContent className="pt-4 space-y-8">
          {/* ── Results by Map ───────────────────────────────────────────── */}
          <div className="space-y-3">
            <h3 className="font-semibold">Results by Map</h3>
            <div className="flex gap-2 flex-wrap">
              {matches.map((m) => (
                <Button
                  key={m.match_id}
                  size="sm"
                  variant={
                    selectedMatchId === m.match_id ? "default" : "secondary"
                  }
                  onClick={() => setSelectedMatchId(m.match_id)}
                >
                  {m.match_map}
                </Button>
              ))}
            </div>

            {selectedMatch && (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>
                        {participantType === "team" ? "Team" : "Player"}
                      </TableHead>
                      <TableHead className="text-right">Placement</TableHead>
                      <TableHead className="text-right">Kills</TableHead>
                      <TableHead className="text-right">
                        Placement Pts
                      </TableHead>
                      <TableHead className="text-right">Kill Pts</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...selectedMatch.stats]
                      .sort((a, b) => b.effective_total - a.effective_total)
                      .map((stat, idx) => (
                        <TableRow
                          key={
                            stat.competitor_id ?? stat.tournament_team_id ?? idx
                          }
                        >
                          <TableCell className="text-muted-foreground text-sm">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            {stat.username ?? stat.team_name ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {stat.placement}
                          </TableCell>
                          <TableCell className="text-right">
                            {stat.kills}
                          </TableCell>
                          <TableCell className="text-right">
                            {stat.placement_points}
                          </TableCell>
                          <TableCell className="text-right">
                            {stat.kill_points}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {stat.effective_total}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* ── Total Leaderboard summary ────────────────────────────────── */}
          <div className="space-y-3">
            <h3 className="font-semibold">Total Leaderboard</h3>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>
                      {participantType === "team" ? "Team Name" : "Player Name"}
                    </TableHead>
                    <TableHead className="text-right">Booyahs</TableHead>
                    <TableHead className="text-right">Kills</TableHead>
                    <TableHead className="text-right">Placements</TableHead>
                    <TableHead className="text-right">Total Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedOverall.map((entry, idx) => (
                    <TableRow key={getEntityId(entry) || idx}>
                      <TableCell>
                        <Badge variant="outline">#{idx + 1}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {getEntityName(entry)}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.total_booyah}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.total_kills}
                      </TableCell>
                      <TableCell className="text-right text-primary font-medium">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {entry.effective_total.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="gap-0">
        <CardContent className="pt-4 space-y-6">
          <Tabs defaultValue="team">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="team">Team Leaderboard</TabsTrigger>
              <TabsTrigger value="player">Player Leaderboard</TabsTrigger>
            </TabsList>

            {/* ── Team Leaderboard ──────────────────────────────────────────── */}
            <TabsContent value="team" className="mt-4">
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Booyahs</TableHead>
                      <TableHead className="text-right">Kills</TableHead>
                      <TableHead className="text-right">Total Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedOverall.map((entry, idx) => (
                      <TableRow key={entry.tournament_team_id ?? idx}>
                        <TableCell>
                          <Badge variant="outline">#{idx + 1}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {entry.team_name ??
                            entry.competitor__user__username ??
                            "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.total_booyah}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.total_kills}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {entry.effective_total.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ── Player Leaderboard ────────────────────────────────────────── */}
            <TabsContent value="player" className="mt-4">
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Kills</TableHead>
                      <TableHead className="text-right">Damage</TableHead>
                      <TableHead className="text-right">Assists</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {playerLeaderboard.map((player, idx) => (
                      <TableRow key={player.player_id}>
                        <TableCell>
                          <Badge variant="outline">#{idx + 1}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {player.username}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {player.team_name}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {player.total_kills}
                        </TableCell>
                        <TableCell className="text-right">
                          {player.total_damage}
                        </TableCell>
                        <TableCell className="text-right">
                          {player.total_assists}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>

          {/* ── Actions ──────────────────────────────────────────────────────── */}
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
            <Button onClick={() => router.push("/a/leaderboards")}>Done</Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
