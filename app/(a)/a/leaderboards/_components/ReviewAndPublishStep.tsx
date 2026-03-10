"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  IconLoader2,
  IconAlertCircle,
  IconDownload,
  IconPhoto,
  IconTable,
} from "@tabler/icons-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { DownloadLeaderboardButton } from "./DownloadLeaderboardButton";

// ── Canvas helpers ─────────────────────────────────────────────────────────────

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

function drawMatchCanvas(
  stats: MatchStat[],
  matchLabel: string,
  width: number,
  height: number,
  participantType: "team" | "solo",
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const s = width / 1080;
  const pad = 56 * s;

  ctx.fillStyle = "#0c0c0c";
  ctx.fillRect(0, 0, width, height);
  const grad = ctx.createLinearGradient(0, 0, width, height * 0.4);
  grad.addColorStop(0, "rgba(234,88,12,0.15)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height * 0.4);
  ctx.fillStyle = "#ea580c";
  ctx.fillRect(0, 0, width, 6 * s);

  let y = 68 * s;
  ctx.fillStyle = "#ea580c";
  ctx.font = `600 ${20 * s}px sans-serif`;
  ctx.fillText("MAP RESULTS", pad, y);
  y += 38 * s;
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${38 * s}px sans-serif`;
  ctx.fillText(matchLabel.toUpperCase(), pad, y);
  y += 48 * s;
  ctx.strokeStyle = "#ea580c";
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(width - pad, y);
  ctx.stroke();
  y += 26 * s;

  // Column positions
  const colRank = pad;
  const colName = pad + 64 * s;
  const colPlace = width - 360 * s;
  const colKills = width - 250 * s;
  const colPts = width - 90 * s;

  ctx.fillStyle = "#6b7280";
  ctx.font = `${17 * s}px sans-serif`;
  ctx.fillText("RK", colRank, y);
  ctx.fillText(participantType === "team" ? "TEAM" : "PLAYER", colName, y);
  ctx.fillText("PLACE", colPlace, y);
  ctx.fillText("KILLS", colKills, y);
  ctx.fillText("PTS", colPts, y);
  y += 12 * s;
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(width - pad, y);
  ctx.stroke();
  y += 22 * s;

  const sorted = [...stats].sort((a, b) => b.effective_total - a.effective_total);
  const rowH = 48 * s;
  const maxRows = Math.floor((height - y - 50 * s) / rowH);
  const rankColors = ["#f59e0b", "#9ca3af", "#cd7c2f"];

  for (let i = 0; i < Math.min(sorted.length, maxRows); i++) {
    const stat = sorted[i];
    const ry = y + i * rowH;

    if (i < 3) {
      ctx.fillStyle = i === 0 ? "rgba(234,88,12,0.10)" : "rgba(255,255,255,0.03)";
      ctx.fillRect(pad - 12 * s, ry - 28 * s, width - pad * 2 + 24 * s, 42 * s);
    }

    ctx.fillStyle = i < 3 ? rankColors[i] : "#4b5563";
    ctx.font = `bold ${22 * s}px sans-serif`;
    ctx.fillText(`#${i + 1}`, colRank, ry);

    ctx.fillStyle = i === 0 ? "#ffffff" : "#e5e7eb";
    ctx.font = `${i === 0 ? "bold " : ""}${22 * s}px sans-serif`;
    ctx.fillText(
      truncateText(ctx, stat.username ?? stat.team_name ?? "—", colPlace - colName - 16 * s),
      colName,
      ry,
    );

    ctx.fillStyle = "#9ca3af";
    ctx.font = `${20 * s}px sans-serif`;
    ctx.fillText(String(stat.placement), colPlace, ry);
    ctx.fillText(String(stat.kills), colKills, ry);

    ctx.fillStyle = i === 0 ? "#ea580c" : "#f97316";
    ctx.font = `bold ${22 * s}px sans-serif`;
    ctx.fillText(stat.effective_total.toFixed(1), colPts, ry);
  }

  ctx.fillStyle = "#374151";
  ctx.font = `${15 * s}px sans-serif`;
  ctx.fillText("AFC • africanfreechampionship.com", pad, height - 22 * s);
  return canvas;
}

function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

// ── Per-match download dropdown ────────────────────────────────────────────────

function MatchDownloadButton({
  match,
  participantType,
}: {
  match: MatchData;
  participantType: "team" | "solo";
}) {
  const [busy, setBusy] = useState(false);
  const label = `Match ${match.match_number} - ${match.match_map}`;

  const handleImage = (preset: "instagram" | "youtube") => {
    setBusy(true);
    try {
      const [w, h] = preset === "instagram" ? [1080, 1080] : [1280, 720];
      const suffix = preset === "instagram" ? "1080x1080" : "1280x720";
      downloadCanvas(
        drawMatchCanvas(match.stats, label, w, h, participantType),
        `${label}-${suffix}.png`,
      );
      toast.success("Image downloaded");
    } catch {
      toast.error("Failed to generate image");
    } finally {
      setBusy(false);
    }
  };

  const handleExcel = () => {
    try {
      const headers = ["Rank", participantType === "team" ? "Team" : "Player", "Placement", "Kills", "Placement Pts", "Kill Pts", "Total"];
      const sorted = [...match.stats].sort((a, b) => b.effective_total - a.effective_total);
      const rows = sorted.map((s, idx) => [
        idx + 1,
        s.username ?? s.team_name ?? "—",
        s.placement,
        s.kills,
        s.placement_points,
        s.kill_points,
        parseFloat(s.effective_total.toFixed(1)),
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, match.match_map.slice(0, 31));
      XLSX.writeFile(wb, `${label}.xlsx`);
      toast.success("Excel downloaded");
    } catch {
      toast.error("Failed to generate Excel");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>
          {busy ? <IconLoader2 size={14} className="animate-spin" /> : <IconDownload size={14} />}
          Download
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Download Map Results</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleImage("instagram")}>
          <IconPhoto size={14} className="mr-2" /> Instagram (1080×1080)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleImage("youtube")}>
          <IconPhoto size={14} className="mr-2" /> YouTube (1280×720)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExcel}>
          <IconTable size={14} className="mr-2" /> Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground font-medium">
                    {selectedMatch.match_map} — Match {selectedMatch.match_number}
                  </p>
                  <MatchDownloadButton
                    match={selectedMatch}
                    participantType={participantType}
                  />
                </div>
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
              </>
            )}
          </div>

          {/* ── Total Leaderboard summary ────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Total Leaderboard</h3>
              <DownloadLeaderboardButton
                leaderboardName={`Group ${formData.group_id} Overall`}
                teamRows={sortedOverall.map((e) => ({
                  ...e,
                  total_points: e.effective_total,
                }))}
                playerRows={playerLeaderboard}
                participantType={participantType}
              />
            </div>
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
            <div className="flex items-center justify-between gap-2">
              <TabsList className="grid grid-cols-2 flex-1">
                <TabsTrigger value="team">Team Leaderboard</TabsTrigger>
                <TabsTrigger value="player">Player Leaderboard</TabsTrigger>
              </TabsList>
              <DownloadLeaderboardButton
                leaderboardName={`Group ${formData.group_id} Overall`}
                teamRows={sortedOverall.map((e) => ({
                  ...e,
                  total_points: e.effective_total,
                }))}
                playerRows={playerLeaderboard}
                participantType={participantType}
              />
            </div>

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
